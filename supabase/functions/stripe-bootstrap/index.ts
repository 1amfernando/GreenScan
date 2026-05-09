// One-shot bootstrap: creates Stripe Products & Prices (idempotent) and seeds DB
// Protected by X-Admin-Secret header. Run ONCE after providing STRIPE_SECRET_KEY.
// v3 (2026-05-04): Schema-Fix für stripe_prices — lookup_key/recurring statt interval/is_launch_offer
//                  Cowork-Verify + Re-Deploy via Supabase MCP 2026-05-04.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_SECRET = "a217d1a3674f91e99c1f66b25794f8301ae8a231a906bbe3b1cfd137b4bc061b";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (req.headers.get("X-Admin-Secret") !== ADMIN_SECRET) return new Response("Forbidden", { status: 403 });

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY missing" }), { status: 503, headers: { "Content-Type": "application/json" } });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, svcKey);
  const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

  const plan = [
    { key: "plus", name: "GreenScan Plus", desc: "Unlimited Scans, Rezept-Export, Lichtmessung, Garten-Planer", tier: "plus",
      prices: [
        { lookup: "plus_monthly", amount: 390, interval: "month" },
        { lookup: "plus_yearly", amount: 3900, interval: "year" },
      ] },
    { key: "pro", name: "GreenScan Pro", desc: "Alles + KI-Heilmittel-Berater, Buch-Zitate, Familien-Konto (5 Pers.), Offline-Sync", tier: "pro",
      prices: [
        { lookup: "pro_monthly", amount: 790, interval: "month" },
        { lookup: "pro_yearly", amount: 7900, interval: "year" },
      ] },
    { key: "plus_launch", name: "GreenScan Plus — Launch Lifetime", desc: "Einmalzahlung, dauerhaft (nur erste 100 Nutzer)", tier: "plus",
      prices: [
        { lookup: "plus_launch_lifetime", amount: 190 * 24, interval: "lifetime", isLaunchOffer: true, cap: 100 },
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
      const { error: prodErr } = await admin.from("stripe_products").upsert({
        id: product.id, name: p.name, description: p.desc, active: true, tier: p.tier,
        metadata: product.metadata as any,
      });
      if (prodErr) errors.push({ stage: "product_upsert", product: product.id, error: prodErr.message });

      for (const pr of p.prices) {
        const priceList = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
        let price = priceList.data.find((x) => x.lookup_key === pr.lookup);
        if (!price) {
          if (pr.interval === "lifetime") {
            price = await stripe.prices.create({
              product: product.id,
              currency: "chf",
              unit_amount: pr.amount,
              lookup_key: pr.lookup,
              metadata: { interval: "lifetime", is_launch_offer: pr.isLaunchOffer ? "1" : "0" },
            });
          } else {
            price = await stripe.prices.create({
              product: product.id,
              currency: "chf",
              unit_amount: pr.amount,
              recurring: { interval: pr.interval as "month" | "year" },
              lookup_key: pr.lookup,
            });
          }
        }
        // Schema-korrekt: lookup_key top-level, recurring jsonb, is_launch_offer/cap in metadata
        const { error: priceErr } = await admin.from("stripe_prices").upsert({
          id: price.id,
          product_id: product.id,
          active: true,
          unit_amount: pr.amount,
          currency: "chf",
          lookup_key: pr.lookup,
          recurring: pr.interval === "lifetime" ? null : { interval: pr.interval },
          metadata: {
            interval: pr.interval,
            is_launch_offer: !!pr.isLaunchOffer,
            launch_offer_cap: pr.cap ?? null,
          },
        }, { onConflict: "id" });
        if (priceErr) errors.push({ stage: "price_upsert", price: price.id, error: priceErr.message });
        report.push({ product: product.id, price: price.id, lookup: pr.lookup, amount: pr.amount, interval: pr.interval });
      }
    } catch (e) {
      errors.push({ stage: "plan_iter", key: p.key, error: String(e) });
    }
  }

  return new Response(JSON.stringify({ ok: errors.length === 0, seeded: report, errors }, null, 2), { status: 200, headers: { "Content-Type": "application/json" } });
});
