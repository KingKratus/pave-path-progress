import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Clock } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface Props { city: string; uf?: string; bairro?: string | null; }

export function BairroHistory({ city, uf, bairro }: Props) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cache, setCache] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null); setCache(null);
    const now = new Date();
    const dates: string[] = [];
    for (let y = 6; y >= 0; y--) {
      const d = new Date(now.getFullYear() - y, 0, 1);
      dates.push(d.toISOString().slice(0, 10));
    }
    // history-cache tenta Nostr/IPFS antes de bater no Overpass
    const { data: res, error: err } = await supabase.functions.invoke("history-cache", {
      body: { city, uf, bairro: bairro || undefined, dates },
    });
    setLoading(false);
    if (err) { setError(err.message); return; }
    if (res?.error) { setError(res.error); return; }
    setCache(res?.cache || null);
    setData((res?.series || []).map((s: any) => ({ ano: s.date.slice(0, 4), km: Number(s.total_km_unpaved.toFixed(2)), vias: s.vias })));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Histórico OSM {bairro ? `· ${bairro}` : ""}
          {cache && <span className="ml-2 rounded-full bg-secondary/30 px-2 py-0.5 text-[10px] font-semibold uppercase text-secondary-foreground">cache: {cache}</span>}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Carregar (7 anos)"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">Erro: {error}</p>}
        {!error && data.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground">Histórico carregado sob demanda. Capitais e Duque de Caxias usam cache externo (Nostr/IPFS) — nunca ocupa espaço no banco.</p>
        )}

        {data.length > 0 && (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ano" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="km" stroke="hsl(var(--destructive))" name="km não pavimentado" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
