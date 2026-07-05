import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Trophy, ArrowUpRight, TrendingUp, TrendingDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const ESTADOS = ["Todos","AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

interface Snap { periodo: string; total_km_unpaved: number; total_km_paved: number; }
interface AggRow { scope: string; key: string; latest_unpaved: number; latest_paved: number; delta_unpaved: number; delta_paved: number; series: Snap[]; }

function useAgregados(scope: "br" | "uf" | "mun") {
  const [rows, setRows] = useState<AggRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => {
    setLoading(true);
    const { data } = await supabase.from("stats_agregadas").select("scope,key,periodo,total_km_unpaved,total_km_paved")
      .eq("scope", scope).order("periodo", { ascending: true });
    const byKey = new Map<string, Snap[]>();
    for (const r of data || []) {
      const arr = byKey.get(r.key) || [];
      arr.push({ periodo: r.periodo, total_km_unpaved: Number(r.total_km_unpaved) || 0, total_km_paved: Number(r.total_km_paved) || 0 });
      byKey.set(r.key, arr);
    }
    const out: AggRow[] = [];
    for (const [key, series] of byKey) {
      const last = series[series.length - 1];
      const prev = series[series.length - 2];
      out.push({
        scope, key,
        latest_unpaved: last?.total_km_unpaved || 0,
        latest_paved: last?.total_km_paved || 0,
        delta_unpaved: prev ? (last.total_km_unpaved - prev.total_km_unpaved) : 0,
        delta_paved: prev ? (last.total_km_paved - prev.total_km_paved) : 0,
        series: series.slice(-12),
      });
    }
    out.sort((a, b) => b.latest_paved - a.latest_paved);
    setRows(out);
    setLoading(false);
  })(); }, [scope]);
  return { rows, loading };
}

function Sparkline({ series }: { series: Snap[] }) {
  if (series.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const data = series.map(s => ({ v: s.total_km_paved }));
  return (
    <div className="h-8 w-24">
      <ResponsiveContainer>
        <LineChart data={data}><Line type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /></LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function DeltaBadge({ v, invert }: { v: number; invert?: boolean }) {
  if (!v) return <span className="text-xs text-muted-foreground">—</span>;
  const good = invert ? v < 0 : v > 0;
  const Icon = v > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${good ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
      <Icon className="h-3 w-3" /> {v > 0 ? "+" : ""}{v.toFixed(1)} km
    </span>
  );
}

const Ranking = () => {
  const [tab, setTab] = useState<"nacional" | "estado" | "municipio" | "bairro">("nacional");
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("Todos");
  const [bairroMun, setBairroMun] = useState("");
  const [bairros, setBairros] = useState<any[]>([]);
  const navigate = useNavigate();

  const brasil = useAgregados("br");
  const ufs = useAgregados("uf");
  const muns = useAgregados("mun");

  // Bairros: carrega on-demand a partir de vias (top do município escolhido)
  useEffect(() => {
    if (tab !== "bairro" || !bairroMun) { setBairros([]); return; }
    (async () => {
      const { data: mun } = await supabase.from("municipios").select("id").ilike("nome", bairroMun).maybeSingle();
      if (!mun) { setBairros([]); return; }
      const { data } = await supabase.from("vias").select("bairro, surface, length_m").eq("municipio_id", mun.id).limit(20000);
      const agg = new Map<string, { unp: number; pav: number }>();
      const UNP = new Set(["unpaved","dirt","gravel","ground","earth","compacted","sand","mud"]);
      for (const v of data || []) {
        const b = (v.bairro || "").trim(); if (!b) continue;
        const t = agg.get(b) || { unp: 0, pav: 0 };
        const km = (v.length_m || 0) / 1000;
        if (UNP.has(v.surface)) t.unp += km; else t.pav += km;
        agg.set(b, t);
      }
      setBairros(Array.from(agg.entries())
        .map(([bairro, t]) => ({ bairro, pav: t.pav, unp: t.unp, total: t.pav + t.unp, pct: (t.pav + t.unp) ? t.pav / (t.pav + t.unp) : 0 }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 100));
    })();
  }, [tab, bairroMun]);

  const filteredUfs = ufs.rows.filter(r => estado === "Todos" ? true : r.key === estado)
    .filter(r => !search || r.key.toLowerCase().includes(search.toLowerCase()));
  const filteredMuns = muns.rows
    .filter(r => !search || r.key.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10">
        <div className="mb-6 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Ranking</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">Desempenho de pavimentação</h1>
          <p className="mt-2 text-muted-foreground">Agregados nacionais/estaduais/municipais/bairro com variação mensal. Lê apenas snapshots pré-calculados para economizar memória.</p>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="nacional">🇧🇷 Nacional</TabsTrigger>
            <TabsTrigger value="estado">Por estado</TabsTrigger>
            <TabsTrigger value="municipio">Por município</TabsTrigger>
            <TabsTrigger value="bairro">Por bairro</TabsTrigger>
          </TabsList>

          <TabsContent value="nacional" className="mt-6">
            {brasil.rows.map((r) => (
              <Card key={r.key} className="bento p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Brasil · último snapshot</p>
                    <p className="mt-1 font-display text-4xl font-bold">{r.latest_paved.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km pav.</p>
                    <p className="text-sm text-muted-foreground">{r.latest_unpaved.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km não pavimentados</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <DeltaBadge v={r.delta_paved} />
                    <DeltaBadge v={r.delta_unpaved} invert />
                  </div>
                  <Sparkline series={r.series} />
                </div>
              </Card>
            ))}
            {!brasil.loading && !brasil.rows.length && <p className="text-muted-foreground">Nenhum snapshot ainda. Gere no painel admin → Cache externo.</p>}
          </TabsContent>

          <TabsContent value="estado" className="mt-6 space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar UF..." className="pl-10" />
              </div>
            </div>
            <Card className="bento overflow-hidden p-0">
              <div className="divide-y divide-border">
                {filteredUfs.map((r, i) => (
                  <button key={r.key} onClick={() => navigate(`/estado/${r.key}`)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/50">
                    <span className="w-8 font-mono text-sm text-muted-foreground">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-display font-semibold">{r.key}</p>
                      <p className="text-xs text-muted-foreground">{r.latest_paved.toFixed(0)} km pav. · {r.latest_unpaved.toFixed(0)} km não pav.</p>
                    </div>
                    <DeltaBadge v={r.delta_paved} />
                    <Sparkline series={r.series} />
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </button>
                ))}
                {!ufs.loading && !filteredUfs.length && <p className="p-6 text-sm text-muted-foreground">Nenhum agregado. Rode "Gerar snapshot" no admin.</p>}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="municipio" className="mt-6 space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrar município..." className="pl-10" />
              </div>
              <Select value={estado} onValueChange={setEstado}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Card className="bento overflow-hidden p-0">
              <div className="divide-y divide-border">
                {filteredMuns.slice(0, 200).map((r, i) => (
                  <button key={r.key} onClick={() => navigate(`/municipio/${encodeURIComponent(r.key)}`)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/50">
                    <span className="w-8 font-mono text-sm text-muted-foreground">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-display font-semibold">{r.key}</p>
                      <p className="text-xs text-muted-foreground">{r.latest_paved.toFixed(1)} km pav. · {r.latest_unpaved.toFixed(1)} km não pav.</p>
                    </div>
                    <DeltaBadge v={r.delta_paved} />
                    <Sparkline series={r.series} />
                  </button>
                ))}
                {!muns.loading && !filteredMuns.length && <p className="p-6 text-sm text-muted-foreground">Nenhum município agregado ainda.</p>}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="bairro" className="mt-6 space-y-3">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={bairroMun} onChange={(e) => setBairroMun(e.target.value)}
                  placeholder="Digite um município (ex: Duque de Caxias) para listar bairros"
                  className="pl-10" />
              </div>
            </div>
            <Card className="bento overflow-hidden p-0">
              <div className="divide-y divide-border">
                {bairros.map((b, i) => (
                  <button key={b.bairro} onClick={() => navigate(`/municipio/${encodeURIComponent(bairroMun)}?bairro=${encodeURIComponent(b.bairro)}`)}
                    className="flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/50">
                    <span className="w-8 font-mono text-sm text-muted-foreground">{i + 1}</span>
                    <div className="flex-1">
                      <p className="font-display font-semibold">{b.bairro}</p>
                      <p className="text-xs text-muted-foreground">{b.total.toFixed(1)} km · {(b.pct * 100).toFixed(0)}% pavimentado</p>
                    </div>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">{b.pav.toFixed(1)} km pav.</span>
                    <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-semibold text-destructive">{b.unp.toFixed(1)} km n.p.</span>
                  </button>
                ))}
                {!bairros.length && bairroMun && <p className="p-6 text-sm text-muted-foreground">Nenhum bairro encontrado para "{bairroMun}". Sincronize o município primeiro.</p>}
                {!bairroMun && <p className="p-6 text-sm text-muted-foreground">Selecione um município acima.</p>}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Ranking;
