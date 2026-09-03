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

  console.log('  ---');
  console.log('  Fragen geprueft: 5 · davon rot: ' + kaputt);
  console.log('  JS-Fehler: ' + (fehler.length ? fehler.slice(0, 4).join(' | ') : 'keine'));
  console.log('  Gestellte Sperren: Notification.requestPermission → granted · location.reload → gezählt ('
    + r.reloads + ')');
  console.log('  Nicht prüfbar von hier: ob eine ECHTE Kamera aufgeht und ob der');
  console.log('  ECHTE Server die Zeile nimmt. Geprüft ist, was die App aus der');
  console.log('  Antwort macht — nicht, ob die Antwort echt ist.');
  await b.close();
  process.exit(kaputt ? 1 : 0);
})();
