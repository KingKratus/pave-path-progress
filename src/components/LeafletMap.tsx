import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Road {
  id: string;
  name: string;
  surface: string;
  length_m: number;
  geojson: any;
}

interface LeafletMapProps {
  roads: Road[];
  cityName: string;
}

const SURFACE_COLORS: Record<string, string> = {
  unpaved: "#ef4444",
  dirt: "#f97316",
  gravel: "#eab308",
  ground: "#dc2626",
  earth: "#b91c1c",
  compacted: "#f59e0b",
};

export const LeafletMap = ({ roads, cityName }: LeafletMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstance.current) {
      mapInstance.current.remove();
    }

    const map = L.map(mapRef.current).setView([-14.235, -51.925], 5);
    mapInstance.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const geoJsonFeatures = roads
      .filter((r) => r.geojson)
      .map((r) => ({
        type: "Feature" as const,
        properties: { name: r.name, surface: r.surface, length_m: r.length_m },
        geometry: r.geojson,
      }));

    if (geoJsonFeatures.length > 0) {
      const geoJsonLayer = L.geoJSON(
        { type: "FeatureCollection", features: geoJsonFeatures } as any,
        {
          style: (feature) => ({
            color: SURFACE_COLORS[feature?.properties?.surface] || "#ef4444",
            weight: 3,
            opacity: 0.8,
          }),
          onEachFeature: (feature, layer) => {
            const props = feature.properties;
            layer.bindPopup(
              `<strong>${props.name || "Sem nome"}</strong><br/>
               Superfície: ${props.surface}<br/>
               Comprimento: ${props.length_m >= 1000 ? (props.length_m / 1000).toFixed(2) + " km" : props.length_m.toFixed(0) + " m"}`
            );
          },
        }
      );
      geoJsonLayer.addTo(map);
      map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
    }

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [roads, cityName]);

  return <div ref={mapRef} className="h-full w-full" />;
};
