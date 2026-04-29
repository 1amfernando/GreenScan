// GreenScan — Anthropic Claude Proxy (Supabase Edge Function · Deno)
//
// Zweck:
//   User muss keinen eigenen Anthropic-API-Key mehr eingeben. Der Server
//   hält den Key, validiert das User-JWT, prüft Tier-Quota und forwarded
//   den Request an api.anthropic.com.
//
// Endpoint:
//   POST  https://<project>.supabase.co/functions/v1/ai-proxy
//   Header: Authorization: Bearer <user-jwt>
//   Body:  { messages, system, max_tokens, model }
//
// Response: 1:1 von Anthropic durchgereicht (nicht streamend).
//
// Setup: siehe README.md im selben Ordner.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// CORS — wenn du strenger sein willst, ersetze "*" durch "https://greenscan.ch".
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

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

// Tier → Tageslimit (KI-Calls). Anpassen je nach Geschäftsmodell.
const TIER_LIMITS: Record<string, number> = {
  free: 5,
  plus: 200,
  pro: 2000,
  lifetime: 2000,
};

// Hard-Cap für max_tokens (verhindert teure Mega-Requests).
const MAX_TOKENS_CAP = 4096;

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return jsonResp({ error: { message: "Method Not Allowed" } }, 405);

  // 1) JWT pruefen
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResp({ error: { message: "Anmelden erforderlich." } }, 401);
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResp({ error: { message: "Server: Supabase-Config fehlt." } }, 503);
  }

  // User-Client: liest mit User-JWT, RLS aktiv (fuer getUser, Entitlements, Quota-Check)
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // Admin-Client: nur fuer Usage-Insert. Bypassed RLS. Faellt auf User-Client
  // zurueck, wenn SERVICE_ROLE-Key nicht gesetzt ist (degraded mode).
  const supaAdmin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : supa;

  const { data: userRes, error: userErr } = await supa.auth.getUser();
  const user = userRes?.user;
  if (userErr || !user) {
    return jsonResp({ error: { message: "Ungueltige Session." } }, 401);
  }

  // 2) Entitlements + Quota
  let tier = "free";
  try {
    const { data: ent } = await supa
      .from("v_user_entitlements")
      .select("tier")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ent?.tier) tier = String(ent.tier);
  } catch (_) {
    // View existiert evtl. noch nicht — Default 'free'
  }
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  const today = new Date().toISOString().slice(0, 10);
  let usedToday = 0;
  try {
    const { count } = await supa
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("day", today);
    usedToday = count ?? 0;
  } catch (_) {
    // Tabelle existiert evtl. noch nicht — wir limitieren konservativ
  }

  if (usedToday >= limit) {
    return jsonResp({
      error: {
        type: "quota_exceeded",
        message: `Tageslimit erreicht (${limit}/${limit}). Upgrade fuer mehr KI-Calls.`,
        tier,
        used: usedToday,
        limit,
      },
    }, 429);
  }

  // 3) Body validieren
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonResp({ error: { message: "Bad JSON" } }, 400);
  }

  const reqModel = typeof body.model === "string" ? body.model : "claude-sonnet-4-5";
  const model = ALLOWED_MODELS.has(reqModel) ? reqModel : "claude-sonnet-4-5";
  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 1200, 1), MAX_TOKENS_CAP);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const system = typeof body.system === "string" ? body.system : "";

  if (messages.length === 0) {
    return jsonResp({ error: { message: "messages[] required" } }, 400);
  }

  // 4) Forward an Anthropic
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) {
    return jsonResp({ error: { message: "Server: ANTHROPIC_API_KEY fehlt." } }, 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, system, messages }),
    });
  } catch (e) {
    return jsonResp({ error: { message: "Upstream-Fehler: " + (e as Error).message } }, 502);
  }

  const upstreamText = await upstream.text();

  // 5) Usage atomar tracken (best-effort, blockiert nicht die Antwort).
  if (upstream.ok) {
    let tokensIn = 0;
    let tokensOut = 0;
    try {
      const parsed = JSON.parse(upstreamText);
      tokensIn = parsed?.usage?.input_tokens ?? 0;
      tokensOut = parsed?.usage?.output_tokens ?? 0;
    } catch (_) {}
    supaAdmin.from("ai_usage").insert({
      user_id: user.id,
      day: today,
      model,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    }).then(() => {}, () => {});
  }

  // 6) 1:1 weiterleiten
  return new Response(upstreamText, {
    status: upstream.status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
