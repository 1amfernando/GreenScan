// v25.30 plant-doctor-diagnose — Vision-AI mit plant_diseases-Knowledge-Boost
// v2 (v26.73): fn_log_ai_usage RPC für Telemetrie (Audit-Finding aus BACKEND_FRONTEND_MAP).
// v4 (v26.96): Pflanzen-Doktor v2 — speichert species_name + status='open' + followup_due_at
//              (now()+7d) und lädt optional die letzten 3 Diagnosen derselben Pflanze als
//              Verlaufs-Kontext in den System-Prompt (include_history).
// v5 (v29.36): Server-Rate-Limit (KI-Kostenschutz) — max 30 Diagnosen/Stunde/User via
//              fn_check_rate_limit. Fail-open (Rate-Limit-Fehler blockiert den Dienst nicht).
//
// Request:
//  POST /functions/v1/plant-doctor-diagnose
//  Auth: Bearer user-token
//  Body: {
//    photo: "<base64-jpeg>",
//    species_lat: "Solanum lycopersicum",  // optional
//    species_name: "Tomate",               // (alias: plant_name)
//    symptoms: ["yellow_leaves","wilting"],
//    user_note: "...",
//    plant_local_id: "plant_abc123",
//    include_history: true,                 // optional, default true wenn plant_local_id
//    save_history: true
//  }
//
// Response 200: { ok, diagnosis, treatment_plan, history_id, tokens }

import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
// v33.58: kein Modellname in dieser Datei — die Rolle bestimmt die Kette (_shared/modelle.mjs).
import { anthropicFetch, modellKette, modellSecret } from "../_shared/modelle.mjs";
// v33.59 (Sicherheitspruefung 10.11.2026): das Tor vor dem KI-Aufruf — Plan vom
// Server, Tageskontingent atomar reserviert (fail-closed), Eingabe gedeckelt
// (vorher: Foto ohne Obergrenze, Notiz/Name ungedeckelt, 30/h fail-open).
// Die Reservierung gilt fuer den ganzen anthropicFetch — ein Modell-Rueckfall bucht nichts dazu.
import { KRANKHEIT_SPALTEN, kiEingabeOk, kiFehlerCode, kiFreigabeNoetig, kiFreigeben, kiKrankheitsKontext, kiToken, kiTor } from "../_shared/ki_tor.mjs";

const KI_FN = "plant-doctor-diagnose";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function getAnthropicKey(): Promise<string | null> {
  const env = Deno.env.get("ANTHROPIC_API_KEY");
  if (env) return env;
  const { data } = await sbAdmin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
  return data?.value || null;
}

async function loadDiseaseContext(speciesLat: string | null, symptoms: string[]): Promise<string> {
  // v33.59 (Austausch-Runde, offen-b2): Live-Spaltennamen aus EINER Liste (KRANKHEIT_SPALTEN), und der
  // Fehler wird gelesen — vorher 42703, wegdestrukturiert, Kontext still leer.
  const { data, error } = await sbAdmin
    .from("plant_diseases")
    .select(KRANKHEIT_SPALTEN)
    .limit(20);
  if (error) { console.error("plant-doctor-diagnose plant_diseases", error.code, error.message); return ""; }
  return kiKrankheitsKontext(data, speciesLat, symptoms);
}

// v26.96: Verlaufs-Kontext — letzte 3 Diagnosen derselben Pflanze für den User
async function loadHistoryContext(userId: string, plantLocalId: string | null): Promise<string> {
  if (!plantLocalId) return "";
  try {
    const { data } = await sbAdmin
      .from("plant_doctor_history")
      .select("created_at, ai_diagnosis, status, followup_result")
      .eq("user_id", userId)
      .eq("plant_local_id", plantLocalId)
      .order("created_at", { ascending: false })
      .limit(3);
    if (!data || !data.length) return "";
    const lines = data.map((d: any) => {
      const dt = d.created_at ? String(d.created_at).slice(0, 10) : "?";
      const top = d.ai_diagnosis?.top || "unbekannt";
      const st = d.status || "open";
      const fu = d.followup_result ? `, Follow-up: ${d.followup_result}` : "";
      return `- ${dt}: ${top} (Status: ${st}${fu})`;
    });
    return lines.join("\n");
  } catch (_) { return ""; }
}

async function callClaudeVision(
  apiKey: string, photoB64: string, speciesName: string, symptoms: string[], userNote: string, diseaseCtx: string, historyCtx: string
) {
  const histBlock = historyCtx
    ? `\n\nBisheriger Verlauf dieser Pflanze (neueste zuerst) — berücksichtige ob es sich um dasselbe Problem handelt oder eine Besserung/Verschlechterung:\n${historyCtx}`
    : "";
  const sys = `Du bist ein erfahrener Pflanzendoktor mit Spezialisierung auf Schweizer Garten- und Hauspflanzen. Diagnostiziere anhand des Fotos + User-Beschreibung. Sei präzise und gib konkrete Handlungsempfehlungen.

Wichtig:
- Top-3 Hypothesen mit confidence (0-1) + reason
- urgency: low (Beobachten reicht) | medium (handeln in 1-2 Tagen) | high (sofort handeln)
- Behandlung in konkrete Schritte
- Wenn unklar: ehrlich sagen + Foto-Empfehlung für Folge-Diagnose
- Schweizer Bio-Garten-Methoden bevorzugen, chemische Mittel nur als letzte Option

Knowledge-Base relevanter Krankheiten:
${diseaseCtx}${histBlock}

Antwort-Format: NUR ein einzelnes JSON-Objekt mit Schema:
{
  "diagnosis": {
    "hypotheses": [{ "name": "...", "confidence": 0.78, "reason": "..." }, ...],
    "top": "<name der wahrscheinlichsten>",
    "urgency": "low|medium|high",
    "visible_symptoms": ["..."]
  },
  "treatment_plan": {
    "steps": [{ "title":"...", "description":"...", "when":"sofort|heute|diese woche", "priority":1 }],
    "natural_remedies": ["..."],
    "when_call_pro": "..."
  }
}`;

  const userMsg = `Pflanze: ${speciesName || "unbekannt"}
Symptome (User-ausgewählt): ${symptoms.join(", ") || "keine ausgewählt"}
User-Notiz: ${userNote || "keine"}

Bitte Foto analysieren und vollständige Diagnose + Behandlung im JSON-Format zurückgeben.`;

  const r = await anthropicFetch("vision", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      max_tokens: 2048,
      system: sys,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: photoB64 } },
          { type: "text", text: userMsg }
        ]
      }]
    })
  });
  // v33.59: der Rumpf des Anbieters geht ins Protokoll, nach aussen nur die Kennung.
  if (!r.ok) { console.error("plant-doctor-diagnose anthropic", r.status, (await r.text()).slice(0, 500)); throw { code: r.status === 429 ? "upstream_limit" : "upstream", status: r.status }; }
  // Ab hier hat der Anbieter gerechnet: jedes Scheitern ist „parse" und gibt das
  // Kontingent NICHT zurueck — ein kaputtes JSON laesst sich ueber die Notiz erzwingen.
  let j: any;
  try { j = await r.json(); } catch (_) { throw { code: "parse" }; }
  const ausgabe = typeof j?.content?.[0]?.text === "string" ? j.content[0].text : "";
  const m = ausgabe.match(/\{[\s\S]*\}/);
  if (!m) { console.error("plant-doctor-diagnose parse", ausgabe.slice(0, 200)); throw { code: "parse" }; }
  let parsed: any;
  try { parsed = JSON.parse(m[0]); } catch (_) { console.error("plant-doctor-diagnose parse", ausgabe.slice(0, 200)); throw { code: "parse" }; }
  return {
    diagnosis: parsed.diagnosis,
    treatment_plan: parsed.treatment_plan,
    tokens_in: j?.usage?.input_tokens || 0,
    tokens_out: j?.usage?.output_tokens || 0,
    // v33.58: das Modell, das WIRKLICH geantwortet hat — fuer die Kostenbuchung und den Verlauf.
    modell: String(j?.model || (r as any).gsModell || modellKette("vision", modellSecret("vision"))[0])
  };
}

Deno.serve(async (req: Request) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: cors });

  try {
    // v33.59: getUser MIT dem Token (vorher ohne Argument an einem Client ohne Sitzung →
    // AuthSessionMissingError → jeder Aufruf 401; vgl. marketplace-publish B-007).
    const userToken = kiToken(req.headers.get("authorization"));
    if (!userToken) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });
    // v33.58: das Token wird AUSDRUECKLICH geprueft. Vorher `createClient(URL, userToken).auth.getUser()`
    // ohne Argument — neuere supabase-js-Fassungen antworten darauf mit „Auth session missing".
    const { data: userData, error: userErr } = await sbAdmin.auth.getUser(userToken);
    if (userErr || !userData?.user) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: cors });
    const userId = userData.user.id;
    const sbUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: "Bearer " + userToken } }, auth: { persistSession: false } });
    const fehler = (code: string, status: number, plan?: string) => new Response(JSON.stringify({ error: kiFehlerCode({ code, plan }).message, code }), { status, headers: cors });

    const roh = await req.text();
    let body: any;
    try { body = JSON.parse(roh); } catch (_) { return fehler("eingabe", 400); }
    body = body || {};
    const photoB64 = typeof body.photo === "string" ? body.photo : "";
    const speciesLat = body.species_lat ? String(body.species_lat) : null;
    const speciesName = body.species_name ? String(body.species_name) : (body.plant_name ? String(body.plant_name) : "");
    const symptoms: string[] = Array.isArray(body.symptoms) ? body.symptoms.filter((x: unknown) => typeof x === "string").slice(0, 30) : [];
    const userNote = typeof body.user_note === "string" ? body.user_note : "";
    const plantLocalId = body.plant_local_id ? String(body.plant_local_id) : null;
    const includeHistory = body.include_history !== false && !!plantLocalId;
    const saveHistory = body.save_history !== false;

    if (!photoB64 || photoB64.length < 100) {
      return new Response(JSON.stringify({ error: "photo (base64-jpeg) required" }), { status: 400, headers: cors });
    }
    const deckel = kiEingabeOk("plant-doctor-diagnose", {
      bytes: roh.length, bilder: [photoB64],
      texte: { user_note: userNote, species_name: speciesName, species_lat: speciesLat, plant_local_id: plantLocalId, symptoms },
    });
    if (!deckel.ok) return fehler(deckel.code, deckel.status);

    // v29.36: Server-Rate-Limit (KI-Kostenschutz) — max 30 Diagnosen/Stunde/User. Fail-open;
    // das Tageskontingent darunter (v33.59) ist fail-closed.
    try {
      const { data: rlOk } = await sbAdmin.rpc("fn_check_rate_limit", { p_bucket: userId, p_action: "plant_doctor", p_max_per_hour: 30 });
      if (rlOk === false) {
        return new Response(JSON.stringify({ error: "rate_limited", message: "Zu viele Diagnosen in kurzer Zeit — bitte etwas später erneut." }), { status: 429, headers: cors });
      }
    } catch (_) { /* fail-open */ }

    const apiKey = await getAnthropicKey();
    if (!apiKey) return new Response(JSON.stringify({ error: "Anthropic API-Key fehlt" }), { status: 503, headers: cors });

    const tor = await kiTor({ fn: KI_FN, userClient: sbUser, admin: sbAdmin, userId });
    if (!tor.erlaubt) return fehler(tor.code, tor.status, tor.plan);

    const diseaseCtx = await loadDiseaseContext(speciesLat, symptoms);
    const historyCtx = includeHistory ? await loadHistoryContext(userId, plantLocalId) : "";

    let result;
    try {
      result = await callClaudeVision(apiKey, photoB64, speciesName, symptoms, userNote, diseaseCtx, historyCtx);
    } catch (e: any) {
      // Hat der Anbieter nicht gerechnet (Netz, jede Ablehnung), geht die Reservierung zurueck (v33.59: EINE Regel).
      if (kiFreigabeNoetig(e)) await kiFreigeben({ fn: KI_FN, admin: sbAdmin, userId });
      console.error("plant-doctor-diagnose ki", e);
      return fehler(kiFehlerCode(e && e.code ? e : "upstream").code, 502);
    }

    // v26.73: AI-Usage-Logging (fire-and-forget, post-success)
    try {
      await sbAdmin.rpc("fn_log_ai_usage", {
        p_edge_fn: "plant-doctor-diagnose",
        // v30.95: ohne p_model bucht fn_log_ai_usage 0.00 CHF (else-Zweig).
        p_model: result.modell,
        p_tokens_in: result.tokens_in,
        p_tokens_out: result.tokens_out
      });
    } catch (_) { /* nicht-blocking */ }

    let historyId: string | null = null;
    if (saveHistory) {
      // v26.96: species_name + status='open' + 7-Tage Follow-up-Fälligkeit
      const followupDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: insRow } = await sbAdmin.from("plant_doctor_history").insert({
        user_id: userId,
        plant_local_id: plantLocalId,
        species_lat: speciesLat,
        species_name: speciesName || null,
        symptoms: symptoms,
        user_note: userNote,
        ai_diagnosis: result.diagnosis,
        treatment_plan: result.treatment_plan,
        status: "open",
        followup_due_at: followupDue,
        model: result.modell,
        tokens_in: result.tokens_in,
        tokens_out: result.tokens_out
      }).select("id").single();
      historyId = insRow?.id || null;
    }

    return new Response(JSON.stringify({
      ok: true,
      diagnosis: result.diagnosis,
      treatment_plan: result.treatment_plan,
      history_id: historyId,
      tokens: { input: result.tokens_in, output: result.tokens_out }
    }), { headers: cors });
  } catch (e: any) {
    console.error("plant-doctor-diagnose", e);
    return new Response(JSON.stringify({ error: kiFehlerCode("intern").message, code: "intern" }), { status: 500, headers: cors });
  }
});
