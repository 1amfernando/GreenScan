// Gruppe s1 (Austausch-Runde 11.11.2026) — die Rueckspiel-Wege fuer EIGENE Listen.
// v33.59 siebte den Backup-Import und den Cloud-Pull der drei Blobs. Daneben
// schrieben weitere Wege dieselben Schluessel aus fremder Hand: der Snapshot
// (gsSnapshotRestore → _gsRestoreKey), gsGardenSync.pullAll (800 ms nach dem
// Start) und zwei Zweige des Login-Pulls (garden_diary, garden_harvests).
// Jeder Fall stellt den Server, fuehrt den ECHTEN Weg aus, rendert danach die
// Ansichten und misst: kein Code lief, die Ids sind gesiebt, Speicher und
// Variable sind gleich, und die gutartigen Eintraege kommen unveraendert an.
// Dazu der Klassenwaechter (offen-x1): jeder Schreiber eines Listen-Schluessels
// geht durch das Sieb bzw. _gsListeEinspielen — oder steht mit Grund in
// LOKALE_SCHREIBER.
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./_onclick_suche.js');

const ID_OK = /^[A-Za-z0-9_\-:.]*$/;
const UUID_G = '7f3c1a2e-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
const UUID_P = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const UUID_D = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e';
const UUID_H = '3c4d5e6f-7a8b-4c9d-0e1f-2a3b4c5d6e7f';

// Im Browser: Server stellen, Zustand herstellen. `route` bildet einen Pfad-Teil
// auf eine Antwort ab; alles andere bekommt eine leere Liste.
const STELLEN = `
  window.__s1Alt = window.__s1Alt || { sbFetch: window.sbFetch, sbIsLoggedIn: window.sbIsLoggedIn };
  window.__s1Stellen = function (route) {
    window.sbIsLoggedIn = function () { return true; };
    window.sbFetch = async function (pfad, opts) {
      for (const k of Object.keys(route)) if (String(pfad).indexOf(k) >= 0) return { data: route[k], error: null, status: 200 };
      if ((opts && opts.method || 'GET').toUpperCase() !== 'GET') return { data: [{}], error: null, status: 200 };
      return { data: [], error: null, status: 200 };
    };
  };
  window.__s1Zurueck = function () { window.sbFetch = window.__s1Alt.sbFetch; window.sbIsLoggedIn = window.__s1Alt.sbIsLoggedIn; };
  window.__s1Leeren = function (keys) {
    keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    ['plants', 'garden', 'state'].forEach(function (k) { try { localStorage.removeItem('gs_sync_dirty_at_' + k); } catch (e) {} });
    try { localStorage.removeItem('gs_sync_dirty'); } catch (e) {}
    gardens = []; plantings = []; myPlants = []; deadPlants = [];
    try { _gsTagebuch = null; } catch (e) {}
    try { window._gsErnteLog = null; } catch (e) {}
  };
  window.__s1Lies = function (k) { try { var v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
`;
// Gegenpruefung dom-plaene (19.11.2026): eine frische Seite MIT den Beispieldaten von A. Zwei Wege,
// auf denen sie ohne sie startete (gemessen, nicht vermutet, ist nur der erste):
//   1. Der Seed setzt gs_last_active_uid nicht. Endet der Fall davor mit B, faehrt die frische Seite
//      beim Start einen Kontowechsel (gsSyncUserDataOnLogin, 1,8 s) und raeumt A ab — gemessen:
//      gs_last_active_uid auf B, h.frisch() → gs_sb_display_name null, 0 Pflanzen.
//   2. Auch MIT festgenageltem gs_last_active_uid startete eine von drei Seiten ohne Pflanzen
//      (Ursache nicht gemessen; vermutlich kommen Schreibvorgaenge der geschlossenen Seite in
//      demselben Speicher erst nach dem Seed der neuen an).
// Die Abmelde-Faelle meldeten dann „Fall nicht hergestellt" (Gegenprobe G1: zwei von zwei Laeufen).
// Wer einen Zustand braucht, stellt ihn HER — und sieht nach, ob er steht; hoechstens drei Versuche.
async function frischAlsA(seite, h) {
  let p = seite;
  for (let i = 0; i < 3; i++) {
    try { await p.evaluate(() => localStorage.setItem('gs_last_active_uid', '00000000-0000-4000-8000-000000000001')); } catch (e) {}
    p = await h.frisch();
    const da = await p.evaluate(() => ({ n: (typeof myPlants !== 'undefined' && Array.isArray(myPlants)) ? myPlants.length : 0, name: localStorage.getItem('gs_sb_display_name') }));
    if (da.n > 0 && da.name) return p;
  }
  return p;   // der Fall prueft seinen Ausgangszustand selbst und sagt „Fall nicht hergestellt"
}

const LISTEN = ['ps_myplants', 'gs_gardens', 'gs_plantings', 'gs_dead_plants', 'gs_gartentagebuch', 'gs_garden_plans', 'gs_ernte_log'];

// Prueft eine gespeicherte Liste: jede Id im Alphabet, kein Emoji mit Auszeichnung.
function rohStellen(listen) {
  const roh = [];
  Object.keys(listen).forEach(k => (listen[k] || []).forEach(e => {
    if (!e || typeof e !== 'object') return;
    ['id', 'gardenId', 'garden_id', 'plant_local_id', 'planting_id'].forEach(f => {
      if (f in e && e[f] != null && typeof e[f] !== 'number' && !(typeof e[f] === 'string' && ID_OK.test(e[f]))) roh.push(k + '.' + f + '=' + JSON.stringify(e[f]).slice(0, 40));
    });
    if (e.emoji != null && /[<>"'=]/.test(String(e.emoji))) roh.push(k + '.emoji=' + String(e.emoji).slice(0, 30));
  }));
  return roh;
}

// Rendert Gartenuebersicht, „Meine Pflanzen" und das Gartentagebuch wirklich und
// sammelt den sichtbaren Text.
const RENDERN = `
  window.__s1Rendern = async function (mitErnte) {
    var txt = '';
    try { renderGarden(); } catch (e) { txt += '[renderGarden warf: ' + e.message + ']'; }
    var gv = document.getElementById('screen-garden') || document.body; txt += ' ' + (gv.textContent || '');
    try { switchTab('myplants'); } catch (e) {}
    try { renderMyPlants(); } catch (e) { txt += '[renderMyPlants warf: ' + e.message + ']'; }
    txt += ' ' + (document.body.textContent || '');
    try { openGartenTagebuch(); } catch (e) { txt += '[Tagebuch warf: ' + e.message + ']'; }
    var mc = document.getElementById('modal-content'); txt += ' ' + (mc ? mc.textContent : '');
    if (mitErnte) {
      try { closeModal(); } catch (e) {}
      try { openErnteTracking(); } catch (e) { txt += '[Ernte warf: ' + e.message + ']'; }
      mc = document.getElementById('modal-content'); txt += ' ' + (mc ? mc.textContent : '');
    }
    await new Promise(function (r) { setTimeout(r, 400); });
    var fremd = document.querySelectorAll('img[src="x"]').length;
    try { closeModal(); } catch (e) {}
    return { txt: txt, fremd: fremd };
  };
`;

async function vorbereiten(seite) {
  await seite.evaluate(STELLEN + RENDERN);
}

module.exports = [
  {
    name: 'Snapshot (fn_user_snapshot_latest) · feindliche Ids und Emoji gesiebt, Gaerten in Speicher UND Variable — kein „Mein Garten" darueber, gutartige Eintraege unveraendert',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async ([boese, oc, ug, up, ud, uh, LISTEN]) => {
        __s1Leeren(LISTEN);
        const t = new Date().toISOString();
        const gutG = { id: ug, name: "Bär's Garten", emoji: '🌻' };
        const gutP = { id: 'p1', name: "Bär's Tomate", emoji: '🍅' };
        const gutD = { id: ud, ts: t, cat: 'note', text: 'Gute Notiz aus dem Backup', emoji: '🌻' };
        const st = {
          gardens: [{ id: oc, name: 'Fremd-Garten', emoji: boese }, { id: { a: 1 }, name: 'Objekt-Id' }, gutG],
          plantings: [{ id: oc, gardenId: oc, name: 'Fremd-Pflanzung', count: boese }, { id: up, gardenId: ug, name: 'Gute Pflanzung', count: 2 }],
          plants: [{ id: '"><img src=x onerror="window.__pwned=1">', name: 'Fremd-Pflanze', emoji: boese }, gutP],
          dead_plants: [{ id: oc, name: 'Tot', emoji: boese }],
          diary: [{ id: oc, ts: t, cat: 'note', text: 'Fremde Notiz', emoji: boese }, gutD],
          garden_plans: [{ id: oc, title: 'P', plan: { bed: { width_m: boese, length_m: 2 } } }],
          ernte: [{ id: oc, ts: t, pflanze: 'Fremd-Ernte', emoji: boese, menge: boese }, { id: uh, ts: t, pflanze: 'Gute Ernte', emoji: '🧺', menge: 2 }],
        };
        __s1Stellen({ 'fn_user_snapshot_latest': st });
        let ok;
        try { ok = await gsSnapshotRestore(); } catch (e) { __s1Zurueck(); return { fehler: String(e.message) }; }
        const rend = await __s1Rendern(true);
        __s1Zurueck();
        const L = {}; LISTEN.forEach(k => { L[k] = __s1Lies(k); });
        return {
          ok, L, rend,
          gleich: JSON.stringify(gardens) === JSON.stringify(L.gs_gardens) && JSON.stringify(plantings) === JSON.stringify(L.gs_plantings)
            && JSON.stringify(myPlants) === JSON.stringify(L.ps_myplants) && JSON.stringify(deadPlants) === JSON.stringify(L.gs_dead_plants),
          var: { g: gardens.map(x => x.name), pl: plantings.length, mp: myPlants.map(x => x.name) },
          gutG: L.gs_gardens.find(x => x.id === ug), gutP: L.ps_myplants.find(x => x.id === 'p1'), gutD: L.gs_gartentagebuch.find(x => x.id === ud),
          gutPl: L.gs_plantings.find(x => x.id === up), gutH: L.gs_ernte_log.find(x => x.id === uh),
          soll: { gutG, gutP, gutD },
        };
      }, [h.BOESE, h.OC, UUID_G, UUID_P, UUID_D, UUID_H, LISTEN]);
      await h.warte(350);
      const p = await h.pwned();
      if (r.fehler) return { ok: false, warum: 'Ausnahme: ' + r.fehler };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.rend.fremd) return { ok: false, warum: r.rend.fremd + ' fremde Elemente im Dokument' };
      const roh = rohStellen(r.L);
      if (roh.length) return { ok: false, warum: 'ungesiebt gespeichert: ' + roh.slice(0, 6).join(' · ') + (roh.length > 6 ? ' (+' + (roh.length - 6) + ')' : '') };
      if (r.L.gs_gardens.some(g => /Mein Garten/.test(g.name))) return { ok: false, warum: '„Mein Garten" ueber den wiederhergestellten Gaerten: ' + JSON.stringify(r.L.gs_gardens.map(g => g.name)) };
      if (!r.gleich) return { ok: false, warum: 'Speicher und Variable verschieden: Variable ' + JSON.stringify(r.var) + ' · Speicher ' + JSON.stringify(r.L.gs_gardens.map(g => g.name)) };
      if (JSON.stringify(r.gutG) !== JSON.stringify(r.soll.gutG) || JSON.stringify(r.gutP) !== JSON.stringify(r.soll.gutP) || JSON.stringify(r.gutD) !== JSON.stringify(r.soll.gutD) || !r.gutPl || r.gutPl.count !== 2 || !r.gutH || r.gutH.emoji !== '🧺')
        return { ok: false, warum: 'gutartige Eintraege veraendert: ' + JSON.stringify({ g: r.gutG, p: r.gutP, d: r.gutD, pl: r.gutPl, h: r.gutH }) };
      if (r.L.gs_gardens.length !== 3) return { ok: false, warum: 'Gaerten: ' + JSON.stringify(r.L.gs_gardens) };
      for (const w of ["Bär's Garten", "Bär's Tomate", 'Gute Notiz aus dem Backup']) if (r.rend.txt.indexOf(w) < 0) return { ok: false, warum: '„' + w + '" steht nicht auf dem Bildschirm' };
      return { ok: true, info: '7 Listen gesiebt (Ids, Emoji, Zahlen) · Gaerten/Pflanzungen/Pflanzen/Friedhof in Speicher UND Variable · kein „Mein Garten" · Garten, Pflanzen, Tagebuch, Ernte gerendert: 0 Code, gute Namen stehen da' };
    },
  },
  {
    name: 'Snapshot mit lokalem Bestand · der Id-Mix (lokal gewinnt) geht ebenfalls durch das Sieb',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async ([oc, LISTEN]) => {
        __s1Leeren(LISTEN);
        localStorage.setItem('gs_gardens', JSON.stringify([{ id: 'g-lokal', name: 'Lokal' }]));
        gardens = [{ id: 'g-lokal', name: 'Lokal' }];
        __s1Stellen({ 'fn_user_snapshot_latest': { gardens: [{ id: oc, name: 'Fremd' }, { id: 'g-lokal', name: 'Aus dem Snapshot' }] } });
        try { await gsSnapshotRestore(); } finally { __s1Zurueck(); }
        try { renderGarden(); } catch (e) {}
        return { L: __s1Lies('gs_gardens'), v: gardens.map(g => g.id + ':' + g.name) };
      }, [h.OC, LISTEN]);
      await h.warte(300);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      const roh = rohStellen({ gs_gardens: r.L });
      if (roh.length) return { ok: false, warum: 'ungesiebt: ' + roh.join(' · ') };
      const lok = r.L.find(g => g.id === 'g-lokal');
      if (!lok || lok.name !== 'Lokal' || r.L.length !== 2) return { ok: false, warum: 'Mischen veraendert: ' + JSON.stringify(r.L) };
      if (r.v.join('|') !== r.L.map(g => g.id + ':' + g.name).join('|')) return { ok: false, warum: 'Variable ' + JSON.stringify(r.v) + ' ≠ Speicher' };
      return { ok: true, info: 'lokal gewinnt weiter, der fremde Eintrag ist gesiebt, Variable = Speicher' };
    },
  },
  {
    name: 'gsGardenSync.pullAll · Tagebuch, Ernte, Gaerten, Pflanzungen aus den Cloud-Tabellen gesiebt, gemischt nach Id (lokal gewinnt), Variable = Speicher',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async ([boese, oc, ug, up, ud, uh, LISTEN]) => {
        __s1Leeren(LISTEN);
        const t = new Date().toISOString();
        localStorage.setItem('gs_gardens', JSON.stringify([{ id: 'g-lokal', name: 'Lokal' }]));
        localStorage.setItem('gs_gartentagebuch', JSON.stringify([{ id: 'd-lokal', ts: t, cat: 'note', text: 'Lokale Notiz' }]));
        gardens = [{ id: 'g-lokal', name: 'Lokal' }];
        __s1Stellen({
          '/garden_diary': [{ id: oc, ts: t, text: 'Fremde Notiz', emoji: boese }, { id: ud, ts: t, text: 'Gute Cloud-Notiz', emoji: '🌻' }],
          '/garden_harvests': [{ id: oc, ts: t, species_name: 'Fremd', emoji: boese, menge: 1 }, { id: uh, ts: t, species_name: 'Gute Ernte', emoji: '🧺', menge: 2 }],
          '/rest/v1/gardens?': [{ id: oc, name: 'Fremd-Garten' }, { id: ug, name: "Bär's Garten" }, { id: 'g-lokal', name: 'Remote' }],
          '/garden_plantings': [{ id: oc, garden_id: oc, species_name: 'Fremd' }, { id: up, garden_id: ug, species_name: 'Gut' }],
        });
        try { await gsGardenSync.pullAll(); } catch (e) { __s1Zurueck(); return { fehler: String(e.message) }; }
        const rend = await __s1Rendern(true);
        __s1Zurueck();
        const L = {}; LISTEN.forEach(k => { L[k] = __s1Lies(k); });
        return { L, rend, vg: JSON.stringify(gardens) === JSON.stringify(L.gs_gardens), vp: JSON.stringify(plantings) === JSON.stringify(L.gs_plantings) };
      }, [h.BOESE, h.OC, UUID_G, UUID_P, UUID_D, UUID_H, LISTEN]);
      await h.warte(350);
      const p = await h.pwned();
      if (r.fehler) return { ok: false, warum: 'Ausnahme: ' + r.fehler };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.rend.fremd) return { ok: false, warum: r.rend.fremd + ' fremde Elemente' };
      if (r.L.gs_gardens.length !== 3) return { ok: false, warum: 'pullAll hat die Gaerten nicht gemischt — der Fall misst nichts: ' + JSON.stringify(r.L.gs_gardens) };
      const roh = rohStellen(r.L);
      if (roh.length) return { ok: false, warum: 'ungesiebt gespeichert: ' + roh.slice(0, 6).join(' · ') };
      if (!r.vg || !r.vp) return { ok: false, warum: 'Variable ≠ Speicher (Gaerten ' + r.vg + ', Pflanzungen ' + r.vp + ')' };
      const lok = r.L.gs_gardens.find(g => g.id === 'g-lokal');
      if (!lok || lok.name !== 'Lokal') return { ok: false, warum: 'lokal gewinnt nicht mehr: ' + JSON.stringify(lok) };
      const gd = r.L.gs_gartentagebuch.find(x => x.id === UUID_D);
      if (!gd || gd.emoji !== '🌻' || !r.L.gs_gartentagebuch.find(x => x.id === 'd-lokal')) return { ok: false, warum: 'Tagebuch: ' + JSON.stringify(r.L.gs_gartentagebuch) };
      const gh = r.L.gs_ernte_log.find(x => x.id === UUID_H);
      if (!gh || gh.emoji !== '🧺') return { ok: false, warum: 'Ernte: ' + JSON.stringify(r.L.gs_ernte_log) };
      for (const w of ["Bär's Garten", 'Gute Cloud-Notiz', 'Lokale Notiz']) if (r.rend.txt.indexOf(w) < 0) return { ok: false, warum: '„' + w + '" steht nicht auf dem Bildschirm' };
      return { ok: true, info: '4 Tabellen gesiebt · lokal gewinnt · Variable = Speicher · gute Uuids/Emoji unveraendert · gerendert: 0 Code' };
    },
  },
  {
    name: 'Login-Pull · die Zweige garden_diary und garden_harvests gehen durch das Sieb (Id, Emoji), gute Zeilen unveraendert',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async ([boese, oc, ud, uh, LISTEN]) => {
        __s1Leeren(LISTEN);
        localStorage.setItem('gs_last_active_uid', localStorage.getItem('gs_sb_uid') || '');
        const t = new Date().toISOString();
        __s1Stellen({
          '/garden_diary': [{ id: oc, ts: t, text: 'Fremde Notiz', emoji: boese }, { id: ud, ts: t, text: 'Gute Login-Notiz', emoji: '🌻' }],
          '/garden_harvests': [{ id: oc, ts: t, species_name: 'Fremd', emoji: boese, menge: 1, plant_local_id: oc }, { id: uh, ts: t, species_name: 'Gute Login-Ernte', emoji: '🧺', menge: 2 }],
        });
        try { await gsSyncUserDataOnLogin(); } catch (e) { __s1Zurueck(); return { fehler: String(e.message) }; }
        const rend = await __s1Rendern(true);
        __s1Zurueck();
        return { L: { gs_gartentagebuch: __s1Lies('gs_gartentagebuch'), gs_ernte_log: __s1Lies('gs_ernte_log') }, rend };
      }, [h.BOESE, h.OC, UUID_D, UUID_H, LISTEN]);
      await h.warte(350);
      const p = await h.pwned();
      if (r.fehler) return { ok: false, warum: 'Ausnahme: ' + r.fehler };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.rend.fremd) return { ok: false, warum: r.rend.fremd + ' fremde Elemente' };
      if (r.L.gs_gartentagebuch.length < 2 || r.L.gs_ernte_log.length < 2) return { ok: false, warum: 'Pull hat nichts uebernommen — der Fall misst nichts: ' + JSON.stringify(r.L).slice(0, 200) };
      const roh = rohStellen(r.L);
      if (roh.length) return { ok: false, warum: 'ungesiebt gespeichert: ' + roh.join(' · ') };
      const gd = r.L.gs_gartentagebuch.find(x => x.id === UUID_D), gh = r.L.gs_ernte_log.find(x => x.id === UUID_H);
      if (!gd || gd.emoji !== '🌻' || gd.text !== 'Gute Login-Notiz') return { ok: false, warum: 'gute Notiz veraendert: ' + JSON.stringify(gd) };
      if (!gh || gh.emoji !== '🧺' || gh.menge !== 2) return { ok: false, warum: 'gute Ernte veraendert: ' + JSON.stringify(gh) };
      if (r.rend.txt.indexOf('Gute Login-Notiz') < 0) return { ok: false, warum: 'die gute Notiz steht nicht auf dem Bildschirm' };
      return { ok: true, info: 'Tagebuch- und Ernte-Zweig gesiebt · gute Zeilen unveraendert · gerendert: 0 Code' };
    },
  },
  {
    name: 'Voller Speicher · _gsListeEinspielen sagt es (false aus setItem) und setzt die Variable nicht auf einen Stand, den der Speicher nicht hat',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(() => {
        if (typeof _gsListeEinspielen !== 'function') return { fehlt: true };
        const vorher = JSON.stringify(gardens);
        const echt = localStorage.setItem;
        localStorage.setItem = function () { return false; };
        let e;
        try { e = _gsListeEinspielen('gs_gardens', [{ id: 'g-neu', name: 'Neu' }]); } finally { localStorage.setItem = echt; }
        const ok2 = _gsListeEinspielen('gs_gardens', JSON.parse(vorher));
        return { e, gleich: JSON.stringify(gardens) === vorher, ok2: ok2 && ok2.ok, unbekannt: _gsListeEinspielen('gs_irgendwas', []) };
      });
      if (r.fehlt) return { ok: false, warum: '_gsListeEinspielen fehlt' };
      if (!r.e || r.e.ok !== false) return { ok: false, warum: 'meldet Erfolg bei vollem Speicher: ' + JSON.stringify(r.e) };
      if (!r.gleich) return { ok: false, warum: 'Variable auf einen ungespeicherten Stand gesetzt' };
      if (!r.ok2) return { ok: false, warum: 'Gegenrichtung: mit Platz kein Erfolg' };
      if (!r.unbekannt || r.unbekannt.ok !== false) return { ok: false, warum: 'ein unbekannter Schluessel wird geschrieben: ' + JSON.stringify(r.unbekannt) };
      return { ok: true, info: 'voll → ok:false, Variable unberuehrt · mit Platz → ok · unbekannter Schluessel → abgelehnt' };
    },
  },
  {
    name: 'Klassenwaechter · jeder Schreiber eines Listen-Schluessels geht durch das Sieb oder steht mit Grund in LOKALE_SCHREIBER (mit Gegenprobe)',
    lauf: async () => {
      const W = require('./_listen_schreiber.js');
      const roh = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
      const t = S.ohneChangelog(S.nurSkript(roh));
      const e = W.pruefe(t);
      if (e.rot.length) return { ok: false, warum: e.rot.length + ' Schreiber ohne Sieb: ' + e.rot.slice(0, 8).join(' · ') };
      if (e.veraltet.length) return { ok: false, warum: 'LOKALE_SCHREIBER nennt, was es nicht mehr gibt: ' + e.veraltet.join(', ') };
      if (e.gesiebt < 5) return { ok: false, warum: 'nur ' + e.gesiebt + ' gesiebte Schreiber gefunden — die Suche misst nichts' };
      // Gegenprobe: ein ungesiebter Schreiber und die ungesiebte Variablen-Zuweisung
      // aus dem Zweig ccr-dce5a17c-2xzhvi MUESSEN gefunden werden.
      const probe = t + '\nfunction __s1Probe(d) {\n  localStorage.setItem(\'gs_gardens\', JSON.stringify(d.gardens));\n  gardens = d.gardens;\n  gsStore.set(\'ps_myplants\', JSON.stringify(d.plants));\n  myPlants = [].concat(d.plants);\n  deadPlants = deadPlants.filter(Boolean).concat(d.dead);\n}\n';
      const g = W.pruefe(probe);
      const neu = g.rot.filter(x => /__s1Probe/.test(x));
      if (neu.length !== 5) return { ok: false, warum: 'Gegenprobe: ' + neu.length + ' von 5 kuenstlichen Schreibern gefunden: ' + JSON.stringify(g.rot) };
      return { ok: true, info: e.gesamt + ' Schreiber: ' + e.gesiebt + ' durch das Sieb, ' + e.lokal + ' lokal mit Grund · Variablen: ' + e.variablen + ' geprueft · Gegenprobe 5 von 5 (auch [].concat und .filter().concat)' };
    },
  },
  {
    // Gesamtpruefung g1 (#1/#13): „Meine Garten-Plaene" holt beim Oeffnen denselben Blob wie der
    // Login-Pull (user_gardens.data.plans) und dazu garden_plans — und schrieb das Gemisch roh nach
    // gs_garden_plans. Der Klassenwaechter fuehrte die Stelle als „lokal". Gemessen am Speicher UND
    // an den Knoepfen: jede Id gesiebt, keine Dublette (lokal 'plan1' = Cloud 'plan 1'), jeder Knopf
    // zeigt auf eine Id, die im Speicher steht; gutartige Plaene unveraendert.
    name: 'Meine Garten-Plaene (gsPPopenSavedPlans) · der Cloud-Merge geht durch den einen Eingang — Ids gesiebt, keine Dublette, jeder Knopf zeigt auf einen gespeicherten Plan',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async ([boese, oc, ug, LISTEN]) => {
        __s1Leeren(LISTEN);
        const t = new Date().toISOString();
        // Was der Login-Pull aus 'plan 1' gemacht hat (Sieb): 'plan1'
        localStorage.setItem('gs_garden_plans', JSON.stringify([{ id: 'plan1', title: 'Lokal gesiebt', created: t, plan: { summary: 'lokal', plants: [], bed: { width_m: 1, length_m: 1 } } }]));
        const gutBlob = { id: 'gp-gut-1', title: 'Guter Blob-Plan', created: t, plan: { summary: 'gut', plants: [{ id: 'pf1', name: 'Tomate', emoji: '🍅', count: 3 }], bed: { width_m: 3, length_m: 2 } } };
        __s1Stellen({
          '/user_gardens': [{ data: { plans: [
            { id: 'plan 1', title: 'Plan aus dem Blob', created: t, plan: { summary: 'aus dem Blob', plants: [{ id: oc, name: 'Fremd', emoji: boese, count: boese }], bed: { width_m: boese, length_m: 2 } } },
            { id: oc, title: 'Fremd-Id im Blob', created: t, plan: { summary: 'x', plants: [], bed: { width_m: 1, length_m: 1 } } },
            JSON.parse(JSON.stringify(gutBlob)),
          ] } }],
          '/garden_plans?': [
            { id: oc, title: 'Fremd-Id in garden_plans', created_at: t, ai_analysis: {} },
            { id: ug, title: 'Guter Pro-Plan', created_at: t, ai_analysis: { site_analysis: { summary: 'pro' }, layout_grid: { width_m: 4, depth_m: 2 } } },
          ],
        });
        try { await gsPPopenSavedPlans(); } catch (e) { __s1Zurueck(); return { fehler: String(e.message) }; }
        __s1Zurueck();
        await new Promise(res => setTimeout(res, 400));
        const L = __s1Lies('gs_garden_plans');
        const m = document.getElementById('modal-saved-plans');
        const txt = m ? m.textContent : '';
        // Das Argument, wie der JS-Parser es sieht: der Knopf-Code laeuft mit einer
        // Attrappe fuer gsPPloadSavedPlan, die nur mitschreibt (das Attribut ist schon HTML-dekodiert).
        const knoepfe = m ? Array.from(m.querySelectorAll('button[onclick^="gsPPloadSavedPlan("]')).map(b => {
          let id; try { new Function('gsPPloadSavedPlan', b.getAttribute('onclick'))(function (x) { id = x; }); } catch (e) { id = '[parst nicht: ' + e.message + ']'; }
          return id;
        }) : [];
        if (m) m.remove();
        return { L, txt, knoepfe, gutBlob, ug };
      }, [h.BOESE, h.OC, UUID_G, LISTEN]);
      await h.warte(350);
      const p = await h.pwned();
      if (r.fehler) return { ok: false, warum: 'Ausnahme: ' + r.fehler };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (!r.knoepfe.length) return { ok: false, warum: 'kein Plan im Fenster — der Fall misst nichts: ' + r.txt.slice(0, 120) };
      const roh = rohStellen({ gs_garden_plans: r.L });
      r.L.forEach(pl => {
        const b = pl.plan && pl.plan.bed; if (b && b.width_m != null && typeof b.width_m !== 'number' && !/^\s*-?\d+(\.\d+)?\s*$/.test(String(b.width_m))) roh.push('plan.bed.width_m=' + String(b.width_m).slice(0, 30));
        ((pl.plan && pl.plan.plants) || []).forEach(x => {
          if (x && x.id != null && !ID_OK.test(String(x.id))) roh.push('plan.plants.id=' + String(x.id).slice(0, 30));
          if (x && x.emoji != null && /[<>"'=]/.test(String(x.emoji))) roh.push('plan.plants.emoji=' + String(x.emoji).slice(0, 30));
          if (x && x.count != null && typeof x.count !== 'number') roh.push('plan.plants.count=' + String(x.count).slice(0, 30));
        });
      });
      if (roh.length) return { ok: false, warum: 'ungesiebt gespeichert: ' + roh.slice(0, 6).join(' · ') + (roh.length > 6 ? ' (+' + (roh.length - 6) + ')' : '') };
      const ids = r.L.map(x => x.id);
      const doppelt = ids.filter((x, i) => ids.indexOf(x) !== i);
      if (doppelt.length) return { ok: false, warum: 'Dublette im Speicher: ' + doppelt.join(', ') + ' (' + JSON.stringify(ids) + ')' };
      if ((r.txt.match(/Plan aus dem Blob/g) || []).length !== 1 || r.txt.indexOf('Lokal gesiebt') >= 0)
        return { ok: false, warum: 'derselbe Plan steht lokal und aus der Cloud nebeneinander (Cloud gewinnt nicht): ' + JSON.stringify(r.L.map(x => x.id + ':' + x.title)) };
      const fremd = r.knoepfe.filter(k => ids.indexOf(k) < 0);
      if (fremd.length) return { ok: false, warum: 'Knoepfe zeigen auf Ids, die nicht im Speicher stehen: ' + JSON.stringify(fremd) + ' · Speicher ' + JSON.stringify(ids) };
      const gb = r.L.find(x => x.id === 'gp-gut-1');
      if (!gb || JSON.stringify(gb) !== JSON.stringify(r.gutBlob)) return { ok: false, warum: 'gutartiger Blob-Plan veraendert: ' + JSON.stringify(gb) };
      const gp = r.L.find(x => x.id === 'gp_' + r.ug);
      if (!gp || gp.title !== 'Guter Pro-Plan' || !gp.plan || gp.plan.bed.width_m !== 4) return { ok: false, warum: 'gutartiger Pro-Plan veraendert: ' + JSON.stringify(gp).slice(0, 160) };
      for (const w of ['Guter Blob-Plan', 'Guter Pro-Plan', 'Plan aus dem Blob']) if (r.txt.indexOf(w) < 0) return { ok: false, warum: '„' + w + '" steht nicht im Fenster' };
      return { ok: true, info: r.L.length + ' Plaene im Speicher, alle gesiebt (Id, Bett, Pflanzen) · Cloud gewinnt ohne Dublette · ' + r.knoepfe.length + ' Knoepfe, jeder auf eine gespeicherte Id · gute Plaene unveraendert' };
    },
  },
  {
    // Gesamtpruefung g1 (#0/#12): gsClearUserDataKeys leerte den Speicher, setzte im
    // Arbeitsspeicher aber nur myPlants zurueck. Meldet sich danach im selben Tab ein Konto OHNE
    // Cloud-Zeilen an, zeigte renderGarden die Gaerten von A, und die erste Gartenaktion schrieb
    // sie in den Speicher und die Cloud von B. Der Fall geht den echten Weg (sbLogout → Login-Pull
    // als B mit leerer Cloud → renderGarden → saveGardenData → Push) und misst Variable, Speicher,
    // Bildschirm UND den gesendeten Rumpf. Die Liste der Variablen kommt aus GS_LISTEN_EINGANG.
    name: 'Abmelden · jede Variable und jeder Cache aus GS_LISTEN_EINGANG wird geleert — ein Konto ohne Cloud-Daten sieht, speichert und sendet nichts vom vorigen',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async (LISTEN) => {
        // Vier Namen, von denen keiner im anderen steckt (sonst meldet die Suche den falschen).
        const A = { g: 'Garten von Konto A · Musterweg 3', pl: 'Beet-Pflanzung des Kontos A', mp: 'Zimmerpflanze des Kontos A', tot: 'Verstorbene Rose des Kontos A' };
        const B_UID = '22222222-2222-4222-8222-222222222222';
        const t = new Date().toISOString();
        __s1Leeren(LISTEN);
        // Konto A: Speicher UND Variable (wie nach einem Login-Pull)
        gardens = [{ id: 'gA1', name: A.g, created: t }];
        plantings = [{ id: 'plA1', gardenId: 'gA1', name: A.pl, created: t }];
        myPlants = [{ id: 'mpA1', name: A.mp }];
        deadPlants = [{ id: 'mpA2', name: A.tot, diedAt: t }];
        localStorage.setItem('gs_gardens', JSON.stringify(gardens));
        localStorage.setItem('gs_plantings', JSON.stringify(plantings));
        localStorage.setItem('ps_myplants', JSON.stringify(myPlants));
        localStorage.setItem('gs_dead_plants', JSON.stringify(deadPlants));
        try { _gsTagebuch = [{ id: 'dA1', ts: t, text: 'Notiz von A' }]; } catch (e) {}
        try { window._gsErnteLog = [{ id: 'hA1', ts: t, pflanze: 'Ernte von A' }]; } catch (e) {}
        try { editingGardenId = 'gA1'; } catch (e) {}
        // Geschwister derselben Bauform (Spiegel eines GS_USER_KEYS-Schluessels auf oberster Ebene)
        favs = ['A-FAV-1']; localStorage.setItem('ps_favs', JSON.stringify(favs));
        myVotes = { 'fb-A': 'up' }; marketChats = { 'chat-A': [{ text: 'Chat von A' }] };
        myBids = [{ id: 'bid-A' }]; myPurchases = [{ id: 'kauf-A' }]; weatherCache = { '47.11,8.22': { ts: 1, data: {} } };
        const spiegel = () => ({ favs: JSON.stringify(favs), myVotes: JSON.stringify(myVotes), marketChats: JSON.stringify(marketChats), myBids: JSON.stringify(myBids), myPurchases: JSON.stringify(myPurchases), weatherCache: JSON.stringify(weatherCache) });
        const reg = Object.keys(GS_LISTEN_EINGANG).map(k => GS_LISTEN_EINGANG[k]);
        // Ein Server, der nichts hat (neues Konto B) und jeden Schreibvorgang mitschreibt.
        const gesendet = [];
        const altFetch = window.sbFetch;
        window.sbFetch = async function (pfad, opts) {
          const m = ((opts && opts.method) || 'GET').toUpperCase();
          if (m !== 'GET') { gesendet.push(m + ' ' + String(pfad).split('?')[0] + ' ' + String((opts && opts.body) || '')); return { data: [{}], error: null, status: 200 }; }
          return { data: [], error: null, status: 200 };
        };
        let nachAbmelden, wurf = null;
        try {
          await sbLogout();
          nachAbmelden = { var: {}, cache: {}, edit: (typeof editingGardenId === 'undefined') ? null : editingGardenId, spiegel: spiegel() };
          reg.forEach(x => {
            if (x.variable) nachAbmelden.var[x.variable] = JSON.stringify(window[x.variable]);
            if (x.cache) nachAbmelden.cache[x.cache] = window[x.cache] == null ? null : JSON.stringify(window[x.cache]).slice(0, 60);
          });
          gesendet.length = 0;
          // Konto B meldet sich im selben Seitenleben an — keine Zeile in user_gardens/user_plants.
          localStorage.setItem('gs_sb_token', 'pruef.konto.b');
          localStorage.setItem('gs_sb_uid', B_UID);
          localStorage.setItem('gs_sb_expires', String(Date.now() + 864e5));
          await gsSyncUserDataOnLogin();
          // Die erste Gartenaktion von B speichert, was die Variablen tragen — ebenso ein Favorit.
          saveGardenData();
          try { toggleFav('W036'); } catch (e) {}   // die Anzeige danach darf fehlen, der Speicher zaehlt
          await new Promise(res => setTimeout(res, 1200));
        } catch (e) { wurf = String(e && e.message); }
        finally { window.sbFetch = altFetch; }
        const gtxt = (document.getElementById('garden-list') || {}).textContent || '';
        let ftxt = '';
        try { gsOpenCemetery(); const c = document.getElementById('cemetery-list'); ftxt = c ? c.textContent : ''; closeModal(); } catch (e) { ftxt = '[Friedhof warf: ' + e.message + ']'; }
        const speicher = ['gs_gardens', 'gs_plantings', 'ps_myplants', 'gs_dead_plants', 'ps_favs'].map(k => k + '=' + (localStorage.getItem(k) || '')).join(' | ');
        return {
          wurf, A, nachAbmelden, gtxt, ftxt, speicher, gesendet,
          varB: { g: gardens.map(x => x.name), pl: plantings.map(x => x.name), mp: myPlants.map(x => x.name), tot: deadPlants.map(x => x.name) },
        };
      }, LISTEN);
      await h.frisch();   // angemeldet als Pruefstand-Konto weiter
      if (r.wurf) return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf };
      // Alle Befunde sammeln — die Wirkung soll im Bericht stehen, nicht nur die erste Stufe.
      const f = [];
      // 19.11.2026 (Brett a6d6): das Abmelden zeichnet die Startseite aus dem geleerten Stand neu
      // (_gsAbmeldenStartseite) — der Tagesplan liest dabei Tagebuch und Ernte und baut die zwei
      // Caches wieder auf, aus einem LEEREN Speicher. Leer heisst darum: null oder eine leere Liste.
      const nichtLeer = Object.keys(r.nachAbmelden.var).filter(k => r.nachAbmelden.var[k] !== '[]')
        .concat(Object.keys(r.nachAbmelden.cache).filter(k => r.nachAbmelden.cache[k] !== null && !/^(\[\]|\{\})$/.test(r.nachAbmelden.cache[k])));
      if (nichtLeer.length) f.push('nach dem Abmelden nicht leer: ' + nichtLeer.join(', '));
      if (r.nachAbmelden.edit) f.push('editingGardenId zeigt noch auf ' + r.nachAbmelden.edit);
      const sp = Object.keys(r.nachAbmelden.spiegel).filter(k => !/^(\[\]|\{\})$/.test(r.nachAbmelden.spiegel[k]));
      if (sp.length) f.push('Spiegel nach dem Abmelden nicht leer: ' + sp.join(', '));
      const alle = [r.A.g, r.A.pl, r.A.mp, r.A.tot, 'A-FAV-1'];
      const imVar = alle.filter(w => JSON.stringify(r.varB).indexOf(w) >= 0);
      if (imVar.length) f.push('Konto B haelt im Arbeitsspeicher: ' + imVar.join(', '));
      if (r.gtxt.indexOf(r.A.g) >= 0) f.push('renderGarden zeigt B den Garten von A');
      if (r.ftxt.indexOf(r.A.tot) >= 0) f.push('der Friedhof zeigt B die tote Pflanze von A');
      const imSpeicher = alle.filter(w => r.speicher.indexOf(w) >= 0);
      if (imSpeicher.length) f.push('im Speicher von B: ' + imSpeicher.join(', '));
      const imRumpf = r.gesendet.filter(s => alle.some(w => s.indexOf(w) >= 0));
      if (imRumpf.length) f.push(imRumpf.length + '× an die Cloud von B gesendet (' + imRumpf[0].slice(0, 70) + '…)');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      // Gegenrichtung: B ist ein neues Konto — „Mein Garten" entsteht, steht da und geht hoch.
      if (r.varB.g.indexOf('Mein Garten') < 0 || r.gtxt.indexOf('Mein Garten') < 0) return { ok: false, warum: 'gutartig: das neue Konto bekommt keinen „Mein Garten" (' + JSON.stringify(r.varB.g) + ')' };
      const hoch = r.gesendet.filter(s => /user_gardens/.test(s) && /Mein Garten/.test(s)).length;
      return { ok: true, info: Object.keys(r.nachAbmelden.var).length + ' Variablen und ' + Object.keys(r.nachAbmelden.cache).length + ' Caches aus GS_LISTEN_EINGANG leer, dazu ' + Object.keys(r.nachAbmelden.spiegel).length + ' Spiegel (Favoriten, Stimmen, Markt, Planer-Wetter) · Konto B: Variable, Speicher, Garten, Friedhof, Favorit ohne A · ' + r.gesendet.length + ' Schreibvorgaenge ohne A' + (hoch ? ' (davon ' + hoch + '× „Mein Garten" nach user_gardens)' : '') };
    },
  },
  {
    // Gegenrichtung zum Fall davor: leere Variablen nach dem Abmelden duerfen nicht dazu fuehren,
    // dass zwischen Abmelden und Anmelden „Mein Garten" entsteht und als ungepushte Aenderung
    // markiert wird — dann behielte der Login-Pull eines BESTEHENDEN Kontos (_shouldOverwriteLocal)
    // den leeren Garten und schoebe ihn ueber dessen echte Gaerten. Gemessen: nach dem Abmelden
    // kein gs_gardens und keine Markierung; danach meldet sich B mit Cloud-Daten an und bekommt
    // genau seine Gaerten und Pflanzen, gezeigt und gespeichert — und nichts geht ueber sie hinweg.
    name: 'Abmelden, dann ein BESTEHENDES Konto · kein „Mein Garten" entsteht dazwischen, der Login-Pull setzt genau die Gaerten von B',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async (LISTEN) => {
        const t = new Date().toISOString();
        __s1Leeren(LISTEN);
        gardens = [{ id: 'gA1', name: 'Garten von Konto A · Musterweg 3', created: t }];
        plantings = [{ id: 'plA1', gardenId: 'gA1', name: 'Beet-Pflanzung des Kontos A', created: t }];
        deadPlants = [{ id: 'mpA2', name: 'Verstorbene Rose des Kontos A', diedAt: t }];
        localStorage.setItem('gs_gardens', JSON.stringify(gardens));
        localStorage.setItem('gs_plantings', JSON.stringify(plantings));
        localStorage.setItem('gs_dead_plants', JSON.stringify(deadPlants));
        const B = { g: 'Garten von Konto B · Seeweg 9', pl: 'Hochbeet-Pflanzung des Kontos B', mp: 'Balkonpflanze des Kontos B' };
        const gesendet = [];
        const altFetch = window.sbFetch;
        let pullAn = false;
        window.sbFetch = async function (pfad, opts) {
          const m = ((opts && opts.method) || 'GET').toUpperCase();
          const p = String(pfad);
          if (m !== 'GET') { gesendet.push(m + ' ' + p.split('?')[0] + ' ' + String((opts && opts.body) || '')); return { data: [{}], error: null, status: 200 }; }
          if (pullAn && p.indexOf('/user_gardens?') >= 0) return { data: [{ data: { gardens: [{ id: 'gB1', name: B.g, created: t }], plantings: [{ id: 'plB1', gardenId: 'gB1', name: B.pl, created: t }] }, updated_at: t }], error: null, status: 200 };
          if (pullAn && p.indexOf('/user_plants?') >= 0) return { data: [{ data: { plants: [{ id: 'mpB1', name: B.mp }], dead_plants: [] }, updated_at: t }], error: null, status: 200 };
          return { data: [], error: null, status: 200 };
        };
        let zwischen = null, wurf = null;
        try {
          await sbLogout();
          await new Promise(res => setTimeout(res, 1500));
          zwischen = { gardens: localStorage.getItem('gs_gardens'), dirty: localStorage.getItem('gs_sync_dirty_at_garden'), var: gardens.map(x => x.name) };
          gesendet.length = 0;
          localStorage.setItem('gs_sb_token', 'pruef.konto.b');
          localStorage.setItem('gs_sb_uid', '33333333-3333-4333-8333-333333333333');
          localStorage.setItem('gs_sb_expires', String(Date.now() + 864e5));
          pullAn = true;
          await gsSyncUserDataOnLogin();
          await new Promise(res => setTimeout(res, 1200));
        } catch (e) { wurf = String(e && e.message); }
        finally { window.sbFetch = altFetch; }
        const gtxt = (document.getElementById('garden-list') || {}).textContent || '';
        return {
          wurf, B, zwischen, gtxt, gesendet,
          var: { g: gardens.map(x => x.name), pl: plantings.map(x => x.name), mp: myPlants.map(x => x.name), tot: deadPlants.length },
          speicher: { g: (JSON.parse(localStorage.getItem('gs_gardens') || '[]') || []).map(x => x.name), pl: (JSON.parse(localStorage.getItem('gs_plantings') || '[]') || []).map(x => x.name) },
        };
      }, LISTEN);
      await h.frisch();
      if (r.wurf) return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf };
      const f = [];
      if (r.zwischen.gardens && r.zwischen.gardens !== '[]') f.push('zwischen Abmelden und Anmelden steht gs_gardens im Speicher: ' + r.zwischen.gardens.slice(0, 80));
      if (r.zwischen.dirty) f.push('zwischen Abmelden und Anmelden ist der Garten als ungepusht markiert (' + r.zwischen.dirty + ') — der Pull eines bestehenden Kontos behielte ihn');
      if (JSON.stringify(r.var.g) !== JSON.stringify([r.B.g])) f.push('Variable gardens nach dem Login: ' + JSON.stringify(r.var.g));
      if (JSON.stringify(r.speicher.g) !== JSON.stringify([r.B.g])) f.push('Speicher gs_gardens nach dem Login: ' + JSON.stringify(r.speicher.g));
      if (JSON.stringify(r.var.pl) !== JSON.stringify([r.B.pl]) || JSON.stringify(r.speicher.pl) !== JSON.stringify([r.B.pl])) f.push('Pflanzungen: Variable ' + JSON.stringify(r.var.pl) + ' · Speicher ' + JSON.stringify(r.speicher.pl));
      if (JSON.stringify(r.var.mp) !== JSON.stringify([r.B.mp])) f.push('myPlants nach dem Login: ' + JSON.stringify(r.var.mp));
      if (r.var.tot) f.push(r.var.tot + ' tote Pflanze(n) nach dem Login — B hat keine');
      if (r.gtxt.indexOf(r.B.g) < 0 || /Mein Garten|Konto A/.test(r.gtxt)) f.push('die Gartenansicht zeigt nicht genau den Garten von B: ' + r.gtxt.replace(/\s+/g, ' ').slice(0, 120));
      const drueber = r.gesendet.filter(s => /user_gardens/.test(s) && s.indexOf(r.B.g) < 0);
      if (drueber.length) f.push('ein Push nach user_gardens ohne den Garten von B: ' + drueber[0].slice(0, 120));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'nach dem Abmelden: kein gs_gardens, keine Markierung · Login als bestehendes Konto: Variable, Speicher und Ansicht = genau die Gaerten, Pflanzungen und Pflanzen von B · ' + r.gesendet.length + ' Schreibvorgaenge, keiner ueber B hinweg' };
    },
  },
  {
    // Gegenpruefung g1: dieselbe Bauform wie gardens/favs, von der Suche nach „Spiegeln" nicht
    // gefunden — `socialUserName` (let, oberste Ebene) spiegelt gs_social_name (GS_USER_KEYS).
    // Der Speicher ging beim Abmelden, die Variable blieb. submitInlinePost gibt sie als
    // `gemerkt` an _gsOeffentlicherName — VOR dem Profil des neuen Kontos: der erste Beitrag von B
    // erschien unter dem Community-Namen von A. Gemessen am gesendeten Rumpf (author_name) und
    // am Namensfeld des Beitrags-Fensters, das A vorher geoeffnet hatte.
    name: 'Abmelden · der gemerkte Community-Name von A geht nicht in den Beitrag des naechsten Kontos (gesendeter Rumpf, Namensfeld)',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async (LISTEN) => {
        __s1Leeren(LISTEN);
        const NAME_A = 'Gartenfee Annelies Quendel';
        // A hat einen Namen gewaehlt und das Beitrags-Fenster benutzt.
        try { socialUserName = NAME_A; } catch (e) { return { fehler: 'socialUserName nicht erreichbar: ' + e.message }; }
        localStorage.setItem('gs_social_name', NAME_A);
        try { openPostWithType('status'); closeModal('modal-new-post'); } catch (e) {}
        const vorher = (document.getElementById('post-author') || {}).value || '';
        const gesendet = [];
        const altFetch = window.sbFetch;
        window.sbFetch = async function (pfad, opts) {
          const m = ((opts && opts.method) || 'GET').toUpperCase();
          if (m !== 'GET') { gesendet.push({ m, pfad: String(pfad).split('?')[0], body: String((opts && opts.body) || '') }); return { data: [{ id: 'srv-1' }], error: null, status: 201 }; }
          return { data: [], error: null, status: 200 };
        };
        let wurf = null, feld = '', rumpf = null, nachAbmelden = null;
        try {
          await sbLogout();
          try { nachAbmelden = socialUserName; } catch (e) { nachAbmelden = '[' + e.message + ']'; }
          gesendet.length = 0;
          localStorage.setItem('gs_sb_token', 'pruef.konto.b');
          localStorage.setItem('gs_sb_uid', '44444444-4444-4444-8444-444444444444');
          localStorage.setItem('gs_sb_expires', String(Date.now() + 864e5));
          await gsSyncUserDataOnLogin();
          const ta = document.getElementById('inline-post-text');
          if (ta) ta.value = 'Erster Beitrag von Konto B';
          await submitInlinePost();
          const post = gesendet.find(x => /social_posts/.test(x.pfad));
          rumpf = post ? post.body : null;
          try { openPostWithType('status'); feld = (document.getElementById('post-author') || {}).value || ''; closeModal('modal-new-post'); } catch (e) { feld = '[' + e.message + ']'; }
        } catch (e) { wurf = String(e && e.message); }
        finally { window.sbFetch = altFetch; }
        return { NAME_A, vorher, nachAbmelden, rumpf, feld, wurf };
      }, LISTEN);
      await h.frisch();
      if (r.fehler) return { ok: false, warum: r.fehler };
      if (r.wurf) return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf };
      if (r.vorher !== r.NAME_A) return { ok: false, warum: 'Fall nicht hergestellt: das Namensfeld trug vor dem Abmelden nicht den Namen von A (' + JSON.stringify(r.vorher) + ')' };
      if (!r.rumpf) return { ok: false, warum: 'Fall nicht hergestellt: submitInlinePost hat nichts an social_posts gesendet' };
      const f = [];
      let autor = ''; try { autor = String(JSON.parse(r.rumpf).author_name || ''); } catch (e) { autor = r.rumpf; }
      if (r.nachAbmelden) f.push('socialUserName nach dem Abmelden: ' + JSON.stringify(r.nachAbmelden));
      if (autor.indexOf(r.NAME_A) >= 0) f.push('der Beitrag von B ging unter dem Namen von A hinaus (author_name ' + JSON.stringify(autor) + ')');
      if (r.feld.indexOf(r.NAME_A) >= 0) f.push('das Namensfeld des Beitrags-Fensters zeigt B den Namen von A');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      if (!autor) return { ok: false, warum: 'gutartig: der Beitrag von B ging ohne author_name hinaus' };
      return { ok: true, info: 'nach dem Abmelden leer · Beitrag von B als ' + JSON.stringify(autor) + ' · Namensfeld leer' };
    },
  },
  {
    // Gegenpruefung g1: der Rest aus dem Bericht des Reparateurs, jetzt mit Wirkung. Das Abmelden
    // leert favs und myVotes (richtig) — der Login-Pull schrieb danach ps_favs / ps_votes eines
    // BESTEHENDEN Kontos nur in den Speicher, die Variablen blieben leer. Der erste Stern bzw. die
    // erste Stimme schrieb dann [neu] bzw. {neu} UEBER die geholten Favoriten und Stimmen von B —
    // und der State-Push (_buildStateBlob liest den SPEICHER) trug den Verlust in die Cloud von B.
    // Gemessen am Speicher; kommt im Fenster ein Push an user_app_state, wird auch er geprueft.
    name: 'Abmelden, dann ein BESTEHENDES Konto · Favoriten und Stimmen aus der Cloud von B ueberleben den ersten Stern und die erste Stimme (Speicher — aus ihm baut _buildStateBlob den Push; ein Push im Fenster wird mitgeprueft)',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async (LISTEN) => {
        __s1Leeren(LISTEN);
        const t = new Date().toISOString();
        favs = ['A-FAV-1']; localStorage.setItem('ps_favs', JSON.stringify(favs));
        myVotes = { 'fb-A': 'up' }; localStorage.setItem('ps_votes', JSON.stringify(myVotes));
        const gesendet = [];
        const altFetch = window.sbFetch;
        let pullAn = false;
        window.sbFetch = async function (pfad, opts) {
          const m = ((opts && opts.method) || 'GET').toUpperCase();
          const p = String(pfad);
          if (m !== 'GET') { gesendet.push(m + ' ' + p.split('?')[0] + ' ' + String((opts && opts.body) || '')); return { data: [{}], error: null, status: 200 }; }
          if (pullAn && p.indexOf('/user_app_state?') >= 0) return { data: [{ data: { favs: ['B-FAV-1', 'B-FAV-2'], votes: { 'fb-B': 'down' } }, updated_at: t }], error: null, status: 200 };
          return { data: [], error: null, status: 200 };
        };
        let wurf = null, gezogen = null;
        try {
          await sbLogout();
          gesendet.length = 0;
          localStorage.setItem('gs_sb_token', 'pruef.konto.b');
          localStorage.setItem('gs_sb_uid', '55555555-5555-4555-8555-555555555555');
          localStorage.setItem('gs_sb_expires', String(Date.now() + 864e5));
          pullAn = true;
          await gsSyncUserDataOnLogin();
          gezogen = { favs: localStorage.getItem('ps_favs'), votes: localStorage.getItem('ps_votes') };
          try { toggleFav('W036'); } catch (e) {}
          feedbackItems = [{ id: 'fb-X', title: 'Idee', votes: { up: 0, down: 0 } }];
          try { vote('fb-X', 'up'); } catch (e) {}
          await new Promise(res => setTimeout(res, 1500));
        } catch (e) { wurf = String(e && e.message); }
        finally { window.sbFetch = altFetch; }
        const state = gesendet.filter(s => /user_app_state/.test(s));
        return { wurf, gezogen, favs: localStorage.getItem('ps_favs') || '', votes: localStorage.getItem('ps_votes') || '', state: state.length ? state[state.length - 1] : '' };
      }, LISTEN);
      await h.frisch();
      if (r.wurf) return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf };
      if (!r.gezogen || String(r.gezogen.favs).indexOf('B-FAV-1') < 0 || String(r.gezogen.votes).indexOf('fb-B') < 0) return { ok: false, warum: 'Fall nicht hergestellt: der Login-Pull hat die Favoriten/Stimmen von B nicht in den Speicher gelegt (' + JSON.stringify(r.gezogen) + ')' };
      const f = [];
      ['B-FAV-1', 'B-FAV-2', 'W036'].forEach(w => { if (r.favs.indexOf(w) < 0) f.push('ps_favs ohne ' + w); });
      if (r.favs.indexOf('A-FAV-1') >= 0) f.push('ps_favs traegt den Favoriten von A');
      ['fb-B', 'fb-X'].forEach(w => { if (r.votes.indexOf(w) < 0) f.push('ps_votes ohne ' + w); });
      if (r.votes.indexOf('fb-A') >= 0) f.push('ps_votes traegt die Stimme von A');
      if (r.state && r.state.indexOf('B-FAV-1') < 0) f.push('der State-Push an die Cloud von B traegt die Favoriten von B nicht mehr');
      if (r.state && /A-FAV-1|fb-A/.test(r.state)) f.push('der State-Push an die Cloud von B traegt Daten von A');
      if (f.length) return { ok: false, warum: f.join(' · ') + ' (ps_favs=' + r.favs + ' · ps_votes=' + r.votes + ')' };
      return { ok: true, info: 'ps_favs ' + r.favs + ' · ps_votes ' + r.votes + (r.state ? ' · State-Push mit den Favoriten von B' : ' · kein State-Push im Fenster') };
    },
  },
  {
    // Brett 2026-11-16-a6d6 (19.11.2026): der Fall davor misst den Arbeitsspeicher — das DOM
    // trug weiter, was A hineingeschrieben hat. Gemessen gegen v33.61: nach Abmelden und dem
    // ECHTEN Anmeldeweg von B (onbDoLogin) standen 72 Textfelder mit dem Text von A da (Namen,
    // E-Mail im Anmeldefeld, Entwuerfe von Beitrag, Kommentar, Inserat, Feedback, Tagebuch,
    // Rezept, Planer), #compose-avatar zeigte das Emoji aus dem Namen von A und ging als
    // author_avatar in den ersten Beitrag von B, das Foto im Beitrags-Entwurf von A ging mit
    // hinaus, offene Fenster von A (Rueckfrage mit seinem Namen, Scan-Verlauf, „Meine Plaene")
    // lagen nach dem Anmelden sichtbar ueber der App, und die Startseite zeigte B den Tagesplan
    // und den Gruss von A. Gemessen wird gegen den Stand einer FRISCH geladenen Seite — die
    // Regel heisst „derselbe Stand wie nach einem Neuladen", nicht „leer".
    name: 'Abmelden · kein Textfeld, kein Fenster und keine Anzeige traegt den Stand von A — jedes Feld wie nach einem Neuladen, die Startseite aus dem leeren Stand, der erste Beitrag von B mit eigenem Avatar und ohne das Foto von A (echter Anmeldeweg)',
    lauf: async (seite, h) => {
      seite = await frischAlsA(seite, h);
      const r = await seite.evaluate(async () => {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        const TEXT = /^(text|search|email|tel|url|password|number|)$/;
        const textFelder = () => Array.from(document.querySelectorAll('input[id], textarea[id]'))
          .filter(el => el.tagName === 'TEXTAREA' || TEXT.test((el.getAttribute('type') || '').toLowerCase()));
        const ANZEIGEN = ['compose-avatar', 'inline-plant-label'];
        // 1. Der Stand nach einem Neuladen (diese Seite ist eben frisch geladen).
        const ref = { feld: {}, anzeige: {} };
        textFelder().forEach(el => { ref.feld[el.id] = el.value; });
        ANZEIGEN.forEach(id => { const el = document.getElementById(id); ref.anzeige[id] = el ? el.textContent : null; });
        const geraet = (typeof GS_ABMELDEN_FELDER_GERAET !== 'undefined') ? GS_ABMELDEN_FELDER_GERAET : {};
        const NAME_A = 'Gartenfee Annelies Quendel';
        const FOTO_A = 'data:image/png;base64,QUVOREVOLUFOTi1RVUVOREVM';
        // 2. Konto A benutzt die App: Startseite, Community-Name ueber den echten Dialog, jedes
        //    Textfeld, ein Beitrags-Entwurf mit Foto und Pflanze, und vier offene Fenster.
        try { switchTab('home'); } catch (e) {}
        // Den Stand von A HERSTELLEN, nicht vom Start erwarten: in einer Gegenprobe stand der Gruss
        // nach dem Laden ohne Namen da (Zeitpunkt), und der Fall haette dann nichts gemessen.
        try { if (typeof gsUpdateHomeGreeting === 'function') gsUpdateHomeGreeting(); } catch (e) {}
        try { if (typeof gsRenderDayPlan === 'function') gsRenderDayPlan(); } catch (e) {}
        const gruss = () => ((document.getElementById('home-greeting-label') || {}).textContent || '');
        const vorA = { plan: ((document.getElementById('home-dayplan') || {}).textContent || ''), gruss: gruss() };
        try { showNameInput(); } catch (e) {}
        await sleep(150);
        const pin = document.getElementById('gs-prompt-input'); if (pin) pin.value = NAME_A;
        const pok = document.getElementById('gs-prompt-ok'); if (pok) pok.click();
        await sleep(150);
        const avatarA = (document.getElementById('compose-avatar') || {}).textContent;
        const gefuellt = [];
        textFelder().forEach(el => {
          if (Object.prototype.hasOwnProperty.call(geraet, el.id)) return;
          el.value = (el.getAttribute('type') || '').toLowerCase() === 'number' ? '4242' : 'Quendel·' + el.id;
          if (el.value) gefuellt.push(el.id);
        });
        // Die Suche in der Artenliste ueber ihren echten Weg: doSearch liest das Feld und setzt
        // searchText — die Liste filtert danach weiter, auch wenn das Feld leer aussieht.
        try { const si = document.getElementById('search-input'); si.dispatchEvent(new Event('input', { bubbles: true })); } catch (e) {}
        await sleep(200);
        let sucheA = null; try { sucheA = searchText; } catch (e) {}
        try { inlinePhotoData = FOTO_A; } catch (e) {}
        const pimg = document.getElementById('inline-photo-img'); if (pimg) pimg.src = FOTO_A;
        const pprev = document.getElementById('inline-photo-preview'); if (pprev) pprev.style.display = 'block';
        try { window._inlinePlantMode = true; selectIgPlant('Quendel-Pflanze', '🌿'); } catch (e) {}
        // Die zwei anderen Entwuerfe mit Foto: das Inserat (submitListing legt es ins Inserat)
        // und die Vorschau im Beitrags-Fenster.
        window._gsListingPhotoB64 = 'QUVOREVOLUFOTi1JTlNFUkFU';
        window._gsPostImage = FOTO_A;
        localStorage.setItem('gs_plans_v2', JSON.stringify([{ localId: 'pl-a1', title: 'Plan von Quendel', type: 'garden', created: new Date().toISOString(), uid: localStorage.getItem('gs_sb_uid'), payload: {} }]));
        try { openScanHistoryFull(); } catch (e) {}
        try { await Promise.race([gsPlansOpen(), sleep(500)]); } catch (e) {}
        try { openPostWithType('status'); document.getElementById('post-text').value = 'Entwurf von Quendel'; } catch (e) {}
        try { gsPromptModal({ title: 'Name', value: NAME_A }); } catch (e) {}
        await sleep(300);
        // Was fest und sichtbar ueber der App liegt: jede feste Schicht ab einem Drittel des
        // Bildschirms, deren naechster fester Vorfahr #app oder keiner ist — am <body> wie in #app
        // (Fenster wie der Scan-Verlauf haengen in #app). Grundlinie gemessen 19.11.2026: auf
        // allen elf Tabs ohne offenes Fenster ist das LEER.
        const schichten = () => Array.from(document.querySelectorAll('body *')).filter(el => {
          if (el.id === 'app' || el.closest('#gs-onboarding')) return false;
          const cs = getComputedStyle(el); if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false;
          let p = el.parentElement; while (p && p !== document.body && p.id !== 'app') { if (getComputedStyle(p).position === 'fixed') return false; p = p.parentElement; }
          const b = el.getBoundingClientRect(); return b.width * b.height >= innerWidth * innerHeight / 3;
        }).map(el => (el.id || String(el.className).split(' ')[0] || el.tagName) + ' „' + (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40) + '“');
        const fensterA = schichten();
        // 3. Abmelden, dann meldet sich B ueber den Anmeldebildschirm an (sbLogin echt, nur das
        //    Netz ist gestellt; B hat keine Cloud-Daten).
        const B_UID = '66666666-6666-4666-8666-666666666666';
        const gesendet = [], hochgeladen = [];
        const altFetch = window.sbFetch, altGs = window._gsFetch, altUp = window.gsUploadImage;
        window.sbFetch = async function (pfad, opts) {
          const m = ((opts && opts.method) || 'GET').toUpperCase();
          if (m !== 'GET') {
            gesendet.push({ m, pfad: String(pfad).split('?')[0], body: String((opts && opts.body) || '') });
            // Eine RPC antwortet leer: eine gestellte Zeile machte aus fn_followup_due einen
            // Nachfrage-Dialog FUER B (ein Fenster des neuen Kontos, kein Rest von A).
            if (String(pfad).indexOf('/rpc/') >= 0) return { data: [], error: null, status: 200 };
            return { data: [{ id: 'srv-1' }], error: null, status: 201 };
          }
          return { data: [], error: null, status: 200 };
        };
        window._gsFetch = async function (url) {
          const u = String(url);
          const body = u.indexOf('/auth/v1/token') >= 0
            ? { access_token: 'pruef.konto.b', refresh_token: 'r-b', expires_in: 3600, user: { id: B_UID, email: 'kontob@example.invalid', user_metadata: {} } }
            : {};
          return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
        };
        window.gsUploadImage = async function (b64) { hochgeladen.push(String(b64).slice(0, 40)); return 'https://example.invalid/hochgeladen.jpg'; };
        let wurf = null, nachAn = null, post = null, zwischen = null;
        try {
          await sbLogout();
          await sleep(700);
          // Zwischen Abmelden und Anmelden gehoert der Speicher niemandem: kein Schluessel aus
          // GS_USER_KEYS darf hier (wieder) entstehen — auch nicht durch das Neuzeichnen der
          // Startseite (initHomeBoard → gsTouchStreak schrieb gs_streak, Gegenprobe 19.11.2026).
          zwischen = GS_USER_KEYS.filter(k => localStorage.getItem(k) !== null);
          document.getElementById('onb-login-email').value = 'kontob@example.invalid';
          document.getElementById('onb-login-pw').value = 'geheim-b-123';
          await onbDoLogin();
          await sleep(1500);
          const felder = {};
          // Ein Feld, das erst ein Fenster baut (#scan-history-search), gibt es nach dem Neuladen
          // nicht — fuer es gilt sein Ausgangswert (defaultValue).
          textFelder().forEach(el => { felder[el.id] = el.value; if (!Object.prototype.hasOwnProperty.call(ref.feld, el.id)) ref.feld[el.id] = el.defaultValue; });
          const anzeige = {};
          ANZEIGEN.forEach(id => { const el = document.getElementById(id); anzeige[id] = el ? el.textContent : null; });
          let foto = null; try { foto = inlinePhotoData; } catch (e) { foto = '[' + e.message + ']'; }
          let suche = null; try { suche = searchText; } catch (e) { suche = '[' + e.message + ']'; }
          const entwurfFotos = [window._gsListingPhotoB64 ? '_gsListingPhotoB64' : '', window._gsPostImage ? '_gsPostImage' : ''].filter(Boolean);
          nachAn = {
            uid: localStorage.getItem('gs_sb_uid'), felder, anzeige, foto, suche, entwurfFotos,
            fotoSicht: !!(pprev && getComputedStyle(pprev).display !== 'none'),
            fenster: schichten(),
            prompt: !!document.getElementById('gs-prompt-modal'),
            tab: (document.querySelector('.screen.active') || {}).id || '',
            plan: ((document.getElementById('home-dayplan') || {}).textContent || ''), gruss: gruss(),
          };
          // B schreibt seinen ersten Beitrag im Feld oben im Feed.
          gesendet.length = 0;
          const ta = document.getElementById('inline-post-text');
          if (ta) ta.value = 'Erster Beitrag von Konto B';
          await submitInlinePost();
          await sleep(200);
          const p = gesendet.find(x => /social_posts/.test(x.pfad));
          post = p ? p.body : null;
        } catch (e) { wurf = String(e && e.message); }
        finally { window.sbFetch = altFetch; window._gsFetch = altGs; window.gsUploadImage = altUp; }
        return { ref, vorA, avatarA, sucheA, gefuellt, fensterA, nachAn, post, hochgeladen, wurf, zwischen, NAME_A, B_UID, geraet: Object.keys(geraet), geraetGrund: geraet, keep: (typeof GS_KEEP_ON_LOGOUT !== 'undefined') ? GS_KEEP_ON_LOGOUT : [] };
      });
      await h.frisch();
      if (r.wurf) return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf };
      // Ist der Fall hergestellt? A hatte Gruss, Tagesplan, Avatar, gefuellte Felder und Fenster.
      if (r.vorA.gruss.indexOf('Testnutzerin') < 0) return { ok: false, warum: 'Fall nicht hergestellt: der Gruss von A nennt den Namen nicht (' + JSON.stringify(r.vorA.gruss) + ')' };
      if (!/Basilikum|Tomate/.test(r.vorA.plan)) return { ok: false, warum: 'Fall nicht hergestellt: der Tagesplan von A zeigt keine Aufgabe (' + r.vorA.plan.slice(0, 80) + ')' };
      if (!r.avatarA || r.avatarA === r.ref.anzeige['compose-avatar']) return { ok: false, warum: 'Fall nicht hergestellt: #compose-avatar zeigt nach der Namenswahl von A dasselbe wie nach dem Neuladen (' + r.avatarA + ')' };
      if (!r.sucheA || r.sucheA.indexOf('quendel') < 0) return { ok: false, warum: 'Fall nicht hergestellt: die Artensuche von A filtert nicht (searchText=' + JSON.stringify(r.sucheA) + ')' };
      if (r.gefuellt.length < 40) return { ok: false, warum: 'Fall nicht hergestellt: nur ' + r.gefuellt.length + ' Textfelder gefuellt' };
      if (r.fensterA.length < 3) return { ok: false, warum: 'Fall nicht hergestellt: nur ' + r.fensterA.length + ' Fenster offen (' + r.fensterA.join(', ') + ')' };
      if (!r.nachAn || r.nachAn.uid !== r.B_UID) return { ok: false, warum: 'Fall nicht hergestellt: B ist nach onbDoLogin nicht angemeldet (' + JSON.stringify(r.nachAn && r.nachAn.uid) + ')' };
      if (!r.post) return { ok: false, warum: 'Fall nicht hergestellt: submitInlinePost von B hat nichts an social_posts gesendet' };
      // Jede Ausnahme in GS_ABMELDEN_FELDER_GERAET muss einen Schluessel aus GS_KEEP_ON_LOGOUT spiegeln.
      const f = [];
      r.geraet.forEach(id => {
        const k = (String(r.geraetGrund[id] || '').match(/\bgs_[a-z0-9_]+/) || [])[0];
        if (!k || r.keep.indexOf(k) < 0) f.push('GS_ABMELDEN_FELDER_GERAET nennt #' + id + ' ohne einen Schluessel aus GS_KEEP_ON_LOGOUT (' + JSON.stringify(r.geraetGrund[id]) + ')');
      });
      const falsch = Object.keys(r.nachAn.felder).filter(id => r.geraet.indexOf(id) < 0 && r.nachAn.felder[id] !== r.ref.feld[id]);
      if (falsch.length) f.push(falsch.length + ' Textfelder nicht wie nach dem Neuladen (' + falsch.slice(0, 6).map(id => '#' + id + '=' + JSON.stringify(String(r.nachAn.felder[id]).slice(0, 24))).join(', ') + (falsch.length > 6 ? ', …' : '') + ')');
      Object.keys(r.ref.anzeige).forEach(id => { if (r.nachAn.anzeige[id] !== r.ref.anzeige[id]) f.push('#' + id + ' zeigt ' + JSON.stringify(r.nachAn.anzeige[id]) + ' statt ' + JSON.stringify(r.ref.anzeige[id])); });
      if (r.nachAn.suche) f.push('die Artenliste filtert B weiter nach dem Suchwort von A (searchText=' + JSON.stringify(r.nachAn.suche) + ')');
      if (r.nachAn.foto) f.push('der Beitrags-Entwurf traegt noch das Foto von A');
      if (r.nachAn.entwurfFotos.length) f.push('Entwuerfe tragen noch ein Foto von A: ' + r.nachAn.entwurfFotos.join(', '));
      if (r.nachAn.fotoSicht) f.push('die Foto-Vorschau des Entwurfs von A ist sichtbar');
      if (r.nachAn.fenster.length) f.push('ueber der App liegen Fenster von A: ' + r.nachAn.fenster.join(', '));
      if (r.nachAn.prompt) f.push('die Rueckfrage mit dem Namen von A steht noch im Dokument');
      if (r.zwischen && r.zwischen.length) f.push('zwischen Abmelden und Anmelden stehen Nutzerschluessel im Speicher: ' + r.zwischen.join(', '));
      if (r.nachAn.tab !== 'screen-home') f.push('B landet nicht auf der Startseite (' + r.nachAn.tab + ')');
      if (/Basilikum|Tomate|Monstera/.test(r.nachAn.plan)) f.push('der Tagesplan zeigt B die Aufgaben von A (' + r.nachAn.plan.replace(/\s+/g, ' ').slice(0, 60) + '…)');
      if (r.nachAn.gruss.indexOf('Testnutzerin') >= 0) f.push('der Gruss nennt B den Namen von A (' + JSON.stringify(r.nachAn.gruss) + ')');
      let rumpf = {}; try { rumpf = JSON.parse(r.post); } catch (e) {}
      if (rumpf.author_avatar === r.avatarA) f.push('der Beitrag von B ging mit dem Avatar von A hinaus (' + rumpf.author_avatar + ')');
      if (String(rumpf.author_name || '').indexOf(r.NAME_A) >= 0) f.push('der Beitrag von B ging unter dem Namen von A hinaus');
      if (rumpf.plant_name) f.push('der Beitrag von B traegt die Pflanze aus dem Entwurf von A (' + rumpf.plant_name + ')');
      if (rumpf.photo_url || r.hochgeladen.length) f.push('der Beitrag von B hat das Foto von A hochgeladen (' + r.hochgeladen.length + '×)');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      if (rumpf.content !== 'Erster Beitrag von Konto B') return { ok: false, warum: 'gutartig: der Text von B kam nicht an (' + JSON.stringify(rumpf.content) + ')' };
      return { ok: true, info: r.gefuellt.length + ' Textfelder von A gefuellt, nach Abmelden und Anmelden von B alle wie nach dem Neuladen' + (r.geraet.length ? ' (' + r.geraet.length + ' Geraete-Filter bleiben, in GS_KEEP_ON_LOGOUT)' : '') + ' · ' + r.fensterA.length + ' Fenster von A zu · Startseite, Gruss, Avatar, Entwurf ohne A · Beitrag von B als ' + JSON.stringify(rumpf.author_avatar) + ' ohne Foto und Pflanze von A' };
    },
  },
  {
    // Gegenpruefung dom-plaene (19.11.2026): der Fall davor misst Textfelder, zwei Anzeigen und
    // die Startseite gegen eine FRISCHE Seite von A. Zahlen, die aus Kontodaten kommen, kann er so
    // nicht messen (die frische Seite zeigt die Zahlen von A). Hier ist die Referenz deshalb B
    // selbst: eine zweite Seite in einem eigenen Kontext, geladen mit GENAU dem Speicher, den B
    // nach dem Anmelden hat — „wie nach einem Neuladen" wortwoertlich. Gemessen gegen 0b930cf:
    // #stat-favs zeigte B „4" (die Pflanzen von A, Referenz 0), das Abzeichen am Reiter
    // „Pflanzen" „3" (die ueberfaelligen Aufgaben von A, Referenz verborgen) — beide schreibt nur
    // ein Speichern bzw. ein Tab-Wechsel, nie das Abmelden. Und der Scan-Chat ging fuer B nicht
    // mehr auf: sbLogout setzt display:none auf JEDES .modal-overlay, openScanChat setzte nur die
    // Klasse (dieselbe Sperre nach Escape/Zurueck: closeModal setzt display:none ebenso).
    name: 'Abmelden · Zahlen der Startseite, Abzeichen der Leiste und der Scan-Chat — fuer B wie nach einem Neuladen mit demselben Speicher (eigener Kontext als Referenz)',
    lauf: async (seite, h) => {
      seite = await frischAlsA(seite, h);
      const ZAHLEN = () => {
        const t = id => { const el = document.getElementById(id); return el ? String(el.textContent).trim() : null; };
        const b = document.getElementById('gs-tab-favs-badge');
        const g = document.getElementById('gs-bell-badge');
        return {
          'stat-favs': t('stat-favs'), 'stat-scans': t('stat-scans'), 'stat-total': t('stat-total'), 'stat-edible': t('stat-edible'),
          'reiter-abzeichen': b ? (b.hidden ? '(verborgen)' : b.textContent) : null,
          'glocke': g ? (getComputedStyle(g).display === 'none' ? '(verborgen)' : g.textContent) : null,
        };
      };
      // Geht der Scan-Chat auf, und liegt er oben (elementFromPoint in seinem Kasten)?
      const CHAT = async () => {
        try { openScanChat(); } catch (e) { return 'wirft: ' + e.message; }
        await new Promise(r => setTimeout(r, 400));
        const m = document.getElementById('scan-chat-modal');
        const box = m && (m.querySelector('.modal, .obox, .mpanel') || m);
        let auf = false;
        if (m && getComputedStyle(m).display !== 'none' && box) {
          const r = box.getBoundingClientRect();
          const el = r.width && r.height ? document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 40)) : null;
          auf = !!(el && m.contains(el));
        }
        try { closeScanChat(); } catch (e) {}
        return auf ? 'offen' : 'geht nicht auf';
      };
      const r = await seite.evaluate(async (fn) => {
        const ZAHLEN = eval('(' + fn.z + ')'), CHAT = eval('(' + fn.c + ')');
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        try { switchTab('home'); } catch (e) {}
        await sleep(2200);
        const vorA = { zahlen: ZAHLEN(), pflanzen: gsPflanzenZahl(), faellig: countOverdueTasks() };
        const B_UID = '66666666-6666-4666-8666-666666666666';
        const altFetch = window.sbFetch, altGs = window._gsFetch;
        window.sbFetch = async function (pfad, opts) {
          const m = ((opts && opts.method) || 'GET').toUpperCase();
          if (m !== 'GET') return { data: String(pfad).indexOf('/rpc/') >= 0 ? [] : [{ id: 'srv-1' }], error: null, status: 200 };
          return { data: [], error: null, status: 200 };
        };
        window._gsFetch = async function (url) {
          const body = String(url).indexOf('/auth/v1/token') >= 0
            ? { access_token: 'pruef.konto.b', refresh_token: 'r-b', expires_in: 3600, user: { id: B_UID, email: 'kontob@example.invalid', user_metadata: {} } } : {};
          return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body };
        };
        let wurf = null, nachB = null, chatB = null, speicher = null;
        try {
          // A steht zuletzt auf „Meine Pflanzen" — wie im Betrieb, wenn der Knopf in den Einstellungen liegt.
          try { switchTab('favs'); } catch (e) {}
          await sleep(300);
          await sbLogout();
          await sleep(700);
          document.getElementById('onb-login-email').value = 'kontob@example.invalid';
          document.getElementById('onb-login-pw').value = 'geheim-b-123';
          await onbDoLogin();
          await sleep(1500);
          try { switchTab('home'); } catch (e) {}
          await sleep(2200);
          nachB = ZAHLEN();
          chatB = await CHAT();
          speicher = {};
          for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); speicher[k] = localStorage.getItem(k); }
        } catch (e) { wurf = String(e && e.message); }
        finally { window.sbFetch = altFetch; window._gsFetch = altGs; }
        return { vorA, nachB, chatB, speicher, wurf, uid: localStorage.getItem('gs_sb_uid'), B_UID };
      }, { z: ZAHLEN.toString(), c: CHAT.toString() });
      if (r.wurf) { await h.frisch(); return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf }; }
      // Ist der Fall hergestellt? A hat Pflanzen und faellige Aufgaben, und beides steht da.
      if (!(r.vorA.pflanzen > 0) || r.vorA.zahlen['stat-favs'] !== String(r.vorA.pflanzen)) { await h.frisch(); return { ok: false, warum: 'Fall nicht hergestellt: #stat-favs zeigt bei A ' + JSON.stringify(r.vorA.zahlen['stat-favs']) + ' fuer ' + r.vorA.pflanzen + ' Pflanzen' }; }
      if (!(r.vorA.faellig > 0) || r.vorA.zahlen['reiter-abzeichen'] !== String(r.vorA.faellig)) { await h.frisch(); return { ok: false, warum: 'Fall nicht hergestellt: das Abzeichen am Reiter zeigt bei A ' + JSON.stringify(r.vorA.zahlen['reiter-abzeichen']) + ' fuer ' + r.vorA.faellig + ' faellige Aufgaben' }; }
      if (r.uid !== r.B_UID) { await h.frisch(); return { ok: false, warum: 'Fall nicht hergestellt: B ist nicht angemeldet (' + JSON.stringify(r.uid) + ')' }; }
      // Die Referenz: B laedt neu — eigener Kontext (eigener Speicher, kein Seed), derselbe Speicher.
      const WURZEL = path.resolve(__dirname, '..', '..');
      const ctx = await seite.context().browser().newContext({ viewport: { width: 412, height: 915 } });
      let ref = null, chatRef = null, fehlerRef = [];
      try {
        const p = await ctx.newPage();
        p.on('pageerror', e => fehlerRef.push(String(e.message).split('\n')[0]));
        p.on('dialog', d => d.dismiss().catch(() => {}));
        await p.route('**', rt => rt.request().url().startsWith('file:') ? rt.continue() : rt.abort());
        await p.addInitScript((st) => { try { localStorage.clear(); Object.keys(st).forEach(k => localStorage.setItem(k, st[k])); } catch (e) {} }, r.speicher);
        await p.goto('file://' + path.join(WURZEL, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
        await p.waitForTimeout(4500);
        const rr = await p.evaluate(async (fn) => {
          const ZAHLEN = eval('(' + fn.z + ')'), CHAT = eval('(' + fn.c + ')');
          window.gsHaptic = () => {};
          try { switchTab('home'); } catch (e) {}
          await new Promise(res => setTimeout(res, 2200));
          return { zahlen: ZAHLEN(), chat: await CHAT(), uid: localStorage.getItem('gs_sb_uid') };
        }, { z: ZAHLEN.toString(), c: CHAT.toString() });
        ref = rr.zahlen; chatRef = rr.chat;
        if (rr.uid !== r.B_UID) { ref = null; fehlerRef.push('Referenz nicht als B angemeldet: ' + rr.uid); }
      } finally { await ctx.close().catch(() => {}); }
      await h.frisch();
      if (!ref) return { ok: false, warum: 'Referenz nicht hergestellt: ' + fehlerRef.join(' | ') };
      if (chatRef !== 'offen') return { ok: false, warum: 'Referenz: der Scan-Chat geht nach dem Neuladen nicht auf (' + chatRef + ') — der Fall misst nichts' };
      const f = [];
      Object.keys(ref).forEach(k => { if (r.nachB[k] !== ref[k]) f.push(k + ' zeigt ' + JSON.stringify(r.nachB[k]) + ' statt ' + JSON.stringify(ref[k]) + ' (nach dem Neuladen)'); });
      if (r.chatB !== 'offen') f.push('der Scan-Chat ' + r.chatB + ' (nach dem Neuladen: offen)');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'A: ' + r.vorA.pflanzen + ' Pflanzen, ' + r.vorA.faellig + ' faellig · nach Abmelden und Anmelden von B = Neuladen mit demselben Speicher: ' + Object.keys(ref).map(k => k + ' ' + ref[k]).join(', ') + ' · Scan-Chat offen' };
    },
  },
  {
    // Gegenpruefung dom-plaene (19.11.2026): die Serien-Sperre (_gsAbmeldenLaeuft) gilt nur, solange
    // _gsAbmeldenStartseite laeuft. Ein Schliessen mit Zeitzuender laeuft danach: closeDailyQuiz ruft
    // setTimeout(initHomeBoard, 300) → gsTouchStreak → gsUpdateStreak. Gemessen gegen 0b930cf: A hat
    // das Tagesquiz offen, meldet sich ab — 1,5 s spaeter stehen gs_streak, gs_streak_sig,
    // gs_streak_stamp und gs_last_active_day_iso im Speicher, fuer niemanden; die naechste Person
    // erbt den heutigen Stempel. Die Regel gehoert an den SCHREIBER (gsUpdateStreak: ohne Person kein
    // Stempel), nicht an jeden Weg dorthin.
    name: 'Abmelden mit offenem Tagesquiz · auch ein verzoegerter Zeichner (closeDailyQuiz → initHomeBoard) stempelt keine Serie fuer niemanden — zwischen Abmelden und Anmelden kein Nutzerschluessel',
    lauf: async (seite, h) => {
      seite = await frischAlsA(seite, h);
      const r = await seite.evaluate(async () => {
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        const altFetch = window.sbFetch, altGs = window._gsFetch;
        window.sbFetch = async () => ({ data: [], error: null, status: 200 });
        window._gsFetch = async () => ({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' });
        let quiz = null, sofort = null, spaeter = null, wurf = null;
        try {
          try { switchTab('home'); } catch (e) {}
          await sleep(300);
          try { const p = openDailyQuiz(); if (p && p.then) await Promise.race([p, sleep(1500)]); } catch (e) { quiz = 'wirft: ' + e.message; }
          await sleep(500);
          const m = document.getElementById('modal-daily-quiz');
          quiz = quiz || (m && getComputedStyle(m).display !== 'none' ? 'offen' : 'zu');
          await sbLogout();
          sofort = GS_USER_KEYS.filter(k => localStorage.getItem(k) !== null);
          await sleep(1500);
          spaeter = GS_USER_KEYS.filter(k => localStorage.getItem(k) !== null);
        } catch (e) { wurf = String(e && e.message); }
        finally { window.sbFetch = altFetch; window._gsFetch = altGs; }
        return { quiz, sofort, spaeter, wurf, person: (typeof _gsPerson === 'function') ? _gsPerson() : '?' };
      });
      await h.frisch();
      if (r.wurf) return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf };
      if (r.quiz !== 'offen') return { ok: false, warum: 'Fall nicht hergestellt: das Tagesquiz von A ist nicht offen (' + r.quiz + ')' };
      if (r.person !== null) return { ok: false, warum: 'Fall nicht hergestellt: nach sbLogout noch angemeldet (' + r.person + ')' };
      if (r.sofort.length) return { ok: false, warum: 'direkt nach dem Abmelden stehen Nutzerschluessel im Speicher: ' + r.sofort.join(', ') };
      // gs_last_sync_ts: der Flush aus sbLogout (2,5-s-Rennen) stempelt nach dem Abmelden — Klasse
      // 89ee (Antwort nach einem await), eigene Gruppe; hier namentlich ausgenommen, nicht still.
      const AUSNAHME = { gs_last_sync_ts: 'Flush aus sbLogout stempelt nach dem Abmelden (Klasse 89ee, eigene Gruppe)' };
      const neu = r.spaeter.filter(k => !Object.prototype.hasOwnProperty.call(AUSNAHME, k));
      if (neu.length) return { ok: false, warum: '1,5 s nach dem Abmelden stehen Nutzerschluessel im Speicher — fuer niemanden: ' + neu.join(', ') };
      return { ok: true, info: 'Tagesquiz offen · nach dem Abmelden und 1,5 s spaeter kein Nutzerschluessel' + (r.spaeter.length ? ' (ausgenommen mit Grund: ' + r.spaeter.join(', ') + ')' : '') };
    },
  },
  {
    // SPEICHER-V2 Scheibe 1: gs_recipes / gs_remedies bleiben beim Abmelden liegen (Zwischenspeicher der
    // Vorgaben, GS_KEEP_ON_LOGOUT) — und mit ihnen die SELBST geschriebenen Rezepte (Id r_<13 Ziffern>).
    // Das naechste Konto sah sie, und sein Cloud-Backup (user_recipes) nahm sie mit. Jetzt tragen sie ihr
    // Konto: nicht geloescht (sie liegen nur hier und im Backup), aber nur ihrem Konto gezeigt.
    name: 'Abmelden · eigene Rezepte und Heilmittel von A sieht das naechste Konto nicht, sein Backup nimmt sie nicht mit — und A findet sie nach dem Wiederanmelden vor (nicht geloescht)',
    lauf: async (seite, h) => {
      await vorbereiten(seite);
      const r = await seite.evaluate(async () => {
        const A = localStorage.getItem('gs_sb_uid') || localStorage.getItem('gs_last_active_uid');
        const B = '44444444-4444-4444-8444-444444444444';
        const eigen = (a) => (a || []).filter(x => x && /^(r|rem)_\d{13}$/.test(String(x.id))).map(x => x.id).sort().join(',');
        const sicht = () => ({ rezepte: eigen(recipesData), heil: eigen(remediesData) });
        const backup = () => { try { const st = gsSnapshotBuildState(); return { rezepte: eigen(st.user_recipes), heil: eigen(st.user_remedies) }; } catch (e) { return { fehler: e.message }; } };
        const altFetch = window.sbFetch;
        window.sbFetch = async function (pfad, opts) { return ((opts && opts.method) || 'GET').toUpperCase() === 'GET' ? { data: [], error: null, status: 200 } : { data: [{}], error: null, status: 200 }; };
        let wurf = null; const raus = { A };
        try {
          // A hat zwei eigene Eintraege: einen aus dem Bestand (ohne Stempel) und ein Heilmittel.
          recipesData.unshift({ id: 'r_1700000000001', type: 'recipes', title: 'Omas Bärlauchsuppe', plant: '', ingredients: 'Bärlauch', steps: 'kochen', created: 1700000000001 });
          remediesData.unshift({ id: 'rem_1700000000002', type: 'remedies', title: 'Mein Hustentee', plant: '', ingredients: 'Thymian', steps: 'ziehen lassen', created: 1700000000002 });
          saveRecipesData();
          const vorgaben = recipesData.length;
          raus.vorher = sicht(); raus.vorgaben = vorgaben;
          await sbLogout();
          raus.abgemeldet = sicht();
          raus.speicher = { rezepte: eigen(JSON.parse(localStorage.getItem('gs_recipes') || '[]')), heil: eigen(JSON.parse(localStorage.getItem('gs_remedies') || '[]')) };
          raus.stempel = JSON.parse(localStorage.getItem('gs_recipes') || '[]').filter(x => x && x.id === 'r_1700000000001').map(x => x.uid).join(',');
          // B meldet sich an.
          localStorage.setItem('gs_sb_token', 'pruef.konto.b'); localStorage.setItem('gs_sb_uid', B); localStorage.setItem('gs_sb_expires', String(Date.now() + 864e5));
          _gsRezepteNeuLaden();
          raus.b = sicht(); raus.b_backup = backup(); raus.b_vorgaben = recipesData.length;
          // B schreibt selbst eines — und speichert: die von A duerfen dabei nicht verloren gehen.
          recipesData.unshift({ id: 'r_1700000000003', type: 'recipes', title: 'Rezept von B', uid: B, created: 1700000000003 });
          saveRecipesData();
          raus.speicher2 = eigen(JSON.parse(localStorage.getItem('gs_recipes') || '[]'));
          // A kommt zurueck.
          localStorage.setItem('gs_sb_uid', A);
          _gsRezepteNeuLaden();
          raus.a2 = sicht(); raus.a2_backup = backup();
        } catch (e) { wurf = String(e && e.stack || e).split('\n').slice(0, 2).join(' | '); }
        finally { window.sbFetch = altFetch; }
        raus.wurf = wurf;
        return raus;
      });
      await h.frisch();
      if (r.wurf) return { ok: false, warum: 'Ausnahme im Ablauf: ' + r.wurf };
      if (!r.A) return { ok: false, warum: 'Fall nicht hergestellt: kein Konto A angemeldet' };
      if (r.vorher.rezepte !== 'r_1700000000001' || r.vorher.heil !== 'rem_1700000000002') return { ok: false, warum: 'Fall nicht hergestellt: die eigenen Eintraege von A stehen vor dem Abmelden nicht in den Listen (' + JSON.stringify(r.vorher) + ')' };
      const f = [];
      if (r.abgemeldet.rezepte || r.abgemeldet.heil) f.push('nach dem Abmelden stehen die eigenen Eintraege von A noch in den Listen: ' + JSON.stringify(r.abgemeldet));
      if (r.b.rezepte || r.b.heil) f.push('Konto B sieht die eigenen Eintraege von A: ' + JSON.stringify(r.b));
      if (r.b_backup.fehler) f.push('gsSnapshotBuildState wirft: ' + r.b_backup.fehler);
      else if (r.b_backup.rezepte || r.b_backup.heil) f.push('das Backup von B nimmt die eigenen Eintraege von A mit: ' + JSON.stringify(r.b_backup));
      if (r.speicher.rezepte !== 'r_1700000000001' || r.speicher.heil !== 'rem_1700000000002') f.push('gutartig: die Eintraege von A sind nach dem Abmelden nicht mehr im Speicher — geloescht statt verborgen (' + JSON.stringify(r.speicher) + ')');
      if (r.stempel !== r.A) f.push('gutartig: der Bestands-Eintrag traegt nach dem Abmelden nicht das Konto von A (' + JSON.stringify(r.stempel) + ')');
      if (r.speicher2 !== 'r_1700000000001,r_1700000000003') f.push('gutartig: nach dem Speichern durch B fehlt im Speicher ein Eintrag (' + r.speicher2 + ')');
      if (r.a2.rezepte !== 'r_1700000000001' || r.a2.heil !== 'rem_1700000000002') f.push('gutartig: A findet nach dem Wiederanmelden nicht genau die eigenen Eintraege vor (' + JSON.stringify(r.a2) + ')');
      if (!r.a2_backup.fehler && (r.a2_backup.rezepte !== 'r_1700000000001' || r.a2_backup.heil !== 'rem_1700000000002')) f.push('gutartig: das Backup von A enthaelt nicht genau die eigenen Eintraege (' + JSON.stringify(r.a2_backup) + ')');
      if (r.b_vorgaben < r.vorgaben - 1) f.push('gutartig: B sieht weniger Vorgaben-Rezepte als A (' + r.b_vorgaben + ' statt ' + (r.vorgaben - 1) + ')');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'abgemeldet und fuer B: 0 eigene von A · im Speicher verborgen mit Stempel · A nach dem Wiederanmelden: beide da, B sieht ' + r.b_vorgaben + ' Vorgaben' };
    },
  },
];
