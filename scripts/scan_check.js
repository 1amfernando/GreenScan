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
    name: 'Schrittliste · sieben Schritte, jeder mit echtem Ergebnis',
    lauf: async () => {
      const el = document.getElementById('scan-result');
      el.innerHTML = '<div class="analyzing gs-scanview">' + _gsSchritteHtml() + '</div>';
      const li = [...el.querySelectorAll('.gs-schritte li')];
      // Die Zahl steht in GS_SCAN_SCHRITTE — hier wird gegen die Liste
      // geprüft, nicht gegen eine im Prüfstand wiederholte Zahl. Sonst
      // meldet er bei jedem neuen Schritt einen Fehler, den es nicht gibt.
      const soll = GS_SCAN_SCHRITTE.length;
      if (soll < 5) return { ok: false, warum: 'nur ' + soll + ' Schritte definiert' };
      if (li.length !== soll) return { ok: false, warum: li.length + ' Schritte statt ' + soll };
      if (!li.every(x => x.className === 'offen')) return { ok: false, warum: 'nicht alle beginnen offen' };

      gsSchritt('bild', 'fertig', 'Schärfe 72 · Licht 80');
      gsSchritt('ort', 'fertig', 'Juli · Sommer · aus dem Foto');
      gsSchritt('farbe', 'fertig', 'Grün 61 % · Weiss 14 %',
                [{ name: 'Grün', anteil: 61 }, { name: 'Weiss', anteil: 14 }]);
      gsSchritt('vorab', 'fertig', '4’342 → 1’268 (Monat · Farbe)');
      gsSchritt('cache', 'fertig', 'kein Treffer');
      gsSchritt('ki', 'laeuft', '3 s');
      const kiL = document.getElementById('schritt-ki');
      if (kiL.className !== 'laeuft') return { ok: false, warum: 'der laufende Schritt ist nicht markiert' };
      if ((kiL.querySelector('.gs-s-erg').textContent || '') !== '3 s') return { ok: false, warum: 'die Sekunden fehlen' };
      gsSchritt('ki', 'fertig', 'Antwort nach 7 s');
      gsSchritt('pruef', 'fertig', '7 Regeln · 1 Vorbehalt');

      const fertig = [...el.querySelectorAll('.gs-schritte li.fertig')];
      if (fertig.length !== soll) return { ok: false, warum: fertig.length + ' von ' + soll + ' abgehakt' };
      const ohne = fertig.filter(x => !(x.querySelector('.gs-s-erg').textContent || '').trim());
      if (ohne.length) return { ok: false, warum: ohne.length + ' Schritte ohne Ergebnis — dann ist es wieder nur eine Ansage' };
      // Die Farbtupfen dürfen den Text nicht ERSETZEN: wer Farben nicht
      // unterscheidet, liest sonst gar nichts.
      const tup = document.querySelectorAll('#schritt-farbe .gs-s-tupfen i');
      if (tup.length !== 2) return { ok: false, warum: tup.length + ' Farbtupfen statt 2' };
      if (!/Grün 61 %/.test(document.getElementById('schritt-farbe').textContent || ''))
        return { ok: false, warum: 'die Farben stehen nur als Punkt da, nicht als Text' };
      // Und sie dürfen sich nicht aufstapeln, wenn der Schritt erneut gesetzt wird.
      gsSchritt('farbe', 'fertig', 'Grün 61 %', [{ name: 'Grün', anteil: 61 }]);
      if (document.querySelectorAll('#schritt-farbe .gs-s-tupfen i').length !== 1)
        return { ok: false, warum: 'die Farbtupfen stapeln sich bei erneutem Setzen' };
      const txt = el.textContent || '';
      if (/schaut sich das Foto an/.test(txt)) return { ok: false, warum: 'der alte Text steht noch da' };
      return { ok: true, info: soll + ' abgehakt, alle mit Ergebnis, Farben auch als Text' };
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
  // ── v32.10 · Die Gegenprobe (Stufe 3) ────────────────────────────────
  {
    name: 'Gegenprobe · erscheint NUR bei essbar + giftiger Alternative',
    lauf: () => {
      window._gsLastScanB64 = 'AAAA';
      const zeigt = r => {
        showScanResult(Object.assign({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88 }, r));
        return !!document.querySelector('#gs-gegenprobe .gs-gp-knopf');
      };
      // essbar + tödliche Alternative → ja
      if (!zeigt({ edible: true, toxicity: 0, alternatives: [
        { name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 30 }] }))
        return { ok: false, warum: 'fehlt im gefährlichsten Fall (essbar + tödliche Verwechslung)' };
      // essbar, aber harmlose Alternativen → nein
      if (zeigt({ edible: true, toxicity: 0, alternatives: [
        { name: 'Schnittlauch', latin: 'Allium schoenoprasum', confidence: 20, toxicity: 0, edible: true }] }))
        return { ok: false, warum: 'erscheint auch ohne giftige Alternative — würde Kontingent verbrennen' };
      // nicht essbar + giftige Alternative → nein (niemand will es essen)
      if (zeigt({ edible: false, toxicity: 4, alternatives: [
        { name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 30 }] }))
        return { ok: false, warum: 'erscheint, obwohl die Art gar nicht als essbar gilt' };
      // ganz ohne Alternativen → nein
      if (zeigt({ edible: true, toxicity: 0, alternatives: [] }))
        return { ok: false, warum: 'erscheint ohne jede Verwechslungsmöglichkeit' };
      return { ok: true, info: 'nur essbar + giftige Alternative' };
    },
  },
  {
    name: 'Gegenprobe · der Auftrag ist WIDERLEGEN, nicht bestätigen',
    lauf: async () => {
      window._gsLastScanB64 = 'AAAA'; window._gsLastScanMt = 'image/jpeg';
      window._gsLetzterScan = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88,
        edible: true, toxicity: 0, _altGefahr: 5,
        alternatives: [{ name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 30 }],
        diagnostic_features: ['Breite Blätter'] };
      let sys = '', frage = '';
      window.callVisionAI = async (b, m, p, ex, o) => {
        sys = (o && o.systemPrompt) || ''; frage = p || '';
        return JSON.stringify({ urteil: 'bestaetigt', vertrauen: 80, dagegen: [], dafuer: ['Knoblauchgeruch erwähnt'], fehlend: '', verzehr: 'ja' });
      };
      const host = document.createElement('div'); host.id = 'gs-gegenprobe';
      document.body.appendChild(host);
      await gsScanGegenprobe();
      host.remove();
      if (!/WIDERLEGEN|widerlegen/.test(sys)) return { ok: false, warum: 'der Auftrag verlangt kein Widerlegen' };
      if (/bestätige|bestaetige/i.test(sys.split('REGELN')[0]) && !/NICHT/.test(sys)) return { ok: false, warum: 'der Auftrag bittet um Bestätigung' };
      if (!/BEHAUPTUNG/.test(frage)) return { ok: false, warum: 'die erste Bestimmung wird nicht als Behauptung vorgelegt' };
      if (!/Herbstzeitlose/.test(frage)) return { ok: false, warum: 'die giftige Alternative fehlt im Auftrag' };
      return { ok: true, info: 'Systemauftrag „widerlegen", Bestimmung als Behauptung' };
    },
  },
  {
    name: 'Gegenprobe · Widerspruch sagt deutlich „iss das nicht"',
    lauf: () => {
      const host = document.createElement('div'); host.id = 'gs-gegenprobe';
      document.body.appendChild(host);
      gsGegenprobeRender({ urteil: 'widerlegt', vertrauen: 20,
        dagegen: ['Kein Knoblauchgeruch beschrieben', 'Blattbasis fleischig'],
        dafuer: [], fehlend: 'Blattunterseite', verzehr: 'nein',
        bessere_erklaerung: { name: 'Herbstzeitlose', latin: 'Colchicum autumnale', warum: 'Blattform passt besser' } },
        { name: 'Bärlauch' });
      const t = host.textContent || '';
      host.remove();
      if (!/WIDERSPRICHT/.test(t)) return { ok: false, warum: 'der Widerspruch steht nicht als Überschrift' };
      if (!/Iss das nicht/.test(t)) return { ok: false, warum: 'die klare Ansage fehlt' };
      if (!/Nicht verzehren/i.test(t)) return { ok: false, warum: 'die Verzehr-Empfehlung fehlt' };
      if (!/Herbstzeitlose/.test(t)) return { ok: false, warum: 'die bessere Erklärung wird nicht genannt' };
      if (!/Blattunterseite/.test(t)) return { ok: false, warum: 'das fehlende Merkmal wird nicht genannt' };
      if (/undefined|NaN|\[object Object\]/.test(t)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: (t.match(/Der zweite Blick[^.]*/) || ['gefunden'])[0].slice(0, 46) };
    },
  },
  {
    name: 'Gegenprobe · Einigkeit wird nicht als Beweis verkauft',
    lauf: () => {
      const host = document.createElement('div'); host.id = 'gs-gegenprobe';
      document.body.appendChild(host);
      gsGegenprobeRender({ urteil: 'bestaetigt', vertrauen: 90, dagegen: [], dafuer: ['Knoblauchgeruch'], verzehr: 'ja' }, { name: 'Bärlauch' });
      const t = host.textContent || '';
      host.remove();
      if (!/dasselbe Ergebnis/.test(t)) return { ok: false, warum: 'die Übereinstimmung wird nicht genannt' };
      if (!/Ein Beweis ist es nicht/.test(t)) return { ok: false, warum: 'verkauft Einigkeit als Beweis — das ist die gefährlichste Formulierung überhaupt' };
      return { ok: true, info: 'Einigkeit genannt, aber ausdrücklich kein Beweis' };
    },
  },
  {
    name: 'Gegenprobe · scheitert der Aufruf, bleibt die Unsicherheit stehen',
    lauf: async () => {
      window._gsLastScanB64 = 'AAAA';
      window._gsLetzterScan = { name: 'Bärlauch', latin: 'Allium ursinum', edible: true, _altGefahr: 5, alternatives: [] };
      window.callVisionAI = async () => { throw new Error('Netz weg'); };
      const host = document.createElement('div'); host.id = 'gs-gegenprobe';
      document.body.appendChild(host);
      await gsScanGegenprobe();
      const t = host.textContent || '';
      const nochmals = !!host.querySelector('button');
      host.remove();
      if (/best\u00e4tigt|dasselbe Ergebnis/.test(t)) return { ok: false, warum: 'meldet Einigkeit, obwohl der Aufruf scheiterte' };
      if (!/nicht m\u00f6glich/i.test(t)) return { ok: false, warum: 'sagt nicht, dass es nicht geklappt hat' };
      if (!/im Zweifel nicht verzehren/i.test(t)) return { ok: false, warum: 'die Unsicherheit wird nicht benannt' };
      if (!nochmals) return { ok: false, warum: 'kein Weg, es nochmals zu versuchen' };
      return { ok: true, info: 'Fehlschlag benannt, Unsicherheit bleibt, Wiederholung möglich' };
    },
  },
  // ── v32.11 · Netz, Fokuszonen, Phasen, Enthüllung ────────────────────
  {
    name: 'Netz · Linien und Fokuszonen kommen aus dem echten Bild',
    lauf: async () => {
      const mach = zeichne => new Promise(res => {
        const c = document.createElement('canvas'); c.width = 260; c.height = 260;
        const g = c.getContext('2d');
        g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 260, 260);
        zeichne(g);
        const im = new Image(); im.onload = () => res(im); im.src = c.toDataURL('image/jpeg', 0.92);
      });
      const blatt = await mach(g => {
        g.fillStyle = '#3f9142';
        g.beginPath(); g.ellipse(130, 118, 80, 48, -0.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1d5c22'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(62, 172); g.lineTo(198, 66); g.stroke();
        for (let i = 1; i < 7; i++) {
          g.beginPath(); g.moveTo(62 + i * 20, 172 - i * 16); g.lineTo(62 + i * 20 + 18, 172 - i * 16 - 36); g.stroke();
        }
        g.strokeStyle = '#2c6b30'; g.lineWidth = 7;
        g.beginPath(); g.moveTo(130, 166); g.lineTo(138, 248); g.stroke();
      });
      const leer = await mach(() => {});

      const S = _gsScanStruktur(blatt, 160);
      const L = _gsScanStruktur(leer, 160);
      if (!S) return { ok: false, warum: 'keine Struktur am Blatt gefunden' };
      if (L) return { ok: false, warum: 'findet Struktur auf einer leeren Fläche — das wäre erfunden' };
      if (!S.kanten.length) return { ok: false, warum: 'Punkte ohne Verbindungen — kein Netz' };
      if (S.kanten.length % 2) return { ok: false, warum: 'ungerade Kantenliste' };
      // Jede Linie muss zwei echte Punkte verbinden, und nicht quer durchs Bild gehen.
      let lang = 0;
      for (let e = 0; e < S.kanten.length; e += 2) {
        const a1 = S.kanten[e], b1 = S.kanten[e + 1];
        if (a1 === b1) return { ok: false, warum: 'eine Linie verbindet einen Punkt mit sich selbst' };
        if (!(a1 >= 0 && a1 < S.n && b1 >= 0 && b1 < S.n)) return { ok: false, warum: 'Linie zeigt auf einen Punkt, den es nicht gibt' };
        const dx = S.px[a1] - S.px[b1], dy = S.py[a1] - S.py[b1];
        if (Math.sqrt(dx * dx + dy * dy) > 0.056) lang++;
      }
      if (lang) return { ok: false, warum: lang + ' Linien länger als die Nachbarschaft — das Netz würde quer durchs Bild gehen' };
      if (!S.fokus.length) return { ok: false, warum: 'keine Fokuszone berechnet' };
      if (S.fokus.length > 4) return { ok: false, warum: S.fokus.length + ' Fokuszonen — zu viele, das wirkt wie ein Fehler' };
      // Die Fokuszonen müssen dort liegen, wo das Blatt ist, nicht am Rand.
      const drin = S.fokus.filter(f => f.x > 0.12 && f.x < 0.88 && f.y > 0.12 && f.y < 0.95).length;
      if (drin !== S.fokus.length) return { ok: false, warum: 'Fokuszonen liegen am Bildrand statt auf der Pflanze' };
      // Und sie dürfen nicht aufeinander liegen.
      for (let i = 0; i < S.fokus.length; i++) for (let j = i + 1; j < S.fokus.length; j++) {
        if (Math.abs(S.fokus[i].x - S.fokus[j].x) < 0.1 && Math.abs(S.fokus[i].y - S.fokus[j].y) < 0.1)
          return { ok: false, warum: 'zwei Fokusringe liegen übereinander' };
      }
      return { ok: true, info: S.n + ' Knoten · ' + (S.kanten.length / 2) + ' Linien · ' + S.fokus.length + ' Fokuszonen · leere Fläche: nichts' };
    },
  },
  {
    name: 'Phasen · hängen am echten Ablauf, nicht an einem Timer',
    lauf: async () => {
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160);
      g.fillStyle = '#3f9142'; g.beginPath(); g.ellipse(80, 74, 50, 30, -0.5, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1d5c22'; g.lineWidth = 2; g.beginPath(); g.moveTo(38, 104); g.lineTo(122, 42); g.stroke();
      const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];

      window.getApiConfig = () => ({ key: 'k' });
      window.stopCamera = () => {}; window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
      window.gsScanPersistToCloud = () => Promise.resolve(true);
      window.gsAddToScanHistory = () => {}; window.gsHaptic = () => {};
      window._gsScanDHash = async () => 'h'; window._gsScanCacheGet = async () => null; window._gsScanCachePut = () => {};
      const phasen = [];
      window.callVisionAI = async () => {
        phasen.push('beimAufruf=' + window._gsScanPhase);
        await new Promise(r => setTimeout(r, 30));
        return JSON.stringify({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88,
          edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
      };
      window._gsScanPhase = 'unbekannt';
      const vorher = window._gsScanPhase;
      await analyzeImage(b64, 'image/jpeg');
      phasen.push('danach=' + window._gsScanPhase);

      if (!phasen.includes('beimAufruf=netz')) return { ok: false, warum: 'während des KI-Aufrufs lief nicht die Netz-Phase: ' + phasen.join(' | ') };
      if (!phasen.includes('danach=treffer')) return { ok: false, warum: 'nach der Antwort wurde nicht auf Treffer geschaltet: ' + phasen.join(' | ') };
      return { ok: true, info: 'vor dem Aufruf „' + vorher + '" → netz → treffer' };
    },
  },
  {
    name: 'Enthüllung · der Ring zählt hoch, die Prüfzeilen haken nacheinander ab',
    lauf: async () => {
      window._gsLastScanB64 = 'AAAA';
      showScanResult({ name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 71,
        edible: true, toxicity: 0, alternatives: [], description: 'x' });
      const el = document.getElementById('scan-result');
      const lbl = el.querySelector('.sr2-conf-ring .ring-lbl');
      if (!lbl) return { ok: false, warum: 'kein Sicherheits-Ring' };
      const start = (lbl.textContent || '').trim();
      const zeilen = [...el.querySelectorAll('.sr2-pruef-zeile')];
      if (!zeilen.length) return { ok: false, warum: 'keine Prüfzeilen' };
      // Die Zeilen laufen über CSS ein — GESTAFFELT, aber nie hinter einem
      // Timer versteckt. Geprüft wird beides: dass gestaffelt wird, und dass
      // am Ende jede Zeile wirklich sichtbar ist.
      const verzoeg = zeilen.map(z => parseFloat(getComputedStyle(z).animationDelay) || 0);
      if (new Set(verzoeg).size < Math.min(3, zeilen.length))
        return { ok: false, warum: 'alle Zeilen erscheinen gleichzeitig — keine Staffelung' };
      // Die Zeilen duerfen zu KEINEM Zeitpunkt unsichtbar sein — auch nicht
      // waehrend der Animation. Deshalb gleich messen, nicht erst am Ende.
      const sofortUnsichtbar = zeilen.filter(z => Number(getComputedStyle(z).opacity) < 0.9).length;
      await new Promise(r => setTimeout(r, 1600));
      const ende = (lbl.textContent || '').trim();
      const unsichtbar = zeilen.filter(z => Number(getComputedStyle(z).opacity) < 0.9);
      if (sofortUnsichtbar) return { ok: false, warum: sofortUnsichtbar + ' Zeilen starten unsichtbar — faellt die Animation aus, bleiben sie es' };
      if (start === ende && start !== '0%') return { ok: false, warum: 'der Ring zählt nicht hoch (blieb bei ' + start + ')' };
      if (ende !== '71%') return { ok: false, warum: 'der Ring endet bei ' + ende + ' statt 71%' };
      if (unsichtbar.length) return { ok: false, warum: unsichtbar.length + ' von ' + zeilen.length + ' Zeilen bleiben unsichtbar' };
      return { ok: true, info: start + ' → ' + ende + ' · ' + zeilen.length + ' Zeilen gestaffelt, nie unsichtbar' };
    },
  },
  // ── v32.12 · Farbmessung, Vorauswahl, S6, S7 ─────────────────────────
  {
    name: 'Farbmessung · misst, was wirklich im Bild ist',
    lauf: async () => {
      const mal = zeichne => new Promise(res => {
        const c = document.createElement('canvas'); c.width = 200; c.height = 150;
        const g = c.getContext('2d'); zeichne(g);
        const im = new Image(); im.onload = () => res(im); im.src = c.toDataURL('image/png');
      });
      // Drei Viertel Blattgrün, ein Viertel gelbe Blüte.
      const gelb = await mal(g => {
        g.fillStyle = '#3f9142'; g.fillRect(0, 0, 200, 150);
        g.fillStyle = '#f2c31a'; g.fillRect(0, 0, 200, 38);
      });
      const nurGruen = await mal(g => { g.fillStyle = '#3f9142'; g.fillRect(0, 0, 200, 150); });
      const rinde = await mal(g => { g.fillStyle = '#6b4a23'; g.fillRect(0, 0, 200, 150); });

      const f1 = gsBildFarben(gelb), f2 = gsBildFarben(nurGruen), f3 = gsBildFarben(rinde);
      if (!f1.messbar) return { ok: false, warum: 'nicht messbar' };
      if ((f1.anteile['Grün'] || 0) < 60) return { ok: false, warum: 'Grün nur ' + f1.anteile['Grün'] + ' % statt ~75' };
      if (!f1.blickfang || f1.blickfang.name !== 'Gelb')
        return { ok: false, warum: 'Blickfang ist ' + (f1.blickfang ? f1.blickfang.name : 'nichts') + ' statt Gelb' };
      if (f1.blickfang.anteil < 18) return { ok: false, warum: 'Gelb nur ' + f1.blickfang.anteil + ' % statt ~25' };
      // Gegenprobe: ein reines Blattfoto darf KEINEN Blickfang melden.
      if (f2.blickfang) return { ok: false, warum: 'meldet auf einem reinen Blattfoto einen Blickfang: ' + f2.blickfang.name };
      // Und dunkles Orange ist Rinde, nicht Blüte.
      if ((f3.anteile['Braun'] || 0) < 80) return { ok: false, warum: 'Rinde gilt als ' + JSON.stringify(f3.anteile) + ' statt Braun' };
      if (f3.blickfang) return { ok: false, warum: 'Braun wird als Blickfang gemeldet — dann ist jeder Waldboden eine Blüte' };
      return { ok: true, info: 'Grün ' + f1.anteile['Grün'] + ' % · Blickfang Gelb ' + f1.blickfang.anteil + ' % · Rinde = Braun' };
    },
  },
  {
    name: 'Farbmessung · nicht gemessen ist nicht „keine Farbe"',
    lauf: () => {
      const f = gsBildFarben(null);
      if (f.messbar) return { ok: false, warum: 'behauptet, gemessen zu haben' };
      if (f.gruen !== null) return { ok: false, warum: 'meldet einen Grünanteil von ' + f.gruen + ' ohne Messung' };
      if (f.blickfang) return { ok: false, warum: 'meldet einen Blickfang ohne Messung' };
      // Und die Regel darüber darf daraus NICHTS folgern.
      const sp = { color: 'Weiss', season: 'Apr–Jun', alt: '0–1500m' };
      if (_gsPasstFarbe(sp, f) !== null) return { ok: false, warum: 'die Farbregel urteilt über ein Bild, das sie nie gesehen hat' };
      return { ok: true, info: 'messbar=false, Regel bleibt still' };
    },
  },
  {
    name: 'S6 · Farbe: passende Blüte erfüllt, fremde Blüte meldet',
    lauf: async () => {
      const mal = zeichne => new Promise(res => {
        const c = document.createElement('canvas'); c.width = 200; c.height = 150;
        const g = c.getContext('2d'); zeichne(g);
        const im = new Image(); im.onload = () => res(im); im.src = c.toDataURL('image/png');
      });
      // Bärlauch: Artenliste sagt Weiss.
      const weiss = gsBildFarben(await mal(g => {
        g.fillStyle = '#3f9142'; g.fillRect(0, 0, 200, 150);
        g.fillStyle = '#f4f6f5'; g.fillRect(0, 0, 200, 45);      // weisse Dolde
      }));
      const gelb = gsBildFarben(await mal(g => {
        g.fillStyle = '#3f9142'; g.fillRect(0, 0, 200, 150);
        g.fillStyle = '#f2c31a'; g.fillRect(0, 0, 200, 60);      // gelb statt weiss
      }));
      const basis = () => ({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90,
        edible: true, toxic: false, toxicity: 0, alternatives: [] });

      const rGut = basis(); rGut._farben = weiss;
      const rSchlecht = basis(); rSchlecht._farben = gelb;
      const gut = _gsScanPruefwerk(rGut, null).regeln.find(x => x.id === 'farbe');
      const schlecht = _gsScanPruefwerk(rSchlecht, null).regeln.find(x => x.id === 'farbe');
      if (!gut || !schlecht) return { ok: false, warum: 'die Farbregel läuft gar nicht' };
      if (gut.zustand !== 'ok') return { ok: false, warum: 'weisse Blüte + Art „Weiss" gilt nicht als erfüllt: ' + gut.zustand + ' — ' + gut.text };
      if (schlecht.zustand !== 'warn') return { ok: false, warum: 'gelbe Blüte + Art „Weiss" meldet nichts: ' + schlecht.zustand + ' — ' + schlecht.text };
      if (!/Weiss/.test(schlecht.text)) return { ok: false, warum: 'der Vorbehalt nennt die hinterlegte Farbe nicht' };
      return { ok: true, info: 'weiss → erfüllt · gelb → „' + schlecht.text.replace(/<[^>]+>/g, '').slice(0, 60) + '"' };
    },
  },
  {
    name: 'S6 · ein reines Blattfoto sagt weder ja noch nein',
    lauf: async () => {
      const c = document.createElement('canvas'); c.width = 200; c.height = 150;
      const g = c.getContext('2d'); g.fillStyle = '#3f9142'; g.fillRect(0, 0, 200, 150);
      const im = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = c.toDataURL('image/png'); });
      const r = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, alternatives: [], _farben: gsBildFarben(im) };
      const reg = _gsScanPruefwerk(r, null).regeln.find(x => x.id === 'farbe');
      if (!reg) return { ok: false, warum: 'die Farbregel fehlt' };
      if (reg.zustand !== 'unbekannt') return { ok: false, warum: 'urteilt über ein Foto ohne Blüte: ' + reg.zustand + ' — ' + reg.text };
      if (!/Blattwerk/.test(reg.text)) return { ok: false, warum: 'sagt nicht, warum sie nichts sagen kann' };
      return { ok: true, info: reg.text.slice(0, 70) };
    },
  },
  {
    name: 'S7 · Höhenlage: im Band erfüllt, darüber gemeldet, ohne Ort still',
    lauf: () => {
      const basis = () => ({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, alternatives: [] });
      const hol = ctx => { const r = basis(); r._ctx = ctx; return _gsScanPruefwerk(r, null).regeln.find(x => x.id === 'hoehe'); };
      // Bärlauch steht mit „0–1500m" in der Liste.
      const tief = hol({ elevation: 620 });
      const hoch = hol({ elevation: 2400 });
      const ohne = hol({});
      if (!tief || !hoch || !ohne) return { ok: false, warum: 'die Höhenregel läuft gar nicht' };
      if (tief.zustand !== 'ok') return { ok: false, warum: '620 m gilt nicht als passend: ' + tief.zustand + ' — ' + tief.text };
      if (hoch.zustand !== 'warn') return { ok: false, warum: '2400 m meldet nichts: ' + hoch.zustand + ' — ' + hoch.text };
      if (ohne.zustand !== 'unbekannt') return { ok: false, warum: 'urteilt ohne Standort: ' + ohne.zustand };
      if (!/Standort/.test(ohne.text)) return { ok: false, warum: 'sagt nicht, warum sie nichts sagen kann' };
      // Die Toleranz muss greifen — knapp über dem Band ist kein Vorwurf wert.
      if (hol({ elevation: 1600 }).zustand !== 'ok') return { ok: false, warum: '1600 m (100 m über dem Band) wird bereits gemeldet — zu streng' };
      return { ok: true, info: '620 → erfüllt · 1600 → Toleranz · 2400 → Vorbehalt · ohne Ort → still' };
    },
  },
  {
    name: 'Vorauswahl · schliesst nur aus, was sich begründen lässt',
    lauf: () => {
      const v = gsScanVorauswahl({ monthNum: 1 }, null);          // nur Monat
      if (!v.messbar) return { ok: false, warum: 'nicht berechenbar, obwohl der Monat da ist' };
      if (v.gesamt !== DB.length) return { ok: false, warum: 'zählt ' + v.gesamt + ' statt ' + DB.length };
      if (v.uebrig >= v.gesamt) return { ok: false, warum: 'im Januar bleibt alles übrig — dann filtert sie nicht' };
      if (v.uebrig < 500) return { ok: false, warum: 'nur ' + v.uebrig + ' übrig — das schliesst zu viel aus' };
      if (v.kriterien.join() !== 'Monat') return { ok: false, warum: 'nennt Kriterien, die es nicht gibt: ' + v.kriterien.join() };
      // Ganzjährige Arten MÜSSEN in jedem Monat übrig bleiben.
      const ganz = DB.filter(s => /ganzj/i.test(String(s.season || '')));
      const raus = ganz.filter(s => s.id && !v.ids[s.id]);
      if (raus.length) return { ok: false, warum: raus.length + ' ganzjährige Arten fallen aus der Januar-Auswahl' };
      // Und eine Art OHNE Höhenangabe darf die Höhe nicht aussortieren.
      const ohneAlt = DB.filter(s => !_gsHoehenband(s));
      const v2 = gsScanVorauswahl({ monthNum: 1, elevation: 3000 }, null);
      const weg = ohneAlt.filter(s => s.id && v.ids[s.id] && !v2.ids[s.id]);
      if (weg.length) return { ok: false, warum: weg.length + ' Arten ohne Höhenangabe wurden auf 3000 m ausgeschlossen — „unbekannt" wirkt wie „passt nicht"' };
      return { ok: true, info: gsTsd(v.gesamt) + ' → ' + gsTsd(v.uebrig) + ' im Januar · ' + ganz.length + ' ganzjährige alle drin' };
    },
  },
  {
    // v32.43: Ein Kriterium ist nur so viel wert, wie die Artenliste dazu
    // hergibt. Bis hierher nannte der Kopf nur, WELCHE Kriterien verfügbar
    // waren — wer mit Standort scannte, durfte annehmen, die Höhe habe alle
    // 4'342 Arten geprüft. Hinterlegt ist sie bei 903.
    // **Eine Zahl ohne ihre Grundlage ist eine Behauptung.**
    name: 'Vorauswahl · sagt, auf wie viele Arten ein Kriterium anwendbar war',
    lauf: () => {
      if (typeof DB === 'undefined' || !DB || !DB.length) return { ok: false, warum: 'keine Artenliste' };
      const v = gsScanVorauswahl({ monthNum: 6, elevation: 1800 }, null);
      if (!v.hinterlegt) return { ok: false, warum: 'die Vorauswahl meldet keine Deckung (hinterlegt fehlt)' };
      const h = v.hinterlegt;
      for (const k of ['monat', 'farbe', 'hoehe']) {
        if (typeof h[k] !== 'number') return { ok: false, warum: 'hinterlegt.' + k + ' ist ' + typeof h[k] };
        if (h[k] > v.gesamt) return { ok: false, warum: 'hinterlegt.' + k + ' (' + h[k] + ') > gesamt (' + v.gesamt + ')' };
      }
      // ZWEI Schranken, nicht eine. Die erste Fassung prüfte nur nach OBEN
      // („deutlich unter der Gesamtzahl") — mit ausgebautem Mitzählen kam 0
      // heraus, und 0 ist auch deutlich unter der Gesamtzahl. Die Gegenprobe
      // blieb grün, obwohl die Reparatur entfernt war.
      // **Eine Schranke nach oben ohne eine nach unten lässt den Totalausfall
      // durch** — er sieht aus wie ein besonders gutes Ergebnis.
      for (const k of ['monat', 'farbe', 'hoehe']) {
        if (h[k] < 100)
          return { ok: false, warum: 'hinterlegt.' + k + ' = ' + h[k] + ' — gemessen sind es 2902/856/899; so wenig heisst, dass gar nicht gezählt wird' };
      }
      if (h.hoehe >= v.gesamt * 0.5)
        return { ok: false, warum: 'Höhe angeblich bei ' + h.hoehe + ' von ' + v.gesamt + ' hinterlegt — gemessen sind es rund 900' };
      // …und die Anzeige muss sie auch nennen.
      const zeile = _gsMitDeckung('Höhe', 'hoehe', v.gesamt, h);
      if (!/hinterlegt/.test(zeile) || !/\d/.test(zeile))
        return { ok: false, warum: 'die Anzeige nennt die Deckung nicht: „' + zeile + '"' };
      return { ok: true, info: 'Monat ' + h.monat + ' · Farbe ' + h.farbe + ' · Höhe ' + h.hoehe + ' von ' + v.gesamt + ' · Anzeige: „' + zeile + '"' };
    },
  },
  {
    // v32.43: Die Höhe stand bei 26 Arten im `habitat`-Text statt im Feld
    // `alt` — „Alpenweiden 1500–3000m", „…Hochstaudenfluren; bis 2500m".
    // Keine erfundene Botanik: dieselbe Angabe, nur bisher ungelesen.
    name: 'Höhenband · wird auch aus dem Lebensraum-Text gelesen',
    lauf: () => {
      if (typeof DB === 'undefined' || !DB || !DB.length) return { ok: false, warum: 'keine Artenliste' };
      // GENAUER Name: die Liste führt SIEBEN „Eisenhut"-Einträge (darunter
      // „Echter Echter Eisenhut"), und die meisten haben ein eigenes `alt`.
      // Ein `find(/Eisenhut/)` traf den falschen — der Fall meldete rot für
      // eine Reparatur, die funktioniert.
      const eisenhut = DB.find(x => x.name === 'Eisenhut (Blauer)');
      if (!eisenhut) return { ok: false, warum: 'Probe-Art „Eisenhut (Blauer)" nicht in der Liste' };
      if (String(eisenhut.alt || '').match(/\d/))
        return { ok: false, warum: 'die Probe-Art hat inzwischen ein eigenes alt — dieser Fall prüft dann nichts mehr' };
      const b = _gsHoehenband(eisenhut);
      if (!b) return { ok: false, warum: 'Eisenhut: kein Band, obwohl habitat „bis 2500m" sagt' };
      if (b.bis !== 2500) return { ok: false, warum: 'Eisenhut: Band ' + JSON.stringify(b) + ', erwartet bis 2500' };
      // Und keine Wuchshöhe als Verbreitung missdeuten.
      if (_gsHoehenbandAus('Wälder, Sträucher bis 3 m hoch', false))
        return { ok: false, warum: 'liest „bis 3 m" als Höhenverbreitung' };
      let ausText = 0;
      for (const sp of DB) if (!String(sp.alt || '').match(/\d/) && _gsHoehenband(sp)) ausText++;
      if (ausText < 20) return { ok: false, warum: 'nur ' + ausText + ' Arten aus dem Text gewonnen (gemessen 26)' };
      return { ok: true, info: ausText + ' Arten bekommen ihr Band aus dem habitat-Text (Eisenhut 0–2500m)' };
    },
  },
  {
    // v32.43: 657 Gruppen der Artenliste tragen denselben lateinischen Namen,
    // 167 davon widersprechen sich bei `tox`/`edible`. Jede Nachschlagung war
    // ein `DB.find(…)` — welche Giftstufe nach einem Scan erschien, hing an
    // der REIHENFOLGE in der Datei. Zwei Reparaturen, und dieser Fall prüft
    // beide getrennt, weil jede für sich unbemerkt zurückfallen kann:
    //   (a) LATEIN VOR DEUTSCH — der deutsche Name darf das Binomen nicht
    //       überstimmen (v32.42: 1'194 von 4'311 auf einer anderen Art)
    //   (b) `_gsArtGruppe` — ohne Latein bleibt die Vorsicht sonst in der
    //       Suchstrategie hängen statt an der Art zu haften
    // v32.45: die Gegenprüfung hat die erste Begründung von (a) widerlegt —
    // „Wacholder trifft Juniperus nana" beschrieb einen Zwischenstand meines
    // Umbaus, nicht v32.42. Die Messung (1'194) hält; die Anekdote nicht.
    // Und die Regel selbst brauchte zwei Korrekturen (die zwei nächsten
    // Fälle: Unterart, Platzhalter).
    name: 'Dubletten · bei Widerspruch gewinnt die vorsichtigere Angabe',
    lauf: () => {
      if (typeof DB === 'undefined' || !DB || !DB.length) return { ok: false, warum: 'keine Artenliste' };
      const nl = (s) => String(s || '').toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\b(ssp|subsp|var|f|agg|cv|sp|spp)\.?\b/g, ' ')
        .replace(/[×x]\s/g, ' ')
        .replace(/[^a-zäöü ]/g, ' ')
        .replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ü/g, 'u').replace(/ß/g, 'ss')
        .replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');

      // (a) Der benannte Fall: das Binomen muss den mehrdeutigen deutschen
      //     Trivialnamen schlagen. `FD0660 Wacholder` ist `Juniperus nana`.
      const w = gsMatchScanToDb('Wacholder', 'Juniperus communis');
      if (!w) return { ok: false, warum: '„Wacholder / Juniperus communis" findet gar nichts' };
      if (nl(w.lat) !== 'juniperus communis')
        return { ok: false, warum: 'der deutsche Name überstimmt das Binomen: „Wacholder / Juniperus communis" → ' + w.name + ' (' + w.lat + ')' };
      const jMax = Math.max.apply(null, DB.filter(x => nl(x.lat) === 'juniperus communis').map(x => Number(x.tox) || 0));
      if ((Number(w.tox) || 0) !== jMax)
        return { ok: false, warum: 'Juniperus communis → tox ' + (Number(w.tox) || 0) + ' statt ' + jMax };

      // (b) Ohne Latein: der exakte deutsche Name trifft EINEN harmlosen
      //     Eintrag; die Vorsicht muss trotzdem an der Art hängen.
      const roh = DB.filter(x => x && x.name && x.name.toLowerCase().trim() === 'holunder');
      if (roh.length !== 1 || (Number(roh[0].tox) || 0) !== 0)
        return { ok: false, warum: 'Probe-Art „Holunder" ist nicht mehr der eine harmlose Eintrag — dieser Fall prüft dann nichts mehr' };
      const h = gsMatchScanToDb('Holunder', '');
      const sMax = Math.max.apply(null, DB.filter(x => nl(x.lat) === 'sambucus nigra').map(x => Number(x.tox) || 0));
      if (!h || (Number(h.tox) || 0) !== sMax)
        return { ok: false, warum: '„Holunder" ohne Binomen → tox ' + (h ? (Number(h.tox) || 0) : 'kein Treffer') + ' statt ' + sMax + ' — die Vorsicht hängt an der Suchstrategie statt an der Art' };

      // (c) Und dann ALLE widersprüchlichen Gruppen, Eintrag für Eintrag.
      //     Ein benannter Fall beweist nur sich selbst.
      const g = {};
      DB.forEach(sp => { if (!sp || !sp.lat) return; const k = nl(sp.lat); if (!k || k.indexOf(' ') < 0) return; (g[k] = g[k] || []).push(sp); });
      let abfragen = 0, falsch = 0, gruppen = 0, bsp = '';
      Object.keys(g).forEach(k => {
        const a = g[k];
        if (a.length < 2) return;
        const t = new Set(a.map(x => Number(x.tox) || 0)), e = new Set(a.map(x => x.edible ? 1 : 0));
        if (t.size < 2 && e.size < 2) return;
        gruppen++;
        // v32.45: erwartet wird die Gruppe auf der STUFE der Anfrage — ein
        // Eintrag ohne Qualifier misst sich an der Art ohne Unterarten, einer
        // mit Qualifier an seiner Unterart. Gerechnet mit demselben Helfer,
        // den die App benutzt: Reparatur und Prüfung haben EINE Regel.
        a.forEach(x => {
          abfragen++;
          const stufe = _gsArtGruppe(x, x.lat);
          const mx = Math.max.apply(null, stufe.map(y => Number(y.tox) || 0));
          const hit = gsMatchScanToDb(x.name, x.lat);
          const got = hit ? (Number(hit.tox) || 0) : -1;
          if (got !== mx) { falsch++; if (!bsp) bsp = x.name + ' / ' + x.lat + ' → tox ' + got + ' statt ' + mx; }
        });
      });
      if (gruppen < 50) return { ok: false, warum: 'nur ' + gruppen + ' widersprüchliche Gruppen gefunden (gemessen 167) — der Fall misst nicht, was er behauptet' };
      if (falsch) return { ok: false, warum: falsch + ' von ' + abfragen + ' Abfragen liefern nicht die vorsichtigste Angabe, z.B. ' + bsp };
      return { ok: true, info: gruppen + ' widersprüchliche Gruppen · ' + abfragen + ' Abfragen, alle vorsichtigste Angabe' };
    },
  },
  {
    // v32.45 (aus der Gegenprüfung): `_gsNormLat` streicht var./ssp./f. —
    // damit gewann `PI427 Kleiner Perlpilz (Amanita rubescens f.
    // annulosulphurea, tox 4)` jeden Perlpilz-Scan, obwohl sein eigenes
    // lookalike-Feld ihn vom Perlpilz abgrenzt. Und „Broccoli / Brassica
    // oleracea var. italica" landete bei FD0778 „Kohl", einem Einlese-Rumpf.
    // **Eine Unterart ist nicht die Art — in beide Richtungen.**
    name: 'Unterart · entscheidet nicht über die Art, und die Art nicht über die Unterart',
    lauf: () => {
      if (typeof DB === 'undefined' || !DB || !DB.length) return { ok: false, warum: 'keine Artenliste' };
      const forma = DB.find(x => /^amanita rubescens\s+f\b/i.test(String(x.lat || '')));
      const reine = DB.filter(x => _gsNormLat(x.lat) === 'amanita rubescens' && !_gsHatQualifier(x));
      if (!forma || !reine.length) return { ok: false, warum: 'Probe-Einträge fehlen (Forma ' + !!forma + ', reine ' + reine.length + ') — der Fall prüft nichts mehr' };
      const mxReine = Math.max.apply(null, reine.map(x => Number(x.tox) || 0));
      if ((Number(forma.tox) || 0) <= mxReine) return { ok: false, warum: 'die Forma ist nicht mehr giftiger als die Art — der Fall prüft nichts mehr' };
      const h = gsMatchScanToDb('Perlpilz', 'Amanita rubescens');
      if (!h) return { ok: false, warum: 'Perlpilz nicht gefunden' };
      if (_gsHatQualifier(h)) return { ok: false, warum: '„Perlpilz / Amanita rubescens" → ' + h.name + ' (' + h.lat + ', tox ' + h.tox + ') — die Forma entscheidet über die Art' };
      if ((Number(h.tox) || 0) !== mxReine) return { ok: false, warum: 'Perlpilz → tox ' + h.tox + ' statt ' + mxReine + ' (Maximum der Art ohne Unterarten)' };
      const hf = gsMatchScanToDb(forma.name, forma.lat);
      if (!hf || _gsNormLatVoll(hf.lat) !== _gsNormLatVoll(forma.lat)) return { ok: false, warum: 'die Forma selbst abgefragt → ' + (hf ? hf.name + ' (' + hf.lat + ')' : 'nichts') };
      const br = DB.find(x => /^Broccoli$/i.test(String(x.name || '')) && /var\./i.test(String(x.lat || '')));
      if (!br) return { ok: false, warum: 'Probe-Eintrag Broccoli (var.) fehlt' };
      const hb = gsMatchScanToDb(br.name, br.lat);
      if (!hb || hb.id !== br.id) return { ok: false, warum: '„' + br.name + ' / ' + br.lat + '" → ' + (hb ? hb.id + ' ' + hb.name + ' (' + hb.lat + ')' : 'nichts') + ' statt ' + br.id };
      if (hb._unverified) return { ok: false, warum: 'Broccoli landet auf einem ungeprüften Einlese-Rumpf' };
      return { ok: true, info: 'Perlpilz → tox ' + h.tox + ' (Art), Forma → sie selbst (tox ' + forma.tox + ') · Broccoli → ' + hb.id };
    },
  },
  {
    // v32.45 (aus der Gegenprüfung): 1'383 Einlese-Einträge tragen ein
    // Platzhalter-`edible:false` und sind `_unverified`. „Nicht essbar zuerst"
    // hielt sie für vorsichtiger und zog 94 Namens-Abfragen auf solche
    // Rümpfe — 82 davon auf eine ANDERE Art. **Ein Platzhalter ist keine
    // Vorsicht.**
    name: 'Platzhalter · ein ungeprüfter Rumpf gewinnt nicht gegen einen geprüften Eintrag',
    lauf: () => {
      if (typeof DB === 'undefined' || !DB || !DB.length) return { ok: false, warum: 'keine Artenliste' };
      const h = gsMatchScanToDb('Wacholder', '');
      if (!h) return { ok: false, warum: '„Wacholder" ohne Latein findet nichts' };
      if (h._unverified) return { ok: false, warum: '„Wacholder" → ' + h.id + ' ' + h.name + ' (' + h.lat + '), ein ungeprüfter Rumpf' };
      if (_gsNormLat(h.lat) !== 'juniperus communis') return { ok: false, warum: '„Wacholder" → ' + h.name + ' (' + h.lat + ') statt Juniperus communis' };
      const mx = Math.max.apply(null, _gsArtGruppe(h, '').map(y => Number(y.tox) || 0));
      if ((Number(h.tox) || 0) !== mx) return { ok: false, warum: 'Wacholder → tox ' + h.tox + ' statt ' + mx };
      let n = 0, rumpf = 0, bsp = '';
      DB.forEach(sp => {
        if (!sp || !sp.name || sp._unverified) return;
        n++;
        const r = gsMatchScanToDb(sp.name, '');
        if (r && r._unverified) { rumpf++; if (!bsp) bsp = sp.name + ' → ' + r.id + ' ' + r.name; }
      });
      if (rumpf) return { ok: false, warum: rumpf + ' von ' + n + ' gepflegten Einträgen landen mit ihrem Namen auf einem ungeprüften Rumpf, z.B. ' + bsp + ' (vor v32.45: 94)' };
      return { ok: true, info: 'Wacholder → ' + h.id + ' tox ' + h.tox + ' · 0 von ' + n + ' gepflegten Namen auf einem Rumpf' };
    },
  },
  {
    // v32.43: Die teuerste Zahl dieser Reparatur kam erst bei der
    // Gegenprobe heraus. Jeder Eintrag mit seinem EIGENEN Namen und Binomen
    // abgefragt: in v32.42 kam bei **1'194 von 4'311** eine ANDERE Art zurück
    // — „Brennnessel / Urtica pilulifera" → Urtica dioica, „Rotbuche / Fagus
    // silvatica" → Fagus sylvatica, „Aloe Vera / Aloe barbadensis" → Aloe
    // vera. Der deutsche Name gewann, und deutsche Namen teilen sich viele
    // Arten. Ein richtiger Scan landete bei jedem vierten Eintrag auf der
    // falschen Karte. Nachher: 0.
    name: 'Selbstabfrage · jeder Eintrag findet mit eigenem Namen und Binomen seine eigene Art',
    lauf: () => {
      if (typeof DB === 'undefined' || !DB || !DB.length) return { ok: false, warum: 'keine Artenliste' };
      const nl = (x) => String(x || '').toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\b(ssp|subsp|var|f|agg|cv|sp|spp)\.?\b/g, ' ')
        .replace(/[×x]\s/g, ' ')
        .replace(/[^a-zäöü ]/g, ' ')
        .replace(/ö/g, 'o').replace(/ä/g, 'a').replace(/ü/g, 'u').replace(/ß/g, 'ss')
        .replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');
      const t0 = performance.now();
      let n = 0, kein = 0, andere = 0, gleich = 0, bsp = '';
      DB.forEach(sp => {
        if (!sp || !sp.name) return;
        const k = nl(sp.lat); if (!k || k.indexOf(' ') < 0) return;
        n++;
        const h = gsMatchScanToDb(sp.name, sp.lat);
        if (!h) { kein++; return; }
        if (nl(h.lat) === k) gleich++; else { andere++; if (!bsp) bsp = sp.name + ' / ' + sp.lat + ' → ' + h.name + ' (' + h.lat + ')'; }
      });
      const ms = Math.round(performance.now() - t0);
      // Untere Schranke, damit „nichts gefunden" nicht als „nichts falsch" durchgeht.
      if (n < 4000) return { ok: false, warum: 'nur ' + n + ' Einträge mit Binomen — der Fall misst nicht, was er behauptet' };
      if (kein) return { ok: false, warum: kein + ' Einträge finden sich selbst nicht (kein Treffer)' };
      if (andere) return { ok: false, warum: andere + ' von ' + n + ' Einträgen landen auf einer ANDEREN Art, z.B. ' + bsp + ' (v32.42: 1\'194)' };
      return { ok: true, info: n + ' Einträge, alle finden ihre eigene Art · ' + ms + ' ms' };
    },
  },
  {
    name: 'Vorauswahl · ohne Grundlage behauptet sie nichts',
    lauf: () => {
      const echt = window.DB;
      window.DB = [];
      const v = gsScanVorauswahl({ monthNum: 5 }, null);
      window.DB = echt;
      if (v.messbar) return { ok: false, warum: 'behauptet eine Vorauswahl ohne Artenliste' };
      if (v.uebrig) return { ok: false, warum: 'meldet ' + v.uebrig + ' übrige Arten aus einer leeren Liste' };
      return { ok: true, info: 'leere Liste → messbar=false, uebrig=0' };
    },
  },
  {
    name: 'Vorauswahl · die Karte nennt sie und sagt, ob die Bestimmung darunter war',
    lauf: () => {
      const bau = drin => {
        const r = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90,
          edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x',
          _ctx: { monthNum: 5 } };
        r._vorauswahl = gsScanVorauswahl({ monthNum: drin ? 5 : 11 }, null);
        showScanResult(r);
        return (document.getElementById('scan-result') || {}).textContent || '';
      };
      const ja = bau(true);
      const nein = bau(false);
      if (!/Vor der Antwort eingegrenzt/.test(ja)) return { ok: false, warum: 'die Vorauswahl steht nicht auf der Karte' };
      if (!/war darunter/.test(ja)) return { ok: false, warum: 'sagt nicht, dass die Bestimmung in der Vorauswahl lag' };
      if (!/nicht.{0,3} darunter/.test(nein)) return { ok: false, warum: 'im November wird Bärlauch nicht als ausgeschlossen gemeldet' };
      if (/undefined|NaN|\[object Object\]/.test(ja + nein)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: (ja.match(/Vor der Antwort eingegrenzt[^.]*\./) || ['?'])[0].slice(0, 80) };
    },
  },
  {
    name: 'Unabhängigkeit · Farben und Vorauswahl gehen NICHT in den Auftrag',
    lauf: async () => {
      // Der ganze Wert der beiden Schritte hängt daran. Stünde die
      // Vorauswahl im Prompt, bestätigte das Modell die eigene Vorgabe und
      // die spätere Gegenprüfung wäre ein Echo statt einer Prüfung.
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = '#3f9142'; g.fillRect(0, 0, 160, 160);
      g.fillStyle = '#f2c31a'; g.fillRect(0, 0, 160, 44);
      g.strokeStyle = '#1d5c22'; g.lineWidth = 2; g.beginPath(); g.moveTo(30, 120); g.lineTo(130, 60); g.stroke();
      const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];

      window.getApiConfig = () => ({ key: 'k' });
      window.stopCamera = () => {};
      window._gsScanDHash = async () => null;
      window._gsScanCacheGet = async () => null;
      window._gsScanCachePut = () => {};
      window.gsBuildScanContext = () => ({ month: 'Mai', season: 'Frühling', monthNum: 5, canton: 'ZH', elevation: 440 });
      let auftrag = '', ergF = '', ergV = '', tupfen = 0;
      window.callVisionAI = async (_b, _m, prompt) => {
        auftrag = String(prompt || '');
        // Beide Schritte müssen VOR dem Aufruf abgehakt sein — danach ist
        // die Liste weg, dort gemessen misst man nichts.
        ergF = (document.querySelector('#schritt-farbe .gs-s-erg') || {}).textContent || '';
        ergV = (document.querySelector('#schritt-vorab .gs-s-erg') || {}).textContent || '';
        tupfen = document.querySelectorAll('#schritt-farbe .gs-s-tupfen i').length;
        return JSON.stringify({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88,
          edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
      };
      await analyzeImage(b64, 'image/jpeg');

      if (!/Gr\u00fcn \d+ %/.test(ergF)) return { ok: false, warum: 'der Farb-Schritt zeigt beim KI-Aufruf kein Ergebnis: „' + ergF + '"' };
      if (!/\u2192/.test(ergV)) return { ok: false, warum: 'der Vorauswahl-Schritt zeigt beim KI-Aufruf kein Ergebnis: „' + ergV + '"' };
      if (!tupfen) return { ok: false, warum: 'keine Farbtupfen neben dem Ergebnis' };

      if (!auftrag) return { ok: false, warum: 'es wurde gar kein Auftrag gestellt' };
      if (/Vorauswahl|eingegrenzt|kommen in Frage/i.test(auftrag))
        return { ok: false, warum: 'die Vorauswahl steht im Auftrag — dann prüft sie nichts mehr' };
      if (/Farbanteil|Blickfang|Grün \d+ ?%|Gelb \d+ ?%/i.test(auftrag))
        return { ok: false, warum: 'die Farbmessung steht im Auftrag — dann ist sie kein unabhängiger Beleg' };
      const karte = (document.getElementById('scan-result') || {}).textContent || '';
      if (!/Vor der Antwort eingegrenzt/.test(karte))
        return { ok: false, warum: 'die Vorauswahl ist nirgends angekommen — dann prüft dieser Fall nur, dass nichts passiert' };
      return { ok: true, info: 'Auftrag sauber · vor dem Aufruf: „' + ergF.slice(0, 26) + '" / „' + ergV.slice(0, 32) + '"' };
    },
  },
  // ── v32.20 · Ohne Netz eingrenzen ────────────────────────────────────
  {
    name: 'Eingrenzen · grenzt wirklich ein, und nur mit Begründung',
    lauf: () => {
      const alle = gsEingrenzen({ monat: null, hoehe: null, farbe: '', gruppe: '' });
      if (alle.treffer.length !== DB.length) return { ok: false, warum: 'ohne jede Angabe fehlen schon Arten: ' + alle.treffer.length + ' von ' + DB.length };

      const jan = gsEingrenzen({ monat: 1, hoehe: null, farbe: '', gruppe: '' });
      if (jan.treffer.length >= DB.length) return { ok: false, warum: 'der Monat grenzt nicht ein' };
      if (jan.treffer.length < 300) return { ok: false, warum: 'nur ' + jan.treffer.length + ' im Januar — das schliesst zu viel aus' };

      // Der Kern: eine Art OHNE Höhenangabe darf durch eine Höhenangabe NIE
      // herausfallen. „Unbekannt" ist nicht „passt nicht".
      const ohneBand = DB.filter(s => !_gsHoehenband(s));
      const mitHoehe = gsEingrenzen({ monat: 1, hoehe: 3000, farbe: '', gruppe: '' });
      const drin = new Set(mitHoehe.treffer.map(s => s.id));
      const janIds = new Set(jan.treffer.map(s => s.id));
      const verloren = ohneBand.filter(s => janIds.has(s.id) && !drin.has(s.id));
      if (verloren.length) return { ok: false, warum: verloren.length + ' Arten ohne Höhenangabe fielen auf 3000 m heraus' };

      // Dasselbe für die Farbe — hier ist Ausschluss ERWÜNSCHT, weil der
      // Nutzer eine Farbe aktiv wählt; geprüft wird, dass er greift.
      const gelb = gsEingrenzen({ monat: null, hoehe: null, farbe: 'Gelb', gruppe: '' });
      if (!gelb.treffer.length) return { ok: false, warum: 'Farbe Gelb liefert nichts' };
      if (gelb.treffer.some(s => _gsFarbWorte(s).indexOf('Gelb') < 0)) return { ok: false, warum: 'eine Art ohne Gelb ist in der Gelb-Liste' };
      const gruppe = gsEingrenzen({ monat: null, hoehe: null, farbe: '', gruppe: 'pilz' });
      if (gruppe.treffer.some(s => s.cat !== 'pilz')) return { ok: false, warum: 'die Gruppen-Auswahl greift nicht' };

      return { ok: true, info: DB.length + ' → Januar ' + jan.treffer.length + ' · Gelb ' + gelb.treffer.length +
                               ' · Pilze ' + gruppe.treffer.length + ' · ' + ohneBand.length + ' ohne Höhenangabe bleiben drin' };
    },
  },
  {
    name: 'Eingrenzen · die Anzeige nennt, worauf UND worauf nicht',
    lauf: () => {
      // Ohne Standort darf die Höhe nicht benutzt werden — und die Karte muss
      // das sagen, statt eine Zahl ohne Grundlage zu zeigen.
      localStorage.removeItem('gs_user_location');
      localStorage.setItem('gs_eingrenzen', JSON.stringify({ monat: 5, farbe: '', gruppe: '', hoehe: null }));
      gsEingrenzenOeffnen();
      const t = (document.getElementById('modal-content') || {}).textContent || '';
      if (!/Das ist keine Bestimmung/.test(t)) return { ok: false, warum: 'der Hinweis fehlt — eine Liste, die wie ein Ergebnis aussieht' };
      if (!/Eingegrenzt nach/.test(t)) return { ok: false, warum: 'sagt nicht, worauf eingegrenzt wurde' };
      if (!/Nicht genutzt/.test(t)) return { ok: false, warum: 'sagt nicht, dass die Höhe fehlte — eine Zahl ohne ihre Grundlage' };
      if (!/H\u00f6henlage/.test(t) && !/Höhenlage/.test(t)) return { ok: false, warum: 'benennt die fehlende Angabe nicht' };
      if (/undefined|NaN|\[object Object\]/.test(t)) return { ok: false, warum: 'Platzhalter im Text' };
      // Und mit Standort MUSS die Höhe auftauchen.
      localStorage.setItem('gs_user_location', JSON.stringify({ lat: 46.8, lng: 8.2, elevation: 1850 }));
      localStorage.setItem('gs_eingrenzen', JSON.stringify({ monat: 5, farbe: '', gruppe: '', hoehe: null }));
      gsEingrenzenOeffnen();
      const t2 = (document.getElementById('modal-content') || {}).textContent || '';
      if (!/1850 m/.test(t2)) return { ok: false, warum: 'mit Standort wird die Höhe trotzdem nicht genutzt' };
      return { ok: true, info: 'ohne Ort: „Nicht genutzt …" · mit Ort: „Höhenlage (1850 m)"' };
    },
  },
  {
    // v32.43: Die Farb-Eingrenzung schloss 3'229 Arten aus und zählte alle in
    // EINEN Topf — 2'816 davon hatten gar keine Farbangabe. Die Liste sah
    // aus, als hätten 4'202 Arten eine ANDERE Farbe. Gefunden hat es der
    // Arten-Daten-Workflow (Blickwinkel „Verbraucher"), nicht ich.
    // **Ein Ausschluss ohne Grund muss anders aussehen als einer mit.**
    name: 'Eingrenzen · „keine Farbangabe" wird getrennt gezählt und genannt',
    lauf: () => {
      if (typeof DB === 'undefined' || !DB || !DB.length) return { ok: false, warum: 'keine Artenliste' };
      const e = gsEingrenzen({ monat: null, hoehe: null, farbe: 'Gelb', gruppe: '' });
      if (!e.raus || typeof e.raus.farbeOhne !== 'number') return { ok: false, warum: 'raus.farbeOhne fehlt — „keine Angabe" und „andere Farbe" liegen in einem Topf' };
      // Grundlinie selbst messen, nicht als feste Zahl erwarten.
      const ohne = DB.filter(sp => !_gsFarbWorte(sp).length).length;
      if (e.raus.farbeOhne !== ohne) return { ok: false, warum: 'farbeOhne = ' + e.raus.farbeOhne + ', ohne Farbangabe sind aber ' + ohne };
      if (e.raus.farbeOhne < 1000) return { ok: false, warum: 'farbeOhne = ' + e.raus.farbeOhne + ' — so wenig heisst, dass nicht gezählt wird (gemessen ~3\'400)' };
      if (e.raus.farbe + e.raus.farbeOhne + e.treffer.length !== e.gesamt)
        return { ok: false, warum: 'Treffer + andere Farbe + ohne Angabe ergibt nicht die Gesamtzahl (' + e.treffer.length + '+' + e.raus.farbe + '+' + e.raus.farbeOhne + ' ≠ ' + e.gesamt + ')' };
      // …und die Anzeige nennt es, mit Zahl. Gemessen gegen den Zustand, der
      // WIRKLICH auf dem Bildschirm steht: `_gsEgStand()` setzt ohne Monat den
      // laufenden ein — mein erster Anlauf verglich mit der Rechnung ohne
      // Monat (3'481) und die Anzeige sagte 2'602. Beides richtig, nur nicht
      // dasselbe. Die Zahl auf dem Schirm muss zur Rechnung FÜR DIESEN Schirm
      // passen, nicht zu einer anderen.
      localStorage.setItem('gs_eingrenzen', JSON.stringify({ monat: null, farbe: 'Gelb', gruppe: '', hoehe: null }));
      gsEingrenzenOeffnen();
      const t = (document.getElementById('modal-content') || {}).textContent || '';
      const eS = gsEingrenzen(_gsEgStand());
      if (!/ohne Farbangabe/.test(t)) return { ok: false, warum: 'die Anzeige sagt nicht, dass Arten ohne Angabe fehlen' };
      if (!eS.raus.farbeOhne || t.indexOf(gsTsd(eS.raus.farbeOhne)) < 0) return { ok: false, warum: 'die Anzeige nennt die Zahl nicht (erwartet ' + gsTsd(eS.raus.farbeOhne) + ')' };
      // Ohne Farbwahl darf der Satz NICHT erscheinen — sonst steht er als Dauerhinweis da.
      localStorage.setItem('gs_eingrenzen', JSON.stringify({ monat: null, farbe: '', gruppe: '', hoehe: null }));
      gsEingrenzenOeffnen();
      const t0 = (document.getElementById('modal-content') || {}).textContent || '';
      if (/ohne Farbangabe/.test(t0)) return { ok: false, warum: 'der Hinweis erscheint auch ohne Farbwahl' };
      return { ok: true, info: 'Gelb: ' + e.treffer.length + ' Treffer · ' + e.raus.farbe + ' andere Farbe · ' + gsTsd(e.raus.farbeOhne) + ' ohne Angabe · Anzeige nennt ' + gsTsd(eS.raus.farbeOhne) };
    },
  },
  {
    name: 'Aufwand · die Vorauswahl darf den Scan nicht ausbremsen',
    lauf: async () => {
      // Sie laeuft ueber alle 4'342 Arten und wird bei JEDEM Scan gerechnet.
      // Auf einem Einsteiger-Telefon ist das ungefaehr das Sechsfache dieser
      // Zahl — deshalb ein Budget, das auch dort noch nicht auffaellt.
      const c = document.createElement('canvas'); c.width = 400; c.height = 300;
      const g = c.getContext('2d');
      g.fillStyle = '#3f9142'; g.fillRect(0, 0, 400, 300);
      g.fillStyle = '#f2c31a'; g.fillRect(0, 0, 400, 80);
      const im = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = c.toDataURL('image/png'); });

      let tF = 0, tV = 0, farben = null;
      for (let i = 0; i < 5; i++) {
        let t0 = performance.now(); farben = gsBildFarben(im); tF += performance.now() - t0;
        t0 = performance.now(); gsScanVorauswahl({ monthNum: 5, elevation: 600 }, farben); tV += performance.now() - t0;
      }
      tF /= 5; tV /= 5;
      if (!farben.messbar) return { ok: false, warum: 'die Messung lief gar nicht — dann misst dieser Fall nichts' };
      if (tF > 20) return { ok: false, warum: 'Farbmessung ' + tF.toFixed(1) + ' ms (Budget 20)' };
      if (tV > 60) return { ok: false, warum: 'Vorauswahl ' + tV.toFixed(1) + ' ms über 4342 Arten (Budget 60)' };
      return { ok: true, info: 'Farben ' + tF.toFixed(1) + ' ms · Vorauswahl ' + tV.toFixed(1) + ' ms (je Mittel aus 5)' };
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
