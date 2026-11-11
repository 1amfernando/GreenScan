// GreenScan — Anthropic Claude Proxy (Supabase Edge Function · Deno)
//
// Zweck:
//   User muss keinen eigenen Anthropic-API-Key mehr eingeben/erhalten. Der Server
//   hält den Key, validiert das User-JWT, prüft Tier-Quota (ai_usage) und forwarded
//   den Request an api.anthropic.com. Schliesst den Kosten-Leak (Roh-Key im Browser).
//
// Endpoint: POST https://<project>.supabase.co/functions/v1/ai-proxy
//   Header: Authorization: Bearer <user-jwt>
//   Body:   { messages, system, max_tokens, model }
// Response: wie von Anthropic (nicht streamend) — seit v33.58 ohne `thinking`-Bloecke, damit
//   `content[0].text` auch fuer eine aeltere, noch nicht aktualisierte App der Text bleibt.
//
// v30.37 (2026-06-25): CORS-Allowlist um die KANONISCHE Domain green-scan.ch (MIT
//   Bindestrich) ergänzt — vorher nur greenscan.ch → Prod wäre CORS-geblockt.
//   Modernisiert auf Deno.serve (std/http/server serve ist deprecated).
//   Frontend ruft den Proxy hinter Feature-Flag localStorage.gs_feat_aiproxy.

import { createClient } from "jsr:@supabase/supabase-js@2";
// v33.58: Modelle, Freigabe und Rueckfall kommen aus EINEM Modul (auch fuer die anderen Functions).
import { modellFuerAnfrage, mitModellRueckfall, modellSecret, rufeModell } from "../_shared/modelle.mjs";

// CORS auf vertrauenswürdige Origins beschränken. green-scan.ch (kanonisch, mit
// Bindestrich) + greenscan.ch (Alt) + *.pages.dev (CF-Previews) + localhost (Dev).
const ALLOWED_ORIGINS = [
  "https://green-scan.ch",
  "https://www.green-scan.ch",
  "https://greenscan.ch",
  "https://www.greenscan.ch",
];
function corsHeaders(origin: string | null): Record<string, string> {
  let allowed = "https://green-scan.ch"; // default = kanonische Domain
  if (origin) {
    // v32.72 (Audit A10): nicht JEDE *.pages.dev-Seite, nur die eigenen Previews.
    if (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.greenscan-app\.pages\.dev$/i.test(origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      allowed = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

// v33.58: die Freigabeliste steht nicht mehr hier. Bis v33.56 nannte sie acht Namen, von denen
// sieben abgeschaltet sind oder es am 30.11.2026 werden, und JEDES andere Modell wurde still auf
// den Vorgabewert umgeschrieben — der selbst am 30.11. endet (ai_usage: 37 von 37 Aufrufen).
// Jetzt: ein Client darf die Modelle der zwei Ketten verlangen (_shared/modelle.mjs); verlangt er
// etwas anderes, bekommt er die Kette der Rolle „vision" — und antwortet Anthropic auf ein Modell
// mit „gibt es nicht", ist das naechste dran. Teurere Modelle stehen in keiner Kette.

// Tier → Tageslimit (KI-Calls). free 15 = Sync mit Frontend GS_PLANS.free.
// v33.58: `basic` und `premium` fehlten — v_user_entitlements kennt beide, und wer eines davon
// bezahlte, fiel hier auf die 15 Aufrufe der Gratis-Stufe.
const TIER_LIMITS: Record<string, number> = {
  free: 15,
  basic: 200,
  plus: 200,
  premium: 200,
  pro: 2000,
  lifetime: 2000,
};

const MAX_TOKENS_CAP = 4096;
// v33.58: eine Anfrage ohne Grenze ist ein Speicher- und Kostenhebel. Die App verkleinert jedes
// Foto vor dem Senden (laengste Seite 1920 px, JPEG) — drei Fotos bleiben weit unter dieser Zahl.
// Der Deckel soll Unsinn abweisen, nicht den Normalfall vermessen; Anthropic selbst nimmt 32 MB.
const MAX_BODY_ZEICHEN = 20_000_000;

function jsonResp(payload: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (req.method !== "POST") return jsonResp({ error: { message: "Method Not Allowed" } }, 405, origin);

  // 1) JWT prüfen
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return jsonResp({ error: { message: "Anmelden erforderlich." } }, 401, origin);
  }
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return jsonResp({ error: { message: "Server: Supabase-Config fehlt." } }, 503, origin);
  }

  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const supaAdmin = SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : supa;

  const { data: userRes, error: userErr } = await supa.auth.getUser();
  const user = userRes?.user;
  if (userErr || !user) {
    return jsonResp({ error: { message: "Ungültige Session." } }, 401, origin);
  }

  // 2) Entitlements + Quota (ai_usage, Tageszähler)
  let tier = "free";
  let istAdmin = false, rolle = "";
  try {
    // v33.58: dieselbe Zeile traegt auch Rolle und Admin-Merkmal — eine Abfrage, drei Antworten.
    // Der Fehler wird GELESEN (v33.41): supabase-js wirft nicht, und ein weggelassener Fehler
    // haette jede bezahlte Stufe still auf „free" gesetzt. Scheitert die breite Abfrage, gilt
    // die schmale von vorher — die Stufe geht nie an einer neuen Spalte verloren.
    let { data: ent, error: entErr } = await supa.from("v_user_entitlements").select("tier, is_admin, role").eq("user_id", user.id).maybeSingle();
    if (entErr) {
      console.error("[ai-proxy] v_user_entitlements (tier, is_admin, role): " + entErr.message);
      const schmal = await supa.from("v_user_entitlements").select("tier").eq("user_id", user.id).maybeSingle();
      if (schmal.error) console.error("[ai-proxy] v_user_entitlements (tier): " + schmal.error.message);
      ent = schmal.data as typeof ent;
    }
    if (ent?.tier) tier = String(ent.tier);
    istAdmin = ent?.is_admin === true;
    rolle = String(ent?.role || "");
  } catch (e) { console.error("[ai-proxy] v_user_entitlements: " + (e as Error).message); /* → free */ }
  // v33.58: ein gesperrtes Konto bekommt keine KI — fn_get_global_api_key sagte das schon immer,
  // der Proxy fragte nie danach.
  if (rolle === "banned") {
    return jsonResp({ error: { type: "account_banned", message: "Dieses Konto ist gesperrt." } }, 403, origin);
  }
  const limit = istAdmin ? TIER_LIMITS.pro : (TIER_LIMITS[tier] ?? TIER_LIMITS.free);

  const today = new Date().toISOString().slice(0, 10);
  let usedToday = 0;
  try {
    const { count } = await supa.from("ai_usage").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("day", today);
    usedToday = count ?? 0;
  } catch (_) { /* Tabelle evtl. nicht da → konservativ 0 */ }

  if (usedToday >= limit) {
    return jsonResp({
      error: { type: "quota_exceeded", message: `Tageslimit erreicht (${limit}/${limit}). Upgrade für mehr KI-Calls.`, tier, used: usedToday, limit },
    }, 429, origin);
  }

  // 3) Body validieren
  let body: Record<string, unknown>;
  let roh = "";
  const zuGross = () => jsonResp({ error: { type: "request_too_large", message: "Anfrage zu gross — bitte weniger oder kleinere Fotos." } }, 413, origin);
  // Erst die Angabe im Kopf (kostet nichts), dann das Gelesene (die Angabe kann fehlen oder luegen).
  if (Number(req.headers.get("content-length") || 0) > MAX_BODY_ZEICHEN) return zuGross();
  try { roh = await req.text(); } catch { return jsonResp({ error: { message: "Bad Request" } }, 400, origin); }
  if (roh.length > MAX_BODY_ZEICHEN) return zuGross();
  try { body = JSON.parse(roh); } catch { return jsonResp({ error: { message: "Bad JSON" } }, 400, origin); }
  if (!body || typeof body !== "object") return jsonResp({ error: { message: "Bad JSON" } }, 400, origin);

  // Modell: was der Client verlangt, wenn es freigegeben ist — sonst die Kette der Rolle „vision".
  const wahl = modellFuerAnfrage(typeof body.model === "string" ? body.model : "", "vision", modellSecret("vision"), modellSecret("schnell"));
  if (wahl.ersetzt) console.warn("[ai-proxy] verlangtes Modell ersetzt (" + wahl.grund + "): " + String(body.model).slice(0, 60) + " → " + wahl.kette[0]);
  const maxTokens = Math.min(Math.max(Number(body.max_tokens) || 1200, 1), MAX_TOKENS_CAP);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  // system kann String ODER Anthropic-Block-Array (mit cache_control) sein → beides durchreichen.
  const system = (typeof body.system === "string" || Array.isArray(body.system)) ? body.system : "";

  if (messages.length === 0) return jsonResp({ error: { message: "messages[] required" } }, 400, origin);

  // 4) Forward an Anthropic. Key aus env ODER (Fallback) aus app_settings.global_anthropic_api_key
  //    (service-role) — so braucht der Proxy KEIN manuelles Edge-Secret; der Key bleibt server-seitig.
  let ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!ANTHROPIC_API_KEY) {
    try {
      const { data: ks } = await supaAdmin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
      if (ks?.value) ANTHROPIC_API_KEY = String(ks.value);
    } catch (_) { /* best-effort */ }
  }
  if (!ANTHROPIC_API_KEY) return jsonResp({ error: { message: "Server: Anthropic-Key fehlt." } }, 503, origin);

  // v33.58: der Notschalter gilt auch hier. `global_api_enabled = false` stoppte bisher nur die
  // Auskunft an die App (fn_get_global_api_key) — wer den Proxy direkt rief, bekam weiter Antworten.
  try {
    const { data: an } = await supaAdmin.from("app_settings").select("value").eq("key", "global_api_enabled").maybeSingle();
    if (an && String(an.value).trim().toLowerCase() === "false") {
      return jsonResp({ error: { type: "service_disabled", message: "Die KI-Funktionen sind vorübergehend abgeschaltet." } }, 503, origin);
    }
  } catch (_) { /* Schalter nicht lesbar → nicht blockieren (der Schluessel wurde eben gelesen) */ }

  let antwort: { status: number; text: string; modell: string; versuche: unknown[] };
  try {
    // Jedes Modell bekommt SEINEN Rumpf (rufeModell): Sonnet 5.5 und 5 denken sonst von sich aus
    // nach — das zaehlt gegen max_tokens und stellt einen thinking-Block vor den Text. Der Rumpf
    // traegt ausschliesslich diese vier Felder plus den Zusatz des Modells; alles andere, was ein
    // Client mitschickt, geht nie an Anthropic.
    const sagen = (zeile: string) => console.warn("[ai-proxy] " + zeile);
    const sende = async (rumpf: Record<string, unknown>) => {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
        body: JSON.stringify(rumpf),
      });
      return { status: r.status, text: await r.text() };
    };
    antwort = await mitModellRueckfall(wahl.kette, (m: string) => rufeModell(m, { max_tokens: maxTokens, system, messages }, sende, sagen), sagen);
  } catch (e) {
    return jsonResp({ error: { message: "Upstream-Fehler: " + (e as Error).message } }, 502, origin);
  }
  const upstream = { ok: antwort.status >= 200 && antwort.status < 300, status: antwort.status };
  const upstreamText = antwort.text;
  const model = antwort.modell;   // das Modell, das geantwortet hat — so steht es auch in ai_usage

  // 5) Usage tracken (best-effort, nur bei Erfolg, service-role)
  if (upstream.ok) {
    let tokensIn = 0, tokensOut = 0;
    try { const parsed = JSON.parse(upstreamText); tokensIn = parsed?.usage?.input_tokens ?? 0; tokensOut = parsed?.usage?.output_tokens ?? 0; } catch (_) {}
    supaAdmin.from("ai_usage").insert({ user_id: user.id, day: today, model, tokens_in: tokensIn, tokens_out: tokensOut }).then(() => {}, () => {});
  }

  // 6) Weiterleiten (gleiche Shape wie api.anthropic.com → Frontend-Parsing unverändert;
  //    thinking-Bloecke hat rufeModell schon entfernt)
  return new Response(upstreamText, {
    status: upstream.status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
