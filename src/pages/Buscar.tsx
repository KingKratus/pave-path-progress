import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Route, Building2, Search } from "lucide-react";
import { useIbgeMunicipios, searchMunicipios } from "@/hooks/useIbgeMunicipios";

const UFS = ["TODAS","AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const PAGE = 30;

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export default function Buscar() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const [uf, setUf] = useState(params.get("uf") || "TODAS");
  const [tipo, setTipo] = useState<"todos" | "cidades" | "ruas" | "bairros">((params.get("t") as any) || "todos");
  const [surface, setSurface] = useState<string>(params.get("s") || "todas");
  const navigate = useNavigate();
  const { data: ibge } = useIbgeMunicipios();

  const dq = useDebounced(q.trim(), 280);

  const [cidades, setCidades] = useState<any[]>([]);
  const [ruas, setRuas] = useState<any[]>([]);
  const [bairros, setBairros] = useState<any[]>([]);
  const [pageRuas, setPageRuas] = useState(0);
  const [pageCidades, setPageCidades] = useState(0);
  const [hasMoreRuas, setHasMoreRuas] = useState(false);
  const [hasMoreCidades, setHasMoreCidades] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [autocomplete, setAutocomplete] = useState<{ label: string; sub: string; href: string }[]>([]);
  const [showAuto, setShowAuto] = useState(false);
  const reqRef = useRef(0);

  // Persist filters
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (uf !== "TODAS") p.set("uf", uf);
    if (tipo !== "todos") p.set("t", tipo);
    if (surface !== "todas") p.set("s", surface);
    setParams(p, { replace: true });
  }, [q, uf, tipo, surface]);

  // Reset pagination when query/filter changes
  useEffect(() => {
    setPageRuas(0); setPageCidades(0);
    setRuas([]); setCidades([]); setBairros([]);
  }, [dq, uf, tipo, surface]);

  const loadCidades = useCallback(async (page: number) => {
    if (!dq || dq.length < 2) return [];
    const ufFilter = uf !== "TODAS" ? uf : null;
    let qBuilder = supabase.from("municipios").select("id, nome, uf, last_sync_at").ilike("nome", `%${dq}%`)
      .order("nome").range(page * PAGE, (page + 1) * PAGE - 1);
    if (ufFilter) qBuilder = qBuilder.eq("uf", ufFilter);
    const { data } = await qBuilder;
    return (data || []).map((c: any) => ({ ...c, source: "db" }));
  }, [dq, uf]);

  const loadRuas = useCallback(async (page: number) => {
    if (!dq || dq.length < 2) return [];
    const ufFilter = uf !== "TODAS" ? uf : null;
    let qBuilder = supabase.from("vias")
      .select("osm_id, nome, surface, length_m, bairro, centroid_lat, centroid_lng, municipio_id, municipios!inner(nome, uf)")
      .ilike("nome", `%${dq}%`).order("length_m", { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (ufFilter) qBuilder = qBuilder.eq("municipios.uf", ufFilter);
    if (surface !== "todas") qBuilder = qBuilder.eq("surface", surface);
    const { data } = await qBuilder;
    return data || [];
  }, [dq, uf, surface]);

  const loadBairros = useCallback(async () => {
    if (!dq || dq.length < 2) return [];
    const ufFilter = uf !== "TODAS" ? uf : null;
    let qBuilder = supabase.from("vias")
      .select("bairro, municipios!inner(nome, uf)").ilike("bairro", `%${dq}%`).limit(80);
    if (ufFilter) qBuilder = qBuilder.eq("municipios.uf", ufFilter);
    const { data } = await qBuilder;
    const seen = new Set<string>(); const out: any[] = [];
    (data || []).forEach((b: any) => {
      const k = `${b.bairro}|${b.municipios?.nome}`;
      if (b.bairro && !seen.has(k)) { seen.add(k); out.push({ bairro: b.bairro, nome: b.municipios?.nome, uf: b.municipios?.uf }); }
    });
    return out;
  }, [dq, uf]);

  // Initial / on filter change
  useEffect(() => {
    if (!dq || dq.length < 2) { setCidades([]); setRuas([]); setBairros([]); return; }
    const reqId = ++reqRef.current;
    setLoading(true);
    (async () => {
      const ibgeMatches = ibge ? searchMunicipios(ibge, dq).filter(c => uf === "TODAS" || c.uf === uf) : [];
      const [cs, rs, bs] = await Promise.all([loadCidades(0), loadRuas(0), loadBairros()]);
      if (reqId !== reqRef.current) return;
      const map = new Map<string, any>();
      cs.forEach((c: any) => map.set(`${c.nome}|${c.uf}`, c));
      ibgeMatches.forEach(c => { const k = `${c.nome}|${c.uf}`; if (!map.has(k)) map.set(k, { ...c, source: "ibge" }); });
      const cidadesFinal = Array.from(map.values());
      setCidades(cidadesFinal);
      setRuas(rs);
      setBairros(bs);
      setHasMoreRuas(rs.length === PAGE);
      setHasMoreCidades(cs.length === PAGE);
      setPageRuas(1); setPageCidades(1);
      setLoading(false);
    })();
  }, [dq, uf, surface, ibge, loadCidades, loadRuas, loadBairros]);

  // Autocomplete (top 5 mix)
  useEffect(() => {
    if (!dq || dq.length < 2) { setAutocomplete([]); return; }
    const ibgeMatches = ibge ? searchMunicipios(ibge, dq).filter(c => uf === "TODAS" || c.uf === uf).slice(0, 4) : [];
    setAutocomplete(ibgeMatches.map(c => ({
      label: c.nome, sub: `Cidade · ${c.uf}`,
      href: `/municipio/${encodeURIComponent(c.nome)}?uf=${c.uf}`,
    })));
  }, [dq, uf, ibge]);

  // Infinite scroll observer
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(async (entries) => {
      if (!entries[0].isIntersecting || loadingMore) return;
      if (!hasMoreRuas && !hasMoreCidades) return;
      setLoadingMore(true);
      const tasks: Promise<any>[] = [];
      if (hasMoreRuas) tasks.push(loadRuas(pageRuas).then(r => { setRuas(prev => [...prev, ...r]); setHasMoreRuas(r.length === PAGE); setPageRuas(p => p + 1); }));
      if (hasMoreCidades) tasks.push(loadCidades(pageCidades).then(c => { setCidades(prev => [...prev, ...c.map((x: any) => ({ ...x, source: "db" }))]); setHasMoreCidades(c.length === PAGE); setPageCidades(p => p + 1); }));
      await Promise.all(tasks);
      setLoadingMore(false);
    }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMoreRuas, hasMoreCidades, pageRuas, pageCidades, loadingMore, loadRuas, loadCidades]);

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
          <CardContent className="grid gap-3 p-4 md:grid-cols-[1fr_120px_140px_140px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cidade, rua ou bairro..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onFocus={() => setShowAuto(true)}
                onBlur={() => setTimeout(() => setShowAuto(false), 150)}
                className="pl-9"
              />
              {showAuto && autocomplete.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-popover shadow-lg">
                  {autocomplete.map((a, i) => (
                    <button key={i} onMouseDown={() => navigate(a.href)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted">
                      <span>{a.label}</span>
                      <span className="text-xs text-muted-foreground">{a.sub}</span>
                    </button>
                  ))}
                </div>
              )}
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
            <Select value={surface} onValueChange={setSurface}>
              <SelectTrigger><SelectValue placeholder="Superfície" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Toda superfície</SelectItem>
                <SelectItem value="dirt">Dirt</SelectItem>
                <SelectItem value="gravel">Gravel</SelectItem>
                <SelectItem value="earth">Earth</SelectItem>
                <SelectItem value="ground">Ground</SelectItem>
                <SelectItem value="sand">Sand</SelectItem>
                <SelectItem value="unpaved">Unpaved</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading && <div className="flex justify-center p-6"><Loader2 className="animate-spin" /></div>}

        {showCidades && cidades.length > 0 && (
          <Section title="Cidades" icon={<Building2 className="h-4 w-4" />} count={cidades.length}>
            {cidades.map((c, i) => (
              <button key={`${c.nome}-${c.uf}-${i}`} onClick={() => navigate(`/municipio/${encodeURIComponent(c.nome)}${c.uf ? `?uf=${c.uf}` : ""}`)}
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
              <button key={`${r.osm_id}-${i}`} onClick={() => navigate(`/municipio/${encodeURIComponent(r.municipios?.nome)}?uf=${r.municipios?.uf || ""}&focus=${r.osm_id}`)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-muted/50">
                <div>
                  <p className="font-medium">{r.nome || "(sem nome)"}</p>
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
              <button key={`${b.bairro}-${b.nome}-${i}`}
                onClick={() => navigate(`/municipio/${encodeURIComponent(b.nome)}?uf=${b.uf || ""}&bairro=${encodeURIComponent(b.bairro)}`)}
                className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm transition hover:bg-muted/50">
                <div>
                  <p className="font-medium">{b.bairro}</p>
                  <p className="text-xs text-muted-foreground">{b.nome} · {b.uf}</p>
                </div>
              </button>
            ))}
          </Section>
        )}

        <div ref={sentinelRef} className="h-10 flex items-center justify-center">
          {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
        </div>

        {!loading && dq.length >= 2 && cidades.length === 0 && ruas.length === 0 && bairros.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nada encontrado para "{dq}".</p>
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
