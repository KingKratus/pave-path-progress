import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapLegend } from "./MapLegend";

interface Road {
  id: string;
  osm_id?: number;
  name: string;
  surface: string;
  length_m: number;
  geojson: any;
}

interface LeafletMapProps {
  roads: Road[];
  cityName: string;
  boundaryGeoJson?: any;
  highlightOsmIds?: Set<number>;
  focusOsmId?: number | null;
  bairro?: string | null;
  uf?: string;
}

const SURFACE_COLORS: Record<string, string> = {
  unpaved: "#ef4444", dirt: "#f97316", gravel: "#eab308",
  ground: "#dc2626", earth: "#b91c1c", compacted: "#f59e0b",
  sand: "#fbbf24", mud: "#92400e",
};

const TILE_STYLES: Record<string, { url: string; attribution: string }> = {
  osm: { url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", attribution: "© OpenStreetMap" },
  carto_light: { url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", attribution: "© OSM © Carto" },
  carto_dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", attribution: "© OSM © Carto" },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", attribution: "© Esri" },
  topo: { url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", attribution: "© OpenTopoMap" },
};

const bairroCache = new Map<string, any>();

async function fetchBairroPolygon(bairro: string, city: string, uf?: string): Promise<{ geo: any; error?: string }> {
  const key = `${bairro}|${city}|${uf || ""}`;
  if (bairroCache.has(key)) return { geo: bairroCache.get(key) };
  try {
    const q = encodeURIComponent(`${bairro}, ${city}${uf ? ", " + uf : ""}, Brasil`);
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&polygon_geojson=1&limit=1`, {
      headers: { "Accept": "application/json" },
    });
    if (!res.ok) return { geo: null, error: `Nominatim ${res.status}` };
    const data = await res.json();
    const geo = data?.[0]?.geojson || null;
    bairroCache.set(key, geo);
    return { geo, error: geo ? undefined : "Bairro não encontrado no Nominatim" };
  } catch (e: any) {
    return { geo: null, error: e?.message || "Falha ao buscar bairro" };
  }
}

export const LeafletMap = ({ roads, cityName, boundaryGeoJson, highlightOsmIds, focusOsmId, bairro, uf }: LeafletMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [style, setStyle] = useState<string>(() => localStorage.getItem("mapStyle") || "osm");
  const [bairroGeo, setBairroGeo] = useState<any>(null);

  useEffect(() => {
    setBairroGeo(null);
    if (bairro && cityName) fetchBairroPolygon(bairro, cityName, uf).then(setBairroGeo);
  }, [bairro, cityName, uf]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstance.current) mapInstance.current.remove();

    const map = L.map(mapRef.current).setView([-14.235, -51.925], 5);
    mapInstance.current = map;

    const t = TILE_STYLES[style] || TILE_STYLES.osm;
    L.tileLayer(t.url, { attribution: t.attribution }).addTo(map);

    if (boundaryGeoJson) {
      try {
        L.geoJSON(boundaryGeoJson, {
          style: { color: "hsl(158 64% 24%)", weight: 2, fillOpacity: 0, dashArray: "4 4" },
        }).addTo(map);
        const world: [number, number][] = [[-90, -180], [-90, 180], [90, 180], [90, -180], [-90, -180]];
        const holes: [number, number][][] = [];
        const collect = (g: any) => {
          if (g.type === "Polygon") g.coordinates.forEach((ring: number[][]) => holes.push(ring.map(([lo, la]: number[]) => [la, lo] as [number, number])));
          if (g.type === "MultiPolygon") g.coordinates.forEach((p: number[][][]) => p.forEach((ring) => holes.push(ring.map(([lo, la]) => [la, lo] as [number, number]))));
        };
        collect(boundaryGeoJson);
        L.polygon([world, ...holes], { color: "transparent", fillColor: "#000", fillOpacity: 0.45, interactive: false }).addTo(map);
        const layer = L.geoJSON(boundaryGeoJson);
        const b = layer.getBounds();
        map.fitBounds(b, { padding: [20, 20] });
        map.setMaxBounds(b.pad(0.3));
      } catch (e) { console.warn("boundary render failed", e); }
    }

    if (bairroGeo) {
      try {
        const layer = L.geoJSON(bairroGeo, {
          style: { color: "hsl(47 92% 53%)", weight: 3, fillColor: "hsl(47 92% 53%)", fillOpacity: 0.15 },
        }).addTo(map);
        const tooltip = L.tooltip({ permanent: true, direction: "center", className: "bairro-label" }).setContent(bairro || "");
        layer.bindTooltip(tooltip);
        map.flyToBounds(layer.getBounds(), { padding: [30, 30], duration: 0.6, maxZoom: 16 });
      } catch (e) { console.warn("bairro render failed", e); }
    }

    const features = roads.filter((r) => r.geojson).map((r) => ({
      type: "Feature" as const,
      properties: { id: r.id, osm_id: r.osm_id, name: r.name, surface: r.surface, length_m: r.length_m },
      geometry: r.geojson,
    }));

    if (features.length > 0) {
      const layer = L.geoJSON({ type: "FeatureCollection", features } as any, {
        style: (f) => {
          const oid = Number(f?.properties?.osm_id);
          const isHL = highlightOsmIds?.has(oid);
          const isFocus = focusOsmId && oid === focusOsmId;
          return {
            color: isFocus ? "#06b6d4" : (SURFACE_COLORS[f?.properties?.surface] || "#ef4444"),
            weight: isFocus ? 7 : isHL ? 5 : 3,
            opacity: isFocus ? 1 : isHL ? 1 : 0.85,
          };
        },
        onEachFeature: (f, l) => {
          const p = f.properties;
          l.bindPopup(
            `<strong>${p.name || "Sem nome"}</strong><br/>Superfície: ${p.surface}<br/>${
              p.length_m >= 1000 ? (p.length_m / 1000).toFixed(2) + " km" : p.length_m.toFixed(0) + " m"
            }`
          );
          if (focusOsmId && Number(p.osm_id) === focusOsmId) {
            setTimeout(() => {
              try {
                const b = (l as any).getBounds();
                map.flyToBounds(b, { maxZoom: 18, padding: [40, 40], duration: 0.8 });
                (l as any).openPopup();
              } catch {}
            }, 250);
          }
        },
      });
      layer.addTo(map);
      if (!boundaryGeoJson && !focusOsmId && !bairroGeo) map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    }

    return () => { map.remove(); mapInstance.current = null; };
  }, [roads, cityName, boundaryGeoJson, style, highlightOsmIds, focusOsmId, bairroGeo, bairro]);

  const changeStyle = (s: string) => { setStyle(s); localStorage.setItem("mapStyle", s); };

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      <div className="absolute top-2 right-2 z-[400] rounded-xl border border-border bg-card/95 px-3 py-1.5 text-xs font-medium shadow-soft backdrop-blur">
        <select value={style} onChange={(e) => changeStyle(e.target.value)} className="bg-transparent text-foreground outline-none">
          <option value="osm">OSM padrão</option>
          <option value="carto_light">Carto Light</option>
          <option value="carto_dark">Carto Dark</option>
          <option value="satellite">Satélite</option>
          <option value="topo">Topográfico</option>
        </select>
      </div>
      {bairro && (
        <div className="absolute top-2 left-2 z-[400] rounded-full border border-secondary/40 bg-secondary/20 px-3 py-1 text-xs font-semibold text-accent-foreground backdrop-blur">
          Bairro: {bairro}{!bairroGeo && " (carregando…)"}
        </div>
      )}
      <MapLegend />
    </div>
  );
};
