#!/usr/bin/env node
/**
 * scan_check.js — glaubt der Scanner der KI aufs Wort?
 *
 * Fernando: „Bessere und zuverlässigere Scans sowie Resultate … besser als
 * Google Lens."
 *
 * Die Antwort darauf steht in docs/SCANNER-V3.md §2 und ist keine bessere
 * Bilderkennung — die gibt es hier nicht zu gewinnen. Es ist das PRÜFEN:
 * 4'342 kuratierte Arten, der Monat, der Kanton, die gemessene Bildqualität.
 * Eine reine Bilderkennung hat nichts davon.
 *
 * Dieser Prüfstand fährt `_gsScanPruefwerk` gegen konstruierte Antworten und
 * liest, was danach auf der Karte steht. Zwei Regeln, wie überall:
 *
 *   1. Jede Regel läuft gegen eine GUTE Antwort (darf nichts melden) UND
 *      gegen eine schlechte (muss melden).
 *   2. Was die Anzeige zeigt, wird aus dem gerenderten HTML gelesen, nicht
 *      aus dem Objekt (Lehre aus v31.90).
 *
 * Der wichtigste Fall ist die Sicherheits-Korrektur: sagt das Modell
 * „essbar, ungiftig" über eine Art, die unsere Liste als tödlich führt, MUSS
 * die vorsichtigere Angabe gewinnen — und zwar sichtbar.
 *
 *   node scripts/scan_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');
const { baueJpegMitExif } = require('./_exifjpeg.js');

const FAELLE = [
  {
    name: 'S2 · tödliche Art als „essbar" gemeldet → Korrektur nach oben',
    lauf: () => {
      // Herbstzeitlose steht in unserer Liste mit tox 5. Das Modell behauptet
      // das Gegenteil — genau der Fall, in dem jemand stirbt.
      const r = {
        name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 88,
        edible: true, toxic: false, toxicity: 0, alternatives: [],
      };
      const pw = _gsScanPruefwerk(r, null);
      if (r.toxicity !== 5) return { ok: false, warum: 'Giftigkeit nicht korrigiert (ist ' + r.toxicity + ', erwartet 5)' };
      if (r.edible !== false) return { ok: false, warum: 'gilt weiterhin als essbar' };
      if (!pw.regeln.some(x => x.id === 'gift' && x.zustand === 'warn')) return { ok: false, warum: 'kein Vorbehalt bei der Sicherheit' };
      return { ok: true, info: '0 → 5, essbar → nein' };
    },
  },
  {
    name: 'S2 · Anzeige: die Korrektur steht wirklich auf der Karte',
    lauf: () => {
      const r = {
        name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 88,
        edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x',
      };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      const txt = (el && el.textContent) || '';
      if (!/giftiger ein/.test(txt)) return { ok: false, warum: 'die Korrektur wird nicht genannt' };
      if (!/Gegengeprüft/.test(txt)) return { ok: false, warum: 'die Prüftafel fehlt auf der Karte' };
      if (/undefined|NaN|\[object Object\]/.test(txt)) return { ok: false, warum: 'Platzhalter im Text' };
      if (/✅ Essbar/.test(txt)) return { ok: false, warum: 'zeigt weiterhin „Essbar"' };
      return { ok: true, info: (txt.match(/Unsere Artenliste stuft[^.]*\./) || ['gefunden'])[0].slice(0, 80) };
    },
  },
  {
    name: 'Gute Antwort · Bärlauch im Mai → kein einziger Vorbehalt',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92,
        edible: true, toxic: false, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 28 }],
        _shotCount: 2,
      };
      const pw = _gsScanPruefwerk(r, { messbar: true, quality: 78, blur: 70, light: 80, warnings: [] });
      const warn = pw.regeln.filter(x => x.zustand === 'warn');
      // Die Saison-Regel darf melden, WENN der Prüfstand ausserhalb Apr–Jun läuft.
      const echte = warn.filter(x => x.id !== 'saison');
      if (echte.length) return { ok: false, warum: 'meldet ' + echte.map(x => x.id + ': ' + x.text.slice(0, 50)).join(' | ') };
      if (r.toxicity !== 0 || r.edible !== true) return { ok: false, warum: 'hat eine korrekte Angabe verändert' };
      return { ok: true, info: pw.ok + ' erfüllt, ' + pw.unbekannt + ' offen, Stufe „' + pw.stufe.label + '"' };
    },
  },
  {
    name: 'S1 · erfundene Art → als nicht bekannt gemeldet',
    lauf: () => {
      const r = { name: 'Zzz Fantasiekraut', latin: 'Zzzus fantasticus', confidence: 80, alternatives: [] };
      const pw = _gsScanPruefwerk(r, null);
      const a = pw.regeln.find(x => x.id === 'art');
      if (!a || a.zustand !== 'warn') return { ok: false, warum: 'nicht als unbekannt gemeldet: ' + (a && a.zustand) };
      return { ok: true, info: a.text.slice(0, 60) };
    },
  },
  {
    name: 'S4 · knapper Abstand zum Zweitbesten wird benannt',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 52, edible: true, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 48 }],
      };
      const pw = _gsScanPruefwerk(r, null);
      const a = pw.regeln.find(x => x.id === 'abstand');
      if (!a || a.zustand !== 'warn') return { ok: false, warum: '4 Punkte Abstand gelten als deutlich' };
      if (!/Maiglöckchen/.test(a.text)) return { ok: false, warum: 'nennt die zweite Möglichkeit nicht beim Namen' };
      return { ok: true, info: a.text.replace(/<[^>]+>/g, '').slice(0, 70) };
    },
  },
  {
    name: 'S4 · deutlicher Abstand meldet NICHTS',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92, edible: true, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 20 }],
      };
      const pw = _gsScanPruefwerk(r, null);
      const a = pw.regeln.find(x => x.id === 'abstand');
      if (!a || a.zustand !== 'ok') return { ok: false, warum: '72 Punkte Abstand gelten als knapp' };
      return { ok: true, info: a.text };
    },
  },
  {
    name: 'S5 · dünne Bildgrundlage wird benannt, gute nicht',
    lauf: () => {
      const mach = q => _gsScanPruefwerk(
        { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, toxicity: 0, alternatives: [] }, q
      ).regeln.find(x => x.id === 'grundlage');
      const schlecht = mach({ messbar: true, quality: 30, blur: 20, light: 40, warnings: [] });
      const gut = mach({ messbar: true, quality: 80, blur: 75, light: 85, warnings: [] });
      if (!schlecht || schlecht.zustand !== 'warn') return { ok: false, warum: 'Qualität 30 gilt als brauchbar' };
      if (!gut || gut.zustand !== 'ok') return { ok: false, warum: 'Qualität 80 gilt als dünn' };
      return { ok: true, info: '30 → Vorbehalt, 80 → in Ordnung' };
    },
  },
  {
    name: 'Anzeige · die gesehenen Merkmale stehen auf der Karte',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92, edible: true, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 20 }],
        diagnostic_features: ['Breite Einzelblätter', 'Glänzend grün', 'Stiel direkt aus dem Boden'],
        next_photo_hint: 'Blattunterseite aus der Nähe',
      };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      const txt = (el && el.textContent) || '';
      if (!/Das habe ich im Foto gesehen/.test(txt)) return { ok: false, warum: 'die Merkmals-Karte fehlt' };
      const fehlend = r.diagnostic_features.filter(m => txt.indexOf(m) < 0);
      if (fehlend.length) return { ok: false, warum: 'diese Merkmale fehlen: ' + fehlend.join(', ') };
      if (!/Blattunterseite/.test(txt)) return { ok: false, warum: 'der Hinweis auf das nächste Foto fehlt' };
      const li = el.querySelectorAll('.sr2-merkmale li');
      if (li.length !== 3) return { ok: false, warum: 'erwartet 3 Merkmale, gerendert ' + li.length };
      return { ok: true, info: li.length + ' Merkmale + Foto-Hinweis' };
    },
  },
  {
    name: 'Anzeige · ohne Merkmale wird nichts erfunden',
    lauf: () => {
      const r = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92, edible: true, toxicity: 0, alternatives: [] };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      const li = el.querySelectorAll('.sr2-merkmale li');
      if (li.length) return { ok: false, warum: 'zeigt ' + li.length + ' Merkmale, obwohl keine geliefert wurden' };
      const txt = (el && el.textContent) || '';
      if (/undefined|NaN|\[object Object\]/.test(txt)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: 'keine Merkmale, keine erfundenen' };
    },
  },
  // ── v32.00 · EXIF: das Foto weiss, wann und wo es entstand ─────────────
  // Ein Binaer-Parser, der nie gegen echte Bytes gelaufen ist, ist eine
  // Behauptung. Die Bytes entstehen in scripts/_exifjpeg.js.
  {
    name: 'EXIF · Datum und GPS werden aus echten Bytes gelesen',
    lauf: async () => {
      const bytes = window.__PRUEF_JPEG;
      const buf = new Uint8Array(bytes).buffer;
      const e = _gsExifLesen(buf);
      if (!e) return { ok: false, warum: 'nichts gelesen' };
      if (e.monat !== 7) return { ok: false, warum: 'Monat ' + e.monat + ', erwartet 7' };
      if (!e.datum || e.datum.getFullYear() !== 2026 || e.datum.getDate() !== 14)
        return { ok: false, warum: 'Datum falsch: ' + (e.datum && e.datum.toISOString()) };
      if (e.lat == null || Math.abs(e.lat - 46.8182) > 0.01) return { ok: false, warum: 'Breite ' + e.lat + ', erwartet ~46.818' };
      if (e.lng == null || Math.abs(e.lng - 8.2275) > 0.01) return { ok: false, warum: 'Länge ' + e.lng + ', erwartet ~8.227' };
      return { ok: true, info: e.datum.toISOString().slice(0, 10) + ' · ' + e.lat.toFixed(3) + '/' + e.lng.toFixed(3) };
    },
  },
  {
    name: 'EXIF · Foto OHNE EXIF behauptet nichts',
    lauf: () => {
      // Ein nacktes JPEG: nur SOI und EOI.
      const buf = new Uint8Array([0xFF, 0xD8, 0xFF, 0xD9]).buffer;
      const e = _gsExifLesen(buf);
      if (e) return { ok: false, warum: 'liefert Daten für ein Bild ohne EXIF: ' + JSON.stringify(e) };
      return { ok: true, info: 'null, wie es sein soll' };
    },
  },
  {
    name: 'EXIF · kaputte Uhr (Datum in der Zukunft) wird verworfen',
    lauf: () => {
      const bytes = window.__PRUEF_JPEG_ZUKUNFT;
      const e = _gsExifLesen(new Uint8Array(bytes).buffer);
      if (e && e.datum) return { ok: false, warum: 'übernimmt ein Datum aus der Zukunft: ' + e.datum.toISOString() };
      if (!e || e.lat == null) return { ok: false, warum: 'verwirft mit dem Datum auch das GPS' };
      return { ok: true, info: 'Datum verworfen, GPS behalten' };
    },
  },
  {
    name: 'EXIF · der Auftragstext nennt Aufnahmedatum und Ort aus dem Foto',
    lauf: () => {
      window._gsScanExif = { datum: new Date(2026, 6, 14), monat: 7, lat: 46.8182, lng: 8.2275 };
      const ctx = gsBuildScanContext();
      const txt = gsFormatScanContext(ctx);
      window._gsScanExif = null;
      if (ctx.monthNum !== 7) return { ok: false, warum: 'Monat ' + ctx.monthNum + ' statt 7 — das Foto wird ignoriert' };
      if (!/Juli/.test(txt)) return { ok: false, warum: 'Juli steht nicht im Auftragstext' };
      if (!/Aufnahmedatum aus dem Foto/.test(txt)) return { ok: false, warum: 'die Herkunft des Datums wird nicht genannt' };
      if (!/46\.818/.test(txt)) return { ok: false, warum: 'die Koordinaten aus dem Foto fehlen' };
      if (!/Ort aus dem Foto/.test(txt)) return { ok: false, warum: 'die Herkunft des Orts wird nicht genannt' };
      return { ok: true, info: txt.split('\n')[0].slice(0, 72) };
    },
  },
  {
    name: 'EXIF · ohne Foto-Datum gilt weiterhin heute',
    lauf: () => {
      window._gsScanExif = null;
      const ctx = gsBuildScanContext();
      const heute = new Date().getMonth() + 1;
      if (ctx.monthNum !== heute) return { ok: false, warum: 'Monat ' + ctx.monthNum + ', erwartet ' + heute };
      if (ctx.ausFoto) return { ok: false, warum: 'behauptet ein Aufnahmedatum, das es nicht gibt' };
      return { ok: true, info: 'Monat ' + heute + ', keine Behauptung über das Foto' };
    },
  },
  {
    name: 'EXIF · S3 beurteilt nach dem Monat des FOTOS, nicht nach heute',
    lauf: () => {
      // Herbstzeitlose: Saison Aug–Okt. Im Juli aufgenommen → Widerspruch.
      // Im September aufgenommen → kein Widerspruch. Der Prüfstand läuft
      // heute im September, also zeigt der Unterschied, dass das Foto zählt.
      const mach = monat => {
        const r = { name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 80,
                    toxicity: 5, alternatives: [], _ctx: { monthNum: monat } };
        return _gsScanPruefwerk(r, null).regeln.find(x => x.id === 'saison');
      };
      const juli = mach(7), september = mach(9);
      if (!juli || juli.zustand !== 'warn') return { ok: false, warum: 'Juli gilt als passend für Aug–Okt' };
      if (!september || september.zustand !== 'ok') return { ok: false, warum: 'September gilt NICHT als passend für Aug–Okt: ' + (september && september.zustand) };
      return { ok: true, info: 'Juli → Vorbehalt, September → passt' };
    },
  },
  {
    name: 'EXIF · Anzeige: die Karte sagt, dass Datum und Ort aus dem Foto stammen',
    lauf: () => {
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, edible: true, toxicity: 0,
        alternatives: [], _ctx: { ausFoto: true, aufnahme: '2026-07-14', ortAusFoto: true, lat: '46.818', lng: '8.228', monthNum: 7 },
      };
      showScanResult(r);
      const txt = (document.getElementById('scan-result') || {}).textContent || '';
      if (!/Aus dem Foto gelesen/.test(txt)) return { ok: false, warum: 'die Karte fehlt' };
      if (!/2026-07-14/.test(txt)) return { ok: false, warum: 'das Datum steht nicht da' };
      if (!/46\.818/.test(txt)) return { ok: false, warum: 'der Ort steht nicht da' };
      if (/undefined|NaN/.test(txt)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: (txt.match(/Dieses Bild wurde[^.]*\./) || ['gefunden'])[0].slice(0, 84) };
    },
  },
  // ── v32.01 · Das Urteil muss handlungsfähig sein ───────────────────────
  {
    name: 'Handlung · bei Vorbehalten steht der Knopf für ein zweites Foto',
    lauf: () => {
      window._gsLastScanB64 = 'AAAA';   // so, als läge ein erstes Foto vor
      // Hohe Modell-Sicherheit, aber die Prüfung widerspricht: genau der
      // Fall, in dem die alte Bedingung (conf < 85) nichts angeboten hätte.
      const r = {
        name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 94,
        edible: true, toxic: false, toxicity: 0, alternatives: [],
      };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      const knopf = el.querySelector('.sr2-pruef-knopf');
      if (!knopf) return { ok: false, warum: 'kein Knopf, obwohl die Prüfung widerspricht (Modell meldet 94 %)' };
      if (!/gsAddPhotoForRescan/.test(knopf.getAttribute('onclick') || '')) return { ok: false, warum: 'der Knopf führt nirgendwohin' };
      const doppelt = el.querySelectorAll('[onclick*="gsAddPhotoForRescan"]');
      if (doppelt.length > 1) return { ok: false, warum: doppelt.length + ' Knöpfe für dieselbe Handlung' };
      return { ok: true, info: (knopf.textContent || '').trim() };
    },
  },
  {
    name: 'Handlung · ohne Vorbehalte kein Knopf',
    lauf: () => {
      window._gsLastScanB64 = 'AAAA';
      const r = {
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 95, edible: true, toxicity: 0,
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 15 }],
        _ctx: { monthNum: 5 },   // Mai — passt zu Apr–Jun
        _qual: { messbar: true, quality: 82, blur: 78, light: 86, warnings: [] },
      };
      showScanResult(r);
      const el = document.getElementById('scan-result');
      if (el.querySelector('.sr2-pruef-knopf')) return { ok: false, warum: 'bietet ein zweites Foto an, obwohl nichts widerspricht' };
      return { ok: true, info: 'sauberer Fund, kein Knopf' };
    },
  },
  // ── v32.02 · Die Karte darf sich nicht selbst widersprechen ────────────
  {
    name: 'Einigkeit · „nicht in unserer Liste" und „Vollständiger Eintrag" schliessen sich aus',
    lauf: () => {
      const proben = [
        { name: 'Bärlauch', latin: 'Allium ursinum' },
        { name: 'Herbstzeitlose', latin: 'Colchicum autumnale' },
        { name: 'Waldmeister', latin: 'Galium odoratum' },
        { name: 'Zzz Fantasiekraut', latin: 'Zzzus fantasticus' },
      ];
      const streit = [];
      for (const pr of proben) {
        const pw = _gsScanPruefwerk({ ...pr, confidence: 80, toxicity: 0, alternatives: [] }, null);
        const regel = pw.regeln.find(x => x.id === 'art');
        const kenntPruefung = regel && regel.zustand === 'ok';
        const kenntKarte = !!gsMatchScanToDb(pr.name, pr.latin);
        // Die Karte darf grosszügiger sein (sie verlinkt auch ungeprüfte
        // Einträge) — aber sie darf nie WENIGER kennen als die Prüfung.
        if (kenntPruefung && !kenntKarte) streit.push(pr.name + ': Prüfung kennt die Art, die Karte nicht');
      }
      if (streit.length) return { ok: false, warum: streit.join(' · ') };
      return { ok: true, info: proben.length + ' Proben, kein Widerspruch' };
    },
  },
  {
    name: 'Anzeige · das Scan-Foto steht genau EINMAL auf der Karte',
    lauf: () => {
      window._gsLastScanB64 = 'AAAA';
      showScanResult({
        name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92, edible: true, toxicity: 0,
        alternatives: [], diagnostic_features: ['Breite Blätter', 'Knoblauchgeruch'],
      });
      const el = document.getElementById('scan-result');
      const bilder = [...el.querySelectorAll('img')].filter(i => /base64,AAAA/.test(i.getAttribute('src') || ''));
      if (bilder.length !== 1) return { ok: false, warum: bilder.length + '× dasselbe Foto auf einer Karte' };
      const li = el.querySelectorAll('.sr2-merkmale li');
      if (li.length !== 2) return { ok: false, warum: 'die Merkmale sind mit dem Bild verschwunden (' + li.length + ')' };
      return { ok: true, info: '1 Foto, ' + li.length + ' Merkmale' };
    },
  },
  // ── v32.03 · Was der Prompt verlangt, muss auch jemand lesen ───────────
  //
  // Das Muster dieser Session, hier zum vierten Mal: abgefragt, geliefert,
  // weggeworfen. Bei der Giftigkeit der Alternativen (v31.92) und den
  // Merkmalen (v31.99) war es teuer. Diese Prüfung macht daraus eine Regel:
  // jedes Feld im JSON-Beispiel des Prompts muss im Code gelesen werden.
  //
  // Kostet ein unbenutztes Feld nur Tokens? Ja — und das ist schon Grund
  // genug. Aber es ist auch das verlässlichste Zeichen für eine Ansicht,
  // die es nie gab.
  {
    name: 'Prompt · jedes verlangte Feld wird irgendwo gelesen',
    lauf: () => {
      const quelle = window.__QUELLE || '';
      if (!quelle) return { ok: false, warum: 'Quelltext nicht übergeben' };
      const sp = window.SCAN_SYSTEM_PROMPT || '';
      if (!sp) return { ok: false, warum: 'SCAN_SYSTEM_PROMPT nicht erreichbar' };
      // Die Feldnamen aus dem JSON-Beispiel am Ende des Prompts.
      const felder = [...new Set((sp.match(/"([a-z_]{3,30})"\s*:/g) || [])
        .map(x => x.replace(/["\s:]/g, '')))];
      if (felder.length < 10) return { ok: false, warum: 'nur ' + felder.length + ' Felder erkannt — das Muster passt nicht mehr' };
      const tot = felder.filter(f => {
        // Gelesen heisst: irgendwo `.feld` ausserhalb des Prompts selbst.
        const re = new RegExp('\\.' + f + '\\b', 'g');
        return (quelle.match(re) || []).length === 0;
      });
      if (tot.length) return { ok: false, warum: 'verlangt und nirgends gelesen: ' + tot.join(', ') };
      return { ok: true, info: felder.length + ' Felder, alle gelesen' };
    },
  },
  {
    name: 'Regional-Hinweis · nur bei ausdrücklichem Nein, nicht bei fehlendem Feld',
    lauf: () => {
      const zeigt = r => {
        showScanResult(Object.assign({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90,
                                       edible: true, toxicity: 0, alternatives: [] }, r));
        return /Regional-Hinweis/.test((document.getElementById('scan-result') || {}).textContent || '');
      };
      if (zeigt({})) return { ok: false, warum: 'warnt, obwohl das Feld gar nicht geliefert wurde' };
      if (zeigt({ found_in_switzerland: true })) return { ok: false, warum: 'warnt trotz ausdrücklichem Ja' };
      if (!zeigt({ found_in_switzerland: false })) return { ok: false, warum: 'warnt NICHT bei ausdrücklichem Nein' };
      return { ok: true, info: 'fehlt → still · ja → still · nein → Hinweis' };
    },
  },
  // ── v32.08 · Zurück-Knopf, Scangitter, Schrittliste ───────────────────
  {
    name: 'Zurück · das Ergebnis hat oben einen Weg heraus',
    lauf: () => {
      window._gsLastScanB64 = 'AAAA';
      showScanResult({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 92,
                       edible: true, toxicity: 0, alternatives: [] });
      const el = document.getElementById('scan-result');
      const leiste = el.querySelector('.sr2-zurueck');
      if (!leiste) return { ok: false, warum: 'keine Zurück-Leiste' };
      const knoepfe = [...leiste.querySelectorAll('button')];
      if (knoepfe.length < 2) return { ok: false, warum: 'nur ' + knoepfe.length + ' Knopf' };
      // v32.09: links ins Hauptmenü, rechts zurück zum Scanner.
      if (!/gsScanZumMenue/.test(knoepfe[0].getAttribute('onclick') || ''))
        return { ok: false, warum: 'der Hauptknopf führt nicht ins Hauptmenü' };
      if (!/Hauptmen/.test(knoepfe[0].textContent || ''))
        return { ok: false, warum: 'der Hauptknopf sagt nicht, wohin er führt: „' + knoepfe[0].textContent + '"' };
      if (!/gsResetScanner/.test(knoepfe[knoepfe.length - 1].getAttribute('onclick') || ''))
        return { ok: false, warum: 'das ✕ schliesst das Ergebnis nicht' };
      // Sie muss die ERSTE Sache auf der Karte sein — sonst liegt der Weg
      // heraus wieder hinter der ganzen Karte.
      if (el.firstElementChild !== leiste) return { ok: false, warum: 'steht nicht zuoberst' };
      if (getComputedStyle(leiste).position !== 'sticky') return { ok: false, warum: 'bleibt beim Scrollen nicht stehen' };
      // Und der Knopf muss wirklich schliessen.
      // Und beide müssen wirklich etwas tun.
      let reset = 0, menue = 0;
      const eR = window.gsResetScanner, eM = window.openMainMenu;
      window.gsResetScanner = () => { reset++; };
      window.openMainMenu = () => { menue++; };
      knoepfe[0].click();
      if (!menue) return { ok: false, warum: 'der Hauptmenü-Knopf öffnet kein Menü' };
      if (!reset) return { ok: false, warum: 'das Ergebnis bleibt beim Wechsel ins Menü stehen' };
      reset = 0;
      knoepfe[knoepfe.length - 1].click();
      window.gsResetScanner = eR; window.openMainMenu = eM;
      if (!reset) return { ok: false, warum: 'das ✕ bewirkt nichts' };
      return { ok: true, info: '☰ → Menü + Ergebnis zu · ✕ → zurück zum Scanner' };
    },
  },
  {
    name: 'Zurück-Leiste gibt es NUR beim Ergebnis',
    lauf: () => {
      const el = document.getElementById('scan-result');
      el.innerHTML = ''; el.style.display = 'none';
      // Der Zustand während der Analyse darf sie nicht haben.
      el.innerHTML = '<div class="analyzing gs-scanview">' + _gsSchritteHtml() + '</div>';
      if (el.querySelector('.sr2-zurueck')) return { ok: false, warum: 'steht auch während der Analyse da' };
      return { ok: true, info: 'nur auf der Ergebniskarte' };
    },
  },
  {
    name: 'Scangitter · die Kanten kommen aus dem echten Foto',
    lauf: async () => {
      // Ein Bild MIT Struktur (ein blattähnlicher Umriss) und eines ohne.
      const mach = zeichne => new Promise(res => {
        const c = document.createElement('canvas'); c.width = 240; c.height = 240;
        const g = c.getContext('2d');
        g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 240, 240);
        zeichne(g);
        const im = new Image(); im.onload = () => res(im); im.src = c.toDataURL('image/jpeg', 0.92);
      });
      const mitBlatt = await mach(g => {
        g.fillStyle = '#3f9142';
        g.beginPath(); g.ellipse(120, 110, 74, 44, -0.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1d5c22'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(58, 158); g.lineTo(182, 62); g.stroke();       // Mittelrippe
        for (let i = 1; i < 6; i++) {                                          // Blattadern
          g.beginPath(); g.moveTo(58 + i * 21, 158 - i * 16); g.lineTo(58 + i * 21 + 16, 158 - i * 16 - 34); g.stroke();
        }
        g.strokeStyle = '#2c6b30'; g.lineWidth = 6;
        g.beginPath(); g.moveTo(120, 154); g.lineTo(126, 226); g.stroke();     // Stiel
      });
      const flach = await mach(() => {});

      const k1 = _gsScanKanten(mitBlatt, 160);
      const k2 = _gsScanKanten(flach, 160);
      if (!k1 || k1.length < 90) return { ok: false, warum: 'findet am Blatt kaum Kanten: ' + (k1 ? k1.length / 3 : 0) + ' Punkte' };
      if (k2 && k2.length / 3 > 40) return { ok: false, warum: 'findet auf einer leeren Fläche ' + (k2.length / 3) + ' Kanten — das wäre erfunden' };
      // Die Punkte müssen im Bild liegen und dort, wo das Blatt ist.
      let drin = 0, mitte = 0;
      for (let i = 0; i < k1.length; i += 3) {
        const x = k1[i], y = k1[i + 1];
        if (x >= 0 && x <= 1 && y >= 0 && y <= 1) drin++;
        if (x > 0.2 && x < 0.8 && y > 0.2 && y < 0.8) mitte++;
      }
      if (drin !== k1.length / 3) return { ok: false, warum: 'Punkte ausserhalb des Bildes' };
      if (mitte < k1.length / 3 * 0.4) return { ok: false, warum: 'die Kanten liegen nicht dort, wo das Blatt ist' };
      return { ok: true, info: (k1.length / 3) + ' Kantenpunkte am Blatt · ' + (k2 ? k2.length / 3 : 0) + ' auf leerer Fläche' };
    },
  },
  {
    name: 'Schrittliste · fünf Schritte, jeder mit echtem Ergebnis',
    lauf: async () => {
      const el = document.getElementById('scan-result');
      el.innerHTML = '<div class="analyzing gs-scanview">' + _gsSchritteHtml() + '</div>';
      const li = [...el.querySelectorAll('.gs-schritte li')];
      if (li.length !== 5) return { ok: false, warum: li.length + ' Schritte statt 5' };
      if (!li.every(x => x.className === 'offen')) return { ok: false, warum: 'nicht alle beginnen offen' };

      gsSchritt('bild', 'fertig', 'Schärfe 72 · Licht 80');
      gsSchritt('ort', 'fertig', 'Juli · Sommer · aus dem Foto');
      gsSchritt('cache', 'fertig', 'kein Treffer');
      gsSchritt('ki', 'laeuft', '3 s');
      const kiL = document.getElementById('schritt-ki');
      if (kiL.className !== 'laeuft') return { ok: false, warum: 'der laufende Schritt ist nicht markiert' };
      if ((kiL.querySelector('.gs-s-erg').textContent || '') !== '3 s') return { ok: false, warum: 'die Sekunden fehlen' };
      gsSchritt('ki', 'fertig', 'Antwort nach 7 s');
      gsSchritt('pruef', 'fertig', '5 Regeln · 1 Vorbehalt');

      const fertig = [...el.querySelectorAll('.gs-schritte li.fertig')];
      if (fertig.length !== 5) return { ok: false, warum: fertig.length + ' von 5 abgehakt' };
      const ohne = fertig.filter(x => !(x.querySelector('.gs-s-erg').textContent || '').trim());
      if (ohne.length) return { ok: false, warum: ohne.length + ' Schritte ohne Ergebnis — dann ist es wieder nur eine Ansage' };
      const txt = el.textContent || '';
      if (/schaut sich das Foto an/.test(txt)) return { ok: false, warum: 'der alte Text steht noch da' };
      return { ok: true, info: '5 abgehakt, alle mit Ergebnis' };
    },
  },
  {
    name: 'Ganzer Ablauf · analyzeImage füllt die Schritte mit echten Werten',
    lauf: async () => {
      // Ein echtes kleines JPEG mit Struktur.
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160);
      g.fillStyle = '#3f9142'; g.beginPath(); g.ellipse(80, 74, 50, 30, -0.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1d5c22'; g.lineWidth = 2; g.beginPath(); g.moveTo(38, 104); g.lineTo(122, 42); g.stroke();
      const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];

      // Sperren und Netz stellen — geprüft wird der ABLAUF, nicht die KI.
      window.getApiConfig = () => ({ key: 'k' });
      window.stopCamera = () => {};
      window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
      window.gsScanPersistToCloud = () => Promise.resolve(true);
      window.gsAddToScanHistory = () => {}; window.gsHaptic = () => {};
      window._gsScanDHash = async () => 'hash-xyz';
      window._gsScanCacheGet = async () => null;      // kein Treffer
      window._gsScanCachePut = () => {};
      window.gsBuildScanContext = () => ({ month: 'Juli', season: 'Sommer', monthNum: 7, canton: 'UR', ausFoto: true, aufnahme: '2026-07-14' });
      const gesehen = [];
      window.callVisionAI = async () => {
        // Während des Aufrufs muss der KI-Schritt als LAUFEND markiert sein.
        const li = document.getElementById('schritt-ki');
        gesehen.push('ki=' + (li ? li.className : 'weg'));
        gesehen.push('bild=' + ((document.getElementById('schritt-bild') || {}).className || '?'));
        gesehen.push('ergBild=' + ((document.querySelector('#schritt-bild .gs-s-erg') || {}).textContent || ''));
        gesehen.push('ergOrt=' + ((document.querySelector('#schritt-ort .gs-s-erg') || {}).textContent || ''));
        gesehen.push('gitter=' + (document.querySelector('#gs-scanfoto canvas.gs-scangitter') ? 'da' : 'fehlt'));
        await new Promise(r => setTimeout(r, 30));
        return JSON.stringify({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88,
          edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
      };

      await analyzeImage(b64, 'image/jpeg');

      if (!gesehen.includes('ki=laeuft')) return { ok: false, warum: 'der KI-Schritt war während des Aufrufs nicht als laufend markiert: ' + gesehen.join(' | ') };
      if (!gesehen.includes('bild=fertig')) return { ok: false, warum: 'der Bild-Schritt war beim KI-Aufruf noch nicht abgehakt' };
      if (!gesehen.some(x => /^ergBild=Schärfe/.test(x))) return { ok: false, warum: 'kein gemessenes Bild-Ergebnis: ' + gesehen.join(' | ') };
      if (!gesehen.some(x => /^ergOrt=Juli/.test(x))) return { ok: false, warum: 'kein Orts-Ergebnis: ' + gesehen.join(' | ') };
      if (!gesehen.includes('gitter=da')) return { ok: false, warum: 'die Gitter-Leinwand lag nicht über dem Foto' };
      // Danach steht die Ergebniskarte mit der Zurück-Leiste.
      const el = document.getElementById('scan-result');
      if (!el.querySelector('.sr2-zurueck')) return { ok: false, warum: 'nach dem Scan fehlt die Zurück-Leiste' };
      return { ok: true, info: gesehen.filter(x => /^erg/.test(x)).join(' · ') };
    },
  },
  {
    name: 'Drei Zustände · ohne Artenliste ist nichts „in Ordnung"',
    lauf: () => {
      const echt = window.DB;
      window.DB = [];
      const pw = _gsScanPruefwerk({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, alternatives: [] }, null);
      window.DB = echt;
      const ok = pw.regeln.filter(x => x.zustand === 'ok');
      if (ok.length) return { ok: false, warum: 'meldet ' + ok.length + '× „erfüllt" ohne jede Datengrundlage: ' + ok.map(x => x.id).join(',') };
      if (pw.stufe && pw.stufe.schl === 'stark') return { ok: false, warum: 'Stufe „gut belegt" ohne Belege' };
      if (!pw.regeln.every(x => x.text && x.text.length > 10)) return { ok: false, warum: 'eine Regel nennt keinen Grund' };
      return { ok: true, info: pw.regeln.length + ' Regeln, alle mit Grund, Stufe „' + (pw.stufe && pw.stufe.label) + '"' };
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
  await p.evaluate((jetzt) => {
    window.__PRUEF_JPEG = jetzt.normal;
    window.__PRUEF_JPEG_ZUKUNFT = jetzt.zukunft;
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {};
    window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
    window.gsScanPersistToCloud = () => Promise.resolve(true);
    window.gsAddToScanHistory = () => {};
    window.gsHaptic = () => {};
    window.__QUELLE = jetzt.quelle;
  }, {
    normal:  Array.from(baueJpegMitExif({ datum: '2026:07:14 09:33:12', lat: 46.8182, lng: 8.2275 })),
    zukunft: Array.from(baueJpegMitExif({ datum: '2099:01:01 00:00:00', lat: 46.8182, lng: 8.2275 })),
    quelle:  require('fs').readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8'),
  });

  console.log('\n=== scan_check — glaubt der Scanner der KI aufs Wort?');
  const da = await p.evaluate(() => (typeof DB !== 'undefined' && DB && DB.length) ? DB.length : 0);
  console.log('  Artenliste geladen: ' + da + ' Arten' + (da ? '' : '  ← ohne sie prueft dieser Stand nichts'));
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
  await br.close();
  process.exitCode = (kaputt || !da) ? 1 : 0;
})();
