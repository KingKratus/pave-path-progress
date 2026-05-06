import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Trophy, Medal, Award, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";

interface RankingEntry {
  id: string; municipio_id: string; score: number;
  km_unpaved: number; km_paved_added: number;
  municipio_nome?: string; municipio_estado?: string;
}

const ESTADOS = ["Todos","AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

const Ranking = () => {
  const [entries, setEntries] = useState<RankingEntry[]>([]);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("ranking")
        .select("*, municipios(nome, estado)")
        .order("score", { ascending: false }).limit(500);
      setEntries((data || []).map((r: any) => ({
        id: r.id, municipio_id: r.municipio_id, score: r.score,
        km_unpaved: r.km_unpaved, km_paved_added: r.km_paved_added,
        municipio_nome: r.municipios?.nome, municipio_estado: r.municipios?.estado,
      })));
      setLoading(false);
    })();
  }, []);

  const filtered = entries.filter((e) => {
    const ms = !search || e.municipio_nome?.toLowerCase().includes(search.toLowerCase());
    const me = estado === "Todos" || e.municipio_estado === estado;
    return ms && me;
  });

  const podio = filtered.slice(0, 3);
  const resto = filtered.slice(3);

  const podioStyle = [
    { bg: "bg-gradient-gold", icon: Trophy, label: "1º" },
    { bg: "bg-foreground text-background", icon: Medal, label: "2º" },
    { bg: "bg-primary text-primary-foreground", icon: Award, label: "3º" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Ranking</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Os melhores em pavimentação.</h1>
          <p className="mt-2 text-muted-foreground">Score combinado entre km pavimentados, eficiência e malha pendente.</p>
        </div>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar município..." className="pl-10" />
          </div>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>{ESTADOS.map((uf) => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><p className="text-muted-foreground">Carregando ranking...</p></div>
        ) : filtered.length === 0 ? (
          <Card className="bento p-12 text-center">
            <p className="text-lg font-semibold">Nenhum dado disponível</p>
            <p className="mt-1 text-sm text-muted-foreground">Pesquise municípios na página inicial para gerar dados.</p>
          </Card>
        ) : (
          <>
            {podio.length > 0 && (
              <div className="mb-6 grid gap-3 md:grid-cols-3">
                {podio.map((e, i) => {
                  const s = podioStyle[i];
                  return (
                    <button key={e.id}
                      onClick={() => e.municipio_nome && navigate(`/municipio/${encodeURIComponent(e.municipio_nome)}`)}
                      className={`bento group p-6 text-left ${s.bg}`}>
                      <div className="flex items-center justify-between">
                        <s.icon className="h-7 w-7 opacity-90" />
                        <span className="font-display text-2xl font-black opacity-70">{s.label}</span>
                      </div>
                      <h3 className="mt-4 font-display text-2xl font-bold">{e.municipio_nome}</h3>
                      <p className="text-sm opacity-80">{e.municipio_estado}</p>
                      <div className="mt-4 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest opacity-70">Score</p>
                          <p className="font-display text-3xl font-bold">{e.score.toFixed(2)}</p>
                        </div>
                        <ArrowUpRight className="h-5 w-5 opacity-80 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <Card className="bento overflow-hidden p-0">
              <div className="divide-y divide-border">
                {resto.map((e, i) => (
                  <button key={e.id}
                    onClick={() => e.municipio_nome && navigate(`/municipio/${encodeURIComponent(e.municipio_nome)}`)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/50">
                    <span className="w-10 font-mono text-sm text-muted-foreground">{i + 4}</span>
                    <div className="flex-1">
                      <p className="font-display font-semibold">{e.municipio_nome}</p>
                      <p className="text-xs text-muted-foreground">{e.municipio_estado} · {e.km_unpaved.toFixed(1)} km sem pav.</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-primary">{e.score.toFixed(2)}</p>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">+{e.km_paved_added.toFixed(1)} km</p>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default Ranking;
