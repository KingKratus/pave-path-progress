import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useIbgeMunicipios, searchMunicipios } from "@/hooks/useIbgeMunicipios";

export function GlobalSearchBar() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: ibge } = useIbgeMunicipios();

  const suggestions = useMemo(() => (ibge ? searchMunicipios(ibge, q).slice(0, 6) : []), [ibge, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && (e.target as HTMLElement)?.tagName !== "INPUT") {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (nome: string, uf?: string) => {
    setOpen(false);
    navigate(`/municipio/${encodeURIComponent(nome)}${uf ? `?uf=${uf}` : ""}`);
  };

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="global-search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Buscar cidade ou /"
          className="h-9 pl-9 pr-3 text-sm"
        />
      </div>
      {open && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
          {suggestions.map((m) => (
            <button
              key={m.id}
              type="button"
              onMouseDown={() => go(m.nome, m.uf)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{m.nome}</span>
              {m.uf && <span className="ml-auto text-xs text-muted-foreground">{m.uf}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
