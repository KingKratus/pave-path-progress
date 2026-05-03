import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROVIDERS: Record<string, { url: string; envKey: string; defaultModel: string }> = {
  lovable: {
    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
    envKey: "LOVABLE_API_KEY",
    defaultModel: "google/gemini-3-flash-preview",
  },
  openai: {
    url: "https://api.openai.com/v1/chat/completions",
    envKey: "USER_OPENAI_KEY",
    defaultModel: "gpt-4o-mini",
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    envKey: "USER_GEMINI_KEY",
    defaultModel: "gemini-2.0-flash",
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    envKey: "USER_OPENROUTER_KEY",
    defaultModel: "google/gemini-2.0-flash-001",
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { municipio_id, provider = "lovable", model } = await req.json();
    if (!municipio_id) {
      return new Response(JSON.stringify({ error: "municipio_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cfg = PROVIDERS[provider];
    if (!cfg) {
      return new Response(JSON.stringify({ error: `unknown provider: ${provider}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get(cfg.envKey);
    if (!apiKey) {
      return new Response(JSON.stringify({
        error: `Chave ${cfg.envKey} não configurada`,
        hint: provider === "lovable" ? "Lovable AI deve estar habilitado" : "Adicione sua chave em Settings",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: mun } = await supabase.from("municipios").select("nome, uf").eq("id", municipio_id).maybeSingle();
    const { data: vias } = await supabase.from("vias").select("nome, surface, length_m")
      .eq("municipio_id", municipio_id).order("length_m", { ascending: false }).limit(80);

    if (!vias || vias.length === 0) {
      return new Response(JSON.stringify({ error: "Sem vias para analisar. Sincronize primeiro." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalKm = vias.reduce((s, v) => s + (v.length_m || 0), 0) / 1000;
    const bySurf: Record<string, number> = {};
    vias.forEach((v) => { bySurf[v.surface] = (bySurf[v.surface] || 0) + (v.length_m || 0); });

    const prompt = `Você é um especialista em planejamento urbano e infraestrutura viária.

Município: ${mun?.nome || "?"} ${mun?.uf || ""}
Total de vias não pavimentadas amostradas: ${vias.length}
Quilometragem total: ${totalKm.toFixed(1)} km
Distribuição por superfície (metros): ${JSON.stringify(bySurf)}

Lista das maiores vias não pavimentadas (top ${Math.min(50, vias.length)}):
${vias.slice(0, 50).map((v, i) => `${i + 1}. ${v.nome || "Sem nome"} — ${v.surface} — ${(v.length_m / 1000).toFixed(2)} km`).join("\n")}

Identifique de 3 a 6 áreas/grupos prioritários para pavimentação, justificando em PT-BR com base em: comprimento, tipo de superfície (terra/lama são piores), agrupamento de nomes que sugerem mesma região, impacto social estimado.

Retorne APENAS via tool call.`;

    const tools = [{
      type: "function",
      function: {
        name: "set_priorities",
        description: "Define áreas prioritárias para pavimentação",
        parameters: {
          type: "object",
          properties: {
            priorities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  area: { type: "string", description: "Nome da área/região/grupo de ruas" },
                  score: { type: "number", description: "Score 0-100 de prioridade" },
                  justificativa: { type: "string", description: "Justificativa em PT-BR" },
                  vias_destacadas: { type: "array", items: { type: "string" }, description: "Nomes das ruas que compõem essa área" },
                },
                required: ["area", "score", "justificativa", "vias_destacadas"],
                additionalProperties: false,
              },
            },
            resumo: { type: "string", description: "Resumo executivo em PT-BR (2-3 frases)" },
          },
          required: ["priorities", "resumo"],
          additionalProperties: false,
        },
      },
    }];

    const aiBody: any = {
      model: model || cfg.defaultModel,
      messages: [{ role: "user", content: prompt }],
      tools,
      tool_choice: { type: "function", function: { name: "set_priorities" } },
    };

    const aiRes = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(aiBody),
    });

    if (!aiRes.ok) {
      const txt = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Limite de requisições atingido. Tente em breve." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI ${aiRes.status}: ${txt.slice(0, 300)}`);
    }

    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI não retornou estrutura esperada");
    const payload = JSON.parse(toolCall.function.arguments);

    await supabase.from("ai_priorities").insert({
      municipio_id, model: model || cfg.defaultModel, provider, payload,
    });

    return new Response(JSON.stringify({ ok: true, payload }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ai-prioritize error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
