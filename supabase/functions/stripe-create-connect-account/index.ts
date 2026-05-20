// v26.6 — stripe-create-connect-account
// Erstellt (oder findet) ein Stripe-Connect-Express-Konto fuer den
// eingeloggten User und liefert einen Onboarding-Link zurueck.
//
// Request: POST mit Authorization-Header (User-Bearer-Token)
// Response: { ok, account_id, onboarding_url }
//
// Deploy via: mcp__supabase__deploy_edge_function (verify_jwt: true)
// Env-Vars required: STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Cowork-Hinweis: stripe-webhook v9 muss zusaetzlich account.updated handlen
// und marketplace_sellers.status / charges_enabled / payouts_enabled syncen.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "https://esm.sh/stripe@18?target=denonext";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const stripe = new Stripe(STRIPE_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json(401, { error: "Unauthorized" });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: { user }, error: userErr } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userErr || !user) return json(401, { error: "Unauthorized" });

  try {
    // 1) Schon vorhandenen Stripe-Account-ID lookuppen
    const { data: existing } = await supabase
      .from("marketplace_sellers")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let accountId: string | undefined = existing?.stripe_account_id;

    if (!accountId) {
      // 2) Neuen Express-Account erstellen (Schweizer Konto-Defaults)
      const account = await stripe.accounts.create({
        type: "express",
        country: "CH",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: "individual",
        metadata: { gs_user_id: user.id },
      });
      accountId = account.id;

      await supabase.from("marketplace_sellers").upsert({
        user_id: user.id,
        stripe_account_id: accountId,
        country: "CH",
        default_currency: "chf",
      });
    }

    // 3) Onboarding-Link erzeugen (Express-Dashboard, ~60min TTL)
    const origin = req.headers.get("origin") || "https://green-scan.ch";
    const link = await stripe.accountLinks.create({
      account: accountId!,
      refresh_url: `${origin}/?marketplace_refresh=1`,
      return_url: `${origin}/?marketplace_done=1`,
      type: "account_onboarding",
    });

    return json(200, {
      ok: true,
      account_id: accountId,
      onboarding_url: link.url,
    });
  } catch (e) {
    const msg = (e as { message?: string })?.message ?? String(e);
    console.error("[stripe-create-connect-account]", msg);
    return json(500, { error: msg });
  }
});
