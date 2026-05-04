import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowDown, ArrowUp, Loader2, Minus, X } from "lucide-react";
import { VirtualRoadList } from "./VirtualRoadList";

interface Snapshot { id: string; snapshot_at: string; total_km_unpaved: number; total_vias: number; }
interface ViaItem { osm_id: number; nome: string | null; surface: string; length_m: number; from_surface?: string; bairro?: string | null; }
interface Comparison {
  from: { snapshot_at: string; total_km_unpaved: number; total_vias: number };
  to: { snapshot_at: string; total_km_unpaved: number; total_vias: number };
  km_paved_added: number;
  vias_diff: number;
  by_surface_diff: { surface: string; from_m: number; to_m: number; diff_m: number }[];
  counts?: { paved: number; new_unpaved: number; surface_changed: number };
  roads_changed?: { paved: ViaItem[]; new_unpaved: ViaItem[]; surface_changed: ViaItem[] };
}

const STORAGE_KEY = "comparison_filters";

export function PeriodComparison({ municipioId, onSelectRoad }: { municipioId: string | null; onSelectRoad?: (osmId: number) => void }) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [loading, setLoading] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();
  const persisted = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; } })();

  const [filterSurface, setFilterSurface] = useState<string>(searchParams.get("surface") || persisted.surface || "all");
  const [search, setSearch] = useState<string>(searchParams.get("q") || persisted.q || "");
  const [minLen, setMinLen] = useState<number>(Number(searchParams.get("min") || persisted.min || 0));
  const [sort, setSort] = useState<string>(searchParams.get("sort") || persisted.sort || "len_desc");

  useEffect(() => {
    const f = { surface: filterSurface, q: search, min: minLen, sort };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
    const p = new URLSearchParams(searchParams);
    if (filterSurface !== "all") p.set("surface", filterSurface); else p.delete("surface");
    if (search) p.set("q", search); else p.delete("q");
    if (minLen) p.set("min", String(minLen)); else p.delete("min");
    if (sort !== "len_desc") p.set("sort", sort); else p.delete("sort");
    setSearchParams(p, { replace: true });
  }, [filterSurface, search, minLen, sort]);

  const fetchData = async (from?: string, to?: string) => {
    if (!municipioId) return;
    setLoading(true);
    const params = new URLSearchParams({ municipio_id: municipioId });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (filterSurface !== "all") params.set("surface", filterSurface);
    if (search) params.set("q", search);
    if (minLen) params.set("min_len_m", String(minLen));
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

  const allSurfaces = useMemo(() => {
    const s = new Set<string>();
    comparison?.by_surface_diff.forEach((d) => s.add(d.surface));
    return Array.from(s);
  }, [comparison]);

  const sortFn = (a: ViaItem, b: ViaItem) => {
    if (sort === "len_asc") return (a.length_m || 0) - (b.length_m || 0);
    if (sort === "name") return (a.nome || "").localeCompare(b.nome || "");
    return (b.length_m || 0) - (a.length_m || 0);
  };

  const lists = useMemo(() => ({
    paved: [...(comparison?.roads_changed?.paved || [])].sort(sortFn),
    new_unpaved: [...(comparison?.roads_changed?.new_unpaved || [])].sort(sortFn),
    surface_changed: [...(comparison?.roads_changed?.surface_changed || [])].sort(sortFn),
  }), [comparison, sort]);

  const clearFilters = () => { setFilterSurface("all"); setSearch(""); setMinLen(0); setSort("len_desc"); };

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

            <div className="sticky top-0 z-10 -mx-2 grid gap-2 rounded-md border border-border bg-card/95 px-2 py-2 backdrop-blur md:grid-cols-5">
              <Input placeholder="Buscar por nome..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <Select value={filterSurface} onValueChange={setFilterSurface}>
                <SelectTrigger><SelectValue placeholder="Superfície" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as superfícies</SelectItem>
                  {allSurfaces.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Comp. mín. (m)" value={minLen || ""} onChange={(e) => setMinLen(Number(e.target.value) || 0)} />
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="len_desc">Maior comprimento</SelectItem>
                  <SelectItem value="len_asc">Menor comprimento</SelectItem>
                  <SelectItem value="name">Nome (A-Z)</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" onClick={clearFilters} className="gap-1"><X className="h-3 w-3" />Limpar</Button>
            </div>
            <Button size="sm" variant="outline" onClick={recompute} disabled={loading}>Aplicar filtros no servidor</Button>

            <Tabs defaultValue="surface">
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="surface">Por superfície</TabsTrigger>
                <TabsTrigger value="paved">Pavimentadas ({lists.paved.length})</TabsTrigger>
                <TabsTrigger value="new">Novas ({lists.new_unpaved.length})</TabsTrigger>
                <TabsTrigger value="changed">Mudaram ({lists.surface_changed.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="surface">
                <div className="space-y-1 pt-2">
                  {comparison.by_surface_diff.slice(0, 20).map((s) => {
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

              <TabsContent value="paved"><VirtualRoadList items={lists.paved} onClick={(it) => onSelectRoad?.(it.osm_id)} /></TabsContent>
              <TabsContent value="new"><VirtualRoadList items={lists.new_unpaved} onClick={(it) => onSelectRoad?.(it.osm_id)} /></TabsContent>
              <TabsContent value="changed"><VirtualRoadList items={lists.surface_changed} onClick={(it) => onSelectRoad?.(it.osm_id)} /></TabsContent>
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
