import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Navbar } from "@/components/Navbar";
import { toast } from "@/hooks/use-toast";
import { Shield, Sparkles } from "lucide-react";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
