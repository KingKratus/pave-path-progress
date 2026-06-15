// Camadas extras Overpass sob demanda (pontes, escolas, saúde, transporte, qualidade)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const LAYERS: Record<string, (area: string) => string> = {
  pontes: (a) => `( way(area.${a})["bridge"="yes"]["surface"~"unpaved|dirt|gravel|earth|ground"]; );`,
  escolas: (a) => `( node(area.${a})["amenity"~"school|kindergarten|college"]; );`,
  saude: (a) => `( node(area.${a})["amenity"~"hospital|clinic|doctors|health_post"]; );`,
  transporte: (a) => `( node(area.${a})["highway"="bus_stop"]; node(area.${a})["public_transport"="platform"]; );`,
  qualidade: (a) => `( way(area.${a})["highway"]["smoothness"~"bad|very_bad|horrible|very_horrible|impassable"]; );`,
  iluminacao: (a) => `( way(area.${a})["highway"]["lit"="no"]; );`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { city, uf, layer } = await req.json();
    if (!city || !layer || !LAYERS[layer]) {
      return new Response(JSON.stringify({ error: "city e layer válidos obrigatórios", layers: Object.keys(LAYERS) }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const areaQ = `area["name"="${city}"]["boundary"="administrative"]->.a;`;
    const q = `[out:json][timeout:60];
${areaQ}
${LAYERS[layer]("a")}
out geom;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(q)}`,
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    const data = await res.json();
    const items = (data.elements || []).map((el: any) => ({
      id: el.id, type: el.type, tags: el.tags || {},
      lat: el.lat ?? el.center?.lat ?? null,
      lon: el.lon ?? el.center?.lon ?? null,
      geometry: el.geometry || null,
    }));
    return new Response(JSON.stringify({ city, uf, layer, count: items.length, items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
