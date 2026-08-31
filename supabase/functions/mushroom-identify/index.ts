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
  const userToken = authHdr.replace(/^Bearer\s+/i, "").trim();
  if (!userToken) return json(401, { error: "unauthorized" });
  const sbUser = createClient(SUPABASE_URL, userToken, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await sbUser.auth.getUser();
  if (userErr || !userData?.user) return json(401, { error: "invalid token" });
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch (_) { return json(400, { error: "invalid json" }); }
  const imageB64: string | undefined = body?.image_base64;
  const mediaType: string = body?.media_type || "image/jpeg";
  const habitatHint: string | null = body?.habitat_hint ?? null;
  const regionSlug: string | null = body?.region_slug ?? null;

  if (!imageB64) return json(400, { error: "missing image_base64" });
  if (imageB64.length > 8 * 1024 * 1024) return json(413, { error: "image too large" });

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

  const { data: mushrooms } = await admin.from("mushroom_register")
    .select("slug,common_name_de,scientific_name,family,edibility,vapko_klasse,habitat,cap_color,cap_surface,gills_or_pores,gill_color,spore_color,stem_color,smell,identifying_features,season_months")
    .limit(50);
  const knownMushrooms = mushrooms || [];

  const knowledge = knownMushrooms.map((m: any) =>
    `- ${m.slug} | ${m.common_name_de} (${m.scientific_name}, ${m.family}) | EDIBILITY=${m.edibility} | VAPKO=${m.vapko_klasse || "?"} | Hut: ${(m.cap_color || []).join("/")} ${m.cap_surface || ""} | Lamellen/Poren: ${m.gills_or_pores || "?"}/${m.gill_color || ""} | Sporen: ${m.spore_color || "?"} | Stiel: ${m.stem_color || "?"} | Geruch: ${m.smell || "?"} | Merkmale: ${m.identifying_features || "?"} | Habitat: ${(m.habitat || []).join(", ")}`
  ).join("\n");

  const systemPrompt =
    `Du bist ein Schweizer Pilz-Experte nach VAPKO-Standard. Analysiere das Foto und vergleiche mit dieser Knowledge-Base (20 bekannte Schweizer Pilze inkl. 5 TOEDLICHE):\n\n${knowledge}\n\nWICHTIGE REGELN:\n- SICHERHEIT VOR PRAEZISION. Im Zweifel matched_slug=null und vapko_required=true.\n- Bei toedlich-aussehenden Verwechslungen (Knollenblaetter, Pantherpilz, Spitzgebuckelter Raukopf) immer hoechste Vorsicht.\n- Wenn confidence < 70: vapko_required=true.\n- Wenn edibility=toedlich oder giftig: safety_advice IMMER mit Notfall-Hinweis 145.\n\nAntworte AUSSCHLIESSLICH valides JSON-Objekt in diesem Format:\n{\"matched_slug\": \"<slug aus Liste oder null>\",\n \"confidence\": <0-100>,\n \"reasoning\": \"<2-3 Saetze identifizierende Merkmale>\",\n \"alternative_slugs\": [\"<slug>\"],\n \"vapko_required\": true|false,\n \"observed_features\": \"<was du siehst>\"\n}\n\nKEIN Markdown, KEIN Pre-/Post-Text, NUR das JSON.`;

  let aiJson: any;
  try {
    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
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
      const errText = await aiResp.text();
      return json(aiResp.status, { error: `Anthropic ${aiResp.status}: ${errText.slice(0, 200)}` });
    }
    aiJson = await aiResp.json();
  } catch (e: any) {
    return json(502, { error: "Anthropic-Call fehlgeschlagen: " + String(e?.message || e) });
  }

  const text = aiJson?.content?.[0]?.text || "{}";
  const m = text.match(/\{[\s\S]*\}/);
  let parsed: any = {};
  try { parsed = JSON.parse(m ? m[0] : "{}"); }
  catch (_) { return json(502, { error: "JSON-Parse-Fehler bei Anthropic-Antwort" }); }

  let fullMushroom: any = null;
  let safetyRow: any = null;
  let lookalikes: any[] = [];
  if (parsed.matched_slug && typeof parsed.matched_slug === "string") {
    const { data: full } = await admin.from("mushroom_register").select("*").eq("slug", parsed.matched_slug).maybeSingle();
    fullMushroom = full;
    const { data: saf } = await admin.from("v_mushroom_safety").select("*").eq("slug", parsed.matched_slug).maybeSingle();
    safetyRow = saf;
    const { data: la1 } = await admin.from("mushroom_lookalikes")
      .select("*")
      .or(`edible_slug.eq.${parsed.matched_slug},lookalike_slug.eq.${parsed.matched_slug}`);
    lookalikes = la1 || [];
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

  // v26.50: Log usage (fire-and-forget)
  try {
    await admin.rpc('fn_log_ai_usage', {
      p_edge_fn: 'mushroom-identify',
      p_tokens_in: aiJson?.usage?.input_tokens || 0,
      p_tokens_out: aiJson?.usage?.output_tokens || 0,
      // v30.95: ohne p_model bucht fn_log_ai_usage 0.00 CHF (else-Zweig).
      p_model: aiJson?.model || 'claude-haiku-4-5-20251001',
    });
  } catch (_) { /* nicht-blockierend */ }

  return json(200, {
    matched_slug: parsed.matched_slug || null,
    confidence: conf,
    reasoning: parsed.reasoning || "",
    observed_features: parsed.observed_features || "",
    alternatives: Array.isArray(parsed.alternative_slugs) ? parsed.alternative_slugs.slice(0, 3) : [],
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
