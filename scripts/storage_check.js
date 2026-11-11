#!/usr/bin/env node
/**
 * storage_check.js — was ueberlebt das Abmelden?
 *
 * Die vierzehn anderen Pruefstaende fragen, wie die App aussieht, ob ein Tipp
 * ankommt, ob jemand ein Eingabefeld liest, ob das Gelesene existiert, ob das
 * Gespeicherte ankommt und ob sie ohne Netz laeuft. Keiner fragt, was auf dem
 * Geraet LIEGEN BLEIBT, wenn sich jemand abmeldet.
 *
 * Genau dort lag eine Klasse von Fehlern, die seit v29.10 SECHSMAL einzeln
 * repariert wurde — v29.10 (Abo-Cache), v29.19 (GPS-Tracks, Anzeigename),
 * v29.44 (Marktplatz-Chats, Experten-Antrag), v30.94 (Community-Entwurf),
 * v30.97 (Snapshot-Spur), v31.12 (Wander-Aufzeichnung). Jedes Mal ein Fund,
 * jedes Mal ein Nachtrag in GS_USER_KEYS, nie eine Pruefung dahinter.
 *
 * Erster Lauf (v32.21): von 209 gesetzten Schluesseln ueberlebten 130 das
 * Abmelden, 123 davon standen in KEINER Liste — darunter der persoenlich
 * hinterlegte Anthropic-Schluessel, der globale Schluessel, die lokale
 * Anmelde-Ablage mit E-Mail-Adressen und der Admin-Passwort-Hash.
 *
 * DIE REGEL, DIE ER DURCHSETZT:
 *
 *   Jeder Schluessel, der das Abmelden ueberlebt, muss NAMENTLICH in
 *   GS_KEEP_ON_LOGOUT (oder GS_KEEP_PREFIXES) stehen.
 *
 * Damit ist „bleibt liegen" eine Entscheidung statt eines Versaeumnisses.
 * Wer einen neuen Schluessel anlegt, traegt ihn in eine der beiden Listen —
 * sonst meldet dieser Pruefstand ihn.
 *
 * GRENZE, ehrlich benannt: geprueft wird der localStorage. IndexedDB
 * (pending_scans, pending_photos, dropped_entries) und die Cache-API pruefen
 * offline_check.js bzw. niemand — ein Foto in der Warteschlange ueberlebt
 * das Abmelden weiterhin.
 *
 *   node scripts/storage_check.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const WURZEL = path.join(__dirname, '..');
const QUELLE = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');

// ── Welche Schluessel kennt der Quelltext? ───────────────────────────────
const ZUGRIFF = "(?:localStorage\\.(?:setItem|getItem|removeItem)|safeGetItem|safeSetItem|gsStore\\.(?:set|get|setJSON|getJSON|remove|del))";
const feste = new Set();
for (const m of QUELLE.matchAll(new RegExp(ZUGRIFF + "\\(\\s*['\"]([A-Za-z0-9_.:-]+)['\"]", 'g'))) feste.add(m[1]);
// Praefix-Bildungen: setItem('gs_x_' + irgendwas
const praefixe = new Set();
for (const m of QUELLE.matchAll(new RegExp(ZUGRIFF + "\\(\\s*['\"]([A-Za-z0-9_.:-]+_)['\"]\\s*\\+", 'g'))) praefixe.add(m[1]);
// Ein Praefix ist kein Schluessel — sonst meldet der Bericht 'gs_aicalls_'
// als unklassifiziert, obwohl es diesen Schluessel nie gibt.
praefixe.forEach(p => feste.delete(p));

const GEGENPROBE_FREMD = 'gs_pruefstand_fremddatum';   // in keiner Liste
const GEGENPROBE_LUEGE = 'gs_scan_history';            // steht in GS_USER_KEYS

(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message.split('\n')[0]));
  await page.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.addInitScript(SEED);
  await page.goto('file://' + path.join(WURZEL, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  const r = await page.evaluate((arg) => {
    const SPUR = 'SPUR-VON-NUTZER-A';
    const listen = () => ({
      user:  (typeof GS_USER_KEYS !== 'undefined') ? GS_USER_KEYS.slice() : null,
      keep:  (typeof GS_KEEP_ON_LOGOUT !== 'undefined') ? GS_KEEP_ON_LOGOUT.slice() : null,
      upre:  (typeof GS_USER_PREFIXES !== 'undefined') ? GS_USER_PREFIXES.slice() : null,
      kpre:  (typeof GS_KEEP_PREFIXES !== 'undefined') ? GS_KEEP_PREFIXES.slice() : null,
    });
    const L = listen();
    if (!L.user || !L.keep) return { fatal: 'GS_USER_KEYS oder GS_KEEP_ON_LOGOUT nicht gefunden' };

    // Alles, was der Quelltext kennt, plus alles, was beim Start wirklich
    // entstanden ist (dynamisch gebildete Namen sieht keine Textsuche).
    const laufend = [];
    for (let i = 0; i < localStorage.length; i++) laufend.push(localStorage.key(i));
    const alle = Array.from(new Set(
      arg.feste
        .concat(laufend)
        .concat(L.user).concat(L.keep)
        .concat((L.upre || []).map(p => p + 'PRUEFBEREICH'))
        .concat((L.kpre || []).map(p => p + 'PRUEFWERT'))
        .concat(arg.praefixe.map(p => p + 'PRUEFWERT'))
    )).filter(Boolean);

    const abmelden = () => {
      try { if (typeof gsClearUserDataKeys === 'function') gsClearUserDataKeys(); } catch (_) {}
      try { if (typeof sbClearSession === 'function') sbClearSession(); } catch (_) {}
      try { if (typeof gsOnLogout === 'function') gsOnLogout(); } catch (_) {}
    };
    const markieren = (keys) => {
      keys.forEach(k => { try { localStorage.setItem(k, SPUR); } catch (_) {} });
      return keys.filter(k => localStorage.getItem(k) === SPUR);
    };

    // ── Durchgang 1: der echte Weg ────────────────────────────────────────
    const gesetzt = markieren(alle);
    abmelden();
    const uebrig = gesetzt.filter(k => localStorage.getItem(k) === SPUR);

    // ── Durchgang 2: Gegenproben ─────────────────────────────────────────
    // (a) ein Schluessel in KEINER Liste muss gemeldet werden
    // (b) ein Schluessel, der als bleibend gefuehrt wird, aber geloescht
    //     wird, muss ebenfalls gemeldet werden
    GS_KEEP_ON_LOGOUT.push(arg.luege);
    const g = markieren([arg.fremd, arg.luege]);
    abmelden();
    const gUebrig = g.filter(k => localStorage.getItem(k) === SPUR);
    const idx = GS_KEEP_ON_LOGOUT.indexOf(arg.luege);
    if (idx >= 0) GS_KEEP_ON_LOGOUT.splice(idx, 1);

    return {
      listen: L, gesetzt: gesetzt.length, uebrig,
      gegen: { gesetzt: g, uebrig: gUebrig },
    };
  }, { feste: Array.from(feste), praefixe: Array.from(praefixe), fremd: GEGENPROBE_FREMD, luege: GEGENPROBE_LUEGE });

  await b.close();

  if (r.fatal) { console.log('ABBRUCH: ' + r.fatal); process.exit(1); }
  const L = r.listen;
  const inKeep = new Set(L.keep);
  const inUser = new Set(L.user);
  const kpre = L.kpre || [];
  const upre = L.upre || [];
  const bleibtErlaubt = k => inKeep.has(k) || kpre.some(p => k.indexOf(p) === 0);

  console.log('');
  console.log('  gesetzt: ' + r.gesetzt + ' Schlüssel · nach dem Abmelden noch da: ' + r.uebrig.length);
  console.log('  GS_USER_KEYS: ' + L.user.length + ' (+ ' + upre.length + ' Präfixe) · ' +
              'GS_KEEP_ON_LOGOUT: ' + L.keep.length + ' (+ ' + kpre.length + ' Präfixe)');
  console.log('');

  // ── A · überlebt, steht in keiner Liste ────────────────────────────────
  const unklar = r.uebrig.filter(k => !bleibtErlaubt(k));
  console.log('  A · überlebt das Abmelden, steht in KEINER Liste: ' + unklar.length);
  unklar.forEach(k => console.log('       ' + k));

  // ── B · steht in GS_USER_KEYS, überlebt trotzdem ───────────────────────
  const trotzdem = r.uebrig.filter(k => inUser.has(k));
  console.log('  B · steht in GS_USER_KEYS, überlebt trotzdem: ' + trotzdem.length);
  trotzdem.forEach(k => console.log('       ' + k));

  // ── C · wird als bleibend geführt, ist aber weg ────────────────────────
  const weg = L.keep.filter(k => !r.uebrig.includes(k));
  console.log('  C · in GS_KEEP_ON_LOGOUT geführt, aber gelöscht: ' + weg.length);
  weg.forEach(k => console.log('       ' + k));

  // ── D · in beiden Listen (Widerspruch) ─────────────────────────────────
  const doppelt = L.keep.filter(k => inUser.has(k));
  console.log('  D · in BEIDEN Listen (Widerspruch): ' + doppelt.length);
  doppelt.forEach(k => console.log('       ' + k));

  // ── E · Karteileichen: benannt, aber im Quelltext nirgends ─────────────
  const tot = L.keep.concat(L.user).filter(k => !feste.has(k) && !QUELLE.includes("'" + k + "'"));
  console.log('  E · in einer Liste, aber im Quelltext unbekannt: ' + tot.length + (tot.length ? '  (Hinweis, kein Fehler)' : ''));
  tot.forEach(k => console.log('       ' + k));

  // ── Gegenproben ────────────────────────────────────────────────────────
  const gA = r.gegen.uebrig.includes(GEGENPROBE_FREMD) && !bleibtErlaubt(GEGENPROBE_FREMD);
  const gC = !r.gegen.uebrig.includes(GEGENPROBE_LUEGE);
  console.log('');
  console.log('  Gegenprobe A (fremder Schlüssel wird gemeldet):        ' + (gA ? 'ja' : 'NEIN — der Prüfstand sieht nichts'));
  console.log('  Gegenprobe C (falsche Bleibt-Angabe wird gemeldet):    ' + (gC ? 'ja' : 'NEIN — der Prüfstand sieht nichts'));
  console.log('  JS-Fehler beim Laden: ' + (fehler.length ? fehler.slice(0, 3).join(' | ') : 'keine'));
  console.log('');

  const schlimm = unklar.length + trotzdem.length + weg.length + doppelt.length;
  console.log(schlimm === 0 && gA && gC
    ? '  ✓ Jeder überlebende Schlüssel ist benannt.'
    : '  ✗ ' + schlimm + ' Befund(e) — siehe oben.');
  process.exit(schlimm === 0 && gA && gC ? 0 : 1);
})();
