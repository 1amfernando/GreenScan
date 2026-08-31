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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
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
  const { data } = await sbAdmin
    .from("plant_diseases")
    .select("name, name_lat, symptoms, affects_plants, treatment, prevention")
    .limit(20);
  if (!data || !data.length) return "";
  const filtered = data.filter((d: any) => {
    if (speciesLat && Array.isArray(d.affects_plants) && d.affects_plants.some((p: string) => p.includes(speciesLat))) return true;
    if (symptoms && symptoms.length && Array.isArray(d.symptoms)) {
      const sLow = (d.symptoms as string[]).join(" ").toLowerCase();
      return symptoms.some(s => sLow.includes(s.toLowerCase()));
    }
    return false;
  });
  const top = filtered.length ? filtered.slice(0, 8) : data.slice(0, 8);
  return top.map((d: any) =>
    `- ${d.name} (${d.name_lat || "?"}): ${(d.symptoms||[]).join(", ")}. Behandlung: ${(d.treatment||"").slice(0, 200)}`
  ).join("\n");
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

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
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
  if (!r.ok) throw new Error("Anthropic " + r.status + ": " + await r.text());
  const j = await r.json();
  const txt = j?.content?.[0]?.text || "";
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Kein JSON in Antwort: " + txt.slice(0, 200));
  const parsed = JSON.parse(m[0]);
  return {
    diagnosis: parsed.diagnosis,
    treatment_plan: parsed.treatment_plan,
    tokens_in: j?.usage?.input_tokens || 0,
    tokens_out: j?.usage?.output_tokens || 0
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
    const authHdr = req.headers.get("authorization") || "";
    const userToken = authHdr.replace(/^Bearer\s+/i, "");
    if (!userToken) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: cors });

    const sbUser = createClient(SUPABASE_URL, userToken, { auth: { persistSession: false } });
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "invalid token" }), { status: 401, headers: cors });
    const userId = userData.user.id;

    const body = await req.json();
    const photoB64 = String(body.photo || "");
    const speciesLat = body.species_lat ? String(body.species_lat) : null;
    const speciesName = body.species_name ? String(body.species_name) : (body.plant_name ? String(body.plant_name) : "");
    const symptoms: string[] = Array.isArray(body.symptoms) ? body.symptoms : [];
    const userNote = String(body.user_note || "");
    const plantLocalId = body.plant_local_id ? String(body.plant_local_id) : null;
    const includeHistory = body.include_history !== false && !!plantLocalId;
    const saveHistory = body.save_history !== false;

    if (!photoB64 || photoB64.length < 100) {
      return new Response(JSON.stringify({ error: "photo (base64-jpeg) required" }), { status: 400, headers: cors });
    }

    // v29.36: Server-Rate-Limit (KI-Kostenschutz) — max 30 Diagnosen/Stunde/User. Fail-open:
    // ein Fehler im Rate-Limit-Check darf den Dienst nicht blockieren.
    try {
      const { data: rlOk } = await sbAdmin.rpc("fn_check_rate_limit", { p_bucket: userId, p_action: "plant_doctor", p_max_per_hour: 30 });
      if (rlOk === false) {
        return new Response(JSON.stringify({ error: "rate_limited", message: "Zu viele Diagnosen in kurzer Zeit — bitte etwas später erneut." }), { status: 429, headers: cors });
      }
    } catch (_) { /* fail-open */ }

    const apiKey = await getAnthropicKey();
    if (!apiKey) return new Response(JSON.stringify({ error: "Anthropic API-Key fehlt" }), { status: 503, headers: cors });

    const diseaseCtx = await loadDiseaseContext(speciesLat, symptoms);
    const historyCtx = includeHistory ? await loadHistoryContext(userId, plantLocalId) : "";

    const result = await callClaudeVision(apiKey, photoB64, speciesName, symptoms, userNote, diseaseCtx, historyCtx);

    // v26.73: AI-Usage-Logging (fire-and-forget, post-success)
    try {
      await sbAdmin.rpc("fn_log_ai_usage", {
        p_edge_fn: "plant-doctor-diagnose",
        // v30.95: ohne p_model bucht fn_log_ai_usage 0.00 CHF (else-Zweig).
        p_model: "claude-sonnet-4-20250514",
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
        model: "claude-sonnet-4-20250514",
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
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: cors });
  }
});
