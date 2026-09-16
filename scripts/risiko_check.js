#!/usr/bin/env node
// risiko_check.js — was geht SPAETER schief?
//
//   node scripts/risiko_check.js
//
// Anlass: Fernandos „Detektiere probleme die später auftauchen könnte und
// bringe da 1a Lösungen." Die anderen Pruefstaende fragen, ob die App HEUTE
// stimmt. Dieser fragt, was an einem Datum oder an einer Groesse aufhoert zu
// stimmen — und niemandem auffaellt, weil es heute noch geht.
//
// Befund, der ihn ausgeloest hat (16.09.2026): `WEEKLY_SEASONAL_FACTS` hat 521
// Eintraege und wird NUR nach Kalenderwoche ausgewaehlt (`gsGetKW`) — die Liste
// wiederholt sich also jedes Jahr. Elf Zeilen darin nannten ein Jahr im Sinn
// von „dieses Jahr": „Pilzsaison 2026: Ausblick", „Jahresrueckblick Natur
// 2026", „Planung fuer 2027". **Ab dem 1. Januar 2027 haette die App in Woche
// 13 von einer Saison erzaehlt, die vorbei ist** — jedes Jahr wieder.
//
// Er liest nur den Quelltext und braucht keinen Browser.
//
// Grenze: er findet, was sich AUSZAEHLEN laesst. Ein Dienst, der abgeschaltet
// wird, eine Richtlinie, die sich aendert, ein Schluessel, der ablaeuft —
// davon steht hier nichts. Die stehen in docs/RISIKEN.md, mit Datum und ohne
// Pruefstand, und das sagt der Bericht auch.
'use strict';
const fs = require('fs');
const path = require('path');
const WURZEL = path.resolve(__dirname, '..');
const QUELLE = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');

// ── R1 ────────────────────────────────────────────────────────────────────
// Eine Jahreszahl in einem jaehrlich wiederkehrenden Text ist nur dann
// richtig, wenn sie einen FESTEN Punkt nennt — ein Zieljahr, einen datierten
// Bericht, ein Ereignis. Was „dieses Jahr" oder „naechstes Jahr" meint, ist ab
// dem 1. Januar falsch. Das laesst sich nicht rechnen, also wird es ERKLAERT:
// die Liste ist die Pruefung.
const GS_JAHR_FEST = [
  { text: 'bis 2030 Rückgang der Artenvielfalt stoppen',
    grund: 'Zieljahr der nationalen Biodiversitätsstrategie — in jedem Jahr dieselbe Aussage.' },
  { text: 'Die Schweiz hat 2023 eine neue Verfassungsinitiative für Biodiversität angenommen',
    grund: 'Datiertes Ereignis. Es altert nicht, es wird nur älter.' },
  { text: "Umwelt Schweiz 2023",
    grund: 'Zitierter Bericht mit seinem Titel. Erscheint alle 4 Jahre; der Titel gehört dazu.' },
];

function r1() {
  const z = QUELLE.split('\n');
  const start = z.findIndex(l => /const WEEKLY_SEASONAL_FACTS = \[/.test(l));
  if (start < 0) return { ok: false, warum: 'WEEKLY_SEASONAL_FACTS nicht gefunden — heisst die Liste noch so?' };
  let ende = start;
  for (let i = start + 1; i < z.length; i++) { if (/^\];/.test(z[i])) { ende = i; break; } }
  const eintraege = ende - start - 1;
  if (eintraege < 100) return { ok: false, warum: 'nur ' + eintraege + ' Zeilen in der Liste — der Fall misst offenbar etwas anderes' };
  const klagen = [];
  let erlaubt = 0;
  for (let i = start + 1; i < ende; i++) {
    const zeile = z[i];
    const jahre = zeile.match(/\b20[2-9]\d\b/g);
    if (!jahre) continue;
    const ok = GS_JAHR_FEST.some(e => zeile.indexOf(e.text) >= 0);
    if (ok) { erlaubt += jahre.length; continue; }
    klagen.push('Z' + (i + 1) + ' (' + jahre.join(', ') + '): ' + zeile.trim().slice(0, 90));
  }
  if (klagen.length)
    return { ok: false, warum: klagen.length + ' Zeile(n) nennen ein Jahr, das nicht als fester Punkt erklärt ist — die Liste wiederholt sich jährlich: ' + klagen.slice(0, 3).join(' · ') };
  return { ok: true, info: eintraege + ' Wochen-Einträge · ' + erlaubt + ' Jahresnennungen, alle mit Grund erklärt' };
}

// ── R2 ────────────────────────────────────────────────────────────────────
// Jede Listen-Abfrage ohne `limit=` ist eingeordnet: Katalog (waechst mit dem
// Inhalt, nicht mit der Nutzung) · Einzelzeile · waechst-mit-der-Person (dann
// mit einer Entscheidung daneben). Was in keiner Klasse steht, wird gemeldet.
//
// ACHTUNG, das war mein eigener Messfehler beim Bauen: ein Pfad wird aus
// MEHREREN Literalen zusammengesetzt. Wer nur das erste liest, meldet
// `device_readings` als „ohne limit", obwohl das `limit=` im zweiten steht.
// Gelesen wird der GANZE erste Parameter von sbFetch(.
const KATALOG = [
  'stripe_prices', 'v_today_tip', 'v_today_quiz', 'metric_catalog', 'symptom_library',
  'garden_crop_agronomy', 'onboarding_highlights', 'app_settings', 'recipes', 'remedies',
  'folk_lore', 'garden_techniques', 'ch_planting_distance_rules', 'planting_materials',
  'tree_planting_specs_i18n', 'mushroom_lookalikes', 'mushroom_lookalikes_i18n',
  'mushroom_register', 'mushroom_growth_conditions', 'v_mushroom_lookalike_summary',
  'plant_companion_matrix', 'ar_models', 'v_species_stats',
];
const EINZELN = ['quiz_answers', 'push_subscriptions', 'user_collection_items', 'devices', 'device_rules', 'comment_reactions'];
const WAECHST = {
  'user_collections':    'Die System-Sammlungen einer Person (`system_key`) — eine Handvoll, von der App angelegt.',
  'v_user_collections':  'Anzahl Sammlungen je Person — von Hand angelegt, in der Praxis zweistellig. Ein Deckel wäre eine Obergrenze für etwas, das die Person selbst steuert.',
  'v_my_friends':        'Freundesliste. Wächst langsam und ist die vollständige Antwort auf die Frage.',
  'v_my_marketplace_seller': 'Eigene Inserate. Dieselbe Überlegung.',
  'v_marketplace_conversations': 'Nur `unread_count` — eine Spalte je Gespräch.',
  'sensor_devices':      'Alt-Schicht (OEKOSYSTEM-V1 §11 Idee 1, live 1 Zeile). Kein Wachstum ohne Entscheid.',
  'book_species_candidates': 'Admin, je Einlese-Auftrag. Ein Buch erzeugt hunderte Zeilen — gedeckelt, sobald das Werkzeug regelmässig läuft.',
  'ai_daily_usage':      'Admin, mit Datums-Filter (`date=gte.`). Das Fenster ist der Deckel.',
  'v_ai_usage_summary':  'Dasselbe Fenster.',
  'map_user_finds':      'Mit Zeitfilter (`found_at=gte.`).',
};

function ersterParam(txt, i) {
  let d = 0, q = null, esc = false, out = '';
  for (let j = i; j < txt.length; j++) {
    const c = txt[j];
    if (q) { out += c; if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; out += c; continue; }
    if (c === '(' || c === '[' || c === '{') { d++; out += c; continue; }
    if (c === ')' || c === ']' || c === '}') { if (d === 0) return out; d--; out += c; continue; }
    if (c === ',' && d === 0) return out;
    out += c;
  }
  return out;
}

function r2() {
  const re = /sbFetch\(\s*/g; let m;
  const unklar = [], gesehen = new Set();
  let gedeckelt = 0, katalog = 0, einzeln = 0, waechst = 0;
  while ((m = re.exec(QUELLE))) {
    const p = ersterParam(QUELLE, m.index + m[0].length);
    if (!/\/rest\/v1\//.test(p) || /\/rest\/v1\/rpc\//.test(p)) continue;
    if (!/select=/.test(p)) continue;
    const tab = (p.match(/\/rest\/v1\/([a-z0-9_]+)/) || [])[1];
    if (!tab) continue;
    if (/limit=/.test(p)) { gedeckelt++; continue; }
    if (/\bid=eq\./.test(p)) { einzeln++; continue; }
    if (KATALOG.indexOf(tab) >= 0) { katalog++; continue; }
    if (EINZELN.indexOf(tab) >= 0) { einzeln++; continue; }
    if (WAECHST[tab]) { waechst++; continue; }
    if (gesehen.has(tab)) continue;
    gesehen.add(tab);
    const zeile = QUELLE.slice(0, m.index).split('\n').length;
    unklar.push('Z' + zeile + ' ' + tab);
  }
  if (unklar.length)
    return { ok: false, warum: unklar.length + ' Listen-Abfrage(n) ohne limit= und ohne Einordnung: ' + unklar.slice(0, 5).join(' · ') + ' — jede gehört in KATALOG, EINZELN oder WAECHST (mit Grund)' };
  return { ok: true, info: gedeckelt + ' gedeckelt · ' + katalog + ' Katalog · ' + einzeln + ' Einzelzeile · ' + waechst + ' wächst-mit-der-Person (je mit Grund)' };
}

// ── R3 ────────────────────────────────────────────────────────────────────
// Jede Frist, die in docs/RISIKEN.md steht, muss im Quelltext eine Entsprechung
// haben — sonst ist die Doku eine Behauptung. Und umgekehrt: eine Zahl im Code,
// die eine Frist ist, gehoert ins Dokument.
function r3() {
  const p = path.join(WURZEL, 'docs', 'RISIKEN.md');
  if (!fs.existsSync(p)) return { ok: false, warum: 'docs/RISIKEN.md fehlt — ein Prüfstand ohne Dokument sagt nur, was er messen KANN' };
  const doc = fs.readFileSync(p, 'utf8');
  const klagen = [];
  // Die Konstanten, die im Dokument mit einer Zahl genannt sind, muessen im
  // Quelltext MIT DERSELBEN Zahl stehen.
  const paare = [...doc.matchAll(/`(GS_[A-Z_]+)`\s*=\s*\*\*(\d+)\*\*/g)];
  if (!paare.length) klagen.push('das Dokument nennt keine einzige Konstante mit Zahl (`GS_X` = **n**) — dann kann niemand prüfen, ob es stimmt');
  paare.forEach(([, name, wert]) => {
    const re = new RegExp('(?:var|const|let)\\s+' + name + '\\s*=\\s*(\\d+)');
    const m = re.exec(QUELLE);
    if (!m) klagen.push(name + ' steht im Dokument, aber nicht als Zahl im Quelltext');
    else if (m[1] !== wert) klagen.push(name + ': Dokument sagt ' + wert + ', Quelltext sagt ' + m[1]);
  });
  if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') };
  return { ok: true, info: paare.length + ' Konstante(n) im Dokument, jede stimmt mit dem Quelltext überein' };
}

const FAELLE = [
  { name: 'R1 · Kein „dieses Jahr" in einem Text, der jedes Jahr wiederkehrt', lauf: r1 },
  { name: 'R2 · Jede Listen-Abfrage ohne limit= ist eingeordnet — Katalog, Einzelzeile oder wächst-mit-der-Person', lauf: r2 },
  { name: 'R3 · Was docs/RISIKEN.md als Zahl nennt, steht so auch im Quelltext', lauf: r3 },
];

console.log('\n=== risiko_check — was geht SPAETER schief?');
let kaputt = 0;
for (const f of FAELLE) {
  let r;
  try { r = f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message }; }
  if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
  else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
}
console.log('  ---');
console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
console.log('  Grenze: hier wird AUSGEZAEHLT. Ein Dienst, der abgeschaltet wird, eine Richtlinie,');
console.log('  die sich aendert, ein Schluessel, der ablaeuft — das steht in docs/RISIKEN.md mit');
console.log('  Datum und OHNE Pruefstand. Was man nicht messen kann, sagt man gesondert.');
process.exitCode = kaputt ? 1 : 0;
