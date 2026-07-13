import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, BarChart3, TrendingUp, Star, ArrowUpRight, Sparkles, Database, Activity, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/Navbar";
import { BrasilStats } from "@/components/BrasilStats";
import { useIbgeMunicipios, searchMunicipios } from "@/hooks/useIbgeMunicipios";
import { supabase } from "@/integrations/supabase/client";

type BairroHit = { source: string; bairro: string; municipio: string; uf?: string };

const Index = () => {
  const [search, setSearch] = useState("");
  const [bairros, setBairros] = useState<BairroHit[]>([]);
  const navigate = useNavigate();
  const { data: ibge } = useIbgeMunicipios();

  const suggestions = useMemo(
    () => (ibge ? searchMunicipios(ibge, search).slice(0, 6) : []),
    [ibge, search]
  );

  useEffect(() => {
    if (search.trim().length < 2) { setBairros([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await supabase.functions.invoke("search-bairros", { body: { q: search.trim() } });
        setBairros((data?.results || []).slice(0, 5));
      } catch { /* silencia */ }
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const goTo = (nome: string, uf?: string) => {
    const n = (nome || "").trim();
    if (!n) return;
    navigate(`/municipio/${encodeURIComponent(n)}${uf ? `?uf=${uf}` : ""}`);
  };

  const goBairro = (b: BairroHit) => {
    const qs = new URLSearchParams();
    if (b.uf) qs.set("uf", b.uf);
    qs.set("bairro", b.bairro);
    navigate(`/municipio/${encodeURIComponent(b.municipio)}?${qs.toString()}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions[0]) goTo(suggestions[0].nome, suggestions[0].uf);
    else if (search.trim()) goTo(search.trim());
  };


  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-civic" />
        <div className="absolute inset-0 grain" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-secondary/30 blur-3xl" />
        <div className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-primary-glow/40 blur-3xl" />

        <div className="container relative mx-auto px-4 pt-20 pb-40 md:pt-28 md:pb-48">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary/40 bg-secondary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-secondary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" />
              Dados abertos · OpenStreetMap
            </div>
            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-primary-foreground md:text-7xl text-balance">
              Cada rua sem asfalto,
              <span className="block bg-gradient-gold bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">visível em um clique.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-base text-primary-foreground/75 md:text-lg">
              Consulte vias não pavimentadas em qualquer município brasileiro. Compare períodos, gere relatórios e cobre seus prefeitos.
            </p>

            <form onSubmit={handleSubmit} className="relative z-40 mx-auto mt-10 max-w-xl">
              <div className="relative rounded-2xl bg-card p-1.5 shadow-glow">
                <div className="relative flex items-center">
                  <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Duque de Caxias, Recife, Manaus..."
                    className="h-12 border-0 bg-transparent pl-12 pr-32 text-base shadow-none focus-visible:ring-0"
                  />
                  <Button type="submit" className="absolute right-1.5 h-9 rounded-xl bg-foreground font-semibold text-background hover:bg-foreground/90">
                    Pesquisar <ArrowUpRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>

              {suggestions.length > 0 && (
                <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-card shadow-card">
                  {suggestions.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => goTo(m.nome, m.uf)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-medium text-foreground">{m.nome}</span>
                      {m.uf && <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{m.uf}</span>}
                    </button>
                  ))}
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* BENTO GRID */}
      <section className="container relative z-20 mx-auto -mt-24 px-4 pb-16">
        <div className="grid gap-4 md:grid-cols-6 md:auto-rows-[140px]">
          {/* Pilot — span 4 / 2 rows */}
          <button
            onClick={() => goTo("Duque de Caxias", "RJ")}
            className="bento grain group col-span-6 row-span-2 flex flex-col justify-between bg-gradient-gold p-7 text-left md:col-span-4"
          >
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent-foreground/80">
              <Star className="h-4 w-4" /> Município piloto
            </div>
            <div>
              <h3 className="font-display text-3xl font-bold text-accent-foreground md:text-4xl">Duque de Caxias — RJ</h3>
              <p className="mt-2 max-w-md text-accent-foreground/80">Acompanhe ao vivo a malha viária sem pavimentação e veja o ranking comparado.</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-foreground">
                Abrir dashboard <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </div>
          </button>

          {/* Stat: municipios */}
          <div className="bento col-span-3 row-span-1 flex items-center gap-4 p-5 md:col-span-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold leading-none">5.570</p>
              <p className="mt-1 text-xs text-muted-foreground">Municípios cobertos</p>
            </div>
          </div>

          {/* Stat: sync */}
          <div className="bento col-span-3 row-span-1 flex items-center gap-4 p-5 md:col-span-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary/20">
              <Activity className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="font-display text-2xl font-bold leading-none">Auto</p>
              <p className="mt-1 text-xs text-muted-foreground">Sync horário OSM</p>
            </div>
          </div>

          {/* Ranking shortcut */}
          <button
            onClick={() => navigate("/ranking")}
            className="bento group col-span-6 row-span-1 flex items-center justify-between p-5 text-left md:col-span-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background">
                <BarChart3 className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-base font-semibold">Ranking nacional</p>
                <p className="text-xs text-muted-foreground">Top municípios</p>
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-foreground" />
          </button>

          {/* Search shortcut */}
          <button
            onClick={() => navigate("/buscar")}
            className="bento group col-span-6 row-span-1 flex items-center justify-between p-5 text-left md:col-span-2"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <p className="font-display text-base font-semibold">Busca avançada</p>
                <p className="text-xs text-muted-foreground">Cidades, ruas, bairros</p>
              </div>
            </div>
            <ArrowUpRight className="h-5 w-5 text-muted-foreground transition group-hover:text-foreground" />
          </button>

          {/* Data source */}
          <div className="bento col-span-6 row-span-1 flex items-center gap-4 p-5 md:col-span-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
              <Database className="h-6 w-6 text-foreground" />
            </div>
            <div>
              <p className="font-display text-base font-semibold">OSM + Overpass</p>
              <p className="text-xs text-muted-foreground">100% dados abertos</p>
            </div>
          </div>
        </div>
      </section>

      <BrasilStats />

      {/* HOW IT WORKS */}
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="container mx-auto px-4">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Como funciona</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Três passos para auditar a sua cidade.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { n: "01", t: "Buscar", d: "Pesquise qualquer município brasileiro pelo nome.", icon: Search },
              { n: "02", t: "Visualizar", d: "Veja vias não pavimentadas no mapa, com filtros por superfície e bairro.", icon: MapPin },
              { n: "03", t: "Comparar", d: "Compare snapshots entre meses e exporte CSV/GeoJSON.", icon: TrendingUp },
            ].map((s) => (
              <div key={s.n} className="bento p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-display text-3xl font-bold text-primary/30">{s.n}</span>
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          <p>Dados via OpenStreetMap. Projeto aberto e colaborativo.</p>
          <p className="mt-1 font-semibold">PavimentaBR · Ranking Nacional de Pavimentação © 2026</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
