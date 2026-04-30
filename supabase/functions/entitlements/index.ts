// GreenScan — Entitlements (Supabase Edge Function · Deno)
//
// Zweck:
//   Liefert dem Client ein konsolidiertes Berechtigungs-Objekt fuer den
//   eingeloggten User. Single Source of Truth fuer "Darf der User noch
//   einen KI-Scan machen?". Eliminiert Bug B4 (manipulierbarer
//   Client-Counter im localStorage).
//
// Endpoint:
//   GET https://<project>.supabase.co/functions/v1/entitlements
//   Header: Authorization: Bearer <user-jwt>
//
// Response:
//   {
//     tier: 'free'|'plus'|'pro'|'lifetime',
//     scans_today, scans_limit, scans_remaining, can_scan,
//     ai_herbalist, recipes_export, offline_mode
//   }
//
// Setup: identisch zu ai-proxy. ANTHROPIC_API_KEY wird hier NICHT gebraucht.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// v24.13 SECURITY-FIX (D1 HIGH): CORS Origin-aware (siehe ai-proxy).
const ALLOWED_ORIGINS = ["https://greenscan.ch", "https://www.greenscan.ch"];
function corsHeaders(origin: string | null): Record<string, string> {
  let allowed = "https://greenscan.ch";
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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// Muss synchron mit ai-proxy/index.ts gehalten werden!
const TIER_LIMITS: Record<string, number> = {
  free: 5,
  plus: 200,
  pro: 2000,
  lifetime: 2000,
};

function jsonResp(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "GET") return jsonResp({ error: "Method Not Allowed" }, 405, origin);

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return jsonResp({ error: "auth required" }, 401);

  const URL = Deno.env.get("SUPABASE_URL");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL || !ANON) return jsonResp({ error: "supabase config missing" }, 503);

  const supa = createClient(URL, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userRes, error: userErr } = await supa.auth.getUser();
  const user = userRes?.user;
  if (userErr || !user) return jsonResp({ error: "invalid session" }, 401);

  // 1) Tier ermitteln
  let tier = "free";
  let aiHerbalist = false;
  let recipesExport = false;
  let offlineMode = false;
  try {
    const { data: ent } = await supa
      .from("v_user_entitlements")
      .select("tier, ai_herbalist, recipes_export, offline_mode")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ent) {
      tier = String(ent.tier || "free");
      aiHerbalist = !!ent.ai_herbalist;
      recipesExport = !!ent.recipes_export;
      offlineMode = !!ent.offline_mode;
    }
  } catch (_) {
    // View existiert evtl. noch nicht — Defaults
  }
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  // 2) Heutiger Verbrauch
  const today = new Date().toISOString().slice(0, 10);
  let used = 0;
  try {
    const { count } = await supa
      .from("ai_usage")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("day", today);
    used = count ?? 0;
  } catch (_) {
    // ai_usage existiert evtl. noch nicht
  }

  return jsonResp({
    tier,
    scans_today: used,
    scans_limit: limit,
    scans_remaining: Math.max(0, limit - used),
    can_scan: used < limit,
    ai_herbalist: aiHerbalist,
    recipes_export: recipesExport,
    offline_mode: offlineMode,
    server_time: new Date().toISOString(),
  });
});
