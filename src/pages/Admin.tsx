import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Calculator, MapIcon, AlertCircle, CheckCircle2, RotateCcw, Eye } from "lucide-react";
import { AiProvidersPanel } from "@/components/admin/AiProvidersPanel";
import { AlertsPanel } from "@/components/admin/AlertsPanel";
import { toast } from "@/hooks/use-toast";

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

interface Municipio { id: string; nome: string; uf: string | null; estado: string; last_sync_at: string | null; }
interface Settings { id: string; sync_interval_minutes: number; auto_sync_enabled: boolean; enabled_municipios: string[]; }
interface SyncLog {
  id: string; municipio_nome: string; municipio_id: string | null; uf: string | null;
  status: string; message: string | null; total_vias: number; total_km: number;
  duration_ms: number | null; started_at: string; finished_at: string | null;
  triggered_by: string; parent_log_id: string | null; attempt: number; error_stage: string | null;
}

const Admin = () => {
  const { session, isAdmin, loading } = useUserRole();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [logFilter, setLogFilter] = useState("");
  const [openLog, setOpenLog] = useState<SyncLog | null>(null);

  const [ufSel, setUfSel] = useState("RJ");
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchLogs, setBatchLogs] = useState<SyncLog[]>([]);
  const batchStartRef = useRef<number>(0);

  useEffect(() => { if (!loading && !session) navigate("/auth"); }, [loading, session, navigate]);

  const load = async () => {
    const [{ data: s }, { data: m }, { data: l }] = await Promise.all([
      supabase.from("admin_settings").select("*").limit(1).maybeSingle(),
      supabase.from("municipios").select("id, nome, uf, estado, last_sync_at").order("nome"),
      supabase.from("sync_logs").select("*").order("started_at", { ascending: false }).limit(200),
    ]);
    if (s) setSettings(s as any);
    if (m) setMunicipios(m as any);
    if (l) setLogs(l as any);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  // Realtime para batch UF
  useEffect(() => {
    if (!batchOpen || !batchId) return;
    batchStartRef.current = Date.now();
    setBatchLogs([]);

    // Initial load
    supabase.from("sync_logs").select("*").eq("triggered_by", `uf-batch:${batchId}`).then(({ data }) => {
      if (data) setBatchLogs(data as any);
    });

    const ch = supabase
      .channel(`batch-${batchId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_logs", filter: `triggered_by=eq.uf-batch:${batchId}` },
        (payload) => {
          setBatchLogs((prev) => {
            const row = payload.new as any;
            if (!row) return prev;
            const idx = prev.findIndex((p) => p.id === row.id);
            if (idx >= 0) { const c = [...prev]; c[idx] = row; return c; }
            return [...prev, row];
          });
        })
      .subscribe();

    // Polling fallback
    const itv = setInterval(async () => {
      const { data } = await supabase.from("sync_logs").select("*").eq("triggered_by", `uf-batch:${batchId}`);
      if (data) setBatchLogs(data as any);
    }, 5000);

    return () => { supabase.removeChannel(ch); clearInterval(itv); };
  }, [batchOpen, batchId]);

  if (loading) return <div className="flex items-center justify-center p-16"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">Sua conta ({session?.user.email}) não tem privilégios de administrador.</p>
          <p className="mt-2 text-xs font-mono text-muted-foreground">{session?.user.id}</p>
          <Button className="mt-4" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>Sair</Button>
        </div>
      </div>
    );
  }

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase.from("admin_settings").update({
      sync_interval_minutes: settings.sync_interval_minutes,
      auto_sync_enabled: settings.auto_sync_enabled,
      enabled_municipios: settings.enabled_municipios,
      updated_by: session?.user.id, updated_at: new Date().toISOString(),
    }).eq("id", settings.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Configurações salvas" });
  };

  const triggerSync = async (m: Municipio, parentLogId?: string) => {
    setBusy(m.id);
    const { error } = await supabase.functions.invoke("admin-trigger-sync", {
      body: { municipio: m.nome, uf: m.uf || undefined, parent_log_id: parentLogId },
    });
    setBusy(null);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: parentLogId ? `Retentativa de ${m.nome} disparada` : `${m.nome} sincronizado` }); load(); }
  };

  const retryLog = async (l: SyncLog) => {
    const m = municipios.find((mm) => mm.id === l.municipio_id) ||
              { id: l.municipio_id || "", nome: l.municipio_nome, uf: l.uf, estado: l.uf || "", last_sync_at: null };
    await triggerSync(m as Municipio, l.parent_log_id || l.id);
  };

  const recalc = async () => {
    setBusy("rank");
    const { error } = await supabase.functions.invoke("admin-trigger-sync", { body: { recalculate: true } });
    setBusy(null);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Ranking recalculado" });
  };

  const startUfBatch = async () => {
    const id = `${ufSel}-${Date.now()}`;
    setBatchId(id); setBatchTotal(0);
    const { data, error } = await supabase.functions.invoke("sync-uf", { body: { uf: ufSel, batch_id: id } });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setBatchOpen(false); return;
    }
    setBatchTotal(data?.total || 0);
    toast({ title: `Sync de ${ufSel} iniciado`, description: `${data?.total} municípios na fila` });
  };

  // Batch metrics
  const batchDone = batchLogs.filter((l) => l.status !== "running").length;
  const batchErrors = batchLogs.filter((l) => l.status === "error").length;
  const batchOk = batchLogs.filter((l) => l.status === "ok").length;
  const elapsedMin = batchStartRef.current ? Math.max(0.1, (Date.now() - batchStartRef.current) / 60000) : 0.1;
  const rate = batchDone / elapsedMin;
  const remaining = Math.max(0, batchTotal - batchDone);
  const etaMin = rate > 0 ? remaining / rate : null;

  // Logs grouped/filtered
  const filteredLogs = useMemo(() => {
    return logs.filter((l) => !logFilter ||
      l.municipio_nome.toLowerCase().includes(logFilter.toLowerCase()) ||
      (l.uf || "").toLowerCase().includes(logFilter.toLowerCase()) ||
      (l.message || "").toLowerCase().includes(logFilter.toLowerCase()));
  }, [logs, logFilter]);

  const errorByStage = useMemo(() => {
    const acc: Record<string, number> = { overpass: 0, ingest: 0, calc: 0, unknown: 0 };
    logs.forEach((l) => { if (l.status === "error") acc[l.error_stage || "unknown"] = (acc[l.error_stage || "unknown"] || 0) + 1; });
    return acc;
  }, [logs]);

  const statusBadge = (s: string) => s === "ok"
    ? <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />OK</Badge>
    : s === "error" ? <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Erro</Badge>
    : <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" />Rodando</Badge>;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Painel administrativo</h1>
          <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>Sair</Button>
        </div>

        <Tabs defaultValue="alertas">
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="alertas">Alertas</TabsTrigger>
            <TabsTrigger value="sync">Sincronização</TabsTrigger>
            <TabsTrigger value="municipios">Municípios</TabsTrigger>
            <TabsTrigger value="uf">Sync por UF</TabsTrigger>
            <TabsTrigger value="logs">Histórico</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="ia">IA Providers</TabsTrigger>
          </TabsList>

          <TabsContent value="alertas">
            <AlertsPanel />
          </TabsContent>


          <TabsContent value="sync">
            <Card>
              <CardHeader><CardTitle>Configurações de sincronização</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {settings && (
                  <>
                    <div className="flex items-center gap-3">
                      <Switch checked={settings.auto_sync_enabled}
                        onCheckedChange={(v) => setSettings({ ...settings, auto_sync_enabled: v })} />
                      <Label>Sincronização automática ativada</Label>
                    </div>
                    <div>
                      <Label>Intervalo (minutos)</Label>
                      <Input type="number" min={15} max={1440}
                        value={settings.sync_interval_minutes}
                        onChange={(e) => setSettings({ ...settings, sync_interval_minutes: Number(e.target.value) })} />
                    </div>
                    <div>
                      <Label className="mb-2 block">Municípios habilitados</Label>
                      <div className="grid gap-2 md:grid-cols-2 max-h-80 overflow-y-auto">
                        {municipios.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={settings.enabled_municipios.includes(m.id)}
                              onChange={(e) => {
                                const set = new Set(settings.enabled_municipios);
                                e.target.checked ? set.add(m.id) : set.delete(m.id);
                                setSettings({ ...settings, enabled_municipios: Array.from(set) });
                              }} />
                            {m.nome} {m.uf && `(${m.uf})`}
                          </label>
                        ))}
                      </div>
                    </div>
                    <Button onClick={saveSettings}>Salvar</Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="municipios">
            <Card>
              <CardHeader><CardTitle>Municípios cadastrados</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead><TableHead>UF</TableHead>
                      <TableHead>Última sincronização</TableHead><TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {municipios.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell>{m.uf || "—"}</TableCell>
                        <TableCell>{m.last_sync_at ? new Date(m.last_sync_at).toLocaleString("pt-BR") : "Nunca"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => triggerSync(m)} disabled={busy === m.id} className="gap-1">
                            {busy === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Sincronizar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="uf">
            <Card>
              <CardHeader><CardTitle>Sincronização por UF inteira</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Dispara sync de todos os municípios da UF (via IBGE) e recalcula o ranking ao final.
                  <strong className="block mt-1">Atenção:</strong> pode levar muitos minutos e consome muita cota da Overpass API.
                </p>
                <div className="flex flex-wrap gap-3">
                  <select className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ufSel} onChange={(e) => setUfSel(e.target.value)}>
                    {UFS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <Dialog open={batchOpen} onOpenChange={(v) => { setBatchOpen(v); if (!v) setBatchId(null); }}>
                    <DialogTrigger asChild>
                      <Button className="gap-2"><MapIcon className="h-4 w-4" />Sincronizar UF {ufSel}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{batchId ? `Progresso — ${ufSel}` : `Confirmar sync da UF ${ufSel}`}</DialogTitle>
                        <DialogDescription>
                          {batchId ? "Atualizando em tempo real. Pode fechar esta janela." : `Vai disparar sync para todos os municípios da UF ${ufSel}.`}
                        </DialogDescription>
                      </DialogHeader>
                      {batchId ? (
                        <div className="space-y-3">
                          <Progress value={batchTotal ? (batchDone / batchTotal) * 100 : 0} />
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>✅ OK: <strong>{batchOk}</strong></div>
                            <div>❌ Erros: <strong className={batchErrors > 0 ? "text-destructive" : ""}>{batchErrors}</strong></div>
                            <div>📊 Taxa: <strong>{rate.toFixed(1)}/min</strong></div>
                            <div>⏱ ETA: <strong>{etaMin !== null ? `${etaMin.toFixed(1)} min` : "—"}</strong></div>
                          </div>
                          <p className="text-xs text-muted-foreground">{batchDone} de {batchTotal} processados</p>
                        </div>
                      ) : null}
                      <DialogFooter>
                        {!batchId
                          ? <Button onClick={startUfBatch}>Confirmar e iniciar</Button>
                          : <Button variant="outline" onClick={() => { setBatchOpen(false); setBatchId(null); load(); }}>Fechar</Button>}
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                  <span>Histórico de sincronizações</span>
                  <Button size="sm" variant="outline" onClick={load}>Atualizar</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Erros Overpass</p><p className="text-xl font-bold text-destructive">{errorByStage.overpass || 0}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Erros Ingestão</p><p className="text-xl font-bold text-destructive">{errorByStage.ingest || 0}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Erros Cálculo</p><p className="text-xl font-bold text-destructive">{errorByStage.calc || 0}</p></div>
                  <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Outros</p><p className="text-xl font-bold text-destructive">{errorByStage.unknown || 0}</p></div>
                </div>
                <Input placeholder="Filtrar por município, UF ou mensagem..." value={logFilter} onChange={(e) => setLogFilter(e.target.value)} className="mb-3" />
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead><TableHead>Tent.</TableHead>
                        <TableHead>Município</TableHead><TableHead>UF</TableHead>
                        <TableHead>Etapa</TableHead><TableHead>Vias</TableHead><TableHead>Km</TableHead>
                        <TableHead>Duração</TableHead><TableHead>Início</TableHead><TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>{statusBadge(l.status)}</TableCell>
                          <TableCell><Badge variant="outline">#{l.attempt || 1}</Badge></TableCell>
                          <TableCell className="font-medium">{l.municipio_nome}</TableCell>
                          <TableCell>{l.uf || "—"}</TableCell>
                          <TableCell className="text-xs">{l.error_stage || "—"}</TableCell>
                          <TableCell>{l.total_vias}</TableCell>
                          <TableCell>{Number(l.total_km).toFixed(1)}</TableCell>
                          <TableCell>{l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : "—"}</TableCell>
                          <TableCell className="text-xs">{new Date(l.started_at).toLocaleString("pt-BR")}</TableCell>
                          <TableCell className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setOpenLog(l)} title="Ver detalhes"><Eye className="h-4 w-4" /></Button>
                            {l.status === "error" && (
                              <Button size="sm" variant="outline" onClick={() => retryLog(l)} title="Tentar novamente">
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredLogs.length === 0 && (
                        <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nenhum log</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ia">
            <AiProvidersPanel />
          </TabsContent>
          <TabsContent value="ranking">
            <Card>
              <CardHeader><CardTitle>Recalcular ranking</CardTitle></CardHeader>
              <CardContent>
                <Button onClick={recalc} disabled={busy === "rank"} className="gap-2">
                  {busy === "rank" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
                  Recalcular agora
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!openLog} onOpenChange={(v) => !v && setOpenLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalhe do sync</DialogTitle>
            <DialogDescription>{openLog?.municipio_nome} {openLog?.uf && `— ${openLog.uf}`}</DialogDescription>
          </DialogHeader>
          {openLog && (
            <div className="space-y-2 text-sm">
              <p><strong>Status:</strong> {openLog.status}</p>
              <p><strong>Tentativa:</strong> #{openLog.attempt || 1}{openLog.parent_log_id && ` (parent ${openLog.parent_log_id.slice(0, 8)})`}</p>
              <p><strong>Etapa do erro:</strong> {openLog.error_stage || "—"}</p>
              <p><strong>Origem:</strong> {openLog.triggered_by}</p>
              <p><strong>Duração:</strong> {openLog.duration_ms ? `${(openLog.duration_ms / 1000).toFixed(1)}s` : "—"}</p>
              <p><strong>Mensagem:</strong></p>
              <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs">{openLog.message || "(sem mensagem)"}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
