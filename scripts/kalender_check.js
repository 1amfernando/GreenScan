#!/usr/bin/env node
// kalender_check.js — beantwortet der Kalender dieselbe Frage wie „Heute zu tun"?
//
//   node scripts/kalender_check.js
//
// Entwurf: docs/KALENDER-V1.md. Die eine Regel dort: es gibt EINE Frage —
// „was ist an diesem Tag?" — und EINE Funktion, die sie beantwortet
// (gsKalenderEreignisse). Der Kalender, „Heute zu tun" auf der Startseite,
// die Faellig-Liste, der Notizzettel und die Glocke sind Anzeigen derselben
// Antwort. Dieser Stand haelt das fest — und die drei Reparaturen, die mit
// dem Kalender kamen: Verschieben faelscht kein lastDone mehr, Abhaken
// steht im Gartentagebuch, beide Tagebuecher werden zusammen gelesen.
//
// Die Uhr wird GESTELLT (Playwright clock.setFixedTime), nicht abgewartet:
// kein Fall haengt am echten Datum. „Heute" ist `now` aus _seed.js plus zwoelf
// Stunden (1756684800000 = 1. September 2025, 12:00 UTC) — derselbe Tag, an
// dem die Beispieldaten ihre Aufgaben faellig haben (Basilikum seit einem Tag
// ueberfaellig, Tomate heute, Monstera in sechs Tagen). Das Jahr ist egal;
// die Beispieldaten sind relativ zu `now` gebaut. Der erste Lauf erwartete
// „September 2026" und war damit selbst der Fehler.
//
// Gemessen wird, was die Anzeige ZEIGT (gerendertes HTML), nicht das Objekt
// (Lehre aus v31.90) — und jede Reparatur hat eine Gegenprobe: ausgebaut
// muss der Fall rot werden.
'use strict';
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const HEUTE_MS = 1756684800000 + 12 * 3600 * 1000;   // `now` aus _seed.js + 12 h (2025-09-01 12:00 UTC)

const FAELLE = [
  {
    name: 'Grundlage · die Beispieldaten haben Aufgaben, Tagebuch und eine Pflanzung',
    lauf: () => {
      const n = (myPlants || []).filter(p => p && p.tasks && Object.keys(p.tasks).length).length;
      const tb = gsTagebuchLoad(true).length;
      const pl = (typeof plantings !== 'undefined' && Array.isArray(plantings)) ? plantings.length : 0;
      if (n < 3) return { ok: false, warum: 'nur ' + n + ' Pflanzen mit Aufgaben — bis v32.45 waren es 0, und alle Prüfstände massen eine leere Fällig-Liste' };
      if (!tb) return { ok: false, warum: 'kein Tagebuch-Eintrag in den Beispieldaten' };
      if (!pl) return { ok: false, warum: 'keine Garten-Pflanzung in den Beispieldaten' };
      const due = gsGetDueTasks();
      if (!due.length) return { ok: false, warum: 'gsGetDueTasks liefert nichts — die gestellte Uhr oder die Beispieldaten stimmen nicht' };
      return { ok: true, info: n + ' Pflanzen mit Aufgaben · ' + due.length + ' fällig/bald · ' + tb + ' Tagebuch · ' + pl + ' Pflanzung · heute ' + gsHeuteTag() };
    },
  },
  {
    name: 'Eine Antwort · „Heute zu tun" und der Kalender liefern dieselben Aufgaben',
    lauf: () => {
      const heute = gsHeuteTag();
      const due = gsGetDueTasks();                       // days <= 2
      const ev = gsKalenderEreignisse(heute, _gsKalTagPlus(heute, 2)).filter(e => e.art === 'aufgabe');
      const fehlt = [];
      due.forEach(t => {
        const tag = t.days <= 0 ? heute : _gsKalTagPlus(heute, t.days);
        const id = 'aufgabe:' + t.plant.id + ':' + t.key + ':' + tag;
        if (!ev.some(e => e.id === id)) fehlt.push(id);
      });
      if (fehlt.length) return { ok: false, warum: fehlt.length + ' Aufgaben aus „Heute zu tun" fehlen im Kalender: ' + fehlt.slice(0, 3).join(', ') };
      if (ev.length !== due.length) return { ok: false, warum: 'Kalender ' + ev.length + ' Aufgaben, „Heute zu tun" ' + due.length + ' — zwei Antworten auf eine Frage' };
      const ohneGrund = ev.filter(e => !e.grund || e.grund.length < 8);
      if (ohneGrund.length) return { ok: false, warum: ohneGrund.length + ' Aufgaben ohne Grund' };
      return { ok: true, info: due.length + ' Aufgaben, Eintrag für Eintrag gleich · Grund z.B. „' + ev[0].grund + '"' };
    },
  },
  {
    name: 'Verschieben · fälscht kein lastDone, und der Kalender sagt „verschoben"',
    lauf: () => {
      const p = myPlants.find(x => x && x.id === 'p3');
      if (!p || !p.tasks || !p.tasks.water) return { ok: false, warum: 'Probe-Pflanze p3 fehlt' };
      const vorher = p.tasks.water.lastDone;
      const heute = gsHeuteTag();
      if (!gsGetDueTasks().some(t => t.plant.id === 'p3' && t.key === 'water' && t.days <= 0)) return { ok: false, warum: 'Tomate giessen ist heute nicht fällig — Fall nicht hergestellt' };
      gsSnoozeTask('p3', 'water', 2);
      if (p.tasks.water.lastDone !== vorher) return { ok: false, warum: 'lastDone wurde verändert (' + vorher + ' → ' + p.tasks.water.lastDone + ') — die Geschichte ist gefälscht' };
      if (!p.tasks.water.snoozedUntil) return { ok: false, warum: 'snoozedUntil fehlt' };
      if (gsGetDueTasks().some(t => t.plant.id === 'p3' && t.key === 'water' && t.days <= 0)) return { ok: false, warum: 'die Aufgabe ist trotz Verschieben heute fällig' };
      const in2 = _gsKalTagPlus(heute, 2);
      const e = gsKalenderEreignisse(in2, in2).find(x => x.art === 'aufgabe' && x.pflanze.id === 'p3' && x.key === 'water');
      if (!e) return { ok: false, warum: 'die verschobene Aufgabe steht nicht in zwei Tagen im Kalender' };
      if (e.status !== 'verschoben' || !/verschoben/.test(e.grund)) return { ok: false, warum: 'der Kalender nennt die Verschiebung nicht (status=' + e.status + ', grund=' + e.grund + ')' };
      // Erledigen hebt die Verschiebung auf
      gsQuickDone('p3', 'water');
      if (p.tasks.water.snoozedUntil) return { ok: false, warum: 'nach dem Erledigen bleibt snoozedUntil stehen' };
      return { ok: true, info: 'lastDone unverändert · in 2 Tagen als „verschoben" · Erledigen räumt auf' };
    },
  },
  {
    name: 'Abhaken · steht im Gartentagebuch und im Kalender — ein Eintrag, zwei Ansichten',
    lauf: () => {
      const heute = gsHeuteTag();
      const vorher = gsTagebuchAlle().length;
      gsQuickDone('p1', 'water');
      const alle = gsTagebuchAlle();
      const neu = alle.find(e => e.pflanze_id === 'p1' && e.datum === heute && e.quelle === 'regel');
      if (!neu) return { ok: false, warum: 'das Abhaken erscheint nicht in gsTagebuchAlle (' + vorher + ' → ' + alle.length + ')' };
      if (alle.length !== vorher + 1) return { ok: false, warum: 'ein Abhaken, ' + (alle.length - vorher) + ' neue Einträge — doppelt geschrieben?' };
      const ev = gsKalenderEreignisse(heute, heute).find(e => e.art === 'tagebuch' && e.pflanze && e.pflanze.id === 'p1');
      if (!ev) return { ok: false, warum: 'der Kalender zeigt das Abhaken nicht am heutigen Tag' };
      // …und das Gartentagebuch RENDERT es (bis v32.45 sah es kein einziges Abhaken)
      openGartenTagebuch();
      const t = (document.getElementById('modal-content') || {}).textContent || '';
      if (!/Giessen/.test(t)) return { ok: false, warum: 'das Gartentagebuch zeigt den Abhaken-Eintrag nicht' };
      const global = gsTagebuchLoad(true).length;
      if (!new RegExp('Basilikum').test(t)) return { ok: false, warum: 'der Pflanzenname fehlt im Gartentagebuch' };
      return { ok: true, info: 'ein Eintrag (' + neu.text + ') · Kalender: ja · Gartentagebuch zeigt ihn · global weiterhin ' + global + ' Einträge, nichts kopiert' };
    },
  },
  {
    name: 'Anzeige · das Monatsraster und die Tagesliste werden aus dem HTML gelesen',
    lauf: () => {
      gsKalenderOeffnen();
      const mc = document.getElementById('modal-content');
      if (!mc) return { ok: false, warum: 'kein modal-content' };
      const heute = gsHeuteTag();
      const tage = mc.querySelectorAll('.gs-kal-tag');
      if (tage.length < 28 || tage.length > 31) return { ok: false, warum: tage.length + ' Tageskästchen statt 28–31' };
      const h = mc.querySelector('.gs-kal-tag.heute');
      if (!h) return { ok: false, warum: 'kein Kästchen trägt „heute"' };
      const erwartet = _GS_KAL_MON[+heute.slice(5, 7) - 1] + ' ' + heute.slice(0, 4);
      if (((mc.querySelector('.gs-kal-titel') || {}).textContent || '') !== erwartet) return { ok: false, warum: 'Monatstitel „' + (mc.querySelector('.gs-kal-titel') || {}).textContent + '" statt „' + erwartet + '"' };
      const ev = gsKalenderEreignisse(heute.slice(0, 7) + '-01', heute.slice(0, 7) + '-30');
      const tageMit = new Set(ev.map(e => e.datum));
      let ohnePunkt = 0;
      tageMit.forEach(tag => { const d = +tag.slice(8); const k = tage[d - 1]; if (!k || !k.querySelector('.gs-kal-p')) ohnePunkt++; });
      if (ohnePunkt) return { ok: false, warum: ohnePunkt + ' Tage mit Ereignissen ohne Punkt im Raster' };
      const heuteEv = ev.filter(e => e.datum === heute);
      const zeilen = mc.querySelectorAll('.gs-kal-zeile');
      if (zeilen.length !== heuteEv.length) return { ok: false, warum: 'Tagesliste zeigt ' + zeilen.length + ' Zeilen, der Tag hat ' + heuteEv.length + ' Ereignisse' };
      const boxen = mc.querySelectorAll('.gs-kal-box:not(.info)');
      const ohneName = Array.from(boxen).filter(b => !b.getAttribute('aria-label'));
      if (ohneName.length) return { ok: false, warum: ohneName.length + ' Kästchen ohne aria-label' };
      if (/undefined|NaN|\[object Object\]/.test(mc.textContent)) return { ok: false, warum: 'Platzhalter im Text' };
      // Tippen zeigt den Grund
      const z = mc.querySelector('.gs-kal-zeile');
      if (z) { gsKalGrund(z); const g = z.querySelector('.gs-kal-grund'); if (!g || g.hidden) return { ok: false, warum: 'Tippen zeigt den Grund nicht' }; }
      return { ok: true, info: tage.length + ' Tage · ' + tageMit.size + ' mit Punkten · heute ' + zeilen.length + ' Zeilen, ' + boxen.length + ' Kästchen benannt' };
    },
  },
  {
    name: 'Zugänge · Startseite, Meine Pflanzen und Menü-Suche führen zum Kalender',
    lauf: () => {
      const fehlt = [];
      gsRenderDayPlan();
      const hp = document.getElementById('home-dayplan');
      if (!hp || !hp.querySelector('[onclick*="gsKalenderOeffnen"]')) fehlt.push('Startseite („Heute zu tun")');
      const fav = document.getElementById('plants-due-section');
      if (!fav || !fav.querySelector('[onclick*="gsKalenderOeffnen"]')) fehlt.push('Meine Pflanzen (Fällig-Liste)');
      // MENU_ITEMS ist ein Skript-Bereichs-Name, NICHT auf window (dieselbe Falle wie socialPosts, CLAUDE.md §7.1)
      let menu = []; try { menu = MENU_ITEMS; } catch (_) { menu = window.MENU_ITEMS || []; }
      if (!(menu || []).some(m => /gsKalenderOeffnen/.test(String(m.action || '')))) fehlt.push('Menü-Suche');
      if (fehlt.length) return { ok: false, warum: 'ohne Zugang: ' + fehlt.join(', ') };
      return { ok: true, info: 'drei Zugänge verdrahtet' };
    },
  },
  {
    // v32.47 (Stufe 2): Garten-Pflanzungen hatten KEINE Pflege — „Heute zu tun"
    // kannte nur Zimmerpflanzen. Jetzt bekommen sie Aufgaben mit Vorgaben je
    // Gartenart, nachgeruestet beim ersten Lesen, lastDone = jetzt.
    name: 'Garten-Pflanzungen · bekommen Pflege-Aufgaben, und die Karte sagt, dass es eine Vorgabe ist',
    lauf: () => {
      const pl = (typeof plantings !== 'undefined' && Array.isArray(plantings)) ? plantings.find(x => x && x.id === 'plant_seed_1') : null;
      if (!pl) return { ok: false, warum: 'Probe-Pflanzung fehlt' };
      delete pl.tasks; delete pl._aufgaben_vorgabe;
      const due0 = gsGetDueTasks();                           // ruestet nach
      if (!pl.tasks || !pl.tasks.water) return { ok: false, warum: 'die Pflanzung hat nach gsGetDueTasks keine Aufgaben' };
      if (pl._aufgaben_vorgabe !== 'balkon') return { ok: false, warum: 'Vorgabe-Art ' + pl._aufgaben_vorgabe + ' statt balkon (Garten g1 ist ein Balkon)' };
      if (pl.tasks.water.intervalDays !== 2) return { ok: false, warum: 'Balkon-Vorgabe giessen = ' + pl.tasks.water.intervalDays + ' statt 2' };
      const d = _gsTaskDays(pl.tasks.water);
      if (d <= 0) return { ok: false, warum: 'frisch nachgeruestet und sofort faellig (' + d + ') — lastDone muss jetzt sein' };
      // in zwei Tagen steht sie im Kalender
      const in2 = _gsKalTagPlus(gsHeuteTag(), 2);
      const e = gsKalenderEreignisse(in2, in2).find(x => x.art === 'aufgabe' && x.pflanze.id === 'plant_seed_1' && x.key === 'water');
      if (!e) return { ok: false, warum: 'die Giess-Aufgabe der Pflanzung steht nicht in zwei Tagen im Kalender' };
      // Erledigen ueber denselben Weg wie Zimmerpflanzen, Speichern im Garten-Speicher
      gsQuickDone('plant_seed_1', 'water');
      const gespeichert = JSON.parse(localStorage.getItem('gs_plantings') || '[]').find(x => x.id === 'plant_seed_1');
      if (!gespeichert || !gespeichert.tasks || !gespeichert.tasks.water || gespeichert.tasks.water.lastDone !== pl.tasks.water.lastDone) return { ok: false, warum: 'das Erledigen kam nicht in gs_plantings an' };
      if (!(pl.diary || []).some(x => x.action === 'water')) return { ok: false, warum: 'kein Tagebuch-Eintrag an der Pflanzung' };
      // …und das Pflanzungs-Detail zeigt die Pflege
      openPlantingDetail('plant_seed_1');
      const t = (document.getElementById('pd2-body') || {}).textContent || '';
      if (!/Pflege/.test(t) || !/Vorgabe/.test(t)) return { ok: false, warum: 'das Pflanzungs-Detail zeigt keine Pflege mit Vorgabe-Hinweis' };
      return { ok: true, info: 'balkon: giessen 2 · in ' + d + ' Tagen · Erledigen → gs_plantings + Tagebuch · Detail nennt die Vorgabe' };
    },
  },
  {
    // v32.47: Ernte-Schaetzung (calcHarvestDate, existiert seit v13) als
    // Info-Ereignis — mit Grund, ohne Kaestchen. Und Regen nur mit Messwert.
    name: 'Ernte und Regen · Schätzung mit Grund, Wetter nur mit Messwert',
    lauf: () => {
      const pl = plantings.find(x => x && x.id === 'plant_seed_1');
      const h = calcHarvestDate(pl, null);
      const tag = _gsKalTag(h.harvestDate);
      const e = gsKalenderEreignisse(tag, tag).find(x => x.art === 'ernte' && x.pflanze.id === 'plant_seed_1');
      if (!e) return { ok: false, warum: 'kein Ernte-Ereignis am ' + tag };
      if (e.status !== 'info' || !/Schätzung/.test(e.grund)) return { ok: false, warum: 'die Ernte ist kein Info-Ereignis mit „Schätzung" im Grund' };
      gsKalenderOeffnenAm(tag);
      const mc = document.getElementById('modal-content');
      const zeile = Array.from(mc.querySelectorAll('.gs-kal-zeile')).find(z => /Ernte/.test(z.textContent));
      if (!zeile) return { ok: false, warum: 'die Tagesliste zeigt die Ernte nicht' };
      if (zeile.querySelector('.gs-kal-box:not(.info)')) return { ok: false, warum: 'die Ernte-Schaetzung hat ein Abhak-Kaestchen' };
      // Regen: ohne Wetter-Zwischenspeicher KEIN Ereignis
      localStorage.removeItem('gs_weather_cache');
      if (gsKalenderEreignisse(gsHeuteTag(), gsHeuteTag()).some(x => x.art === 'wetter')) return { ok: false, warum: 'Regen-Ereignis ohne Messwert' };
      return { ok: true, info: 'Ernte am ' + tag + ' als Info · ohne Wetterdaten kein Regen' };
    },
  },
  {
    // v32.47: Datum im Tagebuch-Formular — leer heisst heute, ein Datum in
    // der Zukunft wird zur Erinnerung im Kalender. Und die Pflanze bekommt
    // ihre Id, wenn der Name eindeutig ist.
    name: 'Tagebuch · ein Datum in der Zukunft wird zur Erinnerung, die Pflanze bekommt ihre Id',
    lauf: () => {
      openGartenTagebuch();
      const inp = document.getElementById('tb-input'), pl = document.getElementById('tb-plant'), dt = document.getElementById('tb-date');
      if (!inp || !pl || !dt) return { ok: false, warum: 'Formularfelder fehlen (tb-input/tb-plant/tb-date)' };
      const in5 = _gsKalTagPlus(gsHeuteTag(), 5);
      inp.value = 'Tomaten ausgeizen'; pl.value = 'Tomate'; dt.value = in5;
      gsTbAdd();
      const e = gsTagebuchLoad(true)[0];
      if (!e || e.text !== 'Tomaten ausgeizen') return { ok: false, warum: 'Eintrag nicht gespeichert' };
      if (e.pflanze_id !== 'p3') return { ok: false, warum: 'pflanze_id = ' + e.pflanze_id + ' statt p3 (Tomate ist eindeutig)' };
      if (_gsKalTag(e.ts) !== in5) return { ok: false, warum: 'Eintrag am ' + _gsKalTag(e.ts) + ' statt ' + in5 };
      const ev = gsKalenderEreignisse(in5, in5).find(x => x.pflanze && x.pflanze.id === 'p3' && /ausgeizen/.test(x.titel));
      if (!ev) return { ok: false, warum: 'der Eintrag steht nicht am gewaehlten Tag im Kalender' };
      if (ev.art !== 'erinnerung') return { ok: false, warum: 'ein Zukunfts-Eintrag ist „' + ev.art + '" statt „erinnerung"' };
      return { ok: true, info: 'am ' + in5 + ' als Erinnerung · pflanze_id p3' };
    },
  },
  {
    name: 'Aufräumen · buildPlantCard ist weg, gsNewPlantCard rendert',
    lauf: () => {
      if (typeof buildPlantCard === 'function') return { ok: false, warum: 'buildPlantCard existiert noch (nie aufgerufen, 60 Zeilen)' };
      if (typeof gsNewPlantCard !== 'function') return { ok: false, warum: 'gsNewPlantCard fehlt' };
      return { ok: true, info: 'tote Karte entfernt' };
    },
  },
  {
    // v32.49: das dritte Tagebuch (Cloud-Formular → garden_diary) in der
    // gemeinsamen Sicht — ueber einen Spiegel, der ohne Netz stehen bleibt.
    name: 'Cloud-Tagebuch · steht in der gemeinsamen Sicht, mit Pflanze, im Kalender — und ohne Netz bleibt der Spiegel',
    lauf: async () => {
      if (typeof gsCloudTagebuchLaden !== 'function') return { ok: false, warum: 'gsCloudTagebuchLaden fehlt' };
      const heute = gsHeuteTag(); const vorgestern = _gsKalTagPlus(heute, -2);
      localStorage.setItem('gs_sb_uid', 'pruef-uid');
      window.sbIsLoggedIn = () => true;
      window.sbFetch = async (pfad) => { window.__PFAD = pfad; return { data: [
        { id: 'c1', entry_type: 'pest', title: 'Blattläuse an der Tomate', text: 'wenige, abgestreift', species_lat: 'Solanum lycopersicum', created_at: new Date(vorgestern + 'T09:30:00').toISOString() },
        { id: 'c2', entry_type: 'general', title: '', text: 'Kompost umgesetzt', species_lat: '', created_at: new Date(heute + 'T07:00:00').toISOString() } ] }; };
      const n = await gsCloudTagebuchLaden();
      if (n !== 2) return { ok: false, warum: 'Loader liefert ' + n + ' statt 2' };
      if (!/garden_diary/.test(window.__PFAD) || !/user_id=eq\.pruef-uid/.test(window.__PFAD)) return { ok: false, warum: 'liest nicht die eigenen Zeilen aus garden_diary: ' + window.__PFAD };
      const alle = gsTagebuchAlle();
      const a = alle.find(e => e.id === 'cd:c1'), b = alle.find(e => e.id === 'cd:c2');
      if (!a || !b) return { ok: false, warum: 'Cloud-Einträge fehlen in gsTagebuchAlle' };
      if (a.pflanze_id !== 'p3') return { ok: false, warum: 'Solanum lycopersicum wird nicht der Tomate (p3) zugeordnet: ' + a.pflanze_id };
      if (a.herkunft !== 'cloud') return { ok: false, warum: 'herkunft ' + a.herkunft };
      const ev = gsKalenderEreignisse(vorgestern, vorgestern).find(e => e.id === 'tagebuch:cd:c1');
      if (!ev) return { ok: false, warum: 'der Cloud-Eintrag steht nicht an seinem Tag im Kalender' };
      // ohne Netz: der Spiegel bleibt
      window.sbFetch = async () => { throw new Error('offline'); };
      const m = await gsCloudTagebuchLaden();
      if (m !== null) return { ok: false, warum: 'ohne Netz liefert der Loader ' + m + ' statt null' };
      if (!gsTagebuchAlle().some(e => e.id === 'cd:c1')) return { ok: false, warum: 'ohne Netz ist der Spiegel weg' };
      openGartenTagebuch();
      const t = (document.getElementById('modal-content') || {}).textContent || '';
      if (!/Blattläuse/.test(t)) return { ok: false, warum: 'das Gartentagebuch zeigt den Cloud-Eintrag nicht' };
      return { ok: true, info: '2 Cloud-Einträge · Tomate → p3 · im Kalender · Spiegel überlebt Offline · Gartentagebuch zeigt ihn' };
    },
  },
  {
    // v32.49 (Audit-Befund 7): der Notizzettel klebte bei 1–3 faelligen Aufgaben
    // genau ueber dem Pfeil der ersten Pflanzenkarte. Gemessen bei 412 px.
    name: 'Notizzettel · verdeckt bei 0, 1, 3 und 8 fälligen Aufgaben keinen Karten-Pfeil',
    lauf: () => {
      try { switchTab('favs'); } catch (_) {}
      const heute = Date.now(); const bsp = [];
      for (const n of [0, 1, 3, 8]) {
        let k = 0;
        myPlants.forEach(p => Object.keys(p.tasks || {}).forEach(key => { p.tasks[key].lastDone = new Date(heute).toISOString(); delete p.tasks[key].snoozedUntil; }));
        myPlants.forEach(p => Object.keys(p.tasks || {}).forEach(key => { if (k < n) { p.tasks[key].lastDone = new Date(heute - 30 * 86400000).toISOString(); k++; } }));
        if (n >= 8) myPlants.forEach(p => ['repot', 'rotate', 'mist', 'dust', 'prune'].forEach(key => { if (k < n) { p.tasks[key] = { active: true, intervalDays: 7, lastDone: new Date(heute - 30 * 86400000).toISOString() }; k++; } }));
        renderMyPlants(); try { gsRenderTaskNote(); } catch (_) {}
        const note = document.getElementById('gs-task-note'); const nr = note ? note.getBoundingClientRect() : null;
        const sichtbar = nr && getComputedStyle(note).display !== 'none' && nr.width > 0;
        if (n > 0 && !sichtbar) return { ok: false, warum: 'bei ' + n + ' fälligen Aufgaben ist der Zettel nicht sichtbar — Fall nicht hergestellt' };
        const chevs = Array.from(document.querySelectorAll('[id^="chev-"]')).map(el => el.getBoundingClientRect());
        const ueber = sichtbar ? chevs.filter(c => c.bottom > nr.top && c.top < nr.bottom && c.right > nr.left) : [];
        if (ueber.length) return { ok: false, warum: 'bei ' + n + ' fälligen Aufgaben verdeckt der Zettel ' + ueber.length + ' Karten-Pfeil(e)' };
        bsp.push(n + ':' + (sichtbar ? 'frei' : '–'));
      }
      return { ok: true, info: bsp.join(' · ') };
    },
  },
  {
    name: 'Ohne Daten · keine Pflanzen, kein Tagebuch → ein leerer Kalender, der es sagt',
    lauf: () => {
      // v32.49: das Cloud-Tagebuch ist die dritte Quelle — ein „ohne Daten",
      // das sie stehen laesst, prueft nicht „ohne Daten" (der Fall wurde rot,
      // sobald der Spiegel existierte: „1 Ereignis ohne Datengrundlage").
      const sichern = { mp: myPlants, pl: (typeof plantings !== 'undefined') ? plantings : null, tb: localStorage.getItem('gs_gartentagebuch'), cloud: localStorage.getItem('gs_garden_diary_cache') };
      try {
        myPlants = []; if (typeof plantings !== 'undefined') plantings = [];
        localStorage.setItem('gs_gartentagebuch', '[]'); gsTagebuchLoad(true);
        localStorage.removeItem('gs_garden_diary_cache');
        const ev = gsKalenderEreignisse(gsHeuteTag(), _gsKalTagPlus(gsHeuteTag(), 30));
        if (ev.length) return { ok: false, warum: ev.length + ' Ereignisse ohne jede Datengrundlage' };
        gsKalenderOeffnen();
        const t = (document.getElementById('modal-content') || {}).textContent || '';
        if (!/Nichts an diesem Tag/.test(t)) return { ok: false, warum: 'die leere Tagesliste sagt nichts' };
        return { ok: true, info: '0 Ereignisse · „Nichts an diesem Tag."' };
      } finally {
        myPlants = sichern.mp; if (sichern.pl) plantings = sichern.pl;
        if (sichern.tb != null) localStorage.setItem('gs_gartentagebuch', sichern.tb); gsTagebuchLoad(true);
        if (sichern.cloud != null) localStorage.setItem('gs_garden_diary_cache', sichern.cloud);
      }
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
  await p.clock.setFixedTime(HEUTE_MS);          // die Uhr wird gestellt, nicht abgewartet
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {};
    window.gsRpcTaskDone = () => {}; window.scheduleAllNotifications = () => {};
  });

  console.log('\n=== kalender_check — beantwortet der Kalender dieselbe Frage wie „Heute zu tun"?');
  const stand = await p.evaluate(() => ({ heute: gsHeuteTag(), uhr: new Date().toISOString() }));
  console.log('  gestellte Uhr: ' + stand.uhr + ' · heute = ' + stand.heute);
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
  console.log('  Grenze: der Server-Cron (v_plant_tasks_due) kennt snoozedUntil erst nach der Migration');
  console.log('  20260903_plant_tasks_due_snooze.sql; das Cloud-Tagebuch (garden_diary) ist noch nicht in der Sicht.');
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
