import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Cloud, RefreshCw } from "lucide-react";

interface CacheCfg {
  id: string;
  provider: "none" | "nostr" | "ipfs" | "both";
  nostr_relays: string[];
  ipfs_gateway: string;
  enabled: boolean;
  extra_cities: string[];
}

export function CachePanel() {
  const [cfg, setCfg] = useState<CacheCfg | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extraInput, setExtraInput] = useState("");

  useEffect(() => { (async () => {
    const { data } = await supabase.from("external_cache_config").select("*").limit(1).maybeSingle();
    if (data) { setCfg(data as any); setExtraInput((data.extra_cities || []).join(", ")); }
    setLoading(false);
  })(); }, []);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    const extras = extraInput.split(",").map(s => s.trim()).filter(Boolean);
    const { error } = await supabase.from("external_cache_config").update({
      provider: cfg.provider, enabled: cfg.enabled,
      nostr_relays: cfg.nostr_relays, ipfs_gateway: cfg.ipfs_gateway,
      extra_cities: extras, updated_at: new Date().toISOString(),
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Configuração salva" });
  };

  const refreshStats = async () => {
    const { error } = await supabase.functions.invoke("refresh-stats");
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Agregados atualizados (snapshot mensal gerado)" });
  };

  if (loading) return <div className="p-6"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!cfg) return <p>Configuração não encontrada.</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" /> Cache externo (Nostr / IPFS)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O histórico Overpass de capitais e Duque de Caxias pode ser cacheado fora do banco para poupar espaço.
            Dados são comprimidos com gzip antes de publicar.
          </p>
          <div className="flex items-center gap-3">
            <Switch checked={cfg.enabled} onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })} />
            <Label>Cache externo ativado</Label>
            <Badge variant="outline">Chave pública: NOSTR_PRIVKEY_HEX (gerada)</Badge>
          </div>
          <div>
            <Label className="mb-1 block">Provider</Label>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={cfg.provider}
              onChange={(e) => setCfg({ ...cfg, provider: e.target.value as any })}>
              <option value="none">Desativado</option>
              <option value="nostr">Nostr (relays públicos)</option>
              <option value="ipfs">IPFS (via gateway)</option>
              <option value="both">Ambos (Nostr primário, IPFS fallback)</option>
            </select>
          </div>
          <div>
            <Label className="mb-1 block">Relays Nostr (um por linha)</Label>
            <Input value={cfg.nostr_relays.join(", ")}
              onChange={(e) => setCfg({ ...cfg, nostr_relays: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
              placeholder="wss://relay.damus.io, wss://nos.lol" />
          </div>
          <div>
            <Label className="mb-1 block">Gateway IPFS</Label>
            <Input value={cfg.ipfs_gateway}
              onChange={(e) => setCfg({ ...cfg, ipfs_gateway: e.target.value })}
              placeholder="https://ipfs.io" />
          </div>
          <div>
            <Label className="mb-1 block">Cidades extras em cache (além de capitais + Duque de Caxias)</Label>
            <Input value={extraInput} onChange={(e) => setExtraInput(e.target.value)}
              placeholder="Ex: Nova Iguaçu, São Gonçalo, Guarulhos" />
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5" /> Agregados (BR / UF)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Grava um snapshot mensal em <code>stats_agregadas</code> — usado pelo ranking com variação temporal
            sem escanear a tabela <code>vias</code>.
          </p>
          <Button onClick={refreshStats} variant="outline">Gerar snapshot agora</Button>
        </CardContent>
      </Card>
    </div>
  );
}
