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
// v33.59: die zweite Bauform — der Name entsteht zuerst in einer VARIABLEN
// (`var key = 'gs_x_' + tag;` … `localStorage.setItem(key, …)`). Fuenf Familien
// (gs_frost_logged_, gs_weather_logged_, gs_score_logged_, gs_sh_lastalert_,
// gs_corrupt_bak__) fielen damit durch die Suche oben und ueberlebten das
// Abmelden, ohne dass dieser Pruefstand sie je gesaet hat.
const praefixeVariable = new Set();
for (const m of QUELLE.matchAll(/(?:var|let|const)\s+([A-Za-z_$][\w$]*)\s*=\s*['"]([A-Za-z0-9_.:-]+_)['"]\s*\+/g)) {
  const danach = QUELLE.slice(m.index, m.index + 1500);
  if (new RegExp(ZUGRIFF + "\\(\\s*" + m[1].replace(/\$/g, '\\$') + "\\s*[,)]").test(danach)) {
    praefixe.add(m[2]); praefixeVariable.add(m[2]);
  }
}
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

  // ── F · Tagesfamilien und Sicherungen sind GEDECKELT (v33.59) ──────────
  // In der Liste zu stehen hilft erst beim Abmelden; solange jemand angemeldet
  // bleibt, entstand je Tag ein Schluessel. Gefahren wird der ECHTE Schreibweg
  // je Familie, mit alten Tagen davor — danach darf nur heute uebrig sein.
  const F = await page.evaluate(async () => {
    const out = {};
    const familie = (p) => { const r = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(p) === 0) r.push(k); } return r.sort(); };
    const saeen = (p, tage) => tage.forEach(t => localStorage.setItem(p + t, '1'));
    const heuteIso = new Date().toISOString().slice(0, 10);
    const alt = ['2025-01-01', '2025-06-30', '2026-01-02'];
    window.sbIsLoggedIn = () => true;
    window.sbFetch = async () => ({ data: [], error: null });
    window.sbGetConfig = () => true;
    const echtGet = gsStore.get;
    gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-00000000000a' : echtGet.call(gsStore, k, d));
    const fahre = async (name, p, f) => {
      saeen(p, alt);
      try { await f(); } catch (e) { out[name] = { fehler: String(e && e.message || e) }; return; }
      out[name] = { uebrig: familie(p) };
    };
    // Garten-Score
    await fahre('gs_score_logged_', 'gs_score_logged_', () => window.gsLogGardenScore());
    // Frost: Vorhersage mit Frost heute
    await fahre('gs_frost_logged_', 'gs_frost_logged_', async () => {
      _gsWeatherData = { daily: { time: [0, 1, 2, 3, 4].map(i => new Date(Date.now() + i * 864e5).toISOString().slice(0, 10)),
        temperature_2m_min: [-3, 5, 6, 7, 8], temperature_2m_max: [4, 9, 9, 9, 9] } };
      gsCheckFrostWarning();
    });
    // Wetter: gestellter Wetterdienst
    await fahre('gs_weather_logged_', 'gs_weather_logged_', async () => {
      const tage = [0, 1, 2, 3, 4, 5, 6].map(i => new Date(Date.now() + i * 864e5).toISOString().slice(0, 10));
      const n = (v) => tage.map(() => v);
      const data = { current_weather: { temperature: 12, weathercode: 1, windspeed: 5 },
        hourly: { time: [], temperature_2m: [] },
        daily: { time: tage, weathercode: n(1), temperature_2m_max: n(15), temperature_2m_min: n(5), precipitation_sum: n(0),
          precipitation_probability_max: n(10), windspeed_10m_max: n(10), sunrise: n(tage[0] + 'T07:00'), sunset: n(tage[0] + 'T17:00'), uv_index_max: n(2) } };
      const echtFetch = window._gsFetch;
      window._gsFetch = async () => ({ ok: true, status: 200, json: async () => data });
      try { await loadGardenWeather(true); } finally { window._gsFetch = echtFetch; }
    });
    // KI-Tageszaehler (dasselbe Muster, Geschwister): Gratis-Plan
    localStorage.setItem('gs_abo_plan', 'free');
    await fahre('gs_aicalls_', 'gs_aicalls_', () => gsAboTrackAICall());
    out.heute = { iso: heuteIso, ds: new Date().toDateString() };
    // Sicherung beschaedigter Schluessel: 9 alte Sicherungen, dann ein unrettbarer Schluessel
    for (let i = 1; i <= 9; i++) localStorage.setItem('gs_corrupt_bak__ps_votes__' + (1700000000000 + i), 'alt-' + i);
    localStorage.setItem('ps_feedback', 'kaputt{{{');
    window.gsStorageIntegrityCheck();
    out.bak = { uebrig: familie('gs_corrupt_bak__'), max: window.GS_CORRUPT_BAK_MAX, original: localStorage.getItem('ps_feedback') };
    // Gegenrichtung: alle Sicherungen, die geblieben sind, sind die NEUESTEN (die von eben dabei)
    familie('gs_corrupt_bak__').forEach(k => localStorage.removeItem(k));
    // Gegnerische Pruefung: SIEBEN unrettbare Schluessel in EINEM Lauf — der Deckel darf keine
    // Sicherung dieses Laufs nehmen (ihr Original ist schon entfernt, sie ist die einzige Kopie).
    const sieben = ['ps_feedback', 'ps_votes', 'gs_ki_analyses', 'gs_scan_corrections', 'gs_garden_plan_current', 'gs_streak', 'userLocation'];
    const vorher7 = {};
    sieben.forEach(k => { vorher7[k] = localStorage.getItem(k); localStorage.setItem(k, 'kaputt{{{' + k); });
    window.gsStorageIntegrityCheck();
    const b7 = familie('gs_corrupt_bak__');
    out.runde = { fehlt: sieben.filter(k => !b7.some(x => x.indexOf('gs_corrupt_bak__' + k + '__') === 0)), anzahl: b7.length };
    b7.forEach(k => localStorage.removeItem(k));
    sieben.forEach(k => { if (vorher7[k] !== null) localStorage.setItem(k, vorher7[k]); });
    gsStore.get = echtGet;
    return out;
  });

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

  // ── F · Deckel ─────────────────────────────────────────────────────────
  console.log('  Präfixe aus der Bauform „Name in einer Variablen": ' + Array.from(praefixeVariable).sort().join(', '));
  const fFehl = [];
  const heuteKey = { gs_score_logged_: 'gs_score_logged_' + F.heute.iso, gs_frost_logged_: 'gs_frost_logged_' + F.heute.iso,
    gs_weather_logged_: 'gs_weather_logged_' + F.heute.iso, gs_aicalls_: 'gs_aicalls_' + F.heute.ds };
  Object.keys(heuteKey).forEach(p => {
    const e = F[p];
    if (!e || e.fehler) { fFehl.push(p + ': Schreibweg warf ' + (e && e.fehler)); return; }
    const soll = [heuteKey[p]];
    if (JSON.stringify(e.uebrig) !== JSON.stringify(soll)) fFehl.push(p + ': nach dem Schreiben ' + JSON.stringify(e.uebrig) + ' statt nur ' + JSON.stringify(soll));
  });
  const bak = F.bak.uebrig;
  const neuste = bak.filter(k => /^gs_corrupt_bak__ps_feedback__/.test(k));
  if (typeof F.bak.max !== 'number' || bak.length > F.bak.max) fFehl.push('gs_corrupt_bak__: ' + bak.length + ' Sicherungen (Deckel ' + F.bak.max + ')');
  if (neuste.length !== 1 || F.bak.original !== null) fFehl.push('gs_corrupt_bak__: die Sicherung von eben fehlt oder das Original blieb (' + JSON.stringify(neuste) + ')');
  if (F.runde.fehlt.length) fFehl.push('gs_corrupt_bak__: der Deckel nahm Sicherungen DESSELBEN Laufs (einzige Kopie): ' + F.runde.fehlt.join(', '));
  if (bak.some(k => /__ps_votes__170000000000[1-5]$/.test(k))) fFehl.push('gs_corrupt_bak__: es blieben ALTE statt der neuesten: ' + JSON.stringify(bak));
  console.log('  F · Tagesfamilien und Sicherungen gedeckelt: ' + (fFehl.length ? fFehl.length + ' Befund(e)' : 'ja (je Familie nur heute · ' + bak.length + ' Sicherungen, die neuesten)'));
  fFehl.forEach(x => console.log('       ' + x));
  console.log('');

  const schlimm = unklar.length + trotzdem.length + weg.length + doppelt.length + fFehl.length;
  console.log(schlimm === 0 && gA && gC
    ? '  ✓ Jeder überlebende Schlüssel ist benannt.'
    : '  ✗ ' + schlimm + ' Befund(e) — siehe oben.');
  process.exit(schlimm === 0 && gA && gC ? 0 : 1);
})();
