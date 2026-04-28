import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: municipios } = await supabase.from("municipios").select("id, nome");
    if (!municipios) throw new Error("no municipios");

    const periodo = new Date().toISOString().slice(0, 7); // YYYY-MM
    const results: { municipio_id: string; score: number; km_unpaved: number; km_paved_added: number }[] = [];

    for (const m of municipios) {
      const { data: snaps } = await supabase
        .from("vias_snapshots")
        .select("total_km_unpaved, snapshot_at")
        .eq("municipio_id", m.id)
        .order("snapshot_at", { ascending: false })
        .limit(2);

      if (!snaps || snaps.length === 0) continue;

      const current = snaps[0].total_km_unpaved;
      const previous = snaps[1]?.total_km_unpaved ?? current;
      const km_paved_added = Math.max(0, previous - current);
      const eficiencia = previous > 0 ? km_paved_added / previous : 0;
      const score = 0.5 * km_paved_added + 0.3 * eficiencia * 100 - 0.2 * current;

      results.push({ municipio_id: m.id, score, km_unpaved: current, km_paved_added });
    }

    results.sort((a, b) => b.score - a.score);

    // Clear current period and insert ranked rows
    await supabase.from("ranking").delete().eq("periodo", periodo);
    for (const r of results) {
      await supabase.from("ranking").insert({
        municipio_id: r.municipio_id,
        periodo,
        score: r.score,
        km_unpaved: r.km_unpaved,
        km_paved_added: r.km_paved_added,
      });
    }

    return new Response(JSON.stringify({ ok: true, periodo, total: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("calculate-ranking error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
