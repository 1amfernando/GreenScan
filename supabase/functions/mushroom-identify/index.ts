// v26.33 mushroom-identify Edge-Fn v2 (v26.50 ai_daily_usage Logging)
// Identifiziert Schweizer Pilze (Speise + Gift) aus Foto + Anthropic Vision +
// mushroom_register-Knowledge-Context (20 Pilze, 5 toedlich, VAPKO-Klassen).
// PLUS Lookalikes-Warnung aus mushroom_lookalikes.
//
// POST { image_base64, media_type='image/jpeg', habitat_hint=null, region_slug=null }
// → { matched_slug, confidence, mushroom, edibility, safety_color,
//     safety_advice, lookalikes, vapko_required, vapko_kontrollstelle, vapko_phone }
//
// verify_jwt: true (User-Bearer-Token erforderlich)
//
// v2 (v26.50): fn_log_ai_usage RPC fire-and-forget vor success-Return.
// v3 (v30.83, Audit P0-2): User-Verifikation IM CODE + Rate-Limit pro User.
//   Vorher verliess sich die Fn ausschliesslich auf das Gateway-Flag verify_jwt=true
//   und hatte KEIN Limit — jeder eingeloggte User konnte unbegrenzt teure Vision-Calls
//   ausloesen, und ein versehentliches Umstellen des Flags haette sie voellig
//   oeffentlich gemacht. Muster: plant-doctor-diagnose / garden-scan-analyze.
//   Das Limit ist bewusst fail-open: ein Fehler im Limit-Check darf den
//   SICHERHEITSKRITISCHEN Pilz-Scanner niemals blockieren.
//
// COMPLIANCE: Diese Funktion ist Information-only, KEINE Garantie. Frontend
// MUSS prominent VAPKO-Disclaimer + bei toedlich/giftig Notfall-Hinweis 145 zeigen.

import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
// v33.58: kein Modellname in dieser Datei — die Rolle bestimmt die Kette (_shared/modelle.mjs).
import { anthropicFetch, modellKette, modellSecret } from "../_shared/modelle.mjs";
// v33.59 (Sicherheitspruefung 10.11.2026): das Tor vor dem KI-Aufruf — Plan vom
// Server, Tageskontingent atomar reserviert (fail-closed), Freitexte gedeckelt,
// Bildtyp aus einer Liste; nach aussen feste Saetze statt Anbieter-Rohtext.
// Die Reservierung gilt fuer den ganzen anthropicFetch — ein Modell-Rueckfall bucht nichts dazu.
import { kiEingabeOk, kiFehlerCode, kiFreigabeNoetig, kiFreigeben, kiSlugAusListe, kiToken, kiTor } from "../_shared/ki_tor.mjs";

const KI_FN = "mushroom-identify";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });
}

async function getAnthropicKey(admin: ReturnType<typeof createClient>): Promise<string | null> {
  const env = Deno.env.get("ANTHROPIC_API_KEY");
  if (env) return env;
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
    return data?.value || null;
  } catch (_) { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "Method Not Allowed" });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  // v30.83 SECURITY (Audit P0-2): User serverseitig verifizieren (Defense-in-Depth,
  // unabhaengig vom Gateway-Flag). Das Frontend sendet immer ein frisches User-Token
  // (_gsFreshToken), legitime Aufrufe sind daher nicht betroffen.
  const authHdr = req.headers.get("authorization") || "";
  // v33.59: getUser MIT dem Token — ohne Argument fand der Client (das Token als
  // API-Schluessel, keine Sitzung) nie einen Nutzer: jeder Aufruf 401 (vgl. B-007).
  const userToken = kiToken(authHdr);
  if (!userToken) return json(401, { error: "unauthorized" });
  // v33.58: das Token wird AUSDRUECKLICH geprueft (admin.auth.getUser(userToken)). Vorher
  // `createClient(URL, userToken).auth.getUser()` ohne Argument — neuere supabase-js-Fassungen
  // antworten darauf mit „Auth session missing". v33.59: der Nutzer-Client traegt das Token als
  // Bearer — mit ihm liest das Tor v_user_entitlements (die Sicht filtert auf auth.uid()).
  const sbUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: "Bearer " + userToken } }, auth: { persistSession: false } });
  const { data: userData, error: userErr } = await admin.auth.getUser(userToken);
  if (userErr || !userData?.user) return json(401, { error: "invalid token" });
  const userId = userData.user.id;

  let body: any;
  const roh = await req.text();
  try { body = JSON.parse(roh); } catch (_) { return json(400, { error: "invalid json" }); }
  const imageB64: string | undefined = body?.image_base64;
  const mediaType: string = body?.media_type || "image/jpeg";
  const habitatHint: string | null = typeof body?.habitat_hint === "string" && body.habitat_hint ? body.habitat_hint : null;
  const regionSlug: string | null = typeof body?.region_slug === "string" && body.region_slug ? body.region_slug : null;
  const TEXTE = { habitat_hint: habitatHint, region_slug: regionSlug };

  if (!imageB64 || typeof imageB64 !== "string") return json(400, { error: "missing image_base64" });
  const fehler = (code: string, status: number, plan?: string) => json(status, { error: kiFehlerCode({ code, plan }).message, code });
  const deckel = kiEingabeOk(KI_FN, { bytes: roh.length, bilder: [imageB64], typen: [mediaType], texte: TEXTE });
  if (!deckel.ok) return fehler(deckel.code, deckel.status);

  // v30.83: Rate-Limit (KI-Kostenschutz) — max 30 Pilz-Scans/Stunde/User.
  // Fail-open: Sicherheitskritischer Dienst darf nie an einem Limit-Fehler scheitern.
  try {
    const { data: rlOk } = await admin.rpc("fn_check_rate_limit", { p_bucket: userId, p_action: "mushroom_identify", p_max_per_hour: 30 });
    if (rlOk === false) {
      return json(429, { error: "rate_limited", message: "Zu viele Pilz-Scans in kurzer Zeit — bitte etwas später erneut." });
    }
  } catch (_) { /* fail-open */ }

  const apiKey = await getAnthropicKey(admin);
  if (!apiKey) return json(503, { error: "Anthropic API-Key nicht konfiguriert" });

  const tor = await kiTor({ fn: KI_FN, userClient: sbUser, admin, userId });
  if (!tor.erlaubt) return fehler(tor.code, tor.status, tor.plan);

  const { data: mushrooms } = await admin.from("mushroom_register")
    .select("slug,common_name_de,scientific_name,family,edibility,vapko_klasse,habitat,cap_color,cap_surface,gills_or_pores,gill_color,spore_color,stem_color,smell,identifying_features,season_months")
    .order("slug")   // v33.59: ohne Reihenfolge entschied die Speicherreihenfolge, welche Arten das Modell kennt
    .limit(200);
  const knownMushrooms = mushrooms || [];

  const knowledge = knownMushrooms.map((m: any) =>
    `- ${m.slug} | ${m.common_name_de} (${m.scientific_name}, ${m.family}) | EDIBILITY=${m.edibility} | VAPKO=${m.vapko_klasse || "?"} | Hut: ${(m.cap_color || []).join("/")} ${m.cap_surface || ""} | Lamellen/Poren: ${m.gills_or_pores || "?"}/${m.gill_color || ""} | Sporen: ${m.spore_color || "?"} | Stiel: ${m.stem_color || "?"} | Geruch: ${m.smell || "?"} | Merkmale: ${m.identifying_features || "?"} | Habitat: ${(m.habitat || []).join(", ")}`
  ).join("\n");

  const systemPrompt =
    `Du bist ein Schweizer Pilz-Experte nach VAPKO-Standard. Analysiere das Foto und vergleiche mit dieser Knowledge-Base (${knownMushrooms.length} Schweizer Pilze, darunter TOEDLICHE):\n\n${knowledge}\n\nWICHTIGE REGELN:\n- SICHERHEIT VOR PRAEZISION. Im Zweifel matched_slug=null und vapko_required=true.\n- Bei toedlich-aussehenden Verwechslungen (Knollenblaetter, Pantherpilz, Spitzgebuckelter Raukopf) immer hoechste Vorsicht.\n- Wenn confidence < 70: vapko_required=true.\n- Wenn edibility=toedlich oder giftig: safety_advice IMMER mit Notfall-Hinweis 145.\n\nAntworte AUSSCHLIESSLICH valides JSON-Objekt in diesem Format:\n{\"matched_slug\": \"<slug aus Liste oder null>\",\n \"confidence\": <0-100>,\n \"reasoning\": \"<2-3 Saetze identifizierende Merkmale>\",\n \"alternative_slugs\": [\"<slug>\"],\n \"vapko_required\": true|false,\n \"observed_features\": \"<was du siehst>\"\n}\n\nKEIN Markdown, KEIN Pre-/Post-Text, NUR das JSON.`;

  let aiJson: any;
  try {
    const aiResp = await anthropicFetch("schnell", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        max_tokens: 800,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
            { type: "text", text: `Identifiziere den Pilz. Habitat-Hinweis: ${habitatHint || "unbekannt"}. Region: ${regionSlug || "unbekannt"}. SICHERHEIT VOR PRAEZISION.` }
          ]
        }]
      })
    });
    if (!aiResp.ok) {
      console.error(KI_FN + " anthropic", aiResp.status, (await aiResp.text()).slice(0, 500));
      // v33.59: jede Ablehnung geht zurueck (der Anbieter rechnet sie nicht) — EINE Regel, kiFreigabeNoetig.
      if (kiFreigabeNoetig(aiResp)) await kiFreigeben({ fn: KI_FN, admin, userId });
      return fehler(aiResp.status === 429 ? "upstream_limit" : "upstream", 502);
    }
    aiJson = await aiResp.json();
  } catch (e: any) {
    console.error(KI_FN + " upstream", e);
    if (kiFreigabeNoetig(e)) await kiFreigeben({ fn: KI_FN, admin, userId });
    return fehler("upstream", 502);
  }

  const text = aiJson?.content?.[0]?.text || "{}";
  const m = text.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = JSON.parse(m ? m[0] : "{}"); }
  catch (_) { return json(502, { error: "JSON-Parse-Fehler bei Anthropic-Antwort" }); }

  let fullMushroom: any = null;
  let safetyRow: any = null;
  let lookalikes: any[] = [];
  // v33.59: der Slug aus der KI gilt nur, wenn er in der geladenen Liste stand — und er
  // geht nie mehr in einen .or()-Filter (Komma/Klammern erweiterten ihn), sondern in zwei .eq.
  parsed.matched_slug = kiSlugAusListe(parsed.matched_slug, knownMushrooms);
  if (parsed.matched_slug) {
    const { data: full } = await admin.from("mushroom_register").select("*").eq("slug", parsed.matched_slug).maybeSingle();
    fullMushroom = full;
    const { data: saf } = await admin.from("v_mushroom_safety").select("*").eq("slug", parsed.matched_slug).maybeSingle();
    safetyRow = saf;
    const { data: la1 } = await admin.from("mushroom_lookalikes").select("*").eq("edible_slug", parsed.matched_slug);
    const { data: la2 } = await admin.from("mushroom_lookalikes").select("*").eq("lookalike_slug", parsed.matched_slug);
    const gesehen = new Set();
    lookalikes = [...(la1 || []), ...(la2 || [])].filter((r: any) => { const k = JSON.stringify(r); if (gesehen.has(k)) return false; gesehen.add(k); return true; });
  }

  let vapkoStelle: any = null;
  if (regionSlug) {
    const { data } = await admin.from("mushroom_seasonal_patches")
      .select("vapko_kontrollstelle,vapko_phone,vapko_link")
      .contains("region_canton_codes", [regionSlug])
      .limit(1).maybeSingle();
    vapkoStelle = data;
  }
  if (!vapkoStelle) {
    const { data } = await admin.from("mushroom_seasonal_patches")
      .select("vapko_kontrollstelle,vapko_phone,vapko_link")
      .not("vapko_phone", "is", null).limit(1).maybeSingle();
    vapkoStelle = data;
  }

  const conf = typeof parsed.confidence === "number" ? parsed.confidence : 0;
  let vapkoRequired = parsed.vapko_required === true || conf < 70;
  if (fullMushroom && (fullMushroom.edibility === "toedlich" || fullMushroom.edibility === "giftig")) {
    vapkoRequired = true;
  }
  // v33.59: eine ungepruefte Essbarkeit (knowledge-bulk-gen setzt 'unbekannt') ist keine Zusage.
  if (!fullMushroom || !fullMushroom.edibility || fullMushroom.edibility === "unbekannt") vapkoRequired = true;

  // v26.50: Log usage (fire-and-forget)
  try {
    await admin.rpc('fn_log_ai_usage', {
      p_edge_fn: 'mushroom-identify',
      p_tokens_in: aiJson?.usage?.input_tokens || 0,
      p_tokens_out: aiJson?.usage?.output_tokens || 0,
      // v30.95: ohne p_model bucht fn_log_ai_usage 0.00 CHF (else-Zweig).
      p_model: aiJson?.model || modellKette('schnell', modellSecret('schnell'))[0],
    });
  } catch (_) { /* nicht-blockierend */ }

  return json(200, {
    matched_slug: parsed.matched_slug || null,
    confidence: conf,
    reasoning: parsed.reasoning || "",
    observed_features: parsed.observed_features || "",
    alternatives: Array.isArray(parsed.alternative_slugs) ? parsed.alternative_slugs.map((x: unknown) => kiSlugAusListe(x as string, knownMushrooms)).filter(Boolean).slice(0, 3) : [],
    mushroom: fullMushroom,
    edibility: fullMushroom?.edibility || null,
    safety_color: safetyRow?.safety_color || null,
    safety_advice: safetyRow?.safety_advice || null,
    lookalikes: lookalikes,
    vapko_required: vapkoRequired,
    vapko_kontrollstelle: vapkoStelle?.vapko_kontrollstelle || null,
    vapko_phone: vapkoStelle?.vapko_phone || null,
    vapko_link: vapkoStelle?.vapko_link || null,
    emergency_hint: (fullMushroom && (fullMushroom.edibility === "toedlich" || fullMushroom.edibility === "giftig"))
      ? "Bei Verzehr: Tox-Info Schweiz 145 (24/7) sofort anrufen!" : null,
    tokens: aiJson?.usage || null,
  });
});
