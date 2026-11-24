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
  {
    // v33.03: „Rezept gespeichert!" stand VOR dem Schreiben, und der
    // Rueckgabewert lag in einem toten catch (setItem wirft nie, §3.5).
    name: 'Rezept-Favorit · bei vollem Speicher bleibt die Liste, wie sie war — und sagt es',
    lauf: () => {
      if (typeof toggleRecipeFav !== 'function') return { ok: false, warum: 'toggleRecipeFav fehlt' };
      localStorage.setItem('gs_recipe_favs', JSON.stringify([]));
      __voll(true); toggleRecipeFav('r-pruef'); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'gs_recipe_favs')) return { ok: false, warum: 'kein Schreibversuch auf gs_recipe_favs — Fall nicht hergestellt' };
      if (typeof isRecipeFav === 'function' && isRecipeFav('r-pruef')) return { ok: false, warum: 'die Liste behielt das Rezept, obwohl nichts geschrieben wurde — beim naechsten Laden waere es weg' };
      if (__TOASTS.some(t => /^Rezept gespeichert/.test(t))) return { ok: false, warum: 'meldet „Rezept gespeichert!" fuer nichts: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
      if (!__TOASTS.some(t => /nicht gespeichert/.test(t))) return { ok: false, warum: 'still verloren, keine Meldung: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
      // Gegenrichtung: mit Platz muss es normal durchgehen.
      toggleRecipeFav('r-pruef');
      const drin = (typeof isRecipeFav === 'function') && isRecipeFav('r-pruef');
      try { localStorage.removeItem('gs_recipe_favs'); } catch (_) {}
      if (!drin) return { ok: false, warum: 'mit Platz kam der Favorit nicht an — die Reparatur blockiert den Normalfall' };
      return { ok: true, info: 'voll → Liste unveraendert + „' + (__TOASTS.find(t => /nicht gespeichert/.test(t)) || '').slice(0, 46) + '" · mit Platz → normal gespeichert' };
    },
  },
  {
    // 19.11.2026 (Geschwister zum Blob-Fund): gsPPduplicatePlan schrieb die Kopie ohne Blick auf den
    // Rueckgabewert und sagte „🔁 Plan dupliziert" — auch wenn weder Geraet noch Cloud sie hatten.
    name: 'Plan duplizieren · bei vollem Speicher (abgemeldet) kein „dupliziert" — mit Platz genau eine Kopie',
    lauf: async () => {
      if (typeof gsPPduplicatePlan !== 'function') return { ok: false, warum: 'gsPPduplicatePlan fehlt' };
      const echt = { login: window.sbIsLoggedIn, open: window.gsPPopenSavedPlans, vac: window.gsCollectionsAutoVacuumDebounced };
      window.sbIsLoggedIn = () => false; window.gsPPopenSavedPlans = () => {}; window.gsCollectionsAutoVacuumDebounced = () => {};
      const QUELLE = { id: 'plan_voll', title: 'Vollplan', created: '2026-05-01T00:00:00.000Z', plan: { summary: 'Q', plants: [] }, source: 'local' };
      const kopien = () => (JSON.parse(localStorage.getItem('gs_garden_plans') || '[]') || []).filter(x => x && x.title === 'Vollplan (Kopie)').length;
      try {
        localStorage.setItem('gs_garden_plans', JSON.stringify([QUELLE]));
        __voll(true); await gsPPduplicatePlan('plan_voll'); __voll(false);
        if (!__VOLL_LOG.some(k => k === 'gs_garden_plans')) return { ok: false, warum: 'kein Schreibversuch auf gs_garden_plans — Fall nicht hergestellt' };
        if (__TOASTS.some(t => /Plan dupliziert/.test(t))) return { ok: false, warum: 'meldet „dupliziert" fuer nichts: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        if (!__TOASTS.some(t => /Speicher voll/.test(t))) return { ok: false, warum: 'still verloren, keine Meldung: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        if (kopien()) return { ok: false, warum: 'eine Kopie steht im Speicher, obwohl der Schreibversuch scheiterte' };
        window.__TOASTS = [];
        await gsPPduplicatePlan('plan_voll');
        if (kopien() !== 1 || !__TOASTS.some(t => /^🔁 Plan dupliziert$/.test(t))) return { ok: false, warum: 'mit Platz: ' + JSON.stringify({ kopien: kopien(), meldungen: __TOASTS }) };
        return { ok: true, info: 'voll → „Speicher voll", keine Kopie · mit Platz → genau eine Kopie, „🔁 Plan dupliziert"' };
      } finally { try { localStorage.removeItem('gs_garden_plans'); } catch (_) {} window.sbIsLoggedIn = echt.login; window.gsPPopenSavedPlans = echt.open; window.gsCollectionsAutoVacuumDebounced = echt.vac; }
    },
  },
  {
    // v33.03: zwei ungeprueffte Schreibvorgaenge hintereinander — Server und Geraet.
    // Hier die lokale Haelfte: der Server sagt Ja, das Geraet ist voll.
    name: 'Name aendern · Server sagt Ja, Geraet ist voll → „geaendert, aber nicht gemerkt" statt „aktualisiert"',
    lauf: async () => {
      if (typeof profEditName !== 'function') return { ok: false, warum: 'profEditName fehlt' };
      const echtPrompt = window.gsPromptModal, echtFetch = window.sbFetch, echtRender = window.renderProfileLoggedIn, echtBar = window.updateMenuProfileBar;
      window.gsPromptModal = async () => 'Neuer Prüfname';
      window.sbFetch = async () => ({ data: [{ id: 'u1', display_name: 'Neuer Prüfname' }], error: null });
      window.renderProfileLoggedIn = () => {}; window.updateMenuProfileBar = () => {};
      // sbSaveProfile steigt ohne gs_sb_uid sofort mit {error} aus — ohne diese
      // Zeile misst der Fall eine Funktion, die gar nicht bis zum Speichern kommt.
      const echtUid = gsStore.get('gs_sb_uid', null);
      gsStore.set('gs_sb_uid', '00000000-0000-0000-0000-000000000001');
      try {
        __voll(true); await profEditName(); __voll(false);
        if (!__VOLL_LOG.some(k => k === 'gs_sb_display_name')) return { ok: false, warum: 'kein Schreibversuch auf gs_sb_display_name — Fall nicht hergestellt' };
        if (__TOASTS.some(t => /Name aktualisiert/.test(t))) return { ok: false, warum: 'meldet „✅ Name aktualisiert!", obwohl das Geraet nichts gespeichert hat' };
        if (!__TOASTS.some(t => /nicht gemerkt/.test(t))) return { ok: false, warum: 'keine ehrliche Meldung: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        return { ok: true, info: '„' + (__TOASTS.find(t => /nicht gemerkt/.test(t)) || '').slice(0, 60) + '"' };
      } finally {
        __voll(false);
        window.gsPromptModal = echtPrompt; window.sbFetch = echtFetch;
        window.renderProfileLoggedIn = echtRender; window.updateMenuProfileBar = echtBar;
        try { if (echtUid == null) gsStore.remove('gs_sb_uid'); else gsStore.set('gs_sb_uid', echtUid); } catch (_) {}
        try { localStorage.removeItem('gs_sb_display_name'); } catch (_) {}
      }
    },
  },
  // ── v33.61 · Linas zwei Schreibwege (Arbeitsliste „Offen — Lina" 6) ──
  {
    name: 'Lina · „Pflanze hinzufügen" bei vollem Speicher: keine Pflanze in der Liste, keine Erfolgsmeldung — mit Platz genau eine',
    lauf: async () => {
      const echt = window.gsConfirmModal;
      try {
        window.gsConfirmModal = async () => true;
        const vor = myPlants.length;
        __voll(true); await gsLinaDispatch({ tool: 'propose_add_plant', args: { name: 'Prüfminze' } }); __voll(false);
        if (!__VOLL_LOG.some(k => k === 'ps_myplants')) return { ok: false, warum: 'kein Schreibversuch auf ps_myplants — Fall nicht hergestellt' };
        if (myPlants.length !== vor) return { ok: false, warum: 'die Pflanze steht in der Liste, obwohl nichts gespeichert wurde' };
        if (__TOASTS.some(t => /✅.*hinzugefügt/.test(t))) return { ok: false, warum: 'meldet „hinzugefügt" für nichts: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        if (!__TOASTS.some(t => /Speicher ist voll|nicht gespeichert/i.test(t))) return { ok: false, warum: 'still verloren, keine Meldung: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        // Gegenrichtung: mit Platz genau eine.
        await gsLinaDispatch({ tool: 'propose_add_plant', args: { name: 'Prüfminze' } });
        const n = myPlants.filter(p => p && p.name === 'Prüfminze').length;
        for (let i = myPlants.length - 1; i >= 0; i--) if (myPlants[i] && myPlants[i].name === 'Prüfminze') myPlants.splice(i, 1);
        savePlantsToStorage();
        if (n !== 1) return { ok: false, warum: 'mit Platz ' + n + ' statt 1 Pflanze — die Reparatur blockiert den Normalfall' };
        return { ok: true, info: 'voll → keine Pflanze + Meldung · mit Platz → genau eine' };
      } finally { window.gsConfirmModal = echt; }
    },
  },
  {
    name: 'Lina · Erinnerung an einer GARTEN-Pflanzung: geschrieben wird gs_plantings — bei vollem Speicher keine Erfolgsmeldung und kein halber Zustand',
    lauf: async () => {
      const echt = window.gsConfirmModal;
      try {
        window.gsConfirmModal = async () => true;
        const pl = ((typeof plantings !== 'undefined' && plantings) || []).find(x => x && x.name === 'Zucchini');
        if (!pl) return { ok: false, warum: 'keine Garten-Pflanzung „Zucchini" in den Beispieldaten — der Fall misst nichts' };
        const vorher = JSON.stringify(pl.tasks || {});
        __voll(true); await gsLinaDispatch({ tool: 'propose_reminder', args: { task: 'mist', plantName: 'Zucchini', intervalDays: 5 } }); __voll(false);
        if (!__VOLL_LOG.some(k => k === 'gs_plantings')) return { ok: false, warum: 'kein Schreibversuch auf gs_plantings — die Erinnerung wurde gar nicht dort geschrieben (' + JSON.stringify(__VOLL_LOG) + ')' };
        if (__TOASTS.some(t => /✅.*eingerichtet/.test(t))) return { ok: false, warum: 'meldet „eingerichtet" für nichts' };
        if (!__TOASTS.some(t => /Speicher ist voll|nicht gespeichert/i.test(t))) return { ok: false, warum: 'keine Meldung: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        if (JSON.stringify(pl.tasks || {}) !== vorher) return { ok: false, warum: 'die Aufgabe blieb im Arbeitsspeicher halb gesetzt' };
        // Gegenrichtung: mit Platz kommt sie an — in der Liste UND auf dem Gerät.
        __TOASTS.length = 0;
        await gsLinaDispatch({ tool: 'propose_reminder', args: { task: 'mist', plantName: 'Zucchini', intervalDays: 5 } });
        const t = pl.tasks && pl.tasks.mist;
        const ger = JSON.parse(localStorage.getItem('gs_plantings') || '[]').find(x => x && x.id === pl.id);
        const da = !!(t && t.active && t.intervalDays === 5 && ger && ger.tasks && ger.tasks.mist && ger.tasks.mist.active);
        pl.tasks = JSON.parse(vorher); saveGardenData();
        if (!da) return { ok: false, warum: 'mit Platz kam die Erinnerung nicht an: ' + JSON.stringify(t) };
        if (!__TOASTS.some(x => /✅.*eingerichtet/.test(x))) return { ok: false, warum: 'mit Platz keine Bestätigung' };
        return { ok: true, info: 'voll → Meldung, Aufgabe unverändert · mit Platz → gs_plantings trägt „mist alle 5 Tage"' };
      } finally { window.gsConfirmModal = echt; }
    },
  },
  // ── v33.65 · Pflanzen sichern (Auftrag P-F, H2/H4/H5) ──
  {
    name: 'Scan → „Zu meinen Pflanzen" bei vollem Speicher: keine Pflanze in der Liste, keine Erfolgsmeldung, ein Satz — mit Platz genau eine',
    lauf: async () => {
      const echt = window.gsPickScanLocation; const vorR = window._lastScanResult;
      try {
        window.gsPickScanLocation = async () => 'indoor';
        window._lastScanResult = { name: 'Prüfscan-Kraut', latin: 'Prueferia scanensis', category: 'kraut', confidence: 91 };
        const vor = myPlants.length;
        __voll(true); await window.gsAddScanToMyPlants(); __voll(false);
        if (!__VOLL_LOG.some(k => k === 'ps_myplants')) return { ok: false, warum: 'kein Schreibversuch auf ps_myplants — Fall nicht hergestellt (' + JSON.stringify(__VOLL_LOG) + ' · ' + JSON.stringify(__TOASTS.slice(0, 2)) + ')' };
        if (myPlants.length !== vor) { const n0 = myPlants.length; myPlants = myPlants.filter(p => p.name !== 'Prüfscan-Kraut'); return { ok: false, warum: 'die Pflanze steht in der Liste (' + n0 + ' statt ' + vor + '), obwohl nichts gespeichert wurde' }; }
        if (__TOASTS.some(t => /✅.*hinzugefügt/.test(t))) return { ok: false, warum: 'meldet „hinzugefügt" für nichts: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        if (!__TOASTS.some(t => /Speicher ist voll|nicht gespeichert/i.test(t))) return { ok: false, warum: 'still verloren, keine Meldung: ' + JSON.stringify(__TOASTS.slice(0, 3)) };
        window.__TOASTS = [];
        await window.gsAddScanToMyPlants();
        const n = myPlants.filter(p => p && p.name === 'Prüfscan-Kraut').length;
        myPlants = myPlants.filter(p => !(p && p.name === 'Prüfscan-Kraut')); savePlantsToStorage();
        if (n !== 1) return { ok: false, warum: 'mit Platz ' + n + ' statt 1 Pflanze' };
        return { ok: true, info: 'voll → keine Pflanze + Satz · mit Platz → genau eine' };
      } finally { window.gsPickScanLocation = echt; window._lastScanResult = vorR; }
    },
  },
  {
    name: '„Pflanze speichern" (neu) bei vollem Speicher: Pflanze nicht in der Liste, Fenster bleibt offen (Eingabe nicht weg), keine Erfolgsmeldung — mit Platz genau eine',
    lauf: async () => {
      const setze = (n) => { document.getElementById('mp-name').value = n; document.getElementById('mp-nick').value = ''; document.getElementById('mp-notes').value = 'Prüfnotiz'; };
      try { editingPlantId = null; openModal('modal-addplant'); setze('Prüfpflanze-Neu'); } catch (e) { return { ok: false, warum: 'Fenster nicht herstellbar: ' + e.message }; }
      const ind = document.querySelector('input[name="mp-location"][value="indoor"]'); if (ind) ind.checked = true;
      const vor = myPlants.length;
      __voll(true); await savePlant(); __voll(false);
      const offen = document.getElementById('modal-addplant').classList.contains('open');
      const drin = myPlants.some(p => p && p.name === 'Prüfpflanze-Neu');
      const eingabe = document.getElementById('mp-name').value;
      const toasts = __TOASTS.slice();
      myPlants = myPlants.filter(p => !(p && p.name === 'Prüfpflanze-Neu'));
      const f = [];
      if (!__VOLL_LOG.some(k => k === 'ps_myplants')) f.push('Fall nicht hergestellt: kein Schreibversuch');
      if (drin) f.push('die Pflanze steht in der Liste, obwohl nichts gespeichert wurde');
      if (!offen) f.push('das Fenster ist zu — die Eingabe ist weg');
      else if (eingabe !== 'Prüfpflanze-Neu') f.push('das Fenster ist offen, aber die Eingabe fehlt');
      if (toasts.some(t => /✅.*Zu „Meine Pflanzen"/.test(t))) f.push('meldet „hinzugefügt" für nichts');
      if (!toasts.some(t => /Speicher ist voll|nicht gespeichert/i.test(t))) f.push('kein Satz: ' + JSON.stringify(toasts.slice(0, 2)));
      if (f.length) { try { closeModal('modal-addplant'); } catch (_) {} return { ok: false, warum: f.join(' · ') }; }
      // Gegenrichtung: mit Platz genau eine, Fenster zu
      window.__TOASTS = [];
      await savePlant();
      const n = myPlants.filter(p => p && p.name === 'Prüfpflanze-Neu').length;
      const zu = !document.getElementById('modal-addplant').classList.contains('open');
      myPlants = myPlants.filter(p => !(p && p.name === 'Prüfpflanze-Neu')); savePlantsToStorage();
      try { closeModal('modal-addplant'); } catch (_) {}
      if (n !== 1 || !zu) return { ok: false, warum: 'mit Platz: ' + n + ' Pflanze(n), Fenster ' + (zu ? 'zu' : 'offen') + ' — die Reparatur blockiert den Normalfall' };
      return { ok: true, info: 'voll → nichts in der Liste, Fenster offen, Satz · mit Platz → genau eine, Fenster zu' };
    },
  },
  {
    name: '„Pflanze speichern" (ändern) bei vollem Speicher: die Pflanze behält ihren alten Stand statt halb geändert zu sein',
    lauf: async () => {
      const p0 = (() => { let p = myPlants.find(x => x && x.tasks && x.tasks.water && x.tasks.water.active); if (!p) { p = { id: 'mp_pf_probe', name: 'Probe-Monstera', emoji: '🌿', water: 2, sun: 2, notes: '', diary: [], added: new Date().toISOString(), tasks: { water: { active: true, intervalDays: 7, lastDone: new Date(Date.now() - 9 * 864e5).toISOString() } } }; myPlants.push(p); } return p; })();
      const alt = p0.name;
      try { editingPlantId = p0.id; openModal('modal-addplant'); document.getElementById('mp-name').value = 'Geändert-Prüf'; } catch (e) { return { ok: false, warum: 'Fenster nicht herstellbar: ' + e.message }; }
      const ind = document.querySelector('input[name="mp-location"][value="indoor"]'); if (ind) ind.checked = true;
      __voll(true); await savePlant(); __voll(false);
      const jetzt = (myPlants.find(x => x.id === p0.id) || {}).name;
      const toasts = __TOASTS.slice();
      const f = [];
      if (!__VOLL_LOG.some(k => k === 'ps_myplants')) f.push('Fall nicht hergestellt: kein Schreibversuch');
      if (jetzt !== alt) { f.push('Name steht auf „' + jetzt + '" statt „' + alt + '", obwohl nichts gespeichert wurde'); const q = myPlants.find(x => x.id === p0.id); if (q) q.name = alt; }
      if (toasts.some(t => /✅ Aktualisiert/.test(t))) f.push('meldet „Aktualisiert" für nichts');
      if (!toasts.some(t => /Speicher ist voll|nicht gespeichert/i.test(t))) f.push('kein Satz: ' + JSON.stringify(toasts.slice(0, 2)));
      try { closeModal('modal-addplant'); } catch (_) {} editingPlantId = null;
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'voll → Name bleibt „' + alt + '", Satz' };
    },
  },
  {
    name: 'Abhaken (gsQuickDone) bei vollem Speicher: lastDone und Tagebuch bleiben wie vorher, keine „erledigt!"-Meldung, ein Satz — mit Platz erledigt',
    lauf: async () => {
      const p = (() => { let p = myPlants.find(x => x && x.tasks && x.tasks.water && x.tasks.water.active); if (!p) { p = { id: 'mp_pf_probe', name: 'Probe-Monstera', emoji: '🌿', water: 2, sun: 2, notes: '', diary: [], added: new Date().toISOString(), tasks: { water: { active: true, intervalDays: 7, lastDone: new Date(Date.now() - 9 * 864e5).toISOString() } } }; myPlants.push(p); } return p; })();
      const ld = p.tasks.water.lastDone, dn = (p.diary || []).length;
      __voll(true); const r = gsQuickDone(p.id, 'water'); __voll(false);
      const f = [];
      if (!__VOLL_LOG.some(k => k === 'ps_myplants')) f.push('Fall nicht hergestellt: kein Schreibversuch');
      if (p.tasks.water.lastDone !== ld) f.push('lastDone steht auf „erledigt", obwohl nichts gespeichert wurde');
      if ((p.diary || []).length !== dn) f.push('Tagebuch-Eintrag steht da, obwohl nichts gespeichert wurde');
      if (__TOASTS.some(t => /erledigt! ✅/.test(t))) f.push('meldet „erledigt!" für nichts');
      if (!__TOASTS.some(t => /Speicher ist voll|nicht gespeichert/i.test(t))) f.push('kein Satz: ' + JSON.stringify(__TOASTS.slice(0, 2)));
      if (r !== false) f.push('Rückgabe ' + JSON.stringify(r) + ' statt false');
      p.tasks.water.lastDone = ld; if (p.diary && p.diary.length > dn) p.diary.splice(0, p.diary.length - dn);
      if (f.length) return { ok: false, warum: f.join(' · ') };
      window.__TOASTS = [];
      const r2 = gsQuickDone(p.id, 'water');
      const ok2 = p.tasks.water.lastDone !== ld && r2 === true;
      p.tasks.water.lastDone = ld; if (p.diary && p.diary.length > dn) p.diary.splice(0, p.diary.length - dn); savePlantsToStorage();
      if (!ok2) return { ok: false, warum: 'mit Platz nicht erledigt (Rückgabe ' + JSON.stringify(r2) + ')' };
      return { ok: true, info: 'voll → unverändert + Satz + false · mit Platz → erledigt + true' };
    },
  },
  {
    name: 'Karte „Heute zu tun" abhaken (gsDueCardDone): die Karte verschwindet nur, wenn die Aufgabe wirklich erledigt ist — voller Speicher und unbekannte Pflanze lassen sie stehen',
    lauf: async () => {
      const p = (() => { let p = myPlants.find(x => x && x.tasks && x.tasks.water && x.tasks.water.active); if (!p) { p = { id: 'mp_pf_probe', name: 'Probe-Monstera', emoji: '🌿', water: 2, sun: 2, notes: '', diary: [], added: new Date().toISOString(), tasks: { water: { active: true, intervalDays: 7, lastDone: new Date(Date.now() - 9 * 864e5).toISOString() } } }; myPlants.push(p); } return p; })();
      const ld = p.tasks.water.lastDone, dn = (p.diary || []).length;
      const karte = (id) => { const c = document.createElement('div'); c.className = 'due-card'; c.innerHTML = '<button class="due-check"></button>'; document.body.appendChild(c); return c; };
      const warte = (ms) => new Promise(r => setTimeout(r, ms));
      const f = [];
      // a · voller Speicher
      let c = karte(); let b = c.querySelector('button');
      __voll(true); gsDueCardDone(b, p.id, 'water'); await warte(450); __voll(false);
      if (!__VOLL_LOG.some(k => k === 'ps_myplants')) f.push('Fall a nicht hergestellt: kein Schreibversuch');
      if (b.classList.contains('checked') || b.disabled || c.classList.contains('gs-nc-out')) f.push('voll: die Karte ist abgehakt/ausgeblendet, obwohl nichts gespeichert wurde');
      c.remove(); p.tasks.water.lastDone = ld; if (p.diary && p.diary.length > dn) p.diary.splice(0, p.diary.length - dn);
      // b · die Pflanze gibt es nicht
      window.__TOASTS = [];
      c = karte(); b = c.querySelector('button');
      gsDueCardDone(b, 'gibt-es-nicht', 'water'); await warte(450);
      if (b.classList.contains('checked') || b.disabled || c.classList.contains('gs-nc-out')) f.push('unbekannte Pflanze: die Karte ist abgehakt/ausgeblendet');
      if (!__TOASTS.length) f.push('unbekannte Pflanze: kein Satz');
      c.remove();
      if (f.length) return { ok: false, warum: f.join(' · ') };
      // c · Gegenrichtung: mit Platz bleibt sie abgehakt
      c = karte(); b = c.querySelector('button');
      gsDueCardDone(b, p.id, 'water'); await warte(450);
      const bleibt = b.classList.contains('checked') && c.classList.contains('gs-nc-out');
      c.remove(); p.tasks.water.lastDone = ld; if (p.diary && p.diary.length > dn) p.diary.splice(0, p.diary.length - dn); savePlantsToStorage();
      if (!bleibt) return { ok: false, warum: 'mit Platz: die Karte ist nicht abgehakt — die Reparatur blockiert den Normalfall' };
      return { ok: true, info: 'voll → Karte bleibt · unbekannt → Karte bleibt + Satz · mit Platz → abgehakt' };
    },
  },
  {
    name: 'Pflanze „im Garten" ohne Garten (savePlant): keine Ausnahme, keine stille Wohnungs-Pflanze — ein Satz',
    lauf: async () => {
      const echt = window.gsConfirmModal; const gAlt = gardens; const vor = myPlants.length;
      try {
        gardens = []; window.gsConfirmModal = undefined;
        editingPlantId = null; openModal('modal-addplant');
        document.getElementById('mp-name').value = 'Prüf-Garten-Ohne';
        const out = document.querySelector('input[name="mp-location"][value="outdoor"]'); if (out) out.checked = true;
        window.__TOASTS = [];
        await savePlant();
        const drin = myPlants.some(p => p && p.name === 'Prüf-Garten-Ohne');
        myPlants = myPlants.filter(p => !(p && p.name === 'Prüf-Garten-Ohne'));
        const f = [];
        if (drin) f.push('es wurde still eine WOHNUNGS-Pflanze angelegt, obwohl „Garten" gewählt war');
        if (!__TOASTS.some(t => /Garten/.test(t))) f.push('kein Satz über den fehlenden Garten: ' + JSON.stringify(__TOASTS.slice(0, 2)));
        if (f.length) return { ok: false, warum: f.join(' · ') };
        return { ok: true, info: 'keine Pflanze angelegt, Satz zum Garten' };
      } finally { gardens = gAlt; window.gsConfirmModal = echt; try { closeModal('modal-addplant'); } catch (_) {} if (myPlants.length !== vor) myPlants = myPlants.slice(0, vor); }
    },
  },
  {
    // v33.59 (Austausch-Runde, uebergabe-b4): gsPlans.parken las seinen Schreibversuch nicht,
    // und gsClearUserDataKeys warf danach gs_plans_v2 weg — die einzige Kopie. Drei Lagen:
    // voll + gestempelt (bleibt, nur fuer A, Satz) · voll + ungestempelt (geht, Satz — sonst
    // saehe ihn das naechste Konto) · Speicher frei (geparkt, kein Satz). Steht zuletzt: das
    // Abmelden raeumt die Beispieldaten ab.
    name: 'Abmelden mit vollem Speicher und lokalem Plan · nicht still weg, und nie für ein anderes Konto',
    lauf: () => {
      if (!window.gsPlans || typeof gsClearUserDataKeys !== 'function') return { ok: false, warum: 'gsPlans oder gsClearUserDataKeys fehlt' };
      const A = 'aaaaaaaa-0000-4000-8000-00000000000a', B = 'bbbbbbbb-0000-4000-8000-00000000000b';
      const plan = (id, mitUid) => ({ localId: id, id: id, uid: mitUid ? A : undefined, type: 'garden', title: 'Plan ohne Empfang ' + id, summary: '', payload: {}, created: new Date().toISOString(), starred: false, cloud: false });
      const lage = (eintrag, voll) => {
        localStorage.removeItem('gs_plans_wartend');
        localStorage.setItem('gs_plans_v2', JSON.stringify([eintrag]));
        localStorage.setItem('gs_last_active_uid', A);
        __voll(!!voll); if (!voll) { window.__VOLL_LOG = []; window.__TOASTS = []; }
        gsClearUserDataKeys(); const log = window.__VOLL_LOG.slice(); __voll(false);
        const v2 = JSON.parse(localStorage.getItem('gs_plans_v2') || '[]');
        const w = JSON.parse(localStorage.getItem('gs_plans_wartend') || '[]');
        return { versuche: log.filter(k => k === 'gs_plans_wartend').length, v2, w, satz: window.__TOASTS.filter(t => /Plan/.test(t) && /Speicher voll/.test(t)) };
      };
      const sieht = (wer, id) => { const echt = gsStore.get; gsStore.get = (k, f) => k === 'gs_sb_uid' ? wer : echt.call(gsStore, k, f); try { return !!gsPlans.load(id); } finally { gsStore.get = echt; } };
      // 1 · voll, gestempelt
      const r1 = lage(plan('l-voll-1', true), true);
      if (r1.versuche < 1) return { ok: false, warum: 'kein Schreibversuch auf gs_plans_wartend — Fall nicht hergestellt' };
      const da1 = r1.v2.concat(r1.w).some(e => e.localId === 'l-voll-1' && e.uid === A);
      if (!da1 && !r1.satz.length) return { ok: false, warum: 'der Plan ist nach dem Abmelden weg, und nichts sagt es (' + r1.versuche + ' gescheiterte Versuche)' };
      if (!da1) return { ok: false, warum: 'der gestempelte Plan ist weg (Satz: „' + r1.satz[0] + '")' };
      if (!r1.satz.length) return { ok: false, warum: 'Plan liegt noch da, aber keine Meldung an die Person' };
      if (sieht(B, 'l-voll-1')) return { ok: false, warum: 'ein ANDERES Konto sieht den liegengebliebenen Plan' };
      if (!sieht(A, 'l-voll-1')) return { ok: false, warum: 'das eigene Konto sieht seinen Plan nicht mehr' };
      // 2 · voll, Altplan OHNE Stempel: der Stempel laesst sich nicht schreiben → darf nicht
      // liegen bleiben (das naechste Konto stempelte ihn als seinen), und die Person erfaehrt es
      const r2 = lage(plan('l-voll-2', false), true);
      if (r2.v2.length) return { ok: false, warum: 'ungestempelter Plan bleibt liegen — das naechste Konto bekaeme ihn (' + JSON.stringify(r2.v2).slice(0, 80) + ')' };
      if (!r2.satz.length) return { ok: false, warum: 'ungestempelter Plan still weg — kein Satz' };
      // 3 · Gegenrichtung: Speicher frei → geparkt, gs_plans_v2 weg, kein Satz
      const r3 = lage(plan('l-frei-3', true), false);
      if (!r3.w.some(e => e.localId === 'l-frei-3' && e.uid === A)) return { ok: false, warum: 'bei freiem Speicher nicht geparkt' };
      if (r3.v2.length) return { ok: false, warum: 'bei freiem Speicher ueberlebt gs_plans_v2 das Abmelden' };
      if (r3.satz.length) return { ok: false, warum: 'Meldung ohne Anlass: „' + r3.satz[0] + '"' };
      // 4 · der Normalfall auf einem echten Geraet: der ERSTE Versuch scheitert, das Raeumen der
      // uebrigen Schluessel macht Platz, der zweite gelingt → geparkt, gs_plans_v2 weg, kein Satz
      const echt = localStorage.setItem; let n4 = 0;
      localStorage.setItem = function (k, v) { if (k === 'gs_plans_wartend' && n4++ === 0) return false; return echt.call(localStorage, k, v); };
      let r4; try { r4 = lage(plan('l-zwei-4', false), false); } finally { localStorage.setItem = echt; }
      if (n4 < 2) return { ok: false, warum: 'kein zweiter Versuch nach dem Raeumen (' + n4 + ' Versuch)' };
      if (!r4.w.some(e => e.localId === 'l-zwei-4' && e.uid === A)) return { ok: false, warum: 'zweiter Versuch: Plan nicht geparkt' };
      if (r4.v2.length || r4.satz.length) return { ok: false, warum: 'zweiter Versuch gelungen, aber gs_plans_v2 bleibt oder Satz: ' + JSON.stringify(r4).slice(0, 120) };
      localStorage.removeItem('gs_plans_wartend');
      return { ok: true, info: 'voll: bleibt nur fuer A + Satz · ungestempelt: weg + Satz · frei: geparkt, still · zweiter Versuch nach dem Raeumen: geparkt, still' };
    },
  },
  {
    // Gesamtpruefung g1 (#2): der Speicher ist GENAU voll — ein Schreibversuch, der die Belegung
    // vergroessert, scheitert, einer, der sie verkleinert, gelingt (so verhaelt sich ein echtes
    // Geraet; der Fall oben laesst JEDEN scheitern und sah es deshalb nicht). Abmelden mit 25
    // Plaenen: 15 aus der Cloud, dahinter 10 nur lokale ohne Stempel (vor v33.59 gespeichert).
    // Bis hierher kuerzte stempeln() ueber den 20er-Rueckfall von writeLS still auf 20 — die
    // Plaetze 21 bis 25 waren weg, bevor geparkt wurde, und keine Meldung kam.
    name: 'Abmelden bei genau vollem Speicher mit 25 Plaenen · kein nur lokaler Plan geht verloren (das Stempeln kuerzt nicht still)',
    lauf: () => {
      if (!window.gsPlans || typeof gsClearUserDataKeys !== 'function') return { ok: false, warum: 'gsPlans oder gsClearUserDataKeys fehlt' };
      const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
      const gross = 'x'.repeat(4000);
      const t0 = Date.now();
      const l = [];
      for (let i = 0; i < 15; i++) l.push({ localId: 'c' + i, id: 'cloud-' + i, uid: A, type: 'garden', title: 'Cloud-Plan ' + i, summary: '', payload: { t: gross }, created: new Date(t0 - i * 60000).toISOString(), starred: false, cloud: true });
      for (let i = 15; i < 25; i++) l.push({ localId: 'l' + i, id: 'l' + i, type: 'garden', title: 'Nur lokal ' + i, summary: '', payload: { t: gross }, created: new Date(t0 - i * 60000).toISOString(), starred: false, cloud: false });
      localStorage.removeItem('gs_plans_wartend');
      localStorage.setItem('gs_plans_v2', JSON.stringify(l));
      localStorage.setItem('gs_last_active_uid', A);
      // Platz, den das Raeumen der uebrigen Nutzer-Schluessel freigibt (wie die Daten einer echten Person)
      localStorage.setItem('ps_myplants', JSON.stringify([{ id: 'fueller', name: 'Füller', notiz: 'y'.repeat(120000) }]));
      const echt = localStorage.setItem;
      const belegt = () => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } return n; };
      const grenze = belegt();   // genau voll
      const log = [];
      localStorage.setItem = function (k, v) {
        const alt = localStorage.getItem(k);
        const neu = belegt() - (alt == null ? 0 : String(k).length + alt.length) + String(k).length + String(v).length;
        const ja = neu <= grenze;
        log.push(k + (ja ? '' : ':voll'));
        return ja ? echt.call(localStorage, k, v) : false;
      };
      window.__TOASTS = [];
      try { gsClearUserDataKeys(); } finally { localStorage.setItem = echt; }
      const v2 = JSON.parse(localStorage.getItem('gs_plans_v2') || '[]');
      const w = JSON.parse(localStorage.getItem('gs_plans_wartend') || '[]');
      const da = (id) => w.concat(v2).some(e => e && e.localId === id && e.uid === A);
      const weg = []; for (let i = 15; i < 25; i++) if (!da('l' + i)) weg.push('l' + i);
      const satz = window.__TOASTS.filter(t => /Plan|Pläne/.test(t));
      localStorage.removeItem('gs_plans_wartend'); localStorage.removeItem('gs_plans_v2');
      if (!log.some(k => /^gs_plans_v2/.test(k))) return { ok: false, warum: 'kein Schreibversuch auf gs_plans_v2 — der Stempel wurde nie versucht, Fall nicht hergestellt (' + log.join(', ') + ')' };
      if (weg.length) return { ok: false, warum: weg.length + ' nur lokale Plaene verloren: ' + weg.join(',') + (satz.length ? ' (Satz: „' + satz[0] + '")' : ' — ohne jede Meldung') + ' · Schreibversuche: ' + log.join(', ') };
      return { ok: true, info: '10 von 10 nur lokalen Plaenen aufbewahrt (' + w.filter(e => e.uid === A).length + ' wartend, ' + v2.length + ' in gs_plans_v2) · Versuche: ' + log.join(', ') + (satz.length ? ' · Satz: „' + satz[0].slice(0, 50) + '…"' : '') };
    },
  },
  {
    // Gesamtpruefung g1 (#8): parken() meldete „geparkt", auch wenn deckeln() einen Teil
    // verwarf — einen Plan, der seit mehr als 90 Tagen nur lokal liegt (gezaehlt ab ANLAGE), oder
    // den 21. je Konto. gsClearUserDataKeys loeschte danach gs_plans_v2, die einzige Kopie. Der
    // Speicher ist hier FREI — es geht nur um den Deckel. Gegenrichtung: ein Plan, der seit mehr
    // als 90 Tagen WARTET, faellt weiter weg (die Frist gilt), und drei Plaene parken still.
    name: 'Abmelden · der Deckel des Wartebereichs (20 je Konto, 90 Tage) verwirft keinen nur lokalen Plan still — parken meldet −1, der Plan bleibt, der Satz nennt den Grund',
    lauf: () => {
      if (!window.gsPlans || typeof gsClearUserDataKeys !== 'function') return { ok: false, warum: 'gsPlans oder gsClearUserDataKeys fehlt' };
      const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
      const T = 86400000;
      const plan = (id, alterTage, extra) => Object.assign({ localId: id, id: id, uid: A, type: 'garden', title: 'Nur lokal ' + id, summary: '', payload: {}, created: new Date(Date.now() - alterTage * T).toISOString(), starred: false, cloud: false }, extra || {});
      const lage = (v2, wartend) => {
        localStorage.setItem('gs_plans_v2', JSON.stringify(v2));
        if (wartend) localStorage.setItem('gs_plans_wartend', JSON.stringify(wartend)); else localStorage.removeItem('gs_plans_wartend');
        localStorage.setItem('gs_last_active_uid', A);
        window.__TOASTS = [];
        gsClearUserDataKeys();
        const r = { v2: JSON.parse(localStorage.getItem('gs_plans_v2') || '[]'), w: JSON.parse(localStorage.getItem('gs_plans_wartend') || '[]'), satz: window.__TOASTS.filter(t => /Plan|Pläne/.test(t)) };
        localStorage.removeItem('gs_plans_v2'); localStorage.removeItem('gs_plans_wartend');
        return r;
      };
      const da = (r, id) => r.w.concat(r.v2).some(e => e && e.localId === id && e.uid === A);
      const f = [];
      // 1 · ein Plan, vor 100 Tagen angelegt und nie hochgeladen
      const r1 = lage([plan('alt-100', 100)]);
      if (!da(r1, 'alt-100')) f.push('Plan von vor 100 Tagen beim Abmelden verworfen' + (r1.satz.length ? ' (Satz: „' + r1.satz[0] + '")' : ', ohne Meldung'));
      // 2 · 21 nur lokale Plaene
      const v21 = []; for (let i = 0; i < 21; i++) v21.push(plan('n' + i, i / 10));
      const r2 = lage(v21);
      const weg2 = v21.filter(e => !da(r2, e.localId)).map(e => e.localId);
      if (weg2.length) f.push('21 Plaene: ' + weg2.join(',') + ' weg' + (r2.satz.length ? '' : ', ohne Meldung'));
      else if (!r2.satz.length) f.push('21 Plaene: nicht alle geparkt, aber kein Satz');
      else if (/Speicher voll/.test(r2.satz[0])) f.push('21 Plaene: der Satz sagt „Speicher voll", der Grund ist der Deckel („' + r2.satz[0] + '")');
      else if (!/20/.test(r2.satz[0])) f.push('21 Plaene: der Satz nennt den Deckel nicht („' + r2.satz[0] + '")');
      // 3 · fuenf warten schon (frueheres Abmelden, nie abgeholt), 18 kommen dazu — der Deckel
      //     darf die WARTENDEN nicht verdraengen: dort ist es die einzige Kopie
      const w5 = []; for (let i = 0; i < 5; i++) w5.push(plan('w' + i, 10, { geparkt: new Date(Date.now() - 5 * T).toISOString() }));
      const v18 = []; for (let i = 0; i < 18; i++) v18.push(plan('m' + i, i / 10));
      const r3 = lage(v18, w5);
      const weg3 = w5.concat(v18).filter(e => !da(r3, e.localId)).map(e => e.localId);
      if (weg3.length) f.push('5 wartend + 18 neu: ' + weg3.join(',') + ' weg');
      // 4 · Gegenrichtung: die Frist gilt weiter — seit 100 Tagen WARTEND faellt weg; drei neue parken still
      const r4 = lage([plan('g0', 1), plan('g1', 200), plan('g2', 3)], [plan('abgelaufen', 300, { geparkt: new Date(Date.now() - 100 * T).toISOString() })]);
      if (['g0', 'g1', 'g2'].some(id => !r4.w.some(e => e.localId === id))) f.push('Gegenrichtung: drei Plaene nicht geparkt (' + JSON.stringify(r4.w.map(e => e.localId)) + ')');
      if (r4.v2.length) f.push('Gegenrichtung: gs_plans_v2 ueberlebt ein gelungenes Parken');
      if (r4.satz.length) f.push('Gegenrichtung: Satz ohne Anlass („' + r4.satz[0] + '")');
      if (r4.w.some(e => e.localId === 'abgelaufen')) f.push('Gegenrichtung: ein Plan, der seit 100 Tagen wartet, faellt nicht weg — die Frist wirkt nicht mehr');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '100 Tage alt: aufbewahrt · 21 Plaene: keiner weg, Satz „' + r2.satz[0].slice(0, 60) + '…" · 5 wartend + 18: keiner verdraengt · Frist ab dem Parken wirkt weiter, 3 Plaene still geparkt' };
    },
  },
  {
    // Gegenpruefung g1: der Deckel macht −1 zu einem Zustand, der BLEIBT — solange A mehr als 20
    // nur lokale Plaene hat, gibt jedes Parken −1, auch beim Abmelden eines ANDEREN Kontos. Dann
    // blieb gs_plans_v2 ganz liegen, mit den Cloud-Plaenen von B (Titel, Inhalt), obwohl B sich
    // abgemeldet hat; versteckt nur durch den uid-Filter der Anzeige. Ein Cloud-Plan liegt in der
    // Cloud — aufzuheben ist nur, was es NUR hier gibt. Gegenrichtung: kein lokaler Plan von A
    // oder B geht verloren, und im Fall „voll" (der Fall oben) bleibt alles wie dort gemessen.
    name: 'Abmelden eines zweiten Kontos, waehrend der Deckel greift · seine Cloud-Plaene bleiben nicht auf dem Geraet, kein nur lokaler Plan geht verloren',
    lauf: () => {
      if (!window.gsPlans || typeof gsClearUserDataKeys !== 'function') return { ok: false, warum: 'gsPlans oder gsClearUserDataKeys fehlt' };
      const A = 'aaaaaaaa-0000-4000-8000-00000000000a', B = 'bbbbbbbb-0000-4000-8000-00000000000b';
      const plan = (id, uid, cloud) => ({ localId: id, id: cloud ? 'cloud-' + id : id, uid: uid, type: 'garden', title: 'Plan ' + id, summary: 'Inhalt ' + id, payload: { notiz: 'nur fuer ' + id }, created: new Date().toISOString(), starred: false, cloud: !!cloud });
      localStorage.removeItem('gs_plans_wartend');
      const v = []; for (let i = 0; i < 21; i++) v.push(plan('a' + i, A, false));
      v.push(plan('a-cloud', A, true));
      localStorage.setItem('gs_plans_v2', JSON.stringify(v));
      localStorage.setItem('gs_last_active_uid', A);
      window.__TOASTS = [];
      gsClearUserDataKeys();
      const nachA = JSON.parse(localStorage.getItem('gs_plans_v2') || '[]');
      // B meldet sich an: ein Plan in der Cloud, einer nur lokal
      const l = nachA.slice(); l.unshift(plan('b-cloud', B, true)); l.unshift(plan('b-lokal', B, false));
      localStorage.setItem('gs_plans_v2', JSON.stringify(l));
      localStorage.setItem('gs_last_active_uid', B);
      gsClearUserDataKeys();
      const v2 = JSON.parse(localStorage.getItem('gs_plans_v2') || '[]');
      const w = JSON.parse(localStorage.getItem('gs_plans_wartend') || '[]');
      const satz = window.__TOASTS.filter(t => /Plan|Pläne/.test(t));
      localStorage.removeItem('gs_plans_v2'); localStorage.removeItem('gs_plans_wartend');
      const da = (id) => w.concat(v2).some(e => e && e.localId === id);
      const f = [];
      // Seit der Deckel je Konto gilt (19.11.2026, Brett 7ebf), passt beim Abmelden von B nur
      // noch der Rest von A nicht — 'deckel_anderes_konto'. Beide Namen heissen: der Deckel griff.
      if (gsPlans.parkGrund && ['deckel', 'deckel_anderes_konto'].indexOf(gsPlans.parkGrund()) < 0) f.push('Fall nicht hergestellt: der Deckel griff nicht (' + gsPlans.parkGrund() + ')');
      const cloud = v2.filter(e => e && e.cloud).map(e => e.localId);
      if (cloud.length) f.push('nach dem Abmelden liegen Cloud-Plaene in gs_plans_v2: ' + cloud.join(','));
      const lokal = ['b-lokal'].concat(v.filter(e => !e.cloud).map(e => e.localId));
      const weg = lokal.filter(id => !da(id));
      if (weg.length) f.push(weg.length + ' nur lokale Plaene verloren: ' + weg.slice(0, 6).join(','));
      if (!satz.length) f.push('kein Satz, obwohl Plaene liegen bleiben');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'nach dem Abmelden von B: ' + v2.length + ' Plaene in gs_plans_v2, alle nur lokal · 0 Cloud-Plaene · ' + lokal.length + ' von ' + lokal.length + ' nur lokalen aufbewahrt · Satz „' + satz[0].slice(0, 40) + '…"' };
    },
  },
  {
    // Brett 2026-11-16-7ebf (b), 19.11.2026: der Deckel galt fuer alle Konten oder keines. Hatte A
    // mehr als 20 nur lokale Plaene, schrieb parken() GAR NICHTS — auch die 20, die gepasst
    // haetten, blieben in gs_plans_v2, und beim Abmelden eines ANDEREN Kontos parkte auch dessen
    // Plan nicht (der Deckel von A sperrte den Wartebereich fuer alle). Gemessen wird je Konto:
    // A (23 nur lokale, 1 Cloud) parkt 20 und behaelt genau 3 in gs_plans_v2, ohne Doppel und ohne
    // Cloud-Kopie; danach meldet sich B ab (1 lokal, 1 Cloud): sein Plan parkt, kein Satz ueber
    // einen Deckel, der nicht seiner ist; kein nur lokaler Plan von A oder B geht verloren, und B
    // sieht keinen Plan von A.
    name: 'Abmelden · der Deckel des Wartebereichs gilt je Konto — A parkt, was passt, nur der Rest bleibt in gs_plans_v2, und B parkt trotzdem',
    lauf: () => {
      if (!window.gsPlans || typeof gsClearUserDataKeys !== 'function') return { ok: false, warum: 'gsPlans oder gsClearUserDataKeys fehlt' };
      const A = 'aaaaaaaa-0000-4000-8000-00000000000a', B = 'bbbbbbbb-0000-4000-8000-00000000000b';
      const t0 = Date.now();
      const plan = (id, uid, cloud, i) => ({ localId: id, id: cloud ? 'cloud-' + id : id, uid: uid, type: 'garden', title: 'Plan ' + id, summary: 'Inhalt ' + id, payload: { notiz: 'nur fuer ' + id }, created: new Date(t0 - (i || 0) * 60000).toISOString(), starred: false, cloud: !!cloud });
      const lies = () => ({ v2: JSON.parse(localStorage.getItem('gs_plans_v2') || '[]'), w: JSON.parse(localStorage.getItem('gs_plans_wartend') || '[]') });
      localStorage.removeItem('gs_plans_wartend');
      // Konto A: 23 nur lokale (neueste zuerst, wie save() sie ablegt) und einer aus der Cloud
      const vA = [plan('a-cloud', A, true, 0)]; for (let i = 0; i < 23; i++) vA.push(plan('a' + i, A, false, i + 1));
      localStorage.setItem('gs_plans_v2', JSON.stringify(vA));
      localStorage.setItem('gs_last_active_uid', A);
      window.__TOASTS = [];
      gsClearUserDataKeys();
      const nachA = lies(), satzA = window.__TOASTS.filter(t => /Plan|Pläne/.test(t)), grundA = gsPlans.parkGrund ? gsPlans.parkGrund() : '?';
      // Konto B meldet sich an (ein Plan nur lokal, einer in der Cloud) und wieder ab
      const l = nachA.v2.slice(); l.unshift(plan('b-cloud', B, true)); l.unshift(plan('b-lokal', B, false));
      localStorage.setItem('gs_plans_v2', JSON.stringify(l));
      localStorage.setItem('gs_last_active_uid', B);
      window.__TOASTS = [];
      gsClearUserDataKeys();
      const nachB = lies(), satzB = window.__TOASTS.filter(t => /Plan|Pläne/.test(t));
      const sieht = (wer, id) => { const echt = gsStore.get; gsStore.get = (k, f) => k === 'gs_sb_uid' ? wer : echt.call(gsStore, k, f); try { return !!gsPlans.load(id); } finally { gsStore.get = echt; } };
      const bSiehtA = nachB.v2.filter(e => e && e.uid === A && sieht(B, e.localId)).map(e => e.localId);
      localStorage.removeItem('gs_plans_v2'); localStorage.removeItem('gs_plans_wartend');
      const f = [];
      const wA = nachA.w.filter(e => e.uid === A).map(e => e.localId);
      const v2A = nachA.v2.map(e => e.localId);
      if (wA.length !== 20) f.push('A: ' + wA.length + ' statt 20 Plaene geparkt');
      if (nachA.v2.some(e => e.cloud)) f.push('A: Cloud-Plan bleibt in gs_plans_v2');
      if (v2A.length !== 3) f.push('A: gs_plans_v2 traegt ' + v2A.length + ' statt der 3, die nicht passen');
      const doppelt = v2A.filter(id => wA.indexOf(id) >= 0);
      if (doppelt.length) f.push('A: ' + doppelt.length + ' Plaene stehen geparkt UND in gs_plans_v2');
      for (let i = 0; i < 23; i++) if (wA.indexOf('a' + i) < 0 && v2A.indexOf('a' + i) < 0) f.push('A: a' + i + ' verloren');
      if (grundA !== 'deckel') f.push('A: parkGrund ' + JSON.stringify(grundA) + ' statt „deckel"');
      if (!satzA.length) f.push('A: kein Satz, obwohl 3 Plaene nicht passen');
      else if (/Speicher voll/.test(satzA[0]) || !/20/.test(satzA[0])) f.push('A: der Satz nennt den Deckel nicht („' + satzA[0] + '")');
      else if (Object.values(gsI18nMeldungenAusQuelltext(Array.from(document.scripts).map(x => x.textContent).join('\n'))).indexOf(satzA[0]) < 0) f.push('A: der Satz kommt beim Uebersetzer nicht an (' + satzA[0].length + ' Zeichen): „' + satzA[0].slice(0, 50) + '…"');
      const wB = nachB.w.filter(e => e.uid === B).map(e => e.localId);
      if (wB.indexOf('b-lokal') < 0) f.push('B: der nur lokale Plan von B ist nicht geparkt' + (nachB.v2.some(e => e.localId === 'b-lokal') ? ' (liegt weiter in gs_plans_v2 — der Deckel von A sperrt den Wartebereich fuer B)' : ' — und weg'));
      if (nachB.v2.some(e => e.uid === B)) f.push('B: in gs_plans_v2 bleiben Plaene von B: ' + nachB.v2.filter(e => e.uid === B).map(e => e.localId).join(','));
      if (nachB.v2.some(e => e.cloud)) f.push('B: eine Cloud-Kopie bleibt in gs_plans_v2');
      const alleA = nachB.w.filter(e => e.uid === A).map(e => e.localId).concat(nachB.v2.filter(e => e.uid === A).map(e => e.localId));
      for (let i = 0; i < 23; i++) if (alleA.indexOf('a' + i) < 0) f.push('nach B: a' + i + ' von A verloren');
      if (nachB.w.filter(e => e.uid === A).length > 20) f.push('nach B: ' + nachB.w.filter(e => e.uid === A).length + ' Plaene von A im Wartebereich — ueber dem Deckel');
      if (satzB.length) f.push('B bekommt einen Satz ueber Plaene, die nicht seine sind — seine passen alle („' + satzB[0] + '")');
      if (bSiehtA.length) f.push('B sieht Plaene von A: ' + bSiehtA.join(','));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'A: 20 geparkt, 3 in gs_plans_v2, 0 doppelt, 0 Cloud · Satz „' + satzA[0].slice(0, 50) + '…" · B: b-lokal geparkt, gs_plans_v2 nur noch mit den 3 von A, kein Satz an B, B sieht keinen davon · 23 von 23 Plaenen von A aufbewahrt' };
    },
  },
  {
    // Brett 2026-11-16-7ebf (a), 19.11.2026: gsClearUserDataKeys unterschied nur „Deckel" und
    // „sonst" — eine Ausnahme im Parken (parkGrund 'fehler') bekam den Satz „Speicher voll", der
    // Person also einen Rat, der nicht hilft (Platz schaffen). Hergestellt wird die Ausnahme am
    // Schreibversuch selbst (setItem WIRFT fuer gs_plans_wartend — der Wrapper der App tut das
    // nie, ein gesperrter Speicher schon). Gegenrichtung: bei vollem Speicher bleibt der Satz.
    name: 'Abmelden · scheitert das Parken an einem Fehler, nicht am Speicher, sagt der Satz nicht „Speicher voll" — und bei vollem Speicher weiter schon',
    lauf: () => {
      if (!window.gsPlans || typeof gsClearUserDataKeys !== 'function') return { ok: false, warum: 'gsPlans oder gsClearUserDataKeys fehlt' };
      const A = 'aaaaaaaa-0000-4000-8000-00000000000a';
      const plan = (id) => ({ localId: id, id: id, uid: A, type: 'garden', title: 'Plan ' + id, summary: '', payload: {}, created: new Date().toISOString(), starred: false, cloud: false });
      const lage = (art) => {
        localStorage.removeItem('gs_plans_wartend');
        localStorage.setItem('gs_plans_v2', JSON.stringify([plan('f-' + art)]));
        localStorage.setItem('gs_last_active_uid', A);
        window.__TOASTS = [];
        const echt = localStorage.setItem;
        localStorage.setItem = function (k, v) {
          if (k === 'gs_plans_wartend') { if (art === 'fehler') throw new Error('SecurityError: Zugriff verweigert'); return false; }
          return echt.call(localStorage, k, v);
        };
        let grund = null;
        try { gsClearUserDataKeys(); grund = gsPlans.parkGrund ? gsPlans.parkGrund() : '?'; } finally { localStorage.setItem = echt; }
        const v2 = JSON.parse(localStorage.getItem('gs_plans_v2') || '[]');
        const satz = window.__TOASTS.filter(t => /Plan|Pläne/.test(t));
        localStorage.removeItem('gs_plans_v2'); localStorage.removeItem('gs_plans_wartend');
        return { grund, satz, da: v2.some(e => e.localId === 'f-' + art && e.uid === A) };
      };
      const f = [];
      const r1 = lage('fehler');
      if (r1.grund !== 'fehler') return { ok: false, warum: 'Fall nicht hergestellt: parkGrund ' + JSON.stringify(r1.grund) + ' statt „fehler"' };
      if (!r1.da) f.push('Fehler: der Plan ist weg');
      if (!r1.satz.length) f.push('Fehler: kein Satz');
      else if (/Speicher voll/.test(r1.satz[0])) f.push('Fehler: der Satz sagt „Speicher voll" („' + r1.satz[0] + '")');
      const r2 = lage('voll');
      if (r2.grund !== 'speicher_voll') f.push('voll: parkGrund ' + JSON.stringify(r2.grund));
      if (!r2.satz.length || !/Speicher voll/.test(r2.satz[0])) f.push('voll: der Satz nennt den vollen Speicher nicht (' + JSON.stringify(r2.satz) + ')');
      if (!r2.da) f.push('voll: der Plan ist weg');
      // Gegenpruefung dom-plaene (19.11.2026): der Uebersetzer kennt nur Saetze, die der Sammler
      // findet (gsI18nMeldungenAusQuelltext) — und der nimmt kein Literal ab 120 Zeichen. Der Satz
      // „Beim Abmelden ging etwas schief: dein … Plan bleibt hier liegen, …" hatte 123: in fr/it/en/es
      // stand er deutsch da, ohne dass etwas meldet. Gemessen wird am echten Quelltext der Seite.
      const gesammelt = Object.values(gsI18nMeldungenAusQuelltext(Array.from(document.scripts).map(x => x.textContent).join('\n')));
      [r1.satz[0], r2.satz[0]].forEach(t => { if (t && gesammelt.indexOf(t) < 0) f.push('der Satz kommt beim Uebersetzer nicht an (' + t.length + ' Zeichen, Sammler nimmt nur unter 120): „' + t.slice(0, 50) + '…"'); });
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Fehler: Plan bleibt, Satz „' + r1.satz[0].slice(0, 60) + '…" · voll: „' + r2.satz[0].slice(0, 40) + '…"' };
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
    window.gsCanDo = () => true;   // wie gsRequire: die Anmelde-Sperre ist hier nicht die Frage
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
    const merk = (t) => { window.__TOASTS.push(String((t && typeof t === 'object') ? (t.title ? t.title + ' ' : '') + (t.msg || t.body || '') : t)); };
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
