// Stripe Checkout Session creator
// v9 (2026-11-11): der erste Stand mit einem Prüfstand (scripts/stripe_check.js). Gemessen an v8:
//   • `automatic_payment_methods: { enabled: true }` ging an checkout.sessions.create — den
//     Parameter gibt es dort nicht (er gehört zu PaymentIntents; Referenz gelesen am 11.11.2026).
//     Stripe lehnt Unbekanntes mit 400 ab: damit endete seit dem 14.06.2026 JEDER Kauf mit 500
//     (gefolgert, nicht gegen Stripe gemessen). „Automatisch" heisst bei Checkout:
//     `payment_method_types` weglassen — dann erscheint, was im Dashboard eingeschaltet ist und
//     zu Währung und Modus passt (Karte; TWINT bei CHF, seit dem 27.05.2026 auch im Abo).
//   • `stripe_customers` wurde gelesen und beschrieben — die Tabelle gibt es nicht. Der Fehler
//     wurde verschluckt, jeder Versuch legte einen NEUEN Stripe-Kunden an.
//   • Der Preis kam aus der Anfrage und ging ungeprüft an Stripe; war er in `stripe_prices`
//     nicht zu finden, wurde trotzdem verkauft. Jetzt nur ein AKTIVER Preis der eigenen Tabelle.
//   • Ob das Launch-Angebot noch frei ist, hing an einem Feld der Anfrage — wer es wegliess,
//     kaufte auch nach dem hundertsten Mal. Jetzt entscheidet der Preis. Und gefragt wird als
//     die PERSON: rpc/launch_offer_available rechnet mit auth.uid() und antwortet mit einem
//     Objekt (live gelesen am 11.11.2026) — v8 nahm es als „wahr" (nie ausverkauft), der erste
//     Entwurf von v9 verglich es mit `true` (immer ausverkauft: kein einziger Lifetime-Kauf).
//   • Die Stripe-Seite erscheint in der Sprache der App (de · fr · it · en), sonst in der des Browsers.
//   • success_url/cancel_url gingen ungeprüft an Stripe. Jetzt nur der eigene Ursprung.
//   • Was die Person schon HAT, entschied die App aus ihrem Gerätespeicher. Jetzt der Server:
//     kein zweites Abo neben einem laufenden (zwei Abbuchungen), nichts neben Lifetime. Ob ein
//     Abo wirklich läuft, wird bei Stripe gefragt — eine veraltete Zeile sperrt niemanden aus.
//   • Kennt Stripe den gemerkten Kunden nicht (gelöscht — oder er stammt aus dem anderen Modus,
//     Test ↔ Live), endete der Kauf mit 500 „No such customer". Jetzt: suchen, sonst neu anlegen.
//   Die Regeln stehen in ../_shared/stripe_regeln.mjs (in Node geprüft), dieser Handler ist der Rand.
// v8 (2026-06-14): keine feste Liste von Zahlungsarten mehr (damals mit dem falschen Parameter).
// v6 (2026-05-13): Probezeit höchstens 7 Tage. v5: trial_days. v4: interval/is_launch_offer.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import Stripe from "npm:stripe@17";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  ABO_LAEUFT, APP_URSPRUNG, checkoutParameter, checkoutPlan, dbMuss, hatLifetime, istLaunchAngebot, kundeFinden, laufendeAboIds,
  launchStand, preisIntervall, rueckkehrAdresse, stripeKenntNicht,
} from "../_shared/stripe_regeln.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return json(503, { error: "Stripe not configured. Set STRIPE_SECRET_KEY." });

    // Zuerst: wer fragt? Ohne Anmeldung wird nichts gelesen und nichts angelegt.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json(401, { error: "Not authenticated" });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { error: "Invalid request" });
    // Aus der Anfrage wird GENAU das gelesen: welches Angebot, wohin zurück, wie lange probieren, in
    // welcher Sprache. Betrag, Währung, Modus, Kunde und Nutzer kommen nie von dort.
    const { price_id, lookup_key, success_url, cancel_url, trial_days, locale } = body as Record<string, unknown>;

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Der Preis: aus stripe_prices, über seine Id (die App schickt sie) oder den Namen des Angebots.
    const spalten = "id, product_id, lookup_key, active, recurring, metadata, currency";
    let preis = null;
    if (typeof price_id === "string" && price_id) {
      preis = dbMuss(await admin.from("stripe_prices").select(spalten).eq("id", price_id).maybeSingle(), "stripe_prices lesen");
    } else if (typeof lookup_key === "string" && lookup_key) {
      const zeilen = dbMuss(await admin.from("stripe_prices").select(spalten).eq("lookup_key", lookup_key).eq("active", true).limit(1), "stripe_prices lesen");
      preis = zeilen && zeilen[0] ? zeilen[0] : null;
    }

    // Wer schon einmal ein Abo hatte, bekommt keine zweite Probezeit.
    const kunde = await kundeFinden({ admin, stripe, userId: user.id });
    // Das Launch-Angebot: gefragt wird als die PERSON (die Funktion rechnet mit auth.uid()).
    const stand = preis && istLaunchAngebot(preis)
      ? launchStand(dbMuss(await userClient.rpc("launch_offer_available"), "launch_offer_available fragen"))
      : "frei";

    // Läuft schon ein Abo? Die eigenen Zeilen sagen es — ob es WIRKLICH läuft, sagt Stripe. Gefragt
    // wird nur, wenn ein Abo gekauft werden soll und eine Zeile ein laufendes nennt.
    let aboLaeuft = false;
    const intervall = preis ? preisIntervall(preis) : null;
    if (intervall && intervall !== "lifetime") {
      for (const id of laufendeAboIds(kunde.zeilen)) {
        try {
          const sub = await stripe.subscriptions.retrieve(id);
          if (ABO_LAEUFT.indexOf(sub.status) >= 0) { aboLaeuft = true; break; }
        } catch (err) {
          if (!stripeKenntNicht(err, "subscription")) throw err;   // nicht erreichbar ist nicht „läuft nicht"
        }
      }
    }

    const plan = checkoutPlan({
      preisZeile: preis, wunschProbeTage: trial_days, ersterAbschluss: kunde.zeilen.length === 0, launchStand: stand,
      lifetime: hatLifetime(kunde.zeilen), aboLaeuft,
    });
    if (!plan.ok) return json(plan.status, { error: plan.text, grund: plan.grund });

    let kundeId = kunde.kundeId;
    if (!kundeId) {
      // Die Suche bei Stripe darf einen Kauf nicht verhindern — scheitert sie, entsteht ein neuer Kunde.
      if (kunde.sucheFehler) console.warn("[stripe-checkout] Kunde bei Stripe nicht feststellbar (" + kunde.sucheFehler + ") — ein neuer wird angelegt");
      const neu = await stripe.customers.create({ email: user.email ?? undefined, metadata: { supabase_user_id: user.id } });
      kundeId = neu.id;
    }

    const erfolg = rueckkehrAdresse(success_url, `${APP_URSPRUNG}/?billing=success&session_id={CHECKOUT_SESSION_ID}`);
    const abbruch = rueckkehrAdresse(cancel_url, `${APP_URSPRUNG}/?billing=cancel`);
    if (erfolg.ersetzt || abbruch.ersetzt) console.warn(`[stripe-checkout] Rückkehr-Adresse ersetzt (${erfolg.ersetzt ? erfolg.grund : abbruch.grund})`);

    const sitzung = (kunde_: string) => stripe.checkout.sessions.create(checkoutParameter({
      kundeId: kunde_, preisId: preis.id, modus: plan.modus, probeTage: plan.probeTage, userId: user.id, launch: plan.launch,
      erfolgUrl: erfolg.url, abbruchUrl: abbruch.url, sprache: locale,
    }));
    let session;
    try {
      session = await sitzung(kundeId);
    } catch (err) {
      // Stripe kennt den GEMERKTEN Kunden nicht (im Dashboard gelöscht — oder er stammt aus dem
      // anderen Modus). Dann: bei Stripe suchen, sonst einen neuen anlegen — einmal, nicht öfter.
      if (!kunde.kundeId || !stripeKenntNicht(err, "customer")) throw err;
      const zweit = await kundeFinden({ admin, stripe, userId: user.id, ohneGemerkte: true });
      if (zweit.kundeId && zweit.kundeId !== kunde.kundeId) {
        kundeId = zweit.kundeId;
      } else {
        const neu = await stripe.customers.create({ email: user.email ?? undefined, metadata: { supabase_user_id: user.id } });
        kundeId = neu.id;
      }
      console.warn("[stripe-checkout] Stripe kennt den gemerkten Kunden " + kunde.kundeId + " nicht — weiter mit " + kundeId);
      session = await sitzung(kundeId);
    }

    return json(200, {
      url: session.url,
      session_id: session.id,
      mode: plan.modus,
      payment_methods: "dashboard",
      trial_days: plan.probeTage,
    });
  } catch (e) {
    const text = String((e as { message?: string })?.message ?? e);
    console.error("[stripe-checkout] " + text);
    return json(500, { error: text });
  }
});
