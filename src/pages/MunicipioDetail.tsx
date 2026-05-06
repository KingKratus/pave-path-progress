import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo } from "react";
import { MapPin, Route, Download, Loader2, AlertTriangle, Clock, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navbar } from "@/components/Navbar";
import { LeafletMap } from "@/components/LeafletMap";
import { PeriodComparison } from "@/components/PeriodComparison";
import { AiPriorities } from "@/components/AiPriorities";
import { MunicipioInsights } from "@/components/MunicipioInsights";
import { supabase } from "@/integrations/supabase/client";

interface RoadData {
  id: string;
  osm_id: number;
  name: string | null;
  surface: string;
  length_m: number;
  geojson: any;
}

const MunicipioDetail = () => {
  const { nome } = useParams<{ nome: string }>();
  const [searchParams] = useSearchParams();
  const uf = searchParams.get("uf") || undefined;
  const bairroParam = searchParams.get("bairro");
  const cityName = decodeURIComponent(nome || "");
  const [roads, setRoads] = useState<RoadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [municipioId, setMunicipioId] = useState<string | null>(null);
  const [boundary, setBoundary] = useState<any>(null);
  const [tab, setTab] = useState("mapa");
  const [focusOsmId, setFocusOsmId] = useState<number | null>(searchParams.get("focus") ? Number(searchParams.get("focus")) : null);
  const selectRoad = (osmId: number) => { setFocusOsmId(osmId); setTab("mapa"); };
  // Filtros para lista
  const [filterSurface, setFilterSurface] = useState("all");
  const [filterName, setFilterName] = useState("all"); // all|named|unnamed
  const [filterMinLen, setFilterMinLen] = useState(0);
  const [filterSearch, setFilterSearch] = useState("");

  const fetchRoads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: mun } = await supabase
        .from("municipios").select("id, last_sync_at, geom_geojson")
        .eq("nome", cityName).maybeSingle();

      const loadVias = async (id: string) => {
        const { data: vias } = await supabase.from("vias").select("*").eq("municipio_id", id);
        setRoads((vias || []).map((v: any) => ({
          id: v.id, osm_id: v.osm_id, name: v.nome, surface: v.surface, length_m: v.length_m,
          geojson: v.geom_geojson ? JSON.parse(v.geom_geojson) : null,
        })));
      };

      if (mun) {
        setMunicipioId(mun.id);
        if (mun.geom_geojson) try { setBoundary(JSON.parse(mun.geom_geojson)); } catch {}
        await loadVias(mun.id);
        setLastSync(mun.last_sync_at);
        if ((await supabase.from("vias").select("id", { count: "exact", head: true }).eq("municipio_id", mun.id)).count) {
          setLoading(false);
          return;
        }
      }

      const { error: fnError } = await supabase.functions.invoke("sync-municipio", {
        body: { municipio: cityName, uf },
      });
      if (fnError) throw fnError;

      const { data: mun2 } = await supabase
        .from("municipios").select("id, last_sync_at, geom_geojson").eq("nome", cityName).maybeSingle();
      if (mun2) {
        setMunicipioId(mun2.id);
        if (mun2.geom_geojson) try { setBoundary(JSON.parse(mun2.geom_geojson)); } catch {}
        await loadVias(mun2.id);
        setLastSync(mun2.last_sync_at);
      }
    } catch (err: any) {
      console.error("Error fetching roads:", err);
      setError("Não foi possível carregar os dados. Tente novamente em alguns instantes.");
    } finally {
      setLoading(false);
    }
  }, [cityName, uf]);

  useEffect(() => { if (cityName) fetchRoads(); }, [cityName, fetchRoads]);

  const syncMin = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000) : null;

  const surfaces = useMemo(() => Array.from(new Set(roads.map((r) => r.surface))), [roads]);

  const filteredRoads = useMemo(() => {
    return roads.filter((r) => {
      if (filterSurface !== "all" && r.surface !== filterSurface) return false;
      if (filterName === "named" && !r.name) return false;
      if (filterName === "unnamed" && r.name) return false;
      if (r.length_m < filterMinLen) return false;
      if (filterSearch && !(r.name || "").toLowerCase().includes(filterSearch.toLowerCase())) return false;
      return true;
    });
  }, [roads, filterSurface, filterName, filterMinLen, filterSearch]);

  const totalKm = roads.reduce((sum, r) => sum + r.length_m, 0) / 1000;

  const exportGeoJSON = () => {
    const fc = {
      type: "FeatureCollection",
      features: filteredRoads.filter(r => r.geojson).map(r => ({
        type: "Feature",
        properties: { name: r.name, surface: r.surface, length_m: r.length_m },
        geometry: r.geojson,
      })),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cityName}_vias.geojson`;
    a.click();
  };

  const exportCSV = () => {
    const header = "Nome,Superfície,Comprimento (m)\n";
    const rows = filteredRoads.map(r => `"${r.name || 'Sem nome'}","${r.surface}",${r.length_m.toFixed(1)}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${cityName}_vias.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {cityName}{uf && <span className="ml-2 text-xl text-muted-foreground">— {uf}</span>}
            </h1>
            <p className="text-muted-foreground">Análise de vias não pavimentadas</p>
          </div>
          {syncMin !== null && (
            <Badge variant="secondary" className="ml-auto gap-1">
              <Clock className="h-3 w-3" />
              Atualizado há {syncMin < 1 ? "menos de 1 min" : `${syncMin} min`}
            </Badge>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium text-foreground">Consultando dados do OpenStreetMap...</p>
            <p className="text-sm text-muted-foreground">Isso pode levar alguns segundos</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20">
            <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
            <p className="text-lg font-medium text-foreground">{error}</p>
            <Button onClick={fetchRoads} className="mt-4">Tentar novamente</Button>
          </div>
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <Card><CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-xl bg-destructive/10 p-3"><Route className="h-6 w-6 text-destructive" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{totalKm.toFixed(1)} km</p>
                  <p className="text-sm text-muted-foreground">Sem pavimentação</p>
                </div>
              </CardContent></Card>
              <Card><CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-xl bg-primary/10 p-3"><MapPin className="h-6 w-6 text-primary" /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{roads.length}</p>
                  <p className="text-sm text-muted-foreground">Vias analisadas</p>
                </div>
              </CardContent></Card>
              <Card><CardContent className="p-6">
                <p className="mb-2 text-sm font-medium text-muted-foreground">Tipos de superfície</p>
                <div className="flex flex-wrap gap-2">
                  {surfaces.map((s) => (
                    <span key={s} className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">{s}</span>
                  ))}
                </div>
              </CardContent></Card>
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="overflow-x-auto">
                <TabsTrigger value="mapa">Mapa</TabsTrigger>
                <TabsTrigger value="lista">Lista</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
                <TabsTrigger value="comparacao">Comparação</TabsTrigger>
                <TabsTrigger value="ia"><Sparkles className="mr-1 h-3 w-3" />IA</TabsTrigger>
              </TabsList>

              <TabsContent value="mapa">
                <Card className="overflow-hidden">
                  <div className="h-[500px]">
                    <LeafletMap roads={roads.map(r => ({ ...r, name: r.name || "" }))} cityName={cityName} boundaryGeoJson={boundary} focusOsmId={focusOsmId} bairro={bairroParam} uf={uf} />
                  </div>
                </Card>
                {!boundary && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Limite municipal não disponível ainda — sincronize novamente para restringir o mapa à cidade.
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button onClick={exportGeoJSON} variant="outline" className="gap-2"><Download className="h-4 w-4" /> GeoJSON</Button>
                  <Button onClick={exportCSV} variant="outline" className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
                </div>
              </TabsContent>

              <TabsContent value="lista">
                <Card>
                  <CardHeader><CardTitle>Lista de vias ({filteredRoads.length})</CardTitle></CardHeader>
                  <CardContent>
                    <div className="mb-4 grid gap-2 md:grid-cols-4">
                      <Input placeholder="Buscar nome..." value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
                      <Select value={filterSurface} onValueChange={setFilterSurface}>
                        <SelectTrigger><SelectValue placeholder="Superfície" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as superfícies</SelectItem>
                          {surfaces.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={filterName} onValueChange={setFilterName}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Com e sem nome</SelectItem>
                          <SelectItem value="named">Apenas com nome</SelectItem>
                          <SelectItem value="unnamed">Apenas sem nome</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input type="number" placeholder="Comprimento mínimo (m)" value={filterMinLen || ""}
                        onChange={(e) => setFilterMinLen(Number(e.target.value) || 0)} />
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Superfície</TableHead>
                          <TableHead className="text-right">Comprimento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRoads.slice(0, 200).map((road) => (
                          <TableRow key={road.id}>
                            <TableCell className="font-medium">
                              {road.name || <span className="italic text-muted-foreground">Via sem nome (#{road.osm_id})</span>}
                            </TableCell>
                            <TableCell>
                              <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                                {road.surface}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {road.length_m >= 1000 ? `${(road.length_m / 1000).toFixed(2)} km` : `${road.length_m.toFixed(0)} m`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filteredRoads.length > 200 && (
                      <p className="mt-4 text-center text-sm text-muted-foreground">
                        Exibindo 200 de {filteredRoads.length} vias filtradas
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="insights">
                <MunicipioInsights municipioId={municipioId} />
              </TabsContent>

              <TabsContent value="comparacao">
                <PeriodComparison municipioId={municipioId} onSelectRoad={selectRoad} />
              </TabsContent>

              <TabsContent value="ia">
                <AiPriorities municipioId={municipioId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default MunicipioDetail;
