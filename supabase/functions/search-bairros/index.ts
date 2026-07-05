// Busca unificada: bairros no DB (via distinct em vias) + fallback Nominatim (suburb/neighbourhood).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const rl = await checkRateLimit(req, "search-bairros", { perMinute: 30, perDay: 500 });
  if (!rl.ok) return rateLimitResponse(rl, corsHeaders);

  try {
    let q = ""; let city: string | undefined;
    if (req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      q = (b.q || "").trim(); city = b.city;
    } else {
      const url = new URL(req.url);
      q = (url.searchParams.get("q") || "").trim();
      city = url.searchParams.get("city") || undefined;
    }
    if (!q || q.length < 2) return new Response(JSON.stringify({ results: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });


    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) DB — bairros já ingeridos em vias
    let dbQ = supa.from("vias").select("bairro, municipio_id, municipios(nome, uf)").ilike("bairro", `%${q}%`).not("bairro", "is", null).limit(200);
    const { data: rows } = await dbQ;
    const seen = new Set<string>();
    const dbResults: any[] = [];
    for (const r of rows || []) {
      const nome = (r.bairro || "").trim();
      const mun = (r as any).municipios?.nome;
      const uf = (r as any).municipios?.uf;
      if (!nome || !mun) continue;
      const k = `${nome.toLowerCase()}|${mun.toLowerCase()}|${uf}`;
      if (seen.has(k)) continue;
      seen.add(k);
      dbResults.push({ source: "db", bairro: nome, municipio: mun, uf });
      if (dbResults.length >= 8) break;
    }

    // 2) Nominatim fallback (limitar 5)
    let nomResults: any[] = [];
    try {
      const qStr = encodeURIComponent(city ? `${q}, ${city}, Brasil` : `${q}, Brasil`);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${qStr}&format=json&addressdetails=1&limit=5&countrycodes=br`, {
        headers: { "Accept": "application/json", "User-Agent": "PavePathProgress/1.0" },
      });
      if (r.ok) {
        const arr = await r.json();
        nomResults = (arr as any[])
          .filter((x) => ["suburb", "neighbourhood", "quarter", "residential"].includes(x.type))
          .slice(0, 5)
          .map((x) => ({
            source: "nominatim",
            bairro: x.address?.suburb || x.address?.neighbourhood || x.address?.quarter || x.display_name.split(",")[0],
            municipio: x.address?.city || x.address?.town || x.address?.municipality,
            uf: x.address?.state_code?.toUpperCase() || x.address?.["ISO3166-2-lvl4"]?.split("-").pop(),
          })).filter((x) => x.bairro && x.municipio);
      }
    } catch (_) { /* ignora */ }

    return new Response(JSON.stringify({ results: [...dbResults, ...nomResults] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
