// GreenScan — Anthropic Claude Proxy (Supabase Edge Function · Deno)
//
// Zweck:
//   User muss keinen eigenen Anthropic-API-Key mehr eingeben/erhalten. Der Server
//   hält den Key, validiert das User-JWT, prüft Tier-Quota (ai_usage) und forwarded
//   den Request an api.anthropic.com. Schliesst den Kosten-Leak (Roh-Key im Browser).
//
// Endpoint: POST https://<project>.supabase.co/functions/v1/ai-proxy
//   Header: Authorization: Bearer <user-jwt>
//   Body:   { messages, system, max_tokens, model }
// Response: 1:1 von Anthropic durchgereicht (nicht streamend).
//
// v30.37 (2026-06-25): CORS-Allowlist um die KANONISCHE Domain green-scan.ch (MIT
//   Bindestrich) ergänzt — vorher nur greenscan.ch → Prod wäre CORS-geblockt.
//   Modernisiert auf Deno.serve (std/http/server serve ist deprecated).
//   Frontend ruft den Proxy hinter Feature-Flag localStorage.gs_feat_aiproxy.

import { createClient } from "jsr:@supabase/supabase-js@2";

// CORS auf vertrauenswürdige Origins beschränken. green-scan.ch (kanonisch, mit
// Bindestrich) + greenscan.ch (Alt) + *.pages.dev (CF-Previews) + localhost (Dev).
const ALLOWED_ORIGINS = [
  "https://green-scan.ch",
  "https://www.green-scan.ch",
  "https://greenscan.ch",
  "https://www.greenscan.ch",
];
function corsHeaders(origin: string | null): Record<string, string> {
  let allowed = "https://green-scan.ch"; // default = kanonische Domain
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin) || /\.pages\.dev$/.test(origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      allowed = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// Whitelist erlaubte Modelle. Verhindert, dass Clients teure Modelle erzwingen.
const ALLOWED_MODELS = new Set([
  "claude-sonnet-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-20241022",
  "claude-3-5-haiku-latest",
]);

// Tier → Tageslimit (KI-Calls). free 15 = Sync mit Frontend GS_PLANS.free.
const TIER_LIMITS: Record<string, number> = {
  free: 15,
  plus: 200,
  pro: 2000,
  lifetime: 2000,
};

const MAX_TOKENS_CAP = 4096;

function jsonResp(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return jsonResp({ error: { message: "Method Not Allowed" } }, 405, origin);

  // 1) JWT prüfen
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResp({ error: { message: "Anmelden erforderlich." } }, 401, origin);
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResp({ error: { message: "Server: Supabase-Config fehlt." } }, 503, origin);
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const supaAdmin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : supa;

  const { data: userRes, error: userErr } = await supa.auth.getUser();
  const user = userRes?.user;
  if (userErr || !user) {
    return jsonResp({ error: { message: "Ungültige Session." } }, 401, origin);
  }

  // 2) Entitlements + Quota (ai_usage, Tageszähler)
  let tier = "free";
  try {
    const { data: ent } = await supa.from("v_user_entitlements").select("tier").eq("user_id", user.id).maybeSingle();
    if (ent?.tier) tier = String(ent.tier);
  } catch (_) { /* View evtl. nicht da → free */ }
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  const today = new Date().toISOString().slice(0, 10);
  let usedToday = 0;
  try {
    const { count } = await supa.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("day", today);
    usedToday = count ?? 0;
  } catch (_) { /* Tabelle evtl. nicht da → konservativ 0 */ }

  if (usedToday >= limit) {
    return jsonResp({
      error: { type: "quota_exceeded", message: `Tageslimit erreicht (${limit}/${limit}). Upgrade für mehr KI-Calls.`, tier, used: usedToday, limit },
    }, 429, origin);
  }

  // 3) Body validieren
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResp({ error: { message: "Bad JSON" } }, 400, origin); }

  const reqModel = typeof body.model === "string" ? body.model : "claude-sonnet-4-5";
  const model = ALLOWED_MODELS.has(reqModel) ? reqModel : "claude-sonnet-4-5";
  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 1200, 1), MAX_TOKENS_CAP);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  // system kann String ODER Anthropic-Block-Array (mit cache_control) sein → beides durchreichen.
  const system = (typeof body.system === "string" || Array.isArray(body.system)) ? body.system : "";

  if (messages.length === 0) return jsonResp({ error: { message: "messages[] required" } }, 400, origin);

  // 4) Forward an Anthropic. Key aus env ODER (Fallback) aus app_settings.global_anthropic_api_key
  //    (service-role) — so braucht der Proxy KEIN manuelles Edge-Secret; der Key bleibt server-seitig.
  let ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!ANTHROPIC_API_KEY) {
    try {
      const { data: ks } = await supaAdmin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
      if (ks?.value) ANTHROPIC_API_KEY = String(ks.value);
    } catch (_) { /* best-effort */ }
  }
  if (!ANTHROPIC_API_KEY) return jsonResp({ error: { message: "Server: Anthropic-Key fehlt." } }, 503, origin);

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
  } catch (e) {
    return jsonResp({ error: { message: "Upstream-Fehler: " + (e as Error).message } }, 502, origin);
  }

  const upstreamText = await upstream.text();

  // 5) Usage tracken (best-effort, nur bei Erfolg, service-role)
  if (upstream.ok) {
    let tokensIn = 0, tokensOut = 0;
    try { const parsed = JSON.parse(upstreamText); tokensIn = parsed?.usage?.input_tokens ?? 0; tokensOut = parsed?.usage?.output_tokens ?? 0; } catch (_) {}
    supaAdmin.from("ai_usage").insert({ user_id: user.id, day: today, model, tokens_in: tokensIn, tokens_out: tokensOut }).then(() => {}, () => {});
  }

  // 6) 1:1 weiterleiten (gleiche Shape wie api.anthropic.com → Frontend-Parsing unverändert)
  return new Response(upstreamText, {
    status: upstream.status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
