import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// v29 i18n-translate — DE → {en,fr,it,es} Bulk-Übersetzung via Anthropic Haiku 4.5.
// Cached in i18n_translations (UNIQUE (src_lang,tgt_lang,hash)).
//
// SECURITY (v29, „stärke es noch mehr"-Härtung): Diese Funktion ruft die ANTHROPIC-API
// (= echte Kosten). v1-v3 hatten KEINERLEI Auth (verify_jwt=false, kein Secret) → mit dem
// in der App ausgelieferten publishable-Key konnte JEDER beliebige Strings → Anthropic schicken
// (unbegrenzter Kosten-Missbrauch; der SHA-256-Cache schützt nicht, da neue Strings = Cache-Miss).
// Fix: ON-DEMAND-Generierung ist faktisch eine SEEDING-Operation (schreibt i18n_translations
// für ALLE). Reguläre User lesen nur geseedete Übersetzungen (loadFromDb, 1 GET, kein Anthropic);
// fehlt ein String, ist der DE-Fallback das korrekte Verhalten. Daher: NUR Admin (profiles.role=
// 'admin', server-geprüft) ODER service_role (Seeding-Skript/Cron) dürfen generieren. Muster wie
// send-push v2 Broadcast-Gate. Anonyme/reguläre Calls → 403 (App fällt graziös auf DE/DB zurück).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function decodeJwt(authHeader: string): { sub?: string; role?: string } {
  try {
    const tok = authHeader.replace(/^Bearer\s+/i, "").trim();
    const seg = tok.split(".")[1];
    if (!seg) return {};
    const json = atob(seg.replace(/-/g, "+").replace(/_/g, "/"));
    const p = JSON.parse(json);
    return { sub: p.sub, role: p.role };
  } catch (_) { return {}; }
}

// Gate: nur Admin-JWT oder service_role. Liefert null wenn erlaubt, sonst eine 403-Response.
async function denyIfNotAdmin(req: Request, cors: Record<string,string>): Promise<Response | null> {
  const authHdr = req.headers.get("authorization") || "";
  const { sub, role } = decodeJwt(authHdr);
  const isService = role === "service_role" || (SERVICE_ROLE && authHdr.includes(SERVICE_ROLE));
  if (isService) return null;
  if (role === "authenticated" && sub) {
    const { data: prof } = await sb.from("profiles").select("role").eq("id", sub).maybeSingle();
    if (prof && prof.role === "admin") return null;
  }
  return new Response(JSON.stringify({ error: "admin_or_service_only" }), { status: 403, headers: cors });
}

async function getAnthropicKey(): Promise<string | null> {
  const env = Deno.env.get("ANTHROPIC_API_KEY");
  if (env) return env;
  const { data } = await sb.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
  return data?.value || null;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function fetchCached(srcLang: string, tgtLang: string, hashes: string[]) {
  if (!hashes.length) return new Map<string, string>();
  const { data } = await sb
    .from("i18n_translations")
    .select("source_hash, translated_text")
    .eq("source_lang", srcLang)
    .eq("target_lang", tgtLang)
    .in("source_hash", hashes);
  const map = new Map<string, string>();
  for (const r of (data || [])) map.set((r as any).source_hash, (r as any).translated_text);
  return map;
}

async function callAnthropic(
  apiKey: string, srcLang: string, tgtLang: string, items: { key: string; text: string }[], context?: string
) {
  const langName: Record<string, string> = {
    de: "Deutsch (Schweiz)",
    en: "Englisch (UK)",
    fr: "Französisch (Schweiz)",
    it: "Italienisch (Schweiz)",
    es: "Spanisch (Spanien)"
  };
  const sys = `Du bist ein professioneller Übersetzer für eine Schweizer PWA-App (GreenScan — Pflanzen/Pilze-Scanner). Aufgabe: Übersetze die untenstehenden UI-Strings von ${langName[srcLang] || srcLang} nach ${langName[tgtLang] || tgtLang}.

Regeln:
- Halte die UI-typische Kürze ein (Buttons/Labels kurz halten)
- Pflanzen-/Garten-Fachsprache korrekt verwenden
- Emojis am Anfang/Ende beibehalten (nicht übersetzen)
- Variablen in {curly_braces} nicht übersetzen
- Schweizer Konventionen wo passend (z.B. "CHF" nicht "Fr.")
- HTML-Entities wie &amp; und &nbsp; unverändert lassen
${context ? "Kontext: " + context : ""}

Antwort-Format: NUR JSON-Array mit { "key": "<key>", "translated": "<übersetzung>" } pro Eintrag. Kein Pre-/Post-Text.`;

  const userMsg = `Übersetze diese ${items.length} UI-Strings:\n\n` +
    items.map((it, i) => `${i+1}. key=${it.key}\n   text=${JSON.stringify(it.text)}`).join("\n\n");

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: sys,
      messages: [{ role: "user", content: userMsg }]
    })
  });
  if (!r.ok) throw new Error("Anthropic " + r.status + ": " + await r.text());
  const j = await r.json();
  const txt = j?.content?.[0]?.text || "";
  const m = txt.match(/\[[\s\S]*\]/);
  if (!m) throw new Error("Kein JSON-Array in Antwort: " + txt.slice(0, 200));
  const parsed = JSON.parse(m[0]);
  return {
    translations: parsed as { key: string; translated: string }[],
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

  // v29 SECURITY-Gate: nur Admin oder service_role dürfen Anthropic-Generierung auslösen.
  const denied = await denyIfNotAdmin(req, cors);
  if (denied) return denied;

  try {
    const body = await req.json();
    const srcLang = String(body.source_lang || "de");
    const targetLangs: string[] = Array.isArray(body.target_langs) ? body.target_langs : ["en","fr","it","es"];
    const strings: Record<string, string> = body.strings || {};
    const context: string = body.context || "";

    const keys = Object.keys(strings);
    if (!keys.length) return new Response(JSON.stringify({ error: "strings empty" }), { status: 400, headers: cors });

    const apiKey = await getAnthropicKey();
    if (!apiKey) return new Response(JSON.stringify({ error: "Anthropic API-Key nicht konfiguriert" }), { status: 503, headers: cors });

    const hashes = await Promise.all(keys.map(async k => ({ key: k, text: strings[k], hash: await sha256Hex(strings[k]) })));

    const out: Record<string, Record<string, string>> = {};
    let totalCached = 0, totalFetched = 0, tokensIn = 0, tokensOut = 0;

    for (const tgt of targetLangs) {
      out[tgt] = {};
      const hashList = hashes.map(h => h.hash);
      const cached = await fetchCached(srcLang, tgt, hashList);

      const todo = hashes.filter(h => !cached.has(h.hash));
      for (const h of hashes) {
        if (cached.has(h.hash)) { out[tgt][h.key] = cached.get(h.hash)!; totalCached++; }
      }

      if (!todo.length) continue;

      const CHUNK = 30;
      for (let i = 0; i < todo.length; i += CHUNK) {
        const slice = todo.slice(i, i + CHUNK);
        const items = slice.map(s => ({ key: s.key, text: s.text }));
        const result = await callAnthropic(apiKey, srcLang, tgt, items, context);
        tokensIn += result.tokens_in;
        tokensOut += result.tokens_out;

        const inserts: any[] = [];
        for (const tr of result.translations) {
          const orig = slice.find(s => s.key === tr.key);
          if (!orig) continue;
          out[tgt][tr.key] = tr.translated;
          inserts.push({
            source_lang: srcLang,
            target_lang: tgt,
            source_text: orig.text,
            source_hash: orig.hash,
            translated_text: tr.translated,
            context_note: context || null,
            model: "claude-haiku-4-5-20251001",
            tokens_in: Math.round(result.tokens_in / slice.length),
            tokens_out: Math.round(result.tokens_out / slice.length)
          });
        }
        if (inserts.length) {
          const { error } = await sb.from("i18n_translations").upsert(inserts, {
            onConflict: "source_lang,target_lang,source_hash",
            ignoreDuplicates: true
          });
          if (error) console.warn("upsert error:", error.message);
        }
        totalFetched += slice.length;
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      translations: out,
      cached: totalCached,
      fetched: totalFetched,
      tokens: { in: tokensIn, out: tokensOut }
    }), { headers: cors });
  } catch (e: any) {
    console.error("i18n-translate error:", e);
    return new Response(JSON.stringify({ error: String(e.message || e) }), { status: 500, headers: cors });
  }
});
