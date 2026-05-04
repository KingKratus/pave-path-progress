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
      lastErr = e; console.warn(`Overpass fetch failed @ ${endpoint}: ${e.message}`);
    }
  }
  throw lastErr || new Error("All Overpass endpoints failed");
}

function pointInPolygon(point: [number, number], polygon: number[][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInMulti(point: [number, number], geom: any): boolean {
  if (!geom) return true;
  if (geom.type === "Polygon") return geom.coordinates.some((ring: number[][]) => pointInPolygon(point, ring));
  if (geom.type === "MultiPolygon")
    return geom.coordinates.some((poly: number[][][]) => poly.some((ring) => pointInPolygon(point, ring)));
  return true;
}

const ALLOWED_HIGHWAYS = new Set([
  "residential", "unclassified", "tertiary", "secondary", "primary",
  "living_street", "road", "trunk",
]);

function pickName(tags: any): string | null {
  if (!tags) return null;
  return tags.name || tags["name:pt"] || tags.alt_name || tags.official_name ||
    tags.loc_name || tags["addr:street"] || tags.ref || null;
}

function pickBairro(tags: any): string | null {
  if (!tags) return null;
  return tags["addr:suburb"] || tags["addr:neighbourhood"] || tags["addr:district"] || null;
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
  let errorStage: "overpass" | "ingest" | "calc" | "unknown" = "unknown";

  try {
    const body = await req.json();
    municipio = body.municipio;
    uf = body.uf || null;
    const triggeredBy = body.triggered_by || "manual";
    const parentLogId = body.parent_log_id || null;

    if (!municipio) {
      return new Response(JSON.stringify({ error: "municipio is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let { data: mun } = await supabase
      .from("municipios").select("id").eq("nome", municipio).maybeSingle();

    if (!mun) {
      const { data: newMun, error } = await supabase
        .from("municipios").insert({ nome: municipio, estado: uf || "BR", uf })
        .select("id").single();
      if (error) throw error;
      mun = newMun;
    }
    municipioId = mun!.id;

    let attempt = 1;
    if (parentLogId) {
      const { count } = await supabase
        .from("sync_logs").select("id", { count: "exact", head: true })
        .or(`id.eq.${parentLogId},parent_log_id.eq.${parentLogId}`);
      attempt = (count || 0) + 1;
    }

    const { data: logRow } = await supabase
      .from("sync_logs").insert({
        municipio_id: municipioId, municipio_nome: municipio, uf,
        status: "running", triggered_by: triggeredBy,
        parent_log_id: parentLogId, attempt,
      })
      .select("id").single();
    logId = logRow?.id ?? null;

    errorStage = "overpass";
    const boundaryQuery = `[out:json][timeout:60];
relation["name"="${municipio.replace(/"/g, '\\"')}"]["boundary"="administrative"]["admin_level"~"7|8"]${uf ? `["ISO3166-2"~"BR-${uf}"]` : ''};
out geom;`;
    let boundaryGeom: any = null;
    try {
      const bdata = await queryOverpass(boundaryQuery);
      const rel = (bdata.elements || []).find((e: any) => e.type === "relation");
      if (rel?.members) {
        const rings: number[][][] = [];
        const outers = rel.members.filter((m: any) => m.type === "way" && (m.role === "outer" || m.role === ""));
        for (const m of outers) {
          if (m.geometry) rings.push(m.geometry.map((p: any) => [p.lon, p.lat]));
        }
        if (rings.length > 0) {
          boundaryGeom = rings.length === 1
            ? { type: "Polygon", coordinates: [rings[0]] }
            : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
        }
      }
    } catch (e) {
      console.warn("boundary fetch failed:", (e as Error).message);
    }

    const waysQuery = `[out:json][timeout:120];
(area["name"="${municipio.replace(/"/g, '\\"')}"]["boundary"="administrative"]["admin_level"~"7|8"];)->.a;
(way(area.a)["highway"]["surface"~"unpaved|dirt|gravel|ground|earth|compacted|sand|mud|fine_gravel|pebblestone"];);
out body;>;out skel qt;`;
    const data = await queryOverpass(waysQuery);
    const elements = data.elements || [];

    errorStage = "ingest";
    const nodes: Record<number, { lat: number; lon: number }> = {};
    for (const el of elements) if (el.type === "node") nodes[el.id] = { lat: el.lat, lon: el.lon };

    const ways = elements.filter((e: any) => e.type === "way");

    // Build named-roads index for inheriting names from neighboring ways
    const namedRoads: { name: string; coords: [number, number][] }[] = [];
    for (const w of ways) {
      const nm = pickName(w.tags);
      if (!nm) continue;
      const cs: [number, number][] = (w.nodes || []).map((id: number) => nodes[id]).filter(Boolean).map((n: any) => [n.lon, n.lat]);
      if (cs.length >= 2) namedRoads.push({ name: nm, coords: cs });
    }

    const inheritName = (mid: [number, number]): string | null => {
      let best: { name: string; d: number } | null = null;
      for (const r of namedRoads) {
        for (const c of r.coords) {
          const d = haversine(mid[1], mid[0], c[1], c[0]);
          if (d < 35 && (!best || d < best.d)) best = { name: r.name, d };
        }
      }
      return best?.name || null;
    };

    const roads: any[] = [];
    const snapshotVias: any[] = [];
    for (const way of ways) {
      const highway = way.tags?.highway;
      if (highway && !ALLOWED_HIGHWAYS.has(highway)) continue;

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
      if (coords.length < 2) continue;

      const mid = coords[Math.floor(coords.length / 2)] as [number, number];
      if (boundaryGeom && !pointInMulti(mid, boundaryGeom)) continue;

      let nome = pickName(way.tags);
      let nomeStatus: "ok" | "herdado" | "sem_nome" = nome ? "ok" : "sem_nome";
      if (!nome) {
        const inh = inheritName(mid);
        if (inh) { nome = inh; nomeStatus = "herdado"; }
      }
      const bairro = pickBairro(way.tags);
      const surface = way.tags?.surface || "unpaved";
      const lengthM = Math.round(len * 10) / 10;

      roads.push({
        osm_id: way.id, municipio_id: municipioId, nome,
        surface, length_m: lengthM,
        centroid_lat: mid[1], centroid_lng: mid[0],
        nome_status: nomeStatus, bairro,
        geom_geojson: JSON.stringify({ type: "LineString", coordinates: coords }),
      });
      snapshotVias.push({ osm_id: way.id, nome, surface, length_m: lengthM, bairro });
    }

    await supabase.from("vias").delete().eq("municipio_id", municipioId);
    for (let i = 0; i < roads.length; i += 100) {
      await supabase.from("vias").insert(roads.slice(i, i + 100));
    }

    errorStage = "calc";
    const totalKm = roads.reduce((s, r) => s + r.length_m, 0) / 1000;
    const bySurface: Record<string, number> = {};
    for (const r of roads) bySurface[r.surface] = (bySurface[r.surface] || 0) + r.length_m;

    await supabase.from("vias_snapshots").insert({
      municipio_id: municipioId,
      total_km_unpaved: totalKm,
      total_vias: roads.length,
      data_jsonb: { by_surface_m: bySurface, vias: snapshotVias },
    });

    const updateFields: any = { last_sync_at: new Date().toISOString() };
    if (uf) updateFields.uf = uf;
    if (boundaryGeom) updateFields.geom_geojson = JSON.stringify(boundaryGeom);
    await supabase.from("municipios").update(updateFields).eq("id", municipioId);

    if (logId) {
      await supabase.from("sync_logs").update({
        status: "ok", total_vias: roads.length, total_km: totalKm,
        duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({ ok: true, municipio_id: municipioId, total_vias: roads.length, total_km: totalKm, has_boundary: !!boundaryGeom }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("sync-municipio error:", err);
    if (logId) {
      await supabase.from("sync_logs").update({
        status: "error", error_stage: errorStage,
        message: err.message?.slice(0, 1000) || "unknown error",
        duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
      }).eq("id", logId);
    } else if (municipio) {
      await supabase.from("sync_logs").insert({
        municipio_id: municipioId, municipio_nome: municipio, uf,
        status: "error", error_stage: errorStage,
        message: err.message?.slice(0, 1000) || "unknown error",
        duration_ms: Date.now() - startedAt, finished_at: new Date().toISOString(),
      });
    }
    return new Response(JSON.stringify({ error: err.message, stage: errorStage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
