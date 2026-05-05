import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Clock, RefreshCw, Loader2, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface Alert {
  id: string;
  level: "error" | "warn" | "info";
  type: string;
  title: string;
  detail: string;
  context?: any;
  action?: { label: string; run: () => Promise<void> };
}

const STALE_THRESHOLD_DAYS = 14;

export function AlertsPanel() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const out: Alert[] = [];

    // 1) Failed syncs in the last 24h
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: errs } = await supabase
      .from("sync_logs")
      .select("id, municipio_id, municipio_nome, uf, error_stage, message, started_at, attempt")
      .eq("status", "error")
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(50);

    (errs || []).forEach((e: any) => {
      out.push({
        id: `err-${e.id}`,
        level: "error",
        type: "sync_failed",
        title: `Sync falhou: ${e.municipio_nome}${e.uf ? ` (${e.uf})` : ""}`,
        detail: `Etapa: ${e.error_stage || "—"} · Tentativa #${e.attempt} · ${(e.message || "").slice(0, 160)}`,
        context: e,
        action: e.municipio_id ? {
          label: "Retry",
          run: async () => {
            const { error } = await supabase.functions.invoke("admin-trigger-sync", {
              body: { municipio: e.municipio_nome, uf: e.uf || undefined, parent_log_id: e.id },
            });
            if (error) throw error;
          },
        } : undefined,
      });
    });

    // 2) Stale municipalities (sem sync recente)
    const staleSince = new Date(Date.now() - STALE_THRESHOLD_DAYS * 86400 * 1000).toISOString();
    const { data: stale } = await supabase
      .from("municipios")
      .select("id, nome, uf, last_sync_at")
      .or(`last_sync_at.is.null,last_sync_at.lt.${staleSince}`)
      .limit(30);

    (stale || []).forEach((m: any) => {
      out.push({
        id: `stale-${m.id}`,
        level: "warn",
        type: "stale",
        title: `Sem sync recente: ${m.nome}${m.uf ? ` (${m.uf})` : ""}`,
        detail: m.last_sync_at
          ? `Último sync em ${new Date(m.last_sync_at).toLocaleDateString("pt-BR")}`
          : "Nunca foi sincronizado",
        action: {
          label: "Sincronizar",
          run: async () => {
            const { error } = await supabase.functions.invoke("admin-trigger-sync", {
              body: { municipio: m.nome, uf: m.uf || undefined },
            });
            if (error) throw error;
          },
        },
      });
    });

    // 3) Provider IA inválido
    const { data: ai } = await supabase
      .from("ai_provider_settings" as any)
      .select("provider, model")
      .eq("id", "default")
      .maybeSingle();
    if (ai?.provider && ai.provider !== "lovable") {
      out.push({
        id: "ai-provider-check",
        level: "info",
        type: "ai_provider",
        title: `Provedor IA: ${ai.provider}`,
        detail: `Verifique se a chave está configurada nos secrets. Modelo: ${ai.model}`,
      });
    }

    // 4) Vias sem nome (qualidade)
    const { count: semNomeCount } = await supabase
      .from("vias")
      .select("id", { count: "exact", head: true })
      .eq("nome_status", "sem_nome");
    if ((semNomeCount || 0) > 100) {
      out.push({
        id: "many-unnamed",
        level: "warn",
        type: "data_quality",
        title: `${semNomeCount} ruas sem nome no acervo`,
        detail: "Considere rodar a função enrich-vias para preencher nomes via reverse-geocoding.",
        action: {
          label: "Enriquecer agora",
          run: async () => {
            const { error } = await supabase.functions.invoke("enrich-vias", { body: { limit: 200 } });
            if (error) throw error;
          },
        },
      });
    }

    setAlerts(out);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => ({
    error: alerts.filter(a => a.level === "error").length,
    warn: alerts.filter(a => a.level === "warn").length,
    info: alerts.filter(a => a.level === "info").length,
  }), [alerts]);

  const runAction = async (a: Alert) => {
    if (!a.action) return;
    setBusy(a.id);
    try {
      await a.action.run();
      toast({ title: "Ação executada", description: a.action.label });
      await load();
    } catch (e: any) {
      toast({ title: "Falhou", description: e.message, variant: "destructive" });
    } finally { setBusy(null); }
  };

  const badge = (lvl: Alert["level"]) =>
    lvl === "error" ? <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Erro</Badge>
    : lvl === "warn" ? <Badge className="gap-1 bg-amber-500/90 hover:bg-amber-500"><AlertTriangle className="h-3 w-3" />Aviso</Badge>
    : <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Info</Badge>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center justify-between gap-3">
          <span>Alertas operacionais</span>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">{counts.error} erros</Badge>
            <Badge className="bg-amber-500/90">{counts.warn} avisos</Badge>
            <Badge variant="secondary">{counts.info} info</Badge>
            <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1">
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Atualizar
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <p>Nenhum alerta. Tudo operacional.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nível</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Alerta</TableHead><TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{badge(a.level)}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{a.type}</TableCell>
                    <TableCell>
                      <p className="font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{a.detail}</p>
                    </TableCell>
                    <TableCell className="text-right">
                      {a.action && (
                        <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => runAction(a)}>
                          {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : a.action.label}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
