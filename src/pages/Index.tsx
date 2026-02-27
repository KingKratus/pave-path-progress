import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin, BarChart3, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Navbar } from "@/components/Navbar";

const BRAZILIAN_CITIES = [
  "São Paulo", "Rio de Janeiro", "Belo Horizonte", "Salvador", "Fortaleza",
  "Brasília", "Curitiba", "Manaus", "Recife", "Porto Alegre",
  "Belém", "Goiânia", "Guarulhos", "Campinas", "São Luís",
];

const Index = () => {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const navigate = useNavigate();

  const handleSearch = (value: string) => {
    setSearch(value);
    if (value.length >= 2) {
      setSuggestions(
        BRAZILIAN_CITIES.filter((c) =>
          c.toLowerCase().includes(value.toLowerCase())
        ).slice(0, 5)
      );
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectCity = (city: string) => {
    setSearch(city);
    setSuggestions([]);
    navigate(`/municipio/${encodeURIComponent(city)}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/municipio/${encodeURIComponent(search.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero */}
      <section className="relative overflow-hidden bg-primary py-24 md:py-32">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        <div className="container relative mx-auto px-4 text-center">
          <h1 className="mb-4 text-4xl font-black tracking-tight text-primary-foreground md:text-6xl">
            Ranking Nacional de Pavimentação
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-primary-foreground/80">
            Descubra a situação das ruas do seu município. Visualize vias não pavimentadas no mapa e compare o desempenho da sua cidade.
          </p>

          {/* Search */}
          <form onSubmit={handleSubmit} className="relative mx-auto max-w-xl">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Buscar município (ex: São Paulo, Recife...)"
                className="h-14 rounded-2xl bg-card pl-12 pr-28 text-base shadow-xl border-0"
              />
              <Button
                type="submit"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 font-semibold"
              >
                Pesquisar
              </Button>
            </div>

            {/* Autocomplete */}
            {suggestions.length > 0 && (
              <div className="absolute z-50 mt-2 w-full rounded-xl bg-card shadow-xl border border-border overflow-hidden">
                {suggestions.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => handleSelectCity(city)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
                  >
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="text-foreground">{city}</span>
                  </button>
                ))}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* Stats */}
      <section className="container mx-auto -mt-10 px-4">
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-primary/10 p-3">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">5.570</p>
                <p className="text-sm text-muted-foreground">Municípios no Brasil</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-accent/20 p-3">
                <BarChart3 className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">—</p>
                <p className="text-sm text-muted-foreground">Municípios analisados</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-xl bg-destructive/10 p-3">
                <TrendingUp className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">—</p>
                <p className="text-sm text-muted-foreground">Km sem pavimentação</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* How it works */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold text-foreground">
          Como funciona?
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Search,
              title: "1. Pesquise",
              desc: "Digite o nome do município que deseja analisar.",
            },
            {
              icon: MapPin,
              title: "2. Visualize",
              desc: "Veja no mapa interativo as ruas sem pavimentação destacadas.",
            },
            {
              icon: BarChart3,
              title: "3. Compare",
              desc: "Confira o ranking nacional e veja como sua cidade se posiciona.",
            },
          ].map((step) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <step.icon className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mb-2 text-xl font-bold text-foreground">{step.title}</h3>
              <p className="text-muted-foreground">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
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
