// species-search v2 — server-side fuzzy search (pg_trgm) with a 60 s cache layer.
//
// v32.76 (Audit A7): bis v32.75 lief JEDE Anfrage ohne Anmeldung mit dem
// Service-Role-Key, schrieb in species_search_cache und gab rohe PostgREST-
// Fehlertexte an anonyme Aufrufer; CORS stand auf `*`. Jetzt:
//   1. CORS nur fuer die eigenen Origins (dieselbe Liste wie ai-proxy).
//   2. Ein Bearer ist Pflicht und muss ein ECHTER Nutzer sein — GoTrue prueft
//      die Signatur (`GET /auth/v1/user`); der Anon-Key allein bekommt 401.
//      Die App schickt ueber sbFetch das Sitzungs-Token; ohne Anmeldung faellt
//      sie auf die lokale Artenliste zurueck (das tat sie schon immer).
//   3. Die Suche selbst laeuft mit dem Token der Person (PostgREST prueft es
//      erneut; `fn_species_search` ist fuer `authenticated` freigegeben) — der
//      Service-Key wird nur noch fuer den Cache gebraucht, und nur NACH einer
//      gueltigen Suche.
//   4. Fehler gehen ohne Rohtext hinaus (`search_failed`); Details bleiben im Log.
//   5. `q` ist auf 80 Zeichen, `lim` auf 1–25 begrenzt.
// Live nachgemessen (07.09.2026, nur lesend): species_search_cache hat RLS ohne
// Policies (nur der Service-Key kommt hinein) und 0 Zeilen.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const CACHE_TTL_S = 60;
const Q_MAX = 80;

const ALLOWED_ORIGINS = [
  "https://green-scan.ch",
  "https://www.green-scan.ch",
  "https://greenscan.ch",
  "https://www.greenscan.ch",
];
function corsHeaders(origin: string | null): Record<string, string> {
  let allowed = "https://green-scan.ch";
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin) || /^https:\/\/[a-z0-9-]+\.greenscan-app\.pages\.dev$/i.test(origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      allowed = origin;
    }
  }
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

Deno.serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get("Origin"));
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // 2 · ein echter Nutzer, vom Server bestaetigt
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ results: [], cached: false, error: "auth_required" }, 401);
  try {
    const u = await fetch(`${SB_URL}/auth/v1/user`, { headers: { apikey: ANON_KEY || SVC_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) return json({ results: [], cached: false, error: "auth_required" }, 401);
    const user = await u.json().catch(() => null);
    if (!user || typeof user.id !== "string") return json({ results: [], cached: false, error: "auth_required" }, 401);
  } catch (_) {
    return json({ results: [], cached: false, error: "auth_unavailable" }, 503);
  }

  try {
    let q = "";
    let lim = 8;
    if (req.method === "GET") {
      const u = new URL(req.url);
      q = u.searchParams.get("q") || "";
      lim = parseInt(u.searchParams.get("lim") || "8", 10);
    } else {
      const b = await req.json().catch(() => ({}));
      q = (b.q ?? b.query ?? "").toString();
      lim = parseInt((b.lim ?? b.limit ?? 8).toString(), 10);
    }
    q = (q || "").trim().slice(0, Q_MAX);
    if (!Number.isFinite(lim) || lim < 1) lim = 8;
    if (lim > 25) lim = 25;
    if (q.length < 2) return json({ results: [], cached: false });

    const cacheKey = q.toLowerCase() + "|" + lim;

    // 1) cache read (Service-Key: die Tabelle hat RLS ohne Policies)
    try {
      const cRes = await fetch(`${SB_URL}/rest/v1/species_search_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,expires_at&limit=1`, {
        headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` },
      });
      if (cRes.ok) {
        const rows = await cRes.json();
        if (Array.isArray(rows) && rows[0] && new Date(rows[0].expires_at).getTime() > Date.now()) {
          return json({ results: rows[0].payload ?? [], cached: true });
        }
      }
    } catch (_) { /* cache is best-effort */ }

    // 3) fresh search — mit dem Token der Person, nicht mit dem Service-Key
    const rRes = await fetch(`${SB_URL}/rest/v1/rpc/fn_species_search`, {
      method: "POST",
      headers: { apikey: ANON_KEY || SVC_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_q: q, p_lim: lim }),
    });
    if (!rRes.ok) {
      console.warn("[species-search] rpc", rRes.status, (await rRes.text()).slice(0, 200));
      return json({ results: [], cached: false, error: "search_failed" }, 200);
    }
    const results = await rRes.json();

    // 4) cache write (best-effort upsert, Service-Key, nur nach gueltiger Suche)
    try {
      const expires = new Date(Date.now() + CACHE_TTL_S * 1000).toISOString();
      await fetch(`${SB_URL}/rest/v1/species_search_cache?on_conflict=cache_key`, {
        method: "POST",
        headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ cache_key: cacheKey, payload: results, expires_at: expires }),
      });
    } catch (_) { /* best-effort */ }

    return json({ results: Array.isArray(results) ? results : [], cached: false });
  } catch (e) {
    console.warn("[species-search]", String(e).slice(0, 200));
    return json({ results: [], cached: false, error: "search_failed" }, 200);
  }
});
