import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BairroFeature {
  id: number;
  nome: string;
  geometry: any; // GeoJSON MultiPolygon/Polygon
}

// Cidades com preset de auto-carregamento dos polígonos oficiais de bairros.
const AUTO_PRESETS = new Set<string>(["duque de caxias"]);

export function isAutoBairrosCity(city: string) {
  return AUTO_PRESETS.has((city || "").trim().toLowerCase());
}

// Converte relations do Overpass (admin_level=10) em GeoJSON simples.
function relationToGeoJSON(members: any[]): any | null {
  if (!members?.length) return null;
  const rings: number[][][] = [];
  const ways = members.filter((m) => m.type === "way" && m.geometry?.length);
  for (const w of ways) {
    const ring = w.geometry.map((p: any) => [p.lon, p.lat]);
    if (ring.length >= 3) rings.push(ring);
  }
  if (!rings.length) return null;
  return { type: "Polygon", coordinates: rings };
}

export function useBairrosOverlay(city: string | undefined, uf: string | undefined, enabled: boolean) {
  const [bairros, setBairros] = useState<BairroFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!city || !enabled) { setBairros([]); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const { data, error: e } = await supabase.functions.invoke("overpass-layers", {
          body: { city, uf, layer: "bairros" },
        });
        if (e) throw e;
        const items = (data?.items || []) as any[];
        const feats: BairroFeature[] = items
          .map((it) => {
            const nome = it.tags?.name || it.tags?.["name:pt"] || "Sem nome";
            const geom = it.geometry ? { type: "LineString", coordinates: it.geometry.map((p: any) => [p.lon, p.lat]) } : relationToGeoJSON(it.members || []);
            return geom ? { id: it.id, nome, geometry: geom } : null;
          })
          .filter(Boolean) as BairroFeature[];
        if (!cancelled) setBairros(feats);
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "Falha ao carregar bairros");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [city, uf, enabled]);

  return { bairros, loading, error };
}
