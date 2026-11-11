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
];
