// Pilz-Scanner: welche Arten des Registers das Modell kennt.
//
// Reines ESM — von Deno (mushroom-identify) UND Node (scripts/edge/80_pilz.js) importierbar.
//
// Gemessen am 19.11.2026 (live, nur lesend): mushroom_register hat 276 Arten. Die ausgelieferte
// mushroom-identify (v5, Code von v33.59) lud `.order("slug").limit(200)` — 76 Arten fehlten im
// Prompt, darunter 19 giftige: Satansröhrling, Tiger-Ritterling, Grünling, Käppchenmorchel, beide
// Kartoffelboviste, sechs weitere Ritterlinge, vier Täublinge … (alle Slugs ab „pluteus_salicinus").
// Vorher (v33.58) waren es 50 Arten in Speicherreihenfolge.
//
// Warum das gefährlich ist: das Modell darf nur einen Slug aus der Liste nennen (kiSlugAusListe).
// Eine giftige Art, die es nicht kennt, KANN es nicht nennen — es nennt die ähnlichste, die es kennt,
// und das ist oft der essbare Doppelgänger (Käppchenmorchel → Morchel). Eine fehlende essbare Art
// führt dagegen nur zu „unsicher".
//
// Regel: ALLE Arten gehen ans Modell. Nur wenn das Register je über PILZ_WISSEN_MAX wächst, wird
// gekürzt — und dann zuerst die harmloseste Gruppe, nie vor einer harmloseren eine gefährlichere.
// Die Liste im Prompt bleibt nach Slug geordnet (gleicher Prompt bei gleichem Register).

// Rund 258'000 Zeichen für die 276 Arten von heute (19.11.2026); die Grenze lässt Platz zum Wachsen
// und schützt das Kontextfenster des schnellen Modells.
export const PILZ_WISSEN_MAX = 400;
// So viele Zeilen holt die Abfrage höchstens. Wird die Grenze erreicht, weiss der Rand nicht, was
// fehlt — er sagt es im Protokoll (pilzWissenAuswahl meldet `abgeschnitten`).
export const PILZ_ZEILEN_HOLEN = 1000;

// Gefahr zuerst: was am längsten bleibt, steht vorn. Ein unbekannter oder fehlender Wert zählt wie
// „unbekannt" — vorsichtiger als jede essbare oder bloss ungeniessbare Art.
export const PILZ_GEFAHR_RANG = {
  toedlich: 0,
  giftig: 1,
  bedingt_essbar: 2,     // roh giftig (Hallimasch & Co.) — die Zubereitung entscheidet
  speisepilz_jung: 3,
  unbekannt: 4,
  ungeniessbar: 5,
  speisepilz: 6,
};

// Ab welcher Trefferquote (0–100) eine Bestimmung als Bestimmung gilt. Darunter verlangt der Server
// die VAPKO-Kontrolle (vapko_required) — und die App zeigt „unsicher" statt einer Essbarkeit. EINE
// Zahl für beide Seiten: bis v33.61 stand sie in der App bei 60, am Server bei 70 — zwischen 60 und
// 69 % zeigte die App „✅ Speisepilz", während der Server im selben Ergebnis die Kontrolle verlangte.
// Die App spiegelt sie als GS_PILZ_SICHER_AB; edge_check 80_pilz hält beide zusammen.
export const PILZ_SICHER_AB = 70;

export function pilzGefahrRang(edibility) {
  return (typeof edibility === "string" && Object.prototype.hasOwnProperty.call(PILZ_GEFAHR_RANG, edibility))
    ? PILZ_GEFAHR_RANG[edibility]
    : PILZ_GEFAHR_RANG.unbekannt;
}

function nachSlug(a, b) { return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0; }

/**
 * Wählt aus den Zeilen von mushroom_register die Arten für den Prompt.
 * Rückgabe { liste, weggelassen, gefaehrlich_weggelassen, abgeschnitten }:
 *  - liste: die Arten für den Prompt, nach Slug geordnet; auch kiSlugAusListe prüft gegen SIE
 *  - weggelassen: Slugs, die nicht hineinpassten (zuerst die harmlosesten)
 *  - gefaehrlich_weggelassen: davon die toedlichen/giftigen — muss leer sein, sonst ist die Grenze zu klein
 *  - abgeschnitten: die Abfrage hat ihre eigene Grenze erreicht (es kann mehr Arten geben, als geholt wurden)
 */
/**
 * Die Kandidaten, die das Modell neben dem Treffer nennt — mit Namen und Essbarkeit aus der Liste, die
 * es gesehen hat (sonst stünde in der App ein Slug, und ein tödlicher Kandidat sähe aus wie jeder
 * andere). Ein Slug, der nicht in der Liste steht, fällt weg; höchstens `max`, ohne Dubletten.
 */
export function pilzAlternativen(slugs, liste, max = 3) {
  const nach = new Map((Array.isArray(liste) ? liste : []).filter((z) => z && typeof z.slug === "string").map((z) => [z.slug, z]));
  const aus = [];
  for (const s of (Array.isArray(slugs) ? slugs : [])) {
    if (typeof s !== "string" || !nach.has(s) || aus.some((a) => a.slug === s)) continue;
    const z = nach.get(s);
    aus.push({ slug: s, name: typeof z.common_name_de === "string" && z.common_name_de ? z.common_name_de : null, wiss: typeof z.scientific_name === "string" ? z.scientific_name : null, edibility: typeof z.edibility === "string" ? z.edibility : null });
    if (aus.length >= max) break;
  }
  return aus;
}

export function pilzWissenAuswahl(zeilen, opts) {
  const max = (opts && Number.isInteger(opts.max) && opts.max >= 0) ? opts.max : PILZ_WISSEN_MAX;
  const geholt = (opts && Number.isInteger(opts.geholt) && opts.geholt > 0) ? opts.geholt : PILZ_ZEILEN_HOLEN;
  const roh = Array.isArray(zeilen) ? zeilen : [];
  const gesehen = new Set();
  const gueltig = [];
  for (const z of roh) {
    if (!z || typeof z.slug !== "string" || !z.slug || gesehen.has(z.slug)) continue;
    gesehen.add(z.slug);
    gueltig.push(z);
  }
  const abgeschnitten = roh.length >= geholt;
  if (gueltig.length <= max) {
    return { liste: gueltig.slice().sort(nachSlug), weggelassen: [], gefaehrlich_weggelassen: [], abgeschnitten };
  }
  const nachGefahr = gueltig.slice().sort((a, b) => pilzGefahrRang(a.edibility) - pilzGefahrRang(b.edibility) || nachSlug(a, b));
  const behalten = nachGefahr.slice(0, max).sort(nachSlug);
  const weg = nachGefahr.slice(max);
  return {
    liste: behalten,
    weggelassen: weg.map((z) => z.slug),
    gefaehrlich_weggelassen: weg.filter((z) => pilzGefahrRang(z.edibility) <= PILZ_GEFAHR_RANG.giftig).map((z) => z.slug),
    abgeschnitten,
  };
}
