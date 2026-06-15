// Overpass attic query - histórico de pavimentação sob demanda. NUNCA cacheia.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

function hav(a:[number,number], b:[number,number]) {
  const R=6371000, toRad=(d:number)=>d*Math.PI/180;
  const dLat=toRad(b[0]-a[0]), dLon=toRad(b[1]-a[1]);
  const x=Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { city, uf, bairro, dates } = await req.json();
    if (!city || !Array.isArray(dates) || dates.length === 0) {
      return new Response(JSON.stringify({ error: "city e dates[] são obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const limited = dates.slice(0, 12); // até 12 pontos por chamada

    const areaQ = uf
      ? `area["name"="${city}"]["boundary"="administrative"]["is_in:state_code"~"${uf}"]->.a;`
      : `area["name"="${city}"]["boundary"="administrative"]->.a;`;

    const bairroFilter = bairro ? `["addr:suburb"~"${bairro}",i]` : "";

    const series: Array<{ date: string; total_km_unpaved: number; vias: number; error?: string }> = [];

    for (const date of limited) {
      const ts = `${date}T00:00:00Z`;
      const q = `[out:json][timeout:60][date:"${ts}"];
${areaQ}
( way(area.a)["highway"]["surface"~"unpaved|dirt|gravel|ground|earth|compacted|sand|mud"]${bairroFilter}; );
out geom;`;
      try {
        const res = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(q)}`,
        });
        if (!res.ok) { series.push({ date, total_km_unpaved: 0, vias: 0, error: `HTTP ${res.status}` }); continue; }
        const data = await res.json();
        let total = 0, count = 0;
        for (const el of data.elements || []) {
          if (el.type !== "way" || !el.geometry) continue;
          let len = 0;
          for (let i = 1; i < el.geometry.length; i++) {
            len += hav([el.geometry[i-1].lat, el.geometry[i-1].lon], [el.geometry[i].lat, el.geometry[i].lon]);
          }
          total += len; count++;
        }
        series.push({ date, total_km_unpaved: total / 1000, vias: count });
      } catch (e: any) {
        series.push({ date, total_km_unpaved: 0, vias: 0, error: e?.message || "fetch falhou" });
      }
    }

    return new Response(JSON.stringify({ city, uf, bairro, series }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
