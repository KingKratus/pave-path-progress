import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Route, Building2, Search } from "lucide-react";
import { useIbgeMunicipios, searchMunicipios } from "@/hooks/useIbgeMunicipios";

const UFS = ["TODAS","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function Buscar() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [uf, setUf] = useState(params.get("uf") || "TODAS");
  const [tipo, setTipo] = useState<"todos" | "cidades" | "ruas" | "bairros">((params.get("t") as any) || "todos");
  const [loading, setLoading] = useState(false);
  const [cidades, setCidades] = useState<any[]>([]);
  const [ruas, setRuas] = useState<any[]>([]);
  const [bairros, setBairros] = useState<{ bairro: string; municipio: string; nome: string; uf: string | null }[]>([]);
  const navigate = useNavigate();
  const { data: ibge } = useIbgeMunicipios();

  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q); if (uf !== "TODAS") p.set("uf", uf); if (tipo !== "todos") p.set("t", tipo);
    setParams(p, { replace: true });
  }, [q, uf, tipo]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q || q.length < 2) { setCidades([]); setRuas([]); setBairros([]); return; }
      setLoading(true);

      // Cidades: combina IBGE (cobertura nacional) + DB
      const ibgeMatches = ibge ? searchMunicipios(ibge, q).filter(c => uf === "TODAS" || c.uf === uf) : [];
      const ufFilter = uf !== "TODAS" ? uf : null;

      let citiesQ = supabase.from("municipios").select("id, nome, uf, last_sync_at").ilike("nome", `%${q}%`).limit(15);
      if (ufFilter) citiesQ = citiesQ.eq("uf", ufFilter);
      const { data: dbCities } = await citiesQ;
      const cityMap = new Map<string, any>();
      (dbCities || []).forEach((c: any) => cityMap.set(`${c.nome}|${c.uf}`, { ...c, source: "db" }));
      ibgeMatches.forEach(c => { const k = `${c.nome}|${c.uf}`; if (!cityMap.has(k)) cityMap.set(k, { ...c, source: "ibge" }); });
      setCidades(Array.from(cityMap.values()).slice(0, 20));

      // Ruas
      let viasQ = supabase.from("vias").select("osm_id, nome, surface, length_m, bairro, municipio_id, municipios!inner(nome, uf)")
        .ilike("nome", `%${q}%`).limit(40);
      if (ufFilter) viasQ = viasQ.eq("municipios.uf", ufFilter);
      const { data: viasData } = await viasQ;
      setRuas(viasData || []);

      // Bairros (distinct)
      let bairroQ = supabase.from("vias").select("bairro, municipio_id, municipios!inner(nome, uf)").ilike("bairro", `%${q}%`).limit(60);
      if (ufFilter) bairroQ = bairroQ.eq("municipios.uf", ufFilter);
      const { data: bData } = await bairroQ;
      const seen = new Set<string>();
      const out: any[] = [];
      (bData || []).forEach((b: any) => {
        const k = `${b.bairro}|${b.municipios?.nome}`;
        if (b.bairro && !seen.has(k)) { seen.add(k); out.push({ bairro: b.bairro, municipio: b.municipios?.nome, nome: b.municipios?.nome, uf: b.municipios?.uf }); }
      });
      setBairros(out);

      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, uf, ibge]);

  const showCidades = tipo === "todos" || tipo === "cidades";
  const showRuas = tipo === "todos" || tipo === "ruas";
  const showBairros = tipo === "todos" || tipo === "bairros";

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <h1 className="mb-2 text-3xl font-bold tracking-tight">Buscar</h1>
        <p className="mb-6 text-muted-foreground">Cidades, ruas e bairros em todo o Brasil.</p>

        <Card className="mb-6">
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_140px_180px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Digite cidade, rua ou bairro..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
            </div>
            <Select value={uf} onValueChange={setUf}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Tudo</SelectItem>
                <SelectItem value="cidades">Cidades</SelectItem>
                <SelectItem value="ruas">Ruas</SelectItem>
                <SelectItem value="bairros">Bairros</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading && <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>}

        {showCidades && cidades.length > 0 && (
          <Section title="Cidades" icon={<Building2 className="h-4 w-4" />} count={cidades.length}>
            {cidades.map((c, i) => (
              <button key={i} onClick={() => navigate(`/municipio/${encodeURIComponent(c.nome)}${c.uf ? `?uf=${c.uf}` : ""}`)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-muted/50">
                <span className="font-medium">{c.nome}</span>
                <div className="flex items-center gap-2">
                  {c.source === "ibge" && !c.last_sync_at && <Badge variant="outline" className="text-xs">novo</Badge>}
                  {c.uf && <Badge variant="secondary" className="text-xs">{c.uf}</Badge>}
                </div>
              </button>
            ))}
          </Section>
        )}

        {showRuas && ruas.length > 0 && (
          <Section title="Ruas" icon={<Route className="h-4 w-4" />} count={ruas.length}>
            {ruas.map((r: any, i: number) => (
              <button key={i} onClick={() => navigate(`/municipio/${encodeURIComponent(r.municipios?.nome)}?uf=${r.municipios?.uf || ""}&focus=${r.osm_id}`)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-muted/50">
                <div>
                  <p className="font-medium">{r.nome}</p>
                  <p className="text-xs text-muted-foreground">{r.municipios?.nome} · {r.municipios?.uf} {r.bairro && `· ${r.bairro}`}</p>
                </div>
                <Badge variant="secondary" className="text-xs">{r.surface}</Badge>
              </button>
            ))}
          </Section>
        )}

        {showBairros && bairros.length > 0 && (
          <Section title="Bairros" icon={<MapPin className="h-4 w-4" />} count={bairros.length}>
            {bairros.map((b, i) => (
              <button key={i} onClick={() => navigate(`/municipio/${encodeURIComponent(b.nome)}?uf=${b.uf || ""}`)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-muted/50">
                <div>
                  <p className="font-medium">{b.bairro}</p>
                  <p className="text-xs text-muted-foreground">{b.municipio} · {b.uf}</p>
                </div>
              </button>
            ))}
          </Section>
        )}

        {!loading && q.length >= 2 && cidades.length === 0 && ruas.length === 0 && bairros.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nada encontrado para "{q}".</p>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, count, children }: any) {
  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">{icon} {title} <span className="text-xs text-muted-foreground">({count})</span></CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">{children}</CardContent>
    </Card>
  );
}
