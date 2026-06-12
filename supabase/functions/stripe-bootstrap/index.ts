// stripe-bootstrap v6 (2026-05-14): nur noch Pro + Pro Lifetime (Plus-Plaene entfernt).
// v29 (HL#19): Admin-Secret NICHT mehr hardcodiert (war im public Repo lesbar) — zur Laufzeit aus
// app_settings.stripe_admin_secret gelesen (nur admin/service-role lesbar, nie im Repo).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, svcKey);
  // v29 (HL#19): Admin-Secret aus app_settings.
  const { data: _sec } = await admin.from("app_settings").select("value").eq("key", "stripe_admin_secret").maybeSingle();
  const expectedSecret = _sec?.value || "";
  if (!expectedSecret || req.headers.get("X-Admin-Secret") !== expectedSecret) return new Response("Forbidden", { status: 403 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY missing" }), { status: 503, headers: { "Content-Type": "application/json" } });

  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  // v5: nur noch Pro (all-in-one) + Pro Lifetime (Launch). Plus-Plaene gestrichen.
  const plan = [
    { key: "pro", name: "GreenScan Pro", desc: "All-in-one: Unlimited Scans, KI-Pflanzendoktor, Buch-Zitate, Familien-Konto (5 Pers.), Offline-Sync, Garten-Planer, Werbefrei", tier: "pro",
      prices: [
        { lookup: "pro_monthly", amount: 790, interval: "month" },
        { lookup: "pro_yearly", amount: 7900, interval: "year" },
      ] },
    { key: "pro_launch", name: "GreenScan Pro Lifetime", desc: "Einmalzahlung, dauerhaft (nur erste 100 Nutzer)", tier: "pro",
      prices: [
        { lookup: "pro_lifetime", amount: 4560, interval: "lifetime", isLaunchOffer: true, cap: 100 },
      ] },
  ];

  const report: any[] = [];
  const errors: any[] = [];

  for (const p of plan) {
    try {
      const list = await stripe.products.list({ limit: 100, active: true });
      let product = list.data.find((x) => x.metadata?.greenscan_key === p.key);
      if (!product) {
        product = await stripe.products.create({
          name: p.name,
          description: p.desc,
          metadata: { greenscan_key: p.key, tier: p.tier },
        });
      }
      await admin.from("stripe_products").upsert({
        id: product.id, name: p.name, tier: p.tier,
        metadata: product.metadata as any, active: true
      });

      for (const pr of p.prices) {
        const priceList = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
        let price = priceList.data.find((x) => x.lookup_key === pr.lookup);
        if (!price) {
          if (pr.interval === "lifetime") {
            price = await stripe.prices.create({
              product: product.id, currency: "chf", unit_amount: pr.amount, lookup_key: pr.lookup,
              metadata: { interval: "lifetime", is_launch_offer: pr.isLaunchOffer ? "1" : "0" },
            });
          } else {
            price = await stripe.prices.create({
              product: product.id, currency: "chf", unit_amount: pr.amount,
              recurring: { interval: pr.interval as "month" | "year" }, lookup_key: pr.lookup,
            });
          }
        }
        await admin.from("stripe_prices").upsert({
          id: price.id, product_id: product.id, active: true,
          unit_amount: pr.amount, currency: "chf", lookup_key: pr.lookup,
          recurring: pr.interval === "lifetime" ? null : { interval: pr.interval },
          metadata: {
            lookup_key: pr.lookup, interval: pr.interval,
            is_launch_offer: !!pr.isLaunchOffer,
            launch_offer_cap: pr.cap ?? null,
          },
        }, { onConflict: "id" });
        report.push({ product: product.id, price: price.id, lookup: pr.lookup, amount: pr.amount, interval: pr.interval });
      }
    } catch (e) {
      errors.push({ stage: "plan_iter", key: p.key, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: errors.length === 0, seeded: report, errors }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
});
