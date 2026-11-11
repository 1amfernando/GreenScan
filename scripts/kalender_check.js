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

// Fester Zeitpunkt (2025-09-01 12:00 UTC). Seit v33.02 ankert _seed.js auf
// Mitternacht von `Date.now()` — und weil setFixedTime VOR addInitScript
// laeuft, ist das hier genau diese Konstante. Die Beispieldaten sehen fuer
// diesen Pruefstand also unveraendert aus; fuer die 29 anderen, die die Uhr
// laufen lassen, waren sie bis v33.01 ueber ein Jahr alt.
const HEUTE_MS = 1756684800000 + 12 * 3600 * 1000;

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
      // v32.51: und MIT Messwert der Hinweis an der Giess-Aufgabe. Bis v32.50
      // kannte dieser Fall nur die Verneinung — und der Draht war seit v31.84
      // tot: gsPflanzeDraussen las p.location, ein Feld, das nie jemand
      // schreibt. Jetzt beantwortet die Gartenart die Frage (unter_glas).
      // Eine Frage, die nur den schlechten Fall kennt, ist auch dann gruen,
      // wenn die Funktion nichts mehr tut.
      const heute = gsHeuteTag();
      const zeiten = [], regen = [];
      for (let h = 0; h < 24; h++) { zeiten.push(heute + 'T' + String(h).padStart(2, '0') + ':00'); regen.push(h === 6 ? 3 : h === 9 ? 5 : 0); }
      const zucP = plantings.find(x => x && x.id === 'plant_seed_1');
      const merk = zucP && zucP.tasks && zucP.tasks.water ? zucP.tasks.water.lastDone : undefined;
      try {
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { hourly: { time: zeiten, precipitation: regen } } }));
        if (zucP && zucP.tasks && zucP.tasks.water) zucP.tasks.water.lastDone = new Date(Date.now() - 3 * 864e5).toISOString();
        const faellig = gsGetDueTasks();
        const zuc = faellig.find(x => x.plant && x.plant.id === 'plant_seed_1' && x.key === 'water');
        const bas = faellig.find(x => x.plant && x.plant.id === 'p1' && x.key === 'water');
        if (!zuc) return { ok: false, warum: 'Zucchini (Balkon-Garten) hat keine fällige Giess-Aufgabe — Grundlage fehlt' };
        if (!zuc.regen || zuc.regen.mm !== 8) return { ok: false, warum: 'Zucchini steht im Balkon-Garten (unter_glas:false), 8 mm Regen im Zwischenspeicher — der Eintrag trägt ' + JSON.stringify(zuc.regen || null) + ' (toter Draht?)' };
        if (bas && bas.regen) return { ok: false, warum: 'Basilikum (Küchenfenster, drinnen) bekommt einen Regen-Hinweis' };
        if (gsPflanzeDraussen({ gardenId: 'g_nicht_da' }) !== null) return { ok: false, warum: 'unbekannter Garten muss null ergeben, nicht ' + gsPflanzeDraussen({ gardenId: 'g_nicht_da' }) };
        if (gsPflanzeDraussen({ gardenId: 'g1', location: 'Wohnzimmer' }) !== true) return { ok: false, warum: 'Pflanzung im Balkon-Garten: die Gartenart muss vor dem Freitext gelten' };
        gsRenderDayPlan();
        const dp = document.getElementById('home-dayplan');
        if (!dp || !/8 mm Regen heute/.test(dp.textContent)) return { ok: false, warum: '„Nächste Schritte" zeigt „8 mm Regen heute" nicht (aus dem HTML gelesen)' };
        if (!gsKalenderEreignisse(heute, heute).some(x => x.art === 'wetter' && /8 mm/.test(x.titel))) return { ok: false, warum: 'kein Wetter-Ereignis „8 mm" im Kalender' };
      } finally {
        localStorage.removeItem('gs_weather_cache');
        if (zucP && zucP.tasks && zucP.tasks.water) { zucP.tasks.water.lastDone = merk; try { saveGardenData(); } catch (_) {} }
      }
      return { ok: true, info: 'Ernte am ' + tag + ' als Info · ohne Wetter kein Regen · mit 8 mm: Zucchini (Balkon) ja, Basilikum (Fenster) nein, Tagesplan zeigt es' };
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
    // v32.50 (gegnerische Pruefung 04.09.): „Drei Kopfzahlen … aus denselben Daten"
    // stimmte nicht — total = myPlants.length, faellig/versorgt ueber beide Listen:
    // „3 · 4 · 1". Und mit myPlants = [] und einer Pflanzung: „0 · 1 · 0", darunter
    // „Noch keine Pflanzen".
    name: 'Kopfzahlen · alle drei zählen dieselben Listen, und ohne Zimmerpflanzen sagt der Reiter, wo die Pflanzen stehen',
    lauf: () => {
      try { switchTab('favs'); } catch (_) {}
      const sichern = myPlants;
      const pl = (typeof plantings !== 'undefined' && Array.isArray(plantings)) ? plantings : [];
      const z = pl.find(x => x && x.id === 'plant_seed_1');
      if (!z) return { ok: false, warum: 'Probe-Pflanzung plant_seed_1 fehlt' };
      const zVorher = (z.tasks && z.tasks.water) ? z.tasks.water.lastDone : null;
      const lesen = () => ({ total: +document.querySelector('#plants-stat-total div').textContent, due: +document.getElementById('plants-due-count').textContent, ok: +document.getElementById('plants-ok-count').textContent });
      try {
        renderMyPlants();
        const a = lesen();
        if (a.total !== myPlants.length + pl.length) return { ok: false, warum: 'Kopfzahl „Pflanzen" = ' + a.total + ', es sind ' + myPlants.length + ' + ' + pl.length + ' — „fällig" und „versorgt" zählen beide Listen, die Summe nur eine' };
        const mitAufgaben = new Set(gsGetDueTasks().map(t => t.plant.id)).size;
        if (a.ok + mitAufgaben !== a.total) return { ok: false, warum: '„gut versorgt" ' + a.ok + ' + Pflanzen mit Aufgaben ' + mitAufgaben + ' ≠ „Pflanzen" ' + a.total + ' — nicht aus denselben Daten' };
        // Ohne Zimmerpflanzen, mit einer faelligen Garten-Pflanzung
        if (!z.tasks || !z.tasks.water) return { ok: false, warum: 'die Pflanzung hat keine Giess-Aufgabe (Nachruestung fehlt)' };
        myPlants = [];
        z.tasks.water.lastDone = new Date(Date.now() - 30 * 86400000).toISOString(); delete z.tasks.water.snoozedUntil;
        renderMyPlants();
        const b = lesen();
        const txt = (document.getElementById('mp-list') || {}).textContent || '';
        if (b.total !== pl.length) return { ok: false, warum: 'ohne Zimmerpflanzen: Kopfzahl ' + b.total + ' statt ' + pl.length };
        if (/Noch keine Pflanzen/.test(txt)) return { ok: false, warum: 'ohne Zimmerpflanzen, mit ' + pl.length + ' Pflanzung: „Noch keine Pflanzen" — daneben die Kopfzahl ' + b.total };
        if (!/Garten/.test(txt)) return { ok: false, warum: 'der Leerzustand sagt nicht, wo die Pflanzen stehen' };
        const sec = document.getElementById('plants-due-section');
        if (!sec || getComputedStyle(sec).display === 'none') return { ok: false, warum: 'die Aufgaben-Sektion ist ausgeblendet, obwohl die Pflanzung fällig ist' };
        if (b.due < 1) return { ok: false, warum: '„heute fällig" = ' + b.due + ' trotz fälliger Pflanzung' };
        return { ok: true, info: 'mit Zimmerpflanzen ' + a.total + ' · ' + a.due + ' · ' + a.ok + ' (' + mitAufgaben + ' mit Aufgaben) · ohne: ' + b.total + ' · ' + b.due + ' · ' + b.ok + ', Leerzustand führt zum Garten' };
      } finally {
        myPlants = sichern;
        if (z.tasks && z.tasks.water && zVorher) z.tasks.water.lastDone = zVorher;
        renderMyPlants();
      }
    },
  },
  {
    // v32.50 (gegnerische Pruefung 04.09.): „Er bleibt, weil er eine Rueckfrage hat —
    // geprueft, nicht angenommen." Es gab keine (0 Aufrufe von gsConfirmModal), und
    // der Knopf lief nur ueber myPlants: Zucchini:water blieb nach dem Tipp faellig.
    name: 'Alle erledigt ✓ · fragt zuerst, nennt die Aufgaben, und erledigt in BEIDEN Listen',
    lauf: () => {
      const heute = Date.now();
      const pl = (typeof plantings !== 'undefined' && Array.isArray(plantings)) ? plantings : [];
      myPlants.concat(pl).forEach(p => Object.keys((p && p.tasks) || {}).forEach(k => { p.tasks[k].lastDone = new Date(heute).toISOString(); delete p.tasks[k].snoozedUntil; }));
      const p1 = myPlants.find(x => x && x.id === 'p1'), z = pl.find(x => x && x.id === 'plant_seed_1');
      if (!p1 || !p1.tasks || !p1.tasks.water || !z || !z.tasks || !z.tasks.water) return { ok: false, warum: 'Probe-Pflanzen p1 / plant_seed_1 mit Giess-Aufgabe fehlen' };
      p1.tasks.water.lastDone = new Date(heute - 30 * 86400000).toISOString();
      z.tasks.water.lastDone = new Date(heute - 30 * 86400000).toISOString();
      const faellig = () => gsGetDueTasks().filter(t => t.days <= 0);
      if (faellig().length !== 2) return { ok: false, warum: faellig().length + ' fällig statt 2 — Fall nicht hergestellt' };
      const orig = window.gsConfirmModal; let fragen = 0, frage = null;
      const warte = () => new Promise(res => setTimeout(res, 80));
      window.gsConfirmModal = o => { fragen++; frage = o; return Promise.resolve(false); };
      gsDoneAllDue();
      return warte().then(() => {
        if (!fragen) { window.gsConfirmModal = orig; return { ok: false, warum: '„Alle erledigt ✓" fragt nicht — bis v32.49 schrieb der Knopf ohne Rückfrage in jedes Tagebuch' }; }
        if (faellig().length !== 2) { window.gsConfirmModal = orig; return { ok: false, warum: 'nach „Abbrechen" wurde trotzdem erledigt (' + faellig().length + ' statt 2 fällig)' }; }
        const text = String((frage && (frage.message || frage.text)) || '');
        if (!/Basilikum/.test(text) || !/Zucchini/.test(text)) { window.gsConfirmModal = orig; return { ok: false, warum: 'die Rückfrage nennt nicht, was sie erledigt: „' + text.slice(0, 80) + '"' }; }
        window.gsConfirmModal = o => { fragen++; return Promise.resolve(true); };
        gsDoneAllDue();
        return warte().then(() => {
          window.gsConfirmModal = orig;
          const rest = faellig();
          if (rest.length) return { ok: false, warum: rest.map(t => t.plant.name + ':' + t.key).join(', ') + ' weiter fällig — der Knopf lief nur über myPlants' };
          let gesp = null; try { gesp = (JSON.parse(localStorage.getItem('gs_plantings') || '[]') || []).find(x => x && x.id === 'plant_seed_1'); } catch (_) {}
          if (!gesp || !gesp.tasks || !gesp.tasks.water || gesp.tasks.water.lastDone !== z.tasks.water.lastDone) return { ok: false, warum: 'die Garten-Pflanzung wurde erledigt, aber nicht gespeichert (saveGardenData fehlt)' };
          let gespP = null; try { gespP = (JSON.parse(localStorage.getItem('ps_myplants') || '[]') || []).find(x => x && x.id === 'p1'); } catch (_) {}
          if (!gespP || !gespP.tasks || !gespP.tasks.water || gespP.tasks.water.lastDone !== p1.tasks.water.lastDone) return { ok: false, warum: 'die Zimmerpflanze wurde erledigt, aber nicht gespeichert' };
          const tb = gsTagebuchAlle().filter(e => e.datum === gsHeuteTag() && (e.pflanze_id === 'p1' || e.pflanze_id === 'plant_seed_1'));
          if (tb.length < 2) return { ok: false, warum: 'nur ' + tb.length + ' Tagebuch-Einträge für zwei erledigte Aufgaben' };
          return { ok: true, info: 'nein → 2 bleiben fällig · ja → 0 fällig, beide Listen gespeichert, 2 Tagebuch-Einträge · die Frage nennt Basilikum und Zucchini (' + fragen + ' Rückfragen)' };
        });
      });
    },
  },
  {
    // v32.49 (Audit-Befund 7): der Notizzettel klebte bei 1–3 faelligen Aufgaben
    // genau ueber dem Pfeil der ersten Pflanzenkarte. Gemessen bei 412 px.
    name: 'Notizzettel · verdeckt bei 0, 1, 3 und 8 fälligen Aufgaben weder Pfeil noch Knopf',
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
        // v32.50: nicht nur der Pfeil — KEIN Bedienelement darf unter dem Zettel liegen.
        // Die gegnerische Pruefung (04.09.) fand die ⏰-Knoepfe der Faellig-Liste zu
        // 19–40 % verdeckt, waehrend der Pfeil-Fall gruen war: eine Frage, die nur
        // EIN Ziel kennt, meldet nur dieses. Schmale Ziele (≤ 120 px) muessen ganz
        // frei sein; breite (Karten, Zeilen) bleiben erreichbar, solange weniger als
        // ein Drittel verdeckt ist — dort landet der Daumen ohnehin links.
        if (sichtbar) {
          const bedien = Array.from(document.querySelectorAll('#screen-favs button, #screen-favs [role="button"], #screen-favs a[href], #screen-favs [onclick], #screen-favs [data-action]'))
            .filter(el => el.id !== 'gs-task-note' && !el.closest('#gs-task-note') && !el.closest('#gs-task-note-pop'))
            .map(el => ({ el, r: el.getBoundingClientRect() }))
            .filter(x => x.r.width > 0 && x.r.height > 0 && x.r.bottom > 0 && x.r.top < innerHeight);
          const verdeckt = bedien.map(x => {
            const w = Math.max(0, Math.min(x.r.right, nr.right) - Math.max(x.r.left, nr.left));
            const h = Math.max(0, Math.min(x.r.bottom, nr.bottom) - Math.max(x.r.top, nr.top));
            return { x, anteil: (w * h) / (x.r.width * x.r.height) };
          }).filter(v => v.anteil > (v.x.r.width <= 120 ? 0.02 : 0.34));
          if (verdeckt.length) return { ok: false, warum: 'bei ' + n + ' fälligen Aufgaben verdeckt der Zettel ' + verdeckt.length + ' Bedienelement(e): ' + verdeckt.slice(0, 3).map(v => String(v.x.el.className || v.x.el.tagName).split(' ')[0] + ' ' + Math.round(v.anteil * 100) + ' %').join(', ') };
          bsp.push(n + ':' + bedien.length + ' Ziele frei');
        } else bsp.push(n + ':–');
      }
      return { ok: true, info: bsp.join(' · ') };
    },
  },
  {
    // v32.56: Frost aus der VORHERSAGE (§11 Idee 10, Stufe 0) — ein Info-Ereignis
    // mit Quelle, Standort und Alter; nur heute und spaeter; 2 °C ist die Grenze
    // (dieselbe wie Startseite und Server-Push); ohne Tageswerte nichts.
    name: 'Frost · aus der Vorhersage: morgen 1.2 °C → Ereignis mit Quelle und Alter, 5 °C → keins, gestern → keins, ohne Tageswerte → keins',
    lauf: () => {
      const heute = gsHeuteTag(), morgen = _gsKalTagPlus(heute, 1), gestern = _gsKalTagPlus(heute, -1);
      const frost = (von, bis) => gsKalenderEreignisse(von, bis).filter(e => e.art === 'wetter' && /Frost/.test(e.titel));
      try {
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now() - 2 * 3600000, data: { daily: { time: [gestern, heute, morgen], temperature_2m_min: [0, 6.5, 1.2] } } }));
        const ev = frost(gestern, morgen);
        if (ev.length !== 1 || ev[0].datum !== morgen) return { ok: false, warum: ev.length + ' Frost-Ereignisse (erwartet 1, morgen): ' + JSON.stringify(ev.map(e => e.datum)) + ' — gestern (0 °C) darf keins erzeugen' };
        if (!/1\.2 °C/.test(ev[0].titel) || ev[0].status !== 'info' || !/Vorhersage/.test(ev[0].grund) || !/vor 2 h/.test(ev[0].grund) || !/kein Messwert/.test(ev[0].grund)) return { ok: false, warum: 'Titel/Grund: ' + ev[0].titel + ' — ' + ev[0].grund };
        gsKalenderOeffnenAm(morgen);
        if (!/Frost möglich/.test((document.getElementById('modal-content') || {}).textContent || '')) return { ok: false, warum: 'das Tagesblatt zeigt das Frost-Ereignis nicht (aus dem HTML gelesen)' };
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { daily: { time: [heute, morgen], temperature_2m_min: [6.5, 5] } } }));
        if (frost(heute, morgen).length) return { ok: false, warum: '5 °C erzeugt ein Frost-Ereignis' };
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { hourly: { time: [heute + 'T06:00'], precipitation: [0] } } }));
        if (frost(heute, morgen).length) return { ok: false, warum: 'ohne Tageswerte ein Frost-Ereignis' };
        return { ok: true, info: 'morgen 1.2 °C → „Frost möglich" mit Vorhersage-Quelle, Stand vor 2 h, im Tagesblatt · 5 °C → keins · gestern → keins · ohne Tageswerte → keins' };
      } finally { localStorage.removeItem('gs_weather_cache'); }
    },
  },
  {
    // v32.59: der Giess-Zettel (§11 Idee 13) — jede Faelligkeit im Fenster aus
    // BEIDEN Listen, aus derselben Rechnung wie „Heute zu tun", Intervall fuer
    // Intervall weiter; das Fenster sind die Stillen Tage, sonst 14 Tage; mit
    // Ort und Intervall; druckbar (das Druckfenster wird gestellt).
    name: 'Giess-Zettel · jede Fälligkeit im Abwesenheitsfenster, beide Listen, Ort und Intervall — Stille Tage als Fenster, druckbar',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_push_settings');
      const echtOpen = window.open; let gedruckt = '';
      try {
        localStorage.setItem('gs_push_settings', JSON.stringify({ pauseUntil: new Date(Date.now() + 10 * 864e5).toISOString() }));
        const f = gsGiessZettelFenster();
        if (f.quelle !== 'pause' || f.von !== heute || f.bis !== _gsKalTagPlus(heute, 10)) return { ok: false, warum: 'Fenster aus der Pause: ' + JSON.stringify(f) };
        const z = gsGiessZettel();
        const von = (name, key) => z.filter(x => x.pflanze === name && x.key === key).map(x => x.datum);
        // Basilikum: alle 3 Tage, seit gestern faellig → heute, +3, +6, +9
        const bas = von('Basilikum', 'water');
        if (JSON.stringify(bas) !== JSON.stringify([0, 3, 6, 9].map(d => _gsKalTagPlus(heute, d)))) return { ok: false, warum: 'Basilikum giessen: ' + JSON.stringify(bas) };
        if (!z.find(x => x.pflanze === 'Basilikum' && x.key === 'water' && x.datum === heute && x.ueberfaellig)) return { ok: false, warum: 'die überfällige Aufgabe ist nicht als „schon fällig" markiert' };
        // Tomate: alle 2 Tage, heute faellig → 0,2,4,6,8,10
        const tom = von('Tomate', 'water');
        if (tom.length !== 6 || tom[0] !== heute || tom[5] !== _gsKalTagPlus(heute, 10)) return { ok: false, warum: 'Tomate giessen: ' + JSON.stringify(tom) };
        // Zucchini (Pflanzung, Balkon-Garten, alle 2 Tage ab Nachruestung): dabei, mit dem Gartennamen als Ort
        const zuc = z.filter(x => x.pflanze === 'Zucchini' && x.key === 'water');
        if (!zuc.length || zuc.some(x => x.ort !== 'Balkon Süd' || x.liste !== 'plantings')) return { ok: false, warum: 'Zucchini fehlt oder ohne Gartennamen als Ort: ' + JSON.stringify(zuc.slice(0, 2)) };
        if (!z.find(x => x.pflanze === 'Basilikum' && x.ort === 'Küchenfenster')) return { ok: false, warum: 'der Ort der Zimmerpflanze fehlt' };
        const daten = z.map(x => x.datum);
        if (JSON.stringify(daten) !== JSON.stringify(daten.slice().sort())) return { ok: false, warum: 'nicht nach Datum sortiert' };
        if (z.some(x => x.datum < heute || x.datum > f.bis)) return { ok: false, warum: 'Einträge ausserhalb des Fensters' };
        if (z.some(x => !x.intervall || !x.aufgabe)) return { ok: false, warum: 'Zeile ohne Intervall oder Aufgabe' };
        gsGiessZettelOeffnen();
        const mc = document.getElementById('modal-content'); const t = mc.textContent;
        const zeilen = mc.querySelectorAll('#gs-zettel-tab tbody tr').length;
        if (zeilen !== z.length) return { ok: false, warum: zeilen + ' Zeilen im Fenster, ' + z.length + ' berechnet' };
        if (!/10 Tage, aus den Stillen Tagen/.test(t) || !/Küchenfenster/.test(t) || !/Balkon Süd/.test(t) || !/schon fällig/.test(t)) return { ok: false, warum: 'Fenstertext unvollständig: ' + t.slice(0, 200) };
        window.open = () => ({ document: { write: h => { gedruckt = h; }, close(){} }, focus(){}, print(){} });
        const html = gsGiessZettelDrucken();
        if (!gedruckt || gedruckt !== html) return { ok: false, warum: 'das Druckfenster bekam nichts' };
        if ((html.match(/<tr>/g) || []).length - 1 !== z.length || !/Giess-Zettel/.test(html) || !/Küchenfenster/.test(html)) return { ok: false, warum: 'Druckansicht: ' + ((html.match(/<tr>/g) || []).length - 1) + ' Zeilen' };
        // ohne Pause: 14 Tage Vorgabe
        localStorage.setItem('gs_push_settings', '{}');
        const f2 = gsGiessZettelFenster();
        if (f2.quelle !== 'vorgabe' || f2.bis !== _gsKalTagPlus(heute, 14)) return { ok: false, warum: 'ohne Pause kein 14-Tage-Fenster: ' + JSON.stringify(f2) };
        return { ok: true, info: z.length + ' Einträge in 10 Tagen · Basilikum 0/3/6/9 (schon fällig) · Tomate 6× · Zucchini aus dem Garten · sortiert · Fenster zeigt alle · Druck ' + z.length + ' Zeilen · ohne Pause 14 Tage' };
      } finally {
        window.open = echtOpen;
        if (alt != null) localStorage.setItem('gs_push_settings', alt); else localStorage.removeItem('gs_push_settings');
      }
    },
  },
  {
    // v32.85: `gsGetDueTasks` liefert alles bis `d <= 2` — drei Tage weit. Die
    // Karte zaehlte davon `tasks.length` unter dem Titel „Heute zu tun", also
    // 3 statt 1. Die ZEILEN waren immer ehrlich („Heute" / „Morgen" / „In 2
    // Tagen"), und der Notizzettel filtert an derselben Stelle laengst auf
    // `days <= 0`: zwei Anzeigen mit demselben Titel zaehlten verschieden.
    // Der Fall stellt drei Pflanzen mit EINDEUTIGER Faelligkeit her und liest
    // die gerenderte Ueberschrift — nicht das Objekt (v31.90).
    name: 'Heute zu tun · die Zahl gehört zum Titel: 1 heute, die Vorschau wird benannt — und der Kalender nennt für heute genau dieselbe Aufgabe',
    lauf: async () => {
      // Die Karte liest ihre Pflanzen aus dem SPEICHER, nicht aus der globalen
      // Variablen — wer nur `myPlants` setzt, misst die Beispieldaten weiter
      // (erster Lauf: „8 Aufgaben"). Beides stellen, beides zuruecksetzen.
      // Und `_gsPflanzungenNachruesten` baut die Pflanzungen beim Rendern aus
      // den GAERTEN neu auf (v32.47) — wer die stehen laesst, misst die
      // Beispielgaerten mit (zweiter Anlauf: „9 Aufgaben" bei drei Pflanzen).
      const sichern = { mp: myPlants, pl: (typeof plantings !== 'undefined') ? plantings : null,
                        ga: (typeof gardens !== 'undefined') ? gardens : null,
                        lsP: localStorage.getItem('ps_myplants'), lsG: localStorage.getItem('gs_plantings'),
                        lsGa: localStorage.getItem('gs_gardens') };
      const D = 86400000, n = Date.now(), iso = t => new Date(t).toISOString();
      try {
        myPlants = [
          { id: 'k-heute',  name: 'Heutig',  emoji: '🌿', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(n - 3 * D) } } },
          { id: 'k-morgen', name: 'Morgig',  emoji: '🌿', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(n - 2 * D) } } },
          { id: 'k-uebe',   name: 'Uebrig',  emoji: '🌿', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(n - 1 * D) } } },
        ];
        if (typeof plantings !== 'undefined') plantings = [];
        if (typeof gardens !== 'undefined') gardens = [];
        localStorage.setItem('ps_myplants', JSON.stringify(myPlants));
        localStorage.setItem('gs_plantings', '[]');
        localStorage.setItem('gs_gardens', '[]');
        const due = gsGetDueTasks();
        const tage = due.map(t => t.days).sort((a, b) => a - b);
        if (JSON.stringify(tage) !== '[0,1,2]')
          return { ok: false, warum: 'der Fall stellt die Faelligkeit nicht her: ' + JSON.stringify(tage) };

        // Was steht wirklich auf dem Bildschirm?
        // `gsBuildWidgetStack` baut VERZOEGERT (requestIdleCallback) — wer sofort
        // misst, liest den Stand vom Seitenaufbau mit den Beispieldaten. Warten,
        // bis die Karte die drei gestellten Pflanzen zeigt (v32.32: ein Element,
        // das gerade neu gebaut wird, wird erst NACH dem Bauen vermessen).
        if (typeof gsBuildWidgetStack === 'function') { try { gsBuildWidgetStack(); } catch (_) {} }
        let kopf = null;
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 50));
          kopf = document.querySelector('.gs-dp-head');
          const t = kopf ? (kopf.textContent || '') : '';
          if (/Heutig/.test((document.getElementById('gs-daily-plan') || document.body).textContent || '')) break;
        }
        if (!kopf) return { ok: false, warum: 'die Karte „Heute zu tun" wird nicht gerendert' };
        const txt = (kopf.textContent || '').replace(/\s+/g, ' ').trim();
        if (/\b3 Aufgaben\b/.test(txt))
          return { ok: false, warum: 'zaehlt drei Tage unter dem Titel „Heute": „' + txt + '"' };
        if (!/1 Aufgabe\b/.test(txt))
          return { ok: false, warum: 'nennt nicht die EINE heutige Aufgabe: „' + txt + '"' };
        if (!/2 in den n/.test(txt))
          return { ok: false, warum: 'die Vorschau wird nicht benannt: „' + txt + '"' };

        // Und die andere Haelfte: der Kalender nennt fuer heute dieselbe Aufgabe.
        const h = gsHeuteTag();
        const kal = (gsKalenderEreignisse(h, h) || []).filter(e => e.art === 'aufgabe');
        if (kal.length !== 1) return { ok: false, warum: 'der Kalender nennt ' + kal.length + ' Aufgaben fuer heute statt 1' };
        if (!/Heutig/.test(kal[0].titel || '')) return { ok: false, warum: 'der Kalender nennt eine andere: ' + kal[0].titel };
        // Die Vorschau-Zeilen bleiben — und sagen selbst, wann sie dran sind.
        const karte = (document.getElementById('gs-daily-plan') || document.body).textContent || '';
        if (!/Morgen/.test(karte) || !/In 2 Tagen/.test(karte))
          return { ok: false, warum: 'die Vorschau-Zeilen fehlen oder sagen ihren Tag nicht' };
        return { ok: true, info: 'Kopf „' + txt.replace(/📅.*$/, '').trim() + '" · Kalender heute: ' + kal[0].titel + ' · Zeilen: Heute/Morgen/In 2 Tagen' };
      } finally {
        myPlants = sichern.mp;
        if (sichern.pl && typeof plantings !== 'undefined') plantings = sichern.pl;
        if (sichern.lsP === null) localStorage.removeItem('ps_myplants'); else localStorage.setItem('ps_myplants', sichern.lsP);
        if (sichern.lsG === null) localStorage.removeItem('gs_plantings'); else localStorage.setItem('gs_plantings', sichern.lsG);
        if (sichern.ga && typeof gardens !== 'undefined') gardens = sichern.ga;
        if (sichern.lsGa === null) localStorage.removeItem('gs_gardens'); else localStorage.setItem('gs_gardens', sichern.lsGa);
        try { if (typeof gsBuildWidgetStack === 'function') gsBuildWidgetStack(); } catch (_) {}
      }
    },
  },
  {
    // v32.87 — dieselbe Frage wie der Fall darueber, einen Bildschirm weiter.
    // Gefunden beim Durchzaehlen JEDER sichtbaren Zahl mit ihrer Beschriftung:
    // die Kachel sagte 10, der Notizzettel daneben 9 — auf demselben Schirm,
    // im selben Moment. `renderMyPlants` schrieb `allDue.length`, und `allDue`
    // sammelt drei Tage weit.
    name: 'Meine Pflanzen · „HEUTE FÄLLIG" zählt heute — und sagt dasselbe wie der Notizzettel daneben',
    lauf: async () => {
      const sichern = { mp: myPlants, pl: (typeof plantings !== 'undefined') ? plantings : null,
                        ga: (typeof gardens !== 'undefined') ? gardens : null,
                        lsP: localStorage.getItem('ps_myplants'), lsG: localStorage.getItem('gs_plantings'),
                        lsGa: localStorage.getItem('gs_gardens') };
      const D = 86400000, n = Date.now(), iso = t => new Date(t).toISOString();
      try {
        myPlants = [
          { id: 'f-heute',  name: 'Heutig', emoji: '🌿', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(n - 3 * D) } } },
          { id: 'f-morgen', name: 'Morgig', emoji: '🌿', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(n - 2 * D) } } },
          { id: 'f-uebe',   name: 'Uebrig', emoji: '🌿', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(n - 1 * D) } } },
        ];
        if (typeof plantings !== 'undefined') plantings = [];
        if (typeof gardens !== 'undefined') gardens = [];
        localStorage.setItem('ps_myplants', JSON.stringify(myPlants));
        localStorage.setItem('gs_plantings', '[]');
        localStorage.setItem('gs_gardens', '[]');
        const due = gsGetDueTasks();
        const tage = due.map(t => t.days).sort((a, b) => a - b);
        if (JSON.stringify(tage) !== '[0,1,2]')
          return { ok: false, warum: 'der Fall stellt die Faelligkeit nicht her: ' + JSON.stringify(tage) };

        // Der Bildschirm muss AKTIV sein: der Notizzettel zeigt sich nur dort
        // (`onFavs`), und ein verborgener Vorfahre macht jede Messung wertlos.
        switchTab('favs');
        if (typeof renderMyPlants === 'function') renderMyPlants();
        let kachel = null;
        for (let i = 0; i < 40; i++) {
          await new Promise(r => setTimeout(r, 50));
          kachel = document.getElementById('plants-due-count');
          if (kachel && (kachel.textContent || '').trim() !== '0') break;
        }
        if (!kachel) return { ok: false, warum: '#plants-due-count gibt es nicht' };
        const gezeigt = parseInt((kachel.textContent || '').replace(/[^\d]/g, ''), 10);
        // Die Beschriftung aus dem DOM lesen, nicht annehmen.
        const kasten = document.getElementById('plants-stat-due');
        const beschriftung = kasten ? (kasten.textContent || '').replace(kachel.textContent, '').trim() : '';
        if (!/fällig/i.test(beschriftung))
          return { ok: false, warum: 'die Beschriftung heisst nicht mehr „fällig": „' + beschriftung + '"' };
        if (gezeigt === due.length && due.length !== 1)
          return { ok: false, warum: 'zählt drei Tage unter „' + beschriftung + '": ' + gezeigt + ' statt 1' };
        if (gezeigt !== 1)
          return { ok: false, warum: 'zeigt ' + gezeigt + ' unter „' + beschriftung + '", heute fällig ist 1' };

        // Und die zweite Haelfte: der Notizzettel auf DEMSELBEN Bildschirm
        // beantwortet dieselbe Frage — er darf nicht etwas anderes sagen.
        if (typeof gsRenderTaskNote === 'function') { try { gsRenderTaskNote(); } catch (_) {} }
        const zettel = document.getElementById('gs-task-note-cnt');
        const zZahl = zettel ? parseInt((zettel.textContent || '').replace(/[^\d]/g, ''), 10) : null;
        if (zZahl === null || isNaN(zZahl))
          return { ok: false, warum: 'der Notizzettel zeigt keine Zahl — der Fall misst nur die Haelfte' };
        if (zZahl !== gezeigt)
          return { ok: false, warum: 'zwei Zahlen auf einem Bildschirm: Kachel ' + gezeigt + ', Notizzettel ' + zZahl };

        // Die bald faelligen sind nicht verschwunden — die Ueberschrift nennt sie.
        const kopf = document.getElementById('plants-due-heading');
        const kt = kopf ? (kopf.textContent || '') : '';
        if (!/\(3\)/.test(kt))
          return { ok: false, warum: 'die Liste darunter nennt nicht alle drei: „' + kt.trim() + '"' };
        return { ok: true, info: '„' + beschriftung + '" ' + gezeigt + ' · Notizzettel ' + zZahl + ' · Liste „' + kt.trim() + '"' };
      } finally {
        myPlants = sichern.mp;
        if (sichern.pl && typeof plantings !== 'undefined') plantings = sichern.pl;
        if (sichern.ga && typeof gardens !== 'undefined') gardens = sichern.ga;
        if (sichern.lsP === null) localStorage.removeItem('ps_myplants'); else localStorage.setItem('ps_myplants', sichern.lsP);
        if (sichern.lsG === null) localStorage.removeItem('gs_plantings'); else localStorage.setItem('gs_plantings', sichern.lsG);
        if (sichern.lsGa === null) localStorage.removeItem('gs_gardens'); else localStorage.setItem('gs_gardens', sichern.lsGa);
        try { if (typeof renderMyPlants === 'function') renderMyPlants(); } catch (_) {}
      }
    },
  },
  {
    name: 'Heute im Kalender · die Startseite nennt heutige Aussaatfenster und Plan-Termine unter „Heute zu tun" — dieselbe Antwort wie der Kalender; ohne Ereignis keine Zeile; der Kopf zählt weiter nur Aufgaben',
    lauf: async () => {
      // v33.19. Bis dahin las die Startseite nur gsGetDueTasks — wer heute
      // säen konnte (v33.13) oder einen Plan-Termin hatte (v33.10), erfuhr es
      // dort nicht. Drei Zustände, beide Richtungen, gelesen aus dem HTML.
      const sichern = { mp: myPlants, pl: (typeof plantings !== 'undefined') ? plantings : null,
                        ga: (typeof gardens !== 'undefined') ? gardens : null,
                        lsP: localStorage.getItem('ps_myplants'), lsG: localStorage.getItem('gs_plantings'),
                        lsGa: localStorage.getItem('gs_gardens'), lsPl: localStorage.getItem('gs_garden_plans'),
                        // die Gegenrichtung braucht WIRKLICH keine Ereignisse: auch Geraete
                        // (alarm), Tagebuch (erinnerung) und Cloud-Spiegel raeumen — wie „Ohne Daten"
                        tb: localStorage.getItem('gs_gartentagebuch'), cloud: localStorage.getItem('gs_garden_diary_cache'),
                        ger: localStorage.getItem('gs_geraete'), mw: localStorage.getItem('gs_messwerte'), rg: localStorage.getItem('gs_geraete_regeln') };
      const h = gsHeuteTag();
      const ARTEN = ['aussaat', 'ernte', 'erinnerung', 'alarm', 'wetter'];
      try {
        // 1 · Feldsalat (Aussaatkalender: Aug/Sep, die Uhr steht auf dem 01.09.) + ein Plan,
        //     der heute vier Kulturen säen will, keine Aufgaben → „Alles versorgt" UND die Zeile
        myPlants = [{ id: 'hk1', name: 'Feldsalat', emoji: '🥬', tasks: {} }];
        if (typeof plantings !== 'undefined') plantings = [];
        if (typeof gardens !== 'undefined') gardens = [];
        localStorage.setItem('ps_myplants', JSON.stringify(myPlants));
        localStorage.setItem('gs_plantings', '[]'); localStorage.setItem('gs_gardens', '[]');
        localStorage.setItem('gs_garden_plans', JSON.stringify([{ id: 'hk-plan', created: h + 'T08:00:00.000Z', title: 'Herbstbeet',
          plan: { plants: [{ name: 'Spinat', sow_date: h }, { name: 'Radieschen', sow_date: h }, { name: 'Rucola', sow_date: h }, { name: 'Pak Choi', sow_date: h }] } }]));
        const kal = (gsKalenderEreignisse(h, h) || []).filter(e => ARTEN.indexOf(e.art) >= 0);
        if (kal.length < 4) return { ok: false, warum: 'der Fall stellt den Zustand nicht her: nur ' + kal.length + ' Kalender-Ereignisse für heute' };
        gsRenderDayPlan();
        const el = document.getElementById('home-dayplan');
        const zeile = el && el.querySelector('.gs-dp-kal-heute');
        const klagen = [];
        if (!zeile) return { ok: false, warum: 'keine Zeile „Heute im Kalender", obwohl der Kalender ' + kal.length + ' Ereignisse für heute kennt' };
        const txt = (zeile.textContent || '').replace(/\s+/g, ' ');
        if (String(zeile.getAttribute('data-n')) !== String(kal.length)) klagen.push('Zeile zählt ' + zeile.getAttribute('data-n') + ', der Kalender ' + kal.length);
        kal.slice(0, 3).forEach(e => { if (txt.indexOf(e.titel) < 0) klagen.push('Kalender-Ereignis fehlt in der Zeile: ' + e.titel); });
        if (kal.length > 3 && !/\+\d+ weitere/.test(txt)) klagen.push('mehr als drei Ereignisse, aber kein „+N weitere": „' + txt + '"');
        if (!/gsKalenderOeffnenAm/.test(zeile.getAttribute('onclick') || '')) klagen.push('Antippen öffnet nicht den Kalender am heutigen Tag');
        const kopf = (el.querySelector('.gs-dp-head') || {}).textContent || '';
        if (/Aufgabe/.test(kopf)) klagen.push('der Kopf zählt Kalender-Einträge als Aufgaben: „' + kopf + '"');
        if (!/Alles versorgt/.test(el.textContent || '')) klagen.push('„Alles versorgt" fehlt — der Zustand ohne Aufgaben muss bleiben');
        // 2 · Gegenrichtung: Monstera (keine Kultur), kein Plan → keine Zeile
        myPlants = [{ id: 'hk2', name: 'Monstera', emoji: '🌿', tasks: {} }];
        localStorage.setItem('ps_myplants', JSON.stringify(myPlants));
        localStorage.removeItem('gs_garden_plans');
        localStorage.setItem('gs_gartentagebuch', '[]'); gsTagebuchLoad(true);
        ['gs_garden_diary_cache', 'gs_geraete', 'gs_messwerte', 'gs_geraete_regeln'].forEach(k => localStorage.removeItem(k));
        const kal2 = (gsKalenderEreignisse(h, h) || []).filter(e => ARTEN.indexOf(e.art) >= 0);
        if (kal2.length) klagen.push('der Fall stellt „ohne Ereignis" nicht her: ' + kal2.map(e => e.art + ' ' + e.titel).join(', '));
        gsRenderDayPlan();
        if (!kal2.length && document.querySelector('#home-dayplan .gs-dp-kal-heute')) klagen.push('Zeile erscheint ohne ein einziges Ereignis');
        // 3 · mit Aufgaben: die Aufgaben-Zeilen bleiben, die Zeile steht UNTER der Karte
        const D = 86400000, n = Date.now(), iso = t => new Date(t).toISOString();
        myPlants = [{ id: 'hk3', name: 'Feldsalat', emoji: '🥬', tasks: { water: { active: true, intervalDays: 3, lastDone: iso(n - 3 * D) } } }];
        localStorage.setItem('ps_myplants', JSON.stringify(myPlants));
        gsRenderDayPlan();
        const el3 = document.getElementById('home-dayplan');
        const z3 = el3.querySelector('.gs-dp-kal-heute'), karte = el3.querySelector('.gs-dp-card');
        if (!z3) klagen.push('mit Aufgaben fehlt die Zeile (Feldsalat liegt im Fenster)');
        else if (!karte || !el3.querySelector('.gs-dp-row')) klagen.push('mit Aufgaben fehlen die Aufgaben-Zeilen');
        else if (!(karte.compareDocumentPosition(z3) & Node.DOCUMENT_POSITION_FOLLOWING)) klagen.push('die Zeile steht ÜBER der Aufgaben-Karte');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'ohne Aufgaben: „' + txt.slice(0, 100) + '" (' + kal.length + ' Ereignisse) · Monstera ohne Plan: keine Zeile · mit Aufgabe: Zeile unter der Karte' };
      } finally {
        myPlants = sichern.mp;
        if (sichern.pl && typeof plantings !== 'undefined') plantings = sichern.pl;
        if (sichern.ga && typeof gardens !== 'undefined') gardens = sichern.ga;
        if (sichern.lsP === null) localStorage.removeItem('ps_myplants'); else localStorage.setItem('ps_myplants', sichern.lsP);
        if (sichern.lsG === null) localStorage.removeItem('gs_plantings'); else localStorage.setItem('gs_plantings', sichern.lsG);
        if (sichern.lsGa === null) localStorage.removeItem('gs_gardens'); else localStorage.setItem('gs_gardens', sichern.lsGa);
        if (sichern.lsPl === null) localStorage.removeItem('gs_garden_plans'); else localStorage.setItem('gs_garden_plans', sichern.lsPl);
        if (sichern.tb != null) localStorage.setItem('gs_gartentagebuch', sichern.tb); gsTagebuchLoad(true);
        if (sichern.cloud != null) localStorage.setItem('gs_garden_diary_cache', sichern.cloud);
        if (sichern.ger != null) localStorage.setItem('gs_geraete', sichern.ger);
        if (sichern.mw != null) localStorage.setItem('gs_messwerte', sichern.mw);
        if (sichern.rg != null) localStorage.setItem('gs_geraete_regeln', sichern.rg);
        try { if (typeof gsBuildWidgetStack === 'function') gsBuildWidgetStack(); } catch (_) {}
      }
    },
  },
  {
    name: 'Ohne Daten · keine Pflanzen, kein Tagebuch → ein leerer Kalender, der es sagt',
    lauf: () => {
      // v32.49: das Cloud-Tagebuch ist die dritte Quelle — ein „ohne Daten",
      // das sie stehen laesst, prueft nicht „ohne Daten" (der Fall wurde rot,
      // sobald der Spiegel existierte: „1 Ereignis ohne Datengrundlage").
      // v32.52: die vierte Quelle sind die Geraete (messung/alarm) — seit die
      // Beispieldaten ein Geraet tragen, macht eine stehen gelassene Quelle den
      // Fall rot (CLAUDE.md §7.1: „eine, die er stehen laesst, macht ihn rot").
      const sichern = { mp: myPlants, pl: (typeof plantings !== 'undefined') ? plantings : null, tb: localStorage.getItem('gs_gartentagebuch'), cloud: localStorage.getItem('gs_garden_diary_cache'),
        ger: localStorage.getItem('gs_geraete'), mw: localStorage.getItem('gs_messwerte'), rg: localStorage.getItem('gs_geraete_regeln'),
        pla: localStorage.getItem('gs_garden_plans'),   // v33.10: fuenfte Quelle — die Plaene
        wc: localStorage.getItem('gs_weather_cache'),   // v33.34: sechste Quelle — der Wetter-Zwischenspeicher (seit dem Seed immer da)
        sh: localStorage.getItem('gs_scan_history'), mk: localStorage.getItem('greenscan_markers') };  // v33.37: siebte und achte
      try {
        myPlants = []; if (typeof plantings !== 'undefined') plantings = [];
        localStorage.setItem('gs_gartentagebuch', '[]'); gsTagebuchLoad(true);
        localStorage.removeItem('gs_garden_diary_cache');
        // v33.37: zwei weitere Quellen (Scan-Verlauf, Karten-Fundorte). Wer
        // eine anlegt und sie hier stehen laesst, macht den Fall rot — genau
        // so ist es beim Cloud-Spiegel (v32.49) und beim Geraet (v32.52)
        // passiert.
        ['gs_geraete', 'gs_messwerte', 'gs_geraete_regeln', 'gs_garden_plans', 'gs_weather_cache', 'gs_scan_history', 'greenscan_markers'].forEach(k => localStorage.removeItem(k));
        const ev = gsKalenderEreignisse(gsHeuteTag(), _gsKalTagPlus(gsHeuteTag(), 30));
        if (ev.length) return { ok: false, warum: ev.length + ' Ereignisse ohne jede Datengrundlage' };
        gsKalenderOeffnen();
        const t = (document.getElementById('modal-content') || {}).textContent || '';
        // v33.34 (KALENDER-V2 R8): ohne jede Quelle ist der dritte Leerzustand
        // faellig — „Noch keine Daten", nicht „Nichts an diesem Tag" (das
        // hiesse: Daten da, Tag leer). Zwei Saetze fuer zwei Wahrheiten.
        if (!/Noch keine Daten/.test(t)) return { ok: false, warum: 'ohne jede Datengrundlage sagt der Kalender nicht „Noch keine Daten": ' + (t.match(/Nichts an diesem Tag|Noch keine|ausgeblendet/) || ['(kein Leersatz)'])[0] };
        if (/Nichts an diesem Tag/.test(t)) return { ok: false, warum: '„Nichts an diesem Tag" und „Noch keine Daten" gleichzeitig' };
        // Und die Gegenrichtung zur sechsten Quelle: NUR eine Wettervorhersage
        // (die von selbst geladen wird) macht aus „Noch keine Daten" kein
        // „Nichts an diesem Tag" — sonst nimmt ein Abruf im Hintergrund der
        // Person die Aufforderung weg, ihre erste Pflanze anzulegen.
        // Der Zustand wird HERGESTELLT, nicht uebernommen: ein frueherer Fall
        // („Ernte und Regen") raeumt den Wetter-Zwischenspeicher und legt ihn
        // nicht zurueck — `sichern.wc` war hier NULL, und die Frage lief gar
        // nicht. Eine Gegenprobe, deren Aufbau still fehlschlaegt, sieht aus
        // wie eine bestandene (CLAUDE.md §7.1).
        const tg = [], tmin = [];
        for (let i = 0; i < 7; i++) { tg.push(_gsKalTagPlus(gsHeuteTag(), i)); tmin.push(8); }
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { daily: { time: tg, temperature_2m_min: tmin } } }));
        const lage = _gsKalDatenlage();
        gsKalenderOeffnen();
        const t2 = (document.getElementById('modal-content') || {}).textContent || '';
        localStorage.removeItem('gs_weather_cache');
        if (lage.length) return { ok: false, warum: 'eine blosse Wettervorhersage gilt als Datengrundlage: ' + JSON.stringify(lage) };
        if (!/Noch keine Daten/.test(t2)) return { ok: false, warum: 'mit einer Wettervorhersage (und sonst nichts) sagt der Kalender nicht mehr „Noch keine Daten": ' + (t2.match(/Nichts an diesem Tag|Noch keine Daten/) || ['(kein Leersatz)'])[0] };
        return { ok: true, info: '0 Ereignisse · „Noch keine Daten" — auch mit einer Wettervorhersage (Datenlage [])' };
      } finally {
        myPlants = sichern.mp; if (sichern.pl) plantings = sichern.pl;
        if (sichern.tb != null) localStorage.setItem('gs_gartentagebuch', sichern.tb); gsTagebuchLoad(true);
        if (sichern.cloud != null) localStorage.setItem('gs_garden_diary_cache', sichern.cloud);
        if (sichern.ger != null) localStorage.setItem('gs_geraete', sichern.ger);
        if (sichern.mw != null) localStorage.setItem('gs_messwerte', sichern.mw);
        if (sichern.rg != null) localStorage.setItem('gs_geraete_regeln', sichern.rg);
        if (sichern.pla != null) localStorage.setItem('gs_garden_plans', sichern.pla);
        if (sichern.wc != null) localStorage.setItem('gs_weather_cache', sichern.wc);
        if (sichern.sh != null) localStorage.setItem('gs_scan_history', sichern.sh);
        if (sichern.mk != null) localStorage.setItem('greenscan_markers', sichern.mk);
      }
    },
  },
  {
    name: 'Aussaat · aus den Kulturdaten: Basilikum und Zucchini bekommen ihre Fenster, Monstera keins — Grund nennt den Aussaatkalender und die Lagen; season der Artenliste wird NICHT dafuer verwendet',
    lauf: () => {
      // v33.13 · KALENDER-V1 2b. Beide Richtungen: eine Kultur aus dem
      // Aussaatkalender liefert ihre Fenster, eine Zimmerpflanze ohne Kultur
      // liefert nichts. Und die Gegenrichtung zur Datenfrage: eine Art mit
      // `season` (Sammelsaison), die keine Kultur ist, darf KEIN Aussaat-
      // Ereignis bekommen.
      const J = gsHeuteTag().slice(0, 4);
      const mp0 = window.myPlants;
      try {
        window.myPlants = [
          { id: 'sa1', name: 'Basilikum', tasks: {} },
          { id: 'sa2', name: 'Zucchini', tasks: {} },
          { id: 'sa3', name: 'Monstera', tasks: {} },
          { id: 'sa4', name: 'Rüebli', tasks: {} },                                  // Schweizer Name → Möhren
          { id: 'sa5', name: 'Heidelbeere', species: 'Vaccinium myrtillus', tasks: {} },   // Wildart mit season, keine Kultur
        ];
        const ev = gsKalenderEreignisse(J + '-01-01', J + '-12-31').filter(e => e.art === 'aussaat' && e.quelle === 'kulturdaten');
        // je KULTUR (Titel beginnt mit dem Kultur-Namen); die Beispieldaten
        // haben eine zweite Zucchini als Garten-Pflanzung — es darf trotzdem
        // nur EINE Zeile je Monat geben, und die nennt beide Pflanzen.
        const je = n => ev.filter(e => e.titel.indexOf(n) === 0);
        const klagen = [];
        const bas = je('Basilikum'), zuc = je('Zucchini'), mon = je('Monstera'), rue = je('Möhren'), hei = je('Heidelbeere');
        if (zuc.length && !/betrifft:.*Zucchini.*Zucchini/.test(zuc[0].grund)) klagen.push('die Zucchini-Zeile nennt nicht beide Zucchini-Pflanzen: ' + zuc[0].grund.slice(-80));
        const kB = _gsSaeZuPflanze({ name: 'Basilikum' }), kZ = _gsSaeZuPflanze({ name: 'Zucchini' });
        if (!kB || !kZ) klagen.push('Matcher findet Basilikum/Zucchini nicht');
        const soll = k => (k ? ((k.indoor || []).length + (k.outdoor || []).length) : -1);
        if (kB && bas.length !== soll(kB)) klagen.push('Basilikum: ' + bas.length + ' Ereignisse statt ' + soll(kB));
        if (kZ && zuc.length !== soll(kZ)) klagen.push('Zucchini: ' + zuc.length + ' statt ' + soll(kZ));
        if (mon.length) klagen.push('Monstera bekam ' + mon.length + ' Aussaat-Ereignisse — ist keine Kultur');
        if (!rue.length) klagen.push('Rüebli (Schweizer Name) nicht zu Möhren zugeordnet');
        if (rue.length && !/Rüebli/.test(rue[0].grund)) klagen.push('Möhren-Zeile nennt Rüebli nicht als betroffene Pflanze');
        if (hei.length) klagen.push('Heidelbeere bekam Aussaat-Ereignisse aus `season` — das ist eine Sammelsaison');
        // jedes Ereignis: Tag = 1. des Monats, info, Grund nennt Kalender + Lagen, Verweis
        ev.forEach(e => {
          if (!/-01$/.test(e.datum)) klagen.push(e.titel + ' nicht am 1. des Monats: ' + e.datum);
          if (e.status !== 'info') klagen.push(e.titel + ' ist kein info-Ereignis');
          if (!/Aussaatkalender/.test(e.grund) || !/400–800 m/.test(e.grund)) klagen.push(e.titel + ': Grund nennt Kalender oder Lagen nicht');
          if (!e.verweis || e.verweis.fn !== 'openSaekalender') klagen.push(e.titel + ' ohne Verweis auf den Säkalender');
        });
        if (!ev.some(e => /vorziehen \(drinnen\)/.test(e.titel)) || !ev.some(e => /säen \(draussen\)/.test(e.titel))) klagen.push('drinnen/draussen nicht beide vertreten');
        // Anzeige: die Tagesliste am ersten Basilikum-Tag zeigt die Zeile
        if (bas.length) {
          gsKalenderOeffnenAm(bas[0].datum);
          const t = (document.getElementById('modal-content') || {}).textContent || '';
          if (!/Basilikum/.test(t)) klagen.push('Tagesliste am ' + bas[0].datum + ' zeigt Basilikum nicht');
          try { closeModal('detail-modal'); } catch (_) {}
        }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'Basilikum ' + bas.length + ' · Zucchini ' + zuc.length + ' · Rüebli→Möhren ' + rue.length + ' · zwei Zucchini → eine Zeile, beide genannt · Monstera 0 · Heidelbeere (season) 0 · alle am 1., info, mit Kalender, Lagen und Verweis · Tagesliste zeigt Basilikum' };
      } finally { window.myPlants = mp0; }
    },
  },
  {
    name: 'Plan · ein gespeicherter Garten-Plan wird zum Kalender: Aussaat, Erntefenster, Zeitleiste — mit Herkunft; ohne Daten nichts',
    lauf: () => {
      // v33.10 · PLANER-V3 N8. Der Fall laeuft IN der Seite (die Uhr steht auf
      // dem 01.09.2025), also ist der Musterplan hier ein Literal und traegt
      // Daten des Uhr-Jahres. Beide Richtungen: der Plan MUSS Termine liefern,
      // und ein Plan ohne Datumsfelder DARF keine liefern.
      const J = gsHeuteTag().slice(0, 4);
      const alt = localStorage.getItem('gs_garden_plans');
      try {
        const plan = {
          summary: 'Musterplan fuer den Kalender-Fall', bed: { width_m: 4, length_m: 3 },
          plants: [
            { name: 'Tomate', icon: '🍅', sow_date: J + '-04-05', harvest_from: J + '-07-15', harvest_to: J + '-09-30', depth_cm: 2, spacing_cm: 60 },
            { name: 'Kohlrabi', icon: '🥬', sow_date: J + '-04-01', harvest_from: J + '-06-15', harvest_to: J + '-07-10' },
            { name: 'Buschbohne', icon: '🫘', sow_date: J + '-05-15', harvest_from: J + '-07-25', harvest_to: J + '-09-05' },
          ],
          timeline: [ { week: 14, action: 'Vorkultur ansetzen', who: 'Tomate' }, { week: 20, action: 'Auspflanzen', who: 'Tomate' }, { week: 30, action: 'Erste Ernte', who: 'Buschbohne' } ],
        };
        // Zweimal derselbe Plan (LS + Cloud-Abgleich mit gp_-Id) — darf nichts verdoppeln
        localStorage.setItem('gs_garden_plans', JSON.stringify([
          { id: 'plan-1', created: J + '-03-01T10:00:00.000Z', title: 'Plan vom 01.03. · Sonnenbeet', plan: plan },
          { id: 'gp_plan-1', created: J + '-03-01T10:00:00.000Z', title: 'Plan vom 01.03. · Sonnenbeet', plan: plan },
          { id: 'plan-leer', created: J + '-03-02T10:00:00.000Z', title: 'Ohne Daten', plan: { summary: 'nur Text', plants: [{ name: 'Salat' }], timeline: [{ week: 22, action: 'irgendwas' }] } },
        ]));
        const ev = gsKalenderEreignisse(J + '-01-01', J + '-12-31').filter(e => e.quelle === 'plan');
        const aussaat = ev.filter(e => e.art === 'aussaat'), ernte = ev.filter(e => e.art === 'ernte'), erinn = ev.filter(e => e.art === 'erinnerung');
        const klagen = [];
        if (aussaat.length !== 3) klagen.push('Aussaat: ' + aussaat.length + ' statt 3 (Dublette oder Luecke)');
        if (ernte.length !== 6) klagen.push('Erntefenster-Grenzen: ' + ernte.length + ' statt 6');
        if (erinn.length !== 3) klagen.push('Zeitleiste: ' + erinn.length + ' statt 3');
        const tom = aussaat.find(e => /Tomate/.test(e.titel));
        if (!tom || tom.datum !== J + '-04-05') klagen.push('Tomate saeen nicht am ' + J + '-04-05: ' + (tom && tom.datum));
        if (tom && !/Sonnenbeet/.test(tom.grund)) klagen.push('Grund nennt den Plan nicht: „' + (tom && tom.grund) + '"');
        if (tom && !/2 cm tief/.test(tom.grund)) klagen.push('Grund nennt die Saattiefe nicht');
        const w14 = erinn.find(e => /Vorkultur/.test(e.titel));
        // ISO-Woche 14 beginnt an einem Montag — der Termin muss ein Montag sein
        if (w14) { const d = new Date(w14.datum + 'T12:00:00'); if (d.getDay() !== 1) klagen.push('Woche-14-Termin liegt nicht auf einem Montag: ' + w14.datum); }
        else klagen.push('Zeitleisten-Schritt „Vorkultur ansetzen" fehlt');
        if (ev.some(e => /Salat|irgendwas/.test(e.titel))) klagen.push('der Plan OHNE Datumsfelder hat Termine erzeugt — ein erfundenes Jahr');
        if (ev.some(e => !e.verweis || e.verweis.fn !== 'gsPPopenSavedPlans')) klagen.push('ein Plan-Termin fuehrt nicht zu „Meine Plaene"');
        // Anzeige: die Tagesliste am Aussaat-Tag zeigt die Zeile mit Grund
        gsKalenderOeffnenAm(J + '-04-05');
        const t = (document.getElementById('modal-content') || {}).textContent || '';
        if (!/Tomate säen/.test(t)) klagen.push('Tagesliste am ' + J + '-04-05 zeigt „Tomate säen" nicht');
        if (!/Sonnenbeet/.test(t)) klagen.push('Tagesliste nennt den Plan nicht');
        try { closeModal('detail-modal'); } catch (_) {}
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: aussaat.length + ' Aussaaten · ' + ernte.length + ' Erntefenster-Grenzen · ' + erinn.length + ' Zeitleisten-Schritte (Montage) · Dublette einmal · Plan ohne Daten: 0 · Tagesliste zeigt Tomate saeen mit Plan' };
      } finally {
        if (alt == null) localStorage.removeItem('gs_garden_plans'); else localStorage.setItem('gs_garden_plans', alt);
      }
    },
  },
  // v33.38: der Fall „Garten-Timeline“ ist ersatzlos weg — mit der Funktion.
  // Was er gemessen hat, messen jetzt N1 (Scans im Kalender) und N3 (Ernte
  // mit Name und Menge); M2 hält fest, dass es die alte Oberfläche nicht mehr gibt.
  // ═══ KALENDER-V2 · das Pruefwerk (v33.34) ═══════════════════════════
  // „Denken" heisst rechnen: _gsKalPruefwerk(liste) laeuft am Ende der einen
  // Funktion und schreibt hinweise[] an die beteiligten Ereignisse. Jede Regel
  // hat drei Zustaende, und jeder Fall misst alle drei — und liest die Zeile
  // aus dem HTML (.gs-kal-hinweis), nicht nur das Objekt.
  {
    name: 'Prüfwerk · jedes Ereignis trägt hinweise[] (auch leer) und jedes Aussaat-Ereignis sein Fenster (indoor|outdoor)',
    lauf: () => {
      const heute = gsHeuteTag();
      const ev = gsKalenderEreignisse(heute.slice(0, 4) + '-01-01', heute.slice(0, 4) + '-12-31');
      const ohne = ev.filter(e => !Array.isArray(e.hinweise));
      if (ohne.length) return { ok: false, warum: ohne.length + ' von ' + ev.length + ' Ereignissen ohne hinweise[] (z.B. ' + ohne[0].art + ' ' + ohne[0].datum + ')' };
      const aus = ev.filter(e => e.art === 'aussaat');
      const ohneF = aus.filter(e => e.fenster !== 'indoor' && e.fenster !== 'outdoor');
      if (!aus.length) return { ok: false, warum: 'keine Aussaat-Ereignisse im Jahr — Grundlage fehlt' };
      if (ohneF.length) return { ok: false, warum: ohneF.length + ' von ' + aus.length + ' Aussaat-Ereignissen ohne fenster (z.B. „' + ohneF[0].titel + '")' };
      return { ok: true, info: ev.length + ' Ereignisse mit hinweise[] · ' + aus.length + ' Aussaaten mit Fenster (' + aus.filter(e => e.fenster === 'outdoor').length + ' draussen)' };
    },
  },
  {
    name: 'Prüfwerk R1 · Frost trifft Aussaat draussen: Feldsalat (Aug–Okt) + Frost am 3. → verletzt an BEIDEN Zeilen, im HTML; drei Frosttage → EIN Satz + „+2 weitere"; drinnen keiner; 5 °C → nichts; ohne Cache → „nicht bekannt", nie „kein Frost"',
    lauf: () => {
      const heute = gsHeuteTag(), mon = heute.slice(0, 7), tag3 = mon + '-03', m0 = +mon.slice(5, 7) - 1;
      const altC = localStorage.getItem('gs_weather_cache'), n0 = myPlants.length;
      const feld = { id: 'pR1', name: 'Feldsalat', emoji: '🥗', added: new Date(Date.now()).toISOString(), tasks: {} };
      myPlants.push(feld);
      // eine Kultur, die JETZT drinnen vorgezogen wird — falls es sie gibt
      const drin = (typeof GS_SAE_DB !== 'undefined') ? GS_SAE_DB.find(x => x.indoor && x.indoor.indexOf(m0) >= 0) : null;
      if (drin) myPlants.push({ id: 'pR1b', name: drin.n, emoji: drin.e, added: new Date(Date.now()).toISOString(), tasks: {} });
      const cache = (t3) => { const tg = [], tmin = []; for (let i = 0; i < 7; i++) { tg.push(_gsKalTagPlus(heute, i)); tmin.push(i === 2 ? t3 : 6); } localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now() - 3600000, data: { daily: { time: tg, temperature_2m_min: tmin } } })); };
      const finde = (ev, f) => ev.find(f);
      try {
        const klagen = [];
        cache(1.2);
        let ev = gsKalenderEreignisse(mon + '-01', _gsKalTagPlus(heute, 6));
        const aus = finde(ev, e => e.art === 'aussaat' && /Feldsalat/.test(e.titel) && e.fenster === 'outdoor');
        if (!aus) return { ok: false, warum: 'kein Aussaat-Ereignis „Feldsalat" mit fenster=outdoor im Monat — Grundlage fehlt' };
        const fr = finde(ev, e => e.art === 'wetter' && e.datum === tag3);
        if (!fr) return { ok: false, warum: 'kein Frost-Ereignis am ' + tag3 };
        const hA = (aus.hinweise || []).find(h => h.regel === 'frost_aussaat'), hF = (fr.hinweise || []).find(h => h.regel === 'frost_aussaat');
        if (!hA || hA.zustand !== 'verletzt' || !/1\.2/.test(hA.text)) klagen.push('Aussaat-Zeile: ' + JSON.stringify(aus.hinweise || null));
        if (!hF || hF.zustand !== 'verletzt' || !/Feldsalat/.test(hF.text)) klagen.push('Frost-Zeile nennt Feldsalat nicht: ' + JSON.stringify(fr.hinweise || null));
        if (drin) { const di = finde(ev, e => e.art === 'aussaat' && e.fenster === 'indoor' && e.titel.indexOf(drin.n) === 0); if (di && (di.hinweise || []).some(h => h.regel === 'frost_aussaat' && h.zustand === 'verletzt')) klagen.push('drinnen vorziehen („' + drin.n + '") bekommt einen Frost-Hinweis'); }
        // HTML: die Aussaat-Zeile am 1. traegt die Hinweiszeile, die Frost-Zeile am 3. nennt Feldsalat
        gsKalenderOeffnenAm(mon + '-01');
        let mc = document.getElementById('modal-content');
        let z = Array.from(mc.querySelectorAll('.gs-kal-zeile')).find(x => /Feldsalat/.test(x.textContent) && /draussen/.test(x.textContent));
        if (!z) klagen.push('Tagesblatt am 1. zeigt „Feldsalat … (draussen)" nicht');
        else { const hz = z.querySelector('.gs-kal-hinweis'); if (!hz || !/Frost/.test(hz.textContent) || !/1\.2/.test(hz.textContent)) klagen.push('Hinweiszeile unter der Aussaat fehlt oder nennt den Frost nicht: „' + (hz ? hz.textContent : '(keine)') + '"'); }
        gsKalenderOeffnenAm(tag3);
        mc = document.getElementById('modal-content');
        z = Array.from(mc.querySelectorAll('.gs-kal-zeile')).find(x => /Frost/.test(x.textContent));
        if (!z) klagen.push('Tagesblatt am 3. zeigt den Frost nicht');
        else { const hz = z.querySelector('.gs-kal-hinweis'); if (!hz || !/Feldsalat/.test(hz.textContent)) klagen.push('Hinweiszeile unter dem Frost nennt Feldsalat nicht: „' + (hz ? hz.textContent : '(keine)') + '"'); }
        // Deckel: drei Frosttage ergeben DREI Hinweise an DERSELBEN Aussaat.
        // Sichtbar ist einer, der Rest steht im Grund — ohne Deckel stuenden
        // drei Saetze in einer 10-px-Zeile (im November sieben).
        (function () { const tg = [], tmin = []; for (let i = 0; i < 7; i++) { tg.push(_gsKalTagPlus(heute, i)); tmin.push(i >= 1 && i <= 3 ? 1.2 : 6); } localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now() - 3600000, data: { daily: { time: tg, temperature_2m_min: tmin } } })); })();
        gsKalenderOeffnenAm(mon + '-01');
        const mcD = document.getElementById('modal-content');
        const zD = Array.from(mcD.querySelectorAll('.gs-kal-zeile')).find(x => /Feldsalat/.test(x.textContent) && /draussen/.test(x.textContent));
        const hD = zD && zD.querySelector('.gs-kal-hinweis');
        if (!hD) klagen.push('mit drei Frosttagen keine Hinweiszeile an der Aussaat');
        else {
          const nF = (hD.textContent.match(/Frost am/g) || []).length;
          if (nF !== 1) klagen.push('die Hinweiszeile zeigt ' + nF + ' Frost-Sätze statt einen: „' + hD.textContent + '"');
          if (!/\+2 weitere/.test(hD.textContent)) klagen.push('kein „+2 weitere" an der gedeckelten Hinweiszeile: „' + hD.textContent + '"');
          const gD = zD.querySelector('.gs-kal-grund');
          if (!gD || (gD.textContent.match(/Frost am/g) || []).length !== 2) klagen.push('die zwei weiteren Frost-Sätze stehen nicht im Grund: „' + (gD ? gD.textContent : '(keiner)') + '"');
        }
        // 5 °C: nichts verletzt
        cache(5);
        ev = gsKalenderEreignisse(mon + '-01', _gsKalTagPlus(heute, 6));
        const a2 = finde(ev, e => e.art === 'aussaat' && /Feldsalat/.test(e.titel) && e.fenster === 'outdoor');
        if (a2 && (a2.hinweise || []).some(h => h.regel === 'frost_aussaat' && h.zustand === 'verletzt')) klagen.push('bei 5 °C ein verletzter Frost-Hinweis');
        // ohne Cache: nicht pruefbar mit Grund — nie „kein Frost"
        localStorage.removeItem('gs_weather_cache');
        ev = gsKalenderEreignisse(mon + '-01', _gsKalTagPlus(heute, 6));
        const a3 = finde(ev, e => e.art === 'aussaat' && /Feldsalat/.test(e.titel) && e.fenster === 'outdoor');
        const np = a3 && (a3.hinweise || []).find(h => h.regel === 'frost_aussaat');
        if (!np || np.zustand !== 'nicht_pruefbar' || !/Wettervorhersage/.test(np.grund || np.text || '')) klagen.push('ohne Cache kein „nicht bekannt" mit Grund an der Aussaat: ' + JSON.stringify(a3 ? a3.hinweise : null));
        if (np && /kein Frost/i.test((np.text || '') + (np.grund || ''))) klagen.push('ohne Cache behauptet der Hinweis „kein Frost"');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'Frost 1.2 °C am 3. → Hinweis an Aussaat UND Frost (HTML) · drinnen ' + (drin ? '(' + drin.n + ') ohne' : 'nicht prüfbar (keine Kultur mit Vorkultur in diesem Monat)') + ' · 5 °C nichts · ohne Cache nicht prüfbar' };
      } finally { myPlants.length = n0; if (altC == null) localStorage.removeItem('gs_weather_cache'); else localStorage.setItem('gs_weather_cache', altC); }
    },
  },
  {
    name: 'Prüfwerk R2 · Regen übernimmt das Giessen: EINE Rechnung — gsGetDueTasks und Kalender nennen dieselben Aufgaben; 8 mm → verletzt mit Zahl im HTML (draussen), drinnen kein Feld; 3 mm → nichts; ohne Cache → „nicht prüfbar", Standort unbekannt → „Standort unbekannt"',
    lauf: () => {
      const heute = gsHeuteTag();
      const altC = localStorage.getItem('gs_weather_cache');
      const zucP = plantings.find(x => x && x.id === 'plant_seed_1');
      const merk = zucP && zucP.tasks && zucP.tasks.water ? zucP.tasks.water.lastDone : undefined;
      const cache = (mm6, mm9) => { const zeiten = [], regen = []; for (let h = 0; h < 24; h++) { zeiten.push(heute + 'T' + String(h).padStart(2, '0') + ':00'); regen.push(h === 6 ? mm6 : h === 9 ? mm9 : 0); } localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { hourly: { time: zeiten, precipitation: regen } } })); };
      try {
        const klagen = [];
        if (zucP && zucP.tasks && zucP.tasks.water) zucP.tasks.water.lastDone = new Date(Date.now() - 3 * 864e5).toISOString();
        cache(3, 5);
        let ev = gsKalenderEreignisse(heute, heute);
        const zuc = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'plant_seed_1');
        const bas = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'p1');
        if (!zuc || !bas) return { ok: false, warum: 'Grundlage fehlt: Zucchini (Balkon) und Basilikum (drinnen) müssen heute eine Giess-Aufgabe haben' };
        const hz = (zuc.hinweise || []).find(h => h.regel === 'regen');
        if (!hz || hz.zustand !== 'verletzt' || !/8 mm/.test(hz.text)) klagen.push('Zucchini draussen bei 8 mm: ' + JSON.stringify(zuc.hinweise || null));
        if ((bas.hinweise || []).some(h => h.regel === 'regen')) klagen.push('Basilikum (drinnen) trägt ein Regen-Feld — drinnen ist „gilt nicht", kein Zustand');
        // dieselbe Zahl wie gsGetDueTasks (v31.84-Draht): Eintraege mit .regen === Kalender-Aufgaben mit verletztem regen-Hinweis
        const nDue = gsGetDueTasks().filter(x => x.regen && x.days <= 0).length;
        const nKal = ev.filter(e => e.art === 'aufgabe' && (e.hinweise || []).some(h => h.regel === 'regen' && h.zustand === 'verletzt')).length;
        if (nDue !== nKal) klagen.push('gsGetDueTasks nennt ' + nDue + ' Regen-Aufgaben, der Kalender ' + nKal + ' — zwei Rechnungen');
        // HTML
        gsKalenderOeffnenAm(heute);
        const mc = document.getElementById('modal-content');
        const z = Array.from(mc.querySelectorAll('.gs-kal-zeile')).find(x => /Zucchini/.test(x.textContent) && /giessen/i.test(x.textContent));
        const hh = z && z.querySelector('.gs-kal-hinweis');
        if (!hh || !/8 mm/.test(hh.textContent)) klagen.push('Hinweiszeile „Regen übernimmt … 8 mm" fehlt im Tagesblatt: „' + (hh ? hh.textContent : '(keine)') + '"');
        if (z && !z.querySelector('.gs-kal-box')) klagen.push('das Kästchen ist weg — Regen erledigt nichts, es übernimmt');
        // 3 mm: nichts verletzt
        cache(1, 2);
        ev = gsKalenderEreignisse(heute, heute);
        const z2 = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'plant_seed_1');
        if (z2 && (z2.hinweise || []).some(h => h.regel === 'regen' && h.zustand === 'verletzt')) klagen.push('bei 3 mm „Regen übernimmt"');
        // ohne Cache: nicht pruefbar
        localStorage.removeItem('gs_weather_cache');
        ev = gsKalenderEreignisse(heute, heute);
        const z3 = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'plant_seed_1');
        const np = z3 && (z3.hinweise || []).find(h => h.regel === 'regen');
        if (!np || np.zustand !== 'nicht_pruefbar') klagen.push('ohne Cache kein „nicht prüfbar" an der Giess-Aufgabe draussen: ' + JSON.stringify(z3 ? z3.hinweise : null));
        // Standort unbekannt: Pflanzung in einem Garten, den es nicht gibt
        cache(3, 5);
        const fremd = { id: 'plR2', gardenId: 'g_nicht_da', name: 'Salat', date: heute, added: new Date(Date.now()).toISOString(), tasks: { water: { active: true, intervalDays: 2, lastDone: new Date(Date.now() - 3 * 864e5).toISOString() } } };
        plantings.push(fremd);
        try {
          ev = gsKalenderEreignisse(heute, heute);
          const zf = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'plR2');
          const nf = zf && (zf.hinweise || []).find(h => h.regel === 'regen');
          if (!nf || nf.zustand !== 'nicht_pruefbar' || !/Standort/.test(nf.grund || nf.text || '')) klagen.push('unbekannter Standort: ' + JSON.stringify(zf ? zf.hinweise : null));
        } finally { plantings.splice(plantings.indexOf(fremd), 1); }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '8 mm → „Regen übernimmt" an Zucchini (HTML, Kästchen bleibt), Basilikum ohne Feld, gsGetDueTasks = Kalender (' + nDue + ') · 3 mm nichts · ohne Cache nicht prüfbar · fremder Garten „Standort unbekannt"' };
      } finally {
        if (zucP && zucP.tasks && zucP.tasks.water) { if (merk === undefined) delete zucP.tasks.water.lastDone; else zucP.tasks.water.lastDone = merk; }
        if (altC == null) localStorage.removeItem('gs_weather_cache'); else localStorage.setItem('gs_weather_cache', altC);
      }
    },
  },
  {
    name: 'Prüfwerk R3 · Ernte-Schätzung nur mit Kulturdaten: Zucchini bekommt sie mit den Zahlen im Grund, eine Monstera-Pflanzung KEINE (heute: „Ernte voraussichtlich" aus dem 60–90-Tage-Rückfall)',
    lauf: () => {
      const heute = gsHeuteTag();
      const mon = { id: 'plR3', gardenId: 'g1', name: 'Monstera', date: _gsKalTagPlus(heute, -30), added: new Date(Date.now() - 30 * 864e5).toISOString() };
      plantings.push(mon);
      try {
        const klagen = [];
        const ev = gsKalenderEreignisse(_gsKalTagPlus(heute, -120), _gsKalTagPlus(heute, 200));
        const em = ev.filter(e => e.art === 'ernte' && e.pflanze && e.pflanze.id === 'plR3');
        if (em.length) klagen.push('Monstera-Pflanzung bekommt ' + em.length + ' Ernte-Ereignis(se) („' + em[0].titel + '") — aus dem Rückfall 60–90 Tage, den es für Monstera nicht gibt');
        const ez = ev.find(e => e.art === 'ernte' && e.pflanze && e.pflanze.id === 'plant_seed_1');
        if (!ez) klagen.push('Zucchini-Pflanzung ohne Ernte-Ereignis');
        // Die ZAHLEN muessen dastehen, das Wort „Kulturdaten" nicht — es steht
        // auf einem Nutzer-Bildschirm und heisst dort nichts.
        else if (!/50/.test(ez.grund) || !/65/.test(ez.grund)) klagen.push('Zucchini-Grund nennt die Kulturdauer nicht (50 bis 65 Tage): „' + ez.grund + '"');
        else if (/Kulturdaten|Mitte \d/.test(ez.grund)) klagen.push('Entwicklerwort im Grund: „' + ez.grund + '"');
        if (ez) {
          gsKalenderOeffnenAm(ez.datum);
          const mc = document.getElementById('modal-content');
          const z = Array.from(mc.querySelectorAll('.gs-kal-zeile')).find(x => /Zucchini/.test(x.textContent) && /Ernte/.test(x.textContent));
          const g = z && z.querySelector('.gs-kal-grund');
          if (!g || !/50/.test(g.textContent) || !/65/.test(g.textContent)) klagen.push('der Grund im Tagesblatt nennt 50–65 nicht');
        }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'Monstera: 0 Ernte-Ereignisse · Zucchini: „' + ez.grund.slice(0, 70) + '…"' };
      } finally { plantings.splice(plantings.indexOf(mon), 1); }
    },
  },
  {
    name: 'Prüfwerk R4 · erntereif geschätzt, nichts eingetragen: 12 Tage nach der Schätzung → verletzt mit Tagen; Log-Zeile → erfüllt mit Menge im Grund; Log ohne Pflanzenangabe → „nicht prüfbar", nie „nichts eingetragen"',
    lauf: () => {
      const heute = gsHeuteTag();
      const zucP = plantings.find(x => x && x.id === 'plant_seed_1');
      if (!zucP) return { ok: false, warum: 'Beispieldaten ohne Zucchini-Pflanzung' };
      const altD = zucP.date, altLog = localStorage.getItem('gs_ernte_log');
      const log = (arr) => { localStorage.setItem('gs_ernte_log', JSON.stringify(arr)); window._gsErnteLog = null; };
      try {
        const klagen = [];
        zucP.date = _gsKalTagPlus(heute, -70);   // Schaetzung ~58 Tage → vor ~12 Tagen
        log([]);
        let ev = gsKalenderEreignisse(_gsKalTagPlus(heute, -60), heute);
        let ez = ev.find(e => e.art === 'ernte' && e.pflanze && e.pflanze.id === 'plant_seed_1' && e.quelle === 'regel');
        if (!ez) return { ok: false, warum: 'keine Ernte-Schätzung in den letzten 60 Tagen (Grundlage) — date=' + zucP.date };
        let h = (ez.hinweise || []).find(x => x.regel === 'ernte_offen');
        if (!h || h.zustand !== 'verletzt' || !/seit \d+ Tag/.test(h.text)) klagen.push('ohne Log kein „verletzt … seit N Tagen": ' + JSON.stringify(ez.hinweise || null));
        gsKalenderOeffnenAm(ez.datum);
        const mc = document.getElementById('modal-content');
        const z = Array.from(mc.querySelectorAll('.gs-kal-zeile')).find(x => /Zucchini/.test(x.textContent) && /Ernte/.test(x.textContent));
        const hh = z && z.querySelector('.gs-kal-hinweis');
        if (!hh || !/eingetragen/.test(hh.textContent)) klagen.push('Hinweiszeile „… keine Ernte eingetragen" fehlt im Tagesblatt: „' + (hh ? hh.textContent : '(keine)') + '"');
        // erfuellt: eine Ernte eingetragen
        log([{ id: 'eR4', pflanze: 'Zucchini', emoji: '🥒', menge: 300, unit: 'g', ts: new Date(Date.now() - 3 * 864e5).toISOString() }]);
        ev = gsKalenderEreignisse(_gsKalTagPlus(heute, -60), heute);
        ez = ev.find(e => e.art === 'ernte' && e.pflanze && e.pflanze.id === 'plant_seed_1' && e.quelle === 'regel');
        h = ez && (ez.hinweise || []).find(x => x.regel === 'ernte_offen');
        if (!h || h.zustand !== 'erfuellt' || !/300 g/.test(h.grund || h.text || '')) klagen.push('mit Log-Zeile kein „erfüllt" mit 300 g: ' + JSON.stringify(ez ? ez.hinweise : null));
        // nicht pruefbar: Log-Zeile ohne pflanze (die Seed-Falle K5)
        log([{ id: 'eX', plant: 'Zucchini', amount: 300, unit: 'g', ts: new Date(Date.now() - 3 * 864e5).toISOString() }]);
        ev = gsKalenderEreignisse(_gsKalTagPlus(heute, -60), heute);
        ez = ev.find(e => e.art === 'ernte' && e.pflanze && e.pflanze.id === 'plant_seed_1' && e.quelle === 'regel');
        h = ez && (ez.hinweise || []).find(x => x.regel === 'ernte_offen');
        if (!h || h.zustand !== 'nicht_pruefbar') klagen.push('Log ohne Pflanzenangabe gilt als „' + (h ? h.zustand : 'nichts') + '" statt nicht prüfbar');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'ohne Log verletzt (HTML) · 300 g → erfüllt · Log ohne pflanze → nicht prüfbar' };
      } finally { zucP.date = altD; if (altLog == null) localStorage.removeItem('gs_ernte_log'); else localStorage.setItem('gs_ernte_log', altLog); window._gsErnteLog = null; }
    },
  },
  {
    name: 'Prüfwerk R5 · Überfällig-Stufe: 11 Tage → „lange" als KLASSE, die Zahl nur in der Unterzeile (kein zweiter Satz); heute → keine Stufe; nie abgehakt → „noch nie abgehakt", nicht „seit 0 Tagen"',
    lauf: () => {
      const heute = gsHeuteTag();
      const p1 = myPlants.find(p => p && p.id === 'p1'), p2 = myPlants.find(p => p && p.id === 'p2'), p3 = myPlants.find(p => p && p.id === 'p3');
      if (!p1 || !p2 || !p3 || !p1.tasks.water || !p2.tasks.water || !p3.tasks.water) return { ok: false, warum: 'Beispieldaten ohne p1/p2/p3 mit Giess-Aufgabe' };
      const alt1 = p1.tasks.water.lastDone, alt2 = p2.tasks.water.lastDone, alt3 = p3.tasks.water.lastDone;
      try {
        const klagen = [];
        // Wer einen Zustand braucht, stellt ihn HER (v32.40): ein frueherer Fall
        // hatte Tomates lastDone auf −30 Tage gesetzt — der erste Lauf meldete
        // „Tomate (heute faellig) bekommt eine Stufe" mit faellig_seit −28. Die
        // Regel war richtig, die Annahme ueber die Reihenfolge der Faelle nicht.
        p1.tasks.water.lastDone = new Date(Date.now() - 14 * 864e5).toISOString();   // Intervall 3 → seit 11 Tagen
        delete p2.tasks.water.lastDone;                                               // nie erledigt
        p3.tasks.water.lastDone = new Date(Date.now() - 2 * 864e5).toISOString();    // Intervall 2 → heute
        const ev = gsKalenderEreignisse(heute, heute);
        const e1 = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'p1');
        const e2 = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'p2');
        const e3 = ev.find(e => e.art === 'aufgabe' && e.key === 'water' && e.pflanze && e.pflanze.id === 'p3');   // Tomate heute
        if (!e1 || !e2) return { ok: false, warum: 'p1/p2 haben heute keine Giess-Aufgabe (Grundlage)' };
        const h1 = (e1.hinweise || []).find(h => h.regel === 'ueberfaellig');
        if (!h1 || h1.zustand !== 'verletzt' || !/Woche/.test(h1.grund || '')) klagen.push('11 Tage: ' + JSON.stringify(e1.hinweise || null));
        if (h1 && h1.text) klagen.push('die Stufe schreibt einen eigenen Satz („' + h1.text + '") — die Unterzeile sagt es bereits');
        const h2 = (e2.hinweise || []).find(h => h.regel === 'ueberfaellig');
        if (!h2 || h2.zustand !== 'nicht_pruefbar' || !/nie abgehakt/.test(h2.text + (h2.grund || ''))) klagen.push('nie abgehakt: ' + JSON.stringify(e2.hinweise || null));
        if (h2 && /seit 0/.test(h2.text + (h2.grund || ''))) klagen.push('„seit 0 Tagen" für eine nie abgehakte Aufgabe');
        if (e3 && (e3.hinweise || []).some(h => h.regel === 'ueberfaellig' && h.zustand === 'verletzt')) klagen.push('Tomate (heute fällig) bekommt eine Stufe: faellig_seit=' + e3.faellig_seit + ' lastDone=' + JSON.stringify((myPlants.find(p => p.id === 'p3') || {}).tasks.water) + ' hinweise=' + JSON.stringify(e3.hinweise));
        gsKalenderOeffnenAm(heute);
        const mc = document.getElementById('modal-content');
        const z = Array.from(mc.querySelectorAll('.gs-kal-zeile')).find(x => /Basilikum/.test(x.textContent) && /giessen/i.test(x.textContent));
        if (!z || !z.classList.contains('gs-kal-lange')) klagen.push('die Basilikum-Zeile trägt die Klasse gs-kal-lange nicht');
        // Die Zahl steht in der Unterzeile — und NUR dort. Zweimal
        // „Seit 11 Tagen fällig" untereinander ist die Klasse aus v32.87.
        const unter = z && z.querySelector('.gs-kal-txt i');
        if (!unter || !/11 Tag/.test(unter.textContent)) klagen.push('die Unterzeile nennt die 11 Tage nicht: „' + (unter ? unter.textContent : '(keine)') + '"');
        const hh = z && z.querySelector('.gs-kal-hinweis');
        if (hh && /11 Tag/.test(hh.textContent)) klagen.push('„11 Tage" steht zweimal in derselben Zeile: Unterzeile UND Hinweiszeile („' + hh.textContent + '")');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '11 Tage → Klasse gs-kal-lange + Unterzeile, kein zweiter Satz · nie abgehakt → nicht prüfbar · heute → keine Stufe' };
      } finally { p1.tasks.water.lastDone = alt1; if (alt2 === undefined) delete p2.tasks.water.lastDone; else p2.tasks.water.lastDone = alt2; p3.tasks.water.lastDone = alt3; }
    },
  },
  {
    name: 'Prüfwerk R8 · ein leerer Tag MIT Daten sagt „Nichts an diesem Tag" — und nicht „Noch keine Daten"',
    lauf: () => {
      const heute = gsHeuteTag();
      let leer = null;
      for (let i = 1; i <= 40 && !leer; i++) { const t = _gsKalTagPlus(heute, i); if (!gsKalenderEreignisse(t, t).length) leer = t; }
      if (!leer) return { ok: false, warum: 'in 40 Tagen kein leerer Tag — die Beispieldaten haben sich geändert' };
      gsKalenderOeffnenAm(leer);
      const t = (document.getElementById('modal-content') || {}).textContent || '';
      if (!/Nichts an diesem Tag/.test(t)) return { ok: false, warum: 'leerer Tag mit Daten sagt nicht „Nichts an diesem Tag": ' + (t.match(/Noch keine Daten|ausgeblendet/) || ['(kein Leersatz)'])[0] };
      if (/Noch keine Daten/.test(t)) return { ok: false, warum: 'leerer Tag mit Daten sagt „Noch keine Daten"' };
      return { ok: true, info: leer + ' · „Nichts an diesem Tag" (Daten da, Tag leer)' };
    },
  },
  {
    // v33.35 · KALENDER-V2 §4. Die Reihenfolge ist die Sache: Rechnung →
    // Pruefwerk → SIEB → Anzeige. Wer aus Tempo eine Quelle in der RECHNUNG
    // ueberspringt, wenn ein Chip aus ist, macht „N von M" falsch und Lina
    // blind — sie liest die ungefilterte Liste.
    name: 'Sieb F1 · ein Filter ist ein Sieb auf dem Ergebnis: leer ⇒ Liste identisch, „messung" aus ⇒ nur Messwerte fehlen, und die RECHNUNG selbst bleibt unberührt',
    lauf: () => {
      // Der Bereich reicht bewusst ZURUECK: die Messwerte der Beispieldaten
      // liegen in den sieben Tagen vor dem Anker, also teils im Vormonat.
      const heute = gsHeuteTag(), von = _gsKalTagPlus(heute, -10), bis = _gsKalTagPlus(heute, 25);
      const alt = localStorage.getItem('gs_kal_filter');
      try {
        const klagen = [];
        if (typeof _gsKalFiltern !== 'function') return { ok: false, warum: '_gsKalFiltern fehlt' };
        const roh = gsKalenderEreignisse(von, bis);
        if (!roh.length) return { ok: false, warum: 'keine Ereignisse im Bereich — Grundlage fehlt' };
        const leer = _gsKalFiltern(roh, { aus: [], garten: null });
        if (leer.length !== roh.length || leer.some((e, i) => e.id !== roh[i].id)) klagen.push('leerer Filter ändert die Liste: ' + roh.length + ' → ' + leer.length);
        const nMess = roh.filter(e => e.art === 'messung').length;
        if (!nMess) klagen.push('keine Messwert-Ereignisse in den Beispieldaten — der Fall misst das Ausblenden nicht');
        const ohne = _gsKalFiltern(roh, { aus: ['messung'], garten: null });
        if (ohne.some(e => e.art === 'messung')) klagen.push('„messung" ausgeblendet, kommt trotzdem vor');
        if (ohne.length !== roh.length - nMess) klagen.push('mit „messung" aus fehlen ' + (roh.length - ohne.length) + ' statt ' + nMess);
        // Die Rechnung kennt den Filter nicht: alles ausblenden, dann zählen
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: ['aufgabe', 'tagebuch', 'gepflanzt', 'aussaat', 'ernte', 'erinnerung', 'messung', 'alarm', 'wetter'], garten: null }));
        const roh2 = gsKalenderEreignisse(von, bis);
        if (roh2.length !== roh.length) klagen.push('gsKalenderEreignisse liefert mit gesetztem Filter ' + roh2.length + ' statt ' + roh.length + ' — das Sieb sitzt in der Rechnung');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: roh.length + ' Ereignisse · leer identisch · ohne Messwerte ' + ohne.length + ' (−' + nMess + ') · Rechnung unberührt' };
      } finally { if (alt == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', alt); }
    },
  },
  {
    name: 'Sieb F2 · fünf Gruppen-Chips mit aria-pressed; ihre Zahlen kommen aus der UNGEFILTERTEN Liste und summieren sich auf den Monat; „Messwerte" ist von Anfang an aus',
    lauf: () => {
      const heute = gsHeuteTag(), mon = heute.slice(0, 7);
      const alt = localStorage.getItem('gs_kal_filter');
      try {
        // Der Zustand ZIEHT die beiden denkbaren Regeln auseinander: mit
        // leerem Filter liefern „aus der ungefilterten" und „aus der
        // gefilterten Liste" DIESELBE Zahl, und der Fall pruefte keine von
        // beiden (v33.28). Also wird eine Gruppe MIT Ereignissen ausgeblendet.
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: ['aufgabe', 'alarm', 'erinnerung'], garten: null }));
        const klagen = [];
        gsKalenderOeffnenAm(heute);
        const mc = document.getElementById('modal-content');
        const chips = Array.from(mc.querySelectorAll('.gs-kal-chip'));
        if (chips.length !== 5) return { ok: false, warum: chips.length + ' Chips statt 5: ' + chips.map(c => c.textContent.trim()).join(' | ') };
        const ohneAria = chips.filter(c => c.tagName !== 'BUTTON' || !c.hasAttribute('aria-pressed'));
        if (ohneAria.length) klagen.push(ohneAria.length + ' Chips ohne <button aria-pressed>');
        const tage = new Date(+mon.slice(0, 4), +mon.slice(5, 7), 0).getDate();
        const roh = gsKalenderEreignisse(mon + '-01', mon + '-' + String(tage).padStart(2, '0'));
        const zahlen = chips.map(c => { const m = c.textContent.match(/(\d+)\s*$/); return m ? +m[1] : null; });
        if (zahlen.some(z => z === null)) klagen.push('ein Chip ohne Zahl: ' + chips.map(c => c.textContent.trim()).join(' | '));
        else {
          const summe = zahlen.reduce((a, b) => a + b, 0);
          if (summe !== roh.length) klagen.push('Chip-Zahlen summieren ' + summe + ', der Monat hat ' + roh.length + ' Ereignisse (ungefiltert)');
        }
        const zt = chips.find(c => /Zu tun/i.test(c.textContent));
        if (zt && zt.getAttribute('aria-pressed') !== 'false') klagen.push('die ausgeblendete Gruppe zeigt sich als EIN');
        if (zt) { const m = zt.textContent.match(/(\d+)\s*$/); const nRoh = roh.filter(e => ['aufgabe', 'alarm', 'erinnerung'].indexOf(e.art) >= 0).length;
          if (!m || +m[1] !== nRoh) klagen.push('der ausgeschaltete Chip zeigt ' + (m ? m[1] : '—') + ' statt ' + nRoh + ' — er soll sagen, was er verbirgt'); }
        // Und die Vorgabe, aus einem eigenen, sauberen Zustand:
        localStorage.removeItem('gs_kal_filter');
        gsKalenderOeffnenAm(heute);
        const mess = Array.from(document.getElementById('modal-content').querySelectorAll('.gs-kal-chip')).find(c => /Messwert/i.test(c.textContent));
        if (!mess) klagen.push('kein Chip „Messwerte"');
        else if (mess.getAttribute('aria-pressed') !== 'false') klagen.push('„Messwerte" ist ohne Zutun EIN — Vorgabe ist aus (Entscheidung 3)');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: chips.map(c => c.textContent.trim().replace(/\s+/g, ' ')).join(' · ') };
      } finally { if (alt == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', alt); }
    },
  },
  {
    name: 'Sieb F3 · ein Tippen blendet die ganze Gruppe aus, schreibt sie in gs_kal_filter und überlebt das Neu-Öffnen — und ein zweites Tippen holt sie zurück',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_kal_filter');
      try {
        localStorage.removeItem('gs_kal_filter');
        const klagen = [];
        gsKalenderOeffnenAm(heute);
        let mc = document.getElementById('modal-content');
        const zutun = Array.from(mc.querySelectorAll('.gs-kal-chip')).find(c => /Zu tun/i.test(c.textContent));
        if (!zutun) return { ok: false, warum: 'kein Chip „Zu tun"' };
        const vorher = mc.querySelectorAll('.gs-kal-zeile.gs-kal-aufgabe').length;
        if (!vorher) return { ok: false, warum: 'heute keine Aufgaben-Zeile — Grundlage fehlt' };
        zutun.click();
        mc = document.getElementById('modal-content');
        if (mc.querySelectorAll('.gs-kal-zeile.gs-kal-aufgabe').length) klagen.push('nach dem Tippen stehen die Aufgaben noch da');
        const f = JSON.parse(localStorage.getItem('gs_kal_filter') || 'null');
        if (!f || !Array.isArray(f.aus) || ['aufgabe', 'alarm', 'erinnerung'].some(a => f.aus.indexOf(a) < 0)) klagen.push('gs_kal_filter trägt die Gruppe nicht: ' + JSON.stringify(f));
        gsKalenderOeffnenAm(heute);
        mc = document.getElementById('modal-content');
        if (mc.querySelectorAll('.gs-kal-zeile.gs-kal-aufgabe').length) klagen.push('nach dem Neu-Öffnen sind die Aufgaben zurück — der Zustand überlebt nicht');
        const wieder = Array.from(mc.querySelectorAll('.gs-kal-chip')).find(c => /Zu tun/i.test(c.textContent));
        if (wieder && wieder.getAttribute('aria-pressed') !== 'false') klagen.push('der Chip zeigt sich als EIN, obwohl die Gruppe aus ist');
        if (wieder) wieder.click();
        mc = document.getElementById('modal-content');
        if (mc.querySelectorAll('.gs-kal-zeile.gs-kal-aufgabe').length !== vorher) klagen.push('zweites Tippen holt die Aufgaben nicht zurück (' + mc.querySelectorAll('.gs-kal-zeile.gs-kal-aufgabe').length + ' statt ' + vorher + ')');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: vorher + ' Aufgaben-Zeilen → aus → überlebt → wieder ' + vorher };
      } finally { if (alt == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', alt); }
    },
  },
  {
    name: 'Sieb F4 · die Zahl steht an EINER Stelle: „(N ausgeblendet)" nur wenn > 0 im Tageskopf, kein Monatsfuss mit drei Zahlen — und ein Tag, an dem alles ausgeblendet ist, sagt es und führt zurück',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_kal_filter');
      try {
        const klagen = [];
        localStorage.removeItem('gs_kal_filter');
        gsKalenderOeffnenAm(heute);
        let mc = document.getElementById('modal-content');
        let kopf = mc.querySelector('.gs-kal-tagkopf');
        if (kopf && /ausgeblendet/.test(kopf.textContent)) klagen.push('ohne ausgeblendete Einträge steht „ausgeblendet" im Tageskopf: „' + kopf.textContent.trim() + '"');
        // alles aus: der Tag muss es sagen UND einen Weg zurück anbieten
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: ['aufgabe', 'tagebuch', 'gepflanzt', 'aussaat', 'ernte', 'erinnerung', 'messung', 'alarm', 'wetter'], garten: null }));
        gsKalenderOeffnenAm(heute);
        mc = document.getElementById('modal-content');
        const t = mc.textContent || '';
        if (!/ausgeblendet/.test(t)) klagen.push('ein Tag mit lauter ausgeblendeten Einträgen sagt es nicht');
        if (/Noch keine Daten/.test(t)) klagen.push('ausgeblendet wird als „Noch keine Daten" gezeigt — drei Leerzustände, nicht zwei');
        const zurueck = mc.querySelector('.gs-kal-alle');
        if (!zurueck) klagen.push('kein Weg zurück („alle zeigen")');
        else {
          zurueck.click();
          mc = document.getElementById('modal-content');
          if (!mc.querySelectorAll('.gs-kal-zeile').length) klagen.push('„alle zeigen" bringt die Einträge nicht zurück');
          const f = JSON.parse(localStorage.getItem('gs_kal_filter') || 'null');
          if (f && Array.isArray(f.aus) && f.aus.length) klagen.push('„alle zeigen" lässt ' + f.aus.length + ' Arten ausgeblendet');
        }
        // kein Monatsfuss mit „N · M · K"
        if (/\d+\s*·\s*\d+\s*gezeigt/.test(t)) klagen.push('Monatsfuss zählt ein zweites Mal');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'ohne Filter kein „ausgeblendet" · alles aus → Satz + „alle zeigen" → zurück' };
      } finally { if (alt == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', alt); }
    },
  },
  {
    name: 'Sieb F5 · die Punkte im Raster tragen die Farbe der GRUPPE (fünf), nicht der Art (neun) — und die Legende ist weg, weil die Chips sie erklären',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_kal_filter');
      try {
        localStorage.removeItem('gs_kal_filter');
        const klagen = [];
        gsKalenderOeffnenAm(heute);
        const mc = document.getElementById('modal-content');
        if (mc.querySelector('.gs-kal-legende')) klagen.push('die Legende steht noch da');
        const punkte = Array.from(mc.querySelectorAll('.gs-kal-punkte .gs-kal-p'));
        if (!punkte.length) return { ok: false, warum: 'keine Punkte im Raster — Grundlage fehlt' };
        const klassen = new Set();
        punkte.forEach(p => Array.from(p.classList).forEach(k => { if (k !== 'gs-kal-p') klassen.add(k); }));
        const nichtGruppe = Array.from(klassen).filter(k => k.indexOf('gs-kal-p-g-') !== 0);
        if (nichtGruppe.length) klagen.push('Punkte tragen Art-Klassen statt Gruppen-Klassen: ' + nichtGruppe.join(', '));
        if (klassen.size > 5) klagen.push(klassen.size + ' verschiedene Punktfarben — höchstens fünf (eine je Gruppe)');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: punkte.length + ' Punkte · ' + klassen.size + ' Gruppenfarben · keine Legende' };
      } finally { if (alt == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', alt); }
    },
  },
  {
    name: 'Sieb F6 · der Filterzustand gehört dem Konto: gs_kal_filter steht in GS_USER_KEYS und reist im state-Blob HIN und RÜCK',
    lauf: () => {
      const klagen = [];
      if (typeof GS_USER_KEYS === 'undefined' || GS_USER_KEYS.indexOf('gs_kal_filter') < 0) klagen.push('gs_kal_filter steht nicht in GS_USER_KEYS');
      localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: ['wetter'], garten: null }));
      const blob = (typeof window._gsBuildStateBlob === 'function') ? window._gsBuildStateBlob() : null;
      if (!blob) klagen.push('_gsBuildStateBlob nicht erreichbar');
      else if (!blob.kal_filter || !Array.isArray(blob.kal_filter.aus) || blob.kal_filter.aus[0] !== 'wetter') klagen.push('der Hinweg trägt den Filter nicht: ' + JSON.stringify(blob.kal_filter || null));
      localStorage.removeItem('gs_kal_filter');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'in GS_USER_KEYS · im Hinweg als kal_filter (den Rückweg misst sync_check)' };
    },
  },
  {
    // v33.36 · KALENDER-V2 R7. Bis hierher standen die vier Schwellen an ZWEI
    // Stellen: GS_FROST_GRENZE_C (2) im Kalender und vier Literale (2/30/20/40)
    // in gsOpenWeatherWarn — das dazu einen EIGENEN Open-Meteo-Aufruf machte
    // und den Legacy-Schluessel `userLocation` las. Zwei Rechnungen fuer
    // dieselbe Frage, die dritte Klasse dieses Repos (§4a.2).
    name: 'Wetter W1 · EINE Tabelle für alle vier Schwellen: GS_WETTER_GRENZEN, keine zweite Zahl im Warnfenster, kein eigener Netz-Aufruf mehr',
    lauf: () => {
      const klagen = [];
      if (typeof GS_WETTER_GRENZEN !== 'object' || !GS_WETTER_GRENZEN) return { ok: false, warum: 'GS_WETTER_GRENZEN fehlt' };
      ['frost', 'hitze', 'starkregen', 'sturm'].forEach(k => { if (typeof GS_WETTER_GRENZEN[k] !== 'number') klagen.push('Schwelle „' + k + '" fehlt oder ist keine Zahl'); });
      const q = String(window.gsOpenWeatherWarn || '');
      if (!q) return { ok: false, warum: 'gsOpenWeatherWarn nicht erreichbar' };
      if (/api\.open-meteo\.com/.test(q)) klagen.push('das Warnfenster holt das Wetter noch selbst — es soll denselben Zwischenspeicher lesen wie der Kalender');
      if (/'userLocation'|"userLocation"/.test(q)) klagen.push('das Warnfenster liest den Legacy-Schlüssel userLocation');
      if (!/GS_WETTER_GRENZEN/.test(q)) klagen.push('das Warnfenster rechnet nicht mit GS_WETTER_GRENZEN');
      [30, 20, 40].forEach(z => { if (new RegExp('>=\\s*' + z + '\\b').test(q)) klagen.push('feste Schwelle ' + z + ' im Warnfenster'); });
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: JSON.stringify(GS_WETTER_GRENZEN) + ' · Warnfenster ohne eigenen Abruf und ohne eigene Zahlen' };
    },
  },
  {
    name: 'Wetter W2 · vier Schwellen, knapp darunter und knapp darüber: je ein wetter-Ereignis mit Wert und Grund — und ohne Vorhersage keins',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_weather_cache');
      const setz = (tmin, tmax, regen, wind) => {
        const t = [], mi = [], ma = [], ps = [], wd = [];
        for (let i = 0; i < 3; i++) { t.push(_gsKalTagPlus(heute, i)); mi.push(i === 1 ? tmin : 8); ma.push(i === 1 ? tmax : 20); ps.push(i === 1 ? regen : 0); wd.push(i === 1 ? wind : 10); }
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now() - 3600000, data: { daily: { time: t, temperature_2m_min: mi, temperature_2m_max: ma, precipitation_sum: ps, windspeed_10m_max: wd } } }));
      };
      const morgen = _gsKalTagPlus(heute, 1);
      const arten = () => gsKalenderEreignisse(heute, _gsKalTagPlus(heute, 2)).filter(e => e.art === 'wetter' && e.datum === morgen).map(e => String(e.id).split(':')[0]);
      try {
        const klagen = [];
        const G = GS_WETTER_GRENZEN;
        // knapp DRUNTER: keine einzige Warnung
        setz(G.frost + 0.1, G.hitze - 0.1, G.starkregen - 0.1, G.sturm - 0.1);
        let a = arten();
        if (a.length) klagen.push('knapp unter allen vier Schwellen entstehen trotzdem: ' + a.join(', '));
        // knapp DRUEBER: alle vier
        setz(G.frost, G.hitze, G.starkregen, G.sturm);
        a = arten();
        ['frost', 'hitze', 'starkregen', 'sturm'].forEach(k => { if (a.indexOf(k) < 0) klagen.push('„' + k + "\" fehlt genau auf der Schwelle (" + G[k] + ')'); });
        // Jedes Ereignis nennt seinen Wert und sagt, woher
        const ev = gsKalenderEreignisse(heute, _gsKalTagPlus(heute, 2)).filter(e => e.art === 'wetter' && e.datum === morgen);
        ev.forEach(e => {
          if (typeof e.wert !== 'number') klagen.push(String(e.id).split(':')[0] + ' ohne Feld wert');
          if (!e.grund || !/Wetterdienst|Vorhersage/.test(e.grund)) klagen.push(String(e.id).split(':')[0] + ' ohne Herkunft im Grund');
        });
        // ohne Vorhersage: gar nichts
        localStorage.removeItem('gs_weather_cache');
        a = arten();
        if (a.length) klagen.push('ohne Vorhersage entstehen Wetter-Ereignisse: ' + a.join(', '));
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'unter den Schwellen 0 · auf den Schwellen ' + ['frost', 'hitze', 'starkregen', 'sturm'].join('+') + ' · jedes mit Wert und Herkunft · ohne Cache 0' };
      } finally { if (alt == null) localStorage.removeItem('gs_weather_cache'); else localStorage.setItem('gs_weather_cache', alt); }
    },
  },
  {
    name: 'Wetter W3 · R6: Frost trifft frostempfindliche Pflanzen DRAUSSEN — Zucchini (Balkon) ja, Basilikum (Küchenfenster) nein, eine tolerante Kultur nein, ohne Kulturangabe keine Behauptung',
    lauf: () => {
      const heute = gsHeuteTag(), morgen = _gsKalTagPlus(heute, 1);
      const alt = localStorage.getItem('gs_weather_cache');
      const mp0 = myPlants.length, pl0 = plantings.length;
      try {
        const klagen = [];
        const t = [], mi = [];
        for (let i = 0; i < 3; i++) { t.push(_gsKalTagPlus(heute, i)); mi.push(i === 1 ? -1 : 8); }
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { daily: { time: t, temperature_2m_min: mi } } }));
        // Feldsalat ist winterhart (frost 1), Monstera hat keine Kultur
        myPlants.push({ id: 'pW3a', name: 'Feldsalat', tasks: {} });
        myPlants.push({ id: 'pW3b', name: 'Monstera', tasks: {} });
        const ev = gsKalenderEreignisse(heute, _gsKalTagPlus(heute, 2));
        const fr = ev.find(e => e.art === 'wetter' && e.datum === morgen && /^frost:/.test(e.id));
        if (!fr) return { ok: false, warum: 'kein Frost-Ereignis für morgen — Grundlage fehlt' };
        const h = (fr.hinweise || []).find(x => x.regel === 'frost_pflanzen');
        if (!h || h.zustand !== 'verletzt') return { ok: false, warum: 'kein verletzter Hinweis „frost_pflanzen" am Frost-Ereignis: ' + JSON.stringify(fr.hinweise || null) };
        if (!/Zucchini/.test(h.text)) klagen.push('die Zucchini (Balkon, frostempfindlich) wird nicht genannt: „' + h.text + '"');
        if (/Basilikum/.test(h.text)) klagen.push('Basilikum steht am Küchenfenster und wird trotzdem genannt');
        if (/Feldsalat/.test(h.text)) klagen.push('Feldsalat ist winterhart (frost 1) und wird trotzdem genannt');
        if (/Monstera/.test(h.text)) klagen.push('Monstera hat keine Kulturangabe — über sie wird nichts behauptet');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '„' + h.text + '"' };
      } finally { myPlants.length = mp0; plantings.length = pl0; if (alt == null) localStorage.removeItem('gs_weather_cache'); else localStorage.setItem('gs_weather_cache', alt); }
    },
  },
  {
    name: 'Wetter W4 · das Warnfenster liest denselben Zwischenspeicher — mit Hitze zeigt es sie, ohne Vorhersage sagt es das, nie „alles im grünen Bereich"',
    lauf: async () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_weather_cache');
      try {
        const klagen = [];
        const t = [], mi = [], ma = [], ps = [], wd = [];
        for (let i = 0; i < 3; i++) { t.push(_gsKalTagPlus(heute, i)); mi.push(8); ma.push(i === 1 ? 33 : 20); ps.push(0); wd.push(10); }
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { daily: { time: t, temperature_2m_min: mi, temperature_2m_max: ma, precipitation_sum: ps, windspeed_10m_max: wd } } }));
        await gsOpenWeatherWarn();
        let txt = (document.getElementById('gs-nl-modal') || document.body).textContent || '';
        if (!/33/.test(txt)) klagen.push('die Hitze aus dem Zwischenspeicher steht nicht im Fenster');
        if (/grünen Bereich/.test(txt)) klagen.push('„alles im grünen Bereich" trotz Hitze');
        localStorage.removeItem('gs_weather_cache');
        await gsOpenWeatherWarn();
        txt = (document.getElementById('gs-nl-modal') || document.body).textContent || '';
        if (/grünen Bereich/.test(txt)) klagen.push('ohne Vorhersage sagt das Fenster „alles im grünen Bereich" — Stille als Entwarnung');
        if (!/keine Vorhersage|noch keine Wettervorhersage|nicht geladen/i.test(txt)) klagen.push('ohne Vorhersage sagt das Fenster nicht, dass es nichts weiss: „' + txt.slice(0, 120) + '"');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'mit Cache: Hitze 33 °C · ohne Cache: sagt es, statt zu entwarnen' };
      } finally { if (alt == null) localStorage.removeItem('gs_weather_cache'); else localStorage.setItem('gs_weather_cache', alt); try { if (typeof closeModal === 'function') closeModal(); } catch (_) {} }
    },
  },
  {
    // v33.37 · KALENDER-V2 Scheibe 4a. Drei Quellen, die es in der App laengst
    // gibt und die im Kalender fehlten: der Scan-Verlauf, die Karten-Fundorte
    // und die WIRKLICHE Ernte (bisher gab es dort nur die Schaetzung).
    name: 'Drei Namen N1 · der Scan-Verlauf steht im Kalender: je Scan ein Ereignis mit Art und Datum, in der Gruppe „Messwerte & Scans" (Vorgabe aus), ein Scan aus einem anderen Jahr zählt nicht mit',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_scan_history'), altF = localStorage.getItem('gs_kal_filter');
      try {
        const klagen = [];
        localStorage.setItem('gs_scan_history', JSON.stringify([
          { name: 'Löwenzahn', lat: 'Taraxacum officinale', ts: Date.now() - 2 * 864e5, confidence: 91 },
          { name: 'Steinpilz', timestamp: new Date(Date.now() - 5 * 864e5).toISOString() },
          { name: 'Uralt', ts: Date.now() - 800 * 864e5 }
        ]));
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: [], garten: null }));
        const ev = gsKalenderEreignisse(_gsKalTagPlus(heute, -10), heute).filter(e => e.art === 'scan');
        if (ev.length !== 2) klagen.push(ev.length + ' Scan-Ereignisse in den letzten 10 Tagen statt 2 (' + ev.map(e => e.titel).join(' | ') + ')');
        const lw = ev.find(e => /Löwenzahn/.test(e.titel));
        if (!lw) klagen.push('der Löwenzahn-Scan fehlt');
        else {
          if (lw.datum !== _gsKalTagPlus(heute, -2)) klagen.push('der Scan steht am ' + lw.datum + ' statt am ' + _gsKalTagPlus(heute, -2));
          if (!lw.grund) klagen.push('das Scan-Ereignis sagt nicht, woher es kommt');
          if (!lw.verweis || !lw.verweis.fn) klagen.push('kein Weg vom Scan-Ereignis zur Art');
        }
        // Gruppe und Vorgabe
        if (typeof _gsKalArtGruppe !== 'function' || _gsKalArtGruppe('scan') !== 'messung') klagen.push('die Art „scan" hängt an keiner Gruppe oder an der falschen: ' + (typeof _gsKalArtGruppe === 'function' ? _gsKalArtGruppe('scan') : '—'));
        if (GS_KAL_AUS_VORGABE.indexOf('scan') < 0) klagen.push('„scan" ist von Anfang an sichtbar — die Vorgabe blendet Protokoll-Arten aus');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: ev.length + ' Scans im Bereich (der 800 Tage alte nicht) · Gruppe „' + _gsKalArtGruppe('scan') + '" · Vorgabe aus' };
      } finally {
        if (alt == null) localStorage.removeItem('gs_scan_history'); else localStorage.setItem('gs_scan_history', alt);
        if (altF == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', altF);
      }
    },
  },
  {
    name: 'Drei Namen N2 · Karten-Fundorte im Kalender — und der EINE Leser für ihre Zeit: die App schreibt `date`, gelesen wurde `ts/time/found_at/created_at`',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('greenscan_markers'), altF = localStorage.getItem('gs_kal_filter');
      try {
        const klagen = [];
        if (typeof _gsFundZeit !== 'function') return { ok: false, warum: '_gsFundZeit fehlt — die Zeit eines Fundorts braucht EINEN Leser' };
        // So schreibt die App (beide Schreiber): `date` in Millisekunden.
        localStorage.setItem('greenscan_markers', JSON.stringify([
          { id: 'm1', lat: 47.3, lng: 8.5, name: 'Bärlauch', cat: 'plant', date: Date.now() - 3 * 864e5 },
          { id: 'm2', lat: 47.3, lng: 8.5, name: 'Alt', cat: 'plant', date: Date.now() - 900 * 864e5 }
        ]));
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: [], garten: null }));
        if (_gsFundZeit({ date: 1700000000000 }) !== 1700000000000) klagen.push('_gsFundZeit liest das Feld `date` nicht');
        if (_gsFundZeit({}) !== null) klagen.push('_gsFundZeit gibt für einen Fundort ohne Zeit nicht null');
        const ev = gsKalenderEreignisse(_gsKalTagPlus(heute, -10), heute).filter(e => e.art === 'fund');
        if (ev.length !== 1) klagen.push(ev.length + ' Fund-Ereignisse statt 1');
        else {
          if (!/Bärlauch/.test(ev[0].titel)) klagen.push('der Fund nennt die Art nicht: „' + ev[0].titel + '"');
          if (ev[0].datum !== _gsKalTagPlus(heute, -3)) klagen.push('der Fund steht am ' + ev[0].datum);
          if (_gsKalArtGruppe('fund') !== 'rueckblick') klagen.push('die Art „fund" gehört nicht zum Rückblick: ' + _gsKalArtGruppe('fund'));
          if (GS_KAL_AUS_VORGABE.indexOf('fund') >= 0) klagen.push('Fundorte sind von Anfang an ausgeblendet — sie sind wenige und gewollt');
        }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '1 Fund im Bereich (der 900 Tage alte nicht) · „' + ev[0].titel + '"' };
      } finally {
        if (alt == null) localStorage.removeItem('greenscan_markers'); else localStorage.setItem('greenscan_markers', alt);
        if (altF == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', altF);
      }
    },
  },
  {
    name: 'Drei Namen N3 · die WIRKLICHE Ernte steht im Kalender (quelle hand) und ist von der Schätzung (quelle regel) unterscheidbar — mit Menge und Einheit',
    lauf: () => {
      const heute = gsHeuteTag();
      const alt = localStorage.getItem('gs_ernte_log'), altF = localStorage.getItem('gs_kal_filter');
      try {
        const klagen = [];
        localStorage.setItem('gs_ernte_log', JSON.stringify([
          { id: 'e1', pflanze: 'Zucchini', emoji: '🥒', menge: 1.4, unit: 'kg', ts: new Date(Date.now() - 4 * 864e5).toISOString() }
        ]));
        window._gsErnteLog = null;
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: [], garten: null }));
        const ev = gsKalenderEreignisse(_gsKalTagPlus(heute, -10), heute).filter(e => e.art === 'ernte' && e.quelle === 'hand');
        if (ev.length !== 1) return { ok: false, warum: ev.length + ' Ernte-Ereignisse aus dem Log statt 1' };
        if (!/Zucchini/.test(ev[0].titel)) klagen.push('die Pflanze fehlt im Titel: „' + ev[0].titel + '"');
        if (!/1\.4|1,4/.test(ev[0].titel) || !/kg/.test(ev[0].titel)) klagen.push('Menge und Einheit fehlen im Titel: „' + ev[0].titel + '"');
        if (ev[0].datum !== _gsKalTagPlus(heute, -4)) klagen.push('die Ernte steht am ' + ev[0].datum);
        if (!ev[0].verweis || !ev[0].verweis.fn) klagen.push('kein Weg von der Ernte-Zeile zum Ernte-Fenster');
        // Die Schaetzung bleibt eine andere Quelle
        const regel = gsKalenderEreignisse(_gsKalTagPlus(heute, -120), _gsKalTagPlus(heute, 200)).filter(e => e.art === 'ernte' && e.quelle === 'regel');
        if (!regel.length) klagen.push('keine Ernte-Schätzung mehr — die beiden Quellen sollen nebeneinander stehen');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '„' + ev[0].titel + '" (hand) · ' + regel.length + ' Schätzung(en) (regel) daneben' };
      } finally {
        if (alt == null) localStorage.removeItem('gs_ernte_log'); else localStorage.setItem('gs_ernte_log', alt);
        window._gsErnteLog = null;
        if (altF == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', altF);
      }
    },
  },
  {
    name: 'Drei Namen N4 · die neuen Arten haben ihren Chip, ihre Farbe und ihren Namen — und der Chip „Messwerte & Scans" zählt beide',
    lauf: () => {
      const heute = gsHeuteTag();
      const altS = localStorage.getItem('gs_scan_history'), altF = localStorage.getItem('gs_kal_filter');
      try {
        const klagen = [];
        localStorage.removeItem('gs_kal_filter');
        localStorage.setItem('gs_scan_history', JSON.stringify([{ name: 'Löwenzahn', ts: Date.now() }]));
        // jede Art gehoert zu genau einer Gruppe — sonst faellt sie durch das Sieb
        Object.keys(_GS_KAL_ART).forEach(a => { if (!_gsKalArtGruppe(a)) klagen.push('die Art „' + a + '" hängt an keiner Gruppe'); });
        gsKalenderOeffnenAm(heute);
        const mc = document.getElementById('modal-content');
        const chip = Array.from(mc.querySelectorAll('.gs-kal-chip')).find(c => /Scan/i.test(c.textContent));
        if (!chip) return { ok: false, warum: 'kein Chip, der die Scans nennt: ' + Array.from(mc.querySelectorAll('.gs-kal-chip')).map(c => c.textContent.trim()).join(' | ') };
        if (chip.getAttribute('aria-pressed') !== 'false') klagen.push('der Protokoll-Chip ist ohne Zutun EIN');
        const m = chip.textContent.match(/(\d+)\s*$/);
        if (!m || +m[1] < 1) klagen.push('der Chip zählt den heutigen Scan nicht: „' + chip.textContent.trim() + '"');
        if (!_GS_KAL_ART.scan || !_GS_KAL_ART.fund) klagen.push('die neuen Arten haben keinen Namen in _GS_KAL_ART');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '„' + chip.textContent.trim().replace(/\s+/g, ' ') + '" · alle ' + Object.keys(_GS_KAL_ART).length + ' Arten haben eine Gruppe' };
      } finally {
        if (altS == null) localStorage.removeItem('gs_scan_history'); else localStorage.setItem('gs_scan_history', altS);
        if (altF == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', altF);
      }
    },
  },
  {
    // v33.38 · KALENDER-V2 Scheibe 4b. „Mein Naturjahr" zaehlte vier Quellen
    // SELBST — und damit anders als der Kalender: die Kachel „Arten" kannte
    // keinen Jahresfilter (sie stand unter der Ueberschrift „Mein Naturjahr
    // 2026" und zaehlte alle Scans, die es je gab), und „Funde" las ein Feld,
    // das niemand schreibt (v33.37).
    name: 'Naturjahr M1 · die Balken und die vier Kacheln kommen aus dem KALENDER — und „Arten" zählt nur dieses Jahr',
    lauf: () => {
      const jetzt = new Date(), J = jetzt.getFullYear();
      const altS = localStorage.getItem('gs_scan_history'), altM = localStorage.getItem('greenscan_markers');
      try {
        const klagen = [];
        const heuteMs = Date.now();
        localStorage.setItem('gs_scan_history', JSON.stringify([
          { name: 'Löwenzahn', ts: heuteMs - 3 * 864e5 },
          { name: 'Löwenzahn', ts: heuteMs - 4 * 864e5 },
          { name: 'Steinpilz', ts: heuteMs - 5 * 864e5 },
          { name: 'Uralt-Art', ts: heuteMs - 800 * 864e5 }        // ein anderes Jahr
        ]));
        localStorage.setItem('greenscan_markers', JSON.stringify([
          { id: 'mA', name: 'Bärlauch', lat: 47, lng: 8, date: heuteMs - 6 * 864e5 }
        ]));
        const ev = gsKalenderEreignisse(J + '-01-01', J + '-12-31');
        const zaehl = (a) => ev.filter(e => e.art === a).length;
        gsOpenNaturjahr();
        const mc = document.getElementById('modal-content');
        const txt = mc.textContent || '';
        // Die vier Kacheln stehen als Zahl ueber ihrer Beschriftung.
        const kachel = (label) => {
          const el = Array.from(mc.querySelectorAll('div')).find(d => d.children.length === 0 && d.textContent.trim() === label);
          if (!el || !el.previousElementSibling) return null;
          return parseFloat(el.previousElementSibling.textContent.replace(',', '.'));
        };
        const nScans = kachel('Scans'), nFunde = kachel('Funde'), nPfl = kachel('Gepflanzt'), nArten = kachel('Arten');
        if (nScans == null || nFunde == null) return { ok: false, warum: 'die Kacheln „Scans"/„Funde" sind nicht lesbar' };
        if (nScans !== zaehl('scan')) klagen.push('Kachel „Scans" zeigt ' + nScans + ', der Kalender hat ' + zaehl('scan') + ' Scan-Ereignisse in ' + J);
        if (nFunde !== zaehl('fund')) klagen.push('Kachel „Funde" zeigt ' + nFunde + ', der Kalender hat ' + zaehl('fund'));
        if (nPfl !== zaehl('gepflanzt')) klagen.push('Kachel „Gepflanzt" zeigt ' + nPfl + ', der Kalender hat ' + zaehl('gepflanzt'));
        if (nArten !== 2) klagen.push('Kachel „Arten" zeigt ' + nArten + ' statt 2 — der Scan aus einem anderen Jahr zählt für „Mein Naturjahr ' + J + '" nicht mit');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'Scans ' + nScans + ' = Kalender · Funde ' + nFunde + ' = Kalender · Gepflanzt ' + nPfl + ' · Arten ' + nArten + ' (ohne das Vorjahr)' };
      } finally {
        if (altS == null) localStorage.removeItem('gs_scan_history'); else localStorage.setItem('gs_scan_history', altS);
        if (altM == null) localStorage.removeItem('greenscan_markers'); else localStorage.setItem('greenscan_markers', altM);
        try { closeModal('detail-modal'); } catch (_) {}
      }
    },
  },
  {
    name: 'Naturjahr M2 · die Garten-Timeline ist im Kalender aufgegangen: der Menüeintrag öffnet ihn mit dem Rückblick, die alte Funktion gibt es nicht mehr',
    lauf: () => {
      const klagen = [];
      const altF = localStorage.getItem('gs_kal_filter');
      try {
        if (typeof window.gsOpenGardenTimeline === 'function') klagen.push('gsOpenGardenTimeline gibt es noch — zwei Oberflächen für dieselbe Frage');
        const btn = document.getElementById('mi-timeline');
        if (!btn) return { ok: false, warum: 'der Menüeintrag mi-timeline fehlt ganz — er soll zum Kalender führen, nicht verschwinden' };
        const oc = btn.getAttribute('onclick') || '';
        if (!/gsKalenderOeffnen|gsKalRueckblick/.test(oc)) klagen.push('der Menüeintrag führt nicht zum Kalender: „' + oc + '"');
        const label = btn.querySelector('.menu-item-label');
        if (label && /Timeline/i.test(label.textContent)) klagen.push('der Eintrag heisst noch „Garten-Timeline" — er öffnet jetzt den Kalender');
        // Wirklich ausfuehren: der Rueckblick muss danach sichtbar sein
        localStorage.setItem('gs_kal_filter', JSON.stringify({ aus: ['tagebuch', 'gepflanzt', 'fund'], garten: null }));
        if (typeof gsKalRueckblick === 'function') {
          gsKalRueckblick();
          const f = JSON.parse(localStorage.getItem('gs_kal_filter') || 'null');
          if (!f || ['tagebuch', 'gepflanzt', 'fund'].some(a => f.aus.indexOf(a) >= 0)) klagen.push('der Weg über den Menüeintrag schaltet den Rückblick nicht ein: ' + JSON.stringify(f));
          const mc = document.getElementById('modal-content');
          if (!mc || !mc.querySelector('.gs-kal-chip')) klagen.push('der Kalender geht dabei nicht auf');
        } else klagen.push('gsKalRueckblick fehlt');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '„' + (btn.querySelector('.menu-item-label') || {}).textContent + '" → Kalender mit eingeschaltetem Rückblick' };
      } finally { if (altF == null) localStorage.removeItem('gs_kal_filter'); else localStorage.setItem('gs_kal_filter', altF); }
    },
  },
  // ═══ KALENDER-V2 · Scheibe 6 (v33.40): die Woche ═════════════════════════
  // Gemessen am 16.09.2026 gegen v33.39, vor dem ersten Codezeichen:
  //   R9 fehlt ganz — mit „Stille Tage" bis zum 11.9. fielen SIEBEN Aufgaben in
  //   die Abwesenheit, und kein einziges Ereignis sagte es.
  //   R10 gibt es nur bei Lina, und dort als EIGENE Zählung im Kontextbauer.
  //   Und `gsWochenrueckblick` zählt mit eigenen Schleifen: ein Tagebuch-Eintrag
  //   VON HAND mit `cat: 'water'` galt ihm als „erledigte Aufgabe" (2 statt 1) —
  //   die App schrieb der Person eine Aufgabe gut, die sie nur notiert hat. Und
  //   sein rollendes ms-Fenster und das Tagesfenster des Kalenders fielen an der
  //   Grenze auseinander (2 gegen 4 Einträge).
  {
    name: 'Woche R9 · Abwesenheit trifft Aufgaben: mit „Stillen Tagen" trägt jede Aufgabe im Fenster einen Hinweis mit Datum und Weg zum Giess-Zettel; ohne Pause keiner; unlesbares Datum → nicht prüfbar',
    lauf: () => {
      const alt = localStorage.getItem('gs_push_settings');
      try {
        const klagen = [];
        const heute = gsHeuteTag();
        const setz = (v) => { const s = JSON.parse(alt || '{}') || {}; if (v === null) delete s.pauseUntil; else s.pauseUntil = v; localStorage.setItem('gs_push_settings', JSON.stringify(s)); };
        // 1 · Pause bis in 10 Tagen
        setz(new Date(Date.now() + 10 * 864e5).toISOString());
        const bis = _gsKalTagPlus(heute, 10);
        let ev = gsKalenderEreignisse(heute, _gsKalTagPlus(heute, 14));
        const drin = ev.filter(e => e.art === 'aufgabe' && e.datum <= bis);
        const draussen = ev.filter(e => e.art === 'aufgabe' && e.datum > bis);
        if (!drin.length) return { ok: false, warum: 'keine Aufgabe im Abwesenheitsfenster — der Fall misst nichts' };
        const ohneHinweis = drin.filter(e => !(e.hinweise || []).some(h => h.regel === 'abwesenheit' && h.zustand === 'verletzt'));
        if (ohneHinweis.length) klagen.push(ohneHinweis.length + ' von ' + drin.length + ' Aufgaben im Fenster ohne Abwesenheits-Hinweis');
        const h0 = drin[0].hinweise.find(h => h.regel === 'abwesenheit');
        if (h0 && !/\d+\.\d+\./.test(h0.text + ' ' + h0.grund)) klagen.push('der Hinweis nennt das Ende der Pause nicht: ' + JSON.stringify(h0));
        if (h0 && !/Giess|Zettel/i.test(h0.text + ' ' + h0.grund)) klagen.push('der Hinweis nennt den Giess-Zettel nicht: ' + JSON.stringify(h0));
        if (draussen.some(e => (e.hinweise || []).some(h => h.regel === 'abwesenheit' && h.zustand === 'verletzt')))
          klagen.push('eine Aufgabe NACH der Pause traegt trotzdem den Hinweis');
        // 2 · Ohne Pause kein Feld — nicht „erfuellt", sondern gar nichts
        setz(null);
        ev = gsKalenderEreignisse(heute, _gsKalTagPlus(heute, 14));
        if (ev.some(e => (e.hinweise || []).some(h => h.regel === 'abwesenheit')))
          klagen.push('ohne Pause traegt eine Aufgabe ein Abwesenheits-Feld — keine Pause ist kein Zustand');
        // 3 · Unlesbares Datum → nicht pruefbar MIT Grund, nie stillschweigend
        setz('morgen irgendwann');
        ev = gsKalenderEreignisse(heute, _gsKalTagPlus(heute, 14));
        const np = ev.flatMap(e => (e.hinweise || [])).filter(h => h.regel === 'abwesenheit');
        if (!np.length) klagen.push('unlesbares pauseUntil ergibt gar kein Feld — „Datum unlesbar" muss dastehen');
        else if (np[0].zustand !== 'nicht_pruefbar') klagen.push('unlesbares pauseUntil ergibt „' + np[0].zustand + '" statt nicht_pruefbar');
        else if (!/unlesbar|nicht lesbar/i.test(np[0].grund || '')) klagen.push('der Grund sagt nicht, dass das Datum unlesbar ist: ' + np[0].grund);
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: drin.length + ' Aufgaben im Fenster bis ' + bis + ', alle mit Hinweis („' + (h0.text || '').slice(0, 50) + '") · ohne Pause kein Feld · unlesbar → nicht prüfbar' };
      } finally { if (alt == null) localStorage.removeItem('gs_push_settings'); else localStorage.setItem('gs_push_settings', alt); }
    },
  },
  {
    name: 'Woche R10 · EINE Rechnung für die Woche: _gsKalWoche zählt eintragsgenau gegen gsKalenderEreignisse — vorwärts und rückwärts, mit drei Zuständen',
    lauf: () => {
      const klagen = [];
      if (typeof _gsKalWoche !== 'function') return { ok: false, warum: '_gsKalWoche fehlt — die Woche wird an jeder Anzeige neu gezählt' };
      const heute = gsHeuteTag(), bis = _gsKalTagPlus(heute, 6);
      const w = _gsKalWoche();
      const ev = gsKalenderEreignisse(heute, bis);
      const z = (a) => ev.filter(e => e.art === a).length;
      if (w.aufgaben !== z('aufgabe') + z('alarm') + z('erinnerung')) klagen.push('aufgaben ' + w.aufgaben + ' ≠ ' + (z('aufgabe') + z('alarm') + z('erinnerung')));
      if (w.aussaat !== z('aussaat')) klagen.push('aussaat ' + w.aussaat + ' ≠ ' + z('aussaat'));
      if (w.wetter !== z('wetter')) klagen.push('wetter ' + w.wetter + ' ≠ ' + z('wetter'));
      const hinw = ev.filter(e => (e.hinweise || []).some(h => h.zustand === 'verletzt')).length;
      if (w.hinweise !== hinw) klagen.push('hinweise ' + w.hinweise + ' ≠ ' + hinw);
      // rueckwaerts
      const rueck = gsKalenderEreignisse(_gsKalTagPlus(heute, -7), heute);
      const erledigt = rueck.filter(e => e.art === 'tagebuch' && e.quelle === 'regel').length;
      if (w.erledigt !== erledigt) klagen.push('erledigt ' + w.erledigt + ' ≠ ' + erledigt + ' (tagebuch mit quelle regel in 7 Tagen)');
      // Frost: drei Zustaende
      const altC = localStorage.getItem('gs_weather_cache');
      try {
        localStorage.removeItem('gs_weather_cache');
        const ohne = _gsKalWoche();
        if (ohne.frost !== null) klagen.push('ohne Vorhersage ist frost ' + JSON.stringify(ohne.frost) + ' statt null — „keine Vorhersage" ist nicht „kein Frost"');
        if (!/Vorhersage/i.test(ohne.frost_grund || '')) klagen.push('ohne Vorhersage fehlt der Grund: ' + ohne.frost_grund);
      } finally { if (altC == null) localStorage.removeItem('gs_weather_cache'); else localStorage.setItem('gs_weather_cache', altC); }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: w.aufgaben + ' Aufgaben · ' + w.aussaat + ' Aussaat · ' + w.wetter + ' Wetter · ' + w.hinweise + ' Hinweise · ' + w.erledigt + ' erledigt' };
    },
  },
  {
    name: 'Woche R10b · die Zeile steht an DREI Stellen und sagt überall dasselbe: Startseite, Kalender-Fuss, Linas Kontext — und ohne Pflanzen entfällt sie',
    lauf: () => {
      const klagen = [];
      if (typeof _gsKalWocheZeile !== 'function') return { ok: false, warum: '_gsKalWocheZeile fehlt — jede Anzeige formuliert ihre eigene Zeile' };
      const zeile = _gsKalWocheZeile();
      if (!zeile) return { ok: false, warum: 'keine Wochenzeile, obwohl es Pflanzen und Ereignisse gibt' };
      // 1 · Startseite
      try { switchTab('home'); if (typeof gsBuildWidgetStack === 'function') gsBuildWidgetStack(); } catch (_) {}
      const home = (document.getElementById('screen-home') || {}).textContent || '';
      if (home.indexOf(zeile) < 0) klagen.push('die Startseite zeigt die Zeile nicht: „' + zeile.slice(0, 60) + '"');
      // 2 · Kalender-Fuss
      try { gsKalenderOeffnen(); } catch (_) {}
      const mc = (document.getElementById('modal-content') || {}).textContent || '';
      if (mc.indexOf(zeile) < 0) klagen.push('der Kalender-Fuss zeigt die Zeile nicht');
      try { closeModal('detail-modal'); } catch (_) {}
      // 3 · Lina — dieselbe Rechnung, nicht eine zweite
      const lz = (gsLinaZahlen().match(/^Diese Woche:[^\n]*|^Nächste 7 Tage:[^\n]*/m) || [''])[0];
      if (!lz) klagen.push('Linas Kontext hat keine Wochenzeile');
      else {
        const zahlen = (s) => (String(s).match(/\d+/g) || []).join(',');
        if (zahlen(lz) !== zahlen(zeile)) klagen.push('Lina nennt andere Zahlen als die Zeile: „' + lz + '" gegen „' + zeile + '"');
      }
      // 4 · Ohne Pflanzen entfaellt sie — ein „0 Aufgaben" ohne Pflanzen ist keine Aussage
      const s = { mp: myPlants, pl: plantings };
      try {
        window.myPlants = []; window.plantings = [];
        if (_gsKalWocheZeile()) klagen.push('ohne Pflanzen steht trotzdem eine Wochenzeile: ' + _gsKalWocheZeile());
      } finally { window.myPlants = s.mp; window.plantings = s.pl; }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '„' + zeile + '" — Startseite, Kalender-Fuss und Lina, dieselben Zahlen · ohne Pflanzen keine Zeile' };
    },
  },
  {
    name: 'Woche R10c · der Wochenrückblick LIEST den Kalender: eine von Hand notierte Aufgabe ist keine erledigte, und das Fenster ist dasselbe',
    lauf: () => {
      const alt = localStorage.getItem('gs_gartentagebuch');
      try {
        const klagen = [];
        const heute = gsHeuteTag();
        const tb = gsTagebuchLoad(true);
        // Ein Eintrag VON HAND mit einer Aufgaben-Kategorie: er ist eine Notiz,
        // keine erledigte Aufgabe. Gemessen gegen v33.39: der Rueckblick
        // schrieb ihn der Person als „erledigt" gut (2 statt 1).
        tb.unshift({ id: 'r10c_hand', ts: new Date(Date.now() - 2 * 864e5).toISOString(), date: '30.8.',
                     text: 'Basilikum gegossen (selbst notiert)', cat: 'water', emoji: '💧', quelle: 'hand' });
        // Und einer knapp AUSSERHALB des Tagesfensters (−7 Tage minus eine Stunde)
        tb.unshift({ id: 'r10c_rand', ts: new Date(Date.now() - 7 * 864e5 - 3600e3).toISOString(), date: 'Rand',
                     text: 'Knapp ausserhalb', cat: 'note', quelle: 'hand' });
        gsTagebuchSave();
        const rueck = gsKalenderEreignisse(_gsKalTagPlus(heute, -7), heute);
        const erledigt = rueck.filter(e => e.art === 'tagebuch' && e.quelle === 'regel').length;
        const tagebuch = rueck.filter(e => e.art === 'tagebuch').length;
        const w = gsWochenrueckblick();
        const zE = (w.zeilen || []).find(z => /erledigt/.test(z)) || '';
        const zT = (w.zeilen || []).find(z => /Tagebuch/.test(z)) || '';
        const n = (s) => { const m = String(s).match(/(\d+)/); return m ? Number(m[1]) : null; };
        if (n(zE) !== erledigt) klagen.push('„erledigt": Rückblick sagt ' + n(zE) + ', der Kalender ' + erledigt + ' — eine von Hand notierte Aufgabe ist keine erledigte');
        const notizen = tagebuch - erledigt;
        if (notizen > 0 && n(zT) !== notizen) klagen.push('„Tagebuch": Rückblick sagt ' + n(zT) + ', der Kalender ' + notizen + ' — zwei Fenster für eine Woche');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: erledigt + ' erledigt · ' + notizen + ' Notizen — Rückblick und Kalender zählen dieselben Einträge im selben Fenster' };
      } finally { if (alt == null) localStorage.removeItem('gs_gartentagebuch'); else localStorage.setItem('gs_gartentagebuch', alt); try { gsTagebuchLoad(true); } catch (_) {} }
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
