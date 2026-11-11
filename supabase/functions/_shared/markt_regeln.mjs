// markt_regeln.mjs — was marketplace-publish entscheidet, bevor es schreibt (v33.59).
//
// Reines ESM ohne Abhaengigkeiten: von Deno (marketplace-publish) und Node
// (scripts/edge/50_markt.js, ausgefuehrt) importierbar — dieselbe Aufteilung wie
// ingest_regeln.mjs und push_helfer.mjs.
//
// Warum hier und nicht nur in der Datenbank: marketplace-publish schreibt mit dem
// Service-Schluessel. fn_gs_sperre (20261110_sicherheit_community_markt.sql) prueft
// ein UPDATE nur aus Nutzerhand — der Bearbeiten-Zweig der Function kam damit fuer
// ein gesperrtes Konto durch. Die Rolle steht in profiles.role ('banned').

export const MARKT_SPERRE_SATZ = 'Dein Konto ist gesperrt – Inserate lassen sich nicht veröffentlichen oder ändern.';
export const MARKT_ROLLE_UNBEKANNT_SATZ = 'Dein Konto liess sich gerade nicht prüfen – bitte versuche es gleich noch einmal.';

// antwort = das Ergebnis von sbAdmin.from('profiles').select('role').eq('id', uid).maybeSingle()
// Rueckgabe: null (darf schreiben) oder { status, body } — die Function gibt das unveraendert zurueck.
// Eine Rolle, die sich nicht lesen laesst, ist KEIN Ja: lieber einmal 503 als ein Inserat eines
// Gesperrten. Ein fehlendes Profil ist kein Nein (Konten aus der Zeit vor fn_handle_new_user).
export function marktSperre(antwort) {
  const a = antwort || {};
  if (a.error) return { status: 503, body: { error: MARKT_ROLLE_UNBEKANNT_SATZ, code: 'rolle_unbekannt' } };
  const rolle = a.data && a.data.role != null ? String(a.data.role).trim().toLowerCase() : '';
  if (rolle === 'banned') return { status: 403, body: { error: MARKT_SPERRE_SATZ, code: 'banned' } };
  return null;
}
