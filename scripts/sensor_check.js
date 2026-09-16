#!/usr/bin/env node
// sensor_check.js — funktioniert das Messwerte-Dashboard, bevor es ein Geraet gibt?
//
//   node scripts/sensor_check.js
//
// Entwurf: docs/OEKOSYSTEM-V1.md, Vertrag in §9a. Stufe 0 hat KEINE Hardware —
// die Person ist das erste Geraet (§4). Dieser Stand stellt ein Geraet von
// Hand, traegt Werte ein (plausible, unplausible, bei vollem Speicher), legt
// eine Regel an und liest das gerenderte Dashboard. Regeln aus dem Entwurf,
// die er festhaelt:
//
//   1. Kein Messwert wird verworfen — unplausibel ist eine Qualitaet.
//   2. Eine Regel hat DREI Zustaende; ohne Werte ist sie „nicht pruefbar".
//   3. Kein `if (metric === …)` — alles aus dem Katalog; der Katalog ist nie leer.
//   4. Bei vollem Speicher sagt die Funktion es (CLAUDE.md §3.5) — nicht „gespeichert".
//   5. Die Anzeige wird aus dem HTML gelesen, nicht aus dem Objekt.
//
// Geschrieben VOR dem Code (test-first): der erste Lauf muss rot sein.
'use strict';
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

// wie kalender_check: fester Zeitpunkt, auf den _seed.js seit v33.02 selbst
// ankert (setFixedTime laeuft vor addInitScript)
const HEUTE_MS = 1756684800000 + 12 * 3600 * 1000;

const FAELLE = [
  {
    name: 'Katalog · ist ohne Netz da und nennt elf Messgrössen mit Einheit und Bereich',
    lauf: () => {
      if (typeof gsMetricKatalog !== 'function') return { ok: false, warum: 'gsMetricKatalog fehlt' };
      const k = gsMetricKatalog();
      if (!Array.isArray(k) || k.length < 11) return { ok: false, warum: 'Katalog hat ' + (k && k.length) + ' Einträge statt ≥ 11' };
      const kaputt = k.filter(m => !m.key || !m.unit || !m.label_de || typeof m.min_valid !== 'number' || typeof m.max_valid !== 'number');
      if (kaputt.length) return { ok: false, warum: kaputt.length + ' Einträge ohne key/unit/label_de/min/max' };
      if (!k.some(m => m.key === 'soil_moisture')) return { ok: false, warum: 'soil_moisture fehlt' };
      return { ok: true, info: k.length + ' Grössen, alle vollständig' };
    },
  },
  {
    name: 'Gerät · von Hand angelegt, „wartet auf Signal" bis zum ersten Wert',
    lauf: () => {
      if (typeof gsGeraetAnlegen !== 'function') return { ok: false, warum: 'gsGeraetAnlegen fehlt' };
      const g = gsGeraetAnlegen({ kind: 'manual', name: 'Hochbeet Nord', garden_id: 'g1' });
      if (!g || !g.id) return { ok: false, warum: 'kein Gerät zurück' };
      window.__G = g.id;
      const alle = gsGeraete();
      if (!alle.some(x => x.id === g.id)) return { ok: false, warum: 'das Gerät steht nicht in gsGeraete()' };
      if (g.status !== 'wartet') return { ok: false, warum: 'Status „' + g.status + '" statt „wartet" — verbunden heisst erst nach dem ersten Wert' };
      return { ok: true, info: g.name + ' · ' + g.kind + ' · ' + g.status };
    },
  },
  {
    name: 'Messwert · plausibel wird angenommen, unplausibel wird NICHT verworfen (quality 1)',
    lauf: () => {
      const a = gsMesswertEintragen(window.__G, 'soil_moisture', 31.5);
      if (!a || !a.ok || a.quality !== 2) return { ok: false, warum: '31.5 % → ' + JSON.stringify(a) };
      const b = gsMesswertEintragen(window.__G, 'soil_moisture', 250);
      if (!b || !b.ok) return { ok: false, warum: '250 % wurde verworfen — ein kaputter Sensor ist eine Information' };
      if (b.quality !== 1) return { ok: false, warum: '250 % hat quality ' + b.quality + ' statt 1' };
      const c = gsMesswertEintragen(window.__G, 'gibt_es_nicht', 1);
      if (!c || c.ok) return { ok: false, warum: 'eine unbekannte Messgrösse wurde angenommen' };
      if (!c.grund || !/Katalog/.test(c.grund)) return { ok: false, warum: 'die Absage nennt den Katalog nicht' };
      const w = gsMesswerte(window.__G, 'soil_moisture');
      if (w.length !== 2) return { ok: false, warum: w.length + ' Werte gespeichert statt 2' };
      const g = gsGeraete().find(x => x.id === window.__G);
      if (!g || g.status !== 'active') return { ok: false, warum: 'nach dem ersten Wert ist das Gerät nicht „active"' };
      return { ok: true, info: '2 Werte, quality 2 und 1 · unbekannte Grösse abgelehnt · Gerät active' };
    },
  },
  {
    name: 'Voller Speicher · die Funktion sagt es, statt „gespeichert" zu melden',
    lauf: () => {
      const orig = localStorage.setItem; window.__LOG = [];
      localStorage.setItem = function (k, v) { window.__LOG.push(String(k)); return false; };
      let r; try { r = gsMesswertEintragen(window.__G, 'soil_temp', 18.2); } finally { localStorage.setItem = orig; }
      if (!window.__LOG.some(k => k === 'gs_messwerte')) return { ok: false, warum: 'kein Schreibversuch auf gs_messwerte — Fall nicht hergestellt' };
      if (!r || r.ok !== false) return { ok: false, warum: 'meldet ' + JSON.stringify(r) + ' bei vollem Speicher' };
      if (!r.grund || !/Speicher/.test(r.grund)) return { ok: false, warum: 'die Absage nennt den Speicher nicht' };
      if (gsMesswerte(window.__G, 'soil_temp').length) return { ok: false, warum: 'der Wert liegt trotzdem im Speicher' };
      return { ok: true, info: 'ok:false · „' + r.grund + '"' };
    },
  },
  {
    name: 'Regel · drei Zustände: verletzt, erfüllt, und ohne Werte „nicht prüfbar"',
    lauf: () => {
      if (typeof gsRegelAnlegen !== 'function' || typeof gsRegelnPruefen !== 'function') return { ok: false, warum: 'gsRegelAnlegen/gsRegelnPruefen fehlen' };
      // verletzt: Feuchte unter 40, letzter plausibler Wert 31.5 (der 250er zählt nicht)
      const r1 = gsRegelAnlegen({ geraet_id: window.__G, metric: 'soil_moisture', op: 'below', threshold: 40, action: 'notify' });
      if (!r1 || !r1.id) return { ok: false, warum: 'Regel nicht angelegt' };
      let z = gsRegelnPruefen(window.__G);
      const a = z.find(x => x.regel_id === r1.id);
      if (!a || a.zustand !== 'verletzt') return { ok: false, warum: 'unter 40 mit 31.5 → ' + (a && a.zustand) + ' (' + (a && a.grund) + ')' };
      if (!a.grund || !/31\.5/.test(a.grund)) return { ok: false, warum: 'der Grund nennt den Wert nicht: ' + a.grund };
      // erfüllt: Schwelle 20
      const r2 = gsRegelAnlegen({ geraet_id: window.__G, metric: 'soil_moisture', op: 'below', threshold: 20, action: 'notify' });
      z = gsRegelnPruefen(window.__G);
      const b = z.find(x => x.regel_id === r2.id);
      if (!b || b.zustand !== 'erfuellt') return { ok: false, warum: 'unter 20 mit 31.5 → ' + (b && b.zustand) };
      // nicht prüfbar: keine Werte für air_temp
      const r3 = gsRegelAnlegen({ geraet_id: window.__G, metric: 'air_temp', op: 'above', threshold: 30, action: 'notify' });
      z = gsRegelnPruefen(window.__G);
      const c = z.find(x => x.regel_id === r3.id);
      if (!c || c.zustand !== 'nicht_pruefbar') return { ok: false, warum: 'ohne Werte → ' + (c && c.zustand) + ' — Stille ist kein „erfüllt"' };
      return { ok: true, info: 'verletzt (31.5 < 40) · erfüllt · nicht prüfbar ohne Werte' };
    },
  },
  {
    name: 'Dashboard · Kacheln, Verlauf und Regeln werden aus dem HTML gelesen',
    lauf: () => {
      if (typeof gsMesswerteOeffnen !== 'function') return { ok: false, warum: 'gsMesswerteOeffnen fehlt' };
      gsMesswerteOeffnen();
      const mc = document.getElementById('modal-content');
      const t = (mc && mc.textContent) || '';
      if (!/Hochbeet Nord/.test(t)) return { ok: false, warum: 'das Gerät steht nicht im Dashboard' };
      if (!/Bodenfeuchte/.test(t)) return { ok: false, warum: 'die Messgrösse heisst nicht nach dem Katalog (Bodenfeuchte)' };
      if (!/31[.,]5/.test(t)) return { ok: false, warum: 'der letzte plausible Wert (31.5) fehlt' };
      if (!/ausserhalb|unplausibel/i.test(t)) return { ok: false, warum: 'der unplausible Wert wird nicht als solcher gezeigt' };
      const cv = mc.querySelector('canvas.gs-mw-verlauf');
      if (!cv) return { ok: false, warum: 'kein Verlaufs-Diagramm (canvas.gs-mw-verlauf)' };
      if (cv.width < 100 || cv.height < 40) return { ok: false, warum: 'Diagramm ' + cv.width + '×' + cv.height };
      if (!cv.getAttribute('aria-label') && !cv.getAttribute('role')) return { ok: false, warum: 'das Diagramm hat keinen Namen für Screenreader' };
      // Der unplausible 250er darf die Achse nicht auf 270 ziehen — er wird am
      // Rand gezeigt, die Skala folgt den plausiblen Werten (und der Schwelle).
      const vmax = Number(cv.dataset.vmax);
      if (!isFinite(vmax)) return { ok: false, warum: 'das Diagramm nennt seine Skala nicht (data-vmax)' };
      if (vmax > 100) return { ok: false, warum: 'die Achse reicht bis ' + vmax + ' — ein unplausibler Wert (250) bestimmt die Skala und quetscht die Linie' };
      if (!/verletzt|unter 40/i.test(t)) return { ok: false, warum: 'die verletzte Regel steht nicht im Dashboard' };
      if (!/nicht prüfbar/i.test(t)) return { ok: false, warum: 'die nicht prüfbare Regel wird nicht als solche genannt' };
      if (/undefined|NaN|\[object Object\]/.test(t)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: 'Gerät · Bodenfeuchte 31.5 · unplausibel markiert · Diagramm ' + cv.width + '×' + cv.height + ' · Regeln mit Zustand' };
    },
  },
  {
    name: 'Kalender · ein Messwert von Hand ist ein Ereignis der Art „messung", ein Alarm der Art „alarm"',
    lauf: () => {
      const heute = gsHeuteTag();
      const ev = gsKalenderEreignisse(heute, heute);
      const m = ev.filter(e => e.art === 'messung');
      if (!m.length) return { ok: false, warum: 'kein Ereignis der Art messung am heutigen Tag' };
      if (!m.some(e => /Hochbeet Nord/.test((e.grund || '') + ' ' + (e.titel || '')))) return { ok: false, warum: 'das Messung-Ereignis nennt das Gerät nicht' };
      const a = ev.find(e => e.art === 'alarm');
      if (!a) return { ok: false, warum: 'die verletzte Regel erscheint nicht als Alarm' };
      if (a.status === 'info') return { ok: false, warum: 'ein Alarm ist keine Info' };
      return { ok: true, info: m.length + ' Messung(en) · 1 Alarm' };
    },
  },
  {
    name: 'Speicherorte · die neuen Schlüssel stehen in den Listen (Abmelden räumt, Katalog bleibt)',
    lauf: () => {
      const user = (typeof GS_USER_KEYS !== 'undefined') ? GS_USER_KEYS : [];
      const keep = (typeof GS_KEEP_ON_LOGOUT !== 'undefined') ? GS_KEEP_ON_LOGOUT : [];
      const fehlt = ['gs_geraete', 'gs_geraete_regeln', 'gs_messwerte'].filter(k => user.indexOf(k) < 0);
      if (fehlt.length) return { ok: false, warum: 'nicht in GS_USER_KEYS: ' + fehlt.join(', ') + ' — überleben das Abmelden auf einem geteilten Gerät' };
      if (keep.indexOf('gs_metric_catalog') < 0) return { ok: false, warum: 'gs_metric_catalog nicht in GS_KEEP_ON_LOGOUT (öffentlicher Katalog)' };
      return { ok: true, info: 'drei Nutzer-Schlüssel, ein bleibender' };
    },
  },
  {
    // v32.51: Das Backup (exportUserData, Version 16) nimmt die Messwerte-
    // Schicht mit. Bis v32.50 fehlte sie — die einzige Kopie einer
    // Handmessung ist das Geraet. Muster save_check: exportieren → Speicher
    // leeren → einspielen → Feld fuer Feld vergleichen; zweimal einspielen
    // erzeugt kein Doppel; bei vollem Speicher SAGT es die Funktion.
    name: 'Backup · Geräte, Regeln und Messwerte reisen mit — und kommen Feld für Feld zurück',
    lauf: () => {
      if (typeof _gsBackupDaten !== 'function' || typeof _gsBackupEinspielen !== 'function') return { ok: false, warum: '_gsBackupDaten/_gsBackupEinspielen fehlen — das Backup kennt die Messwerte nicht' };
      const g = gsGeraetAnlegen({ kind: 'manual', name: 'Backup-Probe', garden_id: 'g1' });
      if (!g || !g.id) return { ok: false, warum: 'Gerät nicht angelegt' };
      const e = gsMesswertEintragen(g.id, 'soil_moisture', 37.5);
      if (!e || !e.ok) return { ok: false, warum: 'Messwert nicht eingetragen: ' + (e && e.grund) };
      gsRegelAnlegen({ geraet_id: g.id, metric: 'soil_moisture', op: 'below', threshold: 20, action: 'notify' });
      const vorher = { geraete: gsGeraete().length, regeln: gsRegeln().length, werte: _gsMesswerteAlle().length };
      const b = _gsBackupDaten();
      if (!(b.version >= 16)) return { ok: false, warum: 'Backup-Version ' + b.version + ' — die Messwerte-Schicht kam mit 16' };
      const fehlt = ['geraete', 'geraeteRegeln', 'messwerte'].filter(k => !Array.isArray(b[k]));
      if (fehlt.length) return { ok: false, warum: 'im Backup fehlen: ' + fehlt.join(', ') };
      const zaehlt = { geraete: b.geraete.length, regeln: b.geraeteRegeln.length, werte: b.messwerte.length };
      if (JSON.stringify(zaehlt) !== JSON.stringify(vorher)) return { ok: false, warum: 'Backup zählt anders als der Speicher: ' + JSON.stringify(zaehlt) + ' vs ' + JSON.stringify(vorher) };
      ['gs_geraete', 'gs_geraete_regeln', 'gs_messwerte'].forEach(k => localStorage.removeItem(k));
      if (_gsMesswerteAlle().length !== 0 || gsGeraete().length !== 0) return { ok: false, warum: 'Speicher nicht geleert — der Fall stellt den Zustand nicht her' };
      const erg = _gsBackupEinspielen(JSON.parse(JSON.stringify(b)));
      if (!erg || !erg.ok) return { ok: false, warum: 'Einspielen meldet ' + JSON.stringify(erg) };
      _gsBackupEinspielen(JSON.parse(JSON.stringify(b)));   // zweimal = kein Doppel
      const nachher = { geraete: gsGeraete().length, regeln: gsRegeln().length, werte: _gsMesswerteAlle().length };
      if (JSON.stringify(nachher) !== JSON.stringify(vorher)) return { ok: false, warum: 'nach dem Einspielen ' + JSON.stringify(nachher) + ', vorher ' + JSON.stringify(vorher) };
      const w = gsMesswerte(g.id, 'soil_moisture')[0];
      const orig = b.messwerte.find(m => m.geraet_id === g.id);
      const felder = ['geraet_id', 'metric', 'ts', 'wert', 'quality', 'quelle', 'pending'];
      const diff = felder.filter(f => !w || JSON.stringify(w[f]) !== JSON.stringify(orig[f]));
      if (diff.length) return { ok: false, warum: 'Felder nach dem Einspielen verändert: ' + diff.join(', ') };
      const echt = localStorage.setItem;
      localStorage.setItem = function () { return false; };
      let voll; try { voll = _gsBackupEinspielen(JSON.parse(JSON.stringify(b))); } finally { localStorage.setItem = echt; }
      if (!voll || voll.ok || voll.nicht_gesichert.indexOf('gs_messwerte') < 0) return { ok: false, warum: 'bei vollem Speicher meldet das Einspielen ' + JSON.stringify(voll) + ' — es müsste gs_messwerte als nicht gesichert nennen' };
      return { ok: true, info: nachher.geraete + ' Geräte · ' + nachher.regeln + ' Regeln · ' + nachher.werte + ' Werte, Feld für Feld gleich · voll → „nicht gesichert" genannt' };
    },
  },
  {
    // v32.51: Der Deckel (2'000) nahm blind die aeltesten — in Stufe 0 also
    // Handmessungen, von denen es keine Kopie gibt. Jetzt gehen zuerst die
    // hochgeladenen (pending !== true). Der Fall stellt 2'010 Werte her:
    // die 10 aeltesten ohne Kopie, dann 20 hochgeladene, der Rest ohne Kopie.
    name: 'Deckel · wirft zuerst weg, was hochgeladen ist — eine Handmessung ohne Kopie bleibt',
    lauf: () => {
      const alt = _gsMesswerteAlle();
      const g = gsGeraetAnlegen({ kind: 'manual', name: 'Deckel-Probe', garden_id: 'g1' });
      const t0 = Date.now() - 3000 * 60000;
      const arr = [];
      for (let i = 0; i < 2010; i++) arr.push({ geraet_id: g.id, metric: 'soil_moisture', ts: new Date(t0 + i * 60000).toISOString(), wert: i, quality: 2, quelle: 'hand', pending: !(i >= 10 && i < 30) });
      try {
        localStorage.setItem('gs_messwerte', JSON.stringify(arr));
        if (_gsMesswerteAlle().length !== 2010) return { ok: false, warum: 'Grundlage nicht hergestellt (' + _gsMesswerteAlle().length + ' statt 2010)' };
        const e = gsMesswertEintragen(g.id, 'soil_moisture', 50);
        if (!e || !e.ok) return { ok: false, warum: 'Eintragen scheiterte: ' + (e && e.grund) };
        const nach = _gsMesswerteAlle();
        if (nach.length !== 2000) return { ok: false, warum: 'Deckel hält nicht: ' + nach.length + ' Werte' };
        const aelteste = nach.filter(m => m.geraet_id === g.id && m.wert < 10).length;
        const hochgeladen = nach.filter(m => m.pending === false).length;
        if (aelteste !== 10) return { ok: false, warum: 'von den 10 ältesten Handmessungen ohne Kopie sind noch ' + aelteste + ' da — der Deckel nimmt blind die ältesten' };
        if (hochgeladen !== 9) return { ok: false, warum: 'hochgeladene Werte übrig: ' + hochgeladen + ' (erwartet 9 = 20 − 11)' };
        const ts = nach.map(m => m.ts);
        if (JSON.stringify(ts) !== JSON.stringify(ts.slice().sort())) return { ok: false, warum: 'Reihenfolge nicht mehr chronologisch' };
        if (!nach.some(m => m.wert === 50)) return { ok: false, warum: 'der neue Wert fehlt' };
        return { ok: true, info: '2011 → 2000: 11 hochgeladene weg, alle 10 ältesten Handmessungen da, Reihenfolge erhalten' };
      } finally {
        localStorage.setItem('gs_messwerte', JSON.stringify(alt));
      }
    },
  },
  {
    // v32.52: Dublettensperre auf (geraet_id, metric, ts) — derselbe Schluessel
    // wie der Primaerschluessel in device_readings. Zweimal derselbe Wert zur
    // selben Zeit = EIN Datensatz, und die Antwort sagt es. Und neue Ids sind
    // UUIDs (Idee 11) — die alten `ger_…` bleiben gueltig.
    name: 'Dublette · derselbe Wert zur selben Zeit wird nicht doppelt gespeichert — und die Antwort sagt es',
    lauf: () => {
      const g = gsGeraetAnlegen({ kind: 'manual', name: 'Dubletten-Probe', garden_id: 'g1' });
      if (!g || !g.id) return { ok: false, warum: 'Gerät nicht angelegt' };
      const hatUuid = !!(window.crypto && typeof crypto.randomUUID === 'function');
      if (hatUuid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(g.id)) return { ok: false, warum: 'die Geräte-Id ist keine UUID: ' + g.id };
      const ts = '2025-08-30T10:00:00.000Z';
      const a = gsMesswertEintragen(g.id, 'soil_moisture', 33, ts);
      const b = gsMesswertEintragen(g.id, 'soil_moisture', 33, ts);
      if (!a || !a.ok || a.doppelt) return { ok: false, warum: 'der erste Eintrag: ' + JSON.stringify(a) };
      if (!b || !b.ok || !b.doppelt) return { ok: false, warum: 'der zweite Eintrag sagt nicht „doppelt": ' + JSON.stringify(b) };
      if (!/nicht doppelt/.test(b.grund)) return { ok: false, warum: 'der Grund erklärt es nicht: ' + b.grund };
      const n1 = gsMesswerte(g.id, 'soil_moisture').length;
      if (n1 !== 1) return { ok: false, warum: 'zweimal eingetragen → ' + n1 + ' Datensätze statt 1' };
      const c = gsMesswertEintragen(g.id, 'soil_moisture', 34, '2025-08-30T10:05:00.000Z');
      if (!c.ok || c.doppelt) return { ok: false, warum: 'ein anderer Zeitpunkt gilt als Dublette' };
      if (gsMesswerte(g.id, 'soil_moisture').length !== 2) return { ok: false, warum: 'der zweite Zeitpunkt wurde nicht gespeichert' };
      const alle = _gsMesswerteAlle().map(m => m.ts);
      if (JSON.stringify(alle) !== JSON.stringify(alle.slice().sort())) return { ok: false, warum: 'die Liste ist nach dem Nachtragen alter Zeitpunkte nicht mehr chronologisch' };
      const r = gsRegelAnlegen({ geraet_id: g.id, metric: 'soil_moisture', op: 'below', threshold: 10 });
      if (hatUuid && !/^[0-9a-f-]{36}$/.test(r.id)) return { ok: false, warum: 'die Regel-Id ist keine UUID: ' + r.id };
      gsGeraetLoeschen(g.id);
      return { ok: true, info: 'zweimal → 1 · Antwort „doppelt" · anderer Zeitpunkt → 2 · chronologisch · Ids ' + (hatUuid ? 'UUID' : 'Rückfall (kein crypto)') };
    },
  },
  {
    // v32.52: Wetter als virtuelles Geraet (Idee 3). Der Fall STELLT den
    // Zwischenspeicher: gestern 24 Stunden, heute 24 Stunden (Uhr steht auf
    // 12:00), dazu ein Tag vor zehn Tagen. Erwartet: nur Stunden bis jetzt
    // (37 = 24 + 13), zwei Groessen (74 Werte), zweimal = einmal, Regen-Summe
    // 10 mm, nichts aelter als sieben Tage, kein Tages-Ereignis im Kalender,
    // aber die Kachel im Dashboard — und der Schalter nach dem Entfernen.
    name: 'Wetter als Gerät · nur Vergangenheit, zweimal = einmal, sieben Tage, Kachel ohne Eintrags-Formular',
    lauf: () => {
      const heute = gsHeuteTag(), gestern = _gsKalTagPlus(heute, -1), alt = _gsKalTagPlus(heute, -10);
      const time = [], temp = [], rain = [];
      [alt, gestern, heute].forEach(tag => { for (let h = 0; h < 24; h++) {
        time.push(tag + 'T' + String(h).padStart(2, '0') + ':00'); temp.push(10 + h / 2);
        rain.push((tag === heute && h === 6) ? 3 : (tag === heute && h === 9) ? 5 : (tag === gestern && h === 14) ? 2 : 0);
      } });
      const vorher = gsGeraete().length;
      try {
        localStorage.removeItem('gs_wetter_geraet_aus');
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { hourly: { time, temperature_2m: temp, precipitation: rain } } }));
        const r1 = gsWetterGeraetAbgleich();
        if (!r1 || !r1.ok) return { ok: false, warum: 'Abgleich: ' + JSON.stringify(r1) };
        const dev = gsGeraete().find(g => g.kind === 'weather');
        if (!dev) return { ok: false, warum: 'kein Gerät der Art weather' };
        if (!/Wetterdienst/.test(dev.name)) return { ok: false, warum: 'das Gerät heisst ' + dev.name };
        if (r1.neu !== 74) return { ok: false, warum: r1.neu + ' Werte übernommen (erwartet 74 = 37 Stunden × 2) — Zukunft: ' + r1.zukunft };
        if (r1.zukunft !== 11) return { ok: false, warum: 'Zukunftsstunden übersprungen: ' + r1.zukunft + ' (erwartet 11)' };
        const r2 = gsWetterGeraetAbgleich();
        if (!r2.ok || r2.neu !== 0 || r2.doppelt !== 74) return { ok: false, warum: 'zweiter Abgleich: ' + JSON.stringify(r2) + ' — zweimal muss einmal sein' };
        const regen = gsMesswerte(dev.id, 'rain'); const summe = regen.reduce((a, m) => a + m.wert, 0);
        if (Math.abs(summe - 10) > 1e-9) return { ok: false, warum: 'Regen-Summe ' + summe + ' mm statt 10' };
        const jetzt = Date.now();
        if (gsMesswerte(dev.id).some(m => new Date(m.ts).getTime() > jetzt)) return { ok: false, warum: 'ein Wert liegt in der Zukunft — eine Vorhersage ist kein Messwert' };
        if (gsMesswerte(dev.id).some(m => new Date(m.ts).getTime() < jetzt - 7 * 864e5)) return { ok: false, warum: 'Wetterwerte älter als sieben Tage blieben stehen' };
        if (gsMesswerte(dev.id).some(m => m.quelle !== 'wetterdienst')) return { ok: false, warum: 'die Quelle heisst nicht wetterdienst' };
        const ev = gsKalenderEreignisse(heute, heute);
        if (ev.some(e => e.art === 'messung' && /Wetterdienst/.test(e.titel))) return { ok: false, warum: 'der Wetterdienst erzeugt ein Tages-Ereignis „messung" — 48 Werte am Tag sind kein Ereignis' };
        if (!ev.some(e => e.art === 'wetter' && /8 mm/.test(e.titel))) return { ok: false, warum: 'das Regen-Ereignis (8 mm bis jetzt) fehlt' };
        gsMesswerteOeffnen();
        const mc = document.getElementById('modal-content'); const t = mc.textContent;
        if (!/Wetterdienst/.test(t) || !/Lufttemperatur/.test(t) || !/Niederschlag/.test(t)) return { ok: false, warum: 'die Kachel des Wetterdiensts fehlt im Dashboard oder nennt die Grössen nicht' };
        const sel = mc.querySelector('#mw-geraet');
        if (sel && Array.from(sel.options).some(o => o.value === dev.id)) return { ok: false, warum: 'der Wetterdienst steht im Eintrags-Formular — er misst selbst' };
        gsGeraetLoeschen(dev.id);
        if (localStorage.getItem('gs_wetter_geraet_aus') !== '1') return { ok: false, warum: 'nach dem Entfernen merkt sich die App die Wahl nicht' };
        const r3 = gsWetterGeraetAbgleich();
        if (r3.ok || gsGeraete().some(g => g.kind === 'weather')) return { ok: false, warum: 'entfernt — und der nächste Abgleich legt es wieder an' };
        _gsMwRender();
        const knopf = Array.from(document.getElementById('modal-content').querySelectorAll('button')).find(b => /Wieder als Gerät/.test(b.textContent));
        if (!knopf) return { ok: false, warum: 'kein Schalter „Wieder als Gerät führen" im Dashboard' };
        knopf.click();
        if (!gsGeraete().some(g => g.kind === 'weather')) return { ok: false, warum: 'der Schalter holt das Gerät nicht zurück' };
        return { ok: true, info: '74 Werte aus 37 Stunden · 11 Zukunftsstunden übersprungen · zweimal = 74 doppelt · 10 mm · Kachel da, nicht im Formular · Schalter funktioniert' };
      } finally {
        localStorage.removeItem('gs_weather_cache');
        gsGeraete().filter(g => g.kind === 'weather').forEach(g => gsGeraetLoeschen(g.id));
        localStorage.removeItem('gs_wetter_geraet_aus');
        if (gsGeraete().length !== vorher) console.warn('Wetter-Fall: Gerätezahl ' + gsGeraete().length + ' statt ' + vorher);
      }
    },
  },
  {
    // v32.52: Der Katalog kommt vom Server (Idee 2) — ersetzt wird NUR bei
    // Erfolg; ein Fehler (Migration nicht angewandt), eine leere oder eine
    // unvollstaendige Antwort lassen stehen, was da ist. Gestellter sbFetch.
    name: 'Katalog · vom Server geladen, nur bei Erfolg ersetzt — ohne Server bleibt der Startbestand',
    lauf: async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn;
      try {
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async () => ({ data: null, error: { message: 'relation "public.metric_catalog" does not exist', status: 404 } });
        const r1 = await gsMetricKatalogLaden();
        if (!r1 || r1.ok) return { ok: false, warum: 'ein 404 gilt als Erfolg: ' + JSON.stringify(r1) };
        if (gsMetricKatalog().length !== 11) return { ok: false, warum: 'nach dem Fehler ' + gsMetricKatalog().length + ' Grössen statt 11' };
        const zwoelf = GS_METRIC_KATALOG_START.map(k => Object.assign({ label_fr: null, label_it: null, label_en: null }, k))
          .concat([{ key: 'co2', unit: 'ppm', min_valid: 0, max_valid: 5000, label_de: 'CO₂', label_fr: 'CO₂', label_it: 'CO₂', label_en: 'CO₂', icon: '🫧', aggregation: 'avg', decimals: 0, sort: 55 }]);
        window.sbFetch = async () => ({ data: zwoelf, error: null });
        const r2 = await gsMetricKatalogLaden();
        if (!r2 || !r2.ok || r2.n !== 12) return { ok: false, warum: 'Laden: ' + JSON.stringify(r2) };
        if (gsMetricKatalog().length !== 12 || !_gsMetric('co2')) return { ok: false, warum: 'die zwölfte Grösse kommt nicht an' };
        if (!localStorage.getItem('gs_metric_catalog_at')) return { ok: false, warum: 'das Datum der Momentaufnahme fehlt' };
        gsMesswerteOeffnen();
        const t = document.getElementById('modal-content').textContent;
        if (!/CO₂/.test(t)) return { ok: false, warum: 'das Dashboard bietet die zwölfte Grösse nicht an (aus dem HTML gelesen)' };
        const e = gsMesswertEintragen(gsGeraete()[0].id, 'co2', 640);
        if (!e.ok) return { ok: false, warum: 'ein Wert der neuen Grösse wird abgelehnt: ' + e.grund };
        window.sbFetch = async () => ({ data: [], error: null });
        const r3 = await gsMetricKatalogLaden();
        if (r3.ok || gsMetricKatalog().length !== 12) return { ok: false, warum: 'eine leere Antwort ersetzt den Katalog' };
        window.sbFetch = async () => ({ data: [{ key: 'x' }, { key: 'y' }, { key: 'z' }], error: null });
        const r4 = await gsMetricKatalogLaden();
        if (r4.ok || gsMetricKatalog().length !== 12) return { ok: false, warum: 'unvollständige Zeilen ersetzen den Katalog' };
        return { ok: true, info: '404 → 11 bleiben · 12 Zeilen → 12, im Dashboard, Wert angenommen · leer/unvollständig → bleibt' };
      } finally {
        window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin;
        localStorage.removeItem('gs_metric_catalog'); localStorage.removeItem('gs_metric_catalog_at');
        localStorage.setItem('gs_messwerte', JSON.stringify(_gsMesswerteAlle().filter(m => m.metric !== 'co2')));
      }
    },
  },
  {
    // v32.53: Regel-Aktion task:water → Aufgabe (OEKOSYSTEM-V1.md §6, §11 Idee 4).
    // Die eine Stelle, die device_rules.action liest. Drei Zustaende: ohne
    // plausible Werte passiert NICHTS; verletzt zieht auf heute vor (Tagesplan,
    // Kalender, Glocke nennen Geraet und Messwert); erfuellt gibt frei. Die
    // Verschiebung der Person gewinnt. Erledigen hebt auf. Und ein Geraet am
    // GARTEN trifft die Pflanzungen — gespeichert in gs_plantings, nicht ps_myplants.
    name: 'Regel → Aufgabe · „unter 30 → Giessen" zieht vor, gibt frei, und die Verschiebung der Person gewinnt',
    lauf: () => {
      const p2 = myPlants.find(x => x && x.id === 'p2'); const zuc = plantings.find(x => x && x.id === 'plant_seed_1');
      if (!p2 || !zuc) return { ok: false, warum: 'Beispieldaten fehlen (p2 / plant_seed_1)' };
      const merk = JSON.stringify(p2.tasks.water), merkZ = JSON.stringify(zuc.tasks.water), merkDiary = JSON.stringify(p2.diary || []);
      const g = gsGeraetAnlegen({ kind: 'manual', name: 'Monstera-Stab', plant_id: 'p2' });
      const gg = gsGeraetAnlegen({ kind: 'manual', name: 'Hochbeet-Stab', garden_id: 'g1' });
      let r2 = null;
      try {
        if (gsGetDueTasks().some(x => x.plant.id === 'p2' && x.key === 'water')) return { ok: false, warum: 'Grundlage: Monstera-Giessen ist schon fällig' };
        const r = gsRegelAnlegen({ geraet_id: g.id, metric: 'soil_moisture', op: 'below', threshold: 30, action: 'task:water' });
        r2 = gsRegelAnlegen({ geraet_id: gg.id, metric: 'soil_moisture', op: 'below', threshold: 30, action: 'task:water' });
        if (!r || !r2 || r.action !== 'task:water') return { ok: false, warum: 'Regel mit Aktion nicht angelegt' };
        gsSensorAufgabenAbgleich();
        if (p2.tasks.water.vorgezogenAuf) return { ok: false, warum: 'ohne Werte (nicht prüfbar) wurde vorgezogen' };
        gsMesswertEintragen(g.id, 'soil_moisture', 22);
        const e = gsGetDueTasks().find(x => x.plant.id === 'p2' && x.key === 'water');
        if (!e || e.days > 0) return { ok: false, warum: 'Monstera-Giessen ist nach 22 % nicht fällig (days ' + (e && e.days) + ')' };
        if (!e.sensor || !/22/.test(e.sensor) || !/Monstera-Stab/.test(e.sensor)) return { ok: false, warum: 'der Eintrag nennt Gerät und Messwert nicht: ' + e.sensor };
        const kal = gsKalenderEreignisse(gsHeuteTag(), gsHeuteTag()).find(x => x.art === 'aufgabe' && x.pflanze && x.pflanze.id === 'p2' && x.key === 'water');
        if (!kal || kal.quelle !== 'sensor' || !/vorgezogen/.test(kal.grund)) return { ok: false, warum: 'der Kalender führt die Aufgabe nicht mit Quelle sensor: ' + JSON.stringify(kal && [kal.quelle, kal.grund]) };
        gsRenderDayPlan();
        if (!/Monstera-Stab/.test((document.getElementById('home-dayplan') || {}).textContent || '')) return { ok: false, warum: '„Nächste Schritte" nennt den Sensor-Grund nicht (aus dem HTML gelesen)' };
        // Die Pflanzung bekam ihre Aufgaben erst beim Laden (lastDone = jetzt) — und
        // „heute erledigt" darf ein Sensor am selben Tag nicht wieder faellig machen.
        // Eine echte Pflanzung wurde gestern gegossen: das stellt der Fall her.
        zuc.tasks.water.lastDone = new Date(Date.now() - 864e5).toISOString(); saveGardenData();
        gsMesswertEintragen(gg.id, 'soil_moisture', 18);
        const z = gsGetDueTasks().find(x => x.plant.id === 'plant_seed_1' && x.key === 'water');
        if (!z || z.days > 0 || !z.sensor) return { ok: false, warum: 'die Pflanzung im Garten des Geräts wurde nicht vorgezogen' };
        const gesp = (JSON.parse(localStorage.getItem('gs_plantings') || '[]')).find(x => x.id === 'plant_seed_1');
        if (!gesp || !gesp.tasks.water.vorgezogenAuf) return { ok: false, warum: 'vorgezogenAuf steht nicht in gs_plantings — falsche Liste gespeichert' };
        gsSnoozeTask('p2', 'water', 2);
        const sn = gsGetDueTasks().find(x => x.plant.id === 'p2' && x.key === 'water');
        if (sn && sn.days <= 0) return { ok: false, warum: 'die Verschiebung der Person wurde vom Sensor überstimmt' };
        delete p2.tasks.water.snoozedUntil; savePlantsToStorage();
        gsQuickDone('p2', 'water');
        if (p2.tasks.water.vorgezogenAuf) return { ok: false, warum: 'Erledigen hebt das Vorziehen nicht auf' };
        gsMesswertEintragen(g.id, 'soil_moisture', 21, new Date(Date.now() + 1000).toISOString());
        const nach = gsGetDueTasks().find(x => x.plant.id === 'p2' && x.key === 'water');
        if (nach && nach.days <= 0) return { ok: false, warum: 'heute gegossen, Sensor noch trocken — darf nicht schon wieder fällig sein' };
        gsMesswertEintragen(gg.id, 'soil_moisture', 48, new Date(Date.now() + 2000).toISOString());
        if (zuc.tasks.water.vorgezogenAuf) return { ok: false, warum: 'die erfüllte Regel gibt die Aufgabe nicht frei' };
        gsMesswertEintragen(gg.id, 'soil_moisture', 15, new Date(Date.now() + 3000).toISOString());
        if (!zuc.tasks.water.vorgezogenAuf) return { ok: false, warum: 'erneut verletzt, nicht vorgezogen' };
        gsRegelLoeschen(r2.id); r2 = null; gsSensorAufgabenAbgleich();
        if (zuc.tasks.water.vorgezogenAuf) return { ok: false, warum: 'die gelöschte Regel lässt das Vorziehen stehen' };
        return { ok: true, info: 'nicht prüfbar → nichts · 22 % → Monstera heute, Tagesplan nennt Gerät · Garten-Gerät → Zucchini in gs_plantings · Verschiebung gewinnt · Erledigen hebt auf · 48 % gibt frei · Regel weg gibt frei' };
      } finally {
        gsGeraetLoeschen(g.id); gsGeraetLoeschen(gg.id);
        p2.tasks.water = JSON.parse(merk); p2.diary = JSON.parse(merkDiary); zuc.tasks.water = JSON.parse(merkZ);
        savePlantsToStorage(); saveGardenData();
      }
    },
  },
  {
    // v32.53: Giessen bestaetigt sich am Sensor — Aussage mit Zahl, nie Haken (§6).
    // +10 Punkte innert 60 Minuten = bestaetigt; weniger = nicht gemerkt; kein
    // Wert davor/danach oder kein Geraet = nicht pruefbar. Kein Messwert
    // veraendert die Aufgabe. Sichtbar im Kalender und im Pflanzentagebuch —
    // und dort parst der Loesch-Knopf (bis v32.52 stand der ISO-Zeitstempel
    // unzitiert im onclick: Syntaxfehler, toter Knopf).
    name: 'Giess-Bestätigung · bestätigt, nicht gemerkt, nicht prüfbar — mit Zahlen, im Kalender und Tagebuch, ohne Haken',
    lauf: () => {
      const p2 = myPlants.find(x => x && x.id === 'p2'), p3 = myPlants.find(x => x && x.id === 'p3');
      const merk = JSON.stringify(p2.tasks.water), merkDiary = JSON.stringify(p2.diary || []);
      const g = gsGeraetAnlegen({ kind: 'manual', name: 'Monstera-Stab', plant_id: 'p2' });
      try {
        const jetzt = Date.now();
        const o = gsGiessBestaetigung(p3, new Date(jetzt).toISOString());
        if (!o || o.zustand !== 'nicht_pruefbar' || !o.ohne_geraet) return { ok: false, warum: 'ohne Gerät: ' + JSON.stringify(o) };
        gsMesswertEintragen(g.id, 'soil_moisture', 21, new Date(jetzt - 22 * 60000).toISOString());
        gsMesswertEintragen(g.id, 'soil_moisture', 48, new Date(jetzt + 28 * 60000).toISOString());
        const b = gsGiessBestaetigung(p2, new Date(jetzt).toISOString());
        if (!b || b.zustand !== 'bestaetigt' || b.delta !== 27 || !/21 → 48/.test(b.text)) return { ok: false, warum: 'bestätigt: ' + JSON.stringify(b) };
        const t2 = jetzt + 3 * 3600000;
        gsMesswertEintragen(g.id, 'soil_moisture', 30, new Date(t2 - 10 * 60000).toISOString());
        gsMesswertEintragen(g.id, 'soil_moisture', 33, new Date(t2 + 20 * 60000).toISOString());
        const n = gsGiessBestaetigung(p2, new Date(t2).toISOString());
        if (!n || n.zustand !== 'nicht_gemerkt' || n.delta !== 3) return { ok: false, warum: 'nicht gemerkt: ' + JSON.stringify(n) };
        const t3 = jetzt + 6 * 3600000;
        gsMesswertEintragen(g.id, 'soil_moisture', 25, new Date(t3 - 5 * 60000).toISOString());
        const u = gsGiessBestaetigung(p2, new Date(t3).toISOString());
        if (!u || u.zustand !== 'nicht_pruefbar' || u.ohne_geraet || !/danach/.test(u.text)) return { ok: false, warum: 'nicht prüfbar: ' + JSON.stringify(u) };
        if (JSON.stringify(p2.tasks.water) !== merk) return { ok: false, warum: 'ein Messwert hat die Aufgabe verändert — Messen ist kein Erledigen' };
        gsQuickDone('p2', 'water');
        const ev = gsKalenderEreignisse(gsHeuteTag(), gsHeuteTag()).find(x => x.art === 'tagebuch' && x.pflanze && x.pflanze.id === 'p2' && /Giessen/.test(x.titel));
        if (!ev || !ev.sensor || ev.sensor.zustand !== 'bestaetigt' || !/bestätigt/.test(ev.grund)) return { ok: false, warum: 'Kalender-Eintrag ohne Bestätigung: ' + JSON.stringify(ev && [ev.grund, ev.sensor]) };
        openPlantDiary('p2');
        const m = document.getElementById('plant-diary-modal'); const t = m ? m.textContent : '';
        if (!/Sensor: bestätigt/.test(t)) return { ok: false, warum: 'das Pflanzentagebuch zeigt die Bestätigung nicht (aus dem HTML gelesen)' };
        const btn = Array.from(m.querySelectorAll('button')).find(b2 => /gsDeleteDiaryEntry/.test(b2.getAttribute('onclick') || ''));
        if (!btn) return { ok: false, warum: 'kein Lösch-Knopf im Tagebuch' };
        try { new Function(btn.getAttribute('onclick')); } catch (e2) { return { ok: false, warum: 'der Lösch-Knopf ist ein Syntaxfehler: ' + btn.getAttribute('onclick').slice(0, 90) }; }
        const zeiten = Array.from(m.querySelectorAll('.gs-tb-sensor, [style*="font-weight:700"]')).length;
        return { ok: true, info: 'ohne Gerät → nicht prüfbar · 21→48 (+27) bestätigt · 30→33 (+3) nicht gemerkt · ohne Wert danach nicht prüfbar · Aufgabe unverändert · Kalender + Tagebuch zeigen es · Lösch-Knopf parst' };
      } finally {
        gsGeraetLoeschen(g.id); p2.tasks.water = JSON.parse(merk); p2.diary = JSON.parse(merkDiary); savePlantsToStorage();
        const mm = document.getElementById('plant-diary-modal'); if (mm) mm.remove();
      }
    },
  },
  {
    // v32.55: Schwellwert-Vorlagen NUR, wo eine Zahl steht (§11 Idee 5).
    // Artenliste (Licht bei 40 Hauspflanzen), Kulturdaten (Bodentemperatur),
    // eigener Verlauf (14 Tage) — nie Feuchte aus Artendaten, nie automatisch
    // angelegt, ohne Zahl „keine Empfehlung hinterlegt".
    name: 'Vorlagen · nur, wo eine Zahl steht — Artenliste, Kulturdaten, eigener Verlauf; nie Feuchte aus Artendaten; angelegt wird von Hand',
    lauf: () => {
      const geraete = [];
      const anlegen = o => { const g = gsGeraetAnlegen(o); if (g) geraete.push(g.id); return g; };
      let pbDa = false;
      try {
        const g = anlegen({ kind: 'manual', name: 'Vorlagen-Probe', plant_id: 'p2' });   // Monstera deliciosa → HP001
        const vl = gsSchwellwertVorlagen(g);
        const licht = vl.find(v => v.metric === 'light' && v.op === 'below');
        if (!licht || licht.threshold !== 200 || !/HP001/.test(licht.grund)) return { ok: false, warum: 'Monstera: keine Licht-Vorlage „unter 200" mit Quelle HP001: ' + JSON.stringify(vl) };
        if (!vl.find(v => v.metric === 'light' && v.op === 'above' && v.threshold === 2000)) return { ok: false, warum: 'Monstera: „Licht über 2000" fehlt' };
        if (vl.some(v => v.metric === 'soil_moisture' && v.quelle !== 'verlauf')) return { ok: false, warum: 'eine Feuchte-Schwelle aus Artendaten — Prozent ist sensorabhängig' };
        const gg = anlegen({ kind: 'manual', name: 'Beet-Probe', garden_id: 'g1' });   // Garten → Zucchini (Kulturdaten bodentemp 12)
        const vz = gsSchwellwertVorlagen(gg); const bt = vz.find(v => v.metric === 'soil_temp');
        if (!bt || bt.threshold !== 12 || !/Zucchini/.test(bt.grund)) return { ok: false, warum: 'Zucchini: keine Bodentemperatur-Vorlage 12 °C aus den Kulturdaten: ' + JSON.stringify(vz) };
        myPlants.push({ id: 'pb', name: 'Bärlauch', species: 'Allium ursinum', tasks: {} }); pbDa = true;
        const gb = anlegen({ kind: 'manual', name: 'Bärlauch-Probe', plant_id: 'pb' });
        if (gsSchwellwertVorlagen(gb).length) return { ok: false, warum: 'Bärlauch hat keine Zahl — und trotzdem eine Vorlage: ' + JSON.stringify(gsSchwellwertVorlagen(gb)) };
        for (let i = 0; i < 15; i++) gsMesswertEintragen(gb.id, 'soil_moisture', 20 + i, new Date(Date.now() - (14 - i) * 864e5 - 3600000).toISOString());
        const vv = gsSchwellwertVorlagen(gb); const tief = vv.find(v => v.metric === 'soil_moisture' && v.op === 'below');
        // Der erste Wert liegt 14 Tage + 1 h zurueck — ausserhalb des Fensters; im Fenster ist das Tief 21.
        if (!tief || tief.threshold !== 21 || typeof tief.threshold !== 'number' || tief.quelle !== 'verlauf' || !/14-Tage-Tief \(14 Werte\)/.test(tief.grund)) return { ok: false, warum: 'nach 15 Tagen Werten kein „14-Tage-Tief 21" als Zahl: ' + JSON.stringify(vv) };
        const seed = gsGeraete().find(x => x.id === 'ger_seed_1');
        if (seed && gsSchwellwertVorlagen(seed).some(v => v.quelle === 'verlauf')) return { ok: false, warum: 'sieben Tage Werte reichen für eine Verlaufs-Vorlage — verlangt sind 14' };
        const leer = anlegen({ kind: 'manual', name: 'Leer-Probe' });
        gsMesswerteOeffnen();
        const mc = document.getElementById('modal-content');
        const btn = Array.from(mc.querySelectorAll('.gs-mw-vorlagen button')).find(b => /Licht unter 200/.test(b.textContent));
        if (!btn) return { ok: false, warum: 'die Vorlage „Licht unter 200 lux" steht nicht im Dashboard (aus dem HTML gelesen)' };
        const vorher = gsRegeln().length;
        btn.click();
        const m = document.getElementById('mw-regel-metric-' + g.id), op = document.getElementById('mw-regel-op-' + g.id), w = document.getElementById('mw-regel-wert-' + g.id);
        if (!m || m.value !== 'light' || !op || op.value !== 'below' || !w || w.value !== '200') return { ok: false, warum: 'Antippen füllt das Formular nicht: ' + JSON.stringify([m && m.value, op && op.value, w && w.value]) };
        if (gsRegeln().length !== vorher) return { ok: false, warum: 'die Vorlage hat die Regel selbst angelegt — angelegt wird von Hand' };
        const kachelLeer = mc.querySelector('.gs-mw-kachel[data-geraet="' + leer.id + '"]');
        if (!kachelLeer || !/keine Empfehlung hinterlegt/.test(kachelLeer.textContent)) return { ok: false, warum: 'ohne Zahl steht nicht „keine Empfehlung hinterlegt"' };
        return { ok: true, info: 'Monstera: Licht unter 200 / über 2000 (HP001) · Zucchini: Bodentemperatur unter 12 (Kulturdaten) · Bärlauch: nichts · 15 Tage Werte → 14-Tage-Tief 21 · 7 Tage → nichts · Antippen füllt, legt nicht an · „keine Empfehlung" steht da' };
      } finally {
        geraete.forEach(id => gsGeraetLoeschen(id));
        if (pbDa) { myPlants = myPlants.filter(x => x && x.id !== 'pb'); savePlantsToStorage(); }
      }
    },
  },
  {
    // v32.55: Namen der Messgroessen durch EINE Funktion (§11 Idee 22): Spalte
    // der Tabelle zuerst, dann die Sprachschicht (metric_<key>), sonst Deutsch.
    name: 'Labels · Messgrössen heissen in der Sprache der App — Tabelle zuerst, dann Sprachschicht, sonst Deutsch',
    lauf: () => {
      const echtLang = gsI18n.getLang, echtT = gsI18n.t;
      try {
        if (_gsMetricLabel(_gsMetric('soil_moisture')) !== 'Bodenfeuchte') return { ok: false, warum: 'deutsch: ' + _gsMetricLabel(_gsMetric('soil_moisture')) };
        const kat = gsMetricKatalog().map(x => Object.assign({}, x)); kat.find(x => x.key === 'soil_moisture').label_fr = 'Humidité du sol';
        localStorage.setItem('gs_metric_catalog', JSON.stringify(kat));
        gsI18n.getLang = () => 'fr';
        if (_gsMetricLabel(_gsMetric('soil_moisture')) !== 'Humidité du sol') return { ok: false, warum: 'Spalte label_fr wird nicht gelesen: ' + _gsMetricLabel(_gsMetric('soil_moisture')) };
        gsI18n.t = (key, f) => key === 'metric_air_temp' ? 'Température de l’air' : f;
        if (_gsMetricLabel(_gsMetric('air_temp')) !== 'Température de l’air') return { ok: false, warum: 'ohne Spalte greift die Sprachschicht nicht: ' + _gsMetricLabel(_gsMetric('air_temp')) };
        if (_gsMetricLabel(_gsMetric('light')) !== 'Licht') return { ok: false, warum: 'ohne beides kein deutscher Rückfall: ' + _gsMetricLabel(_gsMetric('light')) };
        gsMesswerteOeffnen();
        const t = document.getElementById('modal-content').textContent;
        if (!/Humidité du sol/.test(t)) return { ok: false, warum: 'das Dashboard zeigt den französischen Namen nicht (aus dem HTML gelesen)' };
        if (/label_de|undefined/.test(t)) return { ok: false, warum: 'Platzhalter im Dashboard' };
        return { ok: true, info: 'de: Bodenfeuchte · fr aus der Tabelle: Humidité du sol · fr aus der Sprachschicht: Température de l’air · Rückfall: Licht · im Dashboard' };
      } finally {
        gsI18n.getLang = echtLang; gsI18n.t = echtT; localStorage.removeItem('gs_metric_catalog');
      }
    },
  },
  {
    // v33.30: Lina wird GEERDET. Gemessen am 14.09.2026: `gsLinaContext` trug
    // Pflanzenzahl, Region, Jahreszeit, Messwerte und Kalender — aber KEINE
    // Arten, und `gsLinaSend` keine Notfall-Erkennung. Der Offline-Chat hatte
    // beides seit v32.96/98/99.
    //
    // Der naheliegende Weg (den Namensvergleich aus `getSmartAnswer`
    // mitbenutzen) waere falsch gewesen: er nimmt IRGENDEIN Wort eines Namens.
    // „Meine Tomaten haben braune Blätter" ergab dort die **Braune
    // Krustenflechte**, „echte Kamille" die **Echte Engelwurz** — zwei von acht
    // realistischen Fragen auf einer anderen Art, mit anderer Giftstufe.
    // Eine falsche Erdung ist schlechter als keine.
    name: 'Lina · Arten: ganzer Name oder ganzes Binomen an Wortgrenzen — nie ein Wort-Teiltreffer, und bei mehreren Arten wird KEINE ausgewählt',
    lauf: () => {
      const t = (q) => _gsArtenTreffer(q);
      // 1 · der Fall, an dem der grobe Vergleich scheitert
      const flechte = t('Meine Tomaten haben braune Blätter, was tun?');
      if (flechte.zahl) return { ok: false, warum: '„braune Blätter" erdet auf ' + flechte.arten.map(a => a.name).join(', ') + ' — ein Wort-Teiltreffer' };
      // 2 · eine eindeutige Art
      const bl = t('Kann ich Bärlauch essen?');
      if (bl.zahl !== 1 || !/Bärlauch/i.test(bl.arten[0].name)) return { ok: false, warum: 'Bärlauch: ' + JSON.stringify(bl.arten.map(a => a.name)) };
      // 3 · das BINOMEN trifft (der grobe Vergleich fand es nur über den deutschen Namen)
      const lat = t('Ist Allium ursinum dasselbe wie Bärlauch?');
      if (!lat.zahl) return { ok: false, warum: 'das Binomen „Allium ursinum" trifft nichts' };
      // 4 · mehrere Arten, EINIG → darf erden
      const ros = t('Wie oft muss ich meine Rose giessen?');
      if (ros.zahl < 2 || ros.einig !== true) return { ok: false, warum: 'Rose: ' + ros.zahl + ' Arten, einig=' + ros.einig };
      // 5 · mehrere Arten, UNEINIG → darf NICHT erden
      const wac = t('Ist der Gemeine Wacholder giftig?');
      if (wac.zahl < 2 || wac.einig !== false) return { ok: false, warum: 'Wacholder: ' + wac.zahl + ' Arten, einig=' + wac.einig + ' (erwartet: mehrere, uneinig)' };
      // 6 · und die Zeile sagt das auch — keine Art wird herausgegriffen
      const zW = _gsLinaArtenZeile('Ist der Gemeine Wacholder giftig?');
      if (!/unterscheiden sich/.test(zW) || !/Frag nach/.test(zW)) return { ok: false, warum: 'uneinige Zeile: ' + zW };
      const zR = _gsLinaArtenZeile('Wie oft muss ich meine Rose giessen?');
      if (!/Arten in der Liste/.test(zR)) return { ok: false, warum: 'einige Zeile: ' + zR };
      if (_gsLinaArtenZeile('Meine Tomaten haben braune Blätter, was tun?')) return { ok: false, warum: 'ohne Treffer entsteht trotzdem eine Zeile' };
      // 7 · Deckel
      if (zR.length > GS_LINA_ARTEN_MAX || zW.length > GS_LINA_ARTEN_MAX) return { ok: false, warum: 'Zeile über dem Deckel: ' + Math.max(zR.length, zW.length) };
      return { ok: true, info: 'Flechte 0 · Bärlauch 1 · Binomen trifft · Rose ' + ros.zahl + ' einig · Wacholder ' + wac.zahl + ' uneinig · Zeilen ≤ ' + GS_LINA_ARTEN_MAX };
    },
  },
  {
    // Die Angaben stammen von der ART, nicht vom Eintrag (v32.92/93/95) — und
    // die Zeile steht wirklich im Kontext, mit der Frage als Grundlage.
    name: 'Lina · die ARTEN-Zeile steht im Kontext, die Angaben kommen aus _gsArtAnzeige, und ohne erkannte Art gibt es keine Zeile',
    lauf: () => {
      const ctx = gsLinaContext('Kann ich Bärlauch essen?');
      if (!/ARTEN \(aus der App-Liste/.test(ctx)) return { ok: false, warum: 'keine ARTEN-Zeile: ' + ctx.slice(-220) };
      if (!/Bärlauch/.test(ctx)) return { ok: false, warum: 'die Art fehlt in der Zeile' };
      const ohne = gsLinaContext('Wie war das Wetter gestern?');
      if (/ARTEN \(aus der App-Liste/.test(ohne)) return { ok: false, warum: 'ohne erkannte Art entsteht trotzdem eine ARTEN-Zeile' };
      // Die Angabe muss die der ART sein, nicht die des Eintrags. Mit Bärlauch
      // liesse sich das NICHT messen: dort stimmen beide überein, und zwei
      // denkbare Regeln mit demselben Ergebnis prüfen keine von beiden.
      // Gemessen (14.09.2026) gibt es echte Abweichungen — diese hier ändern
      // das VERHALTEN, nicht nur eine Zahl:
      //   Beinwell    Eintrag tox 1, Art tox 3  → überschreitet die Warnschwelle
      //   Christrose  Eintrag tox 3, Art tox 5
      const proben = [['Beinwell', 3], ['Christrose', 5]];
      for (const [nm, sollTox] of proben) {
        const roh = DB.filter(x => (x.name || '').toLowerCase() === nm.toLowerCase());
        if (!roh.length) continue;
        const tr = _gsArtenTreffer('Ist ' + nm + ' giftig?');
        if (!tr.zahl) return { ok: false, warum: nm + ' wird nicht gefunden — die Probe misst nichts' };
        if (tr.arten[0].tox !== sollTox) {
          return { ok: false, warum: nm + ': tox ' + tr.arten[0].tox + ' statt ' + sollTox
            + ' (Eintrag sagt ' + (roh[0].tox | 0) + ') — die Angabe kommt aus dem EINTRAG, nicht aus der Art' };
        }
      }
      if (ctx.length > 1650) return { ok: false, warum: 'Kontext ' + ctx.length + ' Zeichen — mit der ARTEN-Zeile zu lang' };
      return { ok: true, info: ctx.length + ' Zeichen · Zeile da bei erkannter Art, weg ohne · tox aus _gsArtAnzeige' };
    },
  },
  {
    // Die Gegenprobe NACH der Antwort. Nur eine Richtung: eine essbar-Behauptung
    // über eine Art, die die Liste mit tox >= 3 führt.
    name: 'Lina · Sicherheit: „essbar" über eine Art mit tox ≥ 3 bekommt eine Warnzeile — „giftig" bekommt keine, und ohne Treffer passiert nichts',
    lauf: () => {
      const giftig = { zahl: 1, einig: true, tox: [5], essbar: [false], arten: [{ name: 'Grüner Knollenblätterpilz', lat: 'Amanita phalloides', tox: 5, essbar: false }] };
      const harmlos = { zahl: 1, einig: true, tox: [0], essbar: [true], arten: [{ name: 'Bärlauch', lat: 'Allium ursinum', tox: 0, essbar: true }] };
      const w1 = _gsLinaSicherheit('Ja, den kannst du essen — er ist essbar und schmeckt nussig.', giftig);
      if (!w1 || !/Knollenblätterpilz/.test(w1)) return { ok: false, warum: 'keine Warnung bei essbar-Behauptung zu tox 5: ' + JSON.stringify(w1) };
      const w2 = _gsLinaSicherheit('Nein, der ist hochgiftig — bitte auf keinen Fall essen.', giftig);
      if (w2) return { ok: false, warum: 'Warnung, obwohl die Antwort selbst warnt: ' + w2 };
      const w3 = _gsLinaSicherheit('Ja, der ist essbar.', harmlos);
      if (w3) return { ok: false, warum: 'Warnung bei einer harmlosen Art: ' + w3 };
      const w4 = _gsLinaSicherheit('Ja, der ist essbar.', { zahl: 0, arten: [] });
      if (w4) return { ok: false, warum: 'Warnung ohne erkannte Art: ' + w4 };
      const w5 = _gsLinaSicherheit('Der ist NICHT essbar.', giftig);
      if (w5) return { ok: false, warum: '„nicht essbar" als essbar-Behauptung gelesen: ' + w5 };
      return { ok: true, info: 'tox 5 + „essbar" → Warnung · „giftig" → keine · harmlos → keine · ohne Treffer → keine · „nicht essbar" → keine' };
    },
  },
  {
    // v33.32: Die EINZIGE Rechnung, die eine falsche Essbarkeits-Zusage ueber
    // eine giftige Art abfangen kann. Eine gegnerische Pruefung hat v33.30
    // end-to-end gegen die echte Artenliste gemessen: **8 von 9** realistischen
    // Zusagen kamen ohne Warnung durch — darunter alle DREI nicht-deutschen.
    //
    // Die Saetze hier sind die GEMESSENEN, nicht ausgewaehlte. Ein Fall, dessen
    // Satz den Treffer schon enthaelt, prueft die Vorlage und nicht die Ware —
    // genau das war die zweite Kritik an v33.30.
    name: 'Lina · Sicherheit: jede realistische Zusage ueber eine giftige Art wird gewarnt — in vier Sprachen, und eine Warnung wird nicht zur Zusage',
    lauf: () => {
      const giftig = { zahl: 1, arten: [{ name: 'Grüner Knollenblätterpilz', lat: 'Amanita phalloides', tox: 5, essbar: false }] };
      const harmlos = { zahl: 1, arten: [{ name: 'Bärlauch', lat: 'Allium ursinum', tox: 0, essbar: true }] };

      // Alle zwoelf sind an v33.30 gemessen worden; acht davon kamen durch.
      const ZUSAGEN = [
        'Ja, die kannst du roh essen.',
        'Ja, du kannst die jungen Blätter essen.',
        'Das ist ein hervorragender Speisepilz.',
        'Er eignet sich zum Kochen.',
        'Oui, vous pouvez le manger.',
        'Sì, si può mangiare senza problemi.',
        'Yes, you can eat it.',
        'Ja, er ist essbar.',
        'Ja, das ist essbare Nahrung.',
        'Du kannst ihn bedenkenlos verzehren.',
        'Ja, du darfst ihn essen.',
        // Eine Zusage bleibt eine Zusage, auch wenn ein SPAETERER Satz ueber
        // etwas anderes spricht. Vor v33.32 hat dieser Satz NICHT gewarnt:
        // `_gsLinaNorm` streicht `.!?` VOR dem Satz-Split, der Split trennte
        // also an nichts, und die Verneinung im Nebensatz entwertete alles.
        'Ja, das ist essbar. Der giftige Doppelgänger ist nicht essbar.'
      ];
      const verpasst = ZUSAGEN.filter((x) => !_gsLinaSicherheit(x, giftig));
      if (verpasst.length) return { ok: false, warum: verpasst.length + ' von ' + ZUSAGEN.length + ' Zusagen ohne Warnung: ' + JSON.stringify(verpasst.slice(0, 4)) };

      // Gegenrichtung: eine Antwort, die selbst warnt, darf keine Warnung ausloesen —
      // sonst lernt man, das Banner zu ueberlesen (v32.21).
      const WARNT_SELBST = [
        'Nein, der ist tödlich giftig — auf keinen Fall essen.',
        'Der ist NICHT essbar.',
        'Nicht geniessbar.',
        'Non, il ne faut pas le manger.',
        'No, do not eat it.',
        'Auf keinen Fall essen, das ist der Knollenblätterpilz.'
      ];
      const fehlalarm = WARNT_SELBST.filter((x) => _gsLinaSicherheit(x, giftig));
      if (fehlalarm.length) return { ok: false, warum: 'Warnung ueber einer Antwort, die selbst warnt: ' + JSON.stringify(fehlalarm) };

      // Und bei einer harmlosen Art nie.
      const beiHarmlos = ZUSAGEN.filter((x) => _gsLinaSicherheit(x, harmlos));
      if (beiHarmlos.length) return { ok: false, warum: 'Warnung bei einer harmlosen Art: ' + JSON.stringify(beiHarmlos.slice(0, 3)) };
      if (_gsLinaSicherheit('Ja, essbar.', { zahl: 0, arten: [] })) return { ok: false, warum: 'Warnung ohne erkannte Art' };

      // Der Satz-Split muss am ROHEN Text greifen. Gegenprobe auf die Mechanik:
      // zwei Saetze, der erste verneint, der zweite sagt zu → muss warnen.
      if (!_gsLinaSicherheit('Nicht essbar ist der Doppelgänger. Dieser hier ist essbar.', giftig)) {
        return { ok: false, warum: 'die Verneinung im ERSTEN Satz unterdrueckt die Zusage im zweiten — der Split greift nicht' };
      }
      return { ok: true, info: ZUSAGEN.length + ' Zusagen erkannt (de/fr/it/en) · ' + WARNT_SELBST.length + ' Warnungen still · harmlos still · Split am rohen Text' };
    },
  },
  {
    // v33.31: Eine Whitelist ist die ZUSAGE, dass ihre Ziele existieren.
    // Gemessen am 14.09.2026: `GS_LINA_SCREENS` fuehrte 'ai' — und
    // `switchTab('ai')` kommt NULL-mal vor. Lina konnte jemanden auf einen
    // Bildschirm schicken, den sonst kein Weg erreicht, und dort stand ein
    // ZWEITER Chat (`sendAI`) ohne Notfall-Erkennung, ohne Arten-Erdung und
    // ohne Sicherheitszeile — alles, was v33.30 gebaut hat, fehlte dort.
    // Das ist die Klasse aus wiring_check Richtung 3, nur andersherum: kein
    // Ziel ohne Einstieg, sondern ein EINSTIEG, den nur die KI kennt.
    name: 'Lina · jeder Bildschirm in GS_LINA_SCREENS existiert wirklich — und es gibt nur EINEN Chat',
    lauf: () => {
      if (typeof GS_LINA_SCREENS === 'undefined' || !GS_LINA_SCREENS.length) {
        return { ok: false, warum: 'GS_LINA_SCREENS gibt es nicht — der Fall misst nichts' };
      }
      const fehlend = GS_LINA_SCREENS.filter((t) => !document.getElementById('screen-' + t));
      if (fehlend.length) return { ok: false, warum: GS_LINA_SCREENS.length + ' Ziele, davon ohne Bildschirm: ' + fehlend.join(', ') };
      // Und jedes Ziel muss auch sonst erreichbar sein — sonst fuehrt Lina
      // irgendwohin, wo die Person allein nie hinkaeme.
      const nurLina = GS_LINA_SCREENS.filter((t) => {
        const el = document.getElementById('screen-' + t);
        return el && !el.querySelector('input, textarea, button, [onclick]');
      });
      if (nurLina.length) return { ok: false, warum: 'Ziel ohne jedes Bedienelement: ' + nurLina.join(', ') };
      // Es gibt genau EINEN Chat: den von Lina.
      if (typeof sendAI === 'function') return { ok: false, warum: 'ein zweiter Chat (sendAI) existiert noch — er hat weder Notfall-Erkennung noch Arten-Erdung' };
      if (document.getElementById('screen-ai')) return { ok: false, warum: '#screen-ai existiert noch' };
      if (typeof gsLinaSend !== 'function') return { ok: false, warum: 'gsLinaSend fehlt — der Fall misst nichts' };
      return { ok: true, info: GS_LINA_SCREENS.length + ' Ziele, alle vorhanden und bedienbar · genau ein Chat (Lina)' };
    },
  },
  {
    // Zwei weitere Befunde derselben Pruefung, beide mit Folgen fuer die Sicherheit.
    name: 'Lina · der Umgangsname zieht seine Familie mit, und ein Fehlalarm nimmt der Person nicht die Antwort weg',
    lauf: async () => {
      // 1 · „Holunder" traf woertlich den EINEN Eintrag, der so heisst
      // (Sambucus nigra, tox 2, essbar) — und meldete einig:true. Die Liste
      // fuehrt 18 Sambucus-Eintraege bis tox 4, darunter den Zwerg-Holunder.
      // Eine Zusage „essbar" darauf ist genau der Fehler, den _gsVorsichtigste
      // seit v32.43 fuer den Scanner verhindert.
      const h = _gsArtenTreffer('Ist Holunder essbar?');
      if (h.zahl < 2) return { ok: false, warum: '„Holunder" findet nur ' + h.zahl + ' Art — die Familie wird nicht mitgezogen' };
      if (h.einig !== false) return { ok: false, warum: '„Holunder" gilt als einig, obwohl die Arten von tox ' + h.tox.join('/') + ' reichen' };
      if (Math.max.apply(null, h.tox) < 3) return { ok: false, warum: 'die giftigen Verwandten fehlen: tox ' + JSON.stringify(h.tox) };
      const hz = _gsLinaArtenZeile('Ist Holunder essbar?');
      if (!/unterscheiden sich/.test(hz)) return { ok: false, warum: 'die Zeile sagt den Unterschied nicht: ' + hz.slice(0, 140) };
      // Gegenrichtung: eine eindeutige Art bleibt eindeutig
      const b = _gsArtenTreffer('Kann ich Bärlauch essen?');
      if (b.zahl !== 1 || b.einig !== true) return { ok: false, warum: 'Bärlauch ist nicht mehr eindeutig: ' + JSON.stringify({ zahl: b.zahl, einig: b.einig }) };
      // Und die Flechte bleibt draussen
      if (_gsArtenTreffer('Meine Tomaten haben braune Blätter, was tun?').zahl) return { ok: false, warum: 'die Familien-Regel holt den Wort-Teiltreffer zurueck' };

      // 2 · Ein Fehlalarm darf die Antwort nicht wegnehmen. „mon chat peut
      // manger cette plante ?" liest die Erkennung als dringend (`manger` +
      // `chat`); in v33.29 wurde die Frage normal beantwortet.
      if (_gsNotfallStufe('mon chat peut manger cette plante ?') !== 'dringend') {
        return { ok: false, warum: 'der Fehlalarm ist weg — der Fall misst seine eigene Voraussetzung nicht mehr' };
      }
      const sichern = { ai: window.callAI, li: window.sbIsLoggedIn, sf: window.sbFetch, gt: window.gsToast };
      try {
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async () => ({ data: [], error: null });
        window.gsToast = () => {};
        let gerufen = 0;
        window.callAI = async () => { gerufen++; return 'Die meisten Zimmerpflanzen sind fuer Katzen nicht geeignet.'; };
        if (!document.getElementById('gs-lina-input') && typeof gsOpenLina === 'function') {
          try { await gsOpenLina(); } catch (_) {}
          await new Promise(r => setTimeout(r, 120));
        }
        const el = document.getElementById('gs-lina-input');
        if (!el) return { ok: false, warum: 'kein Eingabefeld — der Fall misst nichts' };
        window._gsLinaMsgs = [];
        window._gsLinaSending = false;
        el.value = 'mon chat peut manger cette plante ?';
        await gsLinaSend();
        await new Promise(r => setTimeout(r, 120));
        const texte = window._gsLinaMsgs.filter(m => m.role === 'assistant').map(m => String(m.content));
        if (!texte.some(t => /145/.test(t))) return { ok: false, warum: 'die Nummer fehlt: ' + JSON.stringify(texte).slice(0, 140) };
        if (!gerufen) return { ok: false, warum: 'der Fehlalarm nimmt die Antwort weg — callAI wurde nicht gerufen' };
        const nutzer = window._gsLinaMsgs.filter(m => m.role === 'user');
        if (nutzer.length !== 1) return { ok: false, warum: 'die Frage steht ' + nutzer.length + '-mal im Verlauf' };
        return { ok: true, info: 'Holunder ' + h.zahl + ' Arten bis tox ' + Math.max.apply(null, h.tox) + ', uneinig · Bärlauch eindeutig · Flechte 0 · Fehlalarm: Nummer UND Antwort, Frage einmal' };
      } finally {
        window.callAI = sichern.ai; window.sbIsLoggedIn = sichern.li;
        window.sbFetch = sichern.sf; window.gsToast = sichern.gt;
        window._gsLinaSending = false;
        try { if (typeof closeModal === 'function') closeModal(); } catch (_) {}
      }
    },
  },
  {
    // Fuenf Befunde einer gegnerischen Pruefung des fertigen Schnitts, jeder
    // selbst nachgestellt. Sie betreffen alle die EINE Sicherung dieser App
    // gegen eine falsche Essbarkeits-Zusage.
    name: 'Lina · die vier Loecher der ersten Fassung: Sammelbegriff, ß/ss, flektiertes „essbar", Notfall hinter dem Riegel',
    lauf: async () => {
      // 1 · Sammelbegriff: „Wiesenpilze" traf den „Perlweissen Wiesenpilz" —
      // EINE Art mit der Zusage „nicht giftig, essbar" auf eine Frage nach
      // einer ganzen Gruppe. Der volle Name stand nie in der Frage.
      const w = _gsArtenTreffer('Kann man Wiesenpilze essen?');
      if (!w.zahl) return { ok: false, warum: '„Wiesenpilze" trifft nichts — der Fall misst nichts' };
      if (!w.nurTeilname) return { ok: false, warum: 'Treffer nur ueber das letzte Wort wird nicht als solcher gemerkt' };
      if (w.einig !== false) return { ok: false, warum: 'ein Sammelbegriff-Treffer gilt als „einig" und traegt damit eine Zusage' };
      const wz = _gsLinaArtenZeile('Kann man Wiesenpilze essen?');
      if (!/voll[e]? Name stand nicht/.test(wz)) return { ok: false, warum: 'die Zeile sagt nicht, dass der volle Name fehlte: ' + wz.slice(0, 140) };
      // Gegenrichtung: ein VOLLER Name traegt weiterhin die Zusage
      const b = _gsArtenTreffer('Kann ich Bärlauch essen?');
      if (b.nurTeilname || b.einig !== true) return { ok: false, warum: 'ein voller Name gilt jetzt auch als unsicher: ' + JSON.stringify(b) };

      // 2 · ß und ss muessen dasselbe erden
      const a1 = _gsArtenTreffer('Kann ich Süssholz essen?').zahl;
      const a2 = _gsArtenTreffer('Kann ich Süßholz essen?').zahl;
      if (!a1 || a1 !== a2) return { ok: false, warum: 'ß und ss erden verschieden: ss=' + a1 + ' ß=' + a2 };

      // 3 · die essbar-Erkennung: flektiert, umschrieben, verneint
      const giftig = { zahl: 1, arten: [{ name: 'Knollenblätterpilz', lat: 'Amanita phalloides', tox: 5, essbar: false }] };
      const ja = ['Ja, das ist eine essbare Pflanze.', 'Ja, du darfst ihn essen.', 'Er eignet sich gut zum Verzehr.', 'Ja, essbar und lecker.', 'Du kannst ihn bedenkenlos verzehren.'];
      const verpasst = ja.filter(x => !_gsLinaSicherheit(x, giftig));
      if (verpasst.length) return { ok: false, warum: verpasst.length + ' Bejahungen ohne Warnung: ' + JSON.stringify(verpasst) };
      const nein = ['Der ist NICHT essbar.', 'Auf keinen Fall essen — hochgiftig.', 'Nicht geniessbar.'];
      const falschAlarm = nein.filter(x => _gsLinaSicherheit(x, giftig));
      if (falschAlarm.length) return { ok: false, warum: 'Warnung trotz Verneinung: ' + JSON.stringify(falschAlarm) };

      // 4 · der Notfall sitzt VOR dem Doppel-Send-Riegel
      const sichern = { ai: window.callAI, li: window.sbIsLoggedIn, sf: window.sbFetch, gt: window.gsToast };
      try {
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async () => ({ data: [], error: null });
        window.gsToast = () => {};
        window.callAI = async () => 'sollte nicht gerufen werden';
        if (!document.getElementById('gs-lina-input') && typeof gsOpenLina === 'function') {
          try { await gsOpenLina(); } catch (_) {}
          await new Promise(r => setTimeout(r, 120));
        }
        const el = document.getElementById('gs-lina-input');
        if (!el) return { ok: false, warum: 'kein Eingabefeld — der Fall misst nichts' };
        window._gsLinaMsgs = [];
        window._gsLinaSending = true;          // ← eine Anfrage laeuft gerade (Timeout 45 s)
        el.value = 'meine tochter hat beeren gegessen';
        await gsLinaSend();
        await new Promise(r => setTimeout(r, 80));
        const letzte = (window._gsLinaMsgs.filter(m => m.role === 'assistant').slice(-1)[0] || {}).content || '';
        if (!/145/.test(letzte)) return { ok: false, warum: 'waehrend einer laufenden Anfrage bleibt die 145 unerreichbar: ' + JSON.stringify(letzte).slice(0, 120) };
      } finally {
        window.callAI = sichern.ai; window.sbIsLoggedIn = sichern.li;
        window.sbFetch = sichern.sf; window.gsToast = sichern.gt;
        window._gsLinaSending = false;
        try { if (typeof closeModal === 'function') closeModal(); } catch (_) {}
      }
      return { ok: true, info: 'Sammelbegriff ohne Zusage · ß=ss · 5 Bejahungen erkannt, 3 Verneinungen nicht · 145 auch bei laufender Anfrage' };
    },
  },
  {
    // Die drei Faelle davor messen FUNKTIONEN. Dieser misst, ob Lina sie auch
    // RUFT — ein Fall, der nur die Vorlage prueft, ist gruen, auch wenn der
    // Aufruf fehlt (CLAUDE.md §3.1, v33.00).
    name: 'Lina · der Weg: bei einem Notfall steht die Nummer ZUERST, ohne Netz antwortet sie trotzdem, und die Warnzeile steht ueber der Antwort',
    lauf: async () => {
      const sichern = { ai: window.callAI, on: navigator.onLine, li: window.sbIsLoggedIn, sf: window.sbFetch, gt: window.gsToast, sp: window.showProfileToast };
      const rufe = [];
      try {
        window.callAI = async function (h, sys) { rufe.push(sys || ''); return 'Ja, den kannst du essen — er ist essbar.'; };
        // Linas Fenster haengt an einer echten Anmeldung und an der Cloud; beides
        // wird hier gestellt, damit das Eingabefeld ueberhaupt entsteht.
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async () => ({ data: [], error: null });
        window.gsToast = () => {};
        window.showProfileToast = () => {};
        window._gsLinaMsgs = [];
        window._gsLinaConvId = null;
        // Das Eingabefeld entsteht erst, wenn Linas Fenster offen ist.
        if (!document.getElementById('gs-lina-input') && typeof gsOpenLina === 'function') {
          try { await gsOpenLina(); } catch (_) {}
          await new Promise(r => setTimeout(r, 120));
        }
        if (!document.getElementById('gs-lina-input')) return { ok: false, warum: 'das Eingabefeld #gs-lina-input gibt es nicht — der Fall misst nichts' };
        // Das Feld JEDES MAL frisch holen: `gsLinaRender` baut das Panel neu auf,
        // eine gemerkte Referenz ist danach abgehaengt und traegt den Text ins
        // Leere — `gsLinaSend` liest dann ein leeres Feld und kehrt sofort um.
        const senden = async (t) => {
          const el = document.getElementById('gs-lina-input');
          if (!el) throw new Error('Eingabefeld nach dem Rendern verschwunden');
          el.value = t; window._gsLinaSending = false;
          await gsLinaSend(); await new Promise(r => setTimeout(r, 80));
        };
        const letzte = () => (window._gsLinaMsgs.filter(m => m.role === 'assistant').slice(-1)[0] || {}).content || '';

        // 1 · Notfall: die Nummer steht ZUERST auf dem Bildschirm. Ob die KI
        // danach noch antwortet, ist eine andere Frage (sie darf — siehe den
        // Fall „Umgangsname/Fehlalarm": ein Fehlalarm darf der Person nicht die
        // Auskunft wegnehmen). Gemessen wird, dass die Nummer die ERSTE
        // Assistenten-Zeile ist und nicht auf die KI wartet.
        await senden('meine tochter hat beeren gegessen');
        const ersteAntwort = (window._gsLinaMsgs.filter(m => m.role === 'assistant')[0] || {}).content || '';
        if (!/145/.test(ersteAntwort)) return { ok: false, warum: 'die Nummer ist nicht die erste Antwort: ' + JSON.stringify(ersteAntwort).slice(0, 120) };

        // 2 · normale Frage: die KI wird gerufen, und der Kontext traegt die ARTEN-Zeile
        window._gsLinaMsgs = [];
        await senden('Kann ich Bärlauch essen?');
        if (!rufe.length) return { ok: false, warum: 'die KI wurde bei einer normalen Frage nicht gerufen — letzte Antwort: ' + JSON.stringify(letzte()).slice(0, 200) };
        if (!/ARTEN \(aus der App-Liste/.test(rufe[rufe.length - 1])) return { ok: false, warum: 'der Kontext an die KI traegt keine ARTEN-Zeile' };

        // 3 · die Warnzeile steht UEBER der Antwort, die Antwort bleibt
        window._gsLinaMsgs = [];
        rufe.length = 0;
        await senden('Kann ich den Grünen Knollenblätterpilz essen?');
        const a3 = letzte();
        if (!/Artenliste/.test(a3)) return { ok: false, warum: 'keine Warnzeile bei essbar-Behauptung zu einer giftigen Art: ' + a3.slice(0, 160) };
        if (!/essbar/.test(a3)) return { ok: false, warum: 'die Antwort selbst wurde verschluckt: ' + a3.slice(0, 160) };
        if (a3.indexOf('Artenliste') > a3.indexOf('kannst du essen')) return { ok: false, warum: 'die Warnzeile steht UNTER der Antwort' };

        // 4 · ohne Netz antwortet sie trotzdem
        window._gsLinaMsgs = [];
        rufe.length = 0;
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false });
        await senden('Kann ich Bärlauch essen?');
        if (rufe.length) return { ok: false, warum: 'ohne Netz wurde die KI gerufen' };
        const a4 = letzte();
        if (!a4 || !/Bärlauch/i.test(a4)) return { ok: false, warum: 'ohne Netz kam keine Antwort aus der App-Liste: ' + JSON.stringify(a4).slice(0, 160) };
        return { ok: true, info: 'Notfall: 0 KI-Aufrufe, 145 · normal: Kontext mit ARTEN · Warnzeile ueber der Antwort · offline: Antwort aus der Liste' };
      } finally {
        window.callAI = sichern.ai;
        window.sbIsLoggedIn = sichern.li;
        window.sbFetch = sichern.sf;
        window.gsToast = sichern.gt;
        window.showProfileToast = sichern.sp;
        Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => sichern.on });
        window._gsLinaSending = false;
        try { if (typeof closeModal === 'function') closeModal(); } catch (_) {}
      }
    },
  },
  {
    // Dieselbe Erkennung wie der Offline-Chat, kein zweites Vokabular.
    name: 'Lina · Notfall: dieselbe Erkennung wie der Offline-Chat, in vier Sprachen — und eine harmlose Essensfrage ist keiner',
    lauf: () => {
      if (typeof _gsNotfallStufe !== 'function') return { ok: false, warum: '_gsNotfallStufe gibt es nicht — Lina hätte ein zweites Vokabular' };
      const dringend = ['meine tochter hat beeren gegessen', 'mein sohn hat pilze gegessen und erbricht',
        'vergiftung was tun', 'mon enfant a mangé des baies', 'il bambino ha mangiato bacche', 'my dog ate mushrooms help'];
      const keiner = ['kann man löwenzahn essen?', 'wann blüht der bärlauch?', 'wie pflanze ich tomaten?'];
      const f1 = dringend.filter(x => _gsNotfallStufe(x) !== 'dringend');
      if (f1.length) return { ok: false, warum: 'nicht als dringend erkannt: ' + JSON.stringify(f1) };
      const f2 = keiner.filter(x => _gsNotfallStufe(x) !== 'keiner');
      if (f2.length) return { ok: false, warum: 'harmlose Frage als Notfall: ' + JSON.stringify(f2) + ' → ' + f2.map(x => _gsNotfallStufe(x)).join(',') };
      if (_gsNotfallStufe('ich habe gestern bärlauch gegessen') !== 'hinweis') return { ok: false, warum: 'blosser Verzehr ist kein „hinweis"' };
      return { ok: true, info: dringend.length + ' dringend · ' + keiner.length + ' harmlos ohne Alarm · blosser Verzehr → hinweis' };
    },
  },
  {
    // v32.56: Lina kennt die Zahlen (§11 Idee 6). Ein Prompt ist keine Garantie
    // (§4a.2) — geprueft wird der KONTEXT: jede Prozentzahl darin ist ein
    // gespeicherter plausibler Wert, Luecken und Anzahl stehen dabei, und ohne
    // Daten sagt er „keine" statt zu schweigen.
    name: 'Lina · jede Zahl im Kontext stammt aus einem Datensatz; Lücken werden genannt; ohne Daten steht „keine"',
    lauf: () => {
      const ctx = gsLinaContext();
      if (!/REGEL: Zahlen, Daten und Gerätenamen nur aus diesem KONTEXT/.test(ctx)) return { ok: false, warum: 'die Anweisung „nur aus dem Kontext zitieren" fehlt' };
      if (!/Balkon Süd · Erde \[Von Hand\]/.test(ctx)) return { ok: false, warum: 'das Beispielgerät steht nicht im Kontext: ' + ctx.slice(0, 200) };
      if (!/Bodenfeuchte 22 %/.test(ctx)) return { ok: false, warum: 'der letzte plausible Wert (22 %) fehlt' };
      // Sieben Seed-Werte, der aelteste 7 Tage und 4 Stunden alt — im 7-Tage-Fenster sind es sechs.
      if (!/Bodenfeuchte 22 % \(31\.08\. 08:00; 6 Werte in 7 Tagen; letzter Wert vor 28 h\)/.test(ctx)) return { ok: false, warum: 'Wert, Zeit, Anzahl oder Lücke stimmen nicht: ' + (ctx.match(/Messwerte:.*/) || [''])[0].slice(0, 220) };
      if (!/letzter Wert vor \d+ h/.test(ctx)) return { ok: false, warum: 'die Lücke seit dem letzten Wert fehlt' };
      if (!/Alarme: Balkon Süd · Erde: Bodenfeuchte unter 25 %/.test(ctx)) return { ok: false, warum: 'die verletzte Regel fehlt: ' + (ctx.match(/Alarme:.*/) || [''])[0] };
      if (!/Fällig: .*Basilikum giessen \(seit 1 Tag\)/.test(ctx)) return { ok: false, warum: 'die fällige Aufgabe fehlt: ' + (ctx.match(/Fällig:.*/) || [''])[0] };
      const werte = new Set(_gsMesswerteAlle().filter(m => m.quality === 2).map(m => String(m.wert)));
      const zeile = (ctx.match(/Messwerte:.*/) || [''])[0];
      const zahlen = Array.from(zeile.matchAll(/(\d+(?:\.\d+)?) (?:%|°C)/g)).map(m => m[1]);
      const fremd = zahlen.filter(z => !werte.has(z) && !werte.has(String(Number(z))));
      if (!zahlen.length || fremd.length) return { ok: false, warum: 'Zahlen im Kontext ohne Datensatz: ' + JSON.stringify(fremd) + ' von ' + JSON.stringify(zahlen) };
      // v33.39: die Schranke wird GERECHNET, nicht geraten. Bis hierher stand hier
      // 1'350 — eine Zahl, die zufaellig hielt: der Kontext ist gsLinaZahlen (Deckel
      // GS_LINA_ZAHLEN_MAX) + die ARTEN-Zeile (Deckel GS_LINA_ARTEN_MAX) + drei feste
      // Zeilen (gemessen 348 Zeichen). Mit dem Kalender-Block waere 1'350 gerissen,
      // ohne dass irgendein Teil zu gross ist.
      const schranke = GS_LINA_ZAHLEN_MAX + GS_LINA_ARTEN_MAX + 400;
      if (ctx.length > schranke) return { ok: false, warum: 'Kontext ' + ctx.length + ' Zeichen (Schranke ' + schranke + ') — das ist ein Datenexport, kein Kontext' };
      const sichern = { g: localStorage.getItem('gs_geraete'), mp: myPlants, pl: plantings };
      try {
        localStorage.setItem('gs_geraete', '[]'); myPlants = []; plantings = [];
        const leer = gsLinaContext();
        if (!/Fällig: keine Aufgaben heute/.test(leer) || !/Geräte: keine/.test(leer)) return { ok: false, warum: 'ohne Daten schweigt der Kontext statt „keine" zu sagen: ' + leer };
      } finally { if (sichern.g != null) localStorage.setItem('gs_geraete', sichern.g); myPlants = sichern.mp; plantings = sichern.pl; }
      return { ok: true, info: ctx.length + ' Zeichen · ' + zahlen.length + ' Zahlen, alle aus Datensätzen · Alarm, Fälligkeit, Anzahl und Lücke genannt · ohne Daten „keine"' };
    },
  },
  {
    name: 'Lina · Kalender: die naechsten Aussaatfenster und Plan-Termine stehen im Kontext — jede Zeile ist ein Ereignis der einen Kalenderfunktion; ohne Kulturen und Plaene keine Zeile',
    lauf: () => {
      // v33.14. Die Uhr steht auf dem 01.09.2025: Feldsalat wird im Aussaat-
      // kalender im Aug/Sep draussen gesaet, also liegt ein Fenster im
      // 60-Tage-Blick; ein Plan mit sow_date im Fenster liefert den Termin.
      const J = gsHeuteTag().slice(0, 4);
      const sichern = { mp: myPlants, pla: localStorage.getItem('gs_garden_plans') };
      try {
        window.myPlants = [{ id: 'lk1', name: 'Feldsalat', tasks: {} }, { id: 'lk2', name: 'Monstera', tasks: {} }];
        localStorage.setItem('gs_garden_plans', JSON.stringify([{ id: 'lk-plan', created: J + '-08-01T10:00:00.000Z', title: 'Plan vom 01.08. · Herbstbeet',
          plan: { summary: 'Herbst', plants: [{ name: 'Spinat', icon: '🥬', sow_date: J + '-09-15', harvest_from: J + '-10-20', harvest_to: J + '-11-15' }], timeline: [] } }]));
        const ctx = gsLinaContext();
        const klagen = [];
        const zA = (ctx.match(/Nächste Aussaat[^\n]*/) || [''])[0], zP = (ctx.match(/^Plan \(\d+ Tage\):[^\n]*/m) || [''])[0];
        if (!zA) klagen.push('keine Aussaat-Zeile, obwohl Feldsalat im Fenster liegt');
        if (!zP) klagen.push('keine Plan-Zeile, obwohl ein Plan mit Termin im Fenster liegt');
        if (zA && !/Feldsalat/.test(zA)) klagen.push('Aussaat-Zeile nennt Feldsalat nicht: ' + zA);
        if (zA && /Monstera/.test(zA)) klagen.push('Monstera (keine Kultur) steht in der Aussaat-Zeile');
        if (zA && !/400–800 m/.test(zA)) klagen.push('Aussaat-Zeile nennt die Lagen nicht');
        [zA, zP].filter(Boolean).forEach(z => { if (z.length > 160) klagen.push('Kalenderzeile zu lang (' + z.length + ' > 160): Datenexport statt Kontext'); });
        if (zP && !/Spinat säen 15\.9\./.test(zP)) klagen.push('Plan-Zeile nennt „Spinat säen 15.9." nicht: ' + zP);
        // Jede genannte Zeile muss ein Ereignis der EINEN Funktion sein
        const ev = gsKalenderEreignisse(gsHeuteTag(), _gsKalTagPlus(gsHeuteTag(), 60));
        const titel = new Set(ev.map(e => e.titel));
        [zA, zP].filter(Boolean).forEach(z => {
          z.replace(/^[^:]+: /, '').replace(/\.$/, '').split('; ').forEach(st => {
            if (/^\+\d+$/.test(st) || /…$/.test(st)) return;     // „+2" und Abschnitt sind keine Titel
            const t = st.replace(/ ab \d+\.\d+\.$/, '').replace(/ \d+\.\d+\.$/, '');
            if (!titel.has(t)) klagen.push('„' + t + '" ist kein Ereignis der Kalenderfunktion');
          });
        });
        const schranke = GS_LINA_ZAHLEN_MAX + GS_LINA_ARTEN_MAX + 400;   // v33.39: gerechnet, nicht geraten
        if (ctx.length > schranke) klagen.push('Kontext ' + ctx.length + ' Zeichen (Schranke ' + schranke + ') — Datenexport statt Kontext');
        // Gegenrichtung: ohne Kulturen und Plaene keine dieser Zeilen — und kein erfundenes „keine"
        window.myPlants = [{ id: 'lk3', name: 'Monstera', tasks: {} }]; localStorage.removeItem('gs_garden_plans');
        const leer = gsLinaContext();
        if (/Nächste Aussaat|^Plan \(/m.test(leer)) klagen.push('ohne Kulturen und Plaene steht trotzdem eine Kalenderzeile');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: zA.slice(0, 70) + '… · ' + zP.slice(0, 60) + '… · alle genannten Titel sind Kalender-Ereignisse · ohne Daten keine Zeile · ' + ctx.length + ' Zeichen' };
      } finally {
        window.myPlants = sichern.mp;
        if (sichern.pla == null) localStorage.removeItem('gs_garden_plans'); else localStorage.setItem('gs_garden_plans', sichern.pla);
      }
    },
  },
  {
    name: 'Lina · handeln: open_calendar oeffnet den Kalender am genannten Tag, open_saekalender den Saekalender, ein erfundenes Tool tut nichts — und der Auftrag nennt beide',
    lauf: async () => {
      // v33.22. Lina kennt den Kalender seit v33.14 — jetzt kann sie ihn
      // oeffnen. Der Dispatcher (gsLinaDispatch) ist die EINE Stelle, durch
      // die jede Aktion muss; bis v33.21 hatte er keinen Pruefstand.
      const J = gsHeuteTag().slice(0, 4);
      const sichern = { mp: myPlants };
      const warte = (ms) => new Promise(r => setTimeout(r, ms));
      const text = () => ((document.getElementById('modal-content') || {}).textContent || '').replace(/\s+/g, ' ');
      const zu = () => { try { closeModal('detail-modal'); } catch (_) {} };
      try {
        window.myPlants = [{ id: 'lh1', name: 'Feldsalat', tasks: {} }];
        const klagen = [];
        // 1 · Kalender am 01.09. — Feldsalat liegt dort im Aussaatfenster
        zu();
        await gsLinaDispatch({ tool: 'open_calendar', args: { day: J + '-09-01' } });
        await warte(350);
        const t1 = text();
        if (!/Feldsalat/.test(t1)) klagen.push('open_calendar zeigt den 01.09. nicht (Feldsalat fehlt): „' + t1.slice(0, 120) + '"');
        if (typeof _gsKalStand !== 'undefined' && _gsKalStand.tag !== J + '-09-01') klagen.push('Kalender steht auf ' + (_gsKalStand && _gsKalStand.tag) + ' statt ' + J + '-09-01');
        zu();
        // 2 · ohne day → heute
        await gsLinaDispatch({ tool: 'open_calendar', args: {} });
        await warte(350);
        if (typeof _gsKalStand !== 'undefined' && _gsKalStand.tag !== gsHeuteTag()) klagen.push('ohne day steht der Kalender auf ' + _gsKalStand.tag + ' statt heute');
        zu();
        // 3 · Saekalender
        await gsLinaDispatch({ tool: 'open_saekalender', args: {} });
        await warte(350);
        const t3 = text();
        // Der Saekalender zeigt den laufenden Monat (September: 10 Kulturen) — der Titel und die Monatszeile sind der Beleg, nicht eine Kultur, die im September nicht dran ist
        if (!/S[äa]e?kalender/.test(t3) || !/diesen Monat/.test(t3)) klagen.push('open_saekalender zeigt den Saekalender nicht: „' + t3.slice(0, 120) + '"');
        zu();
        // 4 · ein erfundenes Tool tut nichts — kein Fenster, kein Fehler
        const vorher = text();
        await gsLinaDispatch({ tool: 'delete_everything', args: { all: true } });
        await warte(350);
        const dm = document.getElementById('detail-modal');
        const offen = dm && dm.style.display !== 'none' && dm.classList.contains('active');
        if (offen && text() !== vorher) klagen.push('ein erfundenes Tool hat ein Fenster geoeffnet');
        // 5 · der Auftrag an Lina nennt beide Werkzeuge
        if (!/open_calendar/.test(LINA_SYSTEM) || !/open_saekalender/.test(LINA_SYSTEM)) klagen.push('LINA_SYSTEM nennt open_calendar/open_saekalender nicht — Lina kann nicht rufen, was sie nicht kennt');
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'Kalender am 01.09. (Feldsalat) · ohne day heute · Saekalender (Tomaten, Feldsalat) · erfundenes Tool: nichts · Auftrag nennt beide' };
      } finally { window.myPlants = sichern.mp; zu(); }
    },
  },
  {
    name: 'Lina · letzter Scan: der juengste Eintrag des Scan-Verlaufs steht im Kontext — Name, Latein, Sicherheit, Alter; ohne Verlauf keine Zeile; nie das Foto',
    lauf: () => {
      // v33.23. Die Uhr steht auf dem 01.09.2025 12:00.
      const key = (typeof SCAN_HISTORY_KEY !== 'undefined') ? SCAN_HISTORY_KEY : 'gs_scan_history';
      const vorher = localStorage.getItem(key);
      const jetzt = Date.now();
      try {
        localStorage.setItem(key, JSON.stringify([
          { id: 's-alt', name: 'Bärlauch', latin: 'Allium ursinum', confidence: 91, emoji: '🌿', timestamp: new Date(jetzt - 5 * 864e5).toISOString(), category: 'wildpflanze', thumb: 'data:image/jpeg;base64,AAAA' },
          { id: 's-neu', name: 'Tomate', latin: 'Solanum lycopersicum', confidence: 88, emoji: '🍅', timestamp: new Date(jetzt - 3600e3).toISOString(), category: 'gemuese', thumb: 'data:image/jpeg;base64,BBBB' },
        ]));
        const ctx = gsLinaContext();
        const z = (ctx.match(/^Letzter Scan:[^\n]*/m) || [''])[0];
        const klagen = [];
        if (!z) klagen.push('keine Zeile „Letzter Scan", obwohl der Verlauf zwei Eintraege hat');
        else {
          if (!/Tomate/.test(z) || /Bärlauch/.test(z)) klagen.push('nennt nicht den JUENGSTEN Scan: ' + z);
          if (!/Solanum lycopersicum/.test(z)) klagen.push('Latein fehlt: ' + z);
          if (!/88 % sicher/.test(z)) klagen.push('Sicherheit fehlt oder falsch: ' + z);
          if (!/heute/.test(z)) klagen.push('Alter fehlt (heute): ' + z);
          if (/base64|data:image/.test(z)) klagen.push('das Foto steht im Kontext');
          if (z.length > 160) klagen.push('Zeile zu lang (' + z.length + ')');
        }
        // Gegenrichtung: ohne Verlauf keine Zeile
        localStorage.removeItem(key);
        const ctx2 = gsLinaContext();
        if (/^Letzter Scan:/m.test(ctx2)) klagen.push('Zeile erscheint ohne Verlauf');
        // Alter: vor 5 Tagen
        localStorage.setItem(key, JSON.stringify([{ id: 's-alt', name: 'Bärlauch', latin: 'Allium ursinum', confidence: 91, timestamp: new Date(jetzt - 5 * 864e5).toISOString() }]));
        const z3 = (gsLinaContext().match(/^Letzter Scan:[^\n]*/m) || [''])[0];
        if (!/vor 5 Tagen/.test(z3)) klagen.push('Alter falsch: ' + z3);
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: z + ' · ohne Verlauf keine Zeile · 5 Tage alt: „vor 5 Tagen"' };
      } finally { if (vorher == null) localStorage.removeItem(key); else localStorage.setItem(key, vorher); }
    },
  },
  {
    // v33.33: die Scan-Historie hat DREI Zeitfelder (timestamp ISO aus
    // gsAddToScanHistory, ts ms aus dem Scanner-Hauptweg und aus dem
    // Cloud-Abgleich, createdAt ms aus gsAddScanHistory). Die Liste der App
    // liest seit v30.54 tolerant; die Lina-Zeile aus v33.23 verlangte
    // `h.timestamp` allein — nach gsLoadCloudScans (gewinnt den Dedup, schreibt
    // nur ts) sah Lina 0 Scans. Und `conf` (Cloud) neben `confidence` (App).
    name: 'Lina · letzter Scan ueberlebt den Cloud-Abgleich: ts (Cloud), timestamp (App) und createdAt (Merge) lesen dieselbe Zeit ueber EINE Funktion — der juengste gewinnt, egal welches Feld er traegt',
    lauf: () => {
      const key = (typeof SCAN_HISTORY_KEY !== 'undefined') ? SCAN_HISTORY_KEY : 'gs_scan_history';
      const vorher = localStorage.getItem(key);
      const jetzt = Date.now();
      try {
        const klagen = [];
        // 1 · Cloud-Form: nur ts (ms) und conf — so schreibt gsLoadCloudScans
        localStorage.setItem(key, JSON.stringify([{ id: 'c1', name: 'Steinpilz', latin: 'Boletus edulis', conf: 88, ts: jetzt - 2 * 3600e3, _cloud: true }]));
        const z1 = (gsLinaContext().match(/^Letzter Scan:[^\n]*/m) || [''])[0];
        if (!z1) klagen.push('Cloud-Eintrag (nur ts): KEINE Zeile');
        else {
          if (!/Steinpilz/.test(z1) || !/heute/.test(z1)) klagen.push('Cloud-Eintrag: ' + z1);
          if (!/88 % sicher/.test(z1)) klagen.push('Sicherheit aus `conf` fehlt: ' + z1);
        }
        // 2 · drei Eintraege, drei Zeitfelder — der JUENGSTE traegt createdAt
        localStorage.setItem(key, JSON.stringify([
          { id: 'a', name: 'Bärlauch', latin: 'Allium ursinum', confidence: 91, timestamp: new Date(jetzt - 5 * 864e5).toISOString() },
          { id: 'b', name: 'Steinpilz', latin: 'Boletus edulis', conf: 88, ts: jetzt - 3 * 864e5 },
          { id: 'c', name: 'Tomate', latin: 'Solanum lycopersicum', confidence: 77, createdAt: jetzt - 1 * 864e5 },
        ]));
        const z2 = (gsLinaContext().match(/^Letzter Scan:[^\n]*/m) || [''])[0];
        if (!/Tomate/.test(z2) || !/gestern/.test(z2)) klagen.push('juengster (createdAt) nicht erkannt: ' + (z2 || '(keine Zeile)'));
        // 3 · EINE Lesefunktion, drei Formen, und leer ist null — nicht 0
        if (typeof _gsScanZeit !== 'function') klagen.push('_gsScanZeit fehlt');
        else {
          const t = [_gsScanZeit({ ts: 5 }), _gsScanZeit({ timestamp: '1970-01-01T00:00:00.006Z' }), _gsScanZeit({ createdAt: 7 }), _gsScanZeit({}), _gsScanZeit(null)];
          if (t[0] !== 5 || t[1] !== 6 || t[2] !== 7 || t[3] !== null || t[4] !== null) klagen.push('_gsScanZeit: ' + JSON.stringify(t));
        }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: z1 + ' · drei Felder, juengster gewinnt: ' + z2 };
      } finally { if (vorher == null) localStorage.removeItem(key); else localStorage.setItem(key, vorher); }
    },
  },
  {
    // v33.33: gsOpenLina lud `order=created_at.asc&limit=100` — die AELTESTEN
    // hundert. Ab Nachricht 101 sah Lina beim Oeffnen die ersten hundert und
    // schickte davon slice(-16), also Nachrichten 85–100; der juengste Teil des
    // Gespraechs fehlte komplett, ohne dass etwas meldete. Zehn Fragen am Tag
    // (Freikontingent) sind 20 Zeilen — 100 sind nach fuenf Tagen erreicht.
    name: 'Lina · Verlauf: bei 120 Nachrichten holt gsOpenLina die NEUESTEN 100 (N21 … N120) und zeigt sie in zeitlicher Reihenfolge — nicht die aeltesten',
    lauf: async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtOpen = window._gsNlOpen, echtRender = window.gsLinaRender;
      const echtMsgs = window._gsLinaMsgs, echtConv = window._gsLinaConvId;
      try {
        window.sbIsLoggedIn = () => true;
        window._gsNlOpen = () => {};
        window.gsLinaRender = () => {};
        const alle = []; for (let i = 1; i <= 120; i++) alle.push({ role: i % 2 ? 'user' : 'assistant', content: 'N' + i, created_at: new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString() });
        let abfrage = '';
        window.sbFetch = async (path) => {
          if (/coach_conversations/.test(path)) return { data: [{ id: 'conv-1' }], error: null };
          if (/coach_messages/.test(path)) {
            abfrage = path;
            const desc = /order=created_at\.desc/.test(path);
            const lim = parseInt((path.match(/limit=(\d+)/) || [0, '100'])[1], 10);
            const sortiert = alle.slice().sort((a, b) => desc ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at));
            return { data: sortiert.slice(0, lim).map(m => ({ role: m.role, content: m.content })), error: null };
          }
          return { data: [], error: null };
        };
        await gsOpenLina();
        const msgs = window._gsLinaMsgs || [];
        const klagen = [];
        if (!abfrage) klagen.push('coach_messages wurde gar nicht abgefragt');
        if (msgs.length !== 100) klagen.push(msgs.length + ' Nachrichten statt 100');
        if (!msgs.length || msgs[msgs.length - 1].content !== 'N120') klagen.push('die letzte geladene ist ' + (msgs.length ? msgs[msgs.length - 1].content : '(keine)') + ' statt N120 — es sind die AELTESTEN');
        if (msgs.length && msgs[0].content !== 'N21') klagen.push('erste ist ' + msgs[0].content + ' statt N21');
        for (let i = 1; i < msgs.length; i++) { if (parseInt(msgs[i].content.slice(1), 10) <= parseInt(msgs[i - 1].content.slice(1), 10)) { klagen.push('Reihenfolge nicht zeitlich: ' + msgs[i - 1].content + ' → ' + msgs[i].content); break; } }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') + ' [' + abfrage.replace(/^.*\?/, '?') + ']' };
        return { ok: true, info: 'N21 … N120 in zeitlicher Reihenfolge · Abfrage ' + abfrage.replace(/^.*\?/, '?') };
      } finally { window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin; window._gsNlOpen = echtOpen; window.gsLinaRender = echtRender; window._gsLinaMsgs = echtMsgs; window._gsLinaConvId = echtConv; }
    },
  },
  {
    // v33.33: gsLinaResolvePlant suchte NUR myPlants (die Garten-Pflanzung
    // „Zucchini" steht in gsGetDueTasks, in der Faellig-Zeile und in
    // gsPflanzenZahl — und war fuer eine Erinnerung unerreichbar) und fiel auf
    // indexOf zurueck („Mon" → Monstera). CLAUDE.md §3.3: _gsPflanzeFinden.
    name: 'Lina · Pflanze aufloesen: ueber _gsPflanzeFinden in BEIDEN Listen (Garten-Pflanzung „Zucchini" wird gefunden), Name oder Spitzname exakt — kein Teilstring („Mon" trifft nichts)',
    lauf: () => {
      const klagen = [];
      const pl = (typeof plantings !== 'undefined' && Array.isArray(plantings)) ? plantings : [];
      const zuc = pl.find(p => p && /zucchini/i.test(p.name || ''));
      if (!zuc) return { ok: false, warum: 'Beispieldaten ohne Garten-Pflanzung „Zucchini" — der Fall misst nichts' };
      const r1 = gsLinaResolvePlant(null, 'Zucchini');
      if (!r1 || r1.id !== zuc.id) klagen.push('„Zucchini" (Garten-Pflanzung) nicht gefunden: ' + JSON.stringify(r1 ? r1.name : null));
      const r1b = gsLinaResolvePlant(zuc.id, null);
      if (!r1b || r1b.id !== zuc.id) klagen.push('Pflanzung ueber die id nicht gefunden');
      const mon = myPlants.find(p => p && /monstera/i.test(p.name || ''));
      if (!mon) klagen.push('Beispieldaten ohne Monstera');
      else {
        const r2 = gsLinaResolvePlant(null, 'Mon');
        if (r2) klagen.push('Teilstring „Mon" trifft „' + r2.name + '"');
        const r3 = gsLinaResolvePlant(null, String(mon.name).toUpperCase());
        if (!r3 || r3.id !== mon.id) klagen.push('exakter Name in Grossschreibung nicht gefunden');
        const alterNick = mon.nick; mon.nick = 'Die Grosse im Flur';
        try { const r4 = gsLinaResolvePlant(null, 'die grosse im flur'); if (!r4 || r4.id !== mon.id) klagen.push('Spitzname nicht gefunden'); }
        finally { mon.nick = alterNick; }
      }
      if (gsLinaResolvePlant(null, 'Gibtsnicht') !== null) klagen.push('erfundener Name liefert etwas');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Zucchini (plantings) ✓ · id ✓ · „Mon" → null · exakt + Spitzname ✓ · erfunden → null' };
    },
  },
  {
    // v33.33: der Kontext rechnete myPlants.length + plantings.length selbst —
    // eine zweite Rechnung an der Frage, die gsPflanzenZahl() beantwortet (v33.06).
    name: 'Lina · die Pflanzenzahl im Kontext kommt aus gsPflanzenZahl() — nicht aus einer zweiten Rechnung',
    lauf: () => {
      const echt = window.gsPflanzenZahl;
      try {
        window.gsPflanzenZahl = () => 4711;
        const c = gsLinaContext();
        const satz = (c.match(/Die Person hat[^\n.]*/) || ['(kein Satz)'])[0];
        if (!/4711 Pflanze/.test(c)) return { ok: false, warum: 'Kontext rechnet selbst: ' + satz };
        return { ok: true, info: satz };
      } finally { window.gsPflanzenZahl = echt; }
    },
  },
  {
    // v32.57: Zwei Geraete, dieselbe Groesse, zwei Linien (§11 Idee 9). Nur
    // Messgroessen, die BEIDE haben; die Legende nennt beide; die Zahl der
    // gezeichneten Reihen steht am Canvas; ein Geraet ohne die Groesse fehlt
    // in der Auswahl.
    name: 'Vergleich · zwei Geräte, dieselbe Grösse, zwei Linien mit Legende — nur Grössen, die beide haben',
    lauf: () => {
      const gB = gsGeraetAnlegen({ kind: 'manual', name: 'Balkon Nord · Erde', garden_id: 'g1' });
      const gC = gsGeraetAnlegen({ kind: 'manual', name: 'Licht-Probe', garden_id: 'g1' });
      try {
        for (let i = 0; i < 5; i++) gsMesswertEintragen(gB.id, 'soil_moisture', 40 + i, new Date(Date.now() - (5 - i) * 864e5).toISOString());
        gsMesswertEintragen(gC.id, 'light', 800, new Date(Date.now() - 3600000).toISOString());   // nur EIN Geraet hat Licht
        gsMesswerteOeffnen();
        const mc = document.getElementById('modal-content');
        const sel = mc.querySelector('#mw-vgl-metric'); if (!sel) return { ok: false, warum: 'kein Vergleich im Dashboard, obwohl zwei Geräte Bodenfeuchte haben' };
        const groessen = Array.from(sel.options).map(o => o.value);
        if (groessen.indexOf('soil_moisture') < 0) return { ok: false, warum: 'Bodenfeuchte fehlt in der Auswahl' };
        if (groessen.indexOf('light') >= 0) return { ok: false, warum: 'Licht steht zur Auswahl, obwohl nur ein Gerät es misst' };
        const a = mc.querySelector('#mw-vgl-a'), b = mc.querySelector('#mw-vgl-b');
        const seed = gsGeraete().find(g => g.id === 'ger_seed_1');
        a.value = seed.id; b.value = gB.id; _gsMwVergleichMalen();
        const cv = mc.querySelector('#mw-vgl-canvas');
        if (!cv || cv.width < 100) return { ok: false, warum: 'Vergleichs-Diagramm nicht gezeichnet' };
        if (cv.dataset.reihen !== '2') return { ok: false, warum: 'gezeichnete Reihen: ' + cv.dataset.reihen + ' (erwartet 2)' };
        const leg = (mc.querySelector('#mw-vgl-legende') || {}).textContent || '';
        if (!/Balkon Süd · Erde/.test(leg) || !/Balkon Nord · Erde/.test(leg) || !/Bodenfeuchte/.test(leg)) return { ok: false, warum: 'die Legende nennt nicht beide Geräte und die Grösse: ' + leg };
        if (!/\(7\)/.test(leg) || !/\(5\)/.test(leg)) return { ok: false, warum: 'die Legende nennt die Zahl der plausiblen Werte nicht (7 und 5): ' + leg };
        const px = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let gruen = 0, blau = 0;
        for (let i = 0; i < px.length; i += 4) { if (px[i + 3] > 0) { if (px[i + 2] > 150 && px[i] < 80) blau++; else if (px[i + 1] > 100 && px[i] < 80 && px[i + 2] < 80) gruen++; } }
        if (gruen < 20 || blau < 20) return { ok: false, warum: 'zwei Linien versprochen, gezeichnet: grün ' + gruen + ' px, blau ' + blau + ' px' };
        if (!/vergleiche den Verlauf, nicht die Zahl/.test(mc.textContent)) return { ok: false, warum: 'der Hinweis „Verlauf, nicht Zahl" fehlt' };
        if (!cv.getAttribute('aria-label') || !/Balkon Süd · Erde \(.*\) und Balkon Nord · Erde \(/.test(cv.getAttribute('aria-label'))) return { ok: false, warum: 'aria-label nennt die Geräte nicht: ' + cv.getAttribute('aria-label') };
        return { ok: true, info: 'Bodenfeuchte wählbar, Licht (nur ein Gerät) nicht · 2 Reihen · Legende: Süd (7) · Nord (5) · grün ' + gruen + ' px, blau ' + blau + ' px · Hinweis da' };
      } finally { gsGeraetLoeschen(gB.id); gsGeraetLoeschen(gC.id); }
    },
  },
  {
    // v32.57: CSV-Export der Messwerte (§11 Idee 12) — die Einheit steht IN der
    // Datei, ein Wert je Zeile, Geraet, Qualitaet und Quelle dabei. Die
    // Funktion liefert den Text zurueck; der Download wird nicht gestellt.
    name: 'CSV · der Messwerte-Export trägt Einheit, Gerät, Qualität und Quelle — ein Wert je Zeile',
    lauf: () => {
      const echtClick = HTMLAnchorElement.prototype.click; let klicks = 0;
      HTMLAnchorElement.prototype.click = function () { klicks++; };
      try {
        const csv = gsExportMesswerteCSV();
        const zeilen = csv.split('\r\n').filter(Boolean);
        if (!zeilen.length) return { ok: false, warum: 'leerer Export' };
        if (!/^Zeitpunkt,Gerät,Gerät-Id,Messgrösse,Messgrösse-Schlüssel,Wert,Einheit,Qualität,Quelle$/.test(zeilen[0])) return { ok: false, warum: 'Kopfzeile: ' + zeilen[0] };
        const n = _gsMesswerteAlle().length;
        if (zeilen.length - 1 !== n) return { ok: false, warum: (zeilen.length - 1) + ' Zeilen für ' + n + ' Werte' };
        const seedZeile = zeilen.find(z => /"Balkon Süd · Erde"/.test(z) && /"soil_moisture"/.test(z) && /,22,/.test(z));
        if (!seedZeile) return { ok: false, warum: 'die Zeile für Balkon Süd · Erde, Bodenfeuchte 22 fehlt' };
        if (!/"%"/.test(seedZeile) || !/"plausibel"/.test(seedZeile) || !/"hand"/.test(seedZeile) || !/"Bodenfeuchte"/.test(seedZeile)) return { ok: false, warum: 'Einheit, Qualität, Quelle oder Name fehlen: ' + seedZeile };
        const unpl = zeilen.find(z => /,250,/.test(z));
        if (!unpl || !/ausserhalb des Messbereichs/.test(unpl)) return { ok: false, warum: 'der unplausible Wert (250) ist nicht als solcher markiert: ' + unpl };
        const ts = zeilen.slice(1).map(z => z.split(',')[0]);
        if (JSON.stringify(ts) !== JSON.stringify(ts.slice().sort())) return { ok: false, warum: 'die Zeilen sind nicht chronologisch' };
        if (klicks !== 1) return { ok: false, warum: 'Download-Klicks: ' + klicks + ' (erwartet 1)' };
        return { ok: true, info: zeilen.length - 1 + ' Zeilen · Kopf mit Einheit · 22 % plausibel/hand · 250 ausserhalb · chronologisch · 1 Download' };
      } finally { HTMLAnchorElement.prototype.click = echtClick; }
    },
  },
  {
    // v32.58: „Deine Woche" (§11 Idee 8) — Zahlen mit Quelle, keine Note. Der
    // Fall liest die Karte aus dem HTML, stellt einen Wetterdienst mit 10 mm
    // Regen und einer Frostnacht, ein Geraet, das vier Tage schwieg — und
    // raeumt alles weg, um „ohne Daten" zu sehen.
    name: 'Deine Woche · Aufgaben, Regen, Frostnächte, Feuchte-Tief und Stille — mit Quelle, ohne Note; ohne Daten sagt es die Karte',
    lauf: () => {
      const sichern = { g: localStorage.getItem('gs_geraete'), mw: localStorage.getItem('gs_messwerte'), mp: myPlants, pl: plantings, tb: localStorage.getItem('gs_gartentagebuch'), cloud: localStorage.getItem('gs_garden_diary_cache') };
      const zeilen = () => Array.from(document.querySelectorAll('#woche-zeilen > div')).map(d => d.textContent);
      try {
        gsRenderWochenrueckblick();
        let z = zeilen();
        if (!z.some(t => /^✅ \d+ Aufgaben? erledigt · \d+ heute offen$/.test(t))) return { ok: false, warum: 'Aufgaben-Zeile fehlt oder hat kein Format: ' + JSON.stringify(z) };
        if (!z.some(t => /kein Wetterdienst als Gerät/.test(t))) return { ok: false, warum: 'ohne Wetterdienst muss die Karte „kein Regen- und Frostwert" sagen: ' + JSON.stringify(z) };
        if (!z.some(t => /Balkon Süd · Erde: nie unter 22 % \(6 Werte\)/.test(t))) return { ok: false, warum: 'Feuchte-Tief des Seed-Geräts fehlt: ' + JSON.stringify(z) };
        if (z.some(t => /Note|Score|Punkte/.test(t))) return { ok: false, warum: 'die Karte vergibt eine Note' };
        // Wetterdienst mit 10 mm Regen und einer Frostnacht (gemessen)
        const heute = gsHeuteTag(), gestern = _gsKalTagPlus(heute, -1);
        const time = [], temp = [], rain = [];
        [gestern, heute].forEach(tag => { for (let h = 0; h < 24; h++) { time.push(tag + 'T' + String(h).padStart(2, '0') + ':00'); temp.push(tag === gestern && h === 5 ? 1 : 12); rain.push(tag === gestern && h === 14 ? 10 : 0); } });
        localStorage.removeItem('gs_wetter_geraet_aus');
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { hourly: { time, temperature_2m: temp, precipitation: rain } } }));
        const r = gsWetterGeraetAbgleich(); if (!r.ok) return { ok: false, warum: 'Wetterabgleich: ' + JSON.stringify(r) };
        const still = gsGeraetAnlegen({ kind: 'manual', name: 'Balkon Nord · Erde', garden_id: 'g1' });
        gsMesswertEintragen(still.id, 'soil_moisture', 35, new Date(Date.now() - 4 * 864e5).toISOString());
        gsRenderWochenrueckblick(); z = zeilen();
        if (!z.some(t => /^🌧️ 10 mm Regen · 1 Frostnacht \(Wetterdienst.*gemessen\)$/.test(t))) return { ok: false, warum: 'Regen/Frost-Zeile: ' + JSON.stringify(z) };
        if (!z.some(t => /Balkon Nord · Erde schwieg 4 Tage/.test(t))) return { ok: false, warum: 'das schweigende Gerät fehlt: ' + JSON.stringify(z) };
        // ohne Daten
        localStorage.setItem('gs_geraete', '[]'); localStorage.setItem('gs_messwerte', '[]'); myPlants = []; plantings = [];
        localStorage.setItem('gs_gartentagebuch', '[]'); gsTagebuchLoad(true); localStorage.removeItem('gs_garden_diary_cache');
        gsRenderWochenrueckblick();
        const titel = (document.getElementById('woche-titel') || {}).textContent || '';
        if (!/Noch keine Woche mit Daten/.test(titel) || zeilen().length !== 1) return { ok: false, warum: 'ohne Daten: „' + titel + '" · ' + JSON.stringify(zeilen()) };
        return { ok: true, info: 'Aufgaben-Zeile · ohne Wetterdienst „kein Wert" · Süd: nie unter 22 % (6) · mit Wetterdienst: 10 mm, 1 Frostnacht, gemessen · Nord schwieg 4 Tage · ohne Daten sagt es die Karte' };
      } finally {
        if (sichern.g != null) localStorage.setItem('gs_geraete', sichern.g); if (sichern.mw != null) localStorage.setItem('gs_messwerte', sichern.mw);
        myPlants = sichern.mp; plantings = sichern.pl;
        if (sichern.tb != null) localStorage.setItem('gs_gartentagebuch', sichern.tb); gsTagebuchLoad(true);
        if (sichern.cloud != null) localStorage.setItem('gs_garden_diary_cache', sichern.cloud);
        localStorage.removeItem('gs_weather_cache'); localStorage.removeItem('gs_wetter_geraet_aus');
        gsRenderWochenrueckblick();
      }
    },
  },
  {
    // v32.60 (§11 Idee 21b): das Diagramm sagt, was es zeigt. `role="img"` und
    // ein Name waren da — aber „Verlauf Bodenfeuchte · Gerät" ist ein Bild
    // ohne Inhalt. Jetzt Tief, Hoch, letzter Wert mit Datum; im Vergleich je
    // Reihe Anzahl, Tief und Hoch.
    name: 'Diagramm-Text · das Canvas nennt Tief, Hoch und letzten Wert — auch der Vergleich je Reihe',
    lauf: () => {
      gsMesswerteOeffnen();
      const mc = document.getElementById('modal-content');
      const cv = mc.querySelector('canvas.gs-mw-verlauf[data-geraet="ger_seed_1"]');
      if (!cv) return { ok: false, warum: 'kein Verlaufs-Canvas des Beispielgeräts' };
      const a = cv.getAttribute('aria-label') || '';
      if (!/Bodenfeuchte · Balkon Süd · Erde · 8 Werte · Tief 22 % · Hoch 52 % · zuletzt 22 % am 31\.08\./.test(a)) return { ok: false, warum: 'aria-label: ' + a };
      const gB = gsGeraetAnlegen({ kind: 'manual', name: 'Vergleichs-Probe', garden_id: 'g1' });
      try {
        gsMesswertEintragen(gB.id, 'soil_moisture', 40, new Date(Date.now() - 2 * 864e5).toISOString());
        gsMesswertEintragen(gB.id, 'soil_moisture', 45, new Date(Date.now() - 864e5).toISOString());
        gsMesswerteOeffnen();
        const mc2 = document.getElementById('modal-content');
        const selA = mc2.querySelector('#mw-vgl-a'), selB = mc2.querySelector('#mw-vgl-b');
        if (!selA || !selB) return { ok: false, warum: 'kein Vergleich' };
        selA.value = 'ger_seed_1'; selB.value = gB.id; _gsMwVergleichMalen();
        const v = mc2.querySelector('#mw-vgl-canvas').getAttribute('aria-label') || '';
        if (!/Balkon Süd · Erde \(7 Werte, Tief 22, Hoch 52\) und Vergleichs-Probe \(2 Werte, Tief 40, Hoch 45\) · Bodenfeuchte %/.test(v)) return { ok: false, warum: 'Vergleich aria-label: ' + v };
        return { ok: true, info: 'Verlauf: „' + a.slice(0, 90) + '…" · Vergleich nennt je Reihe Anzahl, Tief, Hoch' };
      } finally { gsGeraetLoeschen(gB.id); }
    },
  },
  {
    // v32.61: der Anker #geraet-<id>, den der Cron device-alerts in seine
    // Meldungen schreibt (20260905_device_alerts_cron.sql), fuehrt zur Kachel —
    // ein Link, der oben auf der Seite endet, saehe aus wie ein Link, der
    // funktioniert hat (CLAUDE.md §7.1, Richtung 5).
    name: 'Deep-Link · #geraet-<id> öffnet Messwerte und hebt die Kachel hervor; ein entferntes Gerät wird genannt',
    lauf: async () => {
      const toasts = []; const echtToast = window.gsToast; window.gsToast = (m) => toasts.push(String(m));
      try {
        if (!Array.isArray(GS_ANKER_ARTEN) || GS_ANKER_ARTEN.indexOf('geraet') < 0) return { ok: false, warum: 'geraet steht nicht in GS_ANKER_ARTEN' };
        const ok = await gsAnkerAnspringen('#geraet-ger_seed_1');
        const el = document.getElementById('geraet-ger_seed_1');
        if (!ok || !el || !el.classList.contains('gs-anker-treffer')) return { ok: false, warum: 'Anker nicht angesprungen: ' + JSON.stringify({ ok, da: !!el, klasse: el && el.className }) };
        const modal = document.getElementById('detail-modal');
        if (!modal || getComputedStyle(modal).display === 'none') return { ok: false, warum: 'das Messwerte-Fenster ist nicht offen' };
        const nein = await gsAnkerAnspringen('#geraet-gibt-es-nicht');
        if (nein !== false || !toasts.some(t => /nicht mehr/.test(t))) return { ok: false, warum: 'unbekanntes Gerät: ' + JSON.stringify({ nein, toasts }) };
        return { ok: true, info: 'ger_seed_1 → Fenster offen, Kachel hervorgehoben · unbekannte Id → false + „gibt es nicht mehr"' };
      } finally { window.gsToast = echtToast; }
    },
  },
  {
    // v32.62: Koppeln — das Token entsteht in der App, zum Server geht nur der
    // SHA-256, angezeigt wird es genau einmal, gespeichert nie. Eine Absage
    // (Fehler ODER 0 Zeilen, RLS) ist keine Kopplung — und wird gesagt.
    name: 'Koppeln · Token nur einmal sichtbar, zum Server geht allein der SHA-256, eine Absage ist keine Kopplung, „von Hand" braucht kein Token',
    lauf: async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtGet = window.gsStore && gsStore.get, echtToast = window.gsToast;
      const rufe = [], toasts = [];
      window.sbIsLoggedIn = () => true;
      window.gsStore = window.gsStore || {}; gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet(k, d) : d));
      window.gsToast = (m) => toasts.push(String(m));
      const g = gsGeraetAnlegen({ kind: 'gs_sensor', name: 'Bodenstab Test' });
      let g2 = null;
      try {
        if (!g) return { ok: false, warum: 'Gerät nicht angelegt' };
        window.sbFetch = async (path, opts) => { rufe.push({ path, opts }); return (opts && opts.method === 'POST') ? { data: [{ id: JSON.parse(opts.body).id }], error: null } : { data: [], error: null }; };
        const r1 = await gsGeraetKoppeln(g.id);
        if (!r1 || !r1.ok || !r1.token) return { ok: false, warum: 'Koppeln: ' + JSON.stringify(r1) };
        if (!/^[A-Za-z0-9_-]{43}$/.test(r1.token)) return { ok: false, warum: 'Token-Form: ' + r1.token };
        const ruf = rufe.find(x => /\/rest\/v1\/devices$/.test(x.path));
        if (!ruf || ruf.opts.method !== 'POST' || !/merge-duplicates/.test(ruf.opts.headers.Prefer) || !/return=representation/.test(ruf.opts.headers.Prefer)) return { ok: false, warum: 'Aufruf: ' + JSON.stringify(ruf && ruf.opts.headers) };
        const body = JSON.parse(ruf.opts.body);
        if (body.token || JSON.stringify(body).indexOf(r1.token) >= 0) return { ok: false, warum: 'das Token selbst geht zum Server' };
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(r1.token));
        const hex = Array.from(new Uint8Array(buf)).map(x => x.toString(16).padStart(2, '0')).join('');
        if (body.token_hash !== hex) return { ok: false, warum: 'token_hash ist nicht der SHA-256 des Tokens: ' + body.token_hash };
        if (body.user_id !== '00000000-0000-0000-0000-000000000001' || body.kind !== 'gs_sensor' || body.id !== r1.cloud_id || !/^[0-9a-f-]{36}$/.test(body.id)) return { ok: false, warum: 'Satz: ' + JSON.stringify(body) };
        const gl = gsGeraete().find(x => x.id === g.id);
        if (!gl.cloud_id || gl.status !== 'wartet') return { ok: false, warum: 'lokal: ' + JSON.stringify({ cloud_id: gl.cloud_id, status: gl.status }) };
        gsMesswerteOeffnen();
        const html1 = document.getElementById('modal-content').innerHTML;
        if (html1.indexOf(r1.token) < 0) return { ok: false, warum: 'das Token wird nicht angezeigt' };
        const kachel = document.getElementById('geraet-' + g.id).textContent;
        if (!/gekoppelt/.test(kachel) || !/wartet/.test(kachel)) return { ok: false, warum: 'Kachel: ' + kachel.slice(0, 160) };
        _gsMwTokenFertig(g.id);
        if (document.getElementById('modal-content').innerHTML.indexOf(r1.token) >= 0) return { ok: false, warum: 'das Token bleibt nach „Fertig" sichtbar' };
        if (JSON.stringify(localStorage).indexOf(r1.token) >= 0) return { ok: false, warum: 'das Token liegt im Speicher' };
        const sel = document.getElementById('mw-geraet');
        if (sel && Array.from(sel.options).some(o => o.value === g.id)) return { ok: false, warum: 'ein gekoppeltes Gerät steht im Formular „von Hand"' };
        if (!/Token neu erzeugen/.test(document.getElementById('geraet-' + g.id).textContent)) return { ok: false, warum: 'kein Knopf zum Neu-Erzeugen' };
        // 0 Zeilen (RLS still) und Ablehnung → nicht gekoppelt, gesagt
        g2 = gsGeraetAnlegen({ kind: 'third_party', name: 'Fremd Test' });
        window.sbFetch = async () => ({ data: [], error: null });
        toasts.length = 0;
        const r2 = await gsGeraetKoppeln(g2.id);
        const gl2 = gsGeraete().find(x => x.id === g2.id);
        if (!r2 || r2.ok || gl2.cloud_id || !toasts.some(t => /Nicht gekoppelt/.test(t))) return { ok: false, warum: '0 Zeilen: ' + JSON.stringify({ r2, cloud_id: gl2.cloud_id, toasts }) };
        window.sbFetch = async () => ({ data: null, error: { message: 'permission denied' } });
        const r3 = await gsGeraetKoppeln(g2.id);
        if (!r3 || r3.ok || gsGeraete().find(x => x.id === g2.id).cloud_id) return { ok: false, warum: 'Ablehnung: ' + JSON.stringify(r3) };
        gsMesswerteOeffnen();
        if (!/noch nicht gekoppelt/.test(document.getElementById('geraet-' + g2.id).textContent)) return { ok: false, warum: 'ein ungekoppeltes Gerät sagt es nicht' };
        // von Hand braucht kein Token
        const hand = gsGeraete().find(x => x.kind === 'manual');
        const r4 = await gsGeraetKoppeln(hand.id);
        if (!r4 || r4.ok || !/von Hand/.test(r4.grund)) return { ok: false, warum: 'von Hand: ' + JSON.stringify(r4) };
        // ohne Anmeldung: nichts geht hinaus
        window.sbIsLoggedIn = () => false; rufe.length = 0;
        const r5 = await gsGeraetKoppeln(g2.id);
        if (!r5 || r5.ok || rufe.length) return { ok: false, warum: 'ohne Anmeldung: ' + JSON.stringify({ r5, rufe: rufe.length }) };
        return { ok: true, info: 'Token 43 Zeichen, einmal gezeigt, nicht im Speicher · Satz: token_hash = SHA-256, kein Token, user_id, UUID · 0 Zeilen → nicht gekoppelt, gesagt · Ablehnung → nicht gekoppelt · von Hand → kein Token · abgemeldet → kein Aufruf' };
      } finally {
        gsGeraetLoeschen(g && g.id); if (g2) gsGeraetLoeschen(g2.id);
        window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin; window.gsToast = echtToast; if (echtGet) gsStore.get = echtGet;
      }
    },
  },
  {
    // v32.62: der Rueckweg — Status vom Server, Werte durch denselben einen Weg
    // (quelle cloud, pending false, Qualitaet vom Server), zweimal = einmal,
    // inkrementell ab dem letzten Zeitpunkt, Drossel, lost/paused/fehlend.
    name: 'Cloud-Abgleich · Status vom Server, Werte kommen als „cloud" ohne pending zurück, zweimal = einmal, verstummt/pausiert/fehlend sichtbar, Ablehnung ändert nichts',
    lauf: async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtGet = window.gsStore && gsStore.get;
      window.sbIsLoggedIn = () => true; window.gsStore = window.gsStore || {}; gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet(k, d) : d));
      const g = gsGeraetAnlegen({ kind: 'gs_sensor', name: 'Bodenstab Cloud' });
      try {
        window.sbFetch = async (path, opts) => (opts && opts.method === 'POST') ? { data: [{ id: JSON.parse(opts.body).id }], error: null } : { data: [], error: null };
        const k = await gsGeraetKoppeln(g.id); if (!k.ok) return { ok: false, warum: 'Koppeln: ' + JSON.stringify(k) };
        _gsMwTokenFertig(g.id);
        const cid = k.cloud_id, T = Date.now();
        const zeilen = [
          { device_id: cid, metric: 'soil_moisture', ts: new Date(T - 3 * 3600000).toISOString(), value: 41, quality: 2 },
          { device_id: cid, metric: 'soil_moisture', ts: new Date(T - 2 * 3600000).toISOString(), value: 250, quality: 1 },
          { device_id: cid, metric: 'battery', ts: new Date(T - 1 * 3600000).toISOString(), value: 50, quality: 0 } ];
        let server = { id: cid, kind: 'gs_sensor', name: 'Bodenstab Cloud', status: 'active', last_seen_at: zeilen[2].ts, paired_at: zeilen[0].ts, capabilities: { metrics: ['soil_moisture', 'battery'], interval_s: 1800 }, firmware: 'gs-soil-1.0.3' };
        const pfade = [];
        window.sbFetch = async (path) => { pfade.push(path); if (/\/devices\?/.test(path)) return { data: [server], error: null }; if (/\/device_readings\?/.test(path)) return { data: zeilen.filter(z => path.indexOf('device_id=eq.' + z.device_id) >= 0), error: null }; return { data: [], error: null }; };
        const a1 = await gsGeraeteCloudAbgleich({ erzwingen: true });
        if (!a1.ok || a1.geraete !== 1 || a1.neu !== 3 || a1.doppelt !== 0) return { ok: false, warum: 'Abgleich 1: ' + JSON.stringify(a1) };
        const pr = pfade.find(p => /device_readings/.test(p));
        if (!pr || pr.indexOf('device_id=eq.' + cid) < 0 || !/ts=gt\./.test(pr) || !/order=ts\.asc/.test(pr)) return { ok: false, warum: 'Lese-Pfad: ' + pr };
        const mw = gsMesswerte(g.id);
        if (mw.length !== 3 || mw.some(m => m.pending !== false || m.quelle !== 'cloud')) return { ok: false, warum: 'Messwerte: ' + JSON.stringify(mw.map(m => [m.metric, m.pending, m.quelle])) };
        if (mw.map(m => m.quality).join(',') !== '2,1,0') return { ok: false, warum: 'Qualität vom Server nicht übernommen: ' + mw.map(m => m.quality).join(',') };
        const gl = gsGeraete().find(x => x.id === g.id);
        if (gl.status !== 'active' || gl.paired_at !== zeilen[0].ts || gl.firmware !== 'gs-soil-1.0.3' || gl.cloud_bis !== zeilen[2].ts || gl.capabilities.interval_s !== 1800) return { ok: false, warum: 'Gerät: ' + JSON.stringify({ status: gl.status, paired_at: gl.paired_at, firmware: gl.firmware, cloud_bis: gl.cloud_bis, iv: gl.capabilities.interval_s }) };
        const a2 = await gsGeraeteCloudAbgleich({ erzwingen: true });
        if (!a2.ok || a2.neu !== 0 || a2.doppelt !== 3 || gsMesswerte(g.id).length !== 3) return { ok: false, warum: 'Abgleich 2: ' + JSON.stringify(a2) };
        const p2 = pfade.filter(p => /device_readings/.test(p) && p.indexOf(cid) >= 0).pop();
        if (p2.indexOf('ts=gt.' + encodeURIComponent(zeilen[2].ts)) < 0) return { ok: false, warum: 'der zweite Lauf liest nicht ab dem letzten Zeitpunkt: ' + p2 };
        // Ein ZWEITES, neu gekoppeltes Geraet mit AELTEREN Werten: es liest ab seinem eigenen Zeiger (7 Tage), nicht ab dem des ersten
        const g3 = gsGeraetAnlegen({ kind: 'third_party', name: 'Fremd Cloud' });
        window.sbFetch = async (path, opts) => (opts && opts.method === 'POST') ? { data: [{ id: JSON.parse(opts.body).id }], error: null } : { data: [], error: null };
        const k3 = await gsGeraetKoppeln(g3.id); if (!k3.ok) return { ok: false, warum: 'Koppeln 2: ' + JSON.stringify(k3) };
        _gsMwTokenFertig(g3.id);
        zeilen.push({ device_id: k3.cloud_id, metric: 'air_temp', ts: new Date(T - 5 * 864e5).toISOString(), value: 17, quality: 2 },
                    { device_id: k3.cloud_id, metric: 'air_temp', ts: new Date(T - 4 * 864e5).toISOString(), value: 19, quality: 2 });
        const server3 = { id: k3.cloud_id, kind: 'third_party', name: 'Fremd Cloud', status: 'active', last_seen_at: zeilen[4].ts, paired_at: zeilen[3].ts, capabilities: { metrics: ['air_temp'] } };
        pfade.length = 0;
        window.sbFetch = async (path) => { pfade.push(path); if (/\/devices\?/.test(path)) return { data: [server, server3], error: null }; if (/\/device_readings\?/.test(path)) return { data: zeilen.filter(z => path.indexOf('device_id=eq.' + z.device_id) >= 0), error: null }; return { data: [], error: null }; };
        const a6 = await gsGeraeteCloudAbgleich({ erzwingen: true });
        if (!a6.ok || a6.geraete !== 2 || a6.neu !== 2 || a6.doppelt !== 3) return { ok: false, warum: 'zwei Geräte: ' + JSON.stringify(a6) };
        const p3 = pfade.find(p => /device_readings/.test(p) && p.indexOf(k3.cloud_id) >= 0);
        if (!p3 || p3.indexOf('ts=gt.' + encodeURIComponent(zeilen[2].ts)) >= 0) return { ok: false, warum: 'das zweite Gerät liest ab dem Zeiger des ersten: ' + p3 };
        if (gsMesswerte(g3.id).length !== 2 || gsGeraete().find(x => x.id === g3.id).cloud_bis !== zeilen[4].ts) return { ok: false, warum: 'zweites Gerät: ' + JSON.stringify({ n: gsMesswerte(g3.id).length, bis: gsGeraete().find(x => x.id === g3.id).cloud_bis }) };
        gsGeraetLoeschen(g3.id);
        window.sbFetch = async (path) => { pfade.push(path); if (/\/devices\?/.test(path)) return { data: [server], error: null }; if (/\/device_readings\?/.test(path)) return { data: zeilen.filter(z => path.indexOf('device_id=eq.' + z.device_id) >= 0), error: null }; return { data: [], error: null }; };
        gsMesswerteOeffnen();
        let t = document.getElementById('geraet-' + g.id).textContent;
        if (!/gekoppelt/.test(t) || !/41/.test(t) || !/ausserhalb/.test(t)) return { ok: false, warum: 'Kachel: ' + t.slice(0, 220) };
        const a3 = await gsGeraeteCloudAbgleich();
        if (a3.ok || !/gerade erst/.test(a3.grund)) return { ok: false, warum: 'Drossel: ' + JSON.stringify(a3) };
        server = Object.assign({}, server, { status: 'lost' });
        await gsGeraeteCloudAbgleich({ erzwingen: true }); gsMesswerteOeffnen(); t = document.getElementById('geraet-' + g.id).textContent;
        if (gsGeraete().find(x => x.id === g.id).status !== 'lost' || !/kein Signal/.test(t)) return { ok: false, warum: 'verstummt: ' + t.slice(0, 160) };
        server = Object.assign({}, server, { status: 'paused' });
        await gsGeraeteCloudAbgleich({ erzwingen: true }); gsMesswerteOeffnen(); t = document.getElementById('geraet-' + g.id).textContent;
        if (!/pausiert/.test(t)) return { ok: false, warum: 'pausiert: ' + t.slice(0, 160) };
        window.sbFetch = async () => ({ data: [], error: null });
        await gsGeraeteCloudAbgleich({ erzwingen: true }); gsMesswerteOeffnen(); t = document.getElementById('geraet-' + g.id).textContent;
        if (!/nicht gefunden/.test(t)) return { ok: false, warum: 'fehlend: ' + t.slice(0, 160) };
        window.sbFetch = async () => ({ data: null, error: { message: 'permission denied', status: 401 } });
        const a5 = await gsGeraeteCloudAbgleich({ erzwingen: true });
        if (a5.ok || gsMesswerte(g.id).length !== 3 || !/permission/.test(a5.grund)) return { ok: false, warum: 'Ablehnung: ' + JSON.stringify(a5) };
        return { ok: true, info: '3 Werte cloud/pending:false, Qualität 2,1,0 · Status, paired_at, Firmware, interval_s vom Server · zweimal = 3 doppelt, ab letztem Zeitpunkt · zweites Gerät liest ab eigenem Zeiger (2 ältere Werte) · Drossel · lost/paused/fehlend sichtbar · Ablehnung ändert nichts' };
      } finally { gsGeraetLoeschen(g && g.id); window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin; if (echtGet) gsStore.get = echtGet; }
    },
  },
  {
    // v32.62: EINE Instanz je Alarm. Gekoppelt → der Server meldet (sensor-push),
    // die App nicht — dieselbe Regel am Handgeraet meldet lokal.
    name: 'Alarm-Instanz · für ein gekoppeltes Gerät meldet der Server, nicht die App — dieselbe Regel am Handgerät meldet lokal',
    lauf: async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtGet = window.gsStore && gsStore.get;
      const echtEnabled = gsNotif.isEnabled, echtKat = gsNotif.showKategorie, rufe = [];
      window.sbIsLoggedIn = () => true; window.gsStore = window.gsStore || {}; gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet(k, d) : d));
      gsNotif.isEnabled = () => true; gsNotif.showKategorie = (kat, o) => { rufe.push(o); return true; };
      const gc = gsGeraetAnlegen({ kind: 'gs_sensor', name: 'Cloud Alarm' }), gh = gsGeraetAnlegen({ kind: 'manual', name: 'Hand Alarm' });
      try {
        window.sbFetch = async (path, opts) => (opts && opts.method === 'POST') ? { data: [{ id: JSON.parse(opts.body).id }], error: null } : { data: [], error: null };
        const k = await gsGeraetKoppeln(gc.id); if (!k.ok) return { ok: false, warum: 'Koppeln: ' + JSON.stringify(k) };
        _gsMwTokenFertig(gc.id);
        const ts = new Date(Date.now() - 600000).toISOString();
        _gsMesswerteAnhaengen(gsGeraete().find(x => x.id === gc.id), [{ metric: 'soil_moisture', wert: 12, ts }], { quelle: 'cloud', pending: false, status_belassen: true });
        const rc = gsRegelAnlegen({ geraet_id: gc.id, metric: 'soil_moisture', op: 'below', threshold: 25, action: 'notify' });
        await new Promise(res => setTimeout(res, 60));
        if (gsRegeln().find(x => x.id === rc.id).cloud_ok !== true) return { ok: false, warum: 'die Regel ist nicht auf dem Server angekommen (cloud_ok): ' + JSON.stringify(gsRegeln().find(x => x.id === rc.id)) };
        if (gsRegelnPruefen(gc.id)[0].zustand !== 'verletzt') return { ok: false, warum: 'die Regel ist nicht verletzt — der Fall prüft nichts' };
        const e1 = gsSensorAlarmeMelden();
        if (e1.gemeldet.indexOf(rc.id) >= 0 || rufe.some(o => /Cloud Alarm/.test((o && o.body) || ''))) return { ok: false, warum: 'die App meldet den Alarm eines gekoppelten Geräts selbst: ' + JSON.stringify(e1) };
        // v32.63: eine Regel, die der Server NICHT hat (cloud_ok false), meldet die App weiter selbst
        window.sbFetch = async () => ({ data: [], error: null });
        const rc2 = gsRegelAnlegen({ geraet_id: gc.id, metric: 'soil_moisture', op: 'below', threshold: 20, action: 'notify' });
        await new Promise(res => setTimeout(res, 60));
        if (gsRegeln().find(x => x.id === rc2.id).cloud_ok !== false) return { ok: false, warum: 'eine abgewiesene Regel muss cloud_ok false tragen' };
        const e1b = gsSensorAlarmeMelden();
        if (e1b.gemeldet.indexOf(rc2.id) < 0 || e1b.gemeldet.indexOf(rc.id) >= 0 || !rufe.some(o => /Cloud Alarm/.test((o && o.body) || ''))) return { ok: false, warum: 'Regel nur in der App muss lokal melden: ' + JSON.stringify(e1b) };
        rufe.length = 0;
        gsMesswertEintragen(gh.id, 'soil_moisture', 12);
        const rh = gsRegelAnlegen({ geraet_id: gh.id, metric: 'soil_moisture', op: 'below', threshold: 25, action: 'notify' });
        const e2 = gsSensorAlarmeMelden();
        if (e2.gemeldet.indexOf(rh.id) < 0 || e2.gemeldet.indexOf(rc.id) >= 0) return { ok: false, warum: 'Handgerät: ' + JSON.stringify(e2) };
        if (!rufe.some(o => /Hand Alarm/.test((o && o.body) || ''))) return { ok: false, warum: 'die Meldung nennt das Handgerät nicht: ' + JSON.stringify(rufe.map(o => o && o.body)) };
        return { ok: true, info: 'Regel auf dem Server → keine lokale Meldung · Regel nur in der App (abgewiesen) → lokal gemeldet · Handgerät → gemeldet, mit Namen' };
      } finally { gsGeraetLoeschen(gc && gc.id); gsGeraetLoeschen(gh && gh.id); window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin; if (echtGet) gsStore.get = echtGet; gsNotif.isEnabled = echtEnabled; gsNotif.showKategorie = echtKat; }
    },
  },
  {
    // v32.63: der Server liest device_rules — eine Regel, die nur in der App
    // liegt, sieht er nie. Also geht sie hoch (Anlegen, Koppeln, Abgleich),
    // Loeschen loescht dort mit, und ein gekoppeltes Geraet zu entfernen
    // entfernt es auch in der Cloud.
    name: 'Regeln in der Cloud · am gekoppelten Gerät geht die Regel auf den Server (dieselbe Id, die Spalten der Tabelle), Koppeln und Abgleich ziehen nach, Löschen löscht dort mit, eine Absage heisst „nur in der App"',
    lauf: async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtGet = window.gsStore && gsStore.get, echtToast = window.gsToast;
      const rufe = [], toasts = [], warte = (ms) => new Promise(res => setTimeout(res, ms));
      window.sbIsLoggedIn = () => true; window.gsStore = window.gsStore || {}; gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet(k, d) : d));
      window.gsToast = (m) => toasts.push(String(m));
      const ja = async (path, opts) => { rufe.push({ path, opts }); return (opts && (opts.method === 'POST' || opts.method === 'DELETE')) ? { data: [{ id: opts.body ? JSON.parse(opts.body).id : 'x' }], error: null } : { data: [], error: null }; };
      const g = gsGeraetAnlegen({ kind: 'gs_sensor', name: 'Regel Cloud' });
      try {
        window.sbFetch = ja;
        const r0 = gsRegelAnlegen({ geraet_id: g.id, metric: 'soil_moisture', op: 'below', threshold: 30, action: 'notify' });
        await warte(40);
        if (rufe.some(x => /device_rules/.test(x.path))) return { ok: false, warum: 'eine Regel am ungekoppelten Gerät geht zum Server' };
        const k = await gsGeraetKoppeln(g.id); if (!k.ok) return { ok: false, warum: 'Koppeln: ' + JSON.stringify(k) };
        _gsMwTokenFertig(g.id);
        await warte(60);
        const up = rufe.find(x => /\/rest\/v1\/device_rules$/.test(x.path) && x.opts.method === 'POST');
        if (!up) return { ok: false, warum: 'Koppeln zieht die bestehende Regel nicht nach' };
        const b = JSON.parse(up.opts.body);
        const spalten = ['id', 'user_id', 'device_id', 'metric', 'op', 'threshold', 'for_minutes', 'action', 'cooldown_minutes', 'enabled'];
        if (b.id !== r0.id || b.device_id !== k.cloud_id || b.user_id !== '00000000-0000-0000-0000-000000000001' || b.metric !== 'soil_moisture' || b.op !== 'below' || b.threshold !== 30 || b.action !== 'notify' || b.cooldown_minutes !== 720 || b.for_minutes !== 0 || b.enabled !== true) return { ok: false, warum: 'Satz: ' + JSON.stringify(b) };
        if (Object.keys(b).some(kk => spalten.indexOf(kk) < 0)) return { ok: false, warum: 'unbekannte Spalte im Satz: ' + Object.keys(b).join(',') };
        if (!/merge-duplicates/.test(up.opts.headers.Prefer) || !/return=representation/.test(up.opts.headers.Prefer)) return { ok: false, warum: 'kein geprüfter Upsert: ' + up.opts.headers.Prefer };
        if (gsRegeln().find(x => x.id === r0.id).cloud_ok !== true) return { ok: false, warum: 'cloud_ok fehlt nach Bestätigung' };
        gsMesswerteOeffnen();
        if (!/☁️/.test(document.getElementById('geraet-' + g.id).querySelector('.gs-mw-regel').textContent)) return { ok: false, warum: 'die Kachel zeigt die Regel nicht als „in der Cloud"' };
        rufe.length = 0;
        const r1 = gsRegelAnlegen({ geraet_id: g.id, metric: 'battery', op: 'below', threshold: 20, action: 'notify' });
        await warte(60);
        if (!rufe.some(x => /device_rules$/.test(x.path) && x.opts.method === 'POST' && JSON.parse(x.opts.body).id === r1.id)) return { ok: false, warum: 'eine neue Regel geht nicht sofort hoch' };
        // Absage → nur in der App, gesagt, und die Kachel sagt es
        window.sbFetch = async (path, opts) => { rufe.push({ path, opts }); return { data: [], error: null }; };
        toasts.length = 0;
        const r2 = gsRegelAnlegen({ geraet_id: g.id, metric: 'air_temp', op: 'above', threshold: 35, action: 'notify' });
        await warte(60);
        const raw2 = gsRegeln().find(x => x.id === r2.id);
        if (raw2.cloud_ok !== false || !toasts.some(t => /nur in der App/.test(t))) return { ok: false, warum: 'Absage: ' + JSON.stringify({ cloud_ok: raw2.cloud_ok, toasts }) };
        gsMesswerteOeffnen();
        if (!/nur in der App/.test(document.getElementById('geraet-' + g.id).textContent)) return { ok: false, warum: 'die Kachel sagt nicht „nur in der App"' };
        // Abgleich zieht nach, sobald der Server ja sagt
        window.sbFetch = async (path, opts) => { rufe.push({ path, opts }); if (opts && opts.method === 'POST') return { data: [{ id: JSON.parse(opts.body).id }], error: null }; if (/\/devices\?/.test(path)) return { data: [{ id: k.cloud_id, status: 'active', paired_at: new Date().toISOString() }], error: null }; return { data: [], error: null }; };
        await gsGeraeteCloudAbgleich({ erzwingen: true });
        await warte(60);
        if (gsRegeln().find(x => x.id === r2.id).cloud_ok !== true) return { ok: false, warum: 'der Abgleich zieht die offene Regel nicht nach' };
        // v32.64 Rueckrichtung: der Server nennt last_fired_at und enabled; eine dort GELOESCHTE Regel
        // meldet die App wieder selbst und wird NICHT neu hochgeladen
        const gemeldetAm = new Date(Date.now() - 3600000).toISOString();
        rufe.length = 0;
        window.sbFetch = async (path, opts) => { rufe.push({ path, opts }); if (opts && opts.method === 'POST') return { data: [{ id: JSON.parse(opts.body).id }], error: null }; if (/\/devices\?/.test(path)) return { data: [{ id: k.cloud_id, status: 'active', paired_at: new Date().toISOString() }], error: null }; if (/\/device_rules\?select/.test(path)) return { data: [{ id: r0.id, device_id: k.cloud_id, enabled: true, last_fired_at: gemeldetAm }, { id: r1.id, device_id: k.cloud_id, enabled: false, last_fired_at: null }], error: null }; return { data: [], error: null }; };
        await gsGeraeteCloudAbgleich({ erzwingen: true });
        await warte(60);
        const s0 = gsRegeln().find(x => x.id === r0.id), s1 = gsRegeln().find(x => x.id === r1.id), s2 = gsRegeln().find(x => x.id === r2.id);
        if (s0.server_zuletzt !== gemeldetAm || s0.cloud_ok !== true) return { ok: false, warum: 'last_fired_at kommt nicht zurück: ' + JSON.stringify(s0) };
        if (s1.enabled !== false) return { ok: false, warum: 'enabled vom Server kommt nicht zurück: ' + JSON.stringify(s1) };
        if (s2.cloud_ok !== false || s2.cloud_geloescht !== true) return { ok: false, warum: 'eine auf dem Server gelöschte Regel: ' + JSON.stringify(s2) };
        if (rufe.some(x => x.opts && x.opts.method === 'POST' && /device_rules$/.test(x.path) && JSON.parse(x.opts.body).id === r2.id)) return { ok: false, warum: 'die gelöschte Regel wird wieder hochgeladen' };
        gsMesswerteOeffnen();
        const kt = document.getElementById('geraet-' + g.id).textContent;
        if (!/zuletzt gemeldet/.test(kt) || !/auf dem Server gelöscht/.test(kt)) return { ok: false, warum: 'Kachel: ' + kt.slice(0, 300) };
        gsRegeln().forEach(x => { if (x.id === r1.id) x.enabled = true; }); localStorage.setItem('gs_geraete_regeln', JSON.stringify(gsRegeln().map(x => x.id === r1.id ? Object.assign(x, { enabled: true }) : x)));
        // Loeschen loescht auf dem Server mit
        rufe.length = 0; window.sbFetch = ja;
        gsRegelLoeschen(r1.id);
        await warte(40);
        const del = rufe.find(x => x.opts && x.opts.method === 'DELETE');
        if (!del || del.path.indexOf('device_rules?id=eq.' + r1.id) < 0 || !/return=representation/.test(del.opts.headers.Prefer)) return { ok: false, warum: 'Löschen erreicht den Server nicht: ' + JSON.stringify(rufe.map(x => x.path)) };
        // Geraet entfernen → auch in der Cloud (cascade)
        rufe.length = 0;
        gsGeraetLoeschen(g.id);
        await warte(40);
        const delG = rufe.find(x => x.opts && x.opts.method === 'DELETE' && /\/devices\?id=eq\./.test(x.path));
        if (!delG || delG.path.indexOf(k.cloud_id) < 0) return { ok: false, warum: 'das gekoppelte Gerät bleibt in der Cloud: ' + JSON.stringify(rufe.map(x => x.path)) };
        return { ok: true, info: 'ungekoppelt: kein Aufruf · Koppeln zieht nach (Satz mit ' + spalten.length + ' Spalten, geprüfter Upsert) · neue Regel sofort · Absage → cloud_ok false, Toast, Kachel „nur in der App" · Abgleich zieht nach · Rückrichtung: last_fired_at + enabled zurück, dort gelöscht → nur in der App, nicht neu hoch · Löschen → DELETE id=eq. · Gerät weg → DELETE devices' };
      } finally { gsGeraetLoeschen(g && g.id); window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin; window.gsToast = echtToast; if (echtGet) gsStore.get = echtGet; }
    },
  },
  {
    // v32.64: Pausieren — der Zustand liegt beim Server; lokal erst nach Bestaetigung.
    name: 'Pausieren · gekoppeltes Gerät: PATCH status auf dem Server, lokal erst nach Bestätigung; eine Absage lässt den alten Zustand; ungekoppelt geht es nicht',
    lauf: async () => {
      const echtFetch = window.sbFetch, echtLogin = window.sbIsLoggedIn, echtGet = window.gsStore && gsStore.get, echtToast = window.gsToast;
      const rufe = [], toasts = [];
      window.sbIsLoggedIn = () => true; window.gsStore = window.gsStore || {}; gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet(k, d) : d));
      window.gsToast = (m) => toasts.push(String(m));
      const g = gsGeraetAnlegen({ kind: 'gs_sensor', name: 'Pause Test' });
      try {
        const r0 = await gsGeraetPausieren(g.id, true);
        if (!r0 || r0.ok) return { ok: false, warum: 'ungekoppelt liess sich pausieren' };
        window.sbFetch = async (path, opts) => { rufe.push({ path, opts }); if (opts && opts.method === 'POST') return { data: [{ id: JSON.parse(opts.body).id }], error: null }; if (opts && opts.method === 'PATCH') return { data: [Object.assign({ id: 'x' }, JSON.parse(opts.body))], error: null }; return { data: [], error: null }; };
        const k = await gsGeraetKoppeln(g.id); if (!k.ok) return { ok: false, warum: 'Koppeln: ' + JSON.stringify(k) };
        _gsMwTokenFertig(g.id);
        const r1 = await gsGeraetPausieren(g.id, true);
        const p = rufe.find(x => x.opts && x.opts.method === 'PATCH');
        if (!r1.ok || !p || p.path.indexOf('/rest/v1/devices?id=eq.' + k.cloud_id) < 0 || JSON.parse(p.opts.body).status !== 'paused' || !/return=representation/.test(p.opts.headers.Prefer)) return { ok: false, warum: 'PATCH: ' + JSON.stringify({ r1, p: p && p.path, body: p && p.opts.body }) };
        if (gsGeraete().find(x => x.id === g.id).status !== 'paused') return { ok: false, warum: 'lokal nicht pausiert' };
        gsMesswerteOeffnen();
        let tx = document.getElementById('geraet-' + g.id).textContent;
        if (!/pausiert/.test(tx) || !/Fortsetzen/.test(tx)) return { ok: false, warum: 'Kachel: ' + tx.slice(0, 200) };
        window.sbFetch = async () => ({ data: [], error: null });
        toasts.length = 0;
        const r2 = await gsGeraetPausieren(g.id, false);
        if (r2.ok || gsGeraete().find(x => x.id === g.id).status !== 'paused' || !toasts.some(x => /Nicht fortgesetzt/.test(x))) return { ok: false, warum: 'Absage: ' + JSON.stringify({ r2, status: gsGeraete().find(x => x.id === g.id).status, toasts }) };
        window.sbFetch = async (path, opts) => (opts && opts.method === 'PATCH') ? { data: [Object.assign({ id: 'x' }, JSON.parse(opts.body))], error: null } : { data: [], error: null };
        const r3 = await gsGeraetPausieren(g.id, false);
        if (!r3.ok || gsGeraete().find(x => x.id === g.id).status !== 'wartet') return { ok: false, warum: 'Fortsetzen ohne paired_at muss „wartet" ergeben: ' + JSON.stringify({ r3, status: gsGeraete().find(x => x.id === g.id).status }) };
        gsMesswerteOeffnen(); tx = document.getElementById('geraet-' + g.id).textContent;
        if (!/Pausieren/.test(tx)) return { ok: false, warum: 'kein Pausieren-Knopf nach dem Fortsetzen' };
        return { ok: true, info: 'ungekoppelt → nein · PATCH status=paused, geprüft → lokal paused, Kachel „pausiert · Fortsetzen" · 0 Zeilen → bleibt paused, gesagt · Fortsetzen → wartet (kein paired_at)' };
      } finally { gsGeraetLoeschen(g && g.id); window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogin; window.gsToast = echtToast; if (echtGet) gsStore.get = echtGet; }
    },
  },
  // ═══ KALENDER-V2 · Scheibe 5 (v33.39): Lina ═══════════════════════════════
  // Gemessen am 16.09.2026 gegen v33.38, bevor eine Zeile Code geschrieben war:
  // sechs Geraete → der Kontext endet mitten in „Taraxacum officinale…“, die
  // Scan-Zeile ist verstuemmelt; vier von sechs Geraeten stehen drin, ohne dass
  // die zwei fehlenden genannt werden; eine Regel im Zustand `nicht_pruefbar`
  // ergibt „Alarme: keine verletzte Regel.“; und der Kontext kennt weder den
  // heutigen Kalender noch die Woche noch die Hinweise des Pruefwerks.
  {
    name: 'Lina D1 · der Deckel laesst GANZE Zeilen weg und sagt es — er schneidet nie mitten im Wort',
    lauf: () => {
      const sichern = { g: localStorage.getItem('gs_geraete'), m: localStorage.getItem('gs_messwerte') };
      try {
        const klagen = [];
        const vorlage = (JSON.parse(sichern.g || '[]') || [])[0];
        if (!vorlage) return { ok: false, warum: 'die Beispieldaten haben kein Geraet — der Fall misst nichts' };
        const mw = JSON.parse(sichern.m || '[]') || [];
        const viele = [], kopiert = [];
        for (let i = 0; i < 6; i++) {
          const g = Object.assign({}, vorlage, { id: 'gd' + i, name: 'Messstelle ' + (i + 1) + ' Nordseite' });
          viele.push(g);
          mw.forEach(m => { if (m.geraet_id === vorlage.id) kopiert.push(Object.assign({}, m, { geraet_id: g.id })); });
        }
        localStorage.setItem('gs_geraete', JSON.stringify(viele));
        localStorage.setItem('gs_messwerte', JSON.stringify(kopiert));
        const txt = gsLinaZahlen();
        if (txt.length > GS_LINA_ZAHLEN_MAX) klagen.push('Deckel gerissen: ' + txt.length + ' > ' + GS_LINA_ZAHLEN_MAX);
        // Kein Schnitt mitten im Wort: jede Zeile endet auf . ! ? ) oder auf den Auslass-Satz
        txt.split('\n').forEach(z => {
          if (!z.trim()) return;
          if (/\(\+\d+ Zeilen? ausgelassen\)$/.test(z)) return;
          if (!/[.!?)\]]$/.test(z)) klagen.push('Zeile endet mitten drin: „…' + z.slice(-44) + '"');
        });
        if (/…$/.test(txt)) klagen.push('der Text endet mit einem harten Abschnitt („…") statt mit einer ganzen Zeile');
        // Und er sagt, dass er etwas weggelassen hat
        const ohne = (function () { const a = window.GS_LINA_ZAHLEN_MAX; window.GS_LINA_ZAHLEN_MAX = 99999; const g = gsLinaZahlen(); window.GS_LINA_ZAHLEN_MAX = a; return g; })();
        const fehlend = ohne.split('\n').length - txt.split('\n').filter(z => !/ausgelassen\)$/.test(z)).length;
        if (fehlend > 0 && !/\(\+\d+ Zeilen? ausgelassen\)/.test(txt)) klagen.push(fehlend + ' Zeile(n) fehlen, ohne dass es dasteht');
        // Reihenfolge nach Nutzen: „Fällig" ueberlebt, „Messwerte" faellt zuerst
        if (fehlend > 0) {
          if (!/^Fällig:/m.test(txt)) klagen.push('die faelligen Aufgaben sind weggefallen — sie sind das Wichtigste');
          if (/^Messwerte:/m.test(txt) && !/^Letzter Scan:/m.test(txt)) klagen.push('die Messwerte-Zeile ist geblieben, die Scan-Zeile gefallen — falsche Reihenfolge');
        }
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: txt.length + '/' + GS_LINA_ZAHLEN_MAX + ' Zeichen · ' + txt.split('\n').length + ' ganze Zeilen · ' + (fehlend > 0 ? fehlend + ' ausgelassen und benannt' : 'nichts ausgelassen') };
      } finally {
        if (sichern.g == null) localStorage.removeItem('gs_geraete'); else localStorage.setItem('gs_geraete', sichern.g);
        if (sichern.m == null) localStorage.removeItem('gs_messwerte'); else localStorage.setItem('gs_messwerte', sichern.m);
      }
    },
  },
  {
    name: 'Lina D2 · was nicht in die Zeile passt, wird GEZAEHLT: „+2 weitere" bei sechs Geraeten, nie stillschweigend weggelassen',
    lauf: () => {
      const sichern = { g: localStorage.getItem('gs_geraete'), m: localStorage.getItem('gs_messwerte') };
      try {
        const klagen = [];
        const vorlage = (JSON.parse(sichern.g || '[]') || [])[0];
        if (!vorlage) return { ok: false, warum: 'die Beispieldaten haben kein Geraet' };
        const mw = JSON.parse(sichern.m || '[]') || [];
        const viele = [], kopiert = [];
        for (let i = 0; i < 6; i++) {
          const g = Object.assign({}, vorlage, { id: 'gz' + i, name: 'M' + (i + 1) });
          viele.push(g);
          mw.forEach(m => { if (m.geraet_id === vorlage.id) kopiert.push(Object.assign({}, m, { geraet_id: g.id })); });
        }
        localStorage.setItem('gs_geraete', JSON.stringify(viele));
        localStorage.setItem('gs_messwerte', JSON.stringify(kopiert));
        const alt = window.GS_LINA_ZAHLEN_MAX; window.GS_LINA_ZAHLEN_MAX = 99999;
        const txt = gsLinaZahlen(); window.GS_LINA_ZAHLEN_MAX = alt;
        const z = (txt.match(/^Messwerte:[^\n]*/m) || [''])[0];
        const genannt = (z.match(/\bM[1-6]\b/g) || []).length;
        if (!z) return { ok: false, warum: 'keine Messwerte-Zeile bei sechs Geraeten' };
        if (genannt >= 6) return { ok: true, info: 'alle sechs genannt (kein Deckel noetig)' };
        if (!new RegExp('\\+' + (6 - genannt) + ' weitere').test(z)) klagen.push(genannt + ' von 6 Geraeten genannt, ohne „+' + (6 - genannt) + ' weitere": ' + z.slice(-60));
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: genannt + ' von 6 genannt, „+' + (6 - genannt) + ' weitere" steht dabei' };
      } finally {
        if (sichern.g == null) localStorage.removeItem('gs_geraete'); else localStorage.setItem('gs_geraete', sichern.g);
        if (sichern.m == null) localStorage.removeItem('gs_messwerte'); else localStorage.setItem('gs_messwerte', sichern.m);
      }
    },
  },
  {
    // OEKOSYSTEM-V1 Regel 2: eine Regel hat DREI Zustaende. „nicht pruefbar"
    // als „keine verletzte Regel" auszugeben ist eine Entwarnung ohne Messung
    // — dieselbe Klasse wie „alles im gruenen Bereich" in v33.36.
    name: 'Lina D3 · eine Regel ohne Werte ist NICHT PRUEFBAR — der Kontext sagt das, statt „keine verletzte Regel"',
    lauf: () => {
      const sichern = { g: localStorage.getItem('gs_geraete'), m: localStorage.getItem('gs_messwerte'), r: localStorage.getItem('gs_geraete_regeln') };
      try {
        const klagen = [];
        const vorlage = (JSON.parse(sichern.g || '[]') || [])[0];
        const regeln = JSON.parse(sichern.r || '[]') || [];
        if (!vorlage || !regeln.length) return { ok: false, warum: 'Beispieldaten ohne Geraet oder ohne Regel' };
        localStorage.setItem('gs_geraete', JSON.stringify([Object.assign({}, vorlage, { id: 'gnp', name: 'Ohne Werte' })]));
        localStorage.setItem('gs_messwerte', '[]');
        localStorage.setItem('gs_geraete_regeln', JSON.stringify(regeln.map(x => Object.assign({}, x, { geraet_id: 'gnp' }))));
        const zust = gsRegelnPruefen('gnp').map(z => z.zustand);
        if (zust.indexOf('nicht_pruefbar') < 0) return { ok: false, warum: 'der Zustand wurde nicht hergestellt: ' + JSON.stringify(zust) };
        const z = (gsLinaZahlen().match(/^Alarme:[^\n]*/m) || [''])[0];
        if (/keine verletzte Regel/.test(z)) klagen.push('sagt „keine verletzte Regel", obwohl keine Regel geprueft werden konnte: ' + z);
        if (!/nicht prüfbar|nicht pruefbar/.test(z)) klagen.push('sagt nicht, dass nichts geprueft werden konnte: ' + z);
        // Gegenrichtung: mit Werten und erfuellter Regel darf „keine verletzte Regel" stehen
        localStorage.setItem('gs_geraete', sichern.g);
        localStorage.setItem('gs_messwerte', sichern.m);
        localStorage.setItem('gs_geraete_regeln', JSON.stringify(regeln.map(x => Object.assign({}, x, { schwelle: -999 }))));
        const z2 = (gsLinaZahlen().match(/^Alarme:[^\n]*/m) || [''])[0];
        if (/nicht prüfbar|nicht pruefbar/.test(z2)) klagen.push('mit Werten steht trotzdem „nicht prüfbar": ' + z2);
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'ohne Werte: „' + z.slice(0, 66) + '" · mit Werten: „' + z2.slice(0, 44) + '"' };
      } finally {
        ['gs_geraete', 'gs_messwerte', 'gs_geraete_regeln'].forEach((k, i) => {
          const v = [sichern.g, sichern.m, sichern.r][i];
          if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v);
        });
      }
    },
  },
  {
    name: 'Lina K1 · „Kalender heute": jeder Eintrag ist der Titel eines Ereignisses der EINEN Funktion, hoechstens drei plus „+N weitere", ohne Ereignis keine Zeile',
    lauf: () => {
      const klagen = [];
      const heute = gsHeuteTag();
      const ev = gsKalenderEreignisse(heute, heute);
      const z = (gsLinaZahlen().match(/^Kalender heute:[^\n]*/m) || [''])[0];
      if (!ev.length && z) return { ok: false, warum: 'Zeile ohne ein einziges Ereignis heute: ' + z };
      if (ev.length && !z) return { ok: false, warum: ev.length + ' Ereignisse heute, aber keine Zeile' };
      if (z) {
        const titel = new Set(ev.map(e => e.titel));
        const teile = z.replace(/^Kalender heute: /, '').replace(/\.$/, '').split('; ');
        const echte = teile.filter(t => !/^\+\d+ weitere$/.test(t));
        if (echte.length > 3) klagen.push(echte.length + ' Eintraege in der Zeile — hoechstens drei');
        echte.forEach(t => { if (!titel.has(t)) klagen.push('„' + t + '" ist kein Ereignis der Kalenderfunktion'); });
        // Rueckblick-Arten gehoeren nicht in „heute zu tun"
        const rueck = new Set(ev.filter(e => ['tagebuch', 'gepflanzt', 'fund'].indexOf(e.art) >= 0).map(e => e.titel));
        echte.forEach(t => { if (rueck.has(t)) klagen.push('„' + t + '" ist ein Rueckblick-Ereignis und gehoert nicht in „Kalender heute"'); });
        const rest = ev.filter(e => ['tagebuch', 'gepflanzt', 'fund'].indexOf(e.art) < 0).length - echte.length;
        if (rest > 0 && !new RegExp('\\+' + rest + ' weitere').test(z)) klagen.push(rest + ' weitere Ereignisse, ohne dass es dasteht: ' + z);
        if (z.length > 200) klagen.push('Zeile zu lang (' + z.length + ')');
      }
      // Gegenrichtung: ohne alles keine Zeile und kein erfundenes „keine"
      const s = { mp: myPlants, pl: plantings, g: localStorage.getItem('gs_geraete') };
      try {
        window.myPlants = []; window.plantings = []; localStorage.setItem('gs_geraete', '[]');
        if (/^Kalender heute:/m.test(gsLinaZahlen())) klagen.push('ohne Daten steht trotzdem eine Kalender-heute-Zeile');
      } finally { window.myPlants = s.mp; window.plantings = s.pl; if (s.g == null) localStorage.removeItem('gs_geraete'); else localStorage.setItem('gs_geraete', s.g); }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: (z || '(keine Ereignisse heute, keine Zeile)').slice(0, 120) };
    },
  },
  {
    name: 'Lina K2 · „Nächste 7 Tage": die Zahlen kommen aus derselben Rechnung — Aufgaben, Aussaatfenster, Wetter, Hinweise, eintragsgenau',
    lauf: () => {
      const klagen = [];
      const heute = gsHeuteTag(), bis = _gsKalTagPlus(heute, 6);
      const ev = gsKalenderEreignisse(heute, bis);
      const z = (gsLinaZahlen().match(/^Nächste 7 Tage:[^\n]*/m) || [''])[0];
      if (!z) return { ok: false, warum: 'keine Wochenzeile, obwohl ' + ev.length + ' Ereignisse in sieben Tagen liegen' };
      const zahl = (was) => (z.match(new RegExp('(\\d+)\\s*' + was)) || [0, null])[1];
      const aufg = ev.filter(e => ['aufgabe', 'alarm', 'erinnerung'].indexOf(e.art) >= 0).length;
      const saat = ev.filter(e => e.art === 'aussaat').length;
      const hinw = ev.filter(e => (e.hinweise || []).some(h => h.zustand === 'verletzt')).length;
      const gAufg = zahl('Aufgabe'), gSaat = zahl('Aussaatfenster'), gHinw = zahl('Hinweis');
      if (aufg && Number(gAufg) !== aufg) klagen.push('Aufgaben: Zeile sagt ' + gAufg + ', der Kalender hat ' + aufg);
      if (saat && Number(gSaat) !== saat) klagen.push('Aussaatfenster: Zeile sagt ' + gSaat + ', der Kalender hat ' + saat);
      if (hinw && Number(gHinw) !== hinw) klagen.push('Hinweise: Zeile sagt ' + gHinw + ', das Pruefwerk hat ' + hinw);
      if (z.length > 200) klagen.push('Zeile zu lang (' + z.length + ')');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: z.slice(0, 140) };
    },
  },
  {
    name: 'Lina K3 · „Hinweise": nur VERLETZTE Regeln des Pruefwerks, hoechstens drei — eine nicht pruefbare Regel steht nie als Hinweis da',
    lauf: () => {
      // Der Zustand wird HERGESTELLT, nicht abgewartet: Regen heute laesst R2 an
      // der Giess-Aufgabe der Zucchini (Balkon) anschlagen. Ohne das waere
      // dieser Fall auch dann gruen, wenn es die Zeile gar nicht gibt — die
      // Falle aus v32.51 (eine Frage, die nur die Verneinung kennt).
      const heute = gsHeuteTag();
      const altC = localStorage.getItem('gs_weather_cache');
      const zucP = (typeof plantings !== 'undefined' ? plantings : []).find(x => x && x.id === 'plant_seed_1');
      const merk = zucP && zucP.tasks && zucP.tasks.water ? zucP.tasks.water.lastDone : undefined;
      const altMp = myPlants;
      try {
        const klagen = [];
        // Feldsalat wird im Sep draussen gesaet: ohne Tagesvorhersage steht R1
        // auf `nicht_pruefbar` MIT Grund („keine Wettervorhersage geladen"). Ohne
        // diesen zweiten Zustand koennte der Fall gar nicht messen, dass nur
        // VERLETZTE Hinweise in die Zeile kommen — die Gegenprobe bliebe gruen.
        window.myPlants = (myPlants || []).concat([{ id: 'k3f', name: 'Feldsalat', tasks: {} }]);
        if (zucP && zucP.tasks && zucP.tasks.water) zucP.tasks.water.lastDone = new Date(Date.now() - 3 * 864e5).toISOString();
        const zeiten = [], regen = [];
        for (let h = 0; h < 24; h++) { zeiten.push(heute + 'T' + String(h).padStart(2, '0') + ':00'); regen.push(h === 6 ? 3 : h === 9 ? 5 : 0); }
        localStorage.setItem('gs_weather_cache', JSON.stringify({ ts: Date.now(), data: { hourly: { time: zeiten, precipitation: regen } } }));
        const bis = _gsKalTagPlus(heute, 6);
        const ev = gsKalenderEreignisse(heute, bis);
        const alle = [];
        ev.forEach(e => (e.hinweise || []).forEach(h => { if (h.zustand === 'verletzt') alle.push(h.text); }));
        if (!alle.length) return { ok: false, warum: 'der Zustand wurde nicht hergestellt — keine verletzte Regel trotz 8 mm Regen; der Fall misst nichts' };
        const z = (gsLinaZahlen().match(/^Hinweise:[^\n]*/m) || [''])[0];
        if (!z) klagen.push(alle.length + ' verletzte Regel(n), aber keine Hinweis-Zeile');
        else {
          const teile = z.replace(/^Hinweise: /, '').replace(/\.$/, '').split('; ').filter(t => !/^\+\d+ weitere$/.test(t));
          if (teile.length > 3) klagen.push(teile.length + ' Hinweise in der Zeile — hoechstens drei');
          // Ein Hinweis, der NICHT verletzt ist, gehoert nicht in die Zeile —
          // weder mit seinem Text noch mit seinem Grund. Heute tragen nur
          // verletzte Hinweise einen `text`; die anderen tragen einen `grund`,
          // und genau der ist der naheliegende Fehlgriff (`h.text || h.grund`).
          const fremd = [];
          ev.forEach(e => (e.hinweise || []).forEach(h => {
            if (h.zustand !== 'verletzt') { if (h.text) fremd.push(h.text); if (h.grund) fremd.push(h.grund); }
          }));
          if (!fremd.length) klagen.push('der zweite Zustand wurde nicht hergestellt — kein nicht-verletzter Hinweis mit Text oder Grund; die Frage misst nur die halbe Regel');
          fremd.forEach(f => { if (z.indexOf(f) >= 0) klagen.push('ein Hinweis, der NICHT verletzt ist, steht in der Zeile: „' + String(f).slice(0, 60) + '"'); });
          if (!teile.some(t => /Regen/i.test(t))) klagen.push('der hergestellte Regen-Hinweis fehlt in der Zeile: ' + z);
          if (z.length > 240) klagen.push('Zeile zu lang (' + z.length + ')');
        }
        // Gegenrichtung: ohne Vorhersage keine verletzte Regen-Regel — und kein Hinweis dazu
        localStorage.removeItem('gs_weather_cache');
        const z2 = (gsLinaZahlen().match(/^Hinweise:[^\n]*/m) || [''])[0];
        if (z2 && /Regen/i.test(z2)) klagen.push('ohne Vorhersage steht der Regen-Hinweis trotzdem da: ' + z2);
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: alle.length + ' verletzte Regel(n) hergestellt · Zeile: ' + z.slice(0, 110) + ' · ohne Vorhersage: ' + (z2 ? z2.slice(0, 40) : 'keine Zeile') };
      } finally {
        if (altC == null) localStorage.removeItem('gs_weather_cache'); else localStorage.setItem('gs_weather_cache', altC);
        if (zucP && zucP.tasks && zucP.tasks.water) zucP.tasks.water.lastDone = merk;
        window.myPlants = altMp;
      }
    },
  },
  {
    // v31.79 hat gsNormConfidence gebaut, „weil die Regel zweimal im Code stand
    // und die Anzeige sie gar nicht benutzte". Gemessen am 16.09.2026 gibt es
    // sie DREIMAL: gsNormConfidence(0.94) = 94, die Verlaufsliste zeigt
    // „0.94%", und Linas Kontext sagt „1 % sicher". Und der Fall von v33.23
    // konnte es nicht sehen, weil er `confidence: 88` einsetzt — eine Zahl,
    // die schon in der Zielform ist.
    name: 'Lina S1 · die Sicherheit eines Scans hat EINEN Leser: 0.94 und 94 ergeben beide „94 %" — im Kontext und in der Verlaufsliste',
    lauf: () => {
      const key = (typeof SCAN_HISTORY_KEY !== 'undefined') ? SCAN_HISTORY_KEY : 'gs_scan_history';
      const vorher = localStorage.getItem(key);
      try {
        const klagen = [];
        const zeile = (roh) => {
          localStorage.setItem(key, JSON.stringify([{ id: 'sk', name: 'Löwenzahn', latin: 'Taraxacum officinale', confidence: roh, timestamp: new Date(Date.now() - 3600e3).toISOString() }]));
          return (gsLinaZahlen().match(/^Letzter Scan:[^\n]*/m) || [''])[0];
        };
        const zBruch = zeile(0.94), zProzent = zeile(94);
        if (!/94 % sicher/.test(zBruch)) klagen.push('0.94 wird nicht als 94 % gelesen: ' + zBruch);
        if (!/94 % sicher/.test(zProzent)) klagen.push('94 wird nicht als 94 % gelesen: ' + zProzent);
        // Und dieselbe Zahl in der Liste, die die Person sieht
        localStorage.setItem(key, JSON.stringify([{ id: 'sk', name: 'Löwenzahn', latin: 'Taraxacum officinale', confidence: 0.94, timestamp: new Date(Date.now() - 3600e3).toISOString() }]));
        try { if (typeof openScanHistory === 'function') openScanHistory(); } catch (_) {}
        const txt = Array.from(document.querySelectorAll('#modal-content, #gs-nl-body, [id*="history"]')).map(e => e.textContent || '').join(' ');
        if (/0\.94\s*%/.test(txt)) klagen.push('die Verlaufsliste zeigt den Rohwert „0.94%"');
        else if (/Löwenzahn/.test(txt) && !/94\s*%/.test(txt)) klagen.push('die Verlaufsliste zeigt keine 94 %: ' + (txt.match(/Löwenzahn[^\n]{0,40}/) || [''])[0]);
        try { closeModal('modal-content'); } catch (_) {}
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: '0.94 → „94 % sicher" · 94 → „94 % sicher" · Liste ohne Rohwert' };
      } finally { if (vorher == null) localStorage.removeItem(key); else localStorage.setItem(key, vorher); }
    },
  },
  {
    name: 'Lina T1 · add_calendar_note: Nein schreibt NICHTS, Ja schreibt GENAU EINEN Eintrag — mit quelle „lina", und er steht im Kalender',
    lauf: async () => {
      const key = 'gs_gartentagebuch';
      const vorher = localStorage.getItem(key);
      const echt = window.gsConfirmModal;
      try {
        const klagen = [];
        const zahl = () => (JSON.parse(localStorage.getItem(key) || '[]') || []).length;
        const vorZahl = zahl();
        const tag = _gsKalTagPlus(gsHeuteTag(), 26);
        window.gsConfirmModal = async () => false;
        await gsLinaDispatch({ tool: 'add_calendar_note', args: { day: tag, text: 'Rosen schneiden' } });
        if (zahl() !== vorZahl) klagen.push('bei Nein wurde geschrieben (' + vorZahl + ' → ' + zahl() + ')');
        window.gsConfirmModal = async () => true;
        await gsLinaDispatch({ tool: 'add_calendar_note', args: { day: tag, text: 'Rosen schneiden' } });
        const nach = JSON.parse(localStorage.getItem(key) || '[]') || [];
        if (nach.length !== vorZahl + 1) klagen.push('bei Ja wurden ' + (nach.length - vorZahl) + ' Eintraege geschrieben statt genau einem');
        const neu = nach.filter(e => e && e.text === 'Rosen schneiden')[0];
        if (!neu) klagen.push('der Eintrag steht nicht im Gartentagebuch');
        else {
          if (neu.quelle !== 'lina') klagen.push('quelle ist „' + neu.quelle + '" statt „lina"');
          if (_gsKalTag(neu.ts) !== tag) klagen.push('Datum ' + _gsKalTag(neu.ts) + ' statt ' + tag);
        }
        const ev = gsKalenderEreignisse(tag, tag).filter(e => e.titel === 'Rosen schneiden');
        if (!ev.length) klagen.push('der Eintrag steht nicht im Kalender');
        else if (!/lina|vorgeschlagen/i.test(ev[0].grund || '')) klagen.push('der Grund sagt nicht, dass Lina es vorgeschlagen hat: ' + ev[0].grund);
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'Nein → nichts · Ja → 1 Eintrag (quelle lina) · im Kalender am ' + tag + ': „' + ev[0].titel + '"' };
      } finally { window.gsConfirmModal = echt; if (vorher == null) localStorage.removeItem(key); else localStorage.setItem(key, vorher); }
    },
  },
  {
    // Die zwei schreibenden Tools gibt es seit v23.x und sie hatten nie einen
    // Fall. Beide fragen; geprueft wird, dass ein Nein WIRKLICH nichts tut.
    name: 'Lina T2 · die zwei schreibenden Tools fragen zuerst: Nein legt keine Pflanze an und richtet keine Erinnerung ein, Ja genau eine',
    lauf: async () => {
      const echt = window.gsConfirmModal;
      const sichern = { mp: JSON.stringify(myPlants || []) };
      try {
        const klagen = [];
        window.gsConfirmModal = async () => false;
        const vor = (myPlants || []).length;
        await gsLinaDispatch({ tool: 'propose_add_plant', args: { name: 'Testminze' } });
        if ((myPlants || []).length !== vor) klagen.push('propose_add_plant hat bei Nein angelegt');
        const ziel = (myPlants || [])[0];
        if (!ziel) return { ok: false, warum: 'keine Pflanze in den Beispieldaten — der Fall misst nichts' };
        const vorAktiv = !!(ziel.tasks && ziel.tasks.water && ziel.tasks.water.active);
        if (ziel.tasks && ziel.tasks.water) ziel.tasks.water.active = false;
        await gsLinaDispatch({ tool: 'propose_reminder', args: { task: 'water', plantName: ziel.name, intervalDays: 4 } });
        if (ziel.tasks && ziel.tasks.water && ziel.tasks.water.active) klagen.push('propose_reminder hat bei Nein eingerichtet');
        window.gsConfirmModal = async () => true;
        await gsLinaDispatch({ tool: 'propose_reminder', args: { task: 'water', plantName: ziel.name, intervalDays: 4 } });
        const t = (_gsPflanzeFinden(ziel.id) || {}).p;
        if (!t || !t.tasks || !t.tasks.water || !t.tasks.water.active) klagen.push('propose_reminder hat bei Ja NICHT eingerichtet');
        else if (t.tasks.water.intervalDays !== 4) klagen.push('Intervall ' + t.tasks.water.intervalDays + ' statt 4');
        if (vorAktiv && t && t.tasks && t.tasks.water) t.tasks.water.active = true;
        if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
        return { ok: true, info: 'Nein → keine Pflanze, keine Erinnerung · Ja → giessen alle 4 Tage an „' + ziel.name + '"' };
      } finally { window.gsConfirmModal = echt; try { window.myPlants = JSON.parse(sichern.mp); } catch (_) {} }
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
  await p.clock.setFixedTime(HEUTE_MS);
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {};
  });

  console.log('\n=== sensor_check — funktioniert das Messwerte-Dashboard, bevor es ein Gerät gibt?');
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
  console.log('  Grenze: es gibt hier kein Geraet und keinen Server — geprueft ist der Weg eines');
  console.log('  Messwerts von Hand bis ins Dashboard und in den Kalender (OEKOSYSTEM-V1.md §4).');
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
