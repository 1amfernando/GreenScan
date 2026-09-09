// supabase/functions/_shared/claude_fallback.mjs
// Modell-Rückfallkette fuer Server-KI-Aufrufe — Vorlage: book-ingest (CLAUDE_MODELS,
// siehe supabase/functions/book-ingest/BEFUND.md). Bis hierher hatten neun Aufrufstellen
// in acht Edge-Functions genau EINEN fest verdrahteten Modellnamen ohne Ausweichmoeglichkeit
// (STATUS.md, Technische Schuld: „Modell-Rueckfallketten in 8 Edge-Functions"). Faellt ein
// Name weg, endet der Aufruf sonst in einem Fehler, den niemand kommen sieht.
//
// Regel wie in book-ingest: nur ein HTTP 404 (Modell existiert fuer diesen Account/Key
// nicht) loest den naechsten Versuch aus. Jeder andere Status (401/429/5xx/…) UND jeder
// Netzfehler/Timeout geht unveraendert an den Aufrufer zurueck — das war schon vorher das
// Verhalten fuer diese Faelle und aendert sich hier nicht. Ob die Modellnamen unten heute
// noch aufloesen, ist von dieser Umgebung aus nicht pruefbar (kein Netz zu Anthropic).

// Sonnet-Kette in der Reihenfolge der Frontend-Kette (index.html window._gsClaudeFallbacks)
// und der Proxy-Allowlist (ai-proxy ALLOWED_MODELS) — dieselben Namen, dieselbe Reihenfolge.
export const SONNET_CHAIN = [
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-sonnet-4-5-20250929",
  "claude-sonnet-4-20250514",
  "claude-3-5-sonnet-20241022",
];

// Haiku-Kette — dieselben Namen wie in ai-proxy ALLOWED_MODELS (haiku-Teil), ergaenzt um
// das aktuelle Haiku-4.5-Datum, das mehrere Functions bereits als Primaermodell nutzen.
export const HAIKU_CHAIN = [
  "claude-haiku-4-5-20251001",
  "claude-3-5-haiku-20241022",
  "claude-3-5-haiku-latest",
];

// Baut eine Kette: `primary` zuerst (unveraendertes Erfolgsverhalten fuer den bisherigen
// Aufruf), danach der Rest von `fallbacks` ohne Dubletten.
function chainFrom(primary, fallbacks) {
  const seen = new Set([primary]);
  const rest = fallbacks.filter((m) => {
    if (seen.has(m)) return false;
    seen.add(m);
    return true;
  });
  return [primary, ...rest];
}

export function sonnetChain(primary) {
  return chainFrom(primary, SONNET_CHAIN);
}
export function haikuChain(primary) {
  return chainFrom(primary, HAIKU_CHAIN);
}

// Ruft POST /v1/messages der Reihe nach mit jedem Modell aus `chain`, bis eines NICHT mit
// 404 antwortet. `bodyOhneModel` ist das Anfrage-Objekt OHNE das Feld "model" (max_tokens,
// system, messages, …) — das Modell wird pro Versuch eingesetzt. `opts.signal` (optional)
// wird an JEDEN Versuch weitergereicht (EIN Timeout-Budget fuer die ganze Kette, nicht pro
// Versuch neu — sonst koennte eine lange Kette das Server-Zeitlimit sprengen).
//
// Rueckgabe: { res, model } — `res` kann ok ODER nicht-ok sein (nur 404 loest den naechsten
// Versuch aus, jeder andere Status kommt wie bisher beim Aufrufer an). Wirft weiter, wenn
// `fetch` selbst wirft (Netz/Timeout) — dafuer gibt es hier bewusst keinen Rueckfall.
export async function fetchClaudeChain(apiKey, chain, bodyOhneModel, opts) {
  const signal = opts && opts.signal;
  let lastRes = null;
  let lastModel = chain[0];
  for (const model of chain) {
    lastModel = model;
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      ...(signal ? { signal } : {}),
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, ...bodyOhneModel }),
    });
    if (res.status !== 404) return { res, model };
    lastRes = res;
  }
  return { res: lastRes, model: lastModel };
}
