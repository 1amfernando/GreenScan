// species-search v1 — server-side fuzzy search with 60s cache layer
// Calls public.fn_species_search (pg_trgm) via service-role, caches in species_search_cache.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const SVC_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CACHE_TTL_S = 60;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function sb(path: string, init: RequestInit = {}) {
  return fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SVC_KEY,
      Authorization: `Bearer ${SVC_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
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
    q = (q || "").trim();
    if (!Number.isFinite(lim) || lim < 1) lim = 8;
    if (lim > 25) lim = 25;
    if (q.length < 2) return json({ results: [], cached: false });

    const cacheKey = q.toLowerCase() + "|" + lim;

    // 1) cache read
    try {
      const cRes = await sb(`species_search_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=payload,expires_at&limit=1`);
      if (cRes.ok) {
        const rows = await cRes.json();
        if (Array.isArray(rows) && rows[0] && new Date(rows[0].expires_at).getTime() > Date.now()) {
          return json({ results: rows[0].payload ?? [], cached: true });
        }
      }
    } catch (_) { /* cache is best-effort */ }

    // 2) fresh search via RPC
    const rRes = await sb(`rpc/fn_species_search`, {
      method: "POST",
      body: JSON.stringify({ p_q: q, p_lim: lim }),
    });
    if (!rRes.ok) {
      const t = await rRes.text();
      return json({ results: [], cached: false, error: "search_failed", detail: t.slice(0, 200) }, 200);
    }
    const results = await rRes.json();

    // 3) cache write (best-effort upsert)
    try {
      const expires = new Date(Date.now() + CACHE_TTL_S * 1000).toISOString();
      await sb(`species_search_cache?on_conflict=cache_key`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({ cache_key: cacheKey, payload: results, expires_at: expires }),
      });
    } catch (_) { /* best-effort */ }

    return json({ results: Array.isArray(results) ? results : [], cached: false });
  } catch (e) {
    return json({ results: [], cached: false, error: String(e).slice(0, 200) }, 200);
  }
});
