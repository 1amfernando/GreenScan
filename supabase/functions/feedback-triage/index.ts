// ══════════════════════════════════════════════════════════════════════════
// SPIEGEL — wortgetreu aus der laufenden Auslieferung gezogen am 02.09.2026
// (v32.19). version 3 · verify_jwt=true · ezbr_sha256 1bca0016… (Stand beim Ziehen —
// seither überarbeitet, siehe Punkt 1: Modell-Rückfallkette nachgetragen, noch nicht
// ausgeliefert).
//
// ZWEI DINGE, DIE BEIM SPIEGELN AUFGEFALLEN SIND:
//
// 1. `model: "claude-sonnet-4-6"` stand hier FEST und ohne Rückfall (Frontend geht für
//    dieselbe Frage eine Kette durch, index.html window._gsClaudeFallbacks). Fiel der
//    eine Name weg, endete jeder Aufruf in „llm failed", ohne dass es jemand merkte.
//    Nachgetragen: `callClaude` geht jetzt dieselbe Kette durch wie das Frontend, über
//    `_shared/claude_fallback.mjs` (Vorlage: book-ingest/CLAUDE_MODELS). Nur ein HTTP 404
//    löst den nächsten Versuch aus — jeder andere Fehler bleibt wie zuvor sichtbar.
//    Damit ist dieser Spiegel nicht mehr wortgetreu; er wartet zusammen mit den übrigen
//    Sicherheits-Fixes auf den nächsten Deploy (STATUS.md, „Neun Edge-Functions ausliefern").
//    Ob die Modellnamen heute noch auflösen, ist von hier aus weiterhin NICHT prüfbar: die
//    Netz-Richtlinie dieser Umgebung lässt keine Anfrage an Anthropic zu.
//
// 2. `feedback_analysis` hat **0 Zeilen** (gemessen am 02.09.2026), bei
//    2 Feedback-Einträgen, der letzte vom 07.06.2026. Das ist KEIN Beweis für
//    einen Fehler: die Funktion wird von Hand ausgelöst, „nie gedrückt" sieht
//    genauso aus wie „bricht immer ab". Genau das ist der Punkt — solange
//    niemand einmal auf den Knopf drückt, sind beide Fälle nicht zu
//    unterscheiden.
// ══════════════════════════════════════════════════════════════════════════
// feedback-triage: Analysiert einzelne oder viele Feedback-Items mit Claude
// Nur Admin/Expert-Accounts dürfen triggern. Schreibt in public.feedback_analysis.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { sonnetChain, fetchClaudeChain } from "../_shared/claude_fallback.mjs";

const CLAUDE_CHAIN = sonnetChain("claude-sonnet-4-6");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function j(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function callClaude(apiKey: string, items: Array<{id:string; content:string; kind:string; app_version:string|null}>): Promise<{ items: any[]; model: string }> {
  const system = `Du bist ein Product-Manager-Assistent für die GreenScan-App (Schweizer Pflanzen/Pilze/Kräuter).
Analysiere User-Feedback nüchtern und präzise auf Deutsch.
Für jedes Item liefere ein JSON-Objekt mit:
- category: kurz (z.B. "Scanner", "Garten", "Abo", "UX", "Performance", "Daten", "Sonstiges")
- sentiment: "positive" | "neutral" | "negative" | "mixed"
- priority: 1 (niedrig) bis 5 (sofort)
- implementation_effort: "trivial" | "low" | "medium" | "high" | "huge" | "unclear"
- value_score: 0.0-1.0 (geschätzter Nutzen für breite User-Basis)
- summary: 1 Satz (max 120 Zeichen)
- rationale: 1-2 Sätze (warum diese Bewertung)
- actionable: true/false (kann das Team das umsetzen?)
- suggested_action: konkreter Schritt (max 200 Zeichen), nur wenn actionable=true

Antworte AUSSCHLIESSLICH als JSON-Array im Format:
[{\"id\":\"<itemId>\", \"category\":\"...\", ...}]
Keine Einleitung, kein Text ausserhalb des Arrays.`;

  const userMsg = "Bewerte folgende Feedback-Items (IDs bitte 1:1 zurückgeben):\n\n" +
    items.map(it => `ID: ${it.id}\nKind: ${it.kind}\nApp: ${it.app_version || '-'}\nText: ${it.content}`).join("\n---\n");

  const { res, model } = await fetchClaudeChain(apiKey, CLAUDE_CHAIN, {
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: userMsg }],
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Claude " + res.status + ": " + txt.slice(0, 500));
  }
  const data = await res.json();
  const text: string = data?.content?.[0]?.text || "";
  // Extrahiere das JSON-Array (robust)
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start < 0 || end < 0 || end < start) throw new Error("Kein JSON-Array in Claude-Antwort");
  const arr = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(arr)) throw new Error("Antwort ist kein Array");
  return { items: arr, model: data?.model || model };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return j({ error: "POST required" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return j({ error: "missing SUPABASE env" }, 500);
  if (!ANTHROPIC_KEY) return j({ error: "ANTHROPIC_API_KEY not set" }, 500);

  // Auth (v32.75, Audit C4): keine E-Mail-Liste und kein eigener Blick in den
  // Token-Inhalt mehr. Der Server sagt, ob dieses Konto Admin ist — dieselbe
  // Funktion, die jede Admin-RPC prueft (is_admin_user: profiles.is_admin ODER
  // app_settings.admin_emails); PostgREST prueft dabei die Signatur des Tokens.
  // (v32.72, Audit A10: vorher genuegte `is_expert` — jeder Experte konnte die
  // KI-Triage ueber alle Feedbacks ausloesen.)
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return j({ error: "no auth" }, 401);
  let isAdmin = false;
  try {
    const ar = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin_user`, {
      method: "POST",
      headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY") || SERVICE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: "{}",
    });
    if (ar.ok) isAdmin = (await ar.json()) === true;
  } catch { /* bleibt false */ }
  if (!isAdmin) return j({ error: "admin-only" }, 403);

  const body = await req.json().catch(() => ({}));
  const limit = Math.max(1, Math.min(50, Number(body.limit) || 10));
  // v32.72 (Audit A10): `body.id` ging roh in einen PostgREST-Filter — nur eine UUID darf hinein.
  const onlyId: string | null = (typeof body.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id)) ? body.id : null;

  // Hole Items die noch keine Analyse haben (oder ein konkretes ID)
  let url = `${SUPABASE_URL}/rest/v1/feedback_items?select=id,content,kind,app_version&order=created_at.desc&limit=${limit}`;
  if (onlyId) {
    url = `${SUPABASE_URL}/rest/v1/feedback_items?select=id,content,kind,app_version&id=eq.${onlyId}`;
  }
  const fetchRes = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!fetchRes.ok) return j({ error: "items fetch failed", detail: await fetchRes.text() }, 500);
  let items: Array<{id:string; content:string; kind:string; app_version:string|null}> = await fetchRes.json();

  // Filtere bereits analysierte raus (wenn nicht explizit ein ID angefragt)
  if (!onlyId && items.length > 0) {
    const ids = items.map(it => it.id);
    const anRes = await fetch(`${SUPABASE_URL}/rest/v1/feedback_analysis?select=feedback_id&feedback_id=in.(${ids.join(",")})`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (anRes.ok) {
      const existing: Array<{feedback_id:string}> = await anRes.json();
      const seen = new Set(existing.map(e => e.feedback_id));
      items = items.filter(it => !seen.has(it.id));
    }
  }

  if (items.length === 0) return j({ ok: true, analyzed: 0, message: "nothing to analyze" });

  // Claude-Analyse
  let analyses: any[];
  let usedModel: string = CLAUDE_CHAIN[0];
  try {
    const result = await callClaude(ANTHROPIC_KEY, items);
    analyses = result.items;
    usedModel = result.model;
  } catch (e) {
    return j({ error: "llm failed", detail: String(e) }, 502);
  }

  // Upsert in feedback_analysis
  const rows = analyses.map(a => ({
    feedback_id: a.id,
    category: a.category || null,
    sentiment: a.sentiment || null,
    priority: typeof a.priority === "number" ? a.priority : null,
    implementation_effort: a.implementation_effort || null,
    value_score: typeof a.value_score === "number" ? a.value_score : null,
    summary: a.summary || null,
    rationale: a.rationale || null,
    actionable: !!a.actionable,
    suggested_action: a.suggested_action || null,
    model: usedModel,
    analyzed_at: new Date().toISOString(),
  })).filter(r => r.feedback_id);

  if (rows.length === 0) return j({ ok: true, analyzed: 0, message: "no valid rows from llm" });

  const upsert = await fetch(`${SUPABASE_URL}/rest/v1/feedback_analysis?on_conflict=feedback_id`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(rows),
  });
  if (!upsert.ok) return j({ error: "upsert failed", detail: await upsert.text() }, 500);
  const stored = await upsert.json();
  return j({ ok: true, analyzed: stored.length, items: stored });
});
