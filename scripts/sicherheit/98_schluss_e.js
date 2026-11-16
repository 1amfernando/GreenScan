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
      const nichtLeer = Object.keys(r.nachAbmelden.var).filter(k => r.nachAbmelden.var[k] !== '[]')
        .concat(Object.keys(r.nachAbmelden.cache).filter(k => r.nachAbmelden.cache[k] !== null));
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
];
