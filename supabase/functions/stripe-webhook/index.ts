// GreenScan — Stripe Webhook Receiver (Supabase Edge Function · Deno)
//
// Zweck:
//   Empfängt signierte Webhook-Events von Stripe und persistiert sie als
//   Audit-Log in `stripe_events`. Decoupelt vom restlichen Schema —
//   nachgelagerte Trigger/Views können daraus eine `subscriptions`-
//   Tabelle ableiten ohne dass diese Function direkt schreiben muss.
//
// Endpoint:
//   POST  https://<project>.supabase.co/functions/v1/stripe-webhook
//   Header: Stripe-Signature: <sig>
//
// Setup:
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_...   # (optional, für Re-Lookups)
//   In Stripe-Dashboard:
//     - Webhook hinzufügen mit URL = oben
//     - Events selektieren: checkout.session.completed,
//       customer.subscription.created/updated/deleted,
//       invoice.paid, invoice.payment_failed
//     - Signing-Secret kopieren in Supabase-Secrets
//
// Sicherheit:
//   - Stripe-Signatur wird verifiziert (HMAC-SHA256 mit Tolerance 5min)
//   - Idempotenz: event.id ist Primary Key → Replay-Attacks unmöglich
//   - Only service_role schreibt (RLS in Migration)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const TOL_SECONDS = 300;

function jsonResp(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// HMAC-SHA256 wie Stripe es spezifiziert
async function hmacHex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Stripe-Signatur-Header parsen: "t=...,v1=...,v0=..."
function parseStripeSig(header: string): { t?: string; v1: string[] } {
  const parts: Record<string, string[]> = {};
  header.split(",").forEach((p) => {
    const [k, v] = p.split("=");
    if (!k || !v) return;
    if (!parts[k]) parts[k] = [];
    parts[k].push(v);
  });
  return { t: parts.t?.[0], v1: parts.v1 || [] };
}

// Constant-Time-Compare gegen Timing-Attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verifySignature(
  payload: string,
  header: string,
  secret: string,
): Promise<boolean> {
  const { t, v1 } = parseStripeSig(header);
  if (!t || v1.length === 0) return false;
  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts)) return false;
  // Replay-Schutz
  if (Math.abs(Date.now() / 1000 - ts) > TOL_SECONDS) return false;
  const expected = await hmacHex(secret, t + "." + payload);
  return v1.some((sig) => safeEqual(sig, expected));
}

serve(async (req) => {
  if (req.method !== "POST") return jsonResp({ error: "Method Not Allowed" }, 405);

  const SUPA_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const STRIPE_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!SUPA_URL || !SERVICE) return jsonResp({ error: "supabase config missing" }, 503);
  if (!STRIPE_SECRET) return jsonResp({ error: "STRIPE_WEBHOOK_SECRET fehlt" }, 503);

  const sigHeader = req.headers.get("stripe-signature") || "";
  if (!sigHeader) return jsonResp({ error: "no signature" }, 400);

  const payload = await req.text();
  const ok = await verifySignature(payload, sigHeader, STRIPE_SECRET);
  if (!ok) return jsonResp({ error: "invalid signature" }, 401);

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResp({ error: "bad JSON" }, 400);
  }

  const eventId = event.id as string;
  const eventType = event.type as string;
  if (!eventId || !eventType) return jsonResp({ error: "missing id/type" }, 400);

  // user_id / customer_id / subscription_id aus Event extrahieren (best effort)
  const data = (event.data as { object?: Record<string, unknown> }) || {};
  const obj = data.object || {};
  const customer_id = (obj.customer as string) || null;
  const subscription_id =
    (obj.subscription as string) ||
    (obj.id && eventType.startsWith("customer.subscription.") ? (obj.id as string) : null) ||
    null;
  const meta = (obj.metadata as Record<string, string>) || {};
  // v24.13 SECURITY-FIX (D4 MEDIUM): user_id muss valides UUID sein.
  // Verhindert Injection-Versuche via Stripe-Metadata.
  const rawUserId = meta.user_id || meta.userId || "";
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const user_id = UUID_RE.test(rawUserId) ? rawUserId : null;

  const supa = createClient(SUPA_URL, SERVICE, { auth: { persistSession: false } });

  // Idempotenter Insert: ON CONFLICT DO NOTHING via upsert
  const { error: insErr } = await supa.from("stripe_events").upsert(
    {
      id: eventId,
      type: eventType,
      payload: event,
      user_id,
      customer_id,
      subscription_id,
      processed_at: new Date().toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );

  if (insErr) {
    // Trotzdem 200 zurückgeben, sonst retried Stripe ewig.
    // Owner sieht Fehler im Function-Log.
    console.error("[stripe-webhook] insert failed:", insErr.message);
    return jsonResp({ ok: false, error: insErr.message }, 200);
  }

  return jsonResp({ ok: true, id: eventId, type: eventType });
});
