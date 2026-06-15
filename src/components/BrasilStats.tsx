import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Map as MapIcon } from "lucide-react";
import { Link } from "react-router-dom";

interface Row { scope: string; key: string; total_km_unpaved: number; total_km_paved: number; municipios_sincronizados: number; }

export function BrasilStats() {
  const [br, setBr] = useState<Row | null>(null);
  const [ufs, setUfs] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stats_agregadas").select("*");
      const rows = (data || []) as Row[];
      setBr(rows.find(r => r.scope === "br") || null);
      setUfs(rows.filter(r => r.scope === "uf").sort((a, b) => b.total_km_unpaved - a.total_km_unpaved));
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <section className="container mx-auto px-4 py-12">
      <div className="mb-6 max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Brasil em números</p>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">Dados agregados — leves no servidor.</h2>
      </div>
      {br && (
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <Stat label="Não pavimentado (BR)" value={`${(br.total_km_unpaved).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`} />
          <Stat label="Pavimentado (BR)" value={`${(br.total_km_paved).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} km`} />
          <Stat label="Municípios sincronizados" value={`${br.municipios_sincronizados}`} />
        </div>
      )}
      {ufs.length > 0 && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {ufs.map((r) => (
              <Link key={r.key} to={`/estado/${r.key}`} className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-muted/50">
                <span className="flex items-center gap-1.5 font-semibold"><MapIcon className="h-3 w-3" /> {r.key}</span>
                <span className="text-xs text-muted-foreground">{r.total_km_unpaved.toFixed(0)} km</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
      {ufs.length === 0 && !br && (
        <p className="text-sm text-muted-foreground">Agregados ainda não calculados. Rode a função <code>refresh-stats</code> no admin.</p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </CardContent></Card>
  );
}
