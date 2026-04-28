import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const ITEMS: { color: string; label: string; key: string }[] = [
  { color: "#ef4444", label: "Não pavimentada", key: "unpaved" },
  { color: "#f97316", label: "Terra (dirt)", key: "dirt" },
  { color: "#eab308", label: "Cascalho (gravel)", key: "gravel" },
  { color: "#dc2626", label: "Solo (ground)", key: "ground" },
  { color: "#b91c1c", label: "Terra batida (earth)", key: "earth" },
  { color: "#f59e0b", label: "Compactada", key: "compacted" },
];

export const MapLegend = () => {
  const [open, setOpen] = useState(true);

  return (
    <div className="absolute bottom-4 right-4 z-[400] rounded-lg border border-border bg-card/95 shadow-lg backdrop-blur">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-foreground"
      >
        Tipo de superfície
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>
      {open && (
        <ul className="border-t border-border px-3 py-2 text-xs">
          {ITEMS.map((it) => (
            <li key={it.key} className="flex items-center gap-2 py-1">
              <span
                className="inline-block h-3 w-4 rounded-sm"
                style={{ backgroundColor: it.color }}
              />
              <span className="text-foreground">{it.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
