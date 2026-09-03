#!/usr/bin/env node
/**
 * einstellungen_check.js — hält der Einstellungs-Bildschirm, was seine
 * Schalter versprechen?
 *
 * Anlass ist ein Audit aus sechs Blickwinkeln (v32.33). Es fand 48 Stellen,
 * 20 davon haben eine gegnerische Gegenprüfung überstanden. Der rote Faden
 * war immer derselbe wie im Rest dieses Repos: **ein Schalter, der etwas
 * behauptet, das niemand nachgesehen hat.**
 *
 *   · „🔔 Push-Notifications aktiv!" — ohne je zu prüfen, ob der Server die
 *     Anmeldung angenommen hat. Ohne Zeile in `push_subscriptions` gibt es
 *     kein Push, und der Schalter stand trotzdem dauerhaft auf „an".
 *   · „✅ GPS aktiv — Standort wird automatisch erkannt" — während die App
 *     in derselben Sitzung schon wusste, dass der Browser die Freigabe
 *     verweigert. Zwei Speicher für dieselbe Frage, nie abgeglichen.
 *   · „Kamera immer neu abfragen · jede Anfrage bestätigen" — genau EINE
 *     Bestätigung, beim allerersten Scan. Zwölf weitere Kamera-Wege kannten
 *     den Schalter überhaupt nicht.
 *
 * ZWEI SPERREN, an denen ein naiver Lauf hängen bleibt (deshalb hier
 * ausdrücklich gestellt, nicht umgangen):
 *   · `Notification.requestPermission` — ohne Antwort bricht der Push-Weg ab,
 *     bevor irgendetwas passiert.
 *   · `location.reload` — der Sprachwechsel lädt die Seite neu und nimmt den
 *     Prüfstand mit.
 *
 * GRENZE, ehrlich benannt: es gibt hier weder eine echte Kamera noch einen
 * echten Supabase-Server. Geprüft ist die RECHNUNG und die AUSSAGE — was die
 * App aus einer Antwort macht, nicht ob die Antwort echt ist.
 *
 *   node scripts/einstellungen_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

let kaputt = 0;
const melde = (frage, ok, wie) => {
  if (!ok) kaputt++;
  console.log('  ' + (ok ? 'ok  ' : '!!  ') + ' ' + frage + (ok ? '   [' + wie + ']' : ''));
  if (!ok) console.log('         → ' + wie);
};

(async () => {
  console.log('=== einstellungen_check — hält der Bildschirm, was seine Schalter versprechen?');
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message.split('\n')[0]));
  await page.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.addInitScript(SEED);
  // Die beiden Sperren stellen, BEVOR die Seite lädt.
  await page.addInitScript(() => {
    window.__reloads = 0;
    try {
      const echt = location.reload.bind(location);
      Object.defineProperty(location, 'reload', { configurable: true, value: () => { window.__reloads++; } });
    } catch (_) {}
    try {
      window.Notification = window.Notification || function(){};
      window.Notification.permission = 'granted';
      window.Notification.requestPermission = () => Promise.resolve('granted');
    } catch (_) {}
    // Eine Attrappe UNTER dem Tor: sie wird gesetzt, bevor die App ihr Tor
    // baut, also wickelt das Tor sie ein. So lässt sich messen, ob der
    // gewöhnliche Weg den echten Aufruf noch im SELBEN synchronen Block
    // erreicht — davon hängt auf manchen Browsern ab, ob die Kamera aufgehen
    // darf (die Nutzer-Geste gilt nur unmittelbar).
    window.__gum = { rufe: 0, synchron: null };
    try {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = function (c) {
          window.__gum.rufe++;
          window.__gum.synchron = (window.__gumMarke === true);
          return Promise.resolve({ getTracks: () => [{ stop(){}, readyState: 'live' }],
                                   getVideoTracks: () => [] });
        };
      }
    } catch (_) {}
  });
  await page.goto('file://' + path.join(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  const r = await page.evaluate(async () => {
    const aus = {};
    // Die echte Fassung sichern, BEVOR spätere Fragen sie durch eine Attrappe
    // ersetzen — `delete` holt sie nicht zurück, sie ist eine einfache
    // Zuweisung an `window`, keine Prototyp-Eigenschaft.
    const echterConfirm = window.gsConfirmModal;
    document.documentElement.classList.remove('gs-preauth');
    try { if (typeof switchTab === 'function') switchTab('settings'); } catch (_) {}
    await new Promise(w => setTimeout(w, 300));

    // ── 1 · Push: „aktiv" nur, wenn der Server die Zeile genommen hat ─────
    //
    // PostgREST liefert bei einer von RLS abgewiesenen Zeile 0 Datensätze und
    // KEINEN Fehler; `Prefer: return=minimal` macht die Ablehnung vollends
    // unsichtbar. Drei Fälle, und der mittlere ist der wichtige.
    const push = async (antwort) => {
      window.sbFetch = async () => antwort;
      window.sbIsLoggedIn = () => true;
      window.gsStore = window.gsStore || {};
      window.gsStore.get = (k, d) => (k === 'gs_sb_uid' ? 'u-test' : d);
      return await gsRegisterPushSubscription({
        toJSON: () => ({ endpoint: 'https://push.example/abc', keys: { p256dh: 'p', auth: 'a' } })
      });
    };
    aus.push = {
      abgelehnt: await push({ data: null, error: { message: 'RLS' } }),
      leer:      await push({ data: [], error: null }),
      ok:        await push({ data: [{ endpoint: 'https://push.example/abc' }], error: null }),
    };
    // Und ohne Anmeldung darf sie erst recht keinen Erfolg melden.
    window.sbIsLoggedIn = () => false;
    aus.push.abgemeldet = await gsRegisterPushSubscription({ toJSON: () => ({ endpoint: 'x', keys: {} }) });

    // ── 2 · GPS: der Browser entscheidet, nicht der eigene Merkzettel ─────
    localStorage.setItem('gs_gps_perm', 'granted');
    window.gsPermState = window.gsPermState || {};
    window.gsPermState.location = 'granted';
    localStorage.setItem('gs_perm_location', 'granted');
    gsGpsUpdateToggleUI();
    const lies = () => {
      const l = document.getElementById('gps-perm-label');
      const t = document.getElementById('gps-perm-toggle');
      return { text: l ? l.textContent : '(kein Label)', an: t ? t.checked : null,
               granted: gsGpsIsGranted(), denied: gsGpsIsDenied() };
    };
    aus.gpsFrei = lies();
    window.gsPermState.location = 'denied';
    localStorage.setItem('gs_perm_location', 'denied');
    gsGpsUpdateToggleUI();
    aus.gpsGesperrt = lies();

    // ── 3 · „Kamera immer neu abfragen" gilt für JEDE Anfrage ────────────
    //
    // Gemessen wird an `navigator.mediaDevices.getUserMedia` selbst — der
    // Stelle, durch die alle dreizehn Kamera-Wege müssen. Ein Fall, der nur
    // `startCamera` prüft, sagt nichts über den Pflanzendoktor.
    let gefragt = 0;
    window.gsConfirmModal = () => { gefragt++; return Promise.resolve(true); };
    let geoeffnet = 0;
    const stream = { getTracks: () => [{ stop(){}, readyState: 'live' }], getVideoTracks: () => [] };
    // Das Tor sitzt VOR dem echten Aufruf; den echten ersetzen wir hier.
    const torFassung = navigator.mediaDevices.getUserMedia;
    navigator.mediaDevices.__echt = async () => { geoeffnet++; return stream; };
    // Die Attrappe unter das Tor schieben: das Tor ruft `echt(c)` — wir
    // erneuern die Kette mit derselben Reihenfolge.
    aus.kamera = { torVorhanden: !!navigator.mediaDevices._gsTorGesetzt };

    localStorage.setItem('gs_cam_always_ask', '0');
    gefragt = 0;
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch (_) {}
    try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch (_) {}
    aus.kamera.ausGefragt = gefragt;

    localStorage.setItem('gs_cam_always_ask', '1');
    window._gsKamTorFrei = false;
    gefragt = 0;
    for (let i = 0; i < 3; i++) { try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch (_) {} }
    aus.kamera.anGefragt = gefragt;

    // Sagt der Nutzer NEIN, darf keine Kamera aufgehen.
    window.gsConfirmModal = () => Promise.resolve(false);
    let abgewiesen = false;
    try { await navigator.mediaDevices.getUserMedia({ video: true }); }
    catch (e) { abgewiesen = (e && e.name === 'NotAllowedError'); }
    aus.kamera.neinWirkt = abgewiesen;
    window.gsConfirmModal = () => Promise.resolve(true);

    // Ton allein ist keine Kamera — dafür darf nicht gefragt werden.
    gefragt = 0;
    try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (_) {}
    aus.kamera.tonGefragt = gefragt;

    // ── 4 · Der gewöhnliche Weg bleibt unangetastet ──────────────────────
    //
    // Ein Riegel, der nur für wenige gilt, darf den Weg der vielen nicht
    // anfassen. Bei ausgeschaltetem Schalter (Standard) muss der echte
    // `getUserMedia`-Aufruf im SELBEN synchronen Block ankommen — ein `await`
    // davor unterbricht die Nutzer-Geste, und davon hängt auf manchen
    // Browsern ab, ob die Kamera überhaupt aufgehen darf.
    localStorage.setItem('gs_cam_always_ask', '0');
    window.__gum.rufe = 0; window.__gum.synchron = null;
    window.__gumMarke = true;
    const p = navigator.mediaDevices.getUserMedia({ video: true });
    window.__gumMarke = false;
    try { await p; } catch (_) {}
    aus.kamera.durchgereicht = { rufe: window.__gum.rufe, synchron: window.__gum.synchron };

    // Der Schalter muss ALLE drei Kopien des Merkzettels räumen.
    localStorage.setItem('gs_cam_perm', 'granted');
    localStorage.setItem('gs_perm_camera', 'granted');
    window.gsPermState.camera = 'granted';
    gsCamAlwaysAskToggle(true);
    aus.kamera.reste = {
      camPerm: localStorage.getItem('gs_cam_perm'),
      permCamera: localStorage.getItem('gs_perm_camera'),
      state: window.gsPermState.camera,
    };

    // ── 5 · Die Suche findet, was auf dem Bildschirm steht ──────────────
    //
    // Gemessen wird am GERENDERTEN Bildschirm, nicht am Objekt: was zählt,
    // ist was sichtbar bleibt und was verschwindet.
    const scroll = document.getElementById('settings-scroll');
    const sichtbar = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 2;   // 2 px = leere Kartenhülle (Rahmen)
    };
    const suche = (q) => {
      gsSettingsSearch(q);
      const karten = Array.prototype.filter.call(scroll.querySelectorAll('.settings-card'), sichtbar);
      const zeilen = Array.prototype.filter.call(scroll.querySelectorAll('.settings-row'), sichtbar);
      const none = document.getElementById('settings-search-none');
      const huellen = Array.prototype.filter.call(scroll.querySelectorAll('.settings-card'), (k) => {
        const r = k.getBoundingClientRect();
        return r.height > 0 && r.height <= 4;   // sichtbar, aber ohne Inhalt
      }).length;
      return { karten: karten.length, zeilen: zeilen.length, huellen,
               keine: !!(none && getComputedStyle(none).display !== 'none'),
               text: (scroll.innerText || '').replace(/\s+/g, ' ').slice(0, 120) };
    };
    // Das Push-Panel aufklappen — genau dort liegen die 18 Bedienelemente,
    // die zu KEINER `.settings-row` gehören.
    const panel = document.getElementById('push-detail-settings');
    if (panel) panel.style.display = '';
    aus.suche = {
      leer:      suche(''),
      treffer:   suche('nachtmodus'),
      imPanel:   suche('hitzewarnung'),
      imPanel2:  suche('test-push'),
      nichts:    suche('zzz-gibtsnicht'),
    };
    // Klappt die Suche einen Abschnitt auf, muss der Titel das auch sagen.
    gsSettingsSearch('nachtmodus');
    const t = Array.prototype.find.call(
      document.querySelectorAll('.settings-group-title'),
      (x) => !x.classList.contains('gs-grp-nomatch') && x.getBoundingClientRect().height > 0);
    aus.suche.titel = t ? { zu: t.classList.contains('gs-collapsed'),
                            aria: t.getAttribute('aria-expanded') } : null;
    gsSettingsSearch('');

    // ── 9 · Der Abgleich mit der Cloud ──────────────────────────────────
    //
    // Der Pull holt eine Zeile, die NUR die Spalten kennt, die je gepusht
    // wurden. Bis v32.35 ersetzte er damit den ganzen lokalen Block.
    localStorage.setItem('gs_prefs', JSON.stringify({
      theme: 'green', darkMode: true, compact: true, senior: true,
      units: 'metric', showMoon: true, homeWeather: true, scanHistory: true,
    }));
    try { loadPrefs(); } catch (_) {}
    window.sbIsLoggedIn = () => true;
    window.gsStore.get = (k, d) => (k === 'gs_sb_uid' ? 'u-test'
                                 : k === 'gs_prefs' ? (localStorage.getItem('gs_prefs') || '{}') : d);
    window.gsStore.set = (k, v) => { localStorage.setItem(k, v); return true; };
    window.sbFetch = async () => ({ data: [{
      user_id: 'u-test', created_at: 'x', updated_at: 'y',
      language: 'de', units: 'imperial',
      prefs: { showMoon: false, homeWeather: true, scanHistory: true },
    }], error: null });
    document.body.classList.add('compact', 'senior');
    await gsPrefsPull();
    var nach = {};
    try { nach = JSON.parse(localStorage.getItem('gs_prefs') || '{}'); } catch (_) {}
    aus.pull = {
      schluessel: Object.keys(nach).length,
      compact: nach.compact, senior: nach.senior, theme: nach.theme,
      units: nach.units,                       // Server gewinnt, wo er etwas sagt
      showMoon: nach.showMoon,
      verschachtelt: Object.prototype.hasOwnProperty.call(nach, 'prefs'),
      // Und WIRKT es? Der Server sagte showMoon:false — das Widget muss weg,
      // und `compact`/`senior` müssen am body bleiben, weil der Server sie
      // gar nicht kennt.
      moonWeg: (function () {
        var m = document.getElementById('moon-widget');
        return m ? m.style.display === 'none' : null;
      })(),
      bodyCompact: document.body.classList.contains('compact'),
    };

    // ── 10 · Melden sich die drei stillen Schalter beim Server? ──────────
    var gepusht = [];
    window.gsPrefsPush = (o) => { gepusht.push(Object.keys(o)[0]); };
    var schmutzig = [];
    window.gsCloudSync = window.gsCloudSync || {};
    var _md = window.gsCloudSync.markDirty;
    window.gsCloudSync.markDirty = (b) => { schmutzig.push(b); if (_md) try { _md(b); } catch (_) {} };
    applyCompact(true);
    applySenior(true);
    applyDarkMode(true);
    try { if (window.gsI18n && gsI18n.setLang) gsI18n.setLang('fr'); } catch (_) {}
    aus.stillePush = { gepusht: gepusht.slice(), schmutzig: schmutzig.slice() };
    try { if (window.gsI18n && gsI18n.setLang) gsI18n.setLang('de'); } catch (_) {}

    // ── 11 · „Alle Daten löschen" — löscht es wirklich alles? ───────────
    //
    // Der Dialog verspricht „alles im Gerät gespeicherte". Gelöscht wurden
    // zwei Präfixe. Gemessen wird deshalb mit Schlüsseln, die absichtlich
    // ANDERS heissen — genau die zwei, die in der App wirklich so heissen.
    localStorage.setItem('greenscan_markers', '[{"lat":47.1,"lng":8.2}]');
    localStorage.setItem('userLocation', '{"name":"Zuhause"}');
    localStorage.setItem('gs_prefs', '{"x":1}');
    localStorage.setItem('ps_myplants', '[]');
    // `Object.keys(localStorage)` zählt hier NICHT nur Einträge: dieses Repo
    // hat eigene `setItem`/`getItem`/`removeItem`-Eigenschaften am
    // localStorage-Objekt (seit v30.98, und genau sie verdecken den
    // Prototyp-Patch aus dem Auto-Track). Gezählt wird deshalb über die
    // echte Schnittstelle.
    var alleKeys = function(){
      var out = [];
      for (var i = 0; i < localStorage.length; i++) out.push(localStorage.key(i));
      return out;
    };
    var vorher = alleKeys().length;
    // `clearAllData` startet die App nach 1,5 s neu — das würde den Prüfstand
    // mitnehmen. `location.reload` lässt sich nicht zuverlässig ersetzen
    // (`Location` ist exotisch; der erste Versuch mit `defineProperty` sah
    // gestellt aus und navigierte trotzdem — die Frage stürzte ab, statt
    // stillschweigend falsch zu messen, was Glück war).
    // Also wird der TIMER abgefangen: der geplante Neustart ist damit sogar
    // besser belegt als ein abgewarteter, und nichts navigiert.
    var echterTimeout = window.setTimeout;
    var geplant = [];
    window.setTimeout = function (fn, ms) { geplant.push(ms); return 0; };
    try { clearAllData(); } finally { window.setTimeout = echterTimeout; }
    aus.loeschen = {
      vorher: vorher,
      uebrig: alleKeys(),
      neustartGeplant: geplant.indexOf(1500) >= 0,
      queueLeererDa: typeof window.gsQueueLeeren === 'function',
    };

    // ── 12 · Fragt ein Admin-Eingriff nach? ─────────────────────────────
    var gefragt2 = 0, ausgefuehrt = 0;
    window.gsIsAdmin = () => true;
    window.sbFetch = async () => { ausgefuehrt++; return { data: { ok: true }, error: null }; };
    window.gsConfirmModal = () => { gefragt2++; return Promise.resolve(false); };   // Nutzer sagt NEIN
    await gsAdminAssignRole('u1', 'banned');
    await gsAdminSetTier('u1', 'lifetime');
    aus.admin = { nein: { gefragt: gefragt2, ausgefuehrt: ausgefuehrt } };
    gefragt2 = 0; ausgefuehrt = 0;
    window.gsConfirmModal = () => { gefragt2++; return Promise.resolve(true); };    // Nutzer sagt JA
    await gsAdminAssignRole('u1', 'banned');
    await gsAdminSetTier('u1', 'lifetime');
    aus.admin.ja = { gefragt: gefragt2, ausgefuehrt: ausgefuehrt };
    // Und wer schon gefragt hat, darf nicht zweimal fragen.
    gefragt2 = 0;
    await gsAdminAssignRole('u1', 'banned', null, { bestaetigt: true });
    aus.admin.durchgereicht = gefragt2;

    // ── 13 · Welche Antwort ist im Zerstör-Dialog die bequeme? ──────────
    window.gsConfirmModal = echterConfirm;   // die echte Fassung zurück
    const dialog = async (kind) => {
      const p2 = window.gsConfirmModal({ title: 'Test', message: 'Test',
                                         ok: 'Endgültig löschen', cancel: 'Abbrechen', kind });
      await new Promise(w => setTimeout(w, 60));
      const fokus = document.activeElement ? document.activeElement.id : null;
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      return { fokus, enter: await p2 };
    };
    aus.dialog = { gefahr: await dialog('danger'), normal: await dialog('primary') };
    // Und Escape muss weiterhin abbrechen.
    const p3 = window.gsConfirmModal({ title: 'T', message: 'T', kind: 'danger' });
    await new Promise(w => setTimeout(w, 60));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    aus.dialog.escape = await p3;

    aus.reloads = window.__reloads;
    return aus;
  });

  const P = r.push;
  const pOk = P.abgelehnt === false && P.leer === false && P.ok === true && P.abgemeldet === false;
  melde('Push meldet Erfolg nur, wenn der Server die Zeile genommen hat', pOk,
    pOk ? 'abgelehnt→false · leere Antwort→false · bestätigt→true · abgemeldet→false'
      : JSON.stringify(P) + ' — PostgREST liefert bei RLS-Ablehnung 0 Datensätze OHNE Fehler; '
        + 'wer nur `error` prüft, meldet Erfolg für nichts');

  const gOk = r.gpsFrei.granted === true && r.gpsGesperrt.granted === false
    && r.gpsGesperrt.denied === true && r.gpsGesperrt.an === false
    && /gesperrt|Browser/i.test(r.gpsGesperrt.text);
  melde('Sperrt der Browser den Standort, sagt der Schalter das auch', gOk,
    gOk ? 'frei → „' + r.gpsFrei.text.slice(0, 34) + '…" · gesperrt → „' + r.gpsGesperrt.text.slice(0, 46) + '"'
      : 'frei ' + JSON.stringify(r.gpsFrei) + ' · gesperrt ' + JSON.stringify(r.gpsGesperrt)
        + ' — zwei Speicher für dieselbe Frage; der Browser entscheidet, nicht der eigene Merkzettel');

  const K = r.kamera;
  const kOk = K.torVorhanden && K.ausGefragt === 0 && K.anGefragt === 3 && K.neinWirkt === true && K.tonGefragt === 0;
  melde('„Kamera immer neu abfragen" fragt bei JEDER Anfrage', kOk,
    kOk ? 'aus → 0 Nachfragen bei 2 Anfragen · an → 3 bei 3 · „Nein" wirft NotAllowedError · Ton allein fragt nicht'
      : JSON.stringify(K) + ' — der Schalter verspricht „jede Anfrage bestätigen"; er lieferte '
        + 'genau eine, und zwölf weitere Kamera-Wege kannten ihn nie');

  const rOk = K.reste && K.reste.camPerm === null && K.reste.permCamera === null && !K.reste.state;
  melde('Der Schalter räumt ALLE Kopien des Merkzettels', rOk,
    rOk ? 'gs_cam_perm, gs_perm_camera und gsPermState.camera alle leer'
      : JSON.stringify(K.reste) + ' — wer einen Zustand zurücksetzt, setzt alle Kopien zurück; '
        + 'sonst liest die nächste Stelle die stehengebliebene');

  const D = K.durchgereicht;
  const dOk = D && D.rufe === 1 && D.synchron === true;
  melde('Ist der Schalter aus, geht die Kamera-Anfrage unverzögert durch', dOk,
    dOk ? 'echter Aufruf im selben synchronen Block — die Nutzer-Geste bleibt gültig'
      : JSON.stringify(D) + ' — ein `await` vor dem Durchreichen unterbricht die Geste; '
        + 'ein Riegel, der nur für wenige gilt, darf den Weg der vielen nicht anfassen');

  // ── 6 · Hat jedes Bedienelement einen Namen? ─────────────────────────
  //
  // Gemessen am ECHTEN Barrierefreiheits-Baum über CDP, nicht am Markup: was
  // zählt, ist der Name, den ein Screenreader vorliest — und der entsteht auf
  // mehreren Wegen (umschliessendes `<label>` mit Text, `for`, `aria-label`,
  // `aria-labelledby`, `title`). Wer nur nach `aria-label` sucht, meldet die
  // Push-Kategorien fälschlich als namenlos: ihr `<label>` trägt den Text.
  //
  // Und ZUERST alles aufklappen. Der Bildschirm startet mit einer offenen
  // Gruppe; alle anderen Zeilen stehen in `display:none`. Ein Lauf ohne das
  // misst neun Elemente statt einunddreissig und meldet fröhlich „alle
  // benannt" — genau die Falle aus v32.21 (eine Zahl ohne Bezugsgrösse).
  const namen = await (async () => {
    await page.evaluate(async () => {
      try { if (typeof gsSettingsToggleAll === 'function') gsSettingsToggleAll(); } catch (_) {}
      const panel = document.getElementById('push-detail-settings');
      if (panel) panel.style.display = '';
      await new Promise(w => setTimeout(w, 250));
    });
    const ids = await page.evaluate(() => {
      const w = document.getElementById('screen-settings');
      const sel = 'input[type=checkbox], input[type=radio], input[type=range], select, .theme-swatch';
      return Array.from(w.querySelectorAll(sel))
        .filter(e => e.offsetParent !== null || e.getBoundingClientRect().height > 0)
        .map(e => e.id).filter(Boolean);
    });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('DOM.enable'); await cdp.send('Accessibility.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 1 });
    const ohne = [];
    for (const id of ids) {
      let nm = '';
      try {
        const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '#' + id });
        if (nodeId) {
          const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
          const kn = nodes.find(x => x.backendDOMNodeId != null && x.name);
          nm = kn && kn.name ? String(kn.name.value || '').trim() : '';
        }
      } catch (_) {}
      if (!nm) ohne.push(id);
    }
    await cdp.detach();
    return { sichtbar: ids.length, ohne };
  })();
  const namenOk = namen.ohne.length === 0 && namen.sichtbar >= 25;
  melde('Jedes sichtbare Bedienelement der Einstellungen hat einen Namen', namenOk,
    namenOk ? namen.sichtbar + ' Schalter, Auswahlfelder, Farbfelder und Regler — alle mit Namen im Barrierefreiheits-Baum'
      : namen.ohne.length + ' von ' + namen.sichtbar + ' ohne Namen: ' + namen.ohne.slice(0, 10).join(', ')
        + ' — das umschliessende <label> enthält nur den Schieber, der Titel steht daneben ohne `for`');

  // Und der gewählte Farbton muss sich ansagen lassen.
  const farb = await page.evaluate(() => {
    const sw = Array.from(document.querySelectorAll('.theme-swatch'));
    return { n: sw.length,
             aktiv: sw.filter(s => s.classList.contains('active')).map(s => s.dataset.theme),
             checked: sw.filter(s => s.getAttribute('aria-checked') === 'true').map(s => s.dataset.theme) };
  });
  const farbOk = farb.n === 6 && farb.aktiv.length === 1 && farb.checked.length === 1
    && farb.aktiv[0] === farb.checked[0];
  melde('Das gewählte Farbfeld sagt, dass es gewählt ist', farbOk,
    farbOk ? farb.n + ' Farbfelder · gewählt „' + farb.aktiv[0] + '" · aria-checked ebenso'
      : JSON.stringify(farb) + ' — der aktive Ton war nur an einem Rahmen erkennbar; '
        + 'wer nicht hinsieht, kann nicht wissen, welche Farbe eingestellt ist');

  // ── 7 · Kopfzeile: Untertitel unter dem Titel, nichts ragt hinaus ────
  const kopf = await page.evaluate(() => {
    const w = document.getElementById('screen-settings');
    const titel = w.querySelector('[data-i18n="settings_title"]');
    const sub   = w.querySelector('[data-i18n="settings_sub"]');
    const ver   = document.getElementById('settings-version');
    const R = (e) => { const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.right)]; };
    return { titel: R(titel), sub: R(sub), ver: R(ver), breite: window.innerWidth,
             raus: Math.round(Math.max(0, R(ver)[2] - window.innerWidth)) };
  });
  const kopfOk = kopf.sub[1] > kopf.titel[1] && kopf.sub[0] <= kopf.titel[0] + 2 && kopf.raus === 0;
  melde('Untertitel und Version stehen UNTER dem Titel, nicht daneben', kopfOk,
    kopfOk ? 'Titel y=' + kopf.titel[1] + ' · Untertitel y=' + kopf.sub[1] + ' (darunter, gleiche Kante) · nichts ragt hinaus'
      : JSON.stringify(kopf) + ' — ein </div> zu früh schliesst die Spalte schon nach dem Titel; '
        + 'Untertitel und Version werden dadurch zu Geschwistern in der Flex-Reihe');

  // ── 8 · Klebt die Suche wirklich? ───────────────────────────────────
  const kleben = await page.evaluate(async () => {
    const scr = document.getElementById('screen-settings');
    const box = document.getElementById('settings-search-wrap');
    // Alle Gruppen aufklappen, damit es überhaupt etwas zu scrollen gibt.
    // `gsSettingsToggleAll` SCHALTET UM — eine frühere Frage hat schon
    // aufgeklappt, ein blindes zweites Aufrufen klappt also wieder zu und die
    // Seite ist nicht mehr scrollbar. (Dieselbe Falle wie in v32.22: ein Fall
    // misst seine eigene Grundlinie.) Deshalb: umschalten, bis es scrollt.
    for (let i = 0; i < 2 && scr.scrollHeight <= scr.clientHeight; i++) {
      try { if (typeof gsSettingsToggleAll === 'function') gsSettingsToggleAll(); } catch (_) {}
      await new Promise(w => setTimeout(w, 200));
    }
    const oben = Math.round(box.getBoundingClientRect().top);
    scr.scrollTop = 600;
    await new Promise(w => setTimeout(w, 120));
    const nach = Math.round(box.getBoundingClientRect().top);
    const hoehe = scr.scrollHeight, sicht = scr.clientHeight;
    const port = Math.round(scr.getBoundingClientRect().top);
    scr.scrollTop = 0;
    return { oben, nach, port, mitgewandert: oben - 600,
             gescrollt: hoehe - sicht, scrollbar: hoehe > sicht };
  });
  // „Klebt" heisst NICHT „bewegt sich gar nicht": der Kasten startet unter der
  // Kopfzeile und wandert beim Scrollen bis an die Oberkante des Scrollports —
  // und bleibt DORT. Das Gegenteil (gar keine Klebewirkung) wäre y = oben−600.
  const klebtOk = kleben.scrollbar
    && Math.abs(kleben.nach - kleben.port) <= 4
    && kleben.nach > kleben.mitgewandert + 50;
  melde('Die Suche klebt beim Scrollen wirklich oben', klebtOk,
    klebtOk ? 'von y=' + kleben.oben + ' an die Oberkante y=' + kleben.nach + ' und dort geblieben '
      + '(ohne Klebewirkung wäre sie bei ' + kleben.mitgewandert + ')'
      : JSON.stringify(kleben) + ' — `position:sticky` rechnet gegen den nächsten Scrollport; '
        + 'ein innerer Kasten mit `overflow-y:auto`, der selbst nie scrollt, ist genau dieser Port');

  const S = r.suche;
  const findetPanel = S.imPanel.zeilen + S.imPanel.karten > 0 && !S.imPanel.keine
    && S.imPanel2.karten > 0 && !S.imPanel2.keine;
  melde('Die Suche findet auch, was in keiner `.settings-row` steht', findetPanel,
    findetPanel ? '„hitzewarnung" → ' + S.imPanel.karten + ' Karte(n) · „test-push" → ' + S.imPanel2.karten + ' Karte(n)'
      : JSON.stringify({ hitzewarnung: S.imPanel, testpush: S.imPanel2 })
        + ' — 18 Bedienelemente im Push-Panel gehören zu keiner Zeile; eine Suche darf nicht davon '
        + 'abhängen, wie der Inhalt ausgezeichnet ist');

  const raeumtAuf = S.treffer.huellen === 0 && S.treffer.karten <= 2
    && S.nichts.karten === 0 && S.nichts.huellen === 0;
  melde('Was nicht passt, verschwindet ganz — auch die Kartenhülle', raeumtAuf,
    raeumtAuf ? '„nachtmodus" → ' + S.treffer.karten + ' Karte(n), 0 leere Hüllen · '
      + '„zzz-gibtsnicht" → 0 Karten (statt 8 mit ' + S.leer.karten + ' im Ruhezustand)'
      : JSON.stringify({ treffer: S.treffer, nichts: S.nichts })
        + ' — leere Kartenhüllen bleiben als 2-px-Striche stehen und rahmen den einen Treffer ein');

  const ehrlich = S.nichts.keine === true && S.nichts.karten === 0
    && S.treffer.keine === false && S.imPanel.keine === false;
  melde('„Keine Einstellung gefunden." erscheint nur, wenn wirklich nichts da ist', ehrlich,
    ehrlich ? 'ohne Treffer: Meldung + 0 Karten · mit Treffer: keine Meldung'
      : JSON.stringify({ ohneTreffer: S.nichts, mitTreffer: S.treffer })
        + ' — die Meldung stand gleichzeitig mit 457 px sichtbarem Inhalt darunter');

  const T = S.titel;
  const titelOk = T && T.zu === false && T.aria === 'true';
  melde('Klappt die Suche einen Abschnitt auf, sagt der Titel das auch', titelOk,
    titelOk ? 'sichtbarer Gruppentitel: nicht `gs-collapsed`, aria-expanded="true"'
      : JSON.stringify(T) + ' — der Pfeil zeigte „zugeklappt" über einer sichtbaren '
        + 'Treffer-Zeile, und ein Screenreader meldete den Abschnitt als eingeklappt');

  const PU = r.pull;
  const pullOk = PU && PU.compact === true && PU.senior === true && PU.theme === 'green'
    && PU.units === 'imperial' && PU.showMoon === false && PU.verschachtelt === false
    && PU.schluessel >= 8;
  melde('Der Pull mischt die Serverzeile ein, statt den Block zu ersetzen', pullOk,
    pullOk ? PU.schluessel + ' Einstellungen behalten · Server gewinnt wo er etwas sagt (units→imperial, '
      + 'showMoon→false) · was er nicht kennt bleibt (compact, senior, theme) · keine Verschachtelung'
      : JSON.stringify(PU) + ' — die Serverzeile kennt nur die Spalten, die je gepusht wurden; '
        + 'ein Pull, der ersetzt, ist ein Rückschnitt auf das, was der Server zufällig kennt');

  const wirktOk = PU && PU.moonWeg === true && PU.bodyCompact === true;
  melde('Was der Pull zurückholt, wirkt auch auf dem Bildschirm', wirktOk,
    wirktOk ? 'Server sagte showMoon:false → Mondwidget weg · compact bleibt am body (Server kennt es nicht)'
      : JSON.stringify({ moonWeg: PU && PU.moonWeg, bodyCompact: PU && PU.bodyCompact })
        + ' — der Pull schrieb nur Speicher und Variable; der Bildschirm sagte etwas anderes als der '
        + 'Speicher, und beim nächsten loadPrefs() sprang die Oberfläche ohne Anlass um');

  const PP = r.stillePush;
  const stillOk = PP && ['compact', 'senior', 'darkMode', 'language'].every(k => PP.gepusht.indexOf(k) >= 0)
    && PP.schmutzig.indexOf('state') >= 0;
  melde('Kompakt, Senior, Nachtmodus und Sprache melden sich beim Server', stillOk,
    stillOk ? 'gepusht: ' + PP.gepusht.join(', ') + ' · state als schmutzig markiert'
      : JSON.stringify(PP) + ' — `savePrefs()` schreibt nur den localStorage, und der Auto-Track über '
        + 'STATE_KEYS ist wirkungslos (er patcht `Storage.prototype`, das eine eigene Eigenschaft verdeckt)');

  const L = r.loeschen;
  const loeschtOk = L && L.uebrig.length === 0 && L.neustartGeplant === true && L.queueLeererDa === true;
  melde('„Alle Daten löschen" lässt nichts liegen', loeschtOk,
    loeschtOk ? 'von ' + L.vorher + ' Schlüsseln 0 übrig · IndexedDB-Warteschlangen werden mitgeleert · Neustart geplant'
      : 'übrig: ' + JSON.stringify(L && L.uebrig) + ' (von ' + (L && L.vorher) + ') · Warteschlangen-Leerer da: '
        + (L && L.queueLeererDa) + ' — eine Löschung nach Präfix ist eine Wette darauf, dass niemand je '
        + 'einen Schlüssel anders benannt hat; liegen blieben die GPS-Fundorte und der eigene Standort');

  const A = r.admin;
  const adminOk = A && A.nein.gefragt === 2 && A.nein.ausgefuehrt === 0
    && A.ja.gefragt === 2 && A.ja.ausgefuehrt === 2 && A.durchgereicht === 0;
  melde('Sperren und Lifetime fragen nach — und nur einmal', adminOk,
    adminOk ? '„Nein" → 2 Rückfragen, 0 ausgeführt · „Ja" → 2 Rückfragen, 2 ausgeführt · '
      + 'wer schon gefragt hat, fragt nicht nochmal'
      : JSON.stringify(A) + ' — vier Wege führten zu derselben Aktion, drei ohne Rückfrage; '
        + 'die Rückfrage gehört in die Funktion, nicht an den Aufrufort');

  const D2 = r.dialog;
  const dialogOk = D2 && D2.gefahr.fokus === 'gs-confirm-cancel' && D2.gefahr.enter === false
    && D2.normal.fokus === 'gs-confirm-ok' && D2.normal.enter === true && D2.escape === false;
  melde('Im Zerstör-Dialog ist die harmlose Antwort die bequeme', dialogOk,
    dialogOk ? 'danger → Fokus auf „Abbrechen", Enter bricht ab · normal → Fokus auf OK, Enter bestätigt · Escape bricht immer ab'
      : JSON.stringify(D2) + ' — der Fokus lag auf „Endgültig löschen", und Enter löste es aus, '
        + 'ohne dass der Finger je den Knopf berührt hatte');

  console.log('  ---');
  console.log('  Fragen geprueft: 19 · davon rot: ' + kaputt);
  console.log('  JS-Fehler: ' + (fehler.length ? fehler.slice(0, 4).join(' | ') : 'keine'));
  console.log('  Gestellte Sperren: Notification.requestPermission → granted · setTimeout beim');
  console.log('  Löschen abgefangen (`location.reload` lässt sich nicht zuverlässig ersetzen —');
  console.log('  geprüft wird deshalb der GEPLANTE Neustart, nicht der ausgeführte).');
  console.log('  Nicht prüfbar von hier: ob eine ECHTE Kamera aufgeht und ob der');
  console.log('  ECHTE Server die Zeile nimmt. Geprüft ist, was die App aus der');
  console.log('  Antwort macht — nicht, ob die Antwort echt ist.');
  await b.close();
  process.exit(kaputt ? 1 : 0);
})();
