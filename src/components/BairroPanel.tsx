import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Layers } from "lucide-react";

interface Road { id: string; name: string | null; surface: string; length_m: number; bairro?: string | null; }
interface OverlayBairro { id: number; nome: string; }

interface Props {
  roads: Road[];
  activeBairro?: string | null;
  onSelect: (bairro: string | null) => void;
  overlayBairros?: OverlayBairro[];
  overlayLoading?: boolean;
}

export function BairroPanel({ roads, activeBairro, onSelect, overlayBairros = [], overlayLoading }: Props) {
  const [q, setQ] = useState("");

  const merged = useMemo(() => {
    const map = new Map<string, { km: number; vias: number; source: "vias" | "osm" | "both" }>();
    for (const r of roads) {
      const b = (r as any).bairro || null;
      if (!b) continue;
      const e = map.get(b) || { km: 0, vias: 0, source: "vias" as const };
      e.km += (r.length_m || 0) / 1000;
      e.vias++;
      map.set(b, e);
    }
    for (const ob of overlayBairros) {
      const nome = (ob.nome || "").trim();
      if (!nome) continue;
      const existing = map.get(nome);
      if (existing) map.set(nome, { ...existing, source: "both" });
      else map.set(nome, { km: 0, vias: 0, source: "osm" });
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.km - a.km || a.nome.localeCompare(b.nome));
  }, [roads, overlayBairros]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return merged;
    return merged.filter((b) => b.nome.toLowerCase().includes(term));
  }, [merged, q]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" /> Bairros ({merged.length})
          {overlayLoading && <span className="text-xs font-normal text-muted-foreground">· carregando OSM…</span>}
        </CardTitle>
        {activeBairro && (
          <button onClick={() => onSelect(null)} className="text-xs text-muted-foreground underline hover:text-foreground">limpar</button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar bairro..."
            className="h-8 pl-8 text-sm"
          />
        </div>
        <div className="max-h-[380px] space-y-1 overflow-y-auto pr-1">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {merged.length === 0 ? "Nenhum bairro identificado ainda." : "Nada encontrado."}
            </p>
          )}
          {filtered.map((b) => {
            const active = activeBairro === b.nome;
            return (
              <button
                key={b.nome}
                onClick={() => onSelect(active ? null : b.nome)}
                className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                  active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{b.nome}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {b.vias > 0 && <span>{b.vias} vias</span>}
                    {b.source !== "vias" && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-secondary/20 px-1 text-[10px] font-medium text-accent-foreground">
                        <Layers className="h-2.5 w-2.5" /> OSM
                      </span>
                    )}
                  </p>
                </div>
                {b.km > 0 && (
                  <Badge variant={active ? "default" : "secondary"} className="text-xs">{b.km.toFixed(1)} km</Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
