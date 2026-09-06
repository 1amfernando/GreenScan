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

const HEUTE_MS = 1756684800000 + 12 * 3600 * 1000;   // wie kalender_check: `now` aus _seed.js + 12 h

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
      if (ctx.length > 1100) return { ok: false, warum: 'Kontext ' + ctx.length + ' Zeichen — das ist ein Datenexport, kein Kontext' };
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
