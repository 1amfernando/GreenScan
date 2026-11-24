// Stripe Checkout Session creator
// v10 (v33.63, 19.11.2026): EINE Fassung aus main (v33.59) und PR #329 (Auftrag P-C2). Ablauf von
//   #329, Regeln und Rand von main — beides in ../_shared/zahlung_regeln.mjs, gemessen von
//   scripts/stripe_check.js und scripts/edge/10_stripe.js:
//   • KEIN `automatic_payment_methods` mehr — den Parameter gibt es an Checkout nicht (er gehoert
//     zu PaymentIntents); Stripe lehnt ihn mit 400 `parameter_unknown` ab. Seit v8 (14.06.2026)
//     endete damit sehr wahrscheinlich JEDER Kauf mit 500 (gefolgert aus der API-Referenz, nicht
//     gegen Stripe gemessen). Die Parameter baut `checkoutParameter`, nur Namen aus
//     CHECKOUT_PARAMETER; ein fremder Name wird vor dem Aufruf abgewiesen.
//   • Was das Konto schon HAT, entscheidet der Server (`checkoutPlan`): kein zweites Abo neben
//     einem laufenden, nichts neben Lifetime. Ob ein Abo wirklich laeuft, sagt Stripe.
//   • Kennt Stripe den gemerkten Kunden nicht (geloescht, oder aus dem anderen Modus): suchen,
//     sonst EIN neuer — einmal, nicht oefter.
//   • Die Stripe-Seite in der Sprache der App (de · fr · it · en, sonst 'auto').
//   Von main bleiben: exakte Versionen, Fehler als KENNUNG (fehlerCode, nie Rohtext), Launch-Deckel
//   am PREIS mit Service-Role gezaehlt, Rueckkehr nur auf die eigenen Urspruenge (popup=1 bleibt).
// v8 (2026-06-14): automatic_payment_methods (falscher Parameter, s.o.). v6: Probezeit hoechstens 7 Tage.
// v33.59 (Sicherheitspruefung 10.11.2026): Rechnung in ../_shared/zahlung_regeln.mjs.
import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
import {
  ABO_LAEUFT, checkoutParameter, checkoutParameterFremd, checkoutPlan, fehlerCode, hatLifetime, istLaunchPreis, kundeFinden,
  launchAngebot, launchDeckel, laufendeAboIds, preisErlaubt, preisIntervall, rueckkehrAdresse, stripeKenntNicht,
} from "../_shared/zahlung_regeln.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const APP_URL = "https://green-scan.ch";
const antwort = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
// Eine Kennung (W3) — in `error` fuer die App bis v33.62 (_gsZahlungFehler), in `grund` fuer die neue.
const nein = (status: number, kennung: string) => antwort(status, { error: kennung, grund: kennung });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return nein(503, "zahlung_nicht_eingerichtet");

    // Zuerst: wer fragt? Ohne Anmeldung wird nichts gelesen und nichts angelegt.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return nein(401, "nicht_angemeldet");

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return nein(400, "anfrage_ungueltig");
    // Aus der Anfrage wird GENAU das gelesen: welches Angebot, wohin zurueck, wie lange probieren, in
    // welcher Sprache. Betrag, Waehrung, Modus, Kunde, Nutzer und `claim_launch_offer` nie.
    const { price_id, success_url, cancel_url, trial_days, locale } = body as Record<string, unknown>;
    if (typeof price_id !== "string" || !price_id) return nein(400, "unbekannter_preis");

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Nur ein Preis aus dem AKTIVEN Katalog.
    const { data: priceRow, error: priceErr } = await admin
      .from("stripe_prices")
      .select("id, active, recurring, metadata, currency")
      .eq("id", price_id)
      .eq("active", true)
      .maybeSingle();
    if (priceErr) { console.error("[stripe-checkout] stripe_prices", priceErr.message); return nein(503, "katalog_nicht_lesbar"); }
    const preis = preisErlaubt(price_id, priceRow);
    if (!preis || !preisIntervall(preis)) return nein(400, "unbekannter_preis");

    // Launch-Angebot: der SERVER entscheidet am PREIS — gezaehlt mit Service-Role.
    let launch = { erlaubt: true, launch: false, grund: "kein_launch_preis" };
    if (istLaunchPreis(preis)) {
      const { count: vergeben, error: cntErr } = await admin.from("launch_offer_usage").select("user_id", { count: "exact", head: true });
      const { data: eigene, error: ownErr } = await admin.from("launch_offer_usage").select("user_id").eq("user_id", user.id).limit(1);
      if (cntErr || ownErr) console.error("[stripe-checkout] launch_offer_usage", (cntErr || ownErr)?.message);
      launch = launchAngebot({
        preisIstLaunch: true,
        beansprucht: ownErr ? null : (eigene ?? []).length > 0,
        vergeben: cntErr ? null : vergeben,
        deckel: launchDeckel(preis),
      });
    }

    // Der Kunde und die eigenen Zeilen (stripe_customers gibt es live nicht). Ein Nein der
    // Datenbank wirft (500): ob schon ein Abo laeuft, waere sonst geraten.
    const kunde = await kundeFinden({ admin, stripe, userId: user.id });

    // Laeuft schon ein Abo? Die eigenen Zeilen nennen Kandidaten — ob es WIRKLICH laeuft, sagt Stripe.
    let aboLaeuft = false;
    if (preisIntervall(preis) !== "lifetime") {
      for (const id of laufendeAboIds(kunde.zeilen)) {
        try {
          const sub = await stripe.subscriptions.retrieve(id);
          if (ABO_LAEUFT.indexOf(sub.status) >= 0) { aboLaeuft = true; break; }
        } catch (err) {
          if (!stripeKenntNicht(err, "subscription")) throw err;   // nicht erreichbar ist nicht „laeuft nicht"
        }
      }
    }

    const plan = checkoutPlan({
      preisZeile: preis, launch, lifetime: hatLifetime(kunde.zeilen), aboLaeuft,
      wunschProbeTage: trial_days, fruehereAbos: kunde.zeilen, abfrageFehler: null,
    });
    if (!plan.ok) return nein(plan.status, plan.grund);

    let kundeId = kunde.kundeId;
    const neuerKunde = async () => (await stripe.customers.create({ email: user.email ?? undefined, metadata: { supabase_user_id: user.id } })).id;
    if (!kundeId) {
      if (kunde.sucheFehler) console.warn("[stripe-checkout] Kunde bei Stripe nicht feststellbar — ein neuer wird angelegt");
      kundeId = await neuerKunde();
    }

    const erfolgUrl = rueckkehrAdresse(success_url, `${APP_URL}/?billing=success&session_id={CHECKOUT_SESSION_ID}`);
    const abbruchUrl = rueckkehrAdresse(cancel_url, `${APP_URL}/?billing=cancel`);
    const parameter = (k: string) => checkoutParameter({
      kundeId: k, preisId: preis.id, modus: plan.modus, probeTage: plan.probeTage, userId: user.id, launch: plan.launch,
      erfolgUrl, abbruchUrl, sprache: locale,
    });
    const sitzung = (k: string) => {
      const p = parameter(k);
      const fremd = checkoutParameterFremd(p);
      if (fremd.length) throw new Error("Checkout-Parameter, die Stripe nicht kennt: " + fremd.join(", "));
      return stripe.checkout.sessions.create(p as Stripe.Checkout.SessionCreateParams);
    };

    let session;
    try {
      session = await sitzung(kundeId);
    } catch (err) {
      // Stripe kennt den GEMERKTEN Kunden nicht — suchen, sonst einen neuen anlegen. Einmal.
      if (!kunde.kundeId || !stripeKenntNicht(err, "customer")) throw err;
      const zweit = await kundeFinden({ admin, stripe, userId: user.id, ohneGemerkte: true });
      kundeId = zweit.kundeId && zweit.kundeId !== kunde.kundeId ? zweit.kundeId : await neuerKunde();
      console.warn("[stripe-checkout] Stripe kennt den gemerkten Kunden " + kunde.kundeId + " nicht — weiter mit " + kundeId);
      session = await sitzung(kundeId);
    }

    return antwort(200, {
      url: session.url,
      session_id: session.id,
      mode: plan.modus,
      payment_methods: "dashboard",
      trial_days: plan.probeTage,
    });
  } catch (e) {
    // Rohtext nur ins Protokoll — er nennt Preis-Ids und den Stripe-Modus.
    console.error("[stripe-checkout]", (e as any)?.message ?? e);
    const f = fehlerCode(e, "checkout_failed");
    return nein(f.status, f.error);
  }
});
