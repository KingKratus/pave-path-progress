import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function queryOverpass(query: string): Promise<any> {
  let lastErr: any = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
          "User-Agent": "RankingPavimentacao/1.0 (contato@ranking-pavimentacao.app)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.ok) return await res.json();
      lastErr = new Error(`Overpass ${res.status} @ ${endpoint}: ${(await res.text()).slice(0, 200)}`);
      console.warn(lastErr.message);
    } catch (e: any) {
      lastErr = e;
      console.warn(`Overpass fetch failed @ ${endpoint}: ${e.message}`);
    }
  }
  throw lastErr || new Error("All Overpass endpoints failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const startedAt = Date.now();
  let logId: string | null = null;
  let municipio = "";
  let uf: string | null = null;
  let municipioId: string | null = null;

  try {
    const body = await req.json();
    municipio = body.municipio;
    uf = body.uf || null;
    const triggeredBy = body.triggered_by || "manual";

    if (!municipio) {
      return new Response(JSON.stringify({ error: "municipio is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create municipio
    let { data: mun } = await supabase
      .from("municipios").select("id").eq("nome", municipio).maybeSingle();

    if (!mun) {
      const { data: newMun, error } = await supabase
        .from("municipios")
        .insert({ nome: municipio, estado: uf || "BR", uf })
        .select("id").single();
      if (error) throw error;
      mun = newMun;
    }
    municipioId = mun!.id;

    // Insert running log
    const { data: logRow } = await supabase
      .from("sync_logs")
      .insert({
        municipio_id: municipioId,
        municipio_nome: municipio,
        uf,
        status: "running",
        triggered_by: triggeredBy,
      })
      .select("id").single();
    logId = logRow?.id ?? null;

    // Build Overpass query — try with UF filter first; if no result, retry without
    const buildQuery = (withUf: boolean) => {
      const ufClause = withUf && uf
        ? `["ISO3166-2"="BR-${uf}"]`
        : `["addr:country"="BR"]`;
      return `[out:json][timeout:120];
(area["name"="${municipio.replace(/"/g, '\\"')}"]["boundary"="administrative"]["admin_level"~"7|8"]${withUf && uf ? '' : ''};)->.a;
(way(area.a)["highway"]["surface"~"unpaved|dirt|gravel|ground|earth|compacted|sand|mud|fine_gravel|pebblestone"];);
out body;>;out skel qt;`;
    };

    let data = await queryOverpass(buildQuery(false));
    let elements = data.elements || [];

    const nodes: Record<number, { lat: number; lon: number }> = {};
    for (const el of elements) if (el.type === "node") nodes[el.id] = { lat: el.lat, lon: el.lon };

    const ways = elements.filter((e: any) => e.type === "way");
    const roads: any[] = [];
    for (const way of ways) {
      const coords: [number, number][] = [];
      let len = 0;
      for (let i = 0; i < (way.nodes || []).length; i++) {
        const n = nodes[way.nodes[i]];
        if (!n) continue;
        coords.push([n.lon, n.lat]);
        if (i > 0) {
          const p = nodes[way.nodes[i - 1]];
          if (p) len += haversine(p.lat, p.lon, n.lat, n.lon);
        }
      }
      if (coords.length >= 2) {
        roads.push({
          osm_id: way.id,
          municipio_id: municipioId,
          nome: way.tags?.name || null,
          surface: way.tags?.surface || "unpaved",
          length_m: Math.round(len * 10) / 10,
          geom_geojson: JSON.stringify({ type: "LineString", coordinates: coords }),
        });
      }
    }

    await supabase.from("vias").delete().eq("municipio_id", municipioId);
    for (let i = 0; i < roads.length; i += 100) {
      await supabase.from("vias").insert(roads.slice(i, i + 100));
    }

    const totalKm = roads.reduce((s, r) => s + r.length_m, 0) / 1000;
    const bySurface: Record<string, number> = {};
    for (const r of roads) bySurface[r.surface] = (bySurface[r.surface] || 0) + r.length_m;

    await supabase.from("vias_snapshots").insert({
      municipio_id: municipioId,
      total_km_unpaved: totalKm,
      total_vias: roads.length,
      data_jsonb: { by_surface_m: bySurface },
    });

    await supabase
      .from("municipios")
      .update({ last_sync_at: new Date().toISOString(), uf: uf ?? undefined })
      .eq("id", municipioId);

    if (logId) {
      await supabase.from("sync_logs").update({
        status: "ok",
        total_vias: roads.length,
        total_km: totalKm,
        duration_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({ ok: true, municipio_id: municipioId, total_vias: roads.length, total_km: totalKm }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-municipio error:", err);
    if (logId) {
      await supabase.from("sync_logs").update({
        status: "error",
        message: err.message?.slice(0, 1000) || "unknown error",
        duration_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      }).eq("id", logId);
    } else if (municipio) {
      await supabase.from("sync_logs").insert({
        municipio_id: municipioId,
        municipio_nome: municipio,
        uf,
        status: "error",
        message: err.message?.slice(0, 1000) || "unknown error",
        duration_ms: Date.now() - startedAt,
        finished_at: new Date().toISOString(),
      });
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
