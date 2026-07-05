import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useIbgeMunicipios, searchMunicipios } from "@/hooks/useIbgeMunicipios";
import { supabase } from "@/integrations/supabase/client";

type BairroHit = { source: string; bairro: string; municipio: string; uf?: string };

export function GlobalSearchBar() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [bairros, setBairros] = useState<BairroHit[]>([]);
  const navigate = useNavigate();
  const { data: ibge } = useIbgeMunicipios();

  const muns = useMemo(() => (ibge ? searchMunicipios(ibge, q).slice(0, 5) : []), [ibge, q]);

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

  useEffect(() => {
    if (q.length < 2) { setBairros([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("search-bairros", { body: { q } });
        setBairros((data?.results || []).slice(0, 6));
      } catch { /* silencia */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const goMun = (nome: string, uf?: string) => {
    setOpen(false);
    navigate(`/municipio/${encodeURIComponent(nome)}${uf ? `?uf=${uf}` : ""}`);
  };

  const goBairro = (b: BairroHit) => {
    setOpen(false);
    const qs = new URLSearchParams();
    if (b.uf) qs.set("uf", b.uf);
    qs.set("bairro", b.bairro);
    navigate(`/municipio/${encodeURIComponent(b.municipio)}?${qs.toString()}`);
  };

  const showDropdown = open && (muns.length > 0 || bairros.length > 0);

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
          placeholder="Buscar cidade, bairro ou /"
          className="h-9 pl-9 pr-3 text-sm"
        />
      </div>
      {showDropdown && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 max-h-96 overflow-auto rounded-xl border border-border bg-popover shadow-lg">
          {muns.length > 0 && (
            <div className="border-b border-border/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Municípios</div>
          )}
          {muns.map((m) => (
            <button key={m.id} type="button" onMouseDown={() => goMun(m.nome, m.uf)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span className="font-medium">{m.nome}</span>
              {m.uf && <span className="ml-auto text-xs text-muted-foreground">{m.uf}</span>}
            </button>
          ))}
          {bairros.length > 0 && (
            <div className="border-b border-border/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Bairros</div>
          )}
          {bairros.map((b, i) => (
            <button key={`${b.bairro}-${b.municipio}-${i}`} type="button" onMouseDown={() => goBairro(b)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
              <Building2 className="h-3.5 w-3.5 text-secondary" />
              <span className="font-medium">{b.bairro}</span>
              <span className="ml-1 text-xs text-muted-foreground">· {b.municipio}</span>
              {b.uf && <span className="ml-auto text-xs text-muted-foreground">{b.uf}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
