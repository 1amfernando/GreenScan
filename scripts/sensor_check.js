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
        if (!cv.getAttribute('aria-label') || !/Balkon Süd · Erde und Balkon Nord · Erde/.test(cv.getAttribute('aria-label'))) return { ok: false, warum: 'aria-label nennt die Geräte nicht: ' + cv.getAttribute('aria-label') };
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
