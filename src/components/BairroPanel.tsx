import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";

interface Road { id: string; name: string | null; surface: string; length_m: number; bairro?: string | null; }

interface Props {
  roads: Road[];
  activeBairro?: string | null;
  onSelect: (bairro: string | null) => void;
}

export function BairroPanel({ roads, activeBairro, onSelect }: Props) {
  const bairros = useMemo(() => {
    const map = new Map<string, { km: number; vias: number }>();
    for (const r of roads) {
      const b = (r as any).bairro || null;
      if (!b) continue;
      const e = map.get(b) || { km: 0, vias: 0 };
      e.km += (r.length_m || 0) / 1000;
      e.vias++;
      map.set(b, e);
    }
    return Array.from(map.entries())
      .map(([nome, v]) => ({ nome, ...v }))
      .sort((a, b) => b.km - a.km);
  }, [roads]);

  if (bairros.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Bairros</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Nenhum bairro identificado nas vias deste município.</p></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Bairros ({bairros.length})</CardTitle>
        {activeBairro && (
          <button onClick={() => onSelect(null)} className="text-xs text-muted-foreground underline hover:text-foreground">limpar filtro</button>
        )}
      </CardHeader>
      <CardContent className="max-h-[400px] space-y-1 overflow-y-auto">
        {bairros.map((b) => {
          const active = activeBairro === b.nome;
          return (
            <button
              key={b.nome}
              onClick={() => onSelect(active ? null : b.nome)}
              className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                active ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
              }`}
            >
              <div>
                <p className="font-medium">{b.nome}</p>
                <p className="text-xs text-muted-foreground">{b.vias} vias</p>
              </div>
              <Badge variant={active ? "default" : "secondary"} className="text-xs">{b.km.toFixed(1)} km</Badge>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
