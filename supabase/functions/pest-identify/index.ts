// v26.19 pest-identify Edge-Fn (v2 — v26.50 ai_daily_usage Logging)
// Identifiziert Schweizer Garten-Schädlinge aus Foto + Anthropic Vision +
// plant_pests-Knowledge-Context (25 kuratierte Eintraege).
//
// POST { image_base64, media_type='image/jpeg', host_plant=null }
// → { matched_slug, confidence, reasoning, alternatives, severity, advice, pest_detail }
//
// verify_jwt: true (User-Bearer-Token erforderlich, sonst kein Anthropic-Call)
//
// v2 (v26.50): fn_log_ai_usage RPC fire-and-forget vor success-Return.
// v3 (v30.83, Audit P0-2): User-Verifikation IM CODE + Rate-Limit pro User.
//   Vorher verliess sich die Fn ausschliesslich auf das Gateway-Flag verify_jwt=true
//   und hatte KEIN Limit — jeder eingeloggte User konnte unbegrenzt teure Vision-Calls
//   ausloesen, und ein versehentliches Umstellen des Flags haette sie voellig
//   oeffentlich gemacht. Muster: plant-doctor-diagnose / garden-scan-analyze.

import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
// v33.58: kein Modellname in dieser Datei — die Rolle bestimmt die Kette (_shared/modelle.mjs).
import { anthropicFetch, modellKette, modellSecret } from "../_shared/modelle.mjs";
// v33.59 (Sicherheitspruefung 10.11.2026): das Tor vor dem KI-Aufruf — Plan vom
// Server, Tageskontingent atomar reserviert (fail-closed), Freitexte gedeckelt,
// Bildtyp aus einer Liste; nach aussen feste Saetze statt Anbieter-Rohtext.
// Die Reservierung gilt fuer den ganzen anthropicFetch — ein Modell-Rueckfall bucht nichts dazu.
import { kiEingabeOk, kiFehlerCode, kiFreigabeNoetig, kiFreigeben, kiSlugAusListe, kiToken, kiTor } from "../_shared/ki_tor.mjs";

const KI_FN = "pest-identify";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

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
  try { body = JSON.parse(roh); }
  catch (_) { return json(400, { error: "invalid json" }); }

  const imageB64: string | undefined = body?.image_base64;
  const mediaType: string = body?.media_type || "image/jpeg";
  const hostPlant: string | null = typeof body?.host_plant === "string" && body.host_plant ? body.host_plant : null;
  const TEXTE = { host_plant: hostPlant };

  if (!imageB64 || typeof imageB64 !== "string") return json(400, { error: "missing image_base64" });
  const fehler = (code: string, status: number, plan?: string) => json(status, { error: kiFehlerCode({ code, plan }).message, code });
  const deckel = kiEingabeOk(KI_FN, { bytes: roh.length, bilder: [imageB64], typen: [mediaType], texte: TEXTE });
  if (!deckel.ok) return fehler(deckel.code, deckel.status);

  // v30.83: Rate-Limit (KI-Kostenschutz) — max 30 Schaedlings-Scans/Stunde/User.
  // Fail-open: ein Fehler im Limit-Check darf den Dienst nicht blockieren.
  try {
    const { data: rlOk } = await admin.rpc("fn_check_rate_limit", { p_bucket: userId, p_action: "pest_identify", p_max_per_hour: 30 });
    if (rlOk === false) {
      return json(429, { error: "rate_limited", message: "Zu viele Schädlings-Scans in kurzer Zeit — bitte etwas später erneut." });
    }
  } catch (_) { /* fail-open */ }

  const apiKey = await getAnthropicKey(admin);
  if (!apiKey) return json(503, { error: "Anthropic API-Key nicht konfiguriert" });

  const tor = await kiTor({ fn: KI_FN, userClient: sbUser, admin, userId });
  if (!tor.erlaubt) return fehler(tor.code, tor.status, tor.plan);

  // 1) Knowledge-Inventory: passende Schaedlinge filtern
  let pestQuery = admin.from("plant_pests").select(
    "slug,common_name_de,scientific_name,category,host_plants,symptoms,identification_tips,affected_parts,size_mm,body_color"
  );
  if (hostPlant) {
    pestQuery = pestQuery.contains("host_plants", [hostPlant]);
  }
  const { data: pestsScoped } = await pestQuery.limit(30);
  let pests = pestsScoped || [];
  if (hostPlant && (!pests || pests.length === 0)) {
    const { data: all } = await admin.from("plant_pests").select(
      "slug,common_name_de,scientific_name,category,host_plants,symptoms,identification_tips,affected_parts,size_mm,body_color"
    ).limit(30);
    pests = all || [];
  }

  const knowledge = pests.map((p: any) =>
    `- ${p.slug} | ${p.common_name_de} (${p.scientific_name}, ${p.category}) | Groesse ${p.size_mm || "?"} | Farbe ${p.body_color || "?"} | befällt ${(p.affected_parts || []).join(",")} | Symptome: ${p.symptoms} | Tipps: ${p.identification_tips}`
  ).join("\n");

  const systemPrompt =
    `Du bist ein Experte fuer Schweizer Garten-Schaedlinge. Analysiere das Foto und vergleiche mit dieser Knowledge-Base (jede Zeile ein bekannter Schaedling):\n\n${knowledge}\n\nAntworte AUSSCHLIESSLICH valides JSON-Objekt in diesem Format:\n{\"matched_slug\": \"<slug aus Liste oder null>\",\n \"confidence\": <0-100>,\n \"reasoning\": \"<knapp 1-2 Saetze>\",\n \"alternative_slugs\": [\"<slug>\", \"<slug>\"],\n \"severity_observed\": \"gering|mittel|hoch\",\n \"advice\": \"<1-2 Saetze konkrete Sofort-Massnahme>\"\n}\n\nRegeln:\n- Wenn unsicher (< 50% Confidence) → matched_slug=null und Hinweise im reasoning geben.\n- alternative_slugs: max 3 plausible Kandidaten.\n- KEIN Markdown, KEIN Pre-/Post-Text, NUR das JSON-Objekt.`;

  let aiJson: any;
  try {
    const aiResp = await anthropicFetch("schnell", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        max_tokens: 800,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageB64 } },
            { type: "text", text: `Identifiziere den Schaedling auf dem Foto. Host-Pflanze (falls bekannt): ${hostPlant || "unbekannt"}.` }
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
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try {
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
  } catch (_) {
    return json(502, { error: "JSON-Parse-Fehler bei Anthropic-Antwort" });
  }

  let fullPest = null;
  // v33.59: ein Slug aus der KI gilt nur, wenn er in der geladenen Wissensbasis stand.
  parsed.matched_slug = kiSlugAusListe(parsed.matched_slug, pests);
  if (parsed.matched_slug) {
    const { data } = await admin.from("plant_pests").select("*").eq("slug", parsed.matched_slug).maybeSingle();
    fullPest = data;
  }

  // v26.50: Log usage (fire-and-forget)
  try {
    await admin.rpc('fn_log_ai_usage', {
      p_edge_fn: 'pest-identify',
      p_tokens_in: aiJson?.usage?.input_tokens || 0,
      p_tokens_out: aiJson?.usage?.output_tokens || 0,
      // v30.95: ohne p_model bucht fn_log_ai_usage 0.00 CHF (else-Zweig).
      p_model: aiJson?.model || modellKette('schnell', modellSecret('schnell'))[0],
    });
  } catch (_) { /* nicht-blockierend */ }

  return json(200, {
    matched_slug: parsed.matched_slug || null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    reasoning: parsed.reasoning || "",
    alternatives: Array.isArray(parsed.alternative_slugs) ? parsed.alternative_slugs.map((x: unknown) => kiSlugAusListe(x as string, pests)).filter(Boolean).slice(0, 3) : [],
    severity: parsed.severity_observed || null,
    advice: parsed.advice || "",
    pest_detail: fullPest,
    tokens: aiJson?.usage || null,
  });
});
