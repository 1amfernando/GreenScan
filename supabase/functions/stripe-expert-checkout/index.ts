// v25.29 stripe-expert-checkout — One-Time Payment für Community-Experten-Verifikation
// CHF 0.50 pro Verifikation, metadata.kind/post_id/expert_id triggert stripe-webhook v7
// fee_paid_chf+at-Update auf expert_verifications.
//
// Request:
//  POST /functions/v1/stripe-expert-checkout
//  Body: { post_id: "<uuid>", expert_id: "<uuid>" }   (amount_chf wird seit v33.59 ignoriert)
//  Auth: Bearer user-token (verify_jwt: true)
//
// Response 200:
//  { ok: true, url: "https://checkout.stripe.com/...", session_id: "cs_..." }
//
// Backend macht VORHER: INSERT expert_verifications mit status='pending', fee_paid_chf=0
// (UI zeigt sofort "warte auf Zahlung").
//
// v33.59 (Sicherheitspruefung 10.11.2026): eine Zahlung ist eine ANFRAGE, kein Urteil. Bis v33.56
// setzte der Webhook nach CHF 0.50 status='verified' im Namen eines frei gewaehlten Experten —
// ohne dass der etwas geprueft hatte. Jetzt: nur der Autor des Beitrags bezahlt, nur fuer einen
// echten Experten, nie fuer sich selbst; Betrag fest; der Webhook schreibt nur die Gebuehr;
// „verified" setzt allein der Experte (RLS expert_verif_update_self). Regeln: ../_shared/zahlung_regeln.mjs.

import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
import { expertenAnfrage, EXPERTEN_GEBUEHR_RAPPEN, fehlerCode } from "../_shared/zahlung_regeln.mjs";

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

    // User aus JWT — v33.59: ueber den Admin-Client mit dem Token (die dokumentierte Form);
    // createClient(url, userToken) legte den Token in den Platz des Projekt-Schluessels.
    const { data: userData, error: userErr } = await sbAdmin.auth.getUser(userToken);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: cors });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const postId = String(body.post_id || "");
    const expertId = String(body.expert_id || "");

    if (!postId || !expertId) {
      return new Response(JSON.stringify({ error: "post_id + expert_id required" }), { status: 400, headers: cors });
    }

    // Wem gehoert der Beitrag, ist expert_id ein Experte? (Fehler gelesen, nie als „nein" geraten)
    const { data: postData, error: postErr } = await sbAdmin
      .from("social_posts")
      .select("id, user_id")
      .eq("id", postId)
      .maybeSingle();
    const { data: expertProfile, error: expErr } = await sbAdmin
      .from("profiles")
      .select("id,is_expert")
      .eq("id", expertId)
      .maybeSingle();
    if (postErr || expErr) {
      console.error("[stripe-expert-checkout]", (postErr || expErr)?.message);
      return new Response(JSON.stringify({ error: "pruefung_fehlgeschlagen" }), { status: 503, headers: cors });
    }
    const darf = expertenAnfrage({ aufrufer: userId, postAutor: postData?.user_id ?? null, expertId, expertIstExperte: expertProfile?.is_expert === true });
    if (!darf.erlaubt) {
      return new Response(JSON.stringify({ error: darf.error }), { status: darf.status, headers: cors });
    }

    // Pending-Eintrag (= Anfrage an diesen Experten) — eine vorhandene Zeile bleibt unberuehrt.
    const { error: insErr } = await sbAdmin.from("expert_verifications").upsert({
      post_id: postId,
      expert_id: expertId,
      status: "pending",
      fee_paid_chf: 0
    }, { onConflict: "post_id,expert_id", ignoreDuplicates: true });
    if (insErr) console.error("[stripe-expert-checkout] expert_verifications", insErr.message);
    const amountChf = EXPERTEN_GEBUEHR_RAPPEN / 100;   // v33.59: fest, nicht aus dem Rumpf

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
    console.error("[stripe-expert-checkout]", e?.message ?? e);
    const f = fehlerCode(e, "checkout_failed");
    return new Response(JSON.stringify({ error: f.error }), { status: f.status, headers: cors });
  }
});
