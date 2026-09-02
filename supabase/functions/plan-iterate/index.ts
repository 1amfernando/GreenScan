// ══════════════════════════════════════════════════════════════════════════
// SPIEGEL — wortgetreu aus der laufenden Auslieferung gezogen am 02.09.2026
// (v32.19) über die Supabase-Verwaltungsschnittstelle.
// version 4 · verify_jwt=true · ezbr_sha256 d46f3dc6…
//
// Diese Funktion war ausgeliefert und wird vom Frontend benutzt, hatte aber
// keinen Quelltext im Repo. Herkunft und Datum stehen hier, damit jede spätere
// Sitzung nachprüfen kann, ob der Spiegel noch stimmt (neu ziehen und
// vergleichen). Keine Überarbeitung.
// ══════════════════════════════════════════════════════════════════════════
// plan-iterate v3 (v26.50 ai_daily_usage Logging) — v2-base + RPC-Log vor success-Return.
// Region-aware: liest scan_input.region_used aus garden_plans, lädt regional_garden_calendars als Constraint.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, svcKey);
    const apiKey = await getAnthropicKey(admin);
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Anthropic API key not configured" }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { plan_id, user_message } = await req.json();
    if (!plan_id || !user_message) {
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

    const iterations = (plan.iterations || []) as any[];
    if (iterations.length >= MAX_ITERATIONS) {
      return new Response(JSON.stringify({ error: `Iteration limit reached (${MAX_ITERATIONS})` }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
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

    if (!anthropicRes.ok) {
      const errBody = await anthropicRes.text();
      return new Response(JSON.stringify({ error: "Anthropic API error", status: anthropicRes.status, detail: errBody.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ error: "Failed to parse JSON response", raw_preview: rawText.slice(0, 800) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
      return new Response(JSON.stringify({ error: "DB update failed", detail: updateErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // v26.50: Log usage (fire-and-forget) — Sonnet-Modell
    try {
      await admin.rpc("fn_log_ai_usage", {
        p_edge_fn: "plan-iterate",
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
    return new Response(JSON.stringify({ error: String((e as any)?.message ?? e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
