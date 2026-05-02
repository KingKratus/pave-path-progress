import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roles } = await admin
      .from("user_roles").select("role")
      .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
    if (!roles) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { uf, batch_id } = await req.json();
    if (!uf || !/^[A-Z]{2}$/.test(uf)) {
      return new Response(JSON.stringify({ error: "uf inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get UF id from IBGE then list municipios
    const ufList = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados").then(r => r.json());
    const ufObj = ufList.find((u: any) => u.sigla === uf);
    if (!ufObj) throw new Error("UF não encontrada no IBGE");

    const munList = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufObj.id}/municipios`
    ).then(r => r.json());

    // Kick off async background processing
    const total = munList.length;
    EdgeRuntime.waitUntil((async () => {
      for (let i = 0; i < munList.length; i++) {
        const m = munList[i];
        try {
          await fetch(`${supabaseUrl}/functions/v1/sync-municipio`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
            body: JSON.stringify({ municipio: m.nome, uf, triggered_by: `uf-batch:${batch_id || uf}` }),
          });
        } catch (e) {
          console.error(`sync-uf ${uf} ${m.nome}:`, e);
        }
      }
      // Recalculate ranking at the end
      await fetch(`${supabaseUrl}/functions/v1/calculate-ranking`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({}),
      });
    })());

    return new Response(JSON.stringify({ ok: true, uf, total, batch_id: batch_id || uf }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("sync-uf error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
