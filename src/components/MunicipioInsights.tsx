import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line, Legend } from "recharts";
import { Lightbulb, MapPin, Type, Download, TrendingUp } from "lucide-react";
import { exportRowsToCSV, normalizeKey } from "@/lib/csvExport";

export function MunicipioInsights({ municipioId }: { municipioId: string | null }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!municipioId) return;
    (async () => {
      const [{ data: vias }, { data: rank }, { data: snaps }] = await Promise.all([
        supabase.from("vias").select("nome, surface, length_m, nome_status, bairro").eq("municipio_id", municipioId),
        supabase.from("ranking").select("score, periodo, km_unpaved, km_paved_added").eq("municipio_id", municipioId).order("periodo"),
        supabase.from("vias_snapshots").select("snapshot_at, total_km_unpaved, total_vias").eq("municipio_id", municipioId).order("snapshot_at"),
      ]);
      const vs = vias || [];
      const totalKm = vs.reduce((s, v) => s + (v.length_m || 0), 0) / 1000;
      const semNome = vs.filter((v) => !v.nome || v.nome_status === "sem_nome").length;
      const bySurf: Record<string, number> = {};
      const byBairro = new Map<string, { bairro: string; km: number; vias: number }>();
      vs.forEach((v) => {
        bySurf[v.surface] = (bySurf[v.surface] || 0) + (v.length_m || 0) / 1000;
        if (v.bairro) {
          const k = normalizeKey(v.bairro);
          const cur = byBairro.get(k) || { bairro: v.bairro, km: 0, vias: 0 };
          cur.km += (v.length_m || 0) / 1000;
          cur.vias += 1;
          byBairro.set(k, cur);
        }
      });
      const top5 = [...vs].sort((a, b) => (b.length_m || 0) - (a.length_m || 0)).slice(0, 5);
      const surfaceData = Object.entries(bySurf).map(([surface, km]) => ({ surface, km: Number(km.toFixed(2)) })).sort((a, b) => b.km - a.km);
      const bairroList = Array.from(byBairro.values()).sort((a, b) => b.km - a.km);
      const bairroData = bairroList.slice(0, 8).map((b) => ({ ...b, km: Number(b.km.toFixed(2)) }));

      // Monthly evolution: prefer ranking by periodo; fallback to snapshots grouped by YYYY-MM
      let evolution = (rank || []).map((r) => ({ periodo: r.periodo, km_unpaved: r.km_unpaved || 0, km_paved_added: r.km_paved_added || 0 }));
      if (evolution.length < 2 && snaps && snaps.length) {
        const byMonth = new Map<string, number>();
        snaps.forEach((s) => {
          const d = new Date(s.snapshot_at);
          const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          byMonth.set(k, s.total_km_unpaved);
        });
        evolution = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b))
          .map(([periodo, km_unpaved]) => ({ periodo, km_unpaved, km_paved_added: 0 }));
      }
      setData({ totalKm, semNome, total: vs.length, top5, surfaceData, bairroData, bairroList, evolution });
    })();
  }, [municipioId]);

  if (!municipioId || !data) return null;
  const pctSemNome = data.total ? ((data.semNome / data.total) * 100).toFixed(1) : "0";

  const exportBairros = () => {
    exportRowsToCSV("bairros.csv", data.bairroList.map((b: any) => ({
      bairro: b.bairro, km_unpaved: b.km.toFixed(2), vias: b.vias,
    })));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total não pavimentado</p><p className="text-2xl font-bold">{data.totalKm.toFixed(1)} km</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Vias sem nome</p><p className="text-2xl font-bold text-amber-600">{pctSemNome}%</p><p className="text-xs text-muted-foreground">{data.semNome} de {data.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bairros mapeados</p><p className="text-2xl font-bold">{data.bairroList.length}</p></CardContent></Card>
      </div>

      {data.evolution.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-base"><TrendingUp className="h-4 w-4" /> Evolução mensal</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.evolution}>
                <XAxis dataKey="periodo" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="km_unpaved" name="Não pavimentado (km)" stroke="hsl(var(--destructive))" strokeWidth={2} />
                <Line type="monotone" dataKey="km_paved_added" name="Pavimentado (+ km)" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Type className="h-4 w-4" /> Distribuição por superfície</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.surfaceData}>
              <XAxis dataKey="surface" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="km" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {data.bairroData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4" /> Top bairros (km não pavimentados)</CardTitle>
            <Button variant="outline" size="sm" onClick={exportBairros} className="gap-1"><Download className="h-3 w-3" /> CSV</Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.bairroData} layout="vertical">
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis type="category" dataKey="bairro" width={120} stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="km" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Lightbulb className="h-4 w-4" /> Top 5 vias mais longas sem pavimentação</CardTitle></CardHeader>
        <CardContent className="space-y-1">
          {data.top5.map((v: any, i: number) => (
            <div key={i} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
              <span className="truncate">{v.nome || <span className="italic text-muted-foreground">Sem nome</span>}</span>
              <span className="text-xs text-muted-foreground">{(v.length_m / 1000).toFixed(2)} km · {v.surface}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
