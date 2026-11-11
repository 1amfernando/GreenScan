// auth_vergleich.mjs — EIN Vergleich für Geheimnisse, für alle Edge-Functions.
//
// Reines ESM ohne Typen, damit Deno (Edge-Functions) und Node (Prüfstand
// robust_check) dieselbe Datei laden — dasselbe Muster wie ingest_regeln.mjs.
//
// Anlass (Audit A10, 07.09.2026): fünf Cron-Empfänger prüften den Service-Key
// mit `authHdr.includes(SERVICE_ROLE)` — ein Teilstring-Vergleich, dessen
// Laufzeit vom Inhalt abhängt, und der ein „Bearer <key>" ebenso annimmt wie
// „<key>" irgendwo im Header. `send-push` hatte den richtigen Vergleich seit
// v30.87 — als Kopie, die die vier anderen nie bekamen. Jetzt gibt es ihn einmal.
//
// Regel: ein Geheimnis wird NIE mit ===, includes oder startsWith verglichen.

// Gleich lang und Zeichen für Zeichen gleich — ohne frühen Ausstieg beim ersten
// Unterschied. Zwei leere Werte sind KEIN Treffer (ein fehlender Key darf nie
// einen fehlenden Header „bestätigen").
export function constantTimeEquals(a, b) {
  const x = String(a == null ? '' : a), y = String(b == null ? '' : b);
  if (!x.length || x.length !== y.length) return false;
  let mismatch = 0;
  for (let i = 0; i < x.length; i++) mismatch |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return mismatch === 0;
}

// „Bearer <token>" → <token>; ohne Präfix der ganze Wert.
export function bearerToken(authHdr) {
  return String(authHdr == null ? '' : authHdr).replace(/^Bearer\s+/i, '').trim();
}

// Trägt der Authorization-Header GENAU den Service-Role-Key?
export function hatServiceRole(authHdr, serviceRole) {
  const t = bearerToken(authHdr);
  return !!serviceRole && !!t && constantTimeEquals(t, serviceRole);
}

// Cron (x-cron-secret) ODER Service-Role — die eine Frage, die alle Empfänger stellen.
export function cronOderService(req, cronSecretErwartet, serviceRole) {
  const got = String(req.headers.get('x-cron-secret') || '').trim();
  const erwartet = String(cronSecretErwartet == null ? '' : cronSecretErwartet).trim();
  const cronOk = !!erwartet && constantTimeEquals(got, erwartet);
  const auth = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  return cronOk || hatServiceRole(auth, serviceRole);
}
