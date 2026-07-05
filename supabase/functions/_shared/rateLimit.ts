// Rate limiter simples baseado em tabela public.edge_rate_limits.
// Não é distribuído perfeitamente, mas suficiente para proteger cotas do Overpass.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimit {
  perMinute: number;
  perDay: number;
}

export interface RateResult {
  ok: boolean;
  retryAfter?: number;
  reason?: string;
}

function getClientKey(req: Request): string {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    // usa hash simples do token pra chave estável sem expor JWT
    let h = 5381;
    const s = auth.slice(7);
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return `u:${(h >>> 0).toString(36)}`;
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  return `ip:${ip}`;
}

export async function checkRateLimit(req: Request, fnName: string, limit: RateLimit): Promise<RateResult> {
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const client = getClientKey(req);
    const now = new Date();
    const minuteBucket = `${fnName}|${client}|m:${Math.floor(now.getTime() / 60000)}`;
    const dayBucket = `${fnName}|${client}|d:${now.toISOString().slice(0, 10)}`;

    for (const [key, cap, windowSec] of [
      [minuteBucket, limit.perMinute, 60],
      [dayBucket, limit.perDay, 86400],
    ] as const) {
      const { data } = await supa.from("edge_rate_limits").select("count").eq("key", key).maybeSingle();
      const count = (data?.count ?? 0) + 1;
      if (count > cap) {
        return { ok: false, retryAfter: windowSec, reason: `Limite ${fnName} excedido (${cap}/${windowSec === 60 ? "min" : "dia"})` };
      }
      await supa.from("edge_rate_limits").upsert({ key, count, window_start: now.toISOString(), updated_at: now.toISOString() });
    }
    return { ok: true };
  } catch (e) {
    // Fail-open pra não travar em caso de erro do DB.
    console.warn("rateLimit fail-open", e);
    return { ok: true };
  }
}

export function rateLimitResponse(r: RateResult, cors: Record<string, string>) {
  return new Response(JSON.stringify({ error: r.reason || "rate limit" }), {
    status: 429,
    headers: { ...cors, "Content-Type": "application/json", "Retry-After": String(r.retryAfter || 60) },
  });
}
