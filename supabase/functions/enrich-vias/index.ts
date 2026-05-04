import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function reverseGeocode(lat: number, lng: number): Promise<{ road?: string; bairro?: string }> {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: { "User-Agent": "RankingPavimentacao/1.0 (contato@ranking-pavimentacao.app)" },
    });
    if (!res.ok) return {};
    const j = await res.json();
    return { road: j.address?.road, bairro: j.address?.suburb || j.address?.neighbourhood || j.address?.city_district };
  } catch { return {}; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { municipio_id, max = 50 } = await req.json();
    if (!municipio_id) return new Response(JSON.stringify({ error: "municipio_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: vias } = await supabase.from("vias")
      .select("id, centroid_lat, centroid_lng, nome_status")
      .eq("municipio_id", municipio_id)
      .eq("nome_status", "sem_nome")
      .not("centroid_lat", "is", null)
      .limit(max);

    let updated = 0;
    for (const v of vias || []) {
      const { road, bairro } = await reverseGeocode(v.centroid_lat as number, v.centroid_lng as number);
      const patch: any = {};
      if (road) { patch.nome = road; patch.nome_status = "geocodificado"; }
      if (bairro) patch.bairro = bairro;
      if (Object.keys(patch).length) {
        await supabase.from("vias").update(patch).eq("id", v.id);
        updated++;
      }
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate-limit 1 req/s
    }

    return new Response(JSON.stringify({ ok: true, processed: vias?.length || 0, updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
