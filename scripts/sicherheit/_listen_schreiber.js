// _listen_schreiber.js — der Klassenwaechter fuer EIGENE Listen (v33.59, Gruppe s1).
// Kein Fall-Modul (der Unterstrich haelt es aus sicherheit_check heraus);
// 98_schluss_e.js benutzt es.
//
// Regel: jeder Schreiber eines Listen-Schluessels (setItem / gsStore.set(JSON) /
// _gsRestoreKey mit festem Schluessel) hat das Sieb in derselben Anweisung
// (_gsSiebListe) oder geht durch _gsListeEinspielen — oder er steht unten mit
// Grund in LOKALE_SCHREIBER (er schreibt, was die Person auf DIESEM Geraet
// gerade getan hat). Dasselbe fuer die Zuweisungen an die Variablen.
'use strict';

const SCHLUESSEL = ['ps_myplants', 'gs_gardens', 'gs_plantings', 'gs_dead_plants', 'gs_gartentagebuch', 'gs_garden_plans', 'gs_ernte_log'];
const VARIABLEN = ['gardens', 'plantings', 'myPlants', 'deadPlants'];

// 'Funktion|Schluessel' → Grund. Die Funktion ist die umschliessende Funktion
// der obersten (bzw. zweiten) Ebene, wie `umschliessend()` sie findet.
const LOKALE_SCHREIBER = {
  'gsSaeLogAsSowed|gs_gartentagebuch': 'Tagebuch-Eintrag aus dem eigenen Saekalender-Knopf',
  'gsErnteAdd|gs_ernte_log': 'Ernte aus dem eigenen Formular',
  'gsErnteDelete|gs_ernte_log': 'Loeschen aus der eigenen Liste',
  'gsTagebuchSave|gs_gartentagebuch': 'schreibt die geladene eigene Liste zurueck (gsTagebuchLoad)',
  'savePlantsToStorage|ps_myplants': 'schreibt die Variable myPlants — jeder fremde Eingang setzt sie gesiebt',
  'moveToCemetery|gs_dead_plants': 'eigene Pflanze in den Friedhof',
  'restoreFromCemetery|gs_dead_plants': 'eigene Pflanze aus dem Friedhof',
  'gsHarvestSubmit|gs_ernte_log': 'Ernte aus dem eigenen Formular',
  'gsPPsavePlan|gs_garden_plans': 'Plan aus dem eigenen Planer (KI-Teil vorher durch gsSanitizePlannerPlan)',
  'gsPPopenSavedPlans|gs_garden_plans': 'kuerzt die eigene Liste auf 30',
  'gsPPdeletePlan|gs_garden_plans': 'Loeschen aus der eigenen Liste',
  'gsPPrenamePlan|gs_garden_plans': 'Umbenennen aus dem eigenen Dialog',
  'gsPPvorlageNaechstesJahr|gs_garden_plans': 'Kopie eines eigenen Plans',
  'gsPPduplicatePlan|gs_garden_plans': 'Kopie eines eigenen Plans',
  'saveGardenData|gs_gardens': 'schreibt die Variable gardens — jeder fremde Eingang setzt sie gesiebt',
  'saveGardenData|gs_plantings': 'schreibt die Variable plantings — jeder fremde Eingang setzt sie gesiebt',
  'gsMigrateLegacyHarvestLog|gs_ernte_log': 'Umzug aus dem alten lokalen Schluessel desselben Geraets',
};

function umschliessend(t, i) {
  const vor = t.slice(Math.max(0, i - 120000), i);
  const re = /\n {0,2}(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(|\n {0,2}(?:window\.)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?function\b/g;
  let m, l = null;
  while ((m = re.exec(vor))) l = m;
  return l ? (l[1] || l[2]) : '?';
}

// Der Aufruf ab `i` bis zur schliessenden Klammer (Zeichenketten uebersprungen).
function aufruf(t, i) {
  let j = t.indexOf('(', i), tiefe = 0;
  for (; j < t.length && j < i + 2000; j++) {
    const c = t[j];
    if (c === '"' || c === "'") { const q = c; j++; while (j < t.length && t[j] !== q && t[j] !== '\n') { if (t[j] === '\\') j++; j++; } continue; }
    if (c === '(') tiefe++;
    else if (c === ')') { tiefe--; if (!tiefe) return t.slice(i, j + 1); }
  }
  return t.slice(i, i + 300);
}

function zeile(t, i) { return t.slice(0, i).split('\n').length; }

function pruefe(t) {
  const rot = [], benutzt = new Set();
  let gesamt = 0, gesiebt = 0, lokal = 0, variablen = 0;
  const K = SCHLUESSEL.join('|');
  const re = new RegExp("(localStorage\\.setItem|gsStore\\.setJSON|gsStore\\.set|_gsRestoreKey|_gsListeEinspielen)\\(\\s*['\"](" + K + ")['\"]", 'g');
  // _gsRestoreKey gilt nur als Eingang, wenn sein Rumpf die Listen wirklich durch
  // _gsListeEinspielen schickt — gemessen, nicht angenommen.
  const rk = t.indexOf('function _gsRestoreKey(');
  const rkRumpf = rk < 0 ? '' : t.slice(rk, t.indexOf('\n}\n', rk));
  const restoreSiebt = /GS_LISTEN_EINGANG/.test(rkRumpf) && /_gsListeEinspielen\(/.test(rkRumpf);
  let m;
  while ((m = re.exec(t))) {
    gesamt++;
    const fn = umschliessend(t, m.index);
    const a = aufruf(t, m.index);
    if (m[1] === '_gsListeEinspielen' || /_gsSiebListe\(|_gsListeEinspielen\(/.test(a) || (m[1] === '_gsRestoreKey' && restoreSiebt)) { gesiebt++; continue; }
    const k = fn + '|' + m[2];
    if (LOKALE_SCHREIBER[k]) { lokal++; benutzt.add(k); continue; }
    rot.push(k + ' (Z. ' + zeile(t, m.index) + ': ' + a.replace(/\s+/g, ' ').slice(0, 90) + ')');
  }
  // Zuweisungen an die Variablen: lokal ist nur, was aus der eigenen Liste
  // (filter), dem eigenen Speicher (safeGetItem), dem Leeren oder dem Sieb kommt.
  const reV = new RegExp('(?<![.\\w$])(?:window\\.)?(' + VARIABLEN.join('|') + ')\\s*=(?![=>])([^;\\n]*)', 'g');
  while ((m = reV.exec(t))) {
    variablen++;
    const name = m[1], rhs = m[2].trim();
    // Gegenpruefung s1: „[]" nur allein und „.filter(…)" ohne Anhang — sonst
    // waeren `myPlants = [].concat(fremd)` und `.filter(…).concat(fremd)` lokal.
    const nurFilter = rhs.indexOf(name + '.filter(') === 0 && !/\.\s*(concat|push|splice)\s*\(|\.\.\./.test(rhs);
    const ok = nurFilter || /^\[\]\s*$/.test(rhs) || /^safeGetItem\(/.test(rhs)
      || rhs.indexOf('window.' + name + ' ||') === 0 || /_gsSiebListe\(|_gsListeEinspielen\(/.test(rhs);
    if (ok) continue;
    const fn = umschliessend(t, m.index);
    const k = 'var:' + name + '@' + fn;
    if (LOKALE_SCHREIBER[k]) { benutzt.add(k); continue; }
    rot.push(k + ' (Z. ' + zeile(t, m.index) + ': ' + (name + ' = ' + rhs).slice(0, 90) + ')');
  }
  const veraltet = Object.keys(LOKALE_SCHREIBER).filter(k => !benutzt.has(k));
  return { rot, veraltet, gesamt, gesiebt, lokal, variablen };
}

module.exports = { pruefe, LOKALE_SCHREIBER, SCHLUESSEL, VARIABLEN };
