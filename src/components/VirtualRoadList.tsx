import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";

export interface VirtualRoadItem {
  osm_id: number;
  nome: string | null;
  surface: string;
  length_m: number;
  from_surface?: string;
  bairro?: string | null;
}

export function VirtualRoadList({ items, onClick }: { items: VirtualRoadItem[]; onClick?: (it: VirtualRoadItem) => void }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 12,
  });

  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma rua encontrada</p>;
  }

  return (
    <div ref={parentRef} className="h-[480px] overflow-y-auto rounded-md border border-border">
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {rowVirtualizer.getVirtualItems().map((vr) => {
          const it = items[vr.index];
          return (
            <button
              key={vr.key}
              onClick={() => onClick?.(it)}
              className="absolute inset-x-0 flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50"
              style={{ transform: `translateY(${vr.start}px)`, height: vr.size }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">
                  {it.nome || <span className="italic text-muted-foreground">Via #{it.osm_id}</span>}
                </p>
                {it.bairro && <p className="truncate text-xs text-muted-foreground">{it.bairro}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {it.from_surface
                  ? <Badge variant="outline" className="text-xs">{it.from_surface} → {it.surface}</Badge>
                  : <Badge variant="secondary" className="text-xs">{it.surface}</Badge>}
                <span className="w-16 text-right text-xs text-muted-foreground">{(it.length_m / 1000).toFixed(2)} km</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
