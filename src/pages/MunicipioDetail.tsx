import { useParams, useSearchParams } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { MapPin, Route, Download, Loader2, AlertTriangle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/Navbar";
import { LeafletMap } from "@/components/LeafletMap";
import { PeriodComparison } from "@/components/PeriodComparison";
import { supabase } from "@/integrations/supabase/client";

interface RoadData {
  id: string;
  name: string;
  surface: string;
  length_m: number;
  geojson: any;
}

const MunicipioDetail = () => {
  const { nome } = useParams<{ nome: string }>();
  const [searchParams] = useSearchParams();
  const uf = searchParams.get("uf") || undefined;
  const cityName = decodeURIComponent(nome || "");
  const [roads, setRoads] = useState<RoadData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [municipioId, setMunicipioId] = useState<string | null>(null);

  const fetchRoads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Try cached vias first
      const { data: mun } = await supabase
        .from("municipios")
        .select("id, last_sync_at")
        .eq("nome", cityName)
        .maybeSingle();

      if (mun) {
        setMunicipioId(mun.id);
        const { data: vias } = await supabase
          .from("vias")
          .select("*")
          .eq("municipio_id", mun.id);
        if (vias && vias.length > 0) {
          setRoads(vias.map((v) => ({
            id: v.id,
            name: v.nome || "Sem nome",
            surface: v.surface,
            length_m: v.length_m,
            geojson: v.geom_geojson ? JSON.parse(v.geom_geojson) : null,
          })));
          setLastSync(mun.last_sync_at);
          setLoading(false);
          return;
        }
      }

      // Otherwise sync from Overpass
      const { data, error: fnError } = await supabase.functions.invoke("sync-municipio", {
        body: { municipio: cityName, uf },
      });
      if (fnError) throw fnError;

      // Reload from DB
      const { data: mun2 } = await supabase
        .from("municipios").select("id, last_sync_at").eq("nome", cityName).maybeSingle();
      if (mun2) {
        setMunicipioId(mun2.id);
        const { data: vias } = await supabase.from("vias").select("*").eq("municipio_id", mun2.id);
        setRoads((vias || []).map((v) => ({
          id: v.id, name: v.nome || "Sem nome", surface: v.surface, length_m: v.length_m,
          geojson: v.geom_geojson ? JSON.parse(v.geom_geojson) : null,
        })));
        setLastSync(mun2.last_sync_at);
      }
    } catch (err: any) {
      console.error("Error fetching roads:", err);
      setError("Não foi possível carregar os dados. Tente novamente em alguns instantes.");
    } finally {
      setLoading(false);
    }
  }, [cityName, uf]);

  useEffect(() => {
    if (cityName) fetchRoads();
  }, [cityName, fetchRoads]);

  const syncMin = lastSync ? Math.floor((Date.now() - new Date(lastSync).getTime()) / 60000) : null;

  const totalKm = roads.reduce((sum, r) => sum + r.length_m, 0) / 1000;
  const surfaceBreakdown = roads.reduce((acc, r) => {
    acc[r.surface] = (acc[r.surface] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const exportGeoJSON = () => {
    const fc = {
      type: "FeatureCollection",
      features: roads.filter(r => r.geojson).map(r => ({
        type: "Feature",
        properties: { name: r.name, surface: r.surface, length_m: r.length_m },
        geometry: r.geojson,
      })),
    };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cityName}_vias.geojson`;
    a.click();
  };

  const exportCSV = () => {
    const header = "Nome,Superfície,Comprimento (m)\n";
    const rows = roads.map(r => `"${r.name || 'Sem nome'}","${r.surface}",${r.length_m.toFixed(1)}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cityName}_vias.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">{cityName}{uf && <span className="ml-2 text-xl text-muted-foreground">— {uf}</span>}</h1>
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
            {/* Stats cards */}
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-xl bg-destructive/10 p-3">
                    <Route className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{totalKm.toFixed(1)} km</p>
                    <p className="text-sm text-muted-foreground">Sem pavimentação</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-xl bg-primary/10 p-3">
                    <MapPin className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{roads.length}</p>
                    <p className="text-sm text-muted-foreground">Vias analisadas</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <p className="mb-2 text-sm font-medium text-muted-foreground">Tipos de superfície</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(surfaceBreakdown).map(([surface, count]) => (
                      <span
                        key={surface}
                        className="rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground"
                      >
                        {surface}: {count}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs: Mapa / Lista / Comparação */}
            <Tabs defaultValue="mapa">
              <TabsList>
                <TabsTrigger value="mapa">Mapa</TabsTrigger>
                <TabsTrigger value="lista">Lista de vias</TabsTrigger>
                <TabsTrigger value="comparacao">Comparação de períodos</TabsTrigger>
              </TabsList>

              <TabsContent value="mapa">
                <Card className="overflow-hidden">
                  <div className="h-[500px]">
                    <LeafletMap roads={roads} cityName={cityName} />
                  </div>
                </Card>
                <div className="mt-4 flex gap-2">
                  <Button onClick={exportGeoJSON} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> GeoJSON
                  </Button>
                  <Button onClick={exportCSV} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" /> CSV
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="lista">
                <Card>
                  <CardHeader>
                    <CardTitle>Lista de vias</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Superfície</TableHead>
                          <TableHead className="text-right">Comprimento</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roads.slice(0, 100).map((road) => (
                          <TableRow key={road.id}>
                            <TableCell className="font-medium">{road.name || "Sem nome"}</TableCell>
                            <TableCell>
                              <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
                                {road.surface}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {road.length_m >= 1000
                                ? `${(road.length_m / 1000).toFixed(2)} km`
                                : `${road.length_m.toFixed(0)} m`}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {roads.length > 100 && (
                      <p className="mt-4 text-center text-sm text-muted-foreground">
                        Exibindo 100 de {roads.length} vias
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="comparacao">
                <PeriodComparison municipioId={municipioId} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default MunicipioDetail;
