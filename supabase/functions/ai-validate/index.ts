import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDERS: Record<string, { url: string; envKey: string; defaultModel: string }> = {
  lovable: { url: "https://ai.gateway.lovable.dev/v1/chat/completions", envKey: "LOVABLE_API_KEY", defaultModel: "google/gemini-3-flash-preview" },
  openai: { url: "https://api.openai.com/v1/chat/completions", envKey: "USER_OPENAI_KEY", defaultModel: "gpt-4o-mini" },
  gemini: { url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", envKey: "USER_GEMINI_KEY", defaultModel: "gemini-2.0-flash" },
  openrouter: { url: "https://openrouter.ai/api/v1/chat/completions", envKey: "USER_OPENROUTER_KEY", defaultModel: "google/gemini-2.0-flash-001" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { provider = "lovable", model } = await req.json();
    const cfg = PROVIDERS[provider];
    if (!cfg) return new Response(JSON.stringify({ ok: false, error: "Provedor inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const apiKey = Deno.env.get(cfg.envKey);
    if (!apiKey) return new Response(JSON.stringify({ ok: false, error: `Chave ${cfg.envKey} não configurada` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const res = await fetch(cfg.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: model || cfg.defaultModel, messages: [{ role: "user", content: "ping" }], max_tokens: 5 }),
    });
    const txt = await res.text();
    if (!res.ok) return new Response(JSON.stringify({ ok: false, status: res.status, error: txt.slice(0, 300) }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    return new Response(JSON.stringify({ ok: true, provider, model: model || cfg.defaultModel }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
