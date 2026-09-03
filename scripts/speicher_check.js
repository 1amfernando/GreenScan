#!/usr/bin/env node
// speicher_check.js — was tut die App, wenn der GERAETESPEICHER VOLL ist?
//
//   node scripts/speicher_check.js
//
// Anlass (v32.44, STATUS (bc) → (eg)): `localStorage.setItem` ist global
// umhuellt und WIRFT NIE — es gibt `false` zurueck (index.html ~Z. 7873,
// CLAUDE.md §3.5). Damit war jeder `try { setItem } catch { Rettungsweg }`
// toter Code. Dreimal wurde das einzeln repariert (v31.65, v31.76), sechs
// Stellen blieben offen — und keine davon hatte einen Pruefstand.
//
// > Wer einen Rettungsweg fuer vollen Speicher baut, muss ihn AUSLOESEN —
// > sonst schreibt man Trost, keinen Code. (CLAUDE.md §3.5)
//
// Dieser Stand stellt den vollen Speicher HER (der Wrapper wird so
// umhuellt, dass jeder Schreibversuch `false` liefert und mitgezaehlt wird)
// und fragt jede Stelle nach ihrem VERTRAG: sagt sie es? gibt sie false
// zurueck? versucht sie den Rueckfall (schrumpfen, ohne Foto)?
//
// Zwei Regeln, beide aus frueheren Pruefstaenden:
// - Der Fall muss hergestellt UND nachgewiesen werden: der Schreibversuch
//   auf den erwarteten Schluessel muss im Protokoll stehen. Eine Funktion,
//   die vorher aussteigt, ist nicht „gruen", sie ist „nicht gemessen".
// - Gemessen wird der VERTRAG (Rueckgabewert, Meldung), nicht die Absicht.
'use strict';
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const FAELLE = [
  {
    name: 'Tagebuch · bei vollem Speicher schrumpft es, und sagt es, wenn auch das nicht reicht',
    lauf: () => {
      if (typeof gsTagebuchSave !== 'function') return { ok: false, warum: 'gsTagebuchSave fehlt' };
      gsTagebuchLoad(true);
      _gsTagebuch.unshift({ ts: new Date().toISOString(), text: 'Prüfeintrag', emoji: '📝', cat: 'test' });
      __voll(true); const r = gsTagebuchSave(); __voll(false);
      const versuche = __VOLL_LOG.filter(k => k === 'gs_gartentagebuch').length;
      if (!versuche) return { ok: false, warum: 'kein Schreibversuch auf gs_gartentagebuch — Fall nicht hergestellt' };
      if (r !== false) return { ok: false, warum: 'liefert ' + String(r) + ' statt false — meldet Erfolg für nichts' };
      if (versuche < 2) return { ok: false, warum: 'nur ' + versuche + ' Versuch — der Schrumpf-Rückfall (300 Einträge) läuft nicht' };
      if (!__TOASTS.some(t => /Speicher voll/.test(t))) return { ok: false, warum: 'keine Meldung an die Person' };
      return { ok: true, info: versuche + ' Versuche (500, dann 300) · false · „' + __TOASTS.find(t => /Speicher voll/.test(t)).slice(0, 50) + '"' };
    },
  },
  {
    name: 'Favoriten · „Speicher voll" erscheint (v31.65, Rückfall bleibt)',
    lauf: () => {
      if (typeof toggleFav !== 'function') return { ok: false, warum: 'toggleFav fehlt' };
      __voll(true); toggleFav('W036'); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'ps_favs')) return { ok: false, warum: 'kein Schreibversuch auf ps_favs' };
      if (!__TOASTS.some(t => /Speicher voll/.test(t))) return { ok: false, warum: 'Favorit still verloren' };
      return { ok: true, info: 'Meldung da' };
    },
  },
  {
    name: 'Garten-Zwilling · ohne Foto noch einmal, dann ehrlich false (v31.65, Rückfall bleibt)',
    lauf: () => {
      if (typeof gsTwinSave !== 'function') return { ok: false, warum: 'gsTwinSave fehlt' };
      __voll(true); const r = gsTwinSave({ plants: [{ name: 'Prüfpflanze', x_m: 1, y_m: 1, w_m: .5, h_m: .5 }], beds: [], zones: [], photo: 'data:image/png;base64,AAAA' }); __voll(false);
      const versuche = __VOLL_LOG.filter(k => k === 'gs_garden_twin').length;
      if (versuche < 2) return { ok: false, warum: 'nur ' + versuche + ' Versuch — der Weg „ohne Foto" läuft nicht' };
      if (r !== false) return { ok: false, warum: 'liefert ' + String(r) + ' statt false' };
      if (!__TOASTS.some(t => /nicht gespeichert|Speicher voll/i.test(t))) return { ok: false, warum: 'keine Meldung' };
      return { ok: true, info: versuche + ' Versuche · false · Meldung da' };
    },
  },
  {
    name: 'Plan-Fortschritt · false und Meldung (v31.76, Rückfall bleibt)',
    lauf: () => {
      if (typeof _gsPPumgesetztSetz !== 'function') return { ok: false, warum: '_gsPPumgesetztSetz fehlt' };
      __voll(true); const r = _gsPPumgesetztSetz('pruefplan', 0, 'x'); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'gs_plan_umgesetzt')) return { ok: false, warum: 'kein Schreibversuch' };
      if (r !== false) return { ok: false, warum: 'liefert ' + String(r) };
      if (!__TOASTS.some(t => /Speicher voll/.test(t))) return { ok: false, warum: 'keine Meldung' };
      return { ok: true, info: 'false · Meldung da' };
    },
  },
  {
    name: 'Arten-Korrektur-Warteschlange · false, kein stilles „eingereiht"',
    lauf: () => {
      if (typeof _gsKorrekturEinreihen !== 'function') return { ok: false, warum: '_gsKorrekturEinreihen fehlt' };
      __voll(true); const r = _gsKorrekturEinreihen({ feld: 'saison', text: 'Prüfung' }); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'gs_scan_corrections_queue')) return { ok: false, warum: 'kein Schreibversuch' };
      if (r !== false) return { ok: false, warum: 'liefert ' + String(r) };
      return { ok: true, info: 'false' };
    },
  },
  {
    name: 'Fundort auf der Karte · „gespeichert" nur, wenn geschrieben wurde',
    lauf: async () => {
      if (typeof gsAddMarker !== 'function') return { ok: false, warum: 'gsAddMarker fehlt' };
      // Die Funktion liest ihre Felder aus dem Dokument; sie werden gestellt.
      ['gs-pin-name', 'gs-pin-note'].forEach(id => { if (!document.getElementById(id)) { const i = document.createElement('input'); i.id = id; document.body.appendChild(i); } });
      if (!document.getElementById('gs-pin-cat')) { const s = document.createElement('select'); s.id = 'gs-pin-cat'; s.innerHTML = '<option value="pflanze" selected>Pflanze</option>'; document.body.appendChild(s); }
      document.getElementById('gs-pin-name').value = 'Prüffund';
      window.sbIsLoggedIn = () => false; window.updateMapCount = window.updateMapCount || (() => {});
      // Die Funktion verlangt eine fertige Karte (Leaflet). Hier gibt es keine —
      // eine Attrappe reicht, denn gemessen wird der SPEICHERweg, nicht die Karte.
      const attrappe = { addLayer() {}, removeLayer() {}, hasLayer() { return false; }, setView() { return this; }, getZoom() { return 12; } };
      try { gsMap = attrappe; } catch (_) { window.gsMap = attrappe; }
      if (!window.L) window.L = { marker: () => ({ addTo() { return this; }, bindPopup() { return this; }, on() { return this; }, openPopup() { return this; } }), divIcon: () => ({}), icon: () => ({}), latLng: (a, b) => ({ lat: a, lng: b }) };
      __voll(true); await gsAddMarker(46.8, 8.2); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'greenscan_markers')) return { ok: false, warum: 'kein Schreibversuch auf greenscan_markers — Fall nicht hergestellt' };
      if (!__TOASTS.some(t => /Speicher voll/.test(t))) return { ok: false, warum: 'die Quota-Meldung erscheint nicht — bei vollem Gerät heisst es „gespeichert"' };
      if (__TOASTS.some(t => /gespeichert(?! werden)/.test(t) && !/nicht|konnte/i.test(t))) return { ok: false, warum: 'meldet trotzdem Erfolg: ' + __TOASTS.find(t => /gespeichert/.test(t)) };
      return { ok: true, info: 'Versuch protokolliert · „Speicher voll" gemeldet' };
    },
  },
  {
    name: 'GPS-Track · -1 und Meldung, der Live-Stand bleibt liegen',
    lauf: () => {
      if (typeof _gsTrackSaveTrack !== 'function') return { ok: false, warum: '_gsTrackSaveTrack fehlt' };
      const pts = []; for (let i = 0; i < 12; i++) pts.push({ lat: 46.8 + i * 0.0005, lng: 8.2 + i * 0.0005, ts: 1700000000000 + i * 10000, t: 1700000000000 + i * 10000 });
      __voll(true); let r; try { r = _gsTrackSaveTrack({ points: pts, start: pts[0].ts, end: pts[pts.length - 1].ts }); } catch (e) { __voll(false); return { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; } __voll(false);
      if (!__VOLL_LOG.some(k => k === 'gs_gpx_tracks')) return { ok: false, warum: 'kein Schreibversuch auf gs_gpx_tracks (Rückgabe ' + String(r) + ')' };
      if (r !== -1) return { ok: false, warum: 'liefert ' + String(r) + ' statt -1 — der Track gilt als gespeichert' };
      if (!__TOASTS.some(t => /nicht gespeichert|Speicher voll/i.test(t))) return { ok: false, warum: 'keine Meldung' };
      return { ok: true, info: '-1 · Meldung da' };
    },
  },
  {
    name: 'Gespeicherte Pläne · der Eintrag sagt, dass er nicht auf dem Gerät liegt',
    lauf: async () => {
      if (!window.gsPlans || typeof gsPlans.save !== 'function') return { ok: false, warum: 'gsPlans.save fehlt' };
      window.sbIsLoggedIn = () => false;
      __voll(true); const e = await gsPlans.save({ title: 'Prüfplan', summary: 'x' }); __voll(false);
      const versuche = __VOLL_LOG.filter(k => k === 'gs_plans_v2').length;
      if (!versuche) return { ok: false, warum: 'kein Schreibversuch auf gs_plans_v2' };
      if (versuche < 2) return { ok: false, warum: 'nur ' + versuche + ' Versuch — der Schrumpf-Rückfall (20) läuft nicht' };
      if (!e || e.local_failed !== true) return { ok: false, warum: 'der Eintrag behauptet, gespeichert zu sein (local_failed=' + (e && e.local_failed) + ')' };
      if (!__TOASTS.some(t => /Speicher voll/.test(t))) return { ok: false, warum: 'keine Meldung' };
      return { ok: true, info: versuche + ' Versuche · local_failed · Meldung da' };
    },
  },
  {
    name: 'Abstimmungs-Schlüssel · bei vollem Speicher KEIN geteilter „anon:fallback"',
    lauf: () => {
      if (typeof vote !== 'function') return { ok: false, warum: 'vote fehlt' };
      try { localStorage.removeItem('gs_sb_uid'); localStorage.removeItem('gs_voter_key'); } catch (_) {}
      window.__VOTES = [];
      window.sbFetch = async (p, o) => { try { window.__VOTES.push(JSON.parse(o.body)); } catch (_) {} return { data: [] }; };
      window.sbGetConfig = () => ({ url: 'x', key: 'y' });
      window.renderFeedback = () => {};
      feedbackItems = [{ id: 'fb-pruef', sb_id: '00000000-0000-0000-0000-000000000001', votes: {}, title: 'Prüfung' }];
      myVotes = {};
      __voll(true); vote('fb-pruef', 'up'); vote('fb-pruef', 'down'); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'gs_voter_key')) return { ok: false, warum: 'kein Schreibversuch auf gs_voter_key — Fall nicht hergestellt' };
      if (!window.__VOTES.length) return { ok: false, warum: 'keine Stimme abgeschickt' };
      const keys = window.__VOTES.map(v => v.voter_key);
      if (keys.some(k => k === 'anon:fallback')) return { ok: false, warum: 'geteilter Schlüssel anon:fallback — alle mit vollem Speicher stimmen als EINE Person' };
      if (keys.some(k => !/^anon:/.test(String(k)))) return { ok: false, warum: 'Schlüssel ohne anon:-Präfix: ' + keys.join(',') };
      if (new Set(keys).size !== 1) return { ok: false, warum: 'zwei Stimmen, zwei Schlüssel — die Sitzung merkt sich den Schlüssel nicht: ' + keys.join(' / ') };
      return { ok: true, info: 'ein Sitzungs-Schlüssel für beide Stimmen (' + keys[0].slice(0, 12) + '…)' };
    },
  },
  {
    name: 'Passwort ändern · sagt, wenn die neue Sitzung nicht gesichert werden konnte',
    lauf: async () => {
      if (typeof doChangePassword !== 'function') return { ok: false, warum: 'doChangePassword fehlt' };
      const felder = { 'pw-current': 'AltesPasswort1!', 'pw-new1': 'NeuesPasswort1!', 'pw-new2': 'NeuesPasswort1!' };
      Object.keys(felder).forEach(id => { let el = document.getElementById(id); if (!el) { el = document.createElement('input'); el.id = id; document.body.appendChild(el); } el.value = felder[id]; });
      ['pw-change-err', 'pw-change-ok'].forEach(id => { if (!document.getElementById(id)) { const d = document.createElement('div'); d.id = id; document.body.appendChild(d); } });
      if (!document.getElementById('pw-change-btn')) { const b = document.createElement('button'); b.id = 'pw-change-btn'; document.body.appendChild(b); }
      localStorage.setItem('gs_sb_email', 'pruef@example.org');
      window._gsFetch = async () => ({ ok: true, json: async () => ({ access_token: 't2', refresh_token: 'r2', expires_in: 3600 }) });
      window.sbChangePassword = async () => ({});
      __voll(true); await doChangePassword(); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'gs_sb_token' || k === 'gs_sb_refresh')) return { ok: false, warum: 'kein Schreibversuch auf die Sitzung — Fall nicht hergestellt (Fehler: ' + (document.getElementById('pw-change-err').textContent || '—') + ')' };
      const ok = document.getElementById('pw-change-ok').textContent || '';
      if (!/geändert/.test(ok)) return { ok: false, warum: 'kein Erfolg gemeldet: „' + ok.slice(0, 80) + '"' };
      if (!/Speicher.*voll|nicht gesichert/i.test(ok)) return { ok: false, warum: 'meldet reinen Erfolg, obwohl die Sitzung nicht gesichert wurde: „' + ok.slice(0, 80) + '"' };
      if (!/neu anmelden/i.test(ok)) return { ok: false, warum: 'sagt nicht, was zu tun ist' };
      return { ok: true, info: '„' + ok.slice(0, 90) + '…"' };
    },
  },
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    // Der volle Speicher: der App-Wrapper bleibt darunter liegen; darueber
    // eine Schicht, die auf Wunsch JEDEN Schreibversuch mit false beantwortet
    // und den Schluessel notiert — so wie der Wrapper es bei Quota tut.
    const orig = localStorage.setItem;
    window.__VOLL = false; window.__VOLL_LOG = [];
    localStorage.setItem = function (k, v) {
      if (window.__VOLL) { window.__VOLL_LOG.push(String(k)); return false; }
      return orig.call(localStorage, k, v);
    };
    window.__voll = (an) => { window.__VOLL = !!an; if (an) { window.__VOLL_LOG = []; window.__TOASTS = []; } };
    window.__TOASTS = [];
    const merk = (t) => { window.__TOASTS.push(String((t && t.title) ? t.title + ' ' + (t.msg || t.body || '') : t)); };
    window.gsToast = merk; window.showProfileToast = merk;
    window.gsHaptic = () => {};
  });

  console.log('\n=== speicher_check — was tut die App, wenn der Gerätespeicher voll ist?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await p.evaluate(new Function('return (' + f.lauf.toString() + ')()')); }
    catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Fälle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: hergestellt wird der volle Speicher, nicht das volle Geraet — ob der');
  console.log('  Browser bei Quota wirklich false liefert, prueft der Wrapper selbst (v30.98).');
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
