// Cache externo (Nostr primário, IPFS fallback) para histórico Overpass.
// Nunca grava no Supabase — só lê a config em external_cache_config.
// Payload comprimido com gzip + base64. Chave = sha256(scope|key|dates).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Cache-Control": "no-store",
};

const CAPITAIS = ["Rio Branco","Maceió","Macapá","Manaus","Salvador","Fortaleza","Brasília","Vitória","Goiânia","São Luís","Cuiabá","Campo Grande","Belo Horizonte","Belém","João Pessoa","Curitiba","Recife","Teresina","Rio de Janeiro","Natal","Porto Alegre","Porto Velho","Boa Vista","Florianópolis","São Paulo","Aracaju","Palmas"];
const EXTRA = ["Duque de Caxias"];

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function gzipB64(s: string): Promise<string> {
  const stream = new Blob([new TextEncoder().encode(s)]).stream().pipeThrough(new CompressionStream("gzip"));
  const buf = new Uint8Array(await new Response(stream).arrayBuffer());
  let bin = ""; for (const b of buf) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function ungzipB64(b64: string): Promise<string> {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const stream = new Blob([arr]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}

// --- Nostr ---------------------------------------------------------
async function hexToBytes(h: string): Promise<Uint8Array> {
  const a = new Uint8Array(h.length / 2);
  for (let i = 0; i < a.length; i++) a[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return a;
}

async function nostrPubkey(): Promise<string | null> {
  const sk = Deno.env.get("NOSTR_PRIVKEY_HEX");
  if (!sk) return null;
  try {
    const { schnorr } = await import("https://esm.sh/@noble/curves@1.4.0/secp256k1");
    const pub = schnorr.getPublicKey(await hexToBytes(sk));
    return Array.from(pub).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

async function nostrSign(event: any): Promise<any> {
  const sk = Deno.env.get("NOSTR_PRIVKEY_HEX");
  if (!sk) throw new Error("NOSTR_PRIVKEY_HEX ausente");
  const { schnorr } = await import("https://esm.sh/@noble/curves@1.4.0/secp256k1");
  event.pubkey = await nostrPubkey();
  const serialized = JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
  event.id = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialized))))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  const sig = schnorr.sign(await hexToBytes(event.id), await hexToBytes(sk));
  event.sig = Array.from(sig).map(b => b.toString(16).padStart(2, "0")).join("");
  return event;
}

function nostrReadOne(relays: string[], filter: any, timeoutMs = 3500): Promise<any | null> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: any) => { if (!done) { done = true; resolve(v); sockets.forEach(s => { try { s.close(); } catch {} }); } };
    const sockets: WebSocket[] = [];
    const timer = setTimeout(() => finish(null), timeoutMs);
    for (const url of relays) {
      try {
        const ws = new WebSocket(url); sockets.push(ws);
        const subId = "s" + Math.random().toString(36).slice(2, 8);
        ws.onopen = () => ws.send(JSON.stringify(["REQ", subId, filter]));
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg[0] === "EVENT" && msg[1] === subId) { clearTimeout(timer); finish(msg[2]); }
            if (msg[0] === "EOSE" && msg[1] === subId) ws.close();
          } catch {}
        };
        ws.onerror = () => {};
      } catch {}
    }
  });
}

async function nostrPublish(relays: string[], event: any, timeoutMs = 4000): Promise<boolean> {
  const results = await Promise.all(relays.map(url => new Promise<boolean>((resolve) => {
    try {
      const ws = new WebSocket(url);
      const t = setTimeout(() => { try { ws.close(); } catch {}; resolve(false); }, timeoutMs);
      ws.onopen = () => ws.send(JSON.stringify(["EVENT", event]));
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg[0] === "OK" && msg[1] === event.id) { clearTimeout(t); ws.close(); resolve(!!msg[2]); }
        } catch {}
      };
      ws.onerror = () => { clearTimeout(t); resolve(false); };
    } catch { resolve(false); }
  })));
  return results.some(Boolean);
}

// --- IPFS (leitura via gateway público) -----------------------------
async function ipfsRead(gateway: string, cid: string): Promise<string | null> {
  try {
    const r = await fetch(`${gateway.replace(/\/$/, "")}/ipfs/${cid}`);
    if (!r.ok) return null;
    return await r.text();
  } catch { return null; }
}

// --- Handler --------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const rl = await checkRateLimit(req, "history-cache", { perMinute: 20, perDay: 300 });
  if (!rl.ok) return rateLimitResponse(rl, corsHeaders);

  try {
    const { city, uf, bairro, dates } = await req.json();
    if (!city || !Array.isArray(dates) || !dates.length) {
      return new Response(JSON.stringify({ error: "city e dates[] obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: cfg } = await supa.from("external_cache_config").select("*").maybeSingle();
    const provider = cfg?.enabled ? (cfg.provider as string) : "none";
    const relays: string[] = cfg?.nostr_relays || [];
    const gateway: string = cfg?.ipfs_gateway || "https://ipfs.io";
    const extraCities: string[] = cfg?.extra_cities || [];
    const cacheable = [...CAPITAIS, ...EXTRA, ...extraCities].some(c => c.toLowerCase() === (city as string).toLowerCase());

    const cacheKey = await sha256Hex(`hist|${city}|${uf || ""}|${bairro || ""}|${dates.join(",")}`);

    // 1) Tenta ler cache
    if (cacheable && provider !== "none") {
      // Nostr
      if (provider === "nostr" || provider === "both") {
        const pk = await nostrPubkey();
        if (pk && relays.length) {
          const ev = await nostrReadOne(relays, { kinds: [30078], authors: [pk], "#d": [cacheKey], limit: 1 });
          if (ev?.content) {
            try {
              const parsed = JSON.parse(await ungzipB64(ev.content));
              return new Response(JSON.stringify({ ...parsed, cache: "nostr" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            } catch {}
          }
        }
      }
      // IPFS via gateway (CID vem do Nostr, tag ipfs)
      if (provider === "ipfs" || provider === "both") {
        const pk = await nostrPubkey();
        if (pk && relays.length) {
          const ev = await nostrReadOne(relays, { kinds: [30078], authors: [pk], "#d": [`${cacheKey}|ipfs`], limit: 1 });
          const cid = ev?.tags?.find((t: any[]) => t[0] === "ipfs")?.[1];
          if (cid) {
            const txt = await ipfsRead(gateway, cid);
            if (txt) {
              try {
                const parsed = JSON.parse(await ungzipB64(txt));
                return new Response(JSON.stringify({ ...parsed, cache: "ipfs" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              } catch {}
            }
          }
        }
      }
    }

    // 2) Miss → chama overpass-history
    const base = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const upstream = await fetch(`${base}/functions/v1/overpass-history`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${anon}`, "apikey": anon },
      body: JSON.stringify({ city, uf, bairro, dates }),
    });
    const payload = await upstream.text();
    if (!upstream.ok) return new Response(payload, { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // 3) Publica no cache (best-effort)
    if (cacheable && provider !== "none") {
      const compressed = await gzipB64(payload);
      try {
        if (provider === "nostr" || provider === "both") {
          const ev = await nostrSign({
            kind: 30078, created_at: Math.floor(Date.now() / 1000),
            tags: [["d", cacheKey], ["app", "pave-path-progress"]],
            content: compressed,
          });
          await nostrPublish(relays, ev);
        }
      } catch (e) { console.warn("nostr publish falhou", e); }
    }

    return new Response(payload, { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
