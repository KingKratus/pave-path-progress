import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/Navbar";
import { toast } from "@/hooks/use-toast";
import { Shield, Sparkles } from "lucide-react";

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const signInGoogle = async () => {
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: `${window.location.origin}/admin` });
    if (res.error) toast({ title: "Erro Google", description: String(res.error.message || res.error), variant: "destructive" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) navigate("/admin"); });
  }, [navigate]);

  const signIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    navigate("/admin");
  };

  const signUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password, options: { emailRedirectTo: `${window.location.origin}/admin` },
    });
    setLoading(false);
    if (error) return toast({ title: "Erro", description: error.message, variant: "destructive" });
    toast({ title: "Conta criada", description: "Você já pode entrar." });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto grid items-center gap-10 px-4 py-12 md:grid-cols-2">
        <div className="hidden md:block">
          <div className="bento grain p-10 bg-gradient-civic text-primary-foreground">
            <Shield className="mb-6 h-10 w-10" />
            <h1 className="font-display text-4xl font-bold tracking-tight">Área administrativa</h1>
            <p className="mt-3 text-primary-foreground/80">
              Gerencie sincronizações, configurações de IA e auditorias do PavimentaBR.
            </p>
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-secondary/20 px-3 py-1.5 text-xs font-semibold text-secondary">
              <Sparkles className="h-3 w-3" /> Acesso restrito
            </div>
          </div>
        </div>
        <div className="bento p-8 md:max-w-md md:justify-self-end md:w-full">
          <h2 className="mb-6 font-display text-2xl font-bold">Entrar</h2>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="space-y-3 pt-4">
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Senha</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button onClick={signIn} disabled={loading} className="w-full">Entrar</Button>
            </TabsContent>
            <TabsContent value="signup" className="space-y-3 pt-4">
              <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Senha (mín. 6)</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button onClick={signUp} disabled={loading} className="w-full">Cadastrar</Button>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Auth;
