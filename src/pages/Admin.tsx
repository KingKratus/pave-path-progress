import { useEffect, useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, Calculator } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Municipio { id: string; nome: string; uf: string | null; estado: string; last_sync_at: string | null; }
interface Settings { id: string; sync_interval_minutes: number; auto_sync_enabled: boolean; enabled_municipios: string[]; }

const Admin = () => {
  const { session, isAdmin, loading } = useUserRole();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [municipios, setMunicipios] = useState<Municipio[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) navigate("/auth");
  }, [loading, session, navigate]);

  const load = async () => {
    const [{ data: s }, { data: m }] = await Promise.all([
      supabase.from("admin_settings").select("*").limit(1).maybeSingle(),
      supabase.from("municipios").select("id, nome, uf, estado, last_sync_at").order("nome"),
    ]);
    if (s) setSettings(s as any);
    if (m) setMunicipios(m as any);
  };

  useEffect(() => { if (isAdmin) load(); }, [isAdmin]);

  if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-muted-foreground">
            Sua conta ({session?.user.email}) não tem privilégios de administrador.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Para ativar, peça ao administrador para inserir seu user_id na tabela <code>user_roles</code> com role <code>admin</code>.
          </p>
          <p className="mt-2 text-xs font-mono text-muted-foreground">{session?.user.id}</p>
          <Button className="mt-4" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase
      .from("admin_settings")
      .update({
        sync_interval_minutes: settings.sync_interval_minutes,
        auto_sync_enabled: settings.auto_sync_enabled,
        enabled_municipios: settings.enabled_municipios,
        updated_by: session?.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Configurações salvas" });
  };

  const triggerSync = async (m: Municipio) => {
    setBusy(m.id);
    const { error } = await supabase.functions.invoke("admin-trigger-sync", {
      body: { municipio: m.nome, uf: m.uf || undefined },
    });
    setBusy(null);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: `${m.nome} sincronizado` }); load(); }
  };

  const recalc = async () => {
    setBusy("rank");
    const { error } = await supabase.functions.invoke("admin-trigger-sync", { body: { recalculate: true } });
    setBusy(null);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else toast({ title: "Ranking recalculado" });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">Painel administrativo</h1>
          <Button variant="outline" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>
            Sair
          </Button>
        </div>

        <Tabs defaultValue="sync">
          <TabsList>
            <TabsTrigger value="sync">Sincronização</TabsTrigger>
            <TabsTrigger value="municipios">Municípios</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
          </TabsList>

          <TabsContent value="sync">
            <Card>
              <CardHeader><CardTitle>Configurações de sincronização</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {settings && (
                  <>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={settings.auto_sync_enabled}
                        onCheckedChange={(v) => setSettings({ ...settings, auto_sync_enabled: v })}
                      />
                      <Label>Sincronização automática ativada</Label>
                    </div>
                    <div>
                      <Label>Intervalo (minutos)</Label>
                      <Input
                        type="number" min={15} max={1440}
                        value={settings.sync_interval_minutes}
                        onChange={(e) => setSettings({ ...settings, sync_interval_minutes: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block">Municípios habilitados</Label>
                      <div className="grid gap-2 md:grid-cols-2">
                        {municipios.map((m) => (
                          <label key={m.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={settings.enabled_municipios.includes(m.id)}
                              onChange={(e) => {
                                const set = new Set(settings.enabled_municipios);
                                e.target.checked ? set.add(m.id) : set.delete(m.id);
                                setSettings({ ...settings, enabled_municipios: Array.from(set) });
                              }}
                            />
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
                      <TableHead>Nome</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Última sincronização</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {municipios.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.nome}</TableCell>
                        <TableCell>{m.uf || "—"}</TableCell>
                        <TableCell>{m.last_sync_at ? new Date(m.last_sync_at).toLocaleString("pt-BR") : "Nunca"}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" onClick={() => triggerSync(m)} disabled={busy === m.id}>
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
    </div>
  );
};

export default Admin;
