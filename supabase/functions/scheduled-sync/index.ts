import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: settings } = await supabase
      .from("admin_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.auto_sync_enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const intervalMs = (settings.sync_interval_minutes || 60) * 60 * 1000;
    const ids: string[] = settings.enabled_municipios || [];

    const { data: municipios } = await supabase
      .from("municipios")
      .select("id, nome, uf, last_sync_at")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);

    const now = Date.now();
    const synced: string[] = [];

    for (const m of municipios || []) {
      const last = m.last_sync_at ? new Date(m.last_sync_at).getTime() : 0;
      if (now - last < intervalMs) continue;

      await fetch(`${supabaseUrl}/functions/v1/sync-municipio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ municipio: m.nome, uf: m.uf }),
      });
      synced.push(m.nome);
    }

    if (synced.length > 0) {
      await fetch(`${supabaseUrl}/functions/v1/calculate-ranking`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({}),
      });
    }

    return new Response(JSON.stringify({ ok: true, synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("scheduled-sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
