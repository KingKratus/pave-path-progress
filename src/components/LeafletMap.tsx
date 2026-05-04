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

export const LeafletMap = ({ roads, cityName, boundaryGeoJson, highlightOsmIds, focusOsmId }: LeafletMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const roadLayer = useRef<L.GeoJSON | null>(null);
  const [style, setStyle] = useState<string>(() => localStorage.getItem("mapStyle") || "osm");

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
          style: { color: "#16a34a", weight: 2, fillOpacity: 0, dashArray: "4 4" },
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
            color: isFocus ? "#22d3ee" : (SURFACE_COLORS[f?.properties?.surface] || "#ef4444"),
            weight: isFocus ? 7 : isHL ? 5 : 3,
            opacity: isFocus ? 1 : isHL ? 1 : 0.8,
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
            }, 200);
          }
        },
      });
      layer.addTo(map);
      roadLayer.current = layer;
      if (!boundaryGeoJson && !focusOsmId) map.fitBounds(layer.getBounds(), { padding: [20, 20] });
    }

    return () => { map.remove(); mapInstance.current = null; };
  }, [roads, cityName, boundaryGeoJson, style, highlightOsmIds, focusOsmId]);

  const changeStyle = (s: string) => { setStyle(s); localStorage.setItem("mapStyle", s); };

  return (
    <div className="relative h-full w-full">
      <div ref={mapRef} className="h-full w-full" />
      <div className="absolute top-2 right-2 z-[400] rounded-md border border-border bg-card/95 px-2 py-1 text-xs shadow backdrop-blur">
        <select value={style} onChange={(e) => changeStyle(e.target.value)} className="bg-transparent text-foreground outline-none">
          <option value="osm">OSM padrão</option>
          <option value="carto_light">Carto Light</option>
          <option value="carto_dark">Carto Dark</option>
          <option value="satellite">Satélite</option>
          <option value="topo">Topográfico</option>
        </select>
      </div>
      <MapLegend />
    </div>
  );
};
