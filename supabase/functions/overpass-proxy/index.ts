import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { city } = await req.json();
    if (!city) {
      return new Response(JSON.stringify({ error: "City is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check cache: see if this municipality already has recent data
    const { data: existing } = await supabase
      .from("municipios")
      .select("id")
      .eq("nome", city)
      .maybeSingle();

    if (existing) {
      const { data: cachedRoads } = await supabase
        .from("vias")
        .select("*")
        .eq("municipio_id", existing.id);

      if (cachedRoads && cachedRoads.length > 0) {
        const roads = cachedRoads.map((v) => ({
          id: v.id,
          name: v.nome || "Sem nome",
          surface: v.surface,
          length_m: v.length_m,
          geojson: v.geom_geojson ? JSON.parse(v.geom_geojson) : null,
        }));
        return new Response(JSON.stringify({ roads, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Query Overpass API
    const query = `[out:json][timeout:60];
area["name"="${city}"]["boundary"="administrative"]->.searchArea;
(
  way(area.searchArea)["highway"]["surface"~"unpaved|dirt|gravel|ground|earth|compacted"];
);
out body;
>;
out skel qt;`;

    const overpassRes = await fetch(
      "https://overpass-api.de/api/interpreter",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      }
    );

    if (!overpassRes.ok) {
      throw new Error(`Overpass API error: ${overpassRes.status}`);
    }

    const overpassData = await overpassRes.json();
    const elements = overpassData.elements || [];

    // Build node lookup
    const nodes: Record<number, { lat: number; lon: number }> = {};
    for (const el of elements) {
      if (el.type === "node") {
        nodes[el.id] = { lat: el.lat, lon: el.lon };
      }
    }

    // Process ways
    const ways = elements.filter((el: any) => el.type === "way");
    const roads: any[] = [];

    for (const way of ways) {
      const coords: [number, number][] = [];
      let length = 0;

      for (let i = 0; i < (way.nodes || []).length; i++) {
        const node = nodes[way.nodes[i]];
        if (node) {
          coords.push([node.lon, node.lat]);
          if (i > 0) {
            const prev = nodes[way.nodes[i - 1]];
            if (prev) {
              length += haversineDistance(prev.lat, prev.lon, node.lat, node.lon);
            }
          }
        }
      }

      if (coords.length >= 2) {
        const geojson = { type: "LineString", coordinates: coords };
        roads.push({
          id: `osm-${way.id}`,
          osm_id: way.id,
          name: way.tags?.name || "Sem nome",
          surface: way.tags?.surface || "unpaved",
          length_m: Math.round(length * 10) / 10,
          geojson,
        });
      }
    }

    // Store in DB
    // Determine estado from city name (simplified - would need a proper lookup)
    const estado = "BR";
    
    let municipioId: string;
    if (existing) {
      municipioId = existing.id;
    } else {
      const { data: newMunicipio, error: insertErr } = await supabase
        .from("municipios")
        .insert({ nome: city, estado })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      municipioId = newMunicipio.id;
    }

    // Insert roads (delete old ones first if updating)
    await supabase.from("vias").delete().eq("municipio_id", municipioId);

    if (roads.length > 0) {
      const viasToInsert = roads.map((r) => ({
        osm_id: r.osm_id,
        municipio_id: municipioId,
        nome: r.name,
        surface: r.surface,
        length_m: r.length_m,
        geom_geojson: JSON.stringify(r.geojson),
      }));

      // Insert in batches of 100
      for (let i = 0; i < viasToInsert.length; i += 100) {
        const batch = viasToInsert.slice(i, i + 100);
        await supabase.from("vias").insert(batch);
      }
    }

    return new Response(JSON.stringify({ roads, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
