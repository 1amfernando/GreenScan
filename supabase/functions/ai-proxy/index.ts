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

import { createClient } from "jsr:@supabase/supabase-js@2.119.0";
// v33.58: Modelle, Freigabe und Rueckfall kommen aus EINEM Modul (auch fuer die anderen Functions).
import { modellFuerAnfrage, mitModellRueckfall, modellSecret, rufeModell } from "../_shared/modelle.mjs";
// v33.59: das Tor vor dem KI-Aufruf (Kontingent, Plan, Sperre, Deckel) — eine Rechnung fuer alle sechs KI-Functions.
import { KI_GRENZEN, kiFehlerCode, kiFreigabeNoetig, kiFreigeben, kiMaxTokens, kiProxyEingabe, kiToken, kiTor } from "../_shared/ki_tor.mjs";

const KI_FN = "ai-proxy";

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

// v33.59: Tageslimits je Stufe (free 15 · basic/plus/premium 200 · pro/lifetime 2000 · Admin 2000 —
// die Zahlen, die v33.58 live ausgeliefert hat), der max_tokens-Deckel (4096) und der Gesamtdeckel
// des Rumpfs (20_000_000 Zeichen, v33.58) stehen in EINER Tabelle: _shared/ki_tor.mjs (KI_GRENZEN).
// Dazu dort der Deckel JE Bild (5 MB, Anbieter-Limit) — eine andere Frage als der Gesamtdeckel.
const GESAMT_MAX = KI_GRENZEN[KI_FN].bytes;

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

  // v33.59 (Sicherheitspruefung 10.11.2026): Nutzer MIT Token pruefen; Plan und
  // Sperre vom Server; Eingabe deckeln; Kontingent VOR dem Aufruf atomar
  // reservieren (fail-closed). Vorher: zaehlen → rufen → danach buchen, nicht
  // abgewartet — parallele Anfragen lasen alle denselben Stand, ein Fehler galt als 0.
  const token = kiToken(authHeader);
  const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: "Bearer " + token } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (!SUPABASE_SERVICE_ROLE_KEY) return jsonResp({ error: { type: "config", message: kiFehlerCode("config").message } }, 503, origin);
  const supaAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: userRes, error: userErr } = await supa.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) {
    return jsonResp({ error: { message: "Ungültige Session." } }, 401, origin);
  }

  // 2) Body lesen und deckeln (vor der Reservierung — eine abgewiesene Eingabe kostet nichts).
  //    v33.58: erst die Angabe im Kopf (kostet nichts), dann das Gelesene (die Angabe kann fehlen
  //    oder luegen). v33.59: dann Bilder, Bildgroesse, Bildtyp, Nachrichten, Text (kiProxyEingabe).
  const zuGross = () => jsonResp({ error: { type: "zu_gross", message: kiFehlerCode("zu_gross").message } }, 413, origin);
  if (Number(req.headers.get("content-length") || 0) > GESAMT_MAX) return zuGross();
  let roh = "";
  try { roh = await req.text(); } catch { return jsonResp({ error: { message: "Bad Request" } }, 400, origin); }
  if (roh.length > GESAMT_MAX) return zuGross();
  let body: Record<string, unknown>;
  try { body = JSON.parse(roh); } catch { return jsonResp({ error: { message: "Bad JSON" } }, 400, origin); }
  if (!body || typeof body !== "object") return jsonResp({ error: { message: "Bad JSON" } }, 400, origin);
  const pruef = kiProxyEingabe(body, roh.length);
  if (!pruef.ok) return jsonResp({ error: { type: pruef.code, message: kiFehlerCode(pruef.code).message } }, pruef.status, origin);

  // 3) Body validieren. Modell: was der Client verlangt, wenn es freigegeben ist — sonst die Kette
  //    der Rolle „vision" (v33.58).
  const wahl = modellFuerAnfrage(typeof body.model === "string" ? body.model : "", "vision", modellSecret("vision"), modellSecret("schnell"));
  if (wahl.ersetzt) console.warn("[ai-proxy] verlangtes Modell ersetzt (" + wahl.grund + "): " + String(body.model).slice(0, 60) + " → " + wahl.kette[0]);
  const maxTokens = kiMaxTokens(KI_FN, Number(body.max_tokens) || 1200);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  // system kann String ODER Anthropic-Block-Array (mit cache_control) sein → beides durchreichen.
  const system = (typeof body.system === "string" || Array.isArray(body.system)) ? body.system : "";

  if (messages.length === 0) return jsonResp({ error: { message: "messages[] required" } }, 400, origin);

  // 4) Key aus env ODER (Fallback) aus app_settings.global_anthropic_api_key
  //    (service-role) — so braucht der Proxy KEIN manuelles Edge-Secret; der Key bleibt server-seitig.
  let ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
  if (!ANTHROPIC_API_KEY) {
    try {
      const { data: ks } = await supaAdmin.from("app_settings").select("value").eq("key", "global_anthropic_api_key").maybeSingle();
      if (ks?.value) ANTHROPIC_API_KEY = String(ks.value);
    } catch (_) { /* best-effort */ }
  }
  // v33.59 (Vereinigung): Schluessel und Notschalter kommen VOR die Reservierung — wer hier
  // abgewiesen wird, hat nichts reserviert, und es gibt nichts zurueckzugeben.
  if (!ANTHROPIC_API_KEY) return jsonResp({ error: { message: "Server: Anthropic-Key fehlt." } }, 503, origin);

  // v33.58: der Notschalter gilt auch hier. `global_api_enabled = false` stoppte bisher nur die
  // Auskunft an die App (fn_get_global_api_key) — wer den Proxy direkt rief, bekam weiter Antworten.
  try {
    const { data: an } = await supaAdmin.from("app_settings").select("value").eq("key", "global_api_enabled").maybeSingle();
    if (an && String(an.value).trim().toLowerCase() === "false") {
      return jsonResp({ error: { type: "service_disabled", message: kiFehlerCode("service_disabled").message } }, 503, origin);
    }
  } catch (_) { /* Schalter nicht lesbar → nicht blockieren (der Schluessel wurde eben gelesen) */ }

  // 5) Tor: Plan + Sperre (403 gesperrt) + Reservierung (Service-Role, atomar, fail-closed). EINE
  //    Antwort auf „gesperrt?" und „Tageslimit?" — die eigene Abfrage von v33.58 (breit, dann schmal)
  //    ist darin aufgegangen; eine unlesbare Sicht ist hier 503, nicht „free" (v33.59: fail-closed).
  //    Reserviert wird EINMAL je Anfrage — ein Modell-Rueckfall unten bucht nichts dazu.
  const tor = await kiTor({ fn: KI_FN, userClient: supa, admin: supaAdmin, userId: user.id });
  if (!tor.erlaubt) {
    if (tor.status >= 500) console.error("[ai-proxy] Tor: " + tor.code + " — " + tor.grund);
    // v33.59: der Satz haengt vom Plan ab — kein „Upgrade" an Zahlende.
    const msg = kiFehlerCode({ code: tor.code, plan: tor.plan }).message;
    return jsonResp({ error: { type: tor.code, message: msg, tier: tor.plan, used: tor.code === "quota_exceeded" ? tor.limit : undefined, limit: tor.limit } }, tor.status, origin);
  }
  const today = new Date().toISOString().slice(0, 10);

  // 6) An Anthropic, mit Modellkette (v33.58).
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
    console.error("ai-proxy upstream", e);
    if (kiFreigabeNoetig(e)) await kiFreigeben({ fn: KI_FN, admin: supaAdmin, userId: user.id });
    return jsonResp({ error: { type: "upstream", message: kiFehlerCode("upstream").message } }, 502, origin);
  }
  const upstream = { ok: antwort.status >= 200 && antwort.status < 300, status: antwort.status };
  const upstreamText = antwort.text;
  const model = antwort.modell;   // das Modell, das geantwortet hat — so steht es auch in ai_usage

  // 7) Usage protokollieren (Service-Role, abgewartet). Das Kontingent ist schon reserviert; hat
  //    der Anbieter gar nicht gerechnet (jede Ablehnung, auch 429/5xx/404), geht es zurueck.
  //    Eine Verweigerung des Modells (HTTP 200, stop_reason „refusal") ist eine VERARBEITETE
  //    Antwort: Anthropic rechnet die Eingabe-Token ab, also bleibt die Reservierung und ai_usage
  //    bucht sie (wie v33.58 live); den Satz daraus macht die App (stop_reason refusal).
  if (upstream.ok) {
    let tokensIn = 0, tokensOut = 0;
    try { const parsed = JSON.parse(upstreamText); tokensIn = parsed?.usage?.input_tokens ?? 0; tokensOut = parsed?.usage?.output_tokens ?? 0; } catch (_) {}
    const { error: logErr } = await supaAdmin.from("ai_usage").insert({ user_id: user.id, day: today, model, tokens_in: tokensIn, tokens_out: tokensOut });
    if (logErr) console.error("ai-proxy ai_usage", logErr);
  } else {
    // Jede Ablehnung zurueck: der Anbieter rechnet sie nicht, und der Client probiert bei
    // 404 („Modell unbekannt") das naechste Modell — sonst kostete EIN Aufruf bis zu vier.
    // Dieselbe Regel wie die fuenf Bild-/Plan-Functions (kiFreigabeNoetig, v33.59).
    if (kiFreigabeNoetig(upstream)) await kiFreigeben({ fn: KI_FN, admin: supaAdmin, userId: user.id });
  }

  // 8) Weiterleiten (gleiche Shape wie api.anthropic.com → Frontend-Parsing unverändert;
  //    thinking-Bloecke hat rufeModell schon entfernt)
  return new Response(upstreamText, {
    status: upstream.status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
});
