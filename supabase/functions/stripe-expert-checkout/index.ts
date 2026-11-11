// v25.29 stripe-expert-checkout — One-Time Payment für Community-Experten-Verifikation
// CHF 0.50 pro Verifikation, metadata.kind/post_id/expert_id triggert stripe-webhook v7
// fee_paid_chf+at-Update auf expert_verifications.
//
// Request:
//  POST /functions/v1/stripe-expert-checkout
//  Body: { post_id: "<uuid>", expert_id: "<uuid>", amount_chf: 0.50 (optional, default 0.50) }
//  Auth: Bearer user-token (verify_jwt: true)
//
// Response 200:
//  { ok: true, url: "https://checkout.stripe.com/...", session_id: "cs_..." }
//
// Backend macht VORHER: INSERT expert_verifications mit status='pending', fee_paid_chf=0
// (UI zeigt sofort "warte auf Zahlung") — stripe-webhook v7 setzt nach Payment auf 'verified'

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: cors });
  if (!stripeKey) return new Response(JSON.stringify({ error: "Stripe nicht konfiguriert" }), { status: 503, headers: cors });

  try {
    const authHdr = req.headers.get("authorization") || "";
    const userToken = authHdr.replace(/^Bearer\s+/i, "");
    if (!userToken) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    // User aus JWT extrahieren
    const sbUser = createClient(SUPABASE_URL, userToken, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: cors });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const postId = String(body.post_id || "");
    const expertId = String(body.expert_id || "");
    const amountChf = Math.max(0.5, Math.min(5.0, Number(body.amount_chf) || 0.5));

    if (!postId || !expertId) {
      return new Response(JSON.stringify({ error: "post_id + expert_id required" }), { status: 400, headers: cors });
    }

    // Sanity-Check: Post existiert? Expert ist tatsächlich Expert?
    const { data: postData } = await sbAdmin
      .from("social_posts")
      .select("id")
      .eq("id", postId)
      .maybeSingle();
    if (!postData) {
      return new Response(JSON.stringify({ error: "post not found" }), { status: 404, headers: cors });
    }

    const { data: expertProfile } = await sbAdmin
      .from("profiles")
      .select("id,is_expert")
      .eq("id", expertId)
      .maybeSingle();
    if (!expertProfile?.is_expert) {
      return new Response(JSON.stringify({ error: "expert_id ist nicht als Expert verifiziert" }), { status: 403, headers: cors });
    }

    // Pending-Eintrag in expert_verifications anlegen falls noch nicht existiert
    await sbAdmin.from("expert_verifications").upsert({
      post_id: postId,
      expert_id: expertId,
      status: "pending",
      fee_paid_chf: 0
    }, { onConflict: "post_id,expert_id", ignoreDuplicates: true });

    // Stripe-Checkout-Session erstellen
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "chf",
          product_data: {
            name: "Experten-Verifikation",
            description: `Verifikation für Post ${postId.slice(0, 8)}… durch Experten ${expertId.slice(0, 8)}…`
          },
          unit_amount: Math.round(amountChf * 100)
        },
        quantity: 1
      }],
      success_url: "https://green-scan.ch/?ev_payment=success",
      cancel_url: "https://green-scan.ch/?ev_payment=cancel",
      metadata: {
        kind: "expert_verification",
        supabase_user_id: userId,
        post_id: postId,
        expert_id: expertId
      }
    });

    return new Response(JSON.stringify({
      ok: true,
      url: session.url,
      session_id: session.id
    }), { headers: cors });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: cors });
  }
});
