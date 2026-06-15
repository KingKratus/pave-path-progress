// Recalcula stats_agregadas (UF + BR) - poucas linhas, leve.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UNPAVED = new Set(["unpaved","dirt","gravel","ground","earth","compacted","sand","mud"]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // pega municipios com last_sync
    const { data: muns } = await supabase.from("municipios").select("id, uf, last_sync_at");
    const munByUf = new Map<string, { ids: string[], synced: number }>();
    for (const m of muns || []) {
      const uf = m.uf || "??";
      if (!munByUf.has(uf)) munByUf.set(uf, { ids: [], synced: 0 });
      const e = munByUf.get(uf)!;
      e.ids.push(m.id);
      if (m.last_sync_at) e.synced++;
    }

    // pega vias em lotes (id, surface, length_m, municipio_id) - sem geometria
    const ufTotals = new Map<string, { unp: number; pav: number; vias: number }>();
    let from = 0; const STEP = 5000;
    while (true) {
      const { data, error } = await supabase.from("vias").select("surface,length_m,municipio_id").range(from, from + STEP - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      const munUf = new Map<string,string>();
      for (const m of muns || []) munUf.set(m.id, m.uf || "??");
      for (const v of data) {
        const uf = munUf.get(v.municipio_id) || "??";
        const t = ufTotals.get(uf) || { unp: 0, pav: 0, vias: 0 };
        const km = (v.length_m || 0) / 1000;
        if (UNPAVED.has(v.surface)) t.unp += km; else t.pav += km;
        t.vias++;
        ufTotals.set(uf, t);
      }
      if (data.length < STEP) break;
      from += STEP;
    }

    const rows: any[] = [];
    let brUnp = 0, brPav = 0, brVias = 0, brSynced = 0;
    for (const [uf, t] of ufTotals) {
      const synced = munByUf.get(uf)?.synced || 0;
      rows.push({ scope: "uf", key: uf, total_km_unpaved: t.unp, total_km_paved: t.pav, total_vias: t.vias, municipios_sincronizados: synced, atualizado_em: new Date().toISOString() });
      brUnp += t.unp; brPav += t.pav; brVias += t.vias; brSynced += synced;
    }
    rows.push({ scope: "br", key: "BR", total_km_unpaved: brUnp, total_km_paved: brPav, total_vias: brVias, municipios_sincronizados: brSynced, atualizado_em: new Date().toISOString() });

    if (rows.length) await supabase.from("stats_agregadas").upsert(rows, { onConflict: "scope,key" });
    return new Response(JSON.stringify({ ok: true, rows: rows.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
