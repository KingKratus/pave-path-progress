import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Priority {
  area: string;
  score: number;
  justificativa: string;
  vias_destacadas: string[];
}

export function AiPriorities({ municipioId }: { municipioId: string | null }) {
  const [provider, setProvider] = useState("lovable");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ resumo: string; priorities: Priority[] } | null>(null);

  const run = async () => {
    if (!municipioId) return;
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("ai-prioritize", {
      body: { municipio_id: municipioId, provider },
    });
    setLoading(false);
    if (error || res?.error) {
      toast({ title: "Erro na análise", description: res?.error || error?.message, variant: "destructive" });
      return;
    }
    setData(res.payload);
  };

  if (!municipioId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-accent-foreground" /> Áreas prioritárias (IA)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lovable">Lovable AI (padrão)</SelectItem>
              <SelectItem value="gemini">Gemini (sua chave)</SelectItem>
              <SelectItem value="openai">OpenAI (sua chave)</SelectItem>
              <SelectItem value="openrouter">OpenRouter (sua chave)</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={run} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Analisar
          </Button>
          <p className="text-xs text-muted-foreground">
            Para usar Gemini/OpenAI/OpenRouter, peça ao admin para cadastrar a chave em Settings.
          </p>
        </div>

        {data && (
          <div className="space-y-3">
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm">{data.resumo}</p>
            <div className="grid gap-3 md:grid-cols-2">
              {data.priorities.map((p, i) => (
                <Card key={i} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-foreground">{p.area}</h4>
                      <Badge variant="default">{p.score.toFixed(0)}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{p.justificativa}</p>
                    {p.vias_destacadas?.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {p.vias_destacadas.slice(0, 6).map((v, j) => (
                          <span key={j} className="rounded bg-muted px-2 py-0.5 text-xs">{v}</span>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
