import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, BarChart3, TrendingUp, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";
import { useIbgeMunicipios, searchMunicipios } from "@/hooks/useIbgeMunicipios";

const Index = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { data: ibge } = useIbgeMunicipios();

  const suggestions = useMemo(
    () => (ibge ? searchMunicipios(ibge, search) : []),
    [ibge, search]
  );

  const goTo = (nome: string, uf?: string) => {
    const url = `/municipio/${encodeURIComponent(nome)}${uf ? `?uf=${uf}` : ""}`;
    navigate(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestions[0]) goTo(suggestions[0].nome, suggestions[0].uf);
    else if (search.trim()) goTo(search.trim());
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section className="relative overflow-hidden bg-primary py-24 md:py-32">
        <div className="container relative mx-auto px-4 text-center">
          <h1 className="mb-4 text-4xl font-black tracking-tight text-primary-foreground md:text-6xl">
            Ranking Nacional de Pavimentação
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-primary-foreground/80">
            Descubra a situação das ruas do seu município. Visualize vias não pavimentadas no mapa e compare o desempenho da sua cidade.
          </p>

          <form onSubmit={handleSubmit} className="relative mx-auto max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar município (ex: Duque de Caxias, Recife...)"
                className="h-14 rounded-2xl bg-card pl-12 pr-28 text-base shadow-xl border-0"
              />
              <Button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              >
                Pesquisar
              </Button>
            </div>

            {suggestions.length > 0 && (
              <div className="absolute z-50 mt-2 w-full rounded-xl bg-card shadow-xl border border-border overflow-hidden">
                {suggestions.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => goTo(m.nome, m.uf)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-foreground">{m.nome}</span>
                    {m.uf && <span className="ml-auto text-xs text-muted-foreground">{m.uf}</span>}
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Pilot card */}
      <section className="container mx-auto -mt-10 px-4">
        <Card className="border-0 bg-accent/20 shadow-xl">
          <CardContent className="flex flex-col items-start gap-3 p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-accent p-3">
                <Star className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-accent-foreground/80">Município piloto</p>
                <p className="text-lg font-bold text-foreground">Duque de Caxias — RJ</p>
              </div>
            </div>
            <Button onClick={() => goTo("Duque de Caxias", "RJ")} className="font-semibold">
              Ver dados em tempo real
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="container mx-auto px-4 py-10">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3"><MapPin className="h-6 w-6 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">5.570</p>
                <p className="text-sm text-muted-foreground">Municípios no Brasil</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-accent/20 p-3"><BarChart3 className="h-6 w-6 text-accent-foreground" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">Auto</p>
                <p className="text-sm text-muted-foreground">Sync horário</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-destructive/10 p-3"><TrendingUp className="h-6 w-6 text-destructive" /></div>
              <div>
                <p className="text-2xl font-bold text-foreground">OSM</p>
                <p className="text-sm text-muted-foreground">Dados abertos</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border bg-muted/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Dados obtidos via OpenStreetMap. Este projeto é aberto e colaborativo.</p>
          <p className="mt-1">Ranking Nacional de Pavimentação © 2026</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
