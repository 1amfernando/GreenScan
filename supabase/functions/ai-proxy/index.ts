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

import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
// v33.59: das Tor vor dem KI-Aufruf (Kontingent, Plan, Sperre, Deckel) — eine Rechnung fuer alle sechs KI-Functions.
import { KI_GRENZEN, kiFehlerCode, kiFreigabeNoetig, kiFreigeben, kiMaxTokens, kiProxyEingabe, kiToken, kiTor } from "../_shared/ki_tor.mjs";

const KI_FN = "ai-proxy";

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
    // v32.72 (Audit A10): nicht JEDE *.pages.dev-Seite, nur die eigenen Previews.
    if (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.greenscan-app\.pages\.dev$/i.test(origin) ||
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
  "claude-sonnet-4-6",          // v32.68: erstes Modell der Frontend-Kette (_gsClaudeFallbacks) — fehlte, der Proxy stufte still auf 4-5 zurueck
  "claude-sonnet-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-20241022",
  "claude-3-5-haiku-latest",
]);

// v33.59: Tageslimits und max_tokens-Deckel stehen in _shared/ki_tor.mjs (KI_GRENZEN).

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

  // v33.59 (Sicherheitspruefung 10.11.2026): Nutzer MIT Token pruefen; Plan und
  // Sperre vom Server; Eingabe deckeln; Kontingent VOR dem Aufruf atomar
  // reservieren (fail-closed). Vorher: zaehlen → rufen → danach buchen, nicht
  // abgewartet — parallele Anfragen lasen alle denselben Stand, ein Fehler galt als 0.
  const token = kiToken(authHeader);
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: { type: "config", message: kiFehlerCode("config").message } }, 503, origin);
  const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: userRes, error: userErr } = await supa.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) {
    return jsonResp({ error: { message: "Ungültige Session." } }, 401, origin);
  }

  // 2) Body lesen und deckeln (vor der Reservierung — eine abgewiesene Eingabe kostet nichts)
  let roh = "";
  try { roh = await req.text(); } catch { return jsonResp({ error: { message: "Bad JSON" } }, 400, origin); }
  if (roh.length > KI_GRENZEN["ai-proxy"].bytes) return jsonResp({ error: { type: "zu_gross", message: kiFehlerCode("zu_gross").message } }, 413, origin);
  let body: Record<string, unknown>;
  try { body = JSON.parse(roh); } catch { return jsonResp({ error: { message: "Bad JSON" } }, 400, origin); }
  if (!body || typeof body !== "object") return jsonResp({ error: { message: "Bad JSON" } }, 400, origin);
  const pruef = kiProxyEingabe(body, roh.length);
  if (!pruef.ok) return jsonResp({ error: { type: pruef.code, message: kiFehlerCode(pruef.code).message } }, pruef.status, origin);

  // 3) Body validieren
  const reqModel = typeof body.model === "string" ? body.model : "claude-sonnet-4-5";
  const model = ALLOWED_MODELS.has(reqModel) ? reqModel : "claude-sonnet-4-5";
  const maxTokens = kiMaxTokens(KI_FN, Number(body.max_tokens) || 1200);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  // system kann String ODER Anthropic-Block-Array (mit cache_control) sein → beides durchreichen.
  const system = (typeof body.system === "string" || Array.isArray(body.system)) ? body.system : "";

  if (messages.length === 0) return jsonResp({ error: { message: "messages[] required" } }, 400, origin);

  // 3b) Tor: Plan + Sperre + Reservierung (Service-Role, atomar)
  const tor = await kiTor({ fn: KI_FN, userClient: supa, admin: supaAdmin, userId: user.id });
  if (!tor.erlaubt) {
    // v33.59: der Satz haengt vom Plan ab — kein „Upgrade" an Zahlende.
    const msg = kiFehlerCode({ code: tor.code, plan: tor.plan }).message;
    return jsonResp({ error: { type: tor.code, message: msg, tier: tor.plan, used: tor.code === "quota_exceeded" ? tor.limit : undefined, limit: tor.limit } }, tor.status, origin);
  }
  const today = new Date().toISOString().slice(0, 10);

  // 4) Forward an Anthropic. Key aus env ODER (Fallback) aus app_settings.global_anthropic_api_key
  //    (service-role) — so braucht der Proxy KEIN manuelles Edge-Secret; der Key bleibt server-seitig.
  let ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!ANTHROPIC_API_KEY) {
    try {
      const { data: ks } = await supaAdmin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
      if (ks?.value) ANTHROPIC_API_KEY = String(ks.value);
    } catch (_) { /* best-effort */ }
  }
  if (!ANTHROPIC_API_KEY) {
    await kiFreigeben({ fn: KI_FN, admin: supaAdmin, userId: user.id });
    return jsonResp({ error: { message: "Server: Anthropic-Key fehlt." } }, 503, origin);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
  } catch (e) {
    console.error("ai-proxy upstream", e);
    if (kiFreigabeNoetig(e)) await kiFreigeben({ fn: KI_FN, admin: supaAdmin, userId: user.id });
    return jsonResp({ error: { type: "upstream", message: kiFehlerCode("upstream").message } }, 502, origin);
  }

  const upstreamText = await upstream.text();

  // 5) Usage protokollieren (Service-Role, abgewartet). Das Kontingent ist schon
  //    reserviert; hat der Anbieter gar nicht gerechnet (429/5xx), geht es zurueck.
  if (upstream.ok) {
    let tokensIn = 0, tokensOut = 0;
    try { const parsed = JSON.parse(upstreamText); tokensIn = parsed?.usage?.input_tokens ?? 0; tokensOut = parsed?.usage?.output_tokens ?? 0; } catch (_) {}
    const { error: logErr } = await supaAdmin.from("ai_usage").insert({ user_id: user.id, day: today, model, tokens_in: tokensIn, tokens_out: tokensOut });
    if (logErr) console.error("ai-proxy ai_usage", logErr);
  } else {
    // Jede Ablehnung zurueck: der Anbieter rechnet sie nicht, und der Client probiert bei
    // 404 („Modell unbekannt") das naechste Modell — sonst kostete EIN Aufruf bis zu vier.
    // Dieselbe Regel wie die fuenf Bild-/Plan-Functions (kiFreigabeNoetig, v33.59).
    if (kiFreigabeNoetig(upstream)) await kiFreigeben({ fn: KI_FN, admin: supaAdmin, userId: user.id });
  }

  // 6) 1:1 weiterleiten (gleiche Shape wie api.anthropic.com → Frontend-Parsing unverändert)
  return new Response(upstreamText, {
    status: upstream.status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
