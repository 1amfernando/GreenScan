#!/usr/bin/env node
// android_check.js — haelt die App, was eine Android-App verspricht?
//
//   node scripts/android_check.js
//
// Anlass: Fernandos „Ich will es auch langsam als apk fuer Android sowie haben."
// Eine TWA (Trusted Web Activity) ist diese PWA in einer Android-Huelle. Alles,
// was im Browser funktioniert, funktioniert darin — mit EINER Ausnahme, und die
// ist die teuerste: der **Zurueck-Knopf** (und die Wischgeste) sprechen mit der
// Browser-History. Vor v33.43 gemessen:
//
//   0 Treffer auf history.pushState · 0 auf popstate · 0 auf history.back
//
// Das heisst: wer in der Android-App ein Fenster offen hat und zurueck drueckt,
// **schliesst die ganze App**. Rund vierzig Fenster, elf Tabs. Im Browser faellt
// das nicht auf (dort gibt es den Knopf nicht), auf dem Telefon bei jedem
// zweiten Handgriff.
//
// Die Regel dafuer gab es schon — sie hing nur an der falschen Taste: der
// Escape-Handler (v32.67) schliesst genau das oberste Fenster, und `gsGoBack`
// kennt den Tab-Stapel. `gsZurueck()` ist beides in EINER Funktion, an BEIDEN
// Ausloesern.
//
// Grenze: hier laeuft keine Android-Huelle. Geprueft ist die RECHNUNG — was die
// App auf ein `popstate` hin tut — nicht, wie sich ein echtes Geraet verhaelt.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');
const WURZEL = path.resolve(__dirname, '..');

const FAELLE = [
  {
    name: 'Der Zurück-Knopf erreicht die App · ein echtes popstate schliesst das Fenster',
    lauf: async () => {
      // WICHTIG: hier wird nicht gsZurueck() gerufen, sondern der ECHTE Weg
      // gegangen — history.back() → popstate → die App. Genau das tut der
      // Android-Knopf. Ein Fall, der die Funktion direkt ruft, misst die
      // Rechnung und nicht den Draht: die Gegenprobe „popstate hört nicht
      // mehr zu" blieb damit grün.
      if (typeof window.gsZurueck !== 'function')
        return { ok: false, warum: 'gsZurueck fehlt — in einer Android-App schliesst der Zurück-Knopf damit die ganze App' };
      switchTab('home');
      await new Promise(r => setTimeout(r, 250));
      openModal('scan-history-modal');
      await new Promise(r => setTimeout(r, 250));
      const m = document.getElementById('scan-history-modal');
      if (!m || !m.classList.contains('open')) return { ok: false, warum: 'das Fenster ging gar nicht auf' };
      history.back();
      await new Promise(r => setTimeout(r, 500));
      if (m.classList.contains('open')) return { ok: false, warum: 'ein echter Zurück-Druck (popstate) hat das offene Fenster nicht geschlossen' };
      return { ok: true, info: 'history.back() → popstate → Fenster zu' };
    },
  },
  {
    name: 'Die OBERSTE Schicht · nicht die erste, die gefunden wird',
    lauf: async () => {
      // Die Daten müssen die zwei denkbaren Regeln auseinanderziehen (v33.28):
      // zuerst ein gestapeltes Fenster (z 4000), dann ein Vollbild-Fenster mit
      // HÖHEREM z-index — in der Sammelreihenfolge steht das gestapelte VORNE.
      // „Die erste gefundene" und „die oberste" sind damit verschiedene Fenster.
      openModal('scan-history-modal');
      await new Promise(r => setTimeout(r, 60));
      const a = document.getElementById('scan-history-modal');
      const b = document.getElementById('modal-dq-ranking');   // Vollbild, z 5600
      if (!a || !b) return { ok: false, warum: 'die zwei Fenster gibt es nicht' };
      b.style.display = 'flex';
      await new Promise(r => setTimeout(r, 60));
      const za = parseInt(getComputedStyle(a).zIndex, 10) || 0;
      const zb = parseInt(getComputedStyle(b).zIndex, 10) || 0;
      if (!(zb > za)) return { ok: false, warum: 'der Fall trennt die Regeln nicht: z-index ' + za + ' vs. ' + zb };
      const was = gsZurueck();
      await new Promise(r => setTimeout(r, 400));
      const klagen = [];
      if (getComputedStyle(b).display !== 'none') klagen.push('das obere Fenster (z ' + zb + ') blieb offen — geschlossen wurde „' + was + '"');
      if (!a.classList.contains('open')) klagen.push('das untere Fenster (z ' + za + ') wurde mit geschlossen — ein Druck ist EINE Schicht');
      try { b.style.display = 'none'; closeModal('scan-history-modal'); } catch (_) {}
      await new Promise(r => setTimeout(r, 300));
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'z ' + zb + ' zu, z ' + za + ' offen' };
    },
  },
  {
    name: 'Eine Regel, zwei Auslöser · Escape und Zurück tragen dieselbe EINE Schicht ab',
    lauf: async () => {
      // Gemessen an der WIRKUNG, nicht am Quelltext: beide müssen dieselbe
      // Schicht abtragen. Zwei Regeln für dieselbe Frage sind ein Fehler,
      // der auf sein Datum wartet (v32.33).
      // Der Fall, an dem sich die alte und die neue Regel unterscheiden: ein
      // dynamischer Dialog UEBER einem gestapelten Fenster. Bis v33.42 schloss
      // Escape BEIDE in einem Druck (erst gsDismissOrphanOverlays, dann das
      // oberste Fenster) — ein Zurück-Druck ist EINE Schicht.
      const wirkung = async (ausloeser) => {
        openModal('scan-history-modal');
        await new Promise(r => setTimeout(r, 30));
        const dlg = document.createElement('div');
        dlg.id = 'gs-confirm-modal';
        dlg.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;';
        dlg.innerHTML = '<button class="modal-close-btn">x</button>';
        document.body.appendChild(dlg);
        await new Promise(r => setTimeout(r, 30));
        await ausloeser();
        await new Promise(r => setTimeout(r, 350));
        const s = [
          document.getElementById('scan-history-modal').classList.contains('open') ? 'fenster-offen' : 'fenster-zu',
          document.getElementById('gs-confirm-modal') ? 'dialog-offen' : 'dialog-zu',
        ].join('/');
        try { var d = document.getElementById('gs-confirm-modal'); if (d) d.remove(); } catch (_) {}
        try { closeModal('scan-history-modal'); } catch (_) {}
        await new Promise(r => setTimeout(r, 300));
        return s;
      };
      const esc = await wirkung(async () => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      });
      const zur = await wirkung(async () => { gsZurueck(); });
      const klagen = [];
      if (esc !== zur) klagen.push('Escape ergibt „' + esc + '", Zurück ergibt „' + zur + '" — zwei Regeln für dieselbe Frage');
      if (zur !== 'fenster-offen/dialog-zu') klagen.push('ein Druck trug „' + zur + '" ab — erwartet ist EINE Schicht (der Dialog), das Fenster bleibt');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'beide: ' + esc };
    },
  },
  {
    name: 'Ohne Fenster · Zurück geht auf den vorigen Tab, von der Startseite gibt es nichts mehr',
    lauf: async () => {
      try { closeModal('scan-history-modal'); closeModal('modal-twin-scan'); } catch (_) {}
      await new Promise(r => setTimeout(r, 300));
      switchTab('home');
      await new Promise(r => setTimeout(r, 100));
      switchTab('wissen');
      await new Promise(r => setTimeout(r, 200));
      const vorher = (document.querySelector('.screen.active') || {}).id || '?';
      const was1 = gsZurueck();
      await new Promise(r => setTimeout(r, 250));
      const nachher = (document.querySelector('.screen.active') || {}).id || '?';
      const klagen = [];
      if (nachher === vorher) klagen.push('der Tab hat sich nicht geändert (' + vorher + ')');
      if (was1 !== 'tab') klagen.push('Rückgabe „' + was1 + '" statt „tab"');
      // Und von der Startseite aus: nichts mehr zu schliessen.
      switchTab('home');
      await new Promise(r => setTimeout(r, 200));
      const was2 = gsZurueck();
      if (was2 !== 'app') klagen.push('auf der Startseite ergibt Zurück „' + was2 + '" statt „app" — dann käme man nie aus der App heraus');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: vorher + ' → ' + nachher + ' („tab"), Startseite → „app"' };
    },
  },
  {
    name: 'Der Verlauf wächst nicht · zehnmal öffnen und schliessen',
    lauf: async () => {
      if (typeof window._gsHistSync !== 'function')
        return { ok: false, warum: '_gsHistSync fehlt — ohne History-Eintrag erreicht der Zurück-Knopf die App gar nicht' };
      switchTab('home');
      await new Promise(r => setTimeout(r, 200));
      _gsHistSync();
      await new Promise(r => setTimeout(r, 100));
      const start = history.length;
      for (let i = 0; i < 10; i++) {
        openModal('scan-history-modal');
        await new Promise(r => setTimeout(r, 60));
        closeModal('scan-history-modal');
        await new Promise(r => setTimeout(r, 260));
      }
      const ende = history.length;
      if (ende - start > 1) return { ok: false, warum: 'der Verlauf wuchs um ' + (ende - start) + ' Einträge (10 Öffnungen) — jeder davon ist ein Zurück-Druck ins Leere' };
      return { ok: true, info: 'history.length ' + start + ' → ' + ende };
    },
  },
  {
    name: 'Per X geschlossen · der Verlauf steht danach wieder auf dem Grundeintrag',
    lauf: async () => {
      // Wer ein Fenster über sein X schliesst, hat den Zurück-Eintrag nicht
      // verbraucht. Ohne Entschärfung kostet der nächste Druck nichts —
      // er schliesst das Fenster, das schon zu ist.
      // Gemessen wird der VERLAUF, nicht die Wirkung von gsZurueck: wer ein
      // Fenster über sein X schliesst, hat den Eintrag nicht verbraucht.
      // Bleibt er stehen, kostet der nächste Druck nichts. Sichtbar ist das
      // an `history.state` — auf dem Grundeintrag ist es null.
      switchTab('home');
      await new Promise(r => setTimeout(r, 300));
      const grund = JSON.stringify(history.state);
      openModal('scan-history-modal');
      await new Promise(r => setTimeout(r, 300));
      const offen = JSON.stringify(history.state);
      if (offen === grund) return { ok: false, warum: 'beim Öffnen kam kein Verlaufs-Eintrag dazu (state blieb ' + grund + ')' };
      closeModal('scan-history-modal');           // per X, nicht per Zurück
      await new Promise(r => setTimeout(r, 600));
      const danach = JSON.stringify(history.state);
      if (danach !== grund)
        return { ok: false, warum: 'nach dem Schliessen per X steht der Verlauf auf ' + danach + ' statt auf dem Grundeintrag ' + grund + ' — der nächste Zurück-Druck wäre einer ins Leere' };
      return { ok: true, info: 'Grund ' + grund + ' → offen ' + offen + ' → nach X wieder ' + grund };
    },
  },
  {
    name: 'Ein Prädikat für „läuft als App" · android-app:// zählt, und es gibt kein zweites daneben',
    lauf: async (QUELLE) => {
      if (typeof window.gsLaeuftAlsApp !== 'function')
        return { ok: false, warum: 'gsLaeuftAlsApp fehlt — es gab zwei Prädikate, und nur eines kannte die Android-Hülle' };
      const klagen = [];
      // Der TWA-Fall: kein display-mode standalone, aber der Referrer sagt es.
      const echtMM = window.matchMedia;
      try {
        window.matchMedia = function () { return { matches: false, addEventListener: function () {}, addListener: function () {} }; };
        Object.defineProperty(document, 'referrer', { configurable: true, get: function () { return 'android-app://ch.greenscan.app'; } });
        if (gsLaeuftAlsApp() !== true) klagen.push('android-app:// wird nicht als App erkannt');
        Object.defineProperty(document, 'referrer', { configurable: true, get: function () { return 'https://green-scan.ch/'; } });
        if (gsLaeuftAlsApp() !== false) klagen.push('ein gewöhnlicher Browser-Aufruf gilt als App');
      } finally { window.matchMedia = echtMM; }
      // Und keine zweite Rechnung daneben.
      const roh = QUELLE.replace(/^\s*\/\/.*$/gm, '');
      const zweite = (roh.match(/referrer\s*\.\s*startsWith\s*\(\s*['"]android-app/g) || []).length;
      const standalone = (roh.match(/display-mode:\s*standalone/g) || []).length;
      if (zweite > 1) klagen.push(zweite + ' Stellen prüfen android-app:// selbst');
      if (standalone > 2) klagen.push(standalone + ' Stellen prüfen display-mode:standalone selbst — das gehört in gsLaeuftAlsApp');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'android-app:// → App · Browser → kein App · ' + standalone + ' display-mode-Stellen' };
    },
  },
  {
    name: 'Vollbild-Fenster · auch das Tagesquiz lässt sich zurück-schliessen, und die Liste ist die Prüfung',
    lauf: async (QUELLE) => {
      const klagen = [];
      if (!Array.isArray(window.GS_VOLLBILD_OVERLAYS))
        return { ok: false, warum: 'GS_VOLLBILD_OVERLAYS fehlt — neun Vollbild-Fenster (Tagesquiz, „Ueben", Lichtmesser …) erreicht weder Escape noch der Zurück-Knopf' };
      // a) jeder Eintrag löst auf
      GS_VOLLBILD_OVERLAYS.forEach(function (v) {
        if (!document.getElementById(v.id)) klagen.push(v.id + ': Element gibt es nicht');
        if (typeof window[v.zu] !== 'function') klagen.push(v.id + ': Schliess-Funktion ' + v.zu + ' löst nicht auf');
      });
      // b) die Liste ist vollständig: jedes Vollbild-Overlay im HTML ist
      //    entweder ein .modal-overlay, steht in der Liste, oder hat einen Grund.
      const bekannt = {};
      GS_VOLLBILD_OVERLAYS.forEach(function (v) { bekannt[v.id] = 1; });
      Object.keys(window.GS_VOLLBILD_OHNE_ZURUECK || {}).forEach(function (k) { bekannt[k] = 1; });
      const re = /<div([^>]{0,600}?)>/g; let m; const fehlend = [];
      while ((m = re.exec(QUELLE))) {
        const a = m[1];
        if (!/position:\s*fixed/.test(a) || !/inset:\s*0/.test(a)) continue;
        const id = (a.match(/id="([a-z0-9_-]+)"/i) || [])[1];
        if (!id) continue;
        const cls = (a.match(/class="([^"]*)"/) || [])[1] || '';
        if (/modal-overlay|overlay-modal/.test(cls)) continue;
        if (!bekannt[id]) fehlend.push(id);
      }
      if (fehlend.length) klagen.push(fehlend.length + ' Vollbild-Fenster in keiner Liste: ' + fehlend.join(', '));
      // c) und es wirkt wirklich: das Tagesquiz aufmachen und zurück
      const q = document.getElementById('modal-daily-quiz');
      if (q) {
        q.style.display = 'flex';
        await new Promise(r => setTimeout(r, 60));
        const was = gsZurueck();
        await new Promise(r => setTimeout(r, 350));
        if (was !== 'vollbild') klagen.push('das Tagesquiz ergibt „' + was + '" statt „vollbild"');
        if (getComputedStyle(q).display !== 'none') { klagen.push('das Tagesquiz blieb offen'); try { q.style.display = 'none'; } catch (_) {} }
      }
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 3).join(' · ') };
      return { ok: true, info: GS_VOLLBILD_OVERLAYS.length + ' in der Liste · ' + Object.keys(window.GS_VOLLBILD_OHNE_ZURUECK || {}).length + ' mit Grund ausgenommen · Tagesquiz zu' };
    },
  },
];

// ── assetlinks.json (Datei, kein Browser) ─────────────────────────────────
function fallAssetlinks() {
  const p = path.join(WURZEL, '.well-known', 'assetlinks.json');
  if (!fs.existsSync(p)) return { ok: false, warum: '.well-known/assetlinks.json fehlt — ohne sie zeigt Android in der App die Adressleiste' };
  let j;
  try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return { ok: false, warum: 'assetlinks.json ist kein gültiges JSON: ' + e.message }; }
  if (!Array.isArray(j) || !j.length) return { ok: false, warum: 'assetlinks.json ist keine nicht-leere Liste' };
  const e0 = j[0] || {};
  const t = e0.target || {};
  const klagen = [];
  if (!(e0.relation || []).includes('delegate_permission/common.handle_all_urls')) klagen.push('relation delegate_permission/common.handle_all_urls fehlt');
  if (t.namespace !== 'android_app') klagen.push('namespace ist nicht android_app');
  if (!t.package_name) klagen.push('package_name fehlt');
  const fp = t.sha256_cert_fingerprints || [];
  if (!fp.length) klagen.push('sha256_cert_fingerprints ist leer');
  if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
  const platzhalter = fp.filter(function (x) { return !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/i.test(String(x)); });
  if (platzhalter.length)
    return { offen: true, warum: platzhalter.length + ' von ' + fp.length + ' Fingerabdrücken sind Platzhalter (' + String(platzhalter[0]).slice(0, 40) + '…) — sie kommen aus Play App Signing und sind Fernandos Handgriff, kein Code-Fehler' };
  return { ok: true, info: t.package_name + ' · ' + fp.length + ' Fingerabdrücke' };
}

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.join(WURZEL, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true; window.gsToast = () => {}; window.showProfileToast = () => {};
  });
  const QUELLE = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');

  console.log('\n=== android_check — haelt die App, was eine Android-App verspricht?');
  let kaputt = 0, offen = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await p.evaluate(new Function('QUELLE', 'return (' + f.lauf.toString() + ')(QUELLE)'), QUELLE); }
    catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  const al = fallAssetlinks();
  if (al.ok) console.log('  ok   assetlinks.json · die Android-App darf diese Adresse führen   [' + al.info + ']');
  else if (al.offen) { offen++; console.log('  offen assetlinks.json · die Android-App darf diese Adresse führen\n         → ' + al.warum); }
  else { kaputt++; console.log('  !!   assetlinks.json · die Android-App darf diese Adresse führen\n         → ' + al.warum); }

  console.log('  ---');
  console.log('  Faelle geprueft: ' + (FAELLE.length + 1) + ' · davon kaputt: ' + kaputt + ' · offen (Fernandos Handgriff): ' + offen);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: hier laeuft keine Android-Huelle. Geprueft ist, was die App auf ein');
  console.log('  popstate hin TUT — nicht, wie sich ein echtes Geraet verhaelt.');
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
