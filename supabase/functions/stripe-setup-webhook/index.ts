// One-shot Setup: erstellt Stripe-Webhook-Endpoint + speichert signing_secret in app_settings.
// Idempotent: existiert bereits ein Endpoint mit gleicher URL und greenscan_setup-Tag, return existing.
// v1 (2026-05-04): Cowork-erstellt via Supabase MCP — autonomer Webhook-Setup ohne Stripe-Dashboard-UI.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_SECRET = "a217d1a3674f91e99c1f66b25794f8301ae8a231a906bbe3b1cfd137b4bc061b";
const SUPABASE_PROJECT_URL = "https://vowbiueikwrauuceilhc.supabase.co";
const WEBHOOK_URL = `${SUPABASE_PROJECT_URL}/functions/v1/stripe-webhook`;
const REQUIRED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (req.headers.get("X-Admin-Secret") !== ADMIN_SECRET) return new Response("Forbidden", { status: 403 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY missing" }), { status: 503, headers: { "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, svcKey);
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  try {
    const list = await stripe.webhookEndpoints.list({ limit: 100 });
    let endpoint = list.data.find((e) => e.url === WEBHOOK_URL);
    let created = false;
    let secret: string | null = null;

    if (!endpoint) {
      const created_ep = await stripe.webhookEndpoints.create({
        url: WEBHOOK_URL,
        enabled_events: REQUIRED_EVENTS as any,
        api_version: "2024-12-18.acacia",
        description: "GreenScan Production Webhook (auto-created by stripe-setup-webhook)",
        metadata: { greenscan_setup: "1" },
      });
      endpoint = created_ep;
      created = true;
      secret = (created_ep as any).secret ?? null;
    } else {
      const { data } = await admin.from("app_settings").select("value").eq("key", "stripe_webhook_secret").maybeSingle();
      secret = data?.value ?? null;
    }

    if (created && secret) {
      await admin.from("app_settings").upsert({
        key: "stripe_webhook_secret",
        value: secret,
      }, { onConflict: "key" });
    }

    return new Response(JSON.stringify({
      ok: true,
      created,
      endpoint_id: endpoint.id,
      url: endpoint.url,
      events: endpoint.enabled_events,
      secret_stored_in_app_settings: !!secret,
      secret_preview: secret ? secret.substring(0, 12) + "…" : null,
      note: created ? "Endpoint NEW — secret stored in app_settings.stripe_webhook_secret" : "Endpoint EXISTING — if secret is null, you must rotate it manually in Stripe Dashboard",
    }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e), stack: (e as Error)?.stack }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
