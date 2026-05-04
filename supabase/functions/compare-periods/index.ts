import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const municipioId = url.searchParams.get("municipio_id");
    const fromIso = url.searchParams.get("from");
    const toIso = url.searchParams.get("to");
    const surfaceFilter = url.searchParams.get("surface") || "";
    const q = (url.searchParams.get("q") || "").toLowerCase();
    const minLen = Number(url.searchParams.get("min_len_m") || "0");
    const limit = Math.min(20000, Number(url.searchParams.get("limit") || "5000"));

    if (!municipioId) {
      return new Response(JSON.stringify({ error: "municipio_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: snaps } = await supabase
      .from("vias_snapshots")
      .select("id, snapshot_at, total_km_unpaved, total_vias, data_jsonb")
      .eq("municipio_id", municipioId)
      .order("snapshot_at", { ascending: true });

    if (!snaps || snaps.length === 0) {
      return new Response(JSON.stringify({ snapshots: [], comparison: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pickClosest = (target?: string | null) => {
      if (!target) return null;
      const t = new Date(target).getTime();
      return snaps.reduce((best, s) =>
        Math.abs(new Date(s.snapshot_at).getTime() - t) <
        Math.abs(new Date(best.snapshot_at).getTime() - t) ? s : best
      );
    };

    const fromSnap = pickClosest(fromIso) || snaps[0];
    const toSnap = pickClosest(toIso) || snaps[snaps.length - 1];

    const km_paved_added = Math.max(0, fromSnap.total_km_unpaved - toSnap.total_km_unpaved);
    const vias_diff = (fromSnap.total_vias || 0) - (toSnap.total_vias || 0);

    const fromBy = (fromSnap.data_jsonb?.by_surface_m || {}) as Record<string, number>;
    const toBy = (toSnap.data_jsonb?.by_surface_m || {}) as Record<string, number>;
    const surfaces = new Set([...Object.keys(fromBy), ...Object.keys(toBy)]);
    const by_surface_diff: any[] = [];
    for (const s of surfaces) {
      const f = fromBy[s] || 0; const t = toBy[s] || 0;
      by_surface_diff.push({ surface: s, from_m: f, to_m: t, diff_m: t - f });
    }
    by_surface_diff.sort((a, b) => Math.abs(b.diff_m) - Math.abs(a.diff_m));

    const fromVias = ((fromSnap.data_jsonb?.vias || []) as any[]);
    const toVias = ((toSnap.data_jsonb?.vias || []) as any[]);
    const fromMap = new Map(fromVias.map((v) => [v.osm_id, v]));
    const toMap = new Map(toVias.map((v) => [v.osm_id, v]));

    const passes = (v: any, fromSurface?: string) => {
      if (surfaceFilter && surfaceFilter !== "all" && v.surface !== surfaceFilter && fromSurface !== surfaceFilter) return false;
      if (q && !(v.nome || "").toLowerCase().includes(q)) return false;
      if (minLen && (v.length_m || 0) < minLen) return false;
      return true;
    };

    const paved: any[] = [], new_unpaved: any[] = [], surface_changed: any[] = [];
    for (const [id, v] of fromMap) {
      if (!toMap.has(id)) { if (passes(v)) paved.push(v); }
      else {
        const t = toMap.get(id)!;
        if (t.surface !== v.surface) {
          const merged = { ...t, from_surface: v.surface };
          if (passes(merged, v.surface)) surface_changed.push(merged);
        }
      }
    }
    for (const [id, v] of toMap) if (!fromMap.has(id) && passes(v)) new_unpaved.push(v);

    const cap = (arr: any[]) => arr.sort((a, b) => (b.length_m || 0) - (a.length_m || 0)).slice(0, limit);

    return new Response(
      JSON.stringify({
        snapshots: snaps.map((s) => ({ id: s.id, snapshot_at: s.snapshot_at, total_km_unpaved: s.total_km_unpaved, total_vias: s.total_vias })),
        comparison: {
          from: { snapshot_at: fromSnap.snapshot_at, total_km_unpaved: fromSnap.total_km_unpaved, total_vias: fromSnap.total_vias },
          to: { snapshot_at: toSnap.snapshot_at, total_km_unpaved: toSnap.total_km_unpaved, total_vias: toSnap.total_vias },
          km_paved_added, vias_diff, by_surface_diff,
          counts: { paved: paved.length, new_unpaved: new_unpaved.length, surface_changed: surface_changed.length },
          roads_changed: { paved: cap(paved), new_unpaved: cap(new_unpaved), surface_changed: cap(surface_changed) },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("compare-periods error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
