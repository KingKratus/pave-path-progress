import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Loader2, Minus } from "lucide-react";

interface Snapshot { id: string; snapshot_at: string; total_km_unpaved: number; total_vias: number; }
interface ViaItem { osm_id: number; nome: string | null; surface: string; length_m: number; from_surface?: string; }
interface Comparison {
  from: { snapshot_at: string; total_km_unpaved: number; total_vias: number };
  to: { snapshot_at: string; total_km_unpaved: number; total_vias: number };
  km_paved_added: number;
  vias_diff: number;
  by_surface_diff: { surface: string; from_m: number; to_m: number; diff_m: number }[];
  roads_changed?: { paved: ViaItem[]; new_unpaved: ViaItem[]; surface_changed: ViaItem[] };
}

export function PeriodComparison({ municipioId }: { municipioId: string | null }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [fromId, setFromId] = useState<string>("");
  const [toId, setToId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [filterSurface, setFilterSurface] = useState("all");
  const [search, setSearch] = useState("");

  const fetchData = async (from?: string, to?: string) => {
    if (!municipioId) return;
    setLoading(true);
    const params = new URLSearchParams({ municipio_id: municipioId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/compare-periods?${params}`;
    try {
      const data = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }).then((r) => r.json());
      setSnapshots(data.snapshots || []);
      setComparison(data.comparison || null);
      if (!from && data.snapshots?.length) setFromId(data.snapshots[0].id);
      if (!to && data.snapshots?.length) setToId(data.snapshots[data.snapshots.length - 1].id);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [municipioId]);

  const recompute = () => {
    const from = snapshots.find((s) => s.id === fromId)?.snapshot_at;
    const to = snapshots.find((s) => s.id === toId)?.snapshot_at;
    fetchData(from, to);
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

  const filterList = (list: ViaItem[] = []) => list.filter((v) => {
    if (filterSurface !== "all" && v.surface !== filterSurface) return false;
    if (search && !(v.nome || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const allSurfaces = useMemo(() => {
    const s = new Set<string>();
    comparison?.roads_changed?.paved.forEach((v) => s.add(v.surface));
    comparison?.roads_changed?.new_unpaved.forEach((v) => s.add(v.surface));
    comparison?.roads_changed?.surface_changed.forEach((v) => s.add(v.surface));
    return Array.from(s);
  }, [comparison]);

  if (!municipioId) return null;
  if (loading && !comparison) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  if (snapshots.length < 2) {
    return <Card><CardHeader><CardTitle>Comparação de períodos</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">São necessários pelo menos 2 snapshots para comparar. Atualmente: {snapshots.length}.</p></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Comparação de períodos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{snapshots.map((s) => <SelectItem key={s.id} value={s.id}>{fmtDate(s.snapshot_at)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{snapshots.map((s) => <SelectItem key={s.id} value={s.id}>{fmtDate(s.snapshot_at)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={recompute} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Comparar"}
            </Button>
          </div>
        </div>

        {comparison && (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <Stat label="Km pavimentados" value={`${comparison.km_paved_added.toFixed(2)} km`} positive={comparison.km_paved_added > 0} />
              <Stat label="Vias não pav. (variação)" value={`${comparison.vias_diff > 0 ? "-" : "+"}${Math.abs(comparison.vias_diff)}`} positive={comparison.vias_diff > 0} />
              <Stat label="Total atual" value={`${comparison.to.total_km_unpaved.toFixed(2)} km`} neutral />
            </div>

            <Tabs defaultValue="surface">
              <TabsList>
                <TabsTrigger value="surface">Por superfície</TabsTrigger>
                <TabsTrigger value="paved">Pavimentadas ({comparison.roads_changed?.paved.length || 0})</TabsTrigger>
                <TabsTrigger value="new">Novas ({comparison.roads_changed?.new_unpaved.length || 0})</TabsTrigger>
                <TabsTrigger value="changed">Mudaram ({comparison.roads_changed?.surface_changed.length || 0})</TabsTrigger>
              </TabsList>

              <TabsContent value="surface">
                <div className="space-y-1 pt-2">
                  {comparison.by_surface_diff.slice(0, 12).map((s) => {
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
              </TabsContent>

              {(["paved", "new", "changed"] as const).map((key) => {
                const list = comparison.roads_changed?.[key === "paved" ? "paved" : key === "new" ? "new_unpaved" : "surface_changed"] || [];
                const filtered = filterList(list);
                return (
                  <TabsContent key={key} value={key}>
                    <div className="mb-3 grid gap-2 md:grid-cols-2">
                      <Input placeholder="Buscar nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
                      <Select value={filterSurface} onValueChange={setFilterSurface}>
                        <SelectTrigger><SelectValue placeholder="Superfície" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas</SelectItem>
                          {allSurfaces.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1 max-h-96 overflow-y-auto">
                      {filtered.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma rua nesta categoria</p>}
                      {filtered.slice(0, 200).map((v) => (
                        <div key={v.osm_id} className="flex items-center justify-between rounded border border-border px-3 py-2 text-sm">
                          <span className="font-medium">{v.nome || <span className="italic text-muted-foreground">Via #{v.osm_id}</span>}</span>
                          <div className="flex items-center gap-2">
                            {v.from_surface && <Badge variant="outline" className="text-xs">{v.from_surface} → {v.surface}</Badge>}
                            {!v.from_surface && <Badge variant="secondary" className="text-xs">{v.surface}</Badge>}
                            <span className="text-xs text-muted-foreground">{(v.length_m / 1000).toFixed(2)} km</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                );
              })}
            </Tabs>
          </>
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
