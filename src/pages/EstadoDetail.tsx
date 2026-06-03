import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, MapPin, TrendingUp, AlertTriangle } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { exportRowsToCSV, normalizeKey } from "@/lib/csvExport";

interface MuniAgg {
  id: string;
  nome: string;
  uf: string;
  km_unpaved: number;
  total_vias: number;
}

export default function EstadoDetail() {
  const { uf = "" } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [munis, setMunis] = useState<MuniAgg[]>([]);
  const [monthly, setMonthly] = useState<{ periodo: string; km_unpaved: number; km_paved_added: number }[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!uf) return;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data: ms, error: e1 } = await supabase
          .from("municipios").select("id, nome, uf").eq("uf", uf.toUpperCase()).order("nome");
        if (e1) throw e1;
        const valid = (ms || []).filter((m) => m.nome && m.nome.trim().length > 0);
        const ids = valid.map((m) => m.id);
        if (!ids.length) { setMunis([]); setMonthly([]); setLoading(false); return; }

        const { data: rk } = await supabase
          .from("ranking").select("municipio_id, periodo, km_unpaved, km_paved_added").in("municipio_id", ids);

        // Dedupe by (nome|uf) — latest period only per município
        const seenMuni = new Map<string, MuniAgg>();
        const latestByMuni = new Map<string, any>();
        (rk || []).forEach((r) => {
          const prev = latestByMuni.get(r.municipio_id);
          if (!prev || (r.periodo || "") > (prev.periodo || "")) latestByMuni.set(r.municipio_id, r);
        });
        valid.forEach((m) => {
          const key = `${normalizeKey(m.nome)}|${m.uf}`;
          if (seenMuni.has(key)) return;
          const last = latestByMuni.get(m.id);
          seenMuni.set(key, {
            id: m.id, nome: m.nome, uf: m.uf,
            km_unpaved: last?.km_unpaved || 0,
            total_vias: 0,
          });
        });

        // Monthly evolution: sum across state by periodo
        const byPer = new Map<string, { km_unpaved: number; km_paved_added: number }>();
        (rk || []).forEach((r) => {
          const k = r.periodo;
          const cur = byPer.get(k) || { km_unpaved: 0, km_paved_added: 0 };
          cur.km_unpaved += r.km_unpaved || 0;
          cur.km_paved_added += r.km_paved_added || 0;
          byPer.set(k, cur);
        });
        const mEvolution = Array.from(byPer.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([periodo, v]) => ({ periodo, ...v }));

        setMunis(Array.from(seenMuni.values()).sort((a, b) => b.km_unpaved - a.km_unpaved));
        setMonthly(mEvolution);
      } catch (err: any) {
        setError(err.message || "Erro ao carregar estado");
      } finally {
        setLoading(false);
      }
    })();
  }, [uf]);

  const filtered = useMemo(() => {
    const t = normalizeKey(q);
    if (!t) return munis;
    return munis.filter((m) => normalizeKey(m.nome).includes(t));
  }, [munis, q]);

  const totalKm = filtered.reduce((s, m) => s + m.km_unpaved, 0);

  const exportCSV = () => {
    exportRowsToCSV(`estado_${uf}_municipios.csv`, filtered.map((m) => ({
      municipio: m.nome, uf: m.uf, km_unpaved: m.km_unpaved.toFixed(2),
    })));
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">Estado</p>
            <h1 className="font-display text-3xl font-bold tracking-tight">{uf.toUpperCase()}</h1>
            <p className="text-sm text-muted-foreground">{munis.length} municípios · {totalKm.toFixed(0)} km não pavimentados</p>
          </div>
          <Button variant="outline" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 text-center">
            <AlertTriangle className="mb-3 h-10 w-10 text-destructive" />
            <p>{error}</p>
          </div>
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Evolução mensal (km)</CardTitle></CardHeader>
              <CardContent>
                {monthly.length > 1 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={monthly}>
                      <XAxis dataKey="periodo" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                      <Legend />
                      <Line type="monotone" dataKey="km_unpaved" name="Não pavimentado" stroke="hsl(var(--destructive))" strokeWidth={2} />
                      <Line type="monotone" dataKey="km_paved_added" name="Pavimentado adicionado" stroke="hsl(var(--primary))" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem snapshots suficientes ainda.</p>
                )}
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader><CardTitle className="text-base">Top 10 municípios — km não pavimentados</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(220, Math.min(filtered.length, 10) * 30)}>
                  <BarChart data={filtered.slice(0, 10)} layout="vertical">
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis type="category" dataKey="nome" width={140} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                    <Bar dataKey="km_unpaved" fill="hsl(var(--destructive))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Municípios ({filtered.length})</CardTitle>
                <Input placeholder="Filtrar..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
              </CardHeader>
              <CardContent className="grid gap-2 md:grid-cols-2">
                {filtered.map((m) => (
                  <button key={m.id}
                    onClick={() => navigate(`/municipio/${encodeURIComponent(m.nome)}?uf=${m.uf}`)}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-muted/50">
                    <div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /><span className="font-medium">{m.nome}</span></div>
                    <Badge variant="secondary" className="text-xs">{m.km_unpaved.toFixed(1)} km</Badge>
                  </button>
                ))}
                {!filtered.length && <p className="col-span-2 py-6 text-center text-sm text-muted-foreground">Nenhum município.</p>}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
