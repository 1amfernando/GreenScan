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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  const userToken = authHdr.replace(/^Bearer\s+/i, "").trim();
  if (!userToken) return json(401, { error: "unauthorized" });
  const sbUser = createClient(SUPABASE_URL, userToken, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "invalid token" });
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); }
  catch (_) { return json(400, { error: "invalid json" }); }

  const imageB64: string | undefined = body?.image_base64;
  const mediaType: string = body?.media_type || "image/jpeg";
  const hostPlant: string | null = body?.host_plant ?? null;

  if (!imageB64) return json(400, { error: "missing image_base64" });
  if (imageB64.length > 8 * 1024 * 1024) return json(413, { error: "image too large" });

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
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
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
      const errText = await aiResp.text();
      return json(aiResp.status, { error: `Anthropic ${aiResp.status}: ${errText.slice(0, 200)}` });
    }
    aiJson = await aiResp.json();
  } catch (e: any) {
    return json(502, { error: "Anthropic-Call fehlgeschlagen: " + String(e?.message || e) });
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
  if (parsed.matched_slug && typeof parsed.matched_slug === "string") {
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
      p_model: aiJson?.model || 'claude-haiku-4-5-20251001',
    });
  } catch (_) { /* nicht-blockierend */ }

  return json(200, {
    matched_slug: parsed.matched_slug || null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    reasoning: parsed.reasoning || "",
    alternatives: Array.isArray(parsed.alternative_slugs) ? parsed.alternative_slugs.slice(0, 3) : [],
    severity: parsed.severity_observed || null,
    advice: parsed.advice || "",
    pest_detail: fullPest,
    tokens: aiJson?.usage || null,
  });
});
