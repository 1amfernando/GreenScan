// ══════════════════════════════════════════════════════════════════════════
// SPIEGEL — wortgetreu aus der laufenden Auslieferung gezogen am 02.09.2026
// (v32.19) über die Supabase-Verwaltungsschnittstelle.
// version 4 · verify_jwt=true · ezbr_sha256 d46f3dc6…
//
// Diese Funktion war ausgeliefert und wird vom Frontend benutzt, hatte aber
// keinen Quelltext im Repo. Herkunft und Datum stehen hier, damit jede spätere
// Sitzung nachprüfen kann, ob der Spiegel noch stimmt (neu ziehen und
// vergleichen). Keine Überarbeitung.
// v33.59: ÜBERARBEITET (Sicherheitspruefung 10.11.2026: Tor, Deckel, feste Fehlersaetze) —
// der Spiegel gilt seither nicht mehr wortgetreu; Vergleich mit der Auslieferung nach dem Deploy.
// ══════════════════════════════════════════════════════════════════════════
// plan-iterate v3 (v26.50 ai_daily_usage Logging) — v2-base + RPC-Log vor success-Return.
// Region-aware: liest scan_input.region_used aus garden_plans, lädt regional_garden_calendars als Constraint.
import "jsr:@supabase/functions-js@2.119.0/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
// v33.59 (Sicherheitspruefung 10.11.2026): das Tor vor dem KI-Aufruf. Vorher gab es
// keine Bremse ausser iterations.length — eine Spalte, die der Besitzer selbst
// schreibt (garden_plans_owner_all); jeder neue Plan setzte sie ohnehin auf 0.
import { kiEingabeOk, kiFehlerCode, kiFreigabeNoetig, kiFreigeben, kiToken, kiTor } from "../_shared/ki_tor.mjs";

const KI_FN = "plan-iterate";
// plan: der Satz am Limit haengt vom Plan ab (v33.59 — kein Abo-Angebot an Zahlende).
function fehler(code: string, status: number, plan?: string) {
  return new Response(JSON.stringify({ error: kiFehlerCode({ code, plan }) }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_ITERATIONS = 5;

async function getAnthropicKey(admin: any): Promise<string | null> {
  const fromEnv = Deno.env.get("ANTHROPIC_API_KEY");
  if (fromEnv) return fromEnv;
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
    return data?.value ?? null;
  } catch (_) { return null; }
}

function buildSystemPrompt(regionalContext: any | null): string {
  let regionalSection = "";
  if (regionalContext) {
    regionalSection = `\n\n## REGIONAL-CONTEXT (Schweizer Standort des Users)\nRegion: ${regionalContext.region_name} (${regionalContext.canton_codes?.join(",")})\nKlimazone: ${regionalContext.climate_zone}, Höhe ${regionalContext.altitude_m_min}-${regionalContext.altitude_m_max}m\nLetzter Frost Ø: ${regionalContext.last_frost_avg}\nErster Frost Ø: ${regionalContext.first_frost_avg}\nWachstumstage: ${regionalContext.growing_season_days}\nBeste Gemüse für diese Region: ${(regionalContext.best_vegetables || []).join(", ")}\nHerausfordernde Pflanzen: ${(regionalContext.challenging_plants || []).join(", ")}\n\nBerücksichtige diese regionalen Constraints in deinem Diff-Plan.`;
  }

  return `Du bist GreenScan-KI-Gartenplaner und iterierst einen bestehenden Plan basierend auf User-Wunsch.${regionalSection}\n\nWICHTIG: Antworte NUR mit gültigem JSON nach dem gleichen Schema wie der ursprüngliche Plan. Behalte alle nicht-betroffenen Pflanzen unverändert. Ändere nur was der User wünscht. Erkläre kurz im Feld \"change_summary\" was du geändert hast.\n\nSchema-Erweiterung: zusätzlich zum normalen Plan-JSON ein Top-Level-Feld \"change_summary\": \"<Text>\" mit max 200 Zeichen.\n\nKEINE Markdown-Code-Blöcke, KEIN Vor-/Nachtext.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const token = kiToken(req.headers.get("Authorization"));
    if (!token) return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: "Bearer " + token } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, svcKey);
    const apiKey = await getAnthropicKey(admin);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Anthropic API key not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const roh = await req.text();
    let eingabe: any = null;
    try { eingabe = JSON.parse(roh); } catch (_) { return fehler("eingabe", 400); }
    const plan_id = eingabe?.plan_id, user_message = eingabe?.user_message;
    if (typeof plan_id !== "string" || !plan_id || typeof user_message !== "string" || !user_message.trim()) {
      return new Response(JSON.stringify({ error: "plan_id and user_message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: plan, error: loadErr } = await admin
      .from("garden_plans")
      .select("id, user_id, ai_analysis, iterations, scan_input")
      .eq("id", plan_id)
      .maybeSingle();
    if (loadErr || !plan) {
      return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (plan.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const iterations = (Array.isArray(plan.iterations) ? plan.iterations : []) as any[];
    if (iterations.length >= MAX_ITERATIONS) {
      return new Response(JSON.stringify({ error: `Iteration limit reached (${MAX_ITERATIONS})` }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // v33.59: Deckel (Wunsch UND der Plan, den der Besitzer frei schreiben kann), dann
    // das Tageskontingent — atomar reserviert, fail-closed. Erst danach kostet es etwas.
    const deckel = kiEingabeOk("plan-iterate", { bytes: roh.length, texte: { user_message, ai_analysis: plan.ai_analysis } });
    if (!deckel.ok) return fehler(deckel.code, deckel.status);
    const tor = await kiTor({ fn: KI_FN, userClient, admin, userId: user.id });
    if (!tor.erlaubt) return fehler(tor.code, tor.status, tor.plan);

    let regionalContext: any | null = null;
    const regionSlug = (plan.scan_input as any)?.region_used;
    if (regionSlug && typeof regionSlug === "string") {
      const { data: regionData } = await admin
        .from("regional_garden_calendars")
        .select("*")
        .eq("slug", regionSlug)
        .maybeSingle();
      if (regionData) regionalContext = regionData;
    }

    const messages: any[] = [
      {
        role: "user",
        content: `Aktueller Plan:\n${JSON.stringify(plan.ai_analysis, null, 2)}\n\nMein Wunsch:\n${user_message}\n\nGib den geänderten Plan zurück (gleiche Struktur, nur Änderungen wo nötig). Plus change_summary.`,
      },
    ];

    // v32.72 (Audit B2): der Client wartete 60 s (Garten-Scan) bzw. 30 s (Plan-Chat), der
    // Server rechnete bis 8000 Tokens ohne Abbruch weiter und speicherte den Plan trotzdem —
    // der Nutzer sah „Zeitueberschreitung", startete neu, zahlte doppelt und hatte zwei Plaene.
    // Jetzt bricht der Server nach 110 s ab (Edge-Function-Limit 150 s), der Client wartet 120 s.
    let anthropicRes: Response;
    try {
      anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: AbortSignal.timeout(110_000),
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8000,
        system: buildSystemPrompt(regionalContext),
        messages,
      }),
    });
    } catch (e) {
      const zuLang = e && (e.name === "TimeoutError" || e.name === "AbortError");
      console.error("plan-iterate upstream", e);
      if (kiFreigabeNoetig(e)) await kiFreigeben({ fn: KI_FN, admin, userId: user.id });
      return new Response(JSON.stringify({ error: zuLang ? { code: "timeout", message: "Die KI hat nicht innert 110 Sekunden geantwortet. Nichts wurde gespeichert — bitte erneut versuchen." } : kiFehlerCode("upstream") }), { status: zuLang ? 504 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!anthropicRes.ok) {
      console.error("plan-iterate anthropic", anthropicRes.status, (await anthropicRes.text()).slice(0, 500));
      // v33.59: jede Ablehnung geht zurueck (der Anbieter rechnet sie nicht) — EINE Regel, kiFreigabeNoetig.
      if (kiFreigabeNoetig(anthropicRes)) await kiFreigeben({ fn: KI_FN, admin, userId: user.id });
      return fehler(anthropicRes.status === 429 ? "upstream_limit" : "upstream", 502);
    }

    const anthropicData = await anthropicRes.json();
    const rawText = anthropicData.content?.[0]?.text || "";

    let newAnalysis: any = null;
    let changeSummary: string = "";
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/, "").replace(/\s*```\s*$/, "").trim();
      newAnalysis = JSON.parse(cleaned);
      changeSummary = newAnalysis.change_summary || "";
      delete newAnalysis.change_summary;
    } catch (parseErr) {
      console.error("plan-iterate parse", rawText.slice(0, 800));
      return fehler("parse", 502);
    }

    const newIteration = {
      ts: new Date().toISOString(),
      user_message,
      change_summary: changeSummary,
      tokens: anthropicData.usage,
      region_used: regionSlug || null,
    };
    const updatedIterations = [...iterations, newIteration];

    const { error: updateErr } = await admin
      .from("garden_plans")
      .update({
        ai_analysis: newAnalysis,
        iterations: updatedIterations,
        updated_at: new Date().toISOString(),
      })
      .eq("id", plan_id);

    if (updateErr) {
      console.error("plan-iterate update", updateErr);
      return fehler("db", 500);
    }

    // v26.50: Log usage (fire-and-forget) — Sonnet-Modell
    try {
      await admin.rpc("fn_log_ai_usage", {
        p_edge_fn: "plan-iterate",
        // v33.59: ohne p_model bucht fn_log_ai_usage 0.00 CHF (else-Zweig, vgl. v30.95).
        p_model: anthropicData?.model || "claude-sonnet-4-20250514",
        p_tokens_in: anthropicData?.usage?.input_tokens || 0,
        p_tokens_out: anthropicData?.usage?.output_tokens || 0,
      });
    } catch (_) { /* nicht-blockierend */ }

    return new Response(JSON.stringify({
      ok: true,
      plan_id,
      analysis: newAnalysis,
      change_summary: changeSummary,
      iteration_count: updatedIterations.length,
      iterations_remaining: MAX_ITERATIONS - updatedIterations.length,
      regional_context_used: regionalContext?.slug || null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("plan-iterate", e);
    return fehler("intern", 500);
  }
});
