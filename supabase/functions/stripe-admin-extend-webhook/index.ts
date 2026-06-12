// stripe-admin-extend-webhook v2 — erweitert den greenscan-Webhook-Endpoint um account.* Events.
// v29 (HL#19): Admin-Secret NICHT mehr hardcodiert (war im public Repo lesbar) — zur Laufzeit aus
// app_settings.stripe_admin_secret gelesen (nur admin/service-role lesbar, nie im Repo).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const REQUIRED_EVENTS = [
  "account.updated",
  "account.application.deauthorized",
];

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: _sec } = await admin.from("app_settings").select("value").eq("key", "stripe_admin_secret").maybeSingle();
  const expectedSecret = _sec?.value || "";
  if (!expectedSecret || req.headers.get("X-Admin-Secret") !== expectedSecret) return new Response("Forbidden", { status: 403 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return new Response(JSON.stringify({ error: "No STRIPE_SECRET_KEY" }), { status: 503, headers: { "Content-Type": "application/json" } });
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  try {
    // 1) Find the GreenScan webhook endpoint
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const greenScanEndpoint = endpoints.data.find(e =>
      e.url.includes("vowbiueikwrauuceilhc.supabase.co/functions/v1/stripe-webhook")
    );

    if (!greenScanEndpoint) {
      return new Response(JSON.stringify({
        ok: false,
        error: "GreenScan webhook endpoint not found in Stripe",
        all_endpoints: endpoints.data.map(e => ({ id: e.id, url: e.url, status: e.status, events_count: e.enabled_events.length })),
      }, null, 2), { status: 404, headers: { "Content-Type": "application/json" } });
    }

    const currentEvents = greenScanEndpoint.enabled_events;
    const missingEvents = REQUIRED_EVENTS.filter(e => !currentEvents.includes(e));

    if (missingEvents.length === 0) {
      return new Response(JSON.stringify({
        ok: true,
        action: "no_change",
        endpoint_id: greenScanEndpoint.id,
        status: greenScanEndpoint.status,
        enabled_events_count: currentEvents.length,
        message: "All required events already configured",
      }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    // 2) Update endpoint with merged events
    const newEnabledEvents = Array.from(new Set([...currentEvents, ...REQUIRED_EVENTS]));
    const updated = await stripe.webhookEndpoints.update(greenScanEndpoint.id, {
      enabled_events: newEnabledEvents as any,
    });

    // 3) Check Connect status
    let connectStatus: any = null;
    try {
      const account = await stripe.accounts.retrieve();
      connectStatus = {
        platform_account_id: account.id,
        country: account.country,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        capabilities: account.capabilities,
      };
    } catch (e) {
      connectStatus = { error: String((e as any)?.message ?? e) };
    }

    return new Response(JSON.stringify({
      ok: true,
      action: "updated",
      endpoint_id: greenScanEndpoint.id,
      added_events: missingEvents,
      total_events_now: updated.enabled_events.length,
      connect_status: connectStatus,
    }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
