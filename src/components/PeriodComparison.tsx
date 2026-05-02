import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Loader2, Minus } from "lucide-react";

interface Snapshot { id: string; snapshot_at: string; total_km_unpaved: number; total_vias: number; }
interface Comparison {
  from: { snapshot_at: string; total_km_unpaved: number; total_vias: number };
  to: { snapshot_at: string; total_km_unpaved: number; total_vias: number };
  km_paved_added: number;
  vias_diff: number;
  by_surface_diff: { surface: string; from_m: number; to_m: number; diff_m: number }[];
}

export function PeriodComparison({ municipioId }: { municipioId: string | null }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!municipioId) return;
    setLoading(true);
    supabase.functions
      .invoke("compare-periods", {
        method: "GET" as any,
        // edge function reads from URL params
      })
      .catch(() => {});
    // call directly via fetch to send query params
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compare-periods?municipio_id=${municipioId}`;
    fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } })
      .then((r) => r.json())
      .then((data) => {
        setSnapshots(data.snapshots || []);
        setComparison(data.comparison || null);
        if (data.snapshots?.length) {
          setFromId(data.snapshots[0].id);
          setToId(data.snapshots[data.snapshots.length - 1].id);
        }
      })
      .finally(() => setLoading(false));
  }, [municipioId]);

  const recompute = async () => {
    if (!municipioId || !fromId || !toId) return;
    const from = snapshots.find((s) => s.id === fromId)?.snapshot_at;
    const to = snapshots.find((s) => s.id === toId)?.snapshot_at;
    setLoading(true);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compare-periods?municipio_id=${municipioId}&from=${from}&to=${to}`;
    const data = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }).then((r) => r.json());
    setComparison(data.comparison || null);
    setLoading(false);
  };

  if (!municipioId) return null;
  if (loading && !comparison) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  if (snapshots.length < 2) {
    return (
      <Card>
        <CardHeader><CardTitle>Comparação de períodos</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            São necessários pelo menos 2 snapshots para comparar. Atualmente: {snapshots.length}.
          </p>
        </CardContent>
      </Card>
    );
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comparação de períodos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={fromId} onChange={(e) => setFromId(e.target.value)}>
              {snapshots.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.snapshot_at)}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={toId} onChange={(e) => setToId(e.target.value)}>
              {snapshots.map((s) => <option key={s.id} value={s.id}>{fmtDate(s.snapshot_at)}</option>)}
            </select>
          </div>
        </div>
        <Button onClick={recompute} disabled={loading} size="sm">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comparar"}
        </Button>

        {comparison && (
          <div className="space-y-4 pt-2">
            <div className="grid gap-3 md:grid-cols-3">
              <Stat
                label="Km pavimentados"
                value={`${comparison.km_paved_added.toFixed(2)} km`}
                positive={comparison.km_paved_added > 0}
              />
              <Stat
                label="Vias não pav. (variação)"
                value={`${comparison.vias_diff > 0 ? "-" : "+"}${Math.abs(comparison.vias_diff)}`}
                positive={comparison.vias_diff > 0}
              />
              <Stat
                label="Total atual (não pav.)"
                value={`${comparison.to.total_km_unpaved.toFixed(2)} km`}
                neutral
              />
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Por tipo de superfície</h4>
              <div className="space-y-1">
                {comparison.by_surface_diff.slice(0, 8).map((s) => {
                  const diffKm = s.diff_m / 1000;
                  return (
                    <div key={s.surface} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                      <span className="font-mono">{s.surface}</span>
                      <Badge variant={diffKm < 0 ? "default" : diffKm > 0 ? "destructive" : "secondary"} className="gap-1">
                        {diffKm < 0 ? <ArrowDown className="h-3 w-3" /> : diffKm > 0 ? <ArrowUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {Math.abs(diffKm).toFixed(2)} km
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, positive, neutral }: { label: string; value: string; positive?: boolean; neutral?: boolean }) {
  const color = neutral ? "text-foreground" : positive ? "text-primary" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
