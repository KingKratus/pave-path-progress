import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Loader2, KeyRound } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PROVIDERS = [
  { value: "lovable", label: "Lovable AI (padrão)", defaultModel: "google/gemini-3-flash-preview", needsKey: false },
  { value: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash", needsKey: "USER_GEMINI_KEY" },
  { value: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini", needsKey: "USER_OPENAI_KEY" },
  { value: "openrouter", label: "OpenRouter", defaultModel: "google/gemini-2.0-flash-001", needsKey: "USER_OPENROUTER_KEY" },
] as const;

export function AiProvidersPanel() {
  const [provider, setProvider] = useState("lovable");
  const [model, setModel] = useState("google/gemini-3-flash-preview");
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("ai_provider_settings").select("*").eq("id", "default").maybeSingle();
      if (data) { setProvider(data.provider); setModel(data.model); }
    })();
  }, []);

  const cur = PROVIDERS.find((p) => p.value === provider)!;

  const save = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("ai_provider_settings").update({
      provider, model, updated_by: user?.id, updated_at: new Date().toISOString(),
    }).eq("id", "default");
    setSaving(false);
    if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    else toast({ title: "Provedor padrão atualizado" });
  };

  const validate = async () => {
    setValidating(true); setResult(null);
    const { data, error } = await supabase.functions.invoke("ai-validate", { body: { provider, model } });
    setValidating(false);
    if (error) { setResult({ ok: false, msg: error.message }); return; }
    setResult({ ok: !!data?.ok, msg: data?.ok ? `Conectado (${data.model})` : data?.error || "Falha" });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Provedores de IA</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Provedor padrão</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v); setModel(PROVIDERS.find(p => p.value === v)!.defaultModel); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Modelo</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder={cur.defaultModel} />
          </div>
        </div>

        {cur.needsKey && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
            <p className="font-medium">Esse provedor exige a chave <code className="rounded bg-muted px-1">{cur.needsKey}</code> nos secrets do projeto.</p>
            <p className="mt-1 text-muted-foreground">Configure em Configurações &rarr; Secrets, depois clique em "Validar".</p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar como padrão</Button>
          <Button variant="outline" onClick={validate} disabled={validating}>
            {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Validar conexão
          </Button>
          {result && (
            <Badge variant={result.ok ? "default" : "destructive"} className="gap-1 self-center">
              {result.ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
              {result.msg}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
