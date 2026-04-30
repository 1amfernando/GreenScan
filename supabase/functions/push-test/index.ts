// GreenScan — Push Test (Supabase Edge Function · Deno)
//
// Zweck:
//   GET  ?vapid=1                 → liefert den VAPID-Public-Key zurueck
//                                   (vom Client beim subscribe() gebraucht)
//   POST { payload?: {...} }      → schickt eine sofortige Test-Push an alle
//                                   aktiven Subscriptions des authentifizierten
//                                   Users. payload optional — sonst Default.
//
// Setup: ANTHROPIC_API_KEY ist NICHT noetig. Stattdessen:
//   supabase secrets set VAPID_PUBLIC_KEY=<base64url>
//   supabase secrets set VAPID_PRIVATE_KEY=<base64url>
//   supabase secrets set VAPID_SUBJECT='mailto:info@greenscan.ch'
//
// VAPID-Keys generieren: `npx web-push generate-vapid-keys`

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import webpush from "npm:web-push@3.6.7";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const VAPID_PUB = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const VAPID_PRIV = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const VAPID_SUB = Deno.env.get("VAPID_SUBJECT") || "mailto:info@greenscan.ch";

  // GET ?vapid=1 → Public-Key fuer Client
  if (req.method === "GET") {
    const url = new URL(req.url);
    if (url.searchParams.get("vapid") === "1") {
      if (!VAPID_PUB) return jsonResp({ error: "VAPID nicht konfiguriert" }, 503);
      return jsonResp({ vapid_public: VAPID_PUB });
    }
    return jsonResp({ error: "Method Not Allowed" }, 405);
  }

  if (req.method !== "POST") return jsonResp({ error: "Method Not Allowed" }, 405);

  if (!VAPID_PUB || !VAPID_PRIV) {
    return jsonResp({ error: "VAPID-Keys nicht konfiguriert" }, 503);
  }

  // Auth
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return jsonResp({ error: "auth required" }, 401);
  const URL_ = Deno.env.get("SUPABASE_URL");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  if (!URL_ || !ANON) return jsonResp({ error: "supabase config missing" }, 503);
  const supa = createClient(URL_, ANON, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userRes } = await supa.auth.getUser();
  const user = userRes?.user;
  if (!user) return jsonResp({ error: "invalid session" }, 401);

  // Body
  let body: { payload?: Record<string, unknown> } = {};
  try { body = await req.json(); } catch { /* leer ok */ }
  const payload = body.payload ?? {
    title: "🌿 GreenScan Test",
    body: "Test-Push erfolgreich!",
    tag: "gs-test",
    icon: "./icons/icon-192.png",
  };

  // Subscriptions des Users laden
  const { data: subs, error: subsErr } = await supa
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, enabled")
    .eq("user_id", user.id)
    .eq("enabled", true);
  if (subsErr) return jsonResp({ error: subsErr.message }, 500);
  if (!subs || subs.length === 0) {
    return jsonResp({ error: "no subscriptions", message: "Keine aktive Push-Subscription. Erst subscribe() aufrufen." }, 404);
  }

  webpush.setVapidDetails(VAPID_SUB, VAPID_PUB, VAPID_PRIV);

  const results = await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth },
        },
        JSON.stringify(payload),
      );
      return { id: s.id, ok: true };
    } catch (e) {
      const errAny = e as { statusCode?: number; message?: string };
      // 404/410 = endpoint tot → deaktivieren
      if (errAny.statusCode === 404 || errAny.statusCode === 410) {
        await supa.from("push_subscriptions").update({ enabled: false, last_error_at: new Date().toISOString() }).eq("id", s.id);
      }
      return { id: s.id, ok: false, status: errAny.statusCode, error: errAny.message };
    }
  }));

  return jsonResp({ ok: true, sent: results.filter(r => r.ok).length, total: subs.length, results });
});
