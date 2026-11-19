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
    // v33.47. Gemessen an v33.46 mit blockiertem `data/plants.v1.js`: alle
    // sieben Regeln `unbekannt`, Stufe „Nichts spricht dagegen" — eine
    // ENTWARNUNG, obwohl nichts pruefen konnte. Der Zustand ist NUR ohne
    // Artenliste erreichbar (mit Liste liefert S1 immer ok oder warn,
    // gemessen an sieben Ergebnisformen) — also genau der Fehler, den kein
    // Pruefstand vor der Auslieferung sieht.
    name: 'P1 · Konnte KEINE Prüfung etwas sagen, ist das keine Entwarnung',
    lauf: () => {
      const res = () => ({ name: 'Grüner Knollenblätterpilz', latin: 'Amanita phalloides',
                           category: 'Pilze', confidence: 90, toxicity: 0, edible: true });
      const echt = window.DB;
      // Mit Liste: der bisherige Weg muss unveraendert bleiben.
      const mit = _gsScanPruefwerk(res(), null);
      let ohne = null, hergestellt = 0;
      try {
        window.DB = [];
        hergestellt = (window.DB && window.DB.length) === 0 ? 1 : 0;
        ohne = _gsScanPruefwerk(res(), null);
      } finally { window.DB = echt; }
      if (!hergestellt) return { ok: false, warum: 'Zustand nicht hergestellt: DB liess sich nicht leeren' };
      if (!ohne || !ohne.stufe) return { ok: false, warum: 'ohne Liste keine Stufe' };
      if (ohne.ok !== 0 || ohne.warn !== 0)
        return { ok: false, warum: 'ohne Liste unerwartet ok=' + ohne.ok + ' warn=' + ohne.warn };
      if (ohne.stufe.schl !== 'keine')
        return { ok: false, warum: 'ohne Liste Stufe „' + ohne.stufe.label + '" (' + ohne.stufe.schl + ') statt „Nicht geprüft"' };
      if (!/nicht geladen/i.test(ohne.stufe.text || ''))
        return { ok: false, warum: 'der Grund nennt die fehlende Liste nicht: „' + (ohne.stufe.text || '') + '"' };
      // Gegenrichtung: mit Liste darf sich NICHTS geaendert haben.
      if (!mit || !mit.stufe || mit.stufe.schl === 'keine')
        return { ok: false, warum: 'mit Liste faelschlich „Nicht geprüft" — der Fall unterscheidet nichts' };
      if (window.DB !== echt || !window.DB.length)
        return { ok: false, warum: 'Artenliste nicht wiederhergestellt' };
      return { ok: true, info: 'ohne Liste: 0 von ' + ohne.regeln.length + ' konnten prüfen → „' + ohne.stufe.label
        + '" · mit Liste unverändert „' + mit.stufe.label + '" (ok=' + mit.ok + ' warn=' + mit.warn + ')' };
    },
  },
  {
    // v31.90-Regel: was die Anzeige zeigt, wird aus dem gerenderten HTML
    // gelesen. Die Ueberschrift stand fest im Code und behauptete
    // „Gegengeprueft mit unserer Artenliste", auch wenn nichts gegengeprueft
    // hatte — dort, wo jemand ueber Giftigkeit liest.
    name: 'P2 · Die Karte behauptet nicht „gegengeprüft", wenn nichts geprüft werden konnte',
    lauf: () => {
      const res = () => ({ name: 'Grüner Knollenblätterpilz', latin: 'Amanita phalloides',
                           category: 'Pilze', confidence: 90, toxicity: 0, edible: true, description: 'T' });
      const kopf = () => {
        try { if (typeof switchTab === 'function') switchTab('scanner'); } catch (_) {}
        showScanResult(res());
        const el = document.getElementById('scan-result');
        const k = el && el.querySelector('.sr2-pruef .sr2-card-lbl');
        return k ? (k.textContent || '').trim() : '';
      };
      const echt = window.DB;
      const mitKopf = kopf();
      let ohneKopf = '';
      try { window.DB = []; ohneKopf = kopf(); } finally { window.DB = echt; }
      if (!mitKopf) return { ok: false, warum: 'keine Prüfkarte gerendert (Aufbau)' };
      if (!/gegengepr/i.test(mitKopf))
        return { ok: false, warum: 'mit Liste fehlt die Gegenprüf-Überschrift: „' + mitKopf + '"' };
      if (/^\s*🔍/.test(ohneKopf) || !/nicht gegengepr/i.test(ohneKopf))
        return { ok: false, warum: 'ohne Liste steht dort „' + ohneKopf + '"' };
      if (mitKopf === ohneKopf)
        return { ok: false, warum: 'beide Überschriften gleich — der Fall unterscheidet nichts' };
      return { ok: true, info: 'mit Liste „' + mitKopf.slice(0, 40) + '" · ohne Liste „' + ohneKopf.slice(0, 40) + '"' };
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
    name: 'S5b · mehrere Fotos: das schärfste zählt, Unscharfe werden genannt — und ungemessen ist kein Lob',
    lauf: () => {
      // v33.16 (Stufe 2b). Bis dahin galt „2 Fotos kombiniert" OHNE Messung
      // als „die beste Grundlage, die der Scanner kennt" — ein Lob ueber
      // Fotos, die niemand angesehen hatte.
      const basis = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, toxicity: 0, alternatives: [], _shotCount: 2 };
      const mach = q => _gsScanPruefwerk(Object.assign({}, basis), q).regeln.find(x => x.id === 'grundlage');
      const klagen = [];
      const gut = mach({ messbar: true, quality: 80, blur: 75, light: 85, warnings: [], fotos: 2, gemessen: 2, schwach: 1 });
      if (!gut || gut.zustand !== 'ok') klagen.push('bestes Foto 80 gilt als dünn');
      else if (!/2 Fotos/.test(gut.text) || !/Eines davon ist zu unscharf/.test(gut.text)) klagen.push('nennt Zahl der Fotos oder das unscharfe nicht: ' + gut.text);
      const duenn = mach({ messbar: true, quality: 30, blur: 20, light: 40, warnings: [], fotos: 2, gemessen: 2, schwach: 0 });
      if (!duenn || duenn.zustand !== 'warn') klagen.push('bestes Foto 30 gilt als brauchbar');
      else if (!/2 Fotos/.test(duenn.text)) klagen.push('Vorbehalt nennt die Zahl der Fotos nicht: ' + duenn.text);
      const ohne = mach(null);
      if (!ohne || ohne.zustand !== 'unbekannt') klagen.push('2 Fotos OHNE Messung gelten als „' + (ohne && ohne.zustand) + '" — ein Lob, keine Messung');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '80 → ok „das schärfste von 2 Fotos", 30 → Vorbehalt, ungemessen → unbekannt' };
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
  // ── v33.58 · der GETEILTE Scan-Cache ist aus ─────────────────────────
  // Gemessen an der Live-DB (10.11.2026, nur lesend): `scan_cache` ist EINE
  // Tabelle fuer alle Konten, der Schluessel ein 64-Bit-dHash aus 9×8
  // Bildpunkten, und `fn_scan_cache_put` nimmt von jedem angemeldeten Konto
  // jedes Ergebnis fuer jeden Hash an — der ERSTE Eintrag gewinnt. Ein
  // Treffer ersetzt die KI-Antwort ganz. Der Fall stellt genau das her: unter
  // dem Hash des Fotos liegt ein FREMDER Treffer, der eine essbare Art nennt.
  {
    name: 'Cache · der geteilte Scan-Cache ist aus: ein bereitliegender fremder Treffer wird nie gelesen, nichts wird hineingeschrieben, die KI wird gefragt',
    lauf: async () => {
      const c = document.createElement('canvas'); c.width = 160; c.height = 160;
      const g = c.getContext('2d');
      g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160);
      g.fillStyle = '#e8e2d0'; g.beginPath(); g.ellipse(80, 70, 46, 26, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#8a7a5a'; g.lineWidth = 3; g.beginPath(); g.moveTo(80, 96); g.lineTo(80, 150); g.stroke();
      const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
      window.getApiConfig = () => ({ key: 'k' });
      window.stopCamera = () => {};
      window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
      window.gsScanPersistToCloud = () => Promise.resolve(true);
      window.gsAddToScanHistory = () => {}; window.gsHaptic = () => {};
      window.gsBuildScanContext = () => ({ month: 'Oktober', season: 'Herbst', monthNum: 10, canton: 'ZH' });
      const z = { hash: 0, get: 0, put: 0, ki: 0 };
      window._gsScanDHash = async () => { z.hash++; return '00ff00ff00ff00ff'; };
      window._gsScanCacheGet = async () => { z.get++; return { name: 'Wiesen-Champignon', latin: 'Agaricus campestris', confidence: 97,
        edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'aus dem Cache' }; };
      window._gsScanCachePut = () => { z.put++; };
      window.callVisionAI = async () => { z.ki++; return JSON.stringify({ name: 'Grüner Knollenblätterpilz', latin: 'Amanita phalloides',
        confidence: 86, edible: false, toxic: true, toxicity: 5, alternatives: [], description: 'x' }); };
      await analyzeImage(b64, 'image/jpeg');
      const karte = (document.getElementById('scan-result') || {}).textContent || '';
      if (z.ki !== 1) return { ok: false, warum: 'die KI wurde ' + z.ki + '× gefragt statt 1× (Cache gelesen ' + z.get + '× · geschrieben ' + z.put + '×) — auf der Karte: ' + (/Champignon/.test(karte) ? 'der fremde Treffer' : 'etwas anderes') };
      if (z.get !== 0) return { ok: false, warum: 'der geteilte Cache wurde ' + z.get + '× gelesen' };
      if (z.put !== 0) return { ok: false, warum: 'in den geteilten Cache wurde ' + z.put + '× geschrieben' };
      if (/Champignon/.test(karte)) return { ok: false, warum: 'auf der Karte steht der Treffer aus dem Cache' };
      if (!/Knollenbl/.test(karte)) return { ok: false, warum: 'die Antwort der KI steht nicht auf der Karte' };
      return { ok: true, info: 'KI 1× gefragt · Cache gelesen 0× · geschrieben 0×' };
    },
  },
  // ── v33.16 · Stufe 2b: jedes Foto gemessen, der dritte Blick ─────────
  {
    name: 'Ablauf · jedes Foto gemessen: das scharfe trägt das unscharfe, keines lesbar → Rückfrage, „Trotzdem" behält beide',
    lauf: async () => {
      const scharf = (() => { const c = document.createElement('canvas'); c.width = 160; c.height = 160; const g = c.getContext('2d');
        g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160); g.fillStyle = '#3f9142'; g.beginPath(); g.ellipse(80, 74, 50, 30, -0.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1d5c22'; g.lineWidth = 2; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(10 + i * 12, 150); g.lineTo(60 + i * 8, 20); g.stroke(); }
        return c.toDataURL('image/jpeg', 0.9).split(',')[1]; })();
      const flach = (() => { const c = document.createElement('canvas'); c.width = 160; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#7a8a6a'; g.fillRect(0, 0, 160, 160); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; })();
      const qS = await gsBildQualitaetVonB64(scharf, 'image/jpeg'), qF = await gsBildQualitaetVonB64(flach, 'image/jpeg');
      // Der Fall stellt seinen Zustand HER und weist ihn nach (CLAUDE.md §7.1).
      if (!qS.messbar || gsQualitaetZuSchlecht(qS)) return { ok: false, warum: 'Prüfbild „scharf" ist selbst zu schlecht (Schärfe ' + qS.blur + ') — der Fall stellt den Zustand nicht her' };
      if (!qF.messbar || !gsQualitaetZuSchlecht(qF)) return { ok: false, warum: 'Prüfbild „flach" gilt als lesbar (Schärfe ' + qF.blur + ') — der Fall stellt den Zustand nicht her' };
      // Sperren und Netz stellen — geprüft wird der ABLAUF, nicht die KI.
      window.getApiConfig = () => ({ key: 'k' }); window.stopCamera = () => {}; window.gsResetScanner = () => {};
      window._gsScanDHash = async () => 'hash-h2'; window._gsScanCacheGet = async () => null; window._gsScanCachePut = () => {};
      window.gsBuildScanContext = () => ({ month: 'Juli', season: 'Sommer', monthNum: 7, canton: 'UR' });
      const rufe = [];
      window.callVisionAI = async (b, m, p, ex) => { rufe.push({ n: 1 + ((ex || []).length), prompt: String(p || ''), schritt: ((document.querySelector('#schritt-bild .gs-s-erg') || {}).textContent || '') }); return JSON.stringify({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' }); };
      const alt = window.showScanResult; let res = null;
      window.showScanResult = function (r) { res = r; return alt(r); };
      const klagen = [];
      const karte = () => (document.getElementById('scan-result').textContent || '').replace(/\s+/g, ' ');
      try {
        // 1 · neues Foto scharf, zusätzliches unscharf → kein Stopp, beides gemessen
        await analyzeImage(scharf, 'image/jpeg', '', [{ b64: flach, mt: 'image/jpeg' }]);
        if (rufe.length !== 1 || rufe[0].n !== 2) klagen.push('1: KI-Aufruf mit ' + (rufe[0] ? rufe[0].n : 0) + ' Fotos statt 2');
        const q1 = res && res._qual;
        if (!q1 || !q1.messbar) klagen.push('1: keine Messung im Ergebnis (der alte Mehrfach-Weg mass nichts)');
        else {
          if (q1.fotos !== 2 || q1.gemessen !== 2) klagen.push('1: fotos/gemessen = ' + q1.fotos + '/' + q1.gemessen + ' statt 2/2');
          if (q1.quality !== qS.quality) klagen.push('1: quality ' + q1.quality + ' ist nicht die des schärfsten Fotos (' + qS.quality + ')');
          if (q1.schwach !== 1) klagen.push('1: schwach = ' + q1.schwach + ' statt 1');
          if (!q1.alle || q1.alle.length !== 2 || !q1.alle[1] || q1.alle[1].blur !== qF.blur) klagen.push('1: je-Foto-Liste fehlt oder falsch: ' + JSON.stringify(q1.alle));
        }
        if (!/bestes von 2 Fotos/.test(rufe[0] ? rufe[0].prompt : '')) klagen.push('1: der Prompt nennt die Zahl der Fotos nicht');
        const t1 = karte();
        if (!/das schärfste von 2 Fotos/.test(t1) || !/Eines davon ist zu unscharf/.test(t1)) klagen.push('1: S5 auf der Karte nennt weder „schärfste von 2 Fotos" noch das unscharfe');
        // gelesen WAEHREND des KI-Aufrufs — danach ersetzt die Karte die Schrittliste
        const schritt = rufe[0] ? rufe[0].schritt : '';
        if (!/Schärfe \d+ · Licht \d+ · 2 Fotos/.test(schritt)) klagen.push('1: Schritt „Bild" nennt die 2 Fotos nicht: „' + schritt + '"');
        // 2 · beide unscharf → Rückfrage, KEIN Aufruf; „Trotzdem" behält das zweite Foto
        res = null;
        await analyzeImage(flach, 'image/jpeg', '', [{ b64: flach, mt: 'image/jpeg' }]);
        const t2 = karte();
        if (rufe.length !== 1) klagen.push('2: KI wurde trotz zwei unlesbarer Fotos gerufen');
        if (!/schwer zu lesen/.test(t2)) klagen.push('2: keine Rückfrage bei zwei unlesbaren Fotos');
        if (!/2 Fotos gemessen, keines lesbar/.test(t2)) klagen.push('2: die Rückfrage sagt nicht, dass beide gemessen wurden: „' + t2.slice(0, 160) + '"');
        gsQualTrotzdem();
        for (let i = 0; i < 60 && (rufe.length < 2 || !res); i++) await new Promise(r => setTimeout(r, 50));
        if (rufe.length !== 2 || rufe[1].n !== 2) klagen.push('2: „Trotzdem" rief die KI mit ' + (rufe[1] ? rufe[1].n : 0) + ' Fotos statt 2 — das zweite Foto ging verloren');
        const q2 = res && res._qual;
        if (!q2 || q2.fotos !== 2 || !q2.messbar) klagen.push('2: nach „Trotzdem" keine Messung über 2 Fotos: ' + JSON.stringify(q2 && { fotos: q2.fotos, messbar: q2.messbar }));
        if (!/Dünne Bildgrundlage/.test(karte())) klagen.push('2: nach „Trotzdem" fehlt der Vorbehalt „Dünne Bildgrundlage" — die Bestimmung stünde auf einer ungemessenen Grundlage');
      } finally { window.showScanResult = alt; window._gsQualExtra = null; }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'scharf+flach: 2/2 gemessen, bestes zählt (' + qS.quality + '), 1 unscharf genannt · flach+flach: Rückfrage ohne Aufruf, „Trotzdem" mit 2 Fotos und Vorbehalt' };
    },
  },
  {
    name: 'Dritter Blick · „Zweites Foto" nimmt ALLE Fotos des letzten Scans mit, wird zum dritten, endet am Deckel',
    lauf: async () => {
      const bild = (seed) => { const c = document.createElement('canvas'); c.width = 160; c.height = 160; const g = c.getContext('2d');
        g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160); g.strokeStyle = '#3f9142'; g.lineWidth = 2;
        for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo((seed * 7 + i * 11) % 160, 150); g.lineTo((seed * 13 + i * 9) % 160, 10); g.stroke(); }
        return c.toDataURL('image/jpeg', 0.9).split(',')[1]; };
      const b1 = bild(1), b2 = bild(2), b3 = bild(3), b4 = bild(4);
      window.getApiConfig = () => ({ key: 'k' }); window.stopCamera = () => {}; window.gsResetScanner = () => {};
      window._gsScanDHash = async () => 'hash-h3'; window._gsScanCacheGet = async () => null; window._gsScanCachePut = () => {};
      window.gsBuildScanContext = () => ({ month: 'Juli', season: 'Sommer', monthNum: 7, canton: 'UR' });
      const rufe = [];
      // Herbstzeitlose als „essbar" → die Prüfung widerspricht (S1): der Knopf MUSS da sein
      window.callVisionAI = async (b, m, p, ex) => { rufe.push(1 + ((ex || []).length)); return JSON.stringify({ name: 'Herbstzeitlose', latin: 'Colchicum autumnale', confidence: 94, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' }); };
      const klagen = [];
      const karte = () => document.getElementById('scan-result');
      try {
        await analyzeImage(b1, 'image/jpeg');
        if (rufe[0] !== 1) klagen.push('Scan 1 mit ' + rufe[0] + ' Fotos');
        let k = karte().querySelector('.sr2-pruef-knopf');
        if (!k || !/Zweites Foto/.test(k.textContent)) klagen.push('nach 1 Foto kein „Zweites Foto"-Knopf: ' + (k ? k.textContent : 'fehlt'));
        gsAddPhotoForRescan();
        const pr1 = window._gsRescanPrior && window._gsRescanPrior.bilder;
        if (!pr1 || pr1.length !== 1) klagen.push('Re-Scan nach 1 Foto trägt ' + (pr1 && pr1.length) + ' Fotos statt 1');
        await analyzeImage(b2, 'image/jpeg');
        if (rufe[1] !== 2) klagen.push('Scan 2 mit ' + rufe[1] + ' Fotos statt 2');
        k = karte().querySelector('.sr2-pruef-knopf');
        if (!k || !/Drittes Foto/.test(k.textContent)) klagen.push('nach 2 Fotos heisst der Knopf nicht „Drittes Foto": ' + (k ? k.textContent : 'fehlt'));
        gsAddPhotoForRescan();
        const pr2 = window._gsRescanPrior && window._gsRescanPrior.bilder;
        if (!pr2 || pr2.length !== 2) klagen.push('Re-Scan nach 2 Fotos trägt ' + (pr2 && pr2.length) + ' Fotos statt 2 — das erste Foto ging verloren');
        else if (pr2[0].b64 !== b2 || pr2[1].b64 !== b1) klagen.push('Re-Scan-Fotos in falscher Reihenfolge (neuestes zuerst erwartet)');
        await analyzeImage(b3, 'image/jpeg');
        if (rufe[2] !== 3) klagen.push('Scan 3 mit ' + rufe[2] + ' Fotos statt 3');
        const txt = (karte().textContent || '').replace(/\s+/g, ' ');
        if (karte().querySelector('.sr2-pruef-knopf') || karte().querySelector('[onclick*="gsAddPhotoForRescan"]')) klagen.push('nach 3 Fotos wird ein viertes angeboten');
        if (!/3 Fotos sind das Maximum/.test(txt)) klagen.push('am Deckel fehlt der Satz „3 Fotos sind das Maximum"');
        if (!/das schärfste von 3 Fotos/.test(txt)) klagen.push('S5 nennt „das schärfste von 3 Fotos" nicht');
        // Und selbst ein direkter vierter Anlauf bleibt bei drei Fotos
        gsAddPhotoForRescan();
        const pr4 = window._gsRescanPrior && window._gsRescanPrior.bilder;
        if (!pr4 || pr4.length !== 2) klagen.push('Re-Scan nach 3 Fotos trägt ' + (pr4 && pr4.length) + ' statt 2 (Deckel 3)');
        await analyzeImage(b4, 'image/jpeg');
        if (rufe[3] !== 3) klagen.push('Scan 4 mit ' + rufe[3] + ' Fotos statt 3 (Deckel)');
      } finally { window._gsRescanMode = false; window._gsRescanPrior = null; window._gsRescanTs = 0; }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Aufrufe mit ' + rufe.join('/') + ' Fotos · Knopf: Zweites → Drittes → Maximum-Satz' };
    },
  },
  // ── v33.20 · Der Scan kennt den Aussaatkalender ──────────────────────
  {
    name: 'Aussaatkalender · der Scan einer Kultur nennt ihr Fenster (drinnen · draussen · Ernte) mit dem Weg zum Säkalender — eine Wildart bekommt keins, season ist keins',
    lauf: () => {
      window._gsLastScanB64 = 'AAAA';
      const zeig = r => {
        showScanResult(Object.assign({ confidence: 88, toxicity: 0, edible: true, alternatives: [] }, r));
        const el = document.getElementById('scan-result');
        return { row: el.querySelector('.sr2-row-sae'), cta: el.querySelector('.sr2-sae-cta') };
      };
      const klagen = [];
      const k = (typeof _gsSaeZuPflanze === 'function') ? _gsSaeZuPflanze({ name: 'Tomate' }) : null;
      if (!k) return { ok: false, warum: 'der Fall stellt den Zustand nicht her: „Tomate" ist keine Kultur in GS_SAE_DB' };
      const t = zeig({ name: 'Tomate', latin: 'Solanum lycopersicum', season: 'Jun–Sep' });
      if (!t.row) klagen.push('Tomate: keine Aussaat-Zeile');
      else {
        const txt = (t.row.textContent || '').replace(/\s+/g, ' ');
        const mon = gsMonate(true);
        [k.indoor, k.outdoor, k.harvest].filter(a => a && a.length).forEach(a => {
          if (txt.indexOf(mon[a[0]]) < 0 || txt.indexOf(mon[a[a.length - 1]]) < 0) klagen.push('Tomate: Monate ' + mon[a[0]] + '/' + mon[a[a.length - 1]] + ' fehlen: „' + txt + '"');
        });
        if (!/drinnen vorziehen/.test(txt) || !/draussen säen/.test(txt) || !/Ernte/.test(txt)) klagen.push('Tomate: drinnen/draussen/Ernte nicht alle genannt: „' + txt + '"');
        if (!t.cta || !/openSaekalender/.test(t.cta.getAttribute('onclick') || '')) klagen.push('Tomate: kein Weg zum Säkalender');
      }
      // Gegenrichtung: Wildart mit season (Sammelsaison) → keine Zeile, kein Knopf
      const b = zeig({ name: 'Bärlauch', latin: 'Allium ursinum', season: 'Apr–Jun', habitat: 'Auenwald' });
      if (b.row || b.cta) klagen.push('Bärlauch (Wildart mit season) bekam eine Aussaat-Zeile — season ist eine Sammelsaison');
      // Der Name der KI zählt auch ohne Treffer in der Artenliste — und der Plural (Zucchini/Zucchinis)
      const z = zeig({ name: 'Zucchini', latin: 'Cucurbita pepo' });
      if (!z.row) klagen.push('Zucchini: keine Aussaat-Zeile');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Tomate: „' + (t.row.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 96) + '" · Bärlauch: keine Zeile · Zucchini: Zeile' };
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
  // ── v32.91 · Die Vorsichtsregel gilt auch im ARTENDETAIL
  // v32.43 hat sie fuer den Scanner gebaut („die Vorsicht haengt an der ART,
  // nicht an der Suchstrategie"). Der Weg Suche → Detail ging daran vorbei.
  {
    // Dieser Fall MISST die Datenlage und urteilt nicht: die Zahlen sind eine
    // Eigenschaft der Artenliste (657 mehrfach gefuehrte Arten), nicht ein
    // Fehler im Code. Ob die ANZEIGE sie aufloest, prueft D1b — ein Name, der
    // eine Pruefung verspricht, die der Fall nicht macht, waere genau der
    // Fehler, den dieses Repo den ganzen Tag jagt.
    name: 'D1 · Artendetail · Datenlage: wie viele Eintraege weichen von ihrer Art ab (Messung)',
    lauf: () => {
      if (typeof _gsArtGruppe !== 'function' || typeof _gsVorsichtigste !== 'function')
        return { ok: false, warum: 'die Vorsichts-Helfer fehlen' };
      // Eigener Massstab, nicht die zu pruefende Anzeige.
      var mitDubletten = 0, unter = [], essbarZuViel = 0;
      DB.forEach(function (sp) {
        if (!sp || !sp.lat) return;
        var g = _gsArtGruppe(sp, sp.lat);
        if (!g || g.length < 2) return;
        mitDubletten++;
        var v = _gsVorsichtigste(g);
        if (!v || v._unverified) return;
        if ((sp.tox || 0) < (v.tox || 0)) unter.push(sp.name + ' ' + sp.id + ': ' + sp.tox + ' statt ' + v.tox);
        if (!!sp.edible && !v.edible) essbarZuViel++;
      });
      if (!mitDubletten) return { ok: false, warum: 'keine Art mit Dubletten gefunden — der Fall misst nichts' };
      // Das ist die LAGE in den Daten, nicht der Fehler — die Anzeige muss sie
      // aufloesen. Der lebende Teil steht in D1b.
      return { ok: true, info: mitDubletten + ' Arten mit Dubletten · ' + unter.length + ' Eintraege mit niedrigerer Stufe · ' + essbarZuViel + ' mit „essbar" gegen die Art' };
    },
  },
  {
    name: 'D1b · Artendetail · die Karte zeigt die vorsichtigere Angabe UND sagt es — ohne Dublette sagt sie nichts',
    lauf: async () => {
      if (typeof openDetail !== 'function') return { ok: false, warum: 'openDetail fehlt' };
      var lies = function () {
        var m = document.getElementById('detail-modal') || document.getElementById('modal-content');
        return (m && m.textContent) || '';
      };
      // Den gefaehrlichsten Fall SUCHEN, nicht annehmen: der groesste
      // Unterschied zwischen Eintrag und Art.
      var schlimmster = null, delta = 0;
      DB.forEach(function (sp) {
        if (!sp || !sp.lat) return;
        var g = _gsArtGruppe(sp, sp.lat); if (!g || g.length < 2) return;
        var v = _gsVorsichtigste(g); if (!v || v._unverified) return;
        var d = (v.tox || 0) - (sp.tox || 0);
        if (d > delta) { delta = d; schlimmster = { sp: sp, v: v }; }
      });
      if (!schlimmster) return { ok: false, warum: 'kein Eintrag mit niedrigerer Stufe — der Fall misst nichts' };
      openDetail(schlimmster.sp.id);
      await new Promise(function (r) { setTimeout(r, 400); });
      var txt = lies();
      if (!txt) return { ok: false, warum: 'die Detailkarte wird nicht gerendert' };
      var f = [];
      // 1 · Die Stufe der ART steht da, nicht die des Eintrags.
      var punkte = document.querySelectorAll('#detail-modal .td, #modal-content .td');
      var aktiv = 0;
      Array.prototype.forEach.call(punkte, function (d) { if ((d.getAttribute('style') || '').indexOf('background') >= 0) aktiv++; });
      if (aktiv && aktiv - 1 !== (schlimmster.v.tox || 0))
        f.push('die Skala zeigt Stufe ' + (aktiv - 1) + ', die Art ist ' + schlimmster.v.tox);
      // 2 · Und die Karte SAGT, dass korrigiert wurde.
      if (!/Vorsichtigere Angabe/.test(txt)) f.push('die Korrektur wird nicht genannt');
      if (!new RegExp('Giftstufe ' + schlimmster.v.tox).test(txt)) f.push('die Zahl der Art wird nicht genannt');
      try { closeModal('detail-modal'); } catch (_) {}
      await new Promise(function (r) { setTimeout(r, 250); });
      // 3 · Gegenrichtung: eine Art OHNE Dublette darf keinen Hinweis bekommen.
      var ohne = DB.find(function (sp) { if (!sp || !sp.lat) return false; var g = _gsArtGruppe(sp, sp.lat); return g && g.length === 1; });
      if (!ohne) return { ok: false, warum: 'keine Art ohne Dublette — die Gegenrichtung fehlt' };
      openDetail(ohne.id);
      await new Promise(function (r) { setTimeout(r, 400); });
      if (/Vorsichtigere Angabe/.test(lies())) f.push('„' + ohne.name + '" hat keine Dublette und bekommt trotzdem den Hinweis');
      try { closeModal('detail-modal'); } catch (_) {}
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: schlimmster.sp.name + ' ' + schlimmster.sp.id + ': ' + schlimmster.sp.tox + ' → ' + schlimmster.v.tox + ' und genannt · „' + ohne.name + '" ohne Dublette bleibt still' };
    },
  },

  {
    // v33.59 (Brett 2026-11-11-fcaf) — die Korrektur uebernahm `edible` von der
    // vorsichtigsten Fassung auch dann, wenn nur deren GIFTSTUFE hoeher war:
    // 14 Eintraege mit edible:false standen als essbar da (Stieleiche T008,
    // Echter Wermut P187 …). Eine Korrektur, die vorsichtiger sein soll, darf
    // in KEINER Angabe nachgiebiger werden. Eigener Massstab (!!sp.edible),
    // nicht gsIstEssbar — und die gewollte Richtung (essbar → nicht essbar)
    // muss bleiben, sonst waere „nie korrigieren" ebenfalls gruen.
    name: 'D1j · Die Art-Korrektur macht nie essbarer oder harmloser, als der Eintrag selbst sagt',
    lauf: () => {
      if (typeof _gsArtAnzeige !== 'function') return { ok: false, warum: '_gsArtAnzeige fehlt' };
      var essbarer = [], harmloser = [], gewollt = 0, gewolltWeg = [];
      DB.forEach(function (sp) {
        if (!sp || !sp.id) return;
        var a = _gsArtAnzeige(sp);
        if (!sp.edible && !!a.edible) essbarer.push(sp.name + ' ' + sp.id);
        if ((a.tox || 0) < (sp.tox || 0) || (!!sp.toxic && !a.toxic)) harmloser.push(sp.name + ' ' + sp.id);
        // Die gewollte Korrektur, gemessen am eigenen Massstab: Eintrag sagt
        // essbar, die vorsichtigste Fassung der Art nicht.
        if (sp.lat && sp.edible) {
          var g = _gsArtGruppe(sp, sp.lat), v = g && g.length > 1 ? _gsVorsichtigste(g) : null;
          if (v && v.id !== sp.id && !v._unverified && !v.edible) { gewollt++; if (a.edible) gewolltWeg.push(sp.name + ' ' + sp.id); }
        }
      });
      var f = [];
      if (essbarer.length) f.push(essbarer.length + ' Eintraege mit edible:false werden als essbar gezeigt: ' + essbarer.slice(0, 4).join(' · '));
      if (harmloser.length) f.push(harmloser.length + ' Eintraege werden harmloser gezeigt: ' + harmloser.slice(0, 4).join(' · '));
      if (!gewollt) f.push('keine gewollte Korrektur gefunden — die Gegenrichtung misst nichts');
      if (gewolltWeg.length) f.push(gewolltWeg.length + ' von ' + gewollt + ' gewollten Korrekturen fehlen: ' + gewolltWeg.slice(0, 3).join(' · '));
      if (f.length) return { ok: false, warum: f.join(' — ') };
      return { ok: true, info: '0 essbarer · 0 harmloser · ' + gewollt + ' Eintraege „essbar" gegen die Art bleiben nicht essbar' };
    },
  },
  {
    // v32.92 — v32.91 hat das DETAIL korrigiert und die LISTE nicht; damit war
    // „Violetter Schleierling" in der Zeile ✅ und im Detail Stufe 3. Zwei
    // Anzeigen derselben Art mit gegenteiliger Aussage.
    name: 'D1c · Trefferliste und Detail sagen dasselbe ueber dieselbe Art',
    lauf: async () => {
      var w = null, d = 0;
      DB.forEach(function (sp) {
        if (!sp || !sp.lat) return;
        var g = _gsArtGruppe(sp, sp.lat); if (!g || g.length < 2) return;
        var v = _gsVorsichtigste(g); if (!v || v._unverified) return;
        var dd = (v.tox || 0) - (sp.tox || 0);
        if (dd > d) { d = dd; w = { sp: sp, v: v }; }
      });
      if (!w) return { ok: false, warum: 'kein Eintrag mit niedrigerer Stufe — der Fall misst nichts' };
      switchTab('search');
      var inp = document.getElementById('search-input');
      if (inp) inp.value = w.sp.name;
      searchText = String(w.sp.name).toLowerCase();
      if (typeof doSearch === 'function') doSearch(); else renderList();
      await new Promise(function (r) { setTimeout(r, 900); });
      var karte = document.querySelector('[data-sid="' + w.sp.id + '"]');
      if (!karte) return { ok: false, warum: 'die Zeile fuer „' + w.sp.name + '" wird nicht gerendert — der Fall misst nichts' };
      var txt = (karte.textContent || '');
      var rand = (karte.getAttribute('style') || '');
      var f = [];
      if ((w.v.tox || 0) >= 2) {
        if (/✅/.test(txt)) f.push('die Zeile zeigt ✅, die Art ist Stufe ' + w.v.tox + ': „' + txt.replace(/\s+/g, ' ').slice(0, 60) + '"');
        if (/transparent/.test(rand)) f.push('die Zeile hat keinen Warnrand, die Art ist Stufe ' + w.v.tox);
      }
      if ((w.v.tox || 0) >= 3 && !/Giftig/.test(txt)) f.push('die Zeile nennt die Art nicht giftig, obwohl Stufe ' + w.v.tox);
      openDetail(w.sp.id);
      await new Promise(function (r) { setTimeout(r, 400); });
      var punkte = document.querySelectorAll('#detail-modal .td, #modal-content .td');
      var aktiv = 0;
      Array.prototype.forEach.call(punkte, function (x) { if ((x.getAttribute('style') || '').indexOf('background') >= 0) aktiv++; });
      if (aktiv && aktiv - 1 !== (w.v.tox || 0)) f.push('das Detail zeigt Stufe ' + (aktiv - 1) + ', die Art ist ' + w.v.tox);
      try { closeModal('detail-modal'); } catch (_) {}
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: w.sp.name + ' (Eintrag ' + w.sp.tox + ', Art ' + w.v.tox + '): Zeile „' + txt.replace(/\s+/g, ' ').slice(0, 44) + '" · Detail Stufe ' + (aktiv ? aktiv - 1 : '?') };
    },
  },

  {
    // v32.93 — die Klasse zu Ende gesucht statt angenommen. Nach v32.92 nutzten
    // Liste und Detail die Regel; fuenf weitere Anzeigen nicht. Die schwerste:
    // das QUIZ wertet seine Antwort — bei 269 Arten waere die Zahl des
    // Eintrags als „richtig" gezaehlt worden.
    name: 'D1d · Das Quiz wertet nach der ART: jede Giftfrage geht durch die Vorsichtsregel',
    lauf: async () => {
      if (typeof initQuizModal !== 'function') return { ok: false, warum: 'initQuizModal fehlt' };
      if (typeof _gsArtAnzeige !== 'function') return { ok: false, warum: '_gsArtAnzeige fehlt — die Regel ist gar nicht da' };
      var gewaehlt = null;
      var echt = window._gsArtAnzeige;
      window._gsArtAnzeige = function (sp) { var r = echt(sp); gewaehlt = sp; return r; };
      var gestellt = 0, ohneHelfer = 0, betroffen = 0, falsch = [];
      try {
        for (var i = 0; i < 400; i++) {
          gewaehlt = null;
          try { initQuizModal(); } catch (e) { return { ok: false, warum: 'initQuizModal wirft: ' + String(e).slice(0, 90) }; }
          var q = (document.getElementById('quiz-modal-question') || {}).textContent || '';
          if (!/^Wie giftig ist /.test(q)) continue;
          gestellt++;
          if (!gewaehlt) { ohneHelfer++; continue; }
          var g = _gsArtGruppe(gewaehlt, gewaehlt.lat);
          var v = (g && g.length > 1) ? _gsVorsichtigste(g) : null;
          if (!v || v._unverified || (v.tox || 0) === (gewaehlt.tox || 0)) continue;
          betroffen++;
          var el = document.querySelector('#quiz-modal-options [data-correct="1"]');
          if (!el) return { ok: false, warum: 'keine als richtig markierte Option — der Fall misst nichts' };
          var richtig = (el.textContent || '').trim();
          if (richtig.indexOf('Stufe ' + (v.tox || 0)) !== 0)
            falsch.push(gewaehlt.name + ' (' + gewaehlt.id + '): richtig waere Stufe ' + v.tox + ', gewertet „' + richtig.slice(0, 22) + '"');
        }
      } finally { window._gsArtAnzeige = echt; }
      if (!gestellt) return { ok: false, warum: 'in 400 Laeufen keine einzige Giftfrage — der Fall misst nichts' };
      if (ohneHelfer) return { ok: false, warum: ohneHelfer + ' von ' + gestellt + ' Giftfragen gehen NICHT durch die Vorsichtsregel' };
      if (falsch.length) return { ok: false, warum: falsch.length + ' falsch gewertet: ' + falsch.slice(0, 2).join(' | ') };
      return { ok: true, info: gestellt + ' Giftfragen, alle durch die Regel · ' + betroffen + ' betrafen eine Art mit abweichendem Eintrag, 0 falsch gewertet' };
    },
  },
  {
    name: 'D1e · Die Bluehkalender-Marke folgt der ART (94 Arten bekamen kein ☠️)',
    lauf: () => {
      if (typeof _gsBlMarken !== 'function') return { ok: false, warum: '_gsBlMarken fehlt' };
      var fehlt = [], geprueft = 0;
      DB.forEach(function (sp) {
        if (!sp || !sp.lat) return;
        var g = _gsArtGruppe(sp, sp.lat); if (!g || g.length < 2) return;
        var v = _gsVorsichtigste(g); if (!v || v._unverified) return;
        var sollWarnen = !!(v.toxic || (v.tox && +v.tox > 0));
        var zeigtSelbst = !!(sp.toxic || (sp.tox && +sp.tox > 0));
        if (!sollWarnen || zeigtSelbst) return;   // nur die interessanten
        geprueft++;
        if (!/gs-bl-gift/.test(String(_gsBlMarken(sp) || ''))) fehlt.push(sp.name + ' (' + sp.id + ')');
      });
      if (!geprueft) return { ok: false, warum: 'keine Art, bei der sich die Marke unterscheidet — der Fall misst nichts' };
      if (fehlt.length) return { ok: false, warum: fehlt.length + ' von ' + geprueft + ' ohne ☠️: ' + fehlt.slice(0, 3).join(', ') };
      return { ok: true, info: geprueft + ' Arten, deren Eintrag keine Warnung traegt — alle bekommen die Marke der Art' };
    },
  },

  {
    // v32.95 — die automatischen Sammlungen sind auch eine AUSSAGE. „☠️ Giftige"
    // fasste nach `sp.tox >= 4` des EINTRAGS zusammen: 22 Eintraege / 16 Arten
    // fehlten, darunter Kahler Krempling und Fruehlingslorchel. Gemessen wird,
    // was wirklich in die Sammlung GESCHRIEBEN wird — nicht die Datenlage:
    // „wie viele Eintraege widersprechen sich?" liefert dieselbe Zahl, wenn
    // die Sammlung laengst richtig einsortiert.
    name: 'D1f · Die Sammlung „Giftige" nimmt auf, was die ART giftig macht',
    lauf: async () => {
      if (typeof gsCollectionsAutoVacuum !== 'function') return { ok: false, warum: 'gsCollectionsAutoVacuum fehlt' };
      // Eine Art suchen, deren Eintrag unter 4 liegt und deren Art >= 4 ist.
      var kand = null;
      DB.forEach(function (sp) {
        if (kand || !sp || !sp.lat) return;
        var a = _gsArtAnzeige(sp);
        if (a !== sp && a._korrigiert && (a.tox || 0) >= 4 && (sp.tox || 0) < 4) kand = sp;
      });
      if (!kand) return { ok: false, warum: 'keine Art mit Eintrag < 4 und Art >= 4 — der Fall misst nichts' };

      var geschrieben = [];
      var eSb = window.sbFetch, eGather = window._gsCollGatherSourceItems,
          eReady = window._gsCollReady;
      try {
        window._gsCollReady = function () { return true; };
        window._gsCollGatherSourceItems = async function () {
          return [{ sp: kand, type: 'species', ref: kand.id, label: kand.name, emoji: '🌿' }];
        };
        window.sbFetch = async function (pfad, opts) {
          var m = (opts && opts.method) || 'GET';
          if (m === 'GET' && /user_collections\?select/.test(pfad)) return { data: [] };
          if (m === 'POST' && /\/user_collections$/.test(pfad)) {
            var b = {}; try { b = JSON.parse(opts.body); } catch (_) {}
            return { data: [{ id: 'col-' + (b.system_key || '?') }] };
          }
          if (m === 'GET' && /user_collection_items/.test(pfad)) return { data: [] };
          if (m === 'POST' && /user_collection_items/.test(pfad)) {
            var rows = []; try { rows = JSON.parse(opts.body); } catch (_) {}
            (Array.isArray(rows) ? rows : [rows]).forEach(function (r) { geschrieben.push(r); });
            return { data: rows };
          }
          return { data: [] };
        };
        window._gsVacuumRunning = false;
        await gsCollectionsAutoVacuum();
      } finally {
        window.sbFetch = eSb; window._gsCollGatherSourceItems = eGather;
        window._gsCollReady = eReady; window._gsVacuumRunning = false;
      }
      if (!geschrieben.length) return { ok: false, warum: 'die Sammlung hat gar nichts geschrieben — der Fall misst nichts' };
      var inGift = geschrieben.some(function (r) { return String(r.collection_id) === 'col-sys_giftig' && r.item_ref === kand.id; });
      if (!inGift) {
        var wohin = geschrieben.map(function (r) { return String(r.collection_id); }).join(', ');
        return { ok: false, warum: '„' + kand.name + '" (Eintrag tox ' + kand.tox + ', Art ' + (_gsArtAnzeige(kand).tox) + ') fehlt in „Giftige" — geschrieben nach: ' + wohin };
      }
      return { ok: true, info: '„' + kand.name + '" (Eintrag tox ' + kand.tox + ', Art ' + (_gsArtAnzeige(kand).tox) + ') landet in „Giftige" · ' + geschrieben.length + ' Zeile(n) geschrieben' };
    },
  },

  {
    // v32.96 — die Zahl unter „Giftig" im Lexikon fragte `tox === 2 || tox === 3`.
    // Die Untergrenze war Absicht („gering" zaehlt nicht), die Obergrenze nicht:
    // 131 Eintraege mit Stufe 4 und 5 fehlten — genau die stark giftigen und die
    // toedlichen. Gemessen wird die GERENDERTE Zahl, nicht die Rechnung.
    name: 'D1g · Die Lexikon-Zahl „Giftig" schliesst Stufe 4 und 5 ein',
    lauf: async () => {
      if (typeof renderLexikon !== 'function') return { ok: false, warum: 'renderLexikon fehlt' };
      const erwartet = DB.filter(s => s && ((typeof _gsArtAnzeige === 'function' ? _gsArtAnzeige(s) : s).tox | 0) >= 2).length;
      const toedlich = DB.filter(s => s && ((typeof _gsArtAnzeige === 'function' ? _gsArtAnzeige(s) : s).tox | 0) >= 4).length;
      if (!toedlich) return { ok: false, warum: 'keine Art mit Stufe 4+ in der Liste — der Fall misst nichts' };
      // renderLexikon GIBT das HTML ZURUECK (es haengt es nicht ein) — der erste
      // Anlauf suchte im Dokument und traf eine fremde Plakette „Giftig"; er
      // waere gruen gewesen, sobald die Zahl zufaellig gepasst haette.
      const huelle = document.createElement('div');
      huelle.innerHTML = String(renderLexikon() || '');
      const kacheln = [...huelle.querySelectorAll('div')].filter(d => /^(Giftig)$/i.test((d.textContent || '').trim()));
      if (!kacheln.length) return { ok: false, warum: 'keine Kachel „Giftig" gerendert — der Fall misst nichts' };
      const eltern = kacheln[0].parentElement;
      const zahl = parseInt(((eltern && eltern.firstElementChild && eltern.firstElementChild.textContent) || '').replace(/\D/g, ''), 10);
      if (!zahl) return { ok: false, warum: 'keine Zahl neben „Giftig" gefunden' };
      if (zahl !== erwartet) {
        const alt = DB.filter(s => s && (s.tox === 2 || s.tox === 3)).length;
        return { ok: false, warum: 'Kachel zeigt ' + zahl + ', erwartet ' + erwartet + ' (alte Regel tox 2|3 waere ' + alt + ' — ' + toedlich + ' Eintraege mit Stufe 4+ fehlten)' };
      }
      return { ok: true, info: 'Kachel „Giftig" zeigt ' + zahl + ' · davon ' + toedlich + ' mit Stufe 4 oder 5 (alte Regel tox 2|3: ' + DB.filter(s => s && (s.tox === 2 || s.tox === 3)).length + ')' };
    },
  },

  {
    // v32.96 — das Symbol IST die Beschriftung des Eintrags in der Sammlung.
    // 134 Eintraege bekamen ein anderes: die Christrose stand mit 🌿 dort
    // (Eintrag tox 3), waehrend ihre Art Stufe 5 hat.
    name: 'D1h · Das Symbol in der Sammlung kommt von der ART',
    lauf: async () => {
      if (typeof gsAddSpeciesToCollection !== 'function') return { ok: false, warum: 'gsAddSpeciesToCollection fehlt' };
      let kand = null;
      DB.forEach(sp => {
        if (kand || !sp || !sp.lat) return;
        const a = _gsArtAnzeige(sp);
        if (a !== sp && a._korrigiert && (a.tox || 0) >= 4 && (sp.tox || 0) < 4) kand = sp;
      });
      if (!kand) return { ok: false, warum: 'keine Art mit Eintrag < 4 und Art >= 4 — der Fall misst nichts' };
      let gesehen = null;
      const e = window.gsAddToCollection;
      try {
        window.gsAddToCollection = async function (typ, ref, label, emoji) { gesehen = { ref: ref, emoji: emoji }; };
        gsAddSpeciesToCollection(kand.id);
      } finally { window.gsAddToCollection = e; }
      if (!gesehen) return { ok: false, warum: 'gsAddToCollection wurde nicht gerufen — der Fall misst nichts' };
      if (gesehen.emoji !== '☠️') return { ok: false, warum: '„' + kand.name + '" (Eintrag tox ' + kand.tox + ', Art ' + _gsArtAnzeige(kand).tox + ') bekommt „' + gesehen.emoji + '" statt ☠️' };
      return { ok: true, info: '„' + kand.name + '" (Eintrag tox ' + kand.tox + ', Art ' + _gsArtAnzeige(kand).tox + ') bekommt ☠️' };
    },
  },

  {
    // v32.96 — zwei Stellen, die einen SATZ ueber die Giftigkeit sagen: die
    // Fakten-Zeile auf der Startseite und die Antwort des Offline-Chats. Beide
    // lasen den Eintrag; beim Chat kommt der Treffer aus einem NAMENS-Vergleich,
    // der bei mehrfach gefuehrten Arten irgendeinen der Eintraege trifft.
    name: 'D1i · Fakten-Zeile und Offline-Chat nennen die Stufe der ART',
    lauf: async () => {
      let kand = null;
      DB.forEach(sp => {
        if (kand || !sp || !sp.name) return;
        const a = _gsArtAnzeige(sp);
        if (a !== sp && a._korrigiert && (a.tox || 0) >= 4 && (sp.tox || 0) < 4) kand = sp;
      });
      if (!kand) return { ok: false, warum: 'keine Art mit Eintrag < 4 und Art >= 4 — der Fall misst nichts' };
      const artTox = _gsArtAnzeige(kand).tox;
      const f = [];

      // (a) Offline-Chat
      if (typeof getSmartAnswer !== 'function') f.push('getSmartAnswer fehlt');
      else {
        const antwort = String(getSmartAnswer(kand.name.toLowerCase()) || '');
        if (!antwort.includes(kand.name)) f.push('der Chat findet „' + kand.name + '" gar nicht — der Fall misst nichts');
        else {
          const stufen = ['harmlos', 'gering', 'mässig', 'giftig', 'stark giftig', 'TÖDLICH'];
          if (!antwort.includes(stufen[artTox])) f.push('Chat nennt nicht „' + stufen[artTox] + '" (Art ' + artTox + '), sondern: ' + (antwort.match(/Giftigkeitsstufe:\*\* ([^\n]+)/) || [, '(gar nichts)'])[1]);
          if (/✅ \*\*Essbar\*\*/.test(antwort) && !_gsArtAnzeige(kand).edible) f.push('Chat sagt „Essbar", die Art nicht');
        }
      }

      // (b) Fakten-Zeile: die 60 gezogenen Zeilen duerfen fuer eine Art mit
      // Stufe 4+ nie die harmlose Variante zeigen.
      if (typeof gsInitDynamicFacts !== 'function') f.push('gsInitDynamicFacts fehlt');
      else {
        gsInitDynamicFacts();
        const zeilen = Array.isArray(window._dynF) ? window._dynF : [];
        if (!zeilen.length) f.push('keine Fakten-Zeilen erzeugt — der Fall misst nichts');
        else {
          let falsch = [];
          zeilen.forEach(z => {
            const m = String(z).match(/<strong>([^<]+)<\/strong>/);
            if (!m) return;
            const treffer = DB.filter(s => s && s.name === m[1]);
            if (!treffer.length) return;
            // Zeigt die Zeile die Warnung? Dann ist sie richtig.
            const warnt = /stark giftig/.test(z);
            const artStufe = Math.max.apply(null, treffer.map(s => _gsArtAnzeige(s).tox | 0));
            if (artStufe >= 4 && !warnt) falsch.push(m[1] + ' (Art ' + artStufe + ')');
          });
          if (falsch.length) f.push(falsch.length + ' Fakten-Zeile(n) ohne Warnung, obwohl die Art Stufe 4+ hat: ' + falsch.slice(0, 4).join(', '));
        }
      }

      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '„' + kand.name + '" (Eintrag ' + (kand.tox | 0) + ', Art ' + artTox + ') · Chat nennt die Stufe der Art · ' + (window._dynF || []).length + ' Fakten-Zeilen, keine ohne Warnung' };
    },
  },

  {
    // v32.98 — der Text mit dem hoechsten Einsatz in dieser App. Das alte
    // Muster (/vergift|notfall|essen.*kind|kind.*essen|gegessen.*giftig|
    // giftig.*gegessen/) griff bei 4 von 17 realistischen Saetzen; „meine
    // Tochter hat Beeren gegessen" bekam eine Pflanzenbeschreibung.
    // Gemessen werden BEIDE Richtungen: ein Notfall MUSS die Nummer bringen,
    // und eine harmlose Frage darf sie NICHT bringen — sonst lernt man, das
    // Banner zu ueberlesen (dieselbe Lehre wie die vier Falschmeldungen in v32.21).
    name: 'N1 · Der Offline-Chat erkennt einen Vergiftungs-Notfall — und ruft ihn nicht bei jeder Essensfrage aus',
    lauf: async () => {
      if (typeof getSmartAnswer !== 'function') return { ok: false, warum: 'getSmartAnswer fehlt' };
      const DRINGEND = ['mein kind hat eine beere gegessen', 'meine tochter hat beeren gegessen',
        'mein sohn hat pilze gegessen', 'mein hund hat davon gefressen',
        'die katze hat an der pflanze geknabbert', 'ich habe aus versehen davon probiert',
        'wir haben pilze gegessen und mir ist schlecht', 'meine kleine hat blätter in den mund genommen',
        'baby hat erde und blätter gegessen', 'mir ist übel nach dem pilzessen', 'erbrechen nach beeren',
        'kind hat maiglöckchen gegessen', 'hilfe pflanze gegessen', 'vergiftung', 'notfall',
        'bauchschmerzen nach dem beeren sammeln', 'was tun wenn man giftige beeren isst',
        // v32.99 — der Offline-Chat ist der Rueckfall fuer JEDEN ohne Schluessel
        // und fragt die Sprache nirgends ab. Mit dem deutschen Vokabular: 0 von 12.
        'ma fille a mangé des baies', 'mon fils a mangé un champignon',
        'mon chien a mangé cette plante', 'empoisonnement', 'au secours il a avalé une baie',
        'mia figlia ha mangiato delle bacche', 'mio figlio ha mangiato un fungo', 'avvelenamento',
        'my daughter ate berries', 'my son ate a mushroom', 'poisoning', 'my dog ate this plant',
        // v33.59 (Brett 2026-11-11-df0b) — Spanisch ist die fuenfte App-Sprache;
        // mit dem Vokabular aus v32.99: 0 von 8. So geschrieben, wie Menschen
        // schreiben: mit und ohne Akzent, mit ¿ ¡ und Tippfehlern.
        'mi hija ha comido bayas', 'mi hijo se comió una seta', 'mi hijo se comio una seta',
        'mi perro ha comido una planta venenosa', 'envenenamiento por setas', 'intoxicación',
        'intoxicacion', '¡ayuda! mi bebé se tragó una hoja', 'el gato ha mordido la planta',
        'vomitos despues de comer setas', 'tengo náuseas después de comer bayas',
        'qué hago, mi niño se comió una baya', 'por error comí unas bayas', 'urgencia: mi niña ha ingerido una seta',
        // v33.61 (Hauptfunktionen, df0b): drei weitere aus der eigenen Auswahl.
        'mi hijo ha comido una seta', 'ayuda mi bebé ha tragado una baya', 'tengo náuseas después de comer setas'];
      const HARMLOS = ['kann man löwenzahn essen', 'ist bärlauch essbar', 'welche pilze sind essbar',
        'darf man brennnessel essen', 'wie schmeckt giersch', 'wann kann ich tomaten ernten',
        'ist die pflanze giftig', 'wie giftig ist der efeu', 'welche beeren sind essbar',
        'rezept mit bärlauch', 'wann blüht der holunder', 'wie pflege ich basilikum',
        'ist maiglöckchen giftig', 'giftige pflanzen im garten', 'was ist essbar im wald',
        'quand fleurit le sureau', 'quali funghi sono commestibili', 'which berries are edible',
        '¿se puede comer el diente de león?', '¿qué setas son comestibles?', '¿es venenosa la hiedra?', 'cuándo florece el saúco',
        // Scharfe Kante: `\bcat\b` traefe auch „catégorie" — in JS ist „é" kein
        // Wortzeichen, die Grenze sitzt mitten im Wort. Die Nachschau haelt es.
        'dans quelle catégorie ranger cette plante',
        // v33.59 — Spanisch, harmlos: Essens- und Giftfragen ohne Verzehr.
        '¿se puede comer el diente de león?', 'se puede comer el diente de leon', '¿es venenosa la hiedra?',
        'receta de ortigas', '¿qué setas son comestibles?', '¿cuándo florece el saúco?',
        '¿es tóxica esta planta para gatos?', 'cómo cuidar la albahaca', 'plantas venenosas del jardín',
        'categoría de esta planta',
        // Gegenpruefung t1: „come" ist italienisch „wie", englisch „komm";
        // „marea" ist die Gezeit. Die erste Fassung meldete alle drei als Notfall.
        'aiuto, come si pianta il basilico?', 'aiuto! come curare la mia pianta',
        'help, come look at my plant', 'qué plantas crecen cerca de la marea'];
      // v33.59 — die mittlere Stufe: blosser Verzehr ohne Kind/Tier/Symptom ist
      // ein HINWEIS (eine Zeile), kein Notfall — in jeder Sprache.
      const HINWEIS = ['ich habe gestern bärlauch gegessen', 'he comido ortigas ayer', 'ayer comí diente de león',
        'hemos comido setas del bosque', 'comí bayas de saúco cocidas', 'he probado las hojas de ajo de oso',
        'mi madre ha comido verdolaga', 'ayer comimos moras del bosque', 'me tragué una semilla de manzana'];
      // scan_check fuehrt seine Faelle IN der Seite aus (p.evaluate ueber den
      // Funktionsrumpf) — getSmartAnswer ist hier direkt greifbar, ein
      // verschachteltes evaluate waere ein ReferenceError.
      const nimm = q => String(getSmartAnswer(q) || '');
      const r = {
        d: DRINGEND.map(q => ({ q, a: nimm(q) })).filter(x => !/SOFORT Tox Info Suisse/.test(x.a)).map(x => x.q),
        h: HARMLOS.map(q => ({ q, a: nimm(q) })).filter(x => /Tox Info Suisse/.test(x.a)).map(x => x.q),
        w: HINWEIS.map(q => ({ q, a: nimm(q) })).filter(x => /SOFORT Tox Info Suisse/.test(x.a) || !/Tox Info Suisse 145/.test(x.a)).map(x => x.q),
        probe: nimm('vergiftung').slice(0, 30),
      };
      if (!/SOFORT Tox Info Suisse/.test(r.probe)) return { ok: false, warum: 'selbst „vergiftung" bringt die Nummer nicht — der Fall misst nichts' };
      const f = [];
      if (r.d.length) f.push(r.d.length + ' von ' + DRINGEND.length + ' Notfall-Sätzen OHNE die Nummer: „' + r.d.slice(0, 3).join('" · „') + '"');
      if (r.h.length) f.push(r.h.length + ' harmlose Frage(n) MIT Notfall-Text: „' + r.h.slice(0, 3).join('" · „') + '"');
      if (r.w.length) f.push(r.w.length + ' von ' + HINWEIS.length + ' Verzehr-Sätzen ohne die ruhige Hinweiszeile (oder als Notfall): „' + r.w.slice(0, 3).join('" · „') + '"');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: DRINGEND.length + ' Notfall-Sätze bringen die 145 · ' + HINWEIS.length + ' Verzehr-Sätze die Hinweiszeile · ' + HARMLOS.length + ' harmlose Fragen bleiben ohne' };
    },
  },

  // ── v33.61 · Paket „Sicherheit der vier Hauptfunktionen" ───────────────
  {
    name: 'D1j · Die Art-Korrektur macht keinen Eintrag ESSBARER, als er selbst sagt (brett fcaf)',
    lauf: () => {
      var mehr = [], weniger = 0;
      DB.forEach(function (sp) {
        var a = _gsArtAnzeige(sp);
        if (!sp.edible && a.edible) mehr.push(sp.id + ' ' + sp.name);
        if (sp.edible && !a.edible) weniger++;
      });
      if (mehr.length) return { ok: false, warum: mehr.length + ' Eintraege werden durch die Korrektur essbar: ' + mehr.slice(0, 3).join(' · ') };
      if (!weniger) return { ok: false, warum: 'die Korrektur nimmt nirgends ein „essbar" weg — der Fall misst nichts' };
      return { ok: true, info: '0 werden essbarer · ' + weniger + ' verlieren „essbar" (gewollt)' };
    },
  },
  {
    name: 'F1 · Die Filter „Essbar", „Giftig", „Ungiftig" fragen die ART — und „Ungiftig" nimmt keinen ungeprueften Eintrag',
    lauf: () => {
      var vorher = currentFilter, f = [];
      var com = { id: 'COM_f1', name: 'Zzz Ungeprueft', lat: 'Ignota ignota', cat: 'wildpflanze', edible: true, toxic: false, tox: null, _community: true, _unverified: true };
      DB.push(com);
      try {
        var roh = { essbar: 0, ungiftig: 0, giftig: 0 };
        currentFilter = 'essbar';
        DB.forEach(function (sp) { var a = _gsArtAnzeige(sp); if (_gsPassCat(sp) && (!a.edible || sp._unverified)) f.push('Essbar zeigt ' + sp.name); if (sp.edible && !_gsPassCat(sp)) roh.essbar++; });
        currentFilter = 'ungiftig';
        DB.forEach(function (sp) { var a = _gsArtAnzeige(sp); if (_gsPassCat(sp) && (a.toxic || a.tox > 0 || sp._unverified)) f.push('Ungiftig zeigt ' + sp.name + ' (Art tox ' + a.tox + ')'); if (!(sp.toxic || sp.tox > 0) && !_gsPassCat(sp)) roh.ungiftig++; });
        currentFilter = 'giftig';
        DB.forEach(function (sp) { var a = _gsArtAnzeige(sp); if (a.tox >= 3 && !_gsPassCat(sp)) f.push('Giftig laesst ' + sp.name + ' aus (Art tox ' + a.tox + ')'); if (!sp.toxic && _gsPassCat(sp)) roh.giftig++; });
      } finally { currentFilter = vorher; var i = DB.indexOf(com); if (i >= 0) DB.splice(i, 1); }
      if (f.length) return { ok: false, warum: f.length + ' Abweichungen: ' + f.slice(0, 3).join(' · ') };
      if (!roh.essbar || !roh.ungiftig) return { ok: false, warum: 'Art und Eintrag liefern dieselben Listen — der Fall misst nichts: ' + JSON.stringify(roh) };
      return { ok: true, info: 'gegen den Roheintrag: ' + roh.essbar + ' weniger unter Essbar · ' + roh.ungiftig + ' weniger unter Ungiftig · ' + roh.giftig + ' mehr unter Giftig' };
    },
  },
  {
    name: 'F2 · Die Menue-Eintraege „Giftige / Essbare Pflanzen / Heilpflanzen" setzen den FILTER statt ein Wort zu suchen',
    lauf: async () => {
      var eintraege = MENU_ITEMS.filter(function (m) { return /Giftige Pflanzen|Essbare Pflanzen|Heilpflanzen/.test(m.label); });
      if (eintraege.length !== 3) return { ok: false, warum: eintraege.length + ' statt 3 Eintraege gefunden' };
      var schlecht = eintraege.filter(function (m) { return /search-input'\)\.value=/.test(m.action) || !/gsZeigeEigenschaft\(/.test(m.action); });
      if (schlecht.length) return { ok: false, warum: 'tippt weiter ein Wort in die Suche: ' + schlecht.map(function (m) { return m.label; }).join(', ') };
      var vorher = currentFilter;
      try {
        gsZeigeEigenschaft('giftig');
        await new Promise(function (r) { setTimeout(r, 400); });
        var inp = document.getElementById('search-input');
        // seit SUCHE-1 steht die Eigenschaft in currentProp, die Kategorie in currentFilter
        var _eig = (typeof currentProp !== 'undefined' && currentProp) ? currentProp : currentFilter;
        if (_eig !== 'giftig') return { ok: false, warum: 'Filter steht auf „' + _eig + '"' };
        if (inp && inp.value) return { ok: false, warum: 'im Suchfeld steht „' + inp.value + '"' };
        var liste = (window._lastSearchResults || []);
        if (!liste.length) return { ok: false, warum: 'die Liste ist leer' };
        var harmlos = liste.filter(function (sp) { var a = _gsArtAnzeige(sp); return !(a.toxic || a.tox >= 2); });
        if (harmlos.length) return { ok: false, warum: harmlos.length + ' nicht giftige Arten in der Liste, z.B. ' + harmlos[0].name };
        // Gegenrichtung: die alte Wortsuche haette essbare Arten gebracht.
        var alt = DB.filter(function (s) { return gsIstEssbar(s) && /giftig/i.test([s.name, s.desc, s.lookalike, s.warning].join(' ')); }).length;
        return { ok: true, info: liste.length + ' Arten, alle giftig · die Wortsuche „giftig" traefe auch ' + alt + ' essbare' };
      } finally { try { gsResetFilter(); } catch (_) {} currentFilter = vorher; }
    },
  },
  {
    // SUCHE-1, erste Haelfte. Die fuenf Menue-Eintraege der Kategorien riefen setFilter(kat, null):
    // das setzte currentFilter und starb dann an `null.classList` — VOR renderList. Die Liste blieb,
    // wie sie war, kein Knopf war markiert, und das Suchwort von vorhin galt weiter.
    name: 'SU4 · Menü „Wildpflanzen / Pilze / Kräuter / Bäume / Hauspflanzen": die Liste zeigt genau diese Kategorie, ihr Knopf ist markiert, kein Suchwort von vorhin — und nichts wirft',
    lauf: async () => {
      var eintraege = MENU_ITEMS.filter(function (m) { return m.cat && /setFilter\(|gsSucheMitFilter\(/.test(m.action); });
      if (eintraege.length < 5) return { ok: false, warum: 'nur ' + eintraege.length + ' Kategorie-Einträge im Menü — der Fall misst nichts' };
      var f = [], gesehen = [];
      var warte = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      try {
        for (var i = 0; i < eintraege.length; i++) {
          var m = eintraege[i];
          // Vorzustand: ein Suchwort und eine Eigenschaft von vorhin
          try { gsResetFilter(); } catch (_) {}
          var inp = document.getElementById('search-input');
          searchText = 'zzvorhin'; if (inp) inp.value = 'zzvorhin';
          try { gsFilter('giftig', document.querySelector('.sf-btn[data-group="prop"][onclick*="\'giftig\'"]')); } catch (_) {}
          var fehler = null;
          try { (new Function(m.action))(); } catch (e) { fehler = String(e && e.message || e); }
          await warte(250);
          var liste = window._lastSearchResults || [];
          var soll = DB.filter(function (s) { return s && s.id && s.cat === m.cat; }).length;
          var aktiv = [].slice.call(document.querySelectorAll('.sf-btn.active'));
          var kat = aktiv.filter(function (b) { return b.getAttribute('data-group') === 'cat'; });
          var eig = aktiv.filter(function (b) { return b.getAttribute('data-group') === 'prop'; });
          if (fehler) f.push(m.label + ': wirft „' + fehler + '"');
          if (liste.length !== soll) f.push(m.label + ': Liste ' + liste.length + ' statt ' + soll);
          if (kat.length !== 1 || (kat[0].getAttribute('onclick') || '').indexOf("'" + m.cat + "'") < 0) f.push(m.label + ': markiert ist „' + kat.map(function (b) { return b.textContent.trim(); }).join(', ') + '"');
          if (eig.length) f.push(m.label + ': die Eigenschaft „' + eig[0].textContent.trim() + '" bleibt markiert');
          if (searchText || (inp && inp.value)) f.push(m.label + ': das Suchwort von vorhin bleibt stehen');
          gesehen.push(m.cat + ' ' + liste.length);
        }
      } finally { try { gsResetFilter(); } catch (_) {} }
      if (f.length) return { ok: false, warum: f.slice(0, 6).join(' · ') + (f.length > 6 ? ' · +' + (f.length - 6) + ' weitere' : '') };
      return { ok: true, info: eintraege.length + ' Einträge: ' + gesehen.join(' · ') + ' — je ein Knopf markiert, Suchwort und Eigenschaft geräumt' };
    },
  },
  {
    // SUCHE-1, zweite Haelfte. gsFilter loeschte das Suchwort, und es gab nur EINEN Filterwert:
    // „Pilze" und „Giftig" standen beide markiert da, gefiltert wurde nur nach dem zuletzt
    // getippten. Und das ✕ im Suchfeld raeumte den Filter weg, liess seinen Knopf aber markiert.
    name: 'SU5 · Suche: Kategorie, Eigenschaft und Suchwort gelten ZUSAMMEN — „Pilze" + „Giftig" zeigt giftige Pilze, ein Filter löscht das Wort nicht, und was markiert ist, gilt',
    lauf: async () => {
      var f = [];
      var warte = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var knopf = function (g, w) { return document.querySelector('.sf-btn[data-group="' + g + '"][onclick*="\'' + w + '\'"]'); };
      var markiert = function () { return [].slice.call(document.querySelectorAll('.sf-btn.active[data-group]')).map(function (b) { return (/'([a-z_]*)'/.exec(b.getAttribute('onclick') || '') || [, '?'])[1] || 'alle'; }).sort().join('+'); };
      var giftig = function (s) { var a = _gsArtAnzeige(s); return !!(a.toxic || a.tox >= 2); };
      try {
        try { gsResetFilter(); } catch (_) {}
        var row = document.getElementById('sf-props-row'); if (row && row.style.display === 'none') gsTogglePropFilter();
        // 1 · Pilze, dann Giftig: beide gelten
        knopf('cat', 'pilz').click(); await warte(150);
        knopf('prop', 'giftig').click(); await warte(150);
        var l1 = window._lastSearchResults || [];
        var soll1 = DB.filter(function (s) { return s && s.id && s.cat === 'pilz' && giftig(s); }).length;
        if (l1.length !== soll1) f.push('Pilze + Giftig: ' + l1.length + ' Einträge statt ' + soll1 + (l1.some(function (s) { return s.cat !== 'pilz'; }) ? ' (auch Nicht-Pilze)' : ''));
        if (markiert() !== 'giftig+pilz') f.push('markiert: ' + markiert());
        var st = (document.getElementById('search-status') || {}).textContent || '';
        if (!/Pilze/.test(st) || !/Giftig/.test(st)) f.push('die Statuszeile nennt nicht beide Filter: „' + st + '"');
        // 2 · ein Wort dazu: der Filter bleibt, das Wort gilt mit
        doSearch('knollenbl'); await warte(250);
        var l2 = window._lastSearchResults || [];
        if (!l2.length) f.push('Pilze + Giftig + „knollenbl": leer');
        if (l2.some(function (s) { return s.cat !== 'pilz' || !giftig(s); })) f.push('mit Suchwort fallen Kategorie oder Eigenschaft weg');
        // 3 · eine Kategorie tippen löscht das Wort NICHT
        knopf('cat', 'baum').click(); await warte(150);
        var inp = document.getElementById('search-input');
        if (searchText !== 'knollenbl' || !inp || inp.value !== 'knollenbl') f.push('der Kategorie-Knopf löscht das Suchwort (jetzt „' + searchText + '")');
        if (markiert() !== 'baum+giftig') f.push('nach „Bäume" markiert: ' + markiert());
        // 4 · die Eigenschaft nochmal antippen nimmt sie weg
        knopf('prop', 'giftig').click(); await warte(150);
        if (markiert() !== 'baum') f.push('„Giftig" ein zweites Mal: markiert ' + markiert());
        // 5 · das ✕ im Suchfeld räumt das WORT — der Filter bleibt und bleibt markiert
        gsClearSearch(); await warte(150);
        var l5 = window._lastSearchResults || [];
        var soll5 = DB.filter(function (s) { return s && s.id && s.cat === 'baum'; }).length;
        if (searchText) f.push('✕ lässt das Wort stehen');
        if (markiert() !== 'baum' || l5.length !== soll5) f.push('nach ✕: markiert ' + markiert() + ', Liste ' + l5.length + ' statt ' + soll5 + ' Bäume');
        // 6 · Reset räumt alles
        gsResetFilter(); await warte(150);
        if ((window._lastSearchResults || []).length !== DB.filter(function (s) { return s && s.id; }).length || markiert() !== 'alle') f.push('Reset: markiert ' + markiert() + ', Liste ' + (window._lastSearchResults || []).length);
      } finally { try { gsResetFilter(); } catch (_) {} }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Pilze + Giftig, mit Wort, Kategorie wechselt ohne das Wort zu löschen, Eigenschaft ab, ✕ räumt nur das Wort, Reset alles' };
    },
  },
  {
    // SUCHE-5. „Mehr laden" baute die Karten mit EIGENEM Code: ohne Markierung des Suchworts, mit
    // sp.id roh in einem onclick-String und einem anderen Rand-Stil — die zweite Seite sah anders
    // aus und verhielt sich anders als die erste. Der Fall rendert beide Seiten und haelt sie
    // gegeneinander; was markiert gehoert, entscheidet gsHighlight selbst.
    name: 'SU6 · „Mehr laden": die Karten der zweiten Seite sind gebaut wie die der ersten — dieselbe Form, derselbe Klick, das Suchwort markiert',
    lauf: async () => {
      var warte = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var f = [];
      try {
        gsResetFilter();
        var kandidaten = ['kraut', 'blume', 'pilz', 'wurz', 'linge', 'baum'];
        var wort = null;
        for (var i = 0; i < kandidaten.length && !wort; i++) {
          searchText = kandidaten[i];
          var r = getFiltered();
          // die zweite Seite muss Namen tragen, die das Wort enthalten
          if (r.length > 100 && r.slice(80, 160).some(function (s) { return /<mark/.test(gsHighlight(s.name, kandidaten[i])); })) wort = kandidaten[i];
        }
        searchText = '';
        if (!wort) return { ok: false, warum: 'kein Suchwort mit einer zweiten Seite voller Treffer — der Fall misst nichts' };
        doSearch(wort); await warte(300);
        var liste = document.getElementById('results-list');
        var s1 = [].slice.call(liste.querySelectorAll('.sp-card'));
        loadMoreList(); await warte(150);
        var alle = [].slice.call(liste.querySelectorAll('.sp-card'));
        var s2 = alle.slice(s1.length);
        if (!s2.length) return { ok: false, warum: '„Mehr laden" bringt keine Karten — der Fall misst nichts' };
        var form = function (k) {
          return {
            klick: k.getAttribute('onclick'),
            stil: (k.getAttribute('style') || '').replace(/#[0-9a-f]{3,8}|transparent/gi, 'F'),
            // die Plaketten haengen an der Art (zwei Karten tragen verschieden viele) — gezaehlt wird das Geruest
            bau: [].slice.call(k.querySelectorAll('*')).filter(function (x) { return x.tagName !== 'MARK' && !(x.parentElement && x.parentElement.closest('.sp-tags')); }).map(function (x) { return x.tagName + '.' + x.className; }).join('|'),
          };
        };
        var a = form(s1[0]), b = form(s2[0]);
        ['klick', 'stil', 'bau'].forEach(function (k) { if (a[k] !== b[k]) f.push(k + ': Seite 1 „' + String(a[k]).slice(0, 80) + '" · Seite 2 „' + String(b[k]).slice(0, 80) + '"'); });
        var sollMark = s2.filter(function (k) { var sp = DB.find(function (x) { return x.id === k.dataset.sid; }); return sp && /<mark/.test(gsHighlight(sp.name, wort)); });
        var ohne = sollMark.filter(function (k) { return !k.querySelector('.sp-name mark'); });
        if (ohne.length) f.push(ohne.length + ' von ' + sollMark.length + ' Karten der zweiten Seite tragen „' + wort + '" im Namen ohne Markierung');
        var knopf = liste.querySelector('[data-loadmore]');
        if (knopf && knopf.getAttribute('style')) f.push('der Knopf „weitere laden" ist auf Seite 2 anders gebaut als auf Seite 1');
      } finally { try { gsResetFilter(); } catch (_) {} }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'zweite Seite gleich gebaut, Markierung wie Seite 1' };
    },
  },
  {
    // SUCHE-10. Die Rangfolge der Artensuche hatte keinen Prüffall ausser „ein exakter Name steht
    // zuerst" (SU1). Die Regel steht in _gsSucheRang: Name genau > Namensanfang/Segmentanfang > im
    // Namen > im Binomen > in der Familie > irgendwo im Text. Ein Fehler hier sieht aus wie eine
    // schlechte Suche, nicht wie ein Fehler — niemand meldet ihn. Der Fall liest die Felder aus dem
    // Suchindex der App (gleiche Normalisierung) und prüft nur die ORDNUNG der Klassen.
    name: 'SU8 · Rangfolge der Artensuche: Name genau, dann Namensanfang, im Namen, im Binomen, in der Familie, im Text — die Klassen fallen nie wieder an',
    lauf: () => {
      if (typeof getFiltered !== 'function' || typeof _gsSearchNorm !== 'function') return { ok: false, warum: 'getFiltered oder _gsSearchNorm fehlt' };
      const vorF = currentFilter, vorS = searchText, vorP = (typeof currentProp !== 'undefined') ? currentProp : '';
      const f = [], gesehen = new Set(), info = [];
      const NAMEN = ['Name genau', 'Namensanfang', 'im Namen', 'im Binomen', 'in der Familie', 'im Text', 'sonst'];
      try {
        currentFilter = ''; if (typeof currentProp !== 'undefined') currentProp = '';
        // „solanaceae" ist (gemessen) das einzige Wort, das Familien UND bei anderen Einträgen nur den
        // Text trifft — ohne es bliebe „Familie unter Text" ungeprüft (Gegenprobe so grün geblieben).
        ['brennnessel', 'ampfer', 'salbei', 'urtica', 'rosaceae', 'solanaceae', 'kamille', 'eiche', 'minze', 'lamium'].forEach(function (wort) {
          const q = _gsSearchNorm(wort);
          // Synonyme heben einen Binomen-Treffer bewusst vor „im Namen" (620) — solche Wörter misst der Fall nicht.
          const syn = window.GS_SYNONYMS || {};
          if (syn[q] || Object.keys(syn).some((k) => k.indexOf(q) === 0)) { info.push('„' + wort + '" übersprungen (Synonym)'); return; }
          searchText = wort;
          const liste = getFiltered();
          if (!window._gsSearchIdx) { f.push('kein Suchindex'); return; }
          const idx = new Map(window._gsSearchIdx.map((e) => [e.sp, e]));
          const klasse = (sp) => {
            const e = idx.get(sp); if (!e) return 6;
            if (e.name === q) return 0;
            if (e.name.indexOf(q) === 0 || e.segs.some((x) => x.indexOf(q) === 0)) return 1;
            if (e.name.indexOf(q) >= 0) return 2;
            if (e.lat.indexOf(q) >= 0) return 3;
            if (e.fam.indexOf(q) >= 0) return 4;
            if (e.blob.indexOf(q) >= 0) return 5;
            return 6;
          };
          let vor = -1;
          for (let i = 0; i < liste.length; i++) {
            const k = klasse(liste[i]); gesehen.add(k);
            if (k < vor) { f.push('„' + wort + '": Platz ' + (i + 1) + ' „' + liste[i].name + '" (' + NAMEN[k] + ') steht hinter einem Treffer „' + NAMEN[vor] + '"'); break; }
            vor = k;
          }
          if (!liste.length) f.push('„' + wort + '" findet nichts — der Fall misst dort nichts');
        });
      } finally { currentFilter = vorF; searchText = vorS; if (typeof currentProp !== 'undefined') currentProp = vorP; }
      if (gesehen.size < 4) f.push('nur ' + gesehen.size + ' Klassen kamen vor — der Fall misst die Ordnung kaum');
      if (f.length) return { ok: false, warum: f.slice(0, 4).join(' · ') };
      return { ok: true, info: gesehen.size + ' Klassen in fallender Ordnung über 10 Wörter' + (info.length ? ' · ' + info.join(', ') : '') };
    },
  },
  {
    // SUCHE-8. Die Menü-Suche hatte einen eigenen Artenteil: `includes` auf Name, Binomen und
    // Familie — ohne Umlaut-Faltung („barlauch" fand den Bärlauch nicht), ohne Rangfolge (die ersten
    // fünf in Dateireihenfolge), ohne Vertipper, und ohne jede Giftmarkierung (die Trefferliste der
    // Suche trägt Giftrand und „Giftig"). Dazu filterte sie je Tastendruck für JEDEN der 51
    // Menüeinträge die ganze Artenliste und warf das Ergebnis weg (`dbMatch: []`).
    name: 'SU7 · Menü-Suche: der Artenteil sucht wie die Suche (Umlaute, Vertipper, Rangfolge), zeigt die Giftigkeit der Art — und filtert die Artenliste nicht mehr je Menüeintrag',
    lauf: () => {
      if (typeof searchMenu !== 'function') return { ok: false, warum: 'searchMenu gibt es nicht' };
      const inp = document.getElementById('menu-search-inp'), box = document.getElementById('menu-search-results');
      if (!inp || !box) return { ok: false, warum: 'die Menü-Suche fehlt — der Fall misst nichts' };
      const f = [];
      const tippe = (w) => { inp.value = w; inp.dispatchEvent(new Event('input', { bubbles: true })); };
      const arten = () => [].slice.call(box.querySelectorAll('[data-sid], [onclick*="openDetail"]'));
      const vorF = currentFilter, vorS = searchText, vorP = (typeof currentProp !== 'undefined') ? currentProp : '';
      const echtFilter = Array.prototype.filter;
      let dbFilter = 0;
      try {
        // 1 · Umlaute und Vertipper wie in der Suche
        [['barlauch', /Bärlauch/], ['bärlauhc', /Bärlauch/], ['loewenzahn', /Löwenzahn/]].forEach(function (p) {
          tippe(p[0]);
          const namen = arten().map((a) => a.textContent);
          if (!namen.some((t) => p[1].test(t))) f.push('„' + p[0] + '" findet im Menü ' + (namen.length ? '„' + namen[0].trim().slice(0, 30) + '"' : 'keine Art'));
        });
        // 2 · dieselbe Rangfolge: die ersten fünf Arten im Menü sind die ersten fünf der Suche (ohne
        // Filter) — auch mit einem Leerzeichen am Ende und mit zwei Wörtern. Gegnerische Prüfung
        // (16.11.2026): das Menü gab die Eingabe ungetrimmt weiter; bei „giersch " stand der
        // Pfifferling vorn, bei „bärlauch " das Maiglöckchen (Stufe 5) auf Platz 3.
        ['giersch', 'giersch ', 'bärlauch ', 'giersch wald'].forEach(function (w) {
          tippe(w);
          currentFilter = ''; searchText = w.trim(); if (typeof currentProp !== 'undefined') currentProp = '';
          const suche = getFiltered().slice(0, 5).map((x) => x.name);
          const menue = arten().slice(0, 5).map((z) => z.textContent);
          if (!suche.length || !menue.length) { f.push('„' + w + '": keine Art im Menü oder in der Suche'); return; }
          for (let i = 0; i < suche.length; i++) {
            if (!menue[i] || menue[i].indexOf(suche[i]) < 0) { f.push('„' + w + '": Platz ' + (i + 1) + ' im Menü „' + String(menue[i] || '–').trim().slice(0, 30) + '", in der Suche „' + suche[i] + '"'); break; }
          }
        });
        // 2b · ein Menüwort sucht das Menü: stehen Menüeinträge da, kommt keine Art über einen Vertipper
        //      oder den Beschreibungstext (gegnerische Prüfung: „wetter" → Fetter Gänsefuss)
        const falte = (x) => String(x || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
        ['wetter', 'quiz', 'premium'].forEach(function (w) {
          tippe(w);
          const menue = box.querySelectorAll('.menu-search-result:not([data-sid])').length;
          if (!menue) { f.push('„' + w + '": kein Menüeintrag — der Fall misst die Regel nicht'); return; }
          const fremd = arten().filter((z) => falte(z.textContent).indexOf(falte(w)) < 0);
          if (fremd.length) f.push('„' + w + '" zeigt neben ' + menue + ' Menüeinträgen die Art „' + fremd[0].textContent.trim().slice(0, 30) + '"');
        });
        // 3 · eine giftige Art sagt es — die Angabe der ART (_gsArtAnzeige), wie die Trefferliste
        tippe('schierling');
        const zeilen = arten();
        const gift = zeilen.filter((z) => { const sp = DB.find((s) => s && String(s.id) === String(z.getAttribute('data-sid') || (/openDetail\('([^']+)'/.exec(z.getAttribute('onclick') || '') || [])[1])); return sp && (_gsArtAnzeige(sp).tox || 0) >= 3; });
        if (!gift.length) f.push('„schierling" findet im Menü keine giftige Art — der Fall misst die Markierung nicht');
        gift.forEach((z) => { if (!/Giftig/i.test(z.textContent)) f.push('„' + z.textContent.trim().slice(0, 30) + '" steht ohne „Giftig" im Menü'); });
        // 4 · je Tastendruck höchstens ein Durchlauf über die Artenliste
        Array.prototype.filter = function () { if (this === DB) dbFilter++; return echtFilter.apply(this, arguments); };
        tippe('rose');
        Array.prototype.filter = echtFilter;
        if (dbFilter > 1) f.push('ein Tastendruck filtert die Artenliste ' + dbFilter + '×');
      } finally {
        Array.prototype.filter = echtFilter;
        currentFilter = vorF; searchText = vorS; if (typeof currentProp !== 'undefined') currentProp = vorP;
        try { if (typeof clearMenuSearch === 'function') clearMenuSearch(); } catch (_) {}
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Umlaute und Vertipper wie die Suche · dieselben ersten fünf (auch „giersch ", „bärlauch ", „giersch wald") · „Giftig" an giftigen Arten · ' + dbFilter + '× Artenliste je Tastendruck' };
    },
  },
  {
    name: 'SC1 · Der Scan-Chat hat Linas Schutz: Notfallnummer sofort, Warnzeile ueber einer Essbar-Zusage zu einer Giftart',
    lauf: async () => {
      var gift = DB.find(function (s) { return s.tox >= 5 && s.lat && _gsArtenTreffer(s.name + ' ' + s.lat).zahl; });
      if (!gift) return { ok: false, warum: 'keine Art mit Stufe 5 gefunden' };
      var zusage = 'Ja, den kannst du essen, er ist ein guter Speisepilz.';
      var soll = _gsLinaSicherheit(zusage, _gsArtenTreffer(gift.name + ' ' + gift.lat));
      if (!soll) return { ok: false, warum: 'die Sicherung selbst schlaegt bei „' + gift.name + '" nicht an — der Fall misst nichts' };
      var echtAI = callAI, echtKi = gsKiVerfuegbar, echtScan = _lastScanResult, rufe = 0;
      callAI = async function () { rufe++; return zusage; };
      try {
        _lastScanResult = { name: gift.name, latin: gift.lat, toxicity: 5, confidence: 90, emoji: '🍄' };
        gsKiVerfuegbar = function () { return true; };
        openScanChat();
        var inp = document.getElementById('scan-chat-input'), log = document.getElementById('scan-chat-log');
        if (!inp || !log) return { ok: false, warum: 'der Scan-Chat hat kein Eingabefeld' };
        inp.value = 'Kann ich den essen?';
        await sendScanChat();
        var t1 = log.textContent || '';
        if (!rufe) return { ok: false, warum: 'die KI wurde nicht gefragt' };
        if (t1.indexOf(soll.replace(/\*\*/g, '').split('\n')[0].slice(0, 40)) < 0) return { ok: false, warum: 'die Warnzeile fehlt ueber der Zusage: „' + t1.slice(-160) + '"' };
        if (t1.indexOf(zusage) < 0) return { ok: false, warum: 'die Antwort wurde verschluckt' };
        if (/\*\*/.test(t1)) return { ok: false, warum: 'Sternchen stehen roh im Chat' };
        // Notfall — auch OHNE KI.
        gsKiVerfuegbar = function () { return false; };
        var vor = rufe;
        inp.value = 'mein kind hat davon gegessen';
        await sendScanChat();
        var t2 = (log.textContent || '').slice(t1.length);
        if (!/145/.test(t2)) return { ok: false, warum: 'ohne KI kommt die Notfallnummer nicht: „' + t2.slice(0, 120) + '"' };
        if (rufe !== vor) return { ok: false, warum: 'ohne KI wurde trotzdem gefragt' };
        // Gegenrichtung: eine harmlose Frage bekommt weder Nummer noch Warnung.
        gsKiVerfuegbar = function () { return true; };
        callAI = async function () { rufe++; return 'Er waechst im Laubwald.'; };
        _lastScanResult = { name: 'Zzz Unbekannt', latin: '', toxicity: 0 };
        openScanChat();
        inp.value = 'Wo waechst er?';
        await sendScanChat();
        var t3 = log.textContent || '';
        if (/145|Tox Info/.test(t3.replace(/^[\s\S]*?Wo waechst er\?/, ''))) return { ok: false, warum: 'eine harmlose Frage bekommt den Notfalltext' };
        return { ok: true, info: 'Warnzeile ueber der Zusage zu „' + gift.name + '" · 145 auch ohne KI · harmlose Frage ohne beides' };
      } finally { callAI = echtAI; gsKiVerfuegbar = echtKi; _lastScanResult = echtScan; try { closeScanChat(); } catch (_) {} }
    },
  },
  {
    // SCANNER-8. Der Scan-Chat leerte sein Gespräch bei JEDEM Öffnen: wer zur Ergebniskarte
    // zurückging und wieder fragte, stand vor einem leeren Chat, und die KI kannte die erste Frage
    // nicht mehr. Er antwortete fest auf Deutsch („Beantworte Fragen präzise auf Deutsch"), auch in
    // einer anderen App-Sprache. Sein erster Satz nannte die Trefferquote „Sicherheit: 85 %" — bei
    // einer Giftpflanze liest sich das wie eine Sicherheitsangabe. Und es gab keinen Weg zu Lina,
    // die ein Gespräch behält.
    name: 'SC2 · Scan-Chat: das Gespräch bleibt beim Wiederöffnen desselben Scans, ein anderer Scan beginnt neu; die KI antwortet in der App-Sprache; „Mit Lina weiterreden" übergibt Art und Frage',
    lauf: async () => {
      const warte = (ms) => new Promise((r) => setTimeout(r, ms));
      const echtAI = callAI, echtKi = gsKiVerfuegbar, echtScan = _lastScanResult, echtLina = window.gsOpenLina;
      const echtLang = (window.gsI18n && gsI18n.getLang) || null;
      const f = [];
      let sys = '', msgs = null, linaAuf = 0, aiOpts = null;
      try {
        callAI = async function (m, s, n, o) { msgs = m; sys = s; aiOpts = o; return 'Er wächst im Laubwald.'; };
        gsKiVerfuegbar = function () { return true; };
        _lastScanResult = { name: 'Zzz Testart', latin: 'Zzz testus', toxicity: 0, confidence: 85, emoji: '🌿' };
        openScanChat();
        const inp = document.getElementById('scan-chat-input'), log = document.getElementById('scan-chat-log');
        if (!inp || !log) return { ok: false, warum: 'der Scan-Chat hat kein Eingabefeld' };
        if (/Sicherheit:\s*\d/.test(log.textContent)) f.push('der erste Satz nennt die Trefferquote „Sicherheit" („' + log.textContent.slice(0, 90) + '")');
        inp.value = 'Wo wächst er?';
        await sendScanChat();
        // 1 · schliessen und wieder öffnen — derselbe Scan
        closeScanChat(); openScanChat();
        if (log.textContent.indexOf('Wo wächst er?') < 0) f.push('nach dem Wiederöffnen ist das Gespräch weg');
        inp.value = 'Und wann blüht er?';
        await sendScanChat();
        if (!msgs || !msgs.some((x) => /Wo wächst er/.test(String(x.content)))) f.push('die zweite Frage geht ohne die erste an die KI');
        // 2 · ein anderer Scan beginnt neu
        closeScanChat();
        _lastScanResult = { name: 'Zzz Andere', latin: 'Zzz alter', toxicity: 0, confidence: 70, emoji: '🌿' };
        openScanChat();
        if (/Wo wächst er\?/.test(log.textContent)) f.push('ein anderer Scan zeigt das Gespräch über die vorige Art');
        // 3 · App-Sprache Französisch: der Prompt nennt sie, und verlangt nicht Deutsch
        if (window.gsI18n) gsI18n.getLang = function () { return 'fr'; };
        inp.value = 'Où pousse-t-il ?';
        await sendScanChat();
        if (!/Französisch|français|French/i.test(sys)) f.push('in französischer App-Sprache nennt der Prompt die Sprache nicht');
        if (/auf Deutsch/i.test(sys)) f.push('der Prompt verlangt in französischer App-Sprache weiter Deutsch');
        if (window.gsI18n && echtLang) gsI18n.getLang = echtLang;
        // 4 · weiter mit Lina: Art und letzte Frage stehen im Feld, gesendet wird nichts
        window.gsOpenLina = async function () {
          linaAuf++;
          if (!document.getElementById('gs-lina-input')) { const i = document.createElement('input'); i.id = 'gs-lina-input'; i.setAttribute('data-zzz-test', '1'); document.body.appendChild(i); }
        };
        let gesendet = 0; const eSend = window.gsLinaSend; window.gsLinaSend = function () { gesendet++; };
        try {
          const knopf = document.querySelector('#scan-chat-modal [data-scanchat-lina]');
          if (!knopf) f.push('kein Knopf „Mit Lina weiterreden" im Scan-Chat');
          else {
            knopf.click();
            await warte(400);
            const li = document.getElementById('gs-lina-input');
            const v = li ? li.value : '';
            if (!linaAuf) f.push('Lina geht nicht auf');
            else if (v.indexOf('Zzz Andere') < 0) f.push('im Lina-Feld steht die Art nicht („' + v + '")');
            else if (v.indexOf('Où pousse-t-il') < 0) f.push('im Lina-Feld steht die letzte Frage nicht („' + v + '")');
            if (gesendet) f.push('die Frage wurde an Lina geschickt, ohne dass die Person sie abgeschickt hat');
            if (document.getElementById('scan-chat-modal').classList.contains('open')) f.push('der Scan-Chat bleibt über Lina offen');
          }
        } finally {
          window.gsLinaSend = eSend;
          const t = document.querySelector('#gs-lina-input[data-zzz-test]'); if (t) t.remove();
        }
      } finally {
        callAI = echtAI; gsKiVerfuegbar = echtKi; _lastScanResult = echtScan; window.gsOpenLina = echtLina;
        if (window.gsI18n && echtLang) gsI18n.getLang = echtLang;
        try { closeScanChat(); } catch (_) {}
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Gespräch bleibt beim Wiederöffnen, neuer Scan neu · Prompt auf Französisch · Lina bekommt Art und Frage, ohne zu senden' };
    },
  },
  {
    // Gegnerische Prüfung (16.11.2026) — dieselbe Klasse wie Lina L10, im Scanner: sbLogout lädt die
    // Seite nicht neu. Das letzte Ergebnis, sein Foto, die Ergebniskarte und der Scan-Chat von A lagen
    // danach weiter im Speicher. Und eine KI-Antwort, die nach dem Abmelden ankam (bis 60 s), wurde
    // gezeigt und gespeichert — unter dem Konto, das dann angemeldet war.
    name: 'SC3 · Abmelden räumt das letzte Scan-Ergebnis, sein Foto und den Scan-Chat — und eine KI-Antwort, die nach einem Kontowechsel ankommt, wird weder gezeigt noch gespeichert',
    lauf: async () => {
      if (typeof analyzeImage !== 'function' || typeof gsOnLogout !== 'function') return { ok: false, warum: 'analyzeImage oder gsOnLogout fehlt' };
      const warte = (ms) => new Promise((r) => setTimeout(r, ms));
      const f = [];
      const e = { li: window.sbIsLoggedIn, ai: window.callVisionAI, pc: window.gsScanPersistToCloud, qo: window.gsQueueOffline, cfg: window.getApiConfig, uid: gsStore.get('gs_sb_uid', null),
        cam: window.stopCamera, st: window.gsScanStatusShow, sp: window.gsStopScanStatus, hi: window.gsAddToScanHistory, dh: window._gsScanDHash, cg: window._gsScanCacheGet, cp: window._gsScanCachePut };
      let angemeldet = true, gespeichert = 0, kiGefragt = 0;
      const sr = () => document.getElementById('scan-result');
      try {
        window.sbIsLoggedIn = () => angemeldet;
        gsStore.set('gs_sb_uid', 'uid-A');
        window.getApiConfig = () => ({ key: 'k' });
        window.stopCamera = () => {}; window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {}; window.gsAddToScanHistory = () => {};
        window._gsScanDHash = async () => 'hash-sc3'; window._gsScanCacheGet = async () => null; window._gsScanCachePut = () => {};
        window.gsScanPersistToCloud = (r) => { if (r && /GEHEIM/.test(r.name || '')) gespeichert++; return Promise.resolve(true); };
        window.gsQueueOffline = async (t, r) => { if (r && /GEHEIM/.test(r.name || '')) gespeichert++; };
        // 1 · A hat gescannt und gefragt; dann meldet A sich ab
        showScanResult({ name: 'GEHEIM-A-Art', latin: 'Taraxacum officinale', confidence: 88, toxicity: 0, edible: true, category: 'wildpflanze', _scanId: 'scan-A-1' });
        window._gsLastScanB64 = 'FOTO-VON-A';
        _scanChatHistory = [{ role: 'user', content: 'GEHEIM-A fragt' }];
        await warte(100);
        if (!sr() || !/GEHEIM-A-Art/.test(sr().innerHTML)) return { ok: false, warum: 'die Ergebniskarte von A steht gar nicht da — der Fall misst nichts' };
        angemeldet = false; gsOnLogout(); try { localStorage.removeItem('gs_sb_uid'); } catch (_) {}
        if (_lastScanResult) f.push('nach dem Abmelden liegt das Ergebnis von A noch im Speicher („' + _lastScanResult.name + '")');
        if (window._gsLastScanB64) f.push('nach dem Abmelden liegt das Foto von A noch im Speicher');
        if (_scanChatHistory.length) f.push('nach dem Abmelden liegt der Scan-Chat von A noch im Speicher');
        if (sr() && /GEHEIM-A-Art/.test(sr().innerHTML)) f.push('nach dem Abmelden steht die Ergebniskarte von A noch im Dokument');
        // 2 · A scannt, meldet sich ab, während die KI rechnet; B meldet sich an; dann kommt die Antwort
        angemeldet = true; gsStore.set('gs_sb_uid', 'uid-A'); gespeichert = 0;
        window.callVisionAI = async () => { kiGefragt++; await warte(300); return JSON.stringify({ name: 'GEHEIM-A-Zwei', latin: 'Bellis perennis', confidence: 90, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' }); };
        const c = document.createElement('canvas'); c.width = 160; c.height = 160;
        const g = c.getContext('2d');
        g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160);
        g.fillStyle = '#3f9142'; g.beginPath(); g.ellipse(80, 74, 50, 30, -0.5, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#1d5c22'; g.lineWidth = 2; g.beginPath(); g.moveTo(38, 104); g.lineTo(122, 42); g.stroke();
        const lauf = analyzeImage(c.toDataURL('image/jpeg', 0.9).split(',')[1], 'image/jpeg', '', null, { trotzdem: true });
        await warte(120);
        angemeldet = false; gsOnLogout();
        angemeldet = true; gsStore.set('gs_sb_uid', 'uid-B');
        await lauf; await warte(150);
        if (!kiGefragt) return { ok: false, warum: 'der zweite Scan hat die KI nie gefragt — der Fall misst den Wettlauf nicht' + (f.length ? ' · ' + f.join(' · ') : '') };
        if (_lastScanResult && /GEHEIM-A-Zwei/.test(_lastScanResult.name || '')) f.push('die KI-Antwort für A steht nach dem Kontowechsel als Ergebnis da');
        if (sr() && /GEHEIM-A-Zwei/.test(sr().innerHTML)) f.push('die Ergebniskarte für A wird nach dem Kontowechsel gezeichnet');
        if (gespeichert) f.push('die KI-Antwort für A wird nach dem Kontowechsel gespeichert (' + gespeichert + '×)');
      } finally {
        window.sbIsLoggedIn = e.li; window.callVisionAI = e.ai; window.gsScanPersistToCloud = e.pc; window.gsQueueOffline = e.qo; window.getApiConfig = e.cfg;
        window.stopCamera = e.cam; window.gsScanStatusShow = e.st; window.gsStopScanStatus = e.sp; window.gsAddToScanHistory = e.hi;
        window._gsScanDHash = e.dh; window._gsScanCacheGet = e.cg; window._gsScanCachePut = e.cp;
        try { if (e.uid == null) localStorage.removeItem('gs_sb_uid'); else gsStore.set('gs_sb_uid', e.uid); } catch (_) {}
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'nach dem Abmelden: kein Ergebnis, kein Foto, kein Chat, keine Karte von A · Antwort nach dem Kontowechsel: nicht gezeigt, nicht gespeichert' };
    },
  },

  // ── SUCHE-2 · Die Artensuche findet, was Menschen tippen ────────────────
  {
    name: 'SU1 · Suche: ein Vertipper findet die Art, ein exakter Name bleibt oben, Unsinn findet nichts',
    lauf: () => {
      var vorF = currentFilter, vorS = searchText, f = [];
      if (typeof currentProp !== 'undefined') currentProp = '';
      var such = function (w) { currentFilter = ''; searchText = w; return getFiltered(); };
      try {
        var ex = such('giersch');
        if (!ex.length || !/^giersch/i.test(ex[0].name)) f.push('„giersch" bringt zuerst „' + (ex[0] && ex[0].name) + '"');
        [['bärlauhc', /bärlauch/i], ['barlauch', /bärlauch/i], ['löwenzan', /löwenzahn/i], ['brenessel', /brennnessel/i], ['fliegenpils', /fliegenpilz/i], ['taraxacun', /taraxacum/i]].forEach(function (p) {
          var r = such(p[0]).slice(0, 5);
          if (!r.some(function (sp) { return p[1].test(sp.name + ' ' + (sp.lat || '')); })) f.push('„' + p[0] + '" → ' + (r.length ? '„' + r[0].name + '"' : 'nichts'));
        });
        var un = such('xqzwvkj');
        if (un.length) f.push('Unsinn „xqzwvkj" findet ' + un.length + ' Eintraege, z.B. „' + un[0].name + '"');
        // Gegenrichtung: ein Vertipper darf keinen echten Namenstreffer verdraengen.
        var tom = such('tomate');
        if (!tom.length || !/tomate/i.test(tom[0].name)) f.push('„tomate" bringt zuerst „' + (tom[0] && tom[0].name) + '"');
      } finally { currentFilter = vorF; searchText = vorS; }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '6 Vertipper finden ihre Art unter den ersten fuenf · exakte Namen zuerst · Unsinn: 0 Treffer' };
    },
  },
  {
    name: 'SU2 · Suche: mehrere Woerter und der Anfang eines Synonyms',
    lauf: () => {
      var vorF = currentFilter, vorS = searchText, f = [], info = [];
      if (typeof currentProp !== 'undefined') currentProp = '';
      var such = function (w) { currentFilter = ''; searchText = w; return getFiltered(); };
      try {
        var sp = DB.find(function (s) { return /^Bärlauch/.test(s.name) && /Allium ursinum/.test(s.lat || ''); });
        if (!sp) return { ok: false, warum: 'kein Baerlauch-Eintrag — der Fall misst nichts' };
        var r = such('bärlauch allium');
        if (!r.some(function (x) { return x.id === sp.id; })) f.push('„bärlauch allium" findet den Baerlauch nicht (' + r.length + ' Treffer)');
        var gegen = such('bärlauch xqzwvkj');
        if (gegen.length) f.push('„bärlauch xqzwvkj" findet ' + gegen.length + ' — ein Wort allein darf nicht reichen');
        info.push('zwei Woerter: ' + r.length + ' Treffer');
        var zam = DB.some(function (s) { return /zamioculcas/i.test(s.lat || ''); });
        if (zam) {
          var syn = such('glücksfe');
          if (!syn.some(function (x) { return /zamioculcas/i.test(x.lat || ''); })) f.push('„glücksfe" findet die Zamioculcas nicht');
          info.push('Synonym-Anfang: ' + syn.length);
        } else info.push('Synonym nicht pruefbar (keine Zamioculcas in der Liste)');
      } finally { currentFilter = vorF; searchText = vorS; }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: info.join(' · ') };
    },
  },
  {
    name: 'SU3 · Suche: die Markierung faltet Umlaute, zerreisst kein &amp; — Statuszeile und Leerzustand nennen den Filter beim Namen',
    lauf: async () => {
      var f = [];
      var h1 = gsHighlight('Bärlauch & Co', 'barlauch');
      if (!/<mark[^>]*>Bärlauch<\/mark>/.test(h1)) f.push('„barlauch" markiert den Bärlauch nicht: ' + h1.replace(/ style="[^"]*"/g, ''));
      if (h1.indexOf('&amp; Co') < 0) f.push('das & ist nicht escaped');
      var h2 = gsHighlight('A&B', 'amp');
      if (/<mark/.test(h2) || h2 !== 'A&amp;B') f.push('„amp" markiert im &amp;: ' + h2);
      var h3 = gsHighlight('<img src=x onerror=1>', 'img');
      if (/<img/i.test(h3)) f.push('ein Tag im Namen bleibt ein Tag');
      var vorF = currentFilter, vorS = searchText;
      try {
        switchTab('search');
        currentFilter = 'geschuetzt'; searchText = ''; renderList();
        var st = (document.getElementById('search-status') || {}).textContent || '';
        if (/geschuetzt/.test(st) || !/Geschützt/.test(st)) f.push('Statuszeile: „' + st + '"');
        searchText = 'xqzwvkj'; renderList();
        var knopf = document.querySelector('#results-list button[onclick*="gsSucheOhneFilter"]');
        if (!knopf) f.push('der Leerzustand bietet nicht an, ohne Filter zu suchen');
        else {
          if (!/Geschützt/.test(knopf.textContent)) f.push('der Knopf nennt den Filter nicht: „' + knopf.textContent + '"');
          searchText = 'enzian'; knopf.click();
          await new Promise(function (r) { setTimeout(r, 200); });
          if (currentFilter) f.push('nach dem Knopf steht der Filter noch: ' + currentFilter);
          if (searchText !== 'enzian') f.push('das Suchwort ging verloren: „' + searchText + '"');
        }
        // Gegenrichtung: ohne Filter gibt es den Knopf nicht.
        currentFilter = ''; searchText = 'xqzwvkj'; renderList();
        if (document.querySelector('#results-list button[onclick*="gsSucheOhneFilter"]')) f.push('der Knopf steht auch ohne Filter da');
      } finally { currentFilter = vorF; searchText = vorS; try { gsResetFilter(); } catch (_) {} }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Markierung mit Umlaut, & und Tag · Status „Geschützt" · Knopf nur mit Filter, Suchwort bleibt' };
    },
  },

  // ── v32.86 · „Essbar" ist eine ANGABE, kein Rueckschluss aus „nicht giftig"
  // Die App sagt es an anderer Stelle selbst: `tox === 0` ohne `edible` heisst
  // woertlich „Nicht essbar ❌". Drei Anzeigen haben trotzdem aus `tox === 0`
  // auf essbar geschlossen. Alle vier Faelle waren gegen v32.85 rot.
  {
    name: 'E1 · Eine Frage, eine Regel: gsIstEssbar und der Filter „✅ Essbar" sind sich einig',
    lauf: () => {
      if (typeof gsIstEssbar !== 'function') return { ok: false, warum: 'gsIstEssbar gibt es nicht' };
      var vorher = (typeof currentFilter !== 'undefined') ? currentFilter : '';
      var abweichung = null, essbar = 0;
      try {
        currentFilter = 'essbar';
        for (var i = 0; i < DB.length && !abweichung; i++) {
          var sp = DB[i], a = gsIstEssbar(sp), b = _gsPassCat(sp);
          if (a) essbar++;
          if (a !== b) abweichung = sp.name + ' (gsIstEssbar ' + a + ', Filter ' + b + ')';
        }
      } finally { currentFilter = vorher; }
      if (abweichung) return { ok: false, warum: 'zwei Regeln fuer dieselbe Frage: ' + abweichung };
      // Und die Gegenrichtung: die alte Regel muss eine ANDERE Zahl liefern,
      // sonst prueft dieser Fall nichts.
      var alt = DB.filter(function (s) { return s.tox === 0 && (s.cat === 'wildpflanze' || s.cat === 'kraut'); }).length;
      if (alt === essbar) return { ok: false, warum: 'alte und neue Regel liefern dieselbe Zahl (' + alt + ') — der Fall misst nichts' };
      return { ok: true, info: 'essbar ' + essbar + ' · „ungiftig & Wildpflanze/Kraut" waeren ' + alt };
    },
  },
  {
    name: 'E1b · Die Startkarte „✅ Essbar" nennt die essbaren Arten, nicht die ungiftigen',
    lauf: async () => {
      switchTab('home');
      if (typeof initHomeBoard === 'function') initHomeBoard();
      // gsAnimateCounter laeuft 1200 ms — wer frueher misst, misst ein
      // Zwischenbild (genau das ist mir beim Suchen einmal passiert).
      await new Promise(function (r) { setTimeout(r, 2200); });
      var el = document.getElementById('stat-edible');
      if (!el) return { ok: false, warum: '#stat-edible gibt es nicht' };
      var gezeigt = parseInt(String(el.textContent).replace(/[^\d]/g, ''), 10);
      // Eigener Massstab — NICHT gsIstEssbar. Ein Fall, der mit der Funktion
      // misst, die er pruefen soll, faellt gegen einen alten Stand nur mit
      // „is not defined" durch und hat die falsche ZAHL nie gesehen.
      // v33.61: die Frage gilt der ART (_gsArtAnzeige) — derselbe Massstab wie die Karte in der Liste.
      var essbar = function (sp) { return !!(sp && !sp._unverified && _gsArtAnzeige(sp).edible); };
      var soll = DB.filter(essbar).length;
      var alt  = DB.filter(function (s) { return s.tox === 0 && (s.cat === 'wildpflanze' || s.cat === 'kraut'); }).length;
      if (gezeigt === alt && alt !== soll) return { ok: false, warum: 'nennt die UNGIFTIGEN: ' + gezeigt + ' statt ' + soll };
      if (gezeigt !== soll) return { ok: false, warum: 'zeigt ' + gezeigt + ', essbar sind ' + soll };
      return { ok: true, info: gezeigt + ' — dieselbe Zahl, die der Filter liefert' };
    },
  },
  {
    name: 'HS1 · „Jetzt sammeln" liest die Saison mit gsSaisonMonate: „April–Juni" zählt im Mai, „Ganzjährig" nicht — und in einer anderen App-Sprache gibt es weiter einen Tipp',
    lauf: () => {
      if (typeof _gsInSaison !== 'function') return { ok: false, warum: '_gsInSaison gibt es nicht' };
      const f = [];
      if (!_gsInSaison({ season: 'April–Juni' }, 4)) f.push('„April–Juni" gilt im Mai nicht');
      if (_gsInSaison({ season: 'April–Juni' }, 7)) f.push('„April–Juni" gilt im August');
      if (_gsInSaison({ season: 'Ganzjährig' }, 4)) f.push('„Ganzjährig" zählt als Saison');
      if (!_gsInSaison({ season: 'Nov–Feb' }, 0)) f.push('„Nov–Feb" gilt im Januar nicht');
      // Wie viele essbare Arten sind im Mai in Saison — alte Textsuche gegen die Regel?
      const alt = DB.filter(s => s.season && s.season !== 'Ganzjährig' && /mai/i.test(s.season) && gsIstEssbar(s)).length;
      const neu = DB.filter(s => _gsInSaison(s, 4) && gsIstEssbar(s)).length;
      if (neu <= alt) f.push('die Regel findet im Mai nicht mehr als die Textsuche (' + neu + ' gegen ' + alt + ') — der Fall misst nichts');
      // Die Wirkung: Juni, App-Sprache französisch — gsMonate() spricht sie, die Saisontexte sind deutsch.
      const echtMonat = Date.prototype.getMonth, echtTag = Date.prototype.getDate, echtMonate = window.gsMonate;
      const name = document.getElementById('season-tip-name');
      if (!name) return { ok: false, warum: '#season-tip-name fehlt — der Fall misst nichts' };
      const vorher = name.textContent;
      let gezeigt = '';
      try {
        Date.prototype.getMonth = function () { return 5; };
        Date.prototype.getDate = function () { return 15; };
        window.gsMonate = function () { return ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']; };
        name.textContent = 'Zzz-Platzhalter';
        gsInitSmartSeasonTip();
        gezeigt = name.textContent;
      } finally { Date.prototype.getMonth = echtMonat; Date.prototype.getDate = echtTag; window.gsMonate = echtMonate; name.textContent = vorher; }
      if (gezeigt === 'Zzz-Platzhalter') f.push('in französischer App-Sprache bleibt der Tipp im Juni stehen, wie er war');
      else {
        const sp = DB.find(s => gezeigt === s.name + (s.lat ? ' · ' + s.lat : ''));
        if (!sp) f.push('der Tipp nennt keine Art der Liste: „' + gezeigt + '"');
        else if (!_gsInSaison(sp, 5)) f.push('„' + sp.name + '" ist im Juni nicht in Saison (' + sp.season + ')');
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Mai: ' + neu + ' essbare Arten in Saison (Textsuche: ' + alt + ') · Juni auf Französisch: „' + gezeigt.slice(0, 40) + '"' };
    },
  },
  {
    // HOME-1b. HS1 und E2 rufen gsInitSmartSeasonTip DIREKT — und in der App rief sie niemand.
    // Gemessen 16.11.2026 auf der Startseite: im März „Paprika" unter „Jetzt sammeln" (aus
    // SEASON_DATA, eine Aussaat), und online schrieb gsLoadSupabaseDailyContent einen zufälligen
    // „Wusstest du?"-Eintrag hinein (v_today_tip liest did_you_know_facts — Alpendohlen, giftige
    // Pflanzen). Drei Sitzungen haben die Rechnung verbessert, die nie auf dem Bildschirm ankam.
    // Der Fall geht deshalb den WEG: initHomeBoard (Start und jeder Tab-Wechsel) → Karte, mit
    // einem gestellten Server, der einen fremden Tagestipp liefert.
    name: 'HS2 · Die Saison-Karte der Startseite kommt über den echten Weg aus gsInitSmartSeasonTip — Name, Kopf und Antippen gehören zu EINER Art, der Tagesinhalt vom Server schreibt nicht hinein',
    lauf: async () => {
      const karte = document.getElementById('season-tip-card');
      const nameEl = document.getElementById('season-tip-name');
      if (!karte || !nameEl || typeof initHomeBoard !== 'function') return { ok: false, warum: 'Saison-Karte oder initHomeBoard fehlt — der Fall misst nichts' };
      const FREMD = 'Zzz-Fremder Tagestipp';
      const eSb = window.sbFetch, eWx = window.loadHomeWeather, eGw = window.loadGardenWeather, eOd = window.openDetail, eMn = window.menuNav;
      let faktenGefragt = 0, geoeffnet = null;
      const f = [];
      try {
        // Das Wetter laeuft hier nicht mit: initHomeBoard plant es ein, und HW1 misst es danach.
        window.loadHomeWeather = function () {}; window.loadGardenWeather = function () {};
        window.sbFetch = async function (pfad) {
          const p = String(pfad || '');
          if (/v_today_tip/.test(p)) return { data: [{ title: FREMD, body: 'Alpendohlen nutzen Werkzeuge wie Affen.', icon: '🐦', category: 'animals' }], error: null };
          if (/did_you_know_facts/.test(p)) { faktenGefragt++; return { data: [], error: null }; }
          return { data: [], error: null };
        };
        nameEl.textContent = '';
        initHomeBoard();
        await new Promise((r) => setTimeout(r, 1500));   // der Server-Lader laeuft 300 ms danach
        if (!faktenGefragt) f.push('der Server-Lader lief nicht — der Fall misst den fremden Tagestipp nicht');
        const name = nameEl.textContent.replace(/\s+/g, ' ').trim();
        const kopf = ((document.getElementById('season-tip-kopf') || {}).textContent || '').trim();
        const teile = name.split(' · ');
        const treffer = DB.filter((s) => s && s.name === teile[0] && (teile.length < 2 || s.lat === teile[1]));
        const monat = new Date().getMonth();
        if (!name) f.push('die Karte bleibt leer');
        else if (name === FREMD) f.push('der „Wusstest du?"-Eintrag vom Server steht unter „' + kopf + '"');
        else if (!treffer.length) f.push('„' + name + '" ist keine Art der Liste — die Karte kommt nicht aus gsInitSmartSeasonTip');
        else if (!treffer.some((s) => _gsInSaison(s, monat))) f.push('„' + name + '" ist jetzt nicht in Saison');
        if (treffer.length && /sammeln/i.test(kopf) && !treffer.some((s) => gsIstEssbar(s))) f.push('„' + name + '" steht unter „' + kopf + '", ist aber nicht essbar');
        // Antippen öffnet die Art, die dasteht — nicht eine andere und nicht nur die Saisonansicht.
        window.openDetail = function (id) { geoeffnet = { art: id }; };
        window.menuNav = function (ziel) { geoeffnet = { menu: ziel }; };
        karte.click();
        if (!geoeffnet) f.push('Antippen tut nichts');
        else if (geoeffnet.menu) f.push('Antippen öffnet „' + geoeffnet.menu + '" statt der Art auf der Karte');
        else {
          const sp = DB.find((s) => s && String(s.id) === String(geoeffnet.art));
          if (!sp || sp.name !== teile[0]) f.push('Antippen öffnet „' + (sp ? sp.name : geoeffnet.art) + '", die Karte zeigt „' + teile[0] + '"');
        }
      } finally {
        window.sbFetch = eSb; window.loadHomeWeather = eWx; window.loadGardenWeather = eGw; window.openDetail = eOd; window.menuNav = eMn;
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: '„' + nameEl.textContent.trim().slice(0, 40) + '" · Server-Lader lief, Karte blieb · Antippen öffnet dieselbe Art' };
    },
  },
  {
    // HOME-1c. Mit dem Verdrahten (HS2) wurde eine Rechnung sichtbar, die nie auf dem Bildschirm
    // stand. Gemessen über 372 Tage: an 158 Tagen ein Pilz unter „Jetzt sammeln", an 104 Tagen
    // eine Art mit giftigem oder tödlichem Doppelgänger (Samtfussrübling — Gifthäubling). Die
    // Karte zeigt keine Warnung; Pilze haben ihre eigene Karte (mushroom-season-card). Der Fall misst
    // mit EIGENEM Massstab, nicht mit der Regel der App. Gegnerische Prüfung (16.11.2026): bis hier
    // schlug er die Doppelgänger mit derselben Zerlegung und demselben gsMatchScanToDb nach wie die
    // App — er sah ihre Lücke nicht („Schierling" ist kein ganzer Name; die Petersilie stand an vier
    // Tagen unter „Jetzt sammeln"). Jetzt ein Hauptwort-Verzeichnis direkt aus der Liste: das LETZTE
    // Wort jedes Namens-Abschnitts einer giftigen Pflanze (Stufe ≥ 3, kein Pilz), ohne die Wörter,
    // die auch ein harmloser Name als letztes trägt — gesucht als ganzes Wort im Doppelgänger-Text.
    name: 'HS3 · „Jetzt sammeln" empfiehlt an keinem Tag des Jahres einen Pilz oder eine Art mit gefährlichem Doppelgänger — und an jedem Tag steht ein Tipp',
    lauf: () => {
      if (typeof gsInitSmartSeasonTip !== 'function') return { ok: false, warum: 'gsInitSmartSeasonTip gibt es nicht' };
      const WORT = /gift|tödlich|toedlich|lebensgef|verwechsl/i;
      const nameEl = document.getElementById('season-tip-name'), kopfEl = document.getElementById('season-tip-kopf');
      if (!nameEl) return { ok: false, warum: '#season-tip-name fehlt — der Fall misst nichts' };
      const eM = Date.prototype.getMonth, eT = Date.prototype.getDate;
      const vorher = nameEl.textContent;
      const schlecht = [], leer = [];
      let geprueft = 0, sammeln = 0;
      // Hauptwörter: der Klammerzusatz ist ein Adjektiv („Fingerhut (Roter)"), ein Bindestrich-Wort
      // bleibt ganz („Nieswurz-Schafgarbe" ist nicht „Nieswurz"), und ein deutsches Hauptwort beginnt
      // gross („Echter Oleander weiss" endet auf keinem). Beim Bau gemessen: ohne diese drei Regeln
      // meldete das Verzeichnis „roter", „blauer", „weiss" und „nieswurz" — elf Fehlalarme.
      const falte = (x) => String(x || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
      const woerter = (t) => String(t || '').split(/\s+/).map((w) => w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '')).filter(Boolean);
      const giftNomen = {}, harmlosNomen = {};
      DB.forEach((s) => {
        if (!s || /pilz/i.test(s.cat || '')) return;
        const gift = (Number((_gsArtAnzeige(s) || s).tox) || 0) >= 3;
        String(s.name || '').replace(/\([^)]*\)/g, ' ').split(/[\/,]/).forEach((abschnitt) => {
          const w = woerter(abschnitt);
          const l = w[w.length - 1];
          if (!l || l.length < 5 || l[0] === l[0].toLowerCase()) return;
          const k = falte(l);
          if (gift) { if (!giftNomen[k]) giftNomen[k] = s; } else harmlosNomen[k] = 1;
        });
      });
      Object.keys(harmlosNomen).forEach((w) => { delete giftNomen[w]; });
      const giftigerDoppelgaenger = (txt) => {
        const w = woerter(txt).map(falte);
        for (let i = 0; i < w.length; i++) if (giftNomen[w[i]]) return giftNomen[w[i]];
        return null;
      };
      if (Object.keys(giftNomen).length < 50) return { ok: false, warum: 'nur ' + Object.keys(giftNomen).length + ' Hauptwörter giftiger Pflanzen — der Fall misst kaum etwas' };
      // Ein Pilz, der nicht als Pilz abgelegt ist (gegnerische Prüfung: der Lärchen-Röhrling steht als
      // „baum" in der Liste). Eigener Massstab: eine FAMILIE, die die Liste sonst nur bei Pilzen führt
      // (die App fragt die Gattung). Der Platzhalter „–" ist keine Familie.
      const famZahl = {};
      DB.forEach((x) => { if (!x || !x.fam || /^[\s–-]*$/.test(x.fam)) return; const z = famZahl[x.fam] || (famZahl[x.fam] = { pilz: 0, sonst: 0 }); if (/pilz/i.test(x.cat || '')) z.pilz++; else z.sonst++; });
      const pilzFamilie = (x) => !!(x && x.fam && famZahl[x.fam] && famZahl[x.fam].pilz >= 2 && famZahl[x.fam].pilz > famZahl[x.fam].sonst * 3);
      const istPilz = (x) => /pilz/i.test((x && x.cat) || '') || pilzFamilie(x);
      try {
        for (let m = 0; m < 12; m++) {
          for (let t = 1; t <= 31; t++) {
            Date.prototype.getMonth = function () { return m; };
            Date.prototype.getDate = function () { return t; };
            nameEl.textContent = '';
            gsInitSmartSeasonTip();
            const name = nameEl.textContent.trim(), kopf = (kopfEl && kopfEl.textContent) || '';
            const wo = (m + 1) + '/' + t;
            if (!name) { leer.push(wo); continue; }
            geprueft++;
            if (!/sammeln/i.test(kopf)) continue;
            sammeln++;
            const teile = name.split(' · ');
            const sp = DB.find((s) => s && s.name === teile[0] && (teile.length < 2 || s.lat === teile[1]));
            if (!sp) { schlecht.push(wo + ' „' + name + '": keine Art der Liste'); continue; }
            const a = _gsArtAnzeige(sp) || sp;
            const warnung = [a.warning, sp.warning, a.lookalike, sp.lookalike].find((x) => _gsWarnungEcht(x) && WORT.test(String(x)));
            if (istPilz(sp)) schlecht.push(wo + ' ' + sp.name + ': ein Pilz' + (/pilz/i.test(sp.cat || '') ? '' : ' (abgelegt als „' + sp.cat + '", Familie ' + sp.fam + ')'));
            else if (warnung) schlecht.push(wo + ' ' + sp.name + ': „' + String(warnung).slice(0, 50) + '"');
            else {
              const dg = giftigerDoppelgaenger(sp.lookalike) || giftigerDoppelgaenger(a.lookalike);
              if (dg) schlecht.push(wo + ' ' + sp.name + ': Doppelgänger ' + dg.name + ' (Stufe ' + (_gsArtAnzeige(dg) || dg).tox + ')');
            }
          }
        }
      } finally { Date.prototype.getMonth = eM; Date.prototype.getDate = eT; nameEl.textContent = vorher; }
      try { gsInitSmartSeasonTip(); } catch (_) {}   // wieder auf den echten Tag
      const f = [];
      // Dazu jede Art, die der Jahreslauf nicht trifft, mit demselben eigenen Massstab: essbar, kein
      // Pilz, kein Warnwort — aber ein Doppelgänger, dessen Hauptwort die Liste als giftig führt.
      const ohneWort = DB.filter((s) => {
        if (!s || !gsIstEssbar(s) || /pilz/i.test(s.cat || '')) return false;
        const a = _gsArtAnzeige(s) || s;
        if ([a.warning, s.warning, a.lookalike, s.lookalike].some((x) => _gsWarnungEcht(x) && WORT.test(String(x)))) return false;
        return !!(giftigerDoppelgaenger(s.lookalike) || giftigerDoppelgaenger(a.lookalike));
      });
      if (typeof _gsSammelSicher !== 'function') f.push('_gsSammelSicher gibt es nicht');
      else {
        const durch = ohneWort.filter((s) => _gsSammelSicher(s));
        if (durch.length) f.push(durch.length + ' von ' + ohneWort.length + ' Arten mit giftigem Doppelgänger ohne Warnwort gelten als sammelbar: ' + durch.slice(0, 3).map((s) => s.name + ' (' + s.lookalike + ')').join(' | '));
      }
      // Die Gegenrichtung: ein Pilz ist kein Doppelgänger einer Pflanze. Arten, deren Doppelgänger-Text
      // nur über einen giftigen PILZ einen Treffer hat (Estragon — „Beifuss" — Beifuss-Ritterling),
      // bleiben sammelbar; sonst lehnt die Regel ab, was sie nicht begründen kann.
      const tox = (h) => Number((_gsArtAnzeige(h) || h).tox) || 0;
      const nurPilz = (typeof _gsArtenTreffer !== 'function') ? [] : DB.filter((s) => {
        if (!s || !gsIstEssbar(s) || /pilz/i.test(s.cat || '')) return false;
        const a = _gsArtAnzeige(s) || s;
        if ([a.warning, s.warning, a.lookalike, s.lookalike].some((x) => _gsWarnungEcht(x) && WORT.test(String(x)))) return false;
        if (giftigerDoppelgaenger(s.lookalike) || giftigerDoppelgaenger(a.lookalike)) return false;
        const tr = (_gsArtenTreffer(s.lookalike || '') || {}).arten || [];
        return tr.some((h) => /pilz/i.test(h.cat || '') && tox(h) >= 3) && !tr.some((h) => !/pilz/i.test(h.cat || '') && tox(h) >= 3);
      });
      // Jeder falsch abgelegte Pilz, den der Jahreslauf nicht trifft: auch er ist nie sammelbar.
      const verkleidet = DB.filter((x) => x && !/pilz/i.test(x.cat || '') && pilzFamilie(x) && gsIstEssbar(x));
      if (typeof _gsSammelSicher === 'function') {
        const durchP = verkleidet.filter((x) => _gsSammelSicher(x));
        if (durchP.length) f.push(durchP.length + (durchP.length === 1 ? ' Pilz mit anderer Kategorie gilt' : ' Pilze mit anderer Kategorie gelten') + ' als sammelbar: ' + durchP.slice(0, 3).map((x) => x.name + ' [' + x.cat + '] ' + x.lat).join(' | '));
      }
      if (!nurPilz.length) f.push('keine Art, deren Doppelgänger nur über einen Pilz giftig ist — die Gegenrichtung misst nichts');
      else if (typeof _gsSammelSicher === 'function') {
        const abgelehnt = nurPilz.filter((s) => !_gsSammelSicher(s));
        if (abgelehnt.length) f.push(abgelehnt.length + ' von ' + nurPilz.length + ' Arten werden über einen giftigen PILZ als Doppelgänger abgelehnt: ' + abgelehnt.slice(0, 3).map((s) => s.name + ' („' + s.lookalike + '")').join(' | '));
      }
      if (leer.length) f.push('an ' + leer.length + ' Tagen steht kein Tipp (' + leer.slice(0, 4).join(', ') + ')');
      if (schlecht.length) f.push(schlecht.length + ' von ' + sammeln + ' Sammel-Tipps gefährlich: ' + schlecht.slice(0, 4).join(' | '));
      if (sammeln < 300) f.push('nur ' + sammeln + ' von ' + geprueft + ' Tagen „Jetzt sammeln" — der Fall misst kaum etwas');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: geprueft + ' Tage · ' + sammeln + ' Sammel-Tipps, keiner ein Pilz, keiner mit Gift-Warnung oder giftigem Doppelgänger · ' + ohneWort.length + ' Arten mit giftigem Doppelgänger ohne Warnwort abgelehnt · ' + nurPilz.length + ' mit einem Pilz als „Doppelgänger" bleiben sammelbar · ' + verkleidet.length + ' Pilz(e) mit anderer Kategorie abgelehnt' };
    },
  },
  {
    // Gegnerische Prüfung (16.11.2026): ohne Artenliste versucht es der Saison-Tipp 40 × alle 800 ms
    // und gibt dann auf. Kam die Liste erst danach (zweiter Ladeversuch über 32 s), zeichnete
    // gsArtenNachgeladen nur den Tagesplan neu — die Saison-Karte blieb leer, bis zum nächsten Weg auf
    // die Startseite. Der Fall stellt genau das her: Liste weg, Nachversuche verbraucht, Liste zurück.
    name: 'HS4 · Kommt die Artenliste erst, nachdem der Saison-Tipp aufgegeben hat, füllt das Nachladen die Karte',
    lauf: () => {
      if (typeof gsArtenNachgeladen !== 'function' || typeof gsInitSmartSeasonTip !== 'function') return { ok: false, warum: 'gsArtenNachgeladen oder gsInitSmartSeasonTip fehlt' };
      const nameEl = document.getElementById('season-tip-name');
      if (!nameEl) return { ok: false, warum: '#season-tip-name fehlt — der Fall misst nichts' };
      const vorher = nameEl.textContent, eToast = window.gsToast;
      let sicher = [];
      try {
        window.gsToast = () => {};
        if (window._gsSaisonTippWartet) { clearTimeout(window._gsSaisonTippWartet); window._gsSaisonTippWartet = 0; }
        sicher = DB.splice(0);                     // die Artenliste fehlt
        window._gsSaisonTippVersuche = 40;         // alle Nachversuche verbraucht
        nameEl.textContent = '';
        gsInitSmartSeasonTip();
        if (window._gsSaisonTippWartet) return { ok: false, warum: 'der Saison-Tipp versucht es weiter — der Fall stellt den Zustand nicht her, den er prüft' };
        DB.push.apply(DB, sicher); sicher = [];    // die Liste kommt (zweiter Ladeversuch)
        gsArtenNachgeladen();
        const name = nameEl.textContent.trim();
        if (!name) return { ok: false, warum: 'nach dem Nachladen der Artenliste bleibt der Saison-Tipp leer' };
        return { ok: true, info: 'Nachversuche verbraucht → Liste nachgeladen → „' + name.slice(0, 40) + '"' };
      } finally {
        if (sicher.length) DB.push.apply(DB, sicher);
        window.gsToast = eToast; window._gsSaisonTippVersuche = 0;
        if (!nameEl.textContent.trim()) nameEl.textContent = vorher;
      }
    },
  },
  {
    // HOME-2. Zwei Ladewege schrieben dieselbe Karte, jeder nach eigenen Regeln: loadHomeWeather
    // (Start, alle zwei Stunden) mit Text und Ort, gsApplyWeatherToWidget (Zwischenspeicher) mit
    // einem Gartentipp, anderer Symboltabelle und anderem Format. Was dastand, hing davon ab, wer
    // zuletzt lief. Der Fall faehrt BEIDE Wege mit denselben Werten und vergleicht die Karte.
    name: 'HW1 · Gartenwetter auf der Startseite: beide Ladewege zeigen bei denselben Werten dieselbe Karte — Symbol, Temperatur, Text mit Ort, Wind, Feuchte, UV, Vorschau, Warnzeile',
    lauf: async () => {
      const W = window.__wetterDaten();
      const karte = () => {
        const t = (id) => ((document.getElementById(id) || {}).textContent || '').replace(/\s+/g, ' ').trim();
        const w = document.getElementById('hw-warning');
        return { icon: t('hw-icon'), temp: t('hw-temp'), desc: t('hw-desc'), wind: t('hw-wind'), feucht: t('hw-humidity'), uv: t('hw-uv'),
                 vorschau: t('hw-forecast'), warnung: (w && w.style.display !== 'none') ? t('hw-warning-text') : '' };
      };
      const echt = { f: window._gsFetch, loc: window.gsGetLocationFor, stadt: (typeof _gsWeatherCity !== 'undefined') ? _gsWeatherCity : undefined, show: gsNotif.show };
      let a = null, b = null;
      try {
        gsNotif.show = function () {};
        window.gsGetLocationFor = function () { return { lat: 47.1, lon: 8.1, name: 'Testdorf' }; };
        window._gsFetch = async function (url) { return { ok: true, status: 200, json: async () => (String(url).indexOf('current=') >= 0 ? W.neu : W.alt) }; };
        _gsWeatherCity = 'Testdorf';
        // was aus frueheren Faellen noch unterwegs ist, landet JETZT, nicht mitten in der Messung
        await new Promise(function (r) { setTimeout(r, 2600); });
        await loadHomeWeather();
        b = karte();
        gsApplyWeatherToWidget(W.alt);
        a = karte();
        // scheitert danach der Garten-Ladeweg, bleibt die gueltige Karte stehen. Nur SEINE Adresse
        // scheitert: laeuft waehrenddessen loadHomeWeather (gsI18nRerenderDynamic ruft es), soll
        // dessen eigener Fehlersatz diesen Fall nicht vortaeuschen.
        window._gsFetch = async function (url) {
          if (String(url).indexOf('current_weather') >= 0) throw new TypeError('Failed to fetch');
          return { ok: true, status: 200, json: async () => (String(url).indexOf('current=') >= 0 ? W.neu : W.alt) };
        };
        // Waehrenddessen ruht loadHomeWeather: ein Aufruf aus einem frueheren Fall, dessen
        // Wiederholungen (0,7 s / 1,4 s) bis hierher reichen, schriebe sonst mit — gemessen beim Bau.
        var __echtLH = window.loadHomeWeather;
        window.loadHomeWeather = async function () {};
        try { await loadGardenWeather(true); } finally { window.loadHomeWeather = __echtLH; }
        var nachFehler = karte();
      } finally { window._gsFetch = echt.f; window.gsGetLocationFor = echt.loc; if (echt.stadt !== undefined) _gsWeatherCity = echt.stadt; gsNotif.show = echt.show; }
      if (!b.temp || b.temp.indexOf('1') < 0) return { ok: false, warum: 'loadHomeWeather hat die Karte nicht geschrieben („' + b.temp + '") — der Fall misst nichts' };
      const f = [];
      if (nachFehler.desc !== a.desc) f.push('ein gescheiterter Garten-Ladeweg überschreibt die gültige Karte: „' + nachFehler.desc + '"');
      Object.keys(b).forEach(function (k) { if (a[k] !== b[k]) f.push(k + ': Start „' + b[k] + '" · Zwischenspeicher „' + a[k] + '"'); });
      if (!/Testdorf/.test(b.desc) || !/Testdorf/.test(a.desc)) f.push('der Ort fehlt in der Beschreibung');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'beide Wege: ' + b.icon + ' ' + b.temp + ' · „' + b.desc + '" · Warnung „' + (b.warnung || '—') + '"' };
    },
  },
  {
    // HOME-2, die Warnzeile. Open-Meteo liefert die Stunden AB MITTERNACHT; checkStormWarning las
    // hourly[0..2] — „Gewitter in den nächsten 1-2h" hiess 00 bis 02 Uhr, mit Push-Meldung. Und die
    // Gartenwarnungen der Karte hatten eigene Schwellen statt GS_WETTER_GRENZEN (Kalender W1).
    name: 'HW2 · Warnzeile der Wetterkarte: ein Gewitter in der NÄCHSTEN Stunde meldet sich, eines um Mitternacht nicht — Frost und Hitze nach GS_WETTER_GRENZEN',
    lauf: async () => {
      const f = [], info = [];
      const echt = { f: window._gsFetch, loc: window.gsGetLocationFor, show: gsNotif.show, frost: GS_WETTER_GRENZEN.frost };
      let pushes = 0;
      const lauf = async (aendern) => {
        const W = window.__wetterDaten(aendern);
        window._gsFetch = async function () { return { ok: true, status: 200, json: async () => W.neu }; };
        await loadHomeWeather();
        const w = document.getElementById('hw-warning');
        return (w && w.style.display !== 'none') ? ((document.getElementById('hw-warning-text') || {}).textContent || '') : '';
      };
      try {
        gsNotif.show = function () { pushes++; };
        window.gsGetLocationFor = function () { return { lat: 47.1, lon: 8.1, name: 'Testdorf' }; };
        const jetztH = new Date().getHours();
        // 1 · Gewitter in der naechsten Stunde (alle anderen Stunden ruhig, kein Frost)
        pushes = 0;
        const w1 = await lauf((d) => { d.mins = [5, 6, 7, 8]; d.stundenCode[jetztH + 1] = 95; });
        if (!/Gewitter/.test(w1)) f.push('Gewitter um ' + (jetztH + 1) + ' Uhr: Warnzeile „' + w1 + '"');
        else info.push('nächste Stunde: „' + w1 + '"');
        if (/Gewitter/.test(w1) && pushes !== 1) f.push('Gewitter: ' + pushes + ' Push-Meldungen statt 1');
        // 2 · Gewitter um Mitternacht — vorbei, sobald es mindestens 3 Uhr ist
        if (jetztH >= 3) {
          pushes = 0;
          const w2 = await lauf((d) => { d.mins = [5, 6, 7, 8]; d.stundenCode[0] = 95; });
          if (/Gewitter/.test(w2)) f.push('ein Gewitter um 00 Uhr meldet sich um ' + jetztH + ' Uhr als „in den nächsten 1-2h"');
          if (pushes) f.push('dafür ' + pushes + ' Push-Meldung(en)');
          info.push('Mitternacht: still');
        } else info.push('Mitternacht: nicht prüfbar vor 3 Uhr');
        // 3 · Frost nach der Tabelle: heute -1 °C ist Frost; mit Schwelle -5 nicht mehr
        const w3 = await lauf((d) => { d.mins = [-1, 4, 5, 6]; });
        if (!/Frost/.test(w3)) f.push('Tiefstwert -1 °C: keine Frostzeile („' + w3 + '")');
        GS_WETTER_GRENZEN.frost = -5;
        const w4 = await lauf((d) => { d.mins = [-1, 4, 5, 6]; });
        GS_WETTER_GRENZEN.frost = echt.frost;
        if (/Frost/.test(w4)) f.push('Frostschwelle -5 °C: die Karte meldet bei -1 °C weiter Frost — sie liest GS_WETTER_GRENZEN nicht');
        // 4 · 3 °C jetzt, Tiefstwerte 3 °C: kein Frost (die alte Startseiten-Regel sagte < 4)
        const w5 = await lauf((d) => { d.temp = 3; d.mins = [3, 4, 5, 6]; });
        if (/Frost/.test(w5)) f.push('3 °C, Tiefstwert 3 °C: Frostzeile „' + w5 + '"');
        // 5 · Hitze nach der Tabelle
        const w6 = await lauf((d) => { d.mins = [15, 16, 17, 18]; d.maxs = [31, 29, 28, 27]; });
        if (!/Hitze/.test(w6)) f.push('Höchstwert 31 °C: keine Hitzezeile („' + w6 + '")');
        if (!f.length) info.push('Frost/Hitze nach Tabelle');
      } finally { window._gsFetch = echt.f; window.gsGetLocationFor = echt.loc; gsNotif.show = echt.show; GS_WETTER_GRENZEN.frost = echt.frost; }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: info.join(' · ') };
    },
  },
  {
    // HOME-5. Die Kartenreihe der Startseite (gsBuildWidgetStack) drehte alle 8 s, ohne dass man
    // sie anhalten konnte (WCAG 2.2.2), auch während der Fokus in ihr stand — und eine Karte ohne
    // Inhalt blieb eine Folie mit Punkt: ohne Bauernregel (offline, oder keine für den Monat)
    // drehte die Reihe auf eine leere Fläche. Der Fall stellt die Zustände HER und misst die
    // Wirkung: sichtbare Folien gegen Punkte, und die Drehung selbst (mit kurzem Takt).
    name: 'HK1 · Kartenreihe der Startseite: eine leere Karte ist keine Folie und hat keinen Punkt — ein Pause-Knopf hält die Drehung an (und wieder an), Fokus in der Reihe hält sie an',
    lauf: async () => {
      const warte = (ms) => new Promise((r) => setTimeout(r, ms));
      const f = [], info = [];
      if (typeof gsBuildWidgetStack === 'function') gsBuildWidgetStack();
      const vp = document.getElementById('gs-wstack-viewport'), dots = document.getElementById('gs-wstack-dots');
      if (!vp || !dots) return { ok: false, warum: 'Kartenreihe nicht gebaut — der Fall misst nichts' };
      const eWx = window.loadHomeWeather, eGw = window.loadGardenWeather;
      if (vp.offsetParent === null) {
        window.loadHomeWeather = function () {}; window.loadGardenWeather = function () {};
        try { switchTab('home'); await warte(900); } finally { window.loadHomeWeather = eWx; window.loadGardenWeather = eGw; }
      }
      if (vp.offsetParent === null) return { ok: false, warum: 'die Startseite ist nicht sichtbar — der Fall misst nichts' };
      const karten = ['daily-card', 'woche-card', 'season-tip-card', 'card-wusstest', 'wisdom-card'].map((id) => document.getElementById(id));
      const vorher = karten.map((k) => k ? k.style.display : null);
      const saisonName = document.getElementById('season-tip-name'), saisonVorher = saisonName ? saisonName.textContent : '';
      const sichtbareFolien = () => [].slice.call(vp.children).filter((s) => s.getBoundingClientRect().width > 0);
      const punkte = () => [].slice.call(dots.querySelectorAll('.gs-wdot')).filter((d) => d.getBoundingClientRect().width > 0);
      const leereSichtbar = () => sichtbareFolien().filter((s) => { const k = s.firstElementChild; return !k || getComputedStyle(k).display === 'none' || !k.textContent.trim(); });
      const aktiv = () => punkte().findIndex((d) => d.getAttribute('aria-selected') === 'true');
      const beobachte = async (ms) => { const s = new Set(); const t0 = performance.now(); while (performance.now() - t0 < ms) { s.add(aktiv()); await warte(40); } return s.size; };
      const knopf = dots.querySelector('[data-wstack-pause]');
      const eTakt = window.GS_WSTACK_TAKT_MS;
      let still = null;
      try { still = localStorage.getItem('gs_wstack_still'); localStorage.removeItem('gs_wstack_still'); } catch (_) {}
      try {
        // 1 · Bauernregel ohne Daten (so setzt sie gsLoadTodaysWisdom): keine Folie, kein Punkt.
        const wisdom = karten[4];
        if (wisdom) wisdom.style.display = 'none';
        await warte(200);
        const leer1 = leereSichtbar();
        if (leer1.length) f.push('ohne Bauernregel bleibt eine leere Folie sichtbar (' + leer1.map((s) => (s.firstElementChild || {}).id).join(', ') + ')');
        if (punkte().length !== sichtbareFolien().length) f.push(punkte().length + ' Punkte für ' + sichtbareFolien().length + ' sichtbare Karten');
        // 2 · Saison-Tipp ohne Inhalt (keine Artenliste): nur der Kopf steht noch da — das ist
        //     keine Karte. Gemessen an DIESER Folie und den Punkten, nicht am ganzen Kartentext
        //     (der Kopf allein hätte den Text nicht leer gemacht — Gegenprobe ohne Inhaltsregel
        //     blieb so grün).
        if (saisonName && karten[2]) {
          const n1 = punkte().length;
          saisonName.textContent = ''; await warte(200);
          const folie = karten[2].parentNode;
          if (folie && folie.getBoundingClientRect().width > 0) f.push('ein Saison-Tipp ohne Inhalt (nur der Kopf) bleibt als Folie stehen');
          if (punkte().length !== n1 - 1) f.push('Saison-Tipp ohne Inhalt: Punkte ' + n1 + ' → ' + punkte().length + ' statt ' + (n1 - 1));
          saisonName.textContent = saisonVorher || 'Zzz-Saison'; await warte(200);
          if (punkte().length !== n1) f.push('Saison-Tipp wieder da: Punkte ' + punkte().length + ' statt ' + n1);
        }
        // 3 · Die Bauernregel kommt an: Folie und Punkt kommen dazu.
        const n0 = punkte().length;
        if (typeof gsRenderWisdom === 'function') gsRenderWisdom({ saying: 'Zzz-Testregel', validity: 'umstritten', region: 'Test', meaning: '', modern_take: '' });
        await warte(200);
        if (punkte().length !== n0 + 1) f.push('die Bauernregel kam an — Punkte ' + n0 + ' → ' + punkte().length + ' statt ' + (n0 + 1));
        if (punkte().length !== sichtbareFolien().length) f.push('nach der Bauernregel: ' + punkte().length + ' Punkte für ' + sichtbareFolien().length + ' Karten');
        // 4 · Nur eine Karte mit Inhalt: nichts dreht, also weder Punkte noch Pause-Knopf.
        karten.forEach((k, i) => { if (k && i !== 0) k.style.display = 'none'; });
        await warte(200);
        if (dots.getBoundingClientRect().height > 0) f.push('bei einer einzigen Karte stehen Punkte bzw. ein Pause-Knopf da');
        karten.forEach((k, i) => { if (k && i !== 0) k.style.display = vorher[i] || ''; });
        if (karten[4]) karten[4].style.display = 'block';
        await warte(200);
        // 5 · Pause-Knopf: da, benannt, schaltet — und die Drehung hält wirklich an (kurzer Takt).
        if (!knopf) f.push('kein Pause-Knopf in der Kartenreihe');
        else {
          if (!((knopf.getAttribute('aria-label') || knopf.textContent || '').trim())) f.push('der Pause-Knopf hat keinen Namen');
          if (knopf.getAttribute('aria-pressed') !== 'false') f.push('der Pause-Knopf steht zu Beginn nicht auf „läuft" (aria-pressed=' + knopf.getAttribute('aria-pressed') + ')');
          window.GS_WSTACK_TAKT_MS = 250;
          knopf.click(); knopf.click();   // anhalten und wieder starten: der neue Takt gilt
          const laeuft = await beobachte(1300);
          if (laeuft < 2) f.push('mit kurzem Takt dreht die Reihe nicht — der Fall misst die Pause nicht');
          knopf.click();
          await warte(800);   // eine Drehung, die beim Anhalten schon unterwegs war, kommt noch an
          if (knopf.getAttribute('aria-pressed') !== 'true') f.push('nach dem Anhalten steht aria-pressed nicht auf true');
          let gemerkt = null; try { gemerkt = localStorage.getItem('gs_wstack_still'); } catch (_) {}
          if (gemerkt !== '1') f.push('das Anhalten wird nicht gemerkt (gs_wstack_still=' + gemerkt + ')');
          const angehalten = await beobachte(1300);
          if (angehalten > 1) f.push('angehalten dreht die Reihe weiter');
          knopf.click();
          const wieder = await beobachte(1300);
          if (wieder < 2) f.push('nach „weiter" dreht die Reihe nicht wieder');
          // 6 · Fokus in der Reihe hält sie an, solange er dort steht.
          const p0 = punkte()[0];
          if (p0) {
            p0.focus();
            await warte(800);
            const fokus = await beobachte(1300);
            if (fokus > 1) f.push('mit dem Fokus auf einem Punkt dreht die Reihe weiter');
            p0.blur();
            const nachFokus = await beobachte(1300);
            if (nachFokus < 2) f.push('nach dem Fokus dreht die Reihe nicht wieder');
          }
          info.push(sichtbareFolien().length + ' Karten · ' + punkte().length + ' Punkte · Pause und Fokus halten die Drehung an');
        }
      } finally {
        window.GS_WSTACK_TAKT_MS = eTakt;
        try { if (still === null) localStorage.removeItem('gs_wstack_still'); else localStorage.setItem('gs_wstack_still', still); } catch (_) {}
        if (knopf && typeof _gsWStackStoppen === 'function' && typeof _gsWStackStarten === 'function') { _gsWStackStoppen(); _gsWStackStarten(); }
        karten.forEach((k, i) => { if (k) k.style.display = vorher[i]; });
        if (saisonName) saisonName.textContent = saisonVorher;
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: info.join(' · ') };
    },
  },
  {
    // HOME-7. „Wusstest du?" lud die Fakten vom Server mit `order=id.asc&limit=30`: von 192 aktiven
    // erschienen nur die ersten 30 (live nachgelesen 16.11.2026), und 10 davon tragen eine
    // Kalenderwoche (kw) — sie standen in jeder Woche da. Escaped wurde nur „<". Der Fall stellt
    // einen Server, der den Wochenfilter NICHT anwendet (die Antwort ist fremde Eingabe), und
    // misst, was in die Karte kommt.
    name: 'HF1 · „Wusstest du?": ein Fakt einer anderen Kalenderwoche erscheint nicht, alle aktiven werden gefragt, und Fremdtext bleibt Text',
    lauf: async () => {
      if (typeof gsLoadSupabaseDailyContent !== 'function') return { ok: false, warum: 'gsLoadSupabaseDailyContent fehlt' };
      // ISO-Woche wie Postgres (EXTRACT(week …)) — eigener Massstab, nicht die Rechnung der App
      const isoWoche = (d) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const w = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - w); const j1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - j1) / 864e5 + 1) / 7); };
      const diese = isoWoche(new Date()), andere = diese >= 52 ? 1 : diese + 1;
      const eSb = window.sbFetch, eDyn = window._dynF, el = document.getElementById('fact-text'), eHtml = el ? el.innerHTML : '';
      let pfadFakten = '';
      const f = [];
      try {
        window.sbFetch = async function (pfad) {
          const p = String(pfad || '');
          if (/did_you_know_facts/.test(p)) {
            pfadFakten = p;
            return { data: [
              { title: 'Zzz Andere Woche', body: 'gehört in Woche ' + andere, icon: '📅', kw: andere },
              { title: 'Zzz Immer', body: 'ohne Woche <b>fett</b> & so', icon: '💡', kw: null },
              { title: 'Zzz Diese Woche', body: 'gehört in Woche ' + diese, icon: '🗓️', kw: diese },
            ], error: null };
          }
          return { data: [], error: null };
        };
        window._dynF = []; window._gsFaktenTag = null;   // der Tages-Zwischenspeicher fragt sonst nicht neu
        await gsLoadSupabaseDailyContent();
        const alle = (window._dynF || []).join(' ');
        if (!pfadFakten) f.push('die Fakten wurden nicht gefragt — der Fall misst nichts');
        if (/limit=30(&|$)/.test(pfadFakten)) f.push('gefragt werden nur die ersten 30 (' + pfadFakten.slice(0, 120) + ')');
        if (/Zzz Andere Woche/.test(alle)) f.push('ein Fakt der Woche ' + andere + ' steht in Woche ' + diese + ' da');
        if (!/Zzz Immer/.test(alle) || !/Zzz Diese Woche/.test(alle)) f.push('ein Fakt ohne Woche oder der Woche ' + diese + ' fehlt (' + (window._dynF || []).length + ' in der Liste)');
        if (/<b>fett<\/b>/.test(alle)) f.push('Auszeichnung aus der Datenbank wird als HTML eingesetzt');
        if (/ & so/.test(alle)) f.push('ein „&" aus der Datenbank steht roh im HTML');
        // Gegnerische Prüfung: der Deckel hat einen Namen und steht als Schwelle in GS_FRISTEN — und
        // am selben Tag fragt der zweite Weg auf die Startseite nicht noch einmal (vorher ~150 Zeilen je Weg).
        if (typeof GS_FAKTEN_MAX !== 'number' || pfadFakten.indexOf('limit=' + GS_FAKTEN_MAX) < 0) f.push('der Deckel der Anfrage ist nicht GS_FAKTEN_MAX (' + pfadFakten.slice(-40) + ')');
        const frist = (typeof gsFristenStand === 'function') ? gsFristenStand().find((x) => x.id === 'fakten') : null;
        if (!frist || frist.ist !== 3 || frist.von !== GS_FAKTEN_MAX) f.push('GS_FRISTEN nennt die geladenen Fakten nicht (' + JSON.stringify(frist && { ist: frist.ist, von: frist.von, zustand: frist.zustand }) + ')');
        pfadFakten = ''; window._dynF = [];
        await gsLoadSupabaseDailyContent();
        if (pfadFakten) f.push('am selben Tag fragt der zweite Weg auf die Startseite die Fakten noch einmal');
        if (!(window._dynF || []).length) f.push('aus dem Zwischenspeicher des Tages kommt kein Fakt');
      } finally {
        window.sbFetch = eSb; window._dynF = eDyn; if (el) el.innerHTML = eHtml; window._gsFaktenTag = null; window._gsFaktenGeladen = undefined;
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'ISO-Woche ' + diese + ': Woche ' + andere + ' bleibt draussen, ohne Woche und diese Woche drin · alle aktiven gefragt (Deckel GS_FAKTEN_MAX, in GS_FRISTEN) · einmal je Tag · Fremdtext escaped' };
    },
  },
  {
    // HOME-6 (STATUS 2026-09-10 hj, „Offen für N4"): ein Plan, dessen Jahr vorbei ist, sagt es seit
    // v33.15 auf seiner Kachel in „Meine Pläne" — aber nur dort. Seit N8 (v33.10) legt ein Plan seine
    // Termine in den Kalender; einer von letztem Jahr legt DIESES Jahr keinen mehr hin, und die
    // Startseite sagte nicht, warum. Der Fall stellt die Pläne her und liest den Tagesplan.
    // Dazu die EINE Jahresregel (_gsPlanJahr): drei Stellen rechneten mit _gsKalTag(x.sow_date), und
    // new Date(null) ist der 1.1.1970 — eine Pflanze mit "sow_date": null machte aus dem Plan einen
    // „Plan von 1970" (Kachel: „Plan-Jahr 1970 vorbei", Vorlage: „Vorlage 1971").
    name: 'HP1 · Startseite: sind ALLE Gartenpläne aus einem vergangenen Jahr, sagt der Tagesplan es und führt zu „Meine Pläne" — ein Plan für dieses Jahr, ein frischer Plan ohne Datum oder „ausblenden" lassen die Zeile weg; "sow_date": null ist kein Plan von 1970',
    lauf: async () => {
      if (typeof gsRenderDayPlan !== 'function') return { ok: false, warum: 'gsRenderDayPlan fehlt' };
      const el = document.getElementById('home-dayplan');
      if (!el) return { ok: false, warum: '#home-dayplan fehlt — der Fall misst nichts' };
      const J = new Date().getFullYear();
      const letztesJahr = new Date(J - 1, 3, 1).toISOString();
      const plan = (jahr, opts) => {
        opts = opts || {};
        const plants = opts.nullZuerst
          ? [{ name: 'Lauch', sow_date: null }, { name: 'Tomate', sow_date: jahr + '-03-15' }]
          : (jahr ? [{ name: 'Tomate', sow_date: jahr + '-03-15', harvest_from: jahr + '-07-20' }] : [{ name: 'Tomate' }]);
        return { id: 'pp_test_' + (jahr || 'ohne') + '_' + Math.random().toString(36).slice(2, 7),
          created: opts.created || letztesJahr, title: 'Testplan ' + (jahr || 'ohne Datum'), plan: { plants } };
      };
      const vorher = localStorage.getItem('gs_garden_plans'), vorAus = localStorage.getItem('gs_planhinweis_aus');
      const eOpen = window.gsPPopenSavedPlans, eLogin = window.sbIsLoggedIn;
      const eDirty = (window.gsCloudSync && gsCloudSync.markDirty) || null;
      let geoeffnet = 0;
      const f = [];
      const zeile = () => el.querySelector('[data-planjahr]');
      const setze = (liste) => { localStorage.setItem('gs_garden_plans', JSON.stringify(liste)); window._gsPlanHinweisAusMem = null; gsRenderDayPlan(); };
      try {
        window.gsPPopenSavedPlans = function () { geoeffnet++; };
        if (eDirty) gsCloudSync.markDirty = function () {};
        localStorage.removeItem('gs_planhinweis_aus');
        // 1 · zwei Pläne aus Vorjahren → Zeile mit dem NEUESTEN Jahr, Antippen öffnet „Meine Pläne"
        setze([plan(J - 2), plan(J - 1)]);
        const z1 = zeile();
        if (!z1) f.push('zwei Pläne aus ' + (J - 2) + ' und ' + (J - 1) + ': keine Zeile im Tagesplan');
        else {
          if (z1.textContent.indexOf(String(J - 1)) < 0) f.push('die Zeile nennt nicht das neueste Plan-Jahr ' + (J - 1) + ' („' + z1.textContent.trim().slice(0, 80) + '")');
          const knopf = z1.querySelector('button:not([data-planjahr-aus])');
          if (knopf) knopf.click();
          if (!geoeffnet) f.push('Antippen öffnet „Meine Pläne" nicht');
        }
        // 2 · ein Plan für dieses Jahr → keine Zeile
        setze([plan(J - 1), plan(J)]);
        if (zeile()) f.push('mit einem Plan für ' + J + ' steht die Zeile trotzdem da');
        // 3 · nur ein Plan ohne Datum (angelegt letztes Jahr) → keine Zeile: das Jahr wird nie geraten
        setze([plan(null)]);
        if (zeile()) f.push('ein Plan ohne Datum löst die Zeile aus');
        // 4 · ein alter Plan mit Datum und ein DIESES Jahr angelegter ohne Datum → keine Zeile
        setze([plan(J - 1), plan(null, { created: new Date().toISOString() })]);
        if (zeile()) f.push('ein dieses Jahr angelegter Plan ohne Datum: die Startseite behauptet trotzdem, alle Pläne seien alt');
        // 5 · "sow_date": null vor einem echten Datum → das Jahr ist das echte, nicht 1970
        const nullPlan = plan(J - 1, { nullZuerst: true });
        setze([nullPlan]);
        const z5 = zeile();
        if (!z5) f.push('Plan mit "sow_date": null und einem Datum ' + (J - 1) + ': keine Zeile');
        else if (z5.getAttribute('data-planjahr') !== String(J - 1)) f.push('Plan mit "sow_date": null: die Startseite rechnet das Jahr ' + z5.getAttribute('data-planjahr') + ' statt ' + (J - 1));
        // 5b · dieselbe Regel in „Meine Pläne": die Kachel sagt das echte Plan-Jahr
        window.gsPPopenSavedPlans = eOpen;
        window.sbIsLoggedIn = function () { return false; };   // kein Cloud-Abgleich ohne Netz
        try { await eOpen(); } catch (e) { f.push('„Meine Pläne" wirft: ' + e.message); }
        const modal = document.getElementById('modal-saved-plans');
        if (!modal) f.push('„Meine Pläne" ging nicht auf — die Kachel ist nicht gemessen');
        else {
          const kachel = modal.textContent;
          if (/1970/.test(kachel)) f.push('die Kachel in „Meine Pläne" nennt 1970 („' + ((modal.querySelector('.pp-alt') || {}).textContent || '').trim() + '")');
          if (kachel.indexOf('Plan-Jahr ' + (J - 1) + ' vorbei') < 0) f.push('die Kachel sagt nicht „Plan-Jahr ' + (J - 1) + ' vorbei"');
          modal.remove();
        }
        window.sbIsLoggedIn = eLogin;
        // 5c · und die Vorlage: aus dem Plan von J-1 wird eine Vorlage für J — nicht für 1971
        window.gsPPopenSavedPlans = function () { geoeffnet++; };
        let neu = null;
        try { neu = gsPPvorlageNaechstesJahr(nullPlan.id); } catch (e) { f.push('gsPPvorlageNaechstesJahr wirft: ' + e.message); }
        if (!neu) f.push('aus dem Plan mit "sow_date": null wurde keine Vorlage');
        else if (String(neu.title || '').indexOf('Vorlage ' + J + ' ') !== 0) f.push('die Vorlage heisst „' + neu.title + '" statt „Vorlage ' + J + ' · …"');
        // 6 · ausblenden gilt für dieses Jahr, ein Vorjahres-Ausblenden nicht
        localStorage.setItem('gs_planhinweis_aus', String(J - 1));
        setze([plan(J - 1)]);
        const z6 = zeile();
        if (!z6) f.push('ein „ausblenden" aus ' + (J - 1) + ' hält die Zeile in ' + J + ' zurück');
        else {
          const weg = z6.querySelector('[data-planjahr-aus]');
          if (!weg) f.push('die Zeile lässt sich nicht ausblenden');
          else {
            weg.click();
            if (zeile()) f.push('nach „ausblenden" steht die Zeile noch da');
            if (localStorage.getItem('gs_planhinweis_aus') !== String(J)) f.push('„ausblenden" ist nicht gespeichert (' + localStorage.getItem('gs_planhinweis_aus') + ')');
          }
        }
      } finally {
        window.gsPPopenSavedPlans = eOpen;
        window.sbIsLoggedIn = eLogin;
        if (eDirty) gsCloudSync.markDirty = eDirty;
        window._gsPlanHinweisAusMem = null;
        if (vorher === null) localStorage.removeItem('gs_garden_plans'); else localStorage.setItem('gs_garden_plans', vorher);
        if (vorAus === null) localStorage.removeItem('gs_planhinweis_aus'); else localStorage.setItem('gs_planhinweis_aus', vorAus);
        try { const m = document.getElementById('modal-saved-plans'); if (m) m.remove(); } catch (_) {}
        try { gsRenderDayPlan(); } catch (_) {}
      }
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Vorjahre → Zeile mit ' + (J - 1) + ', öffnet „Meine Pläne" · Plan für ' + J + ', ohne Datum, frisch angelegt, ausgeblendet → keine Zeile · "sow_date": null → ' + (J - 1) + ' auf Startseite, Kachel und Vorlage (' + J + ')' };
    },
  },
  {
    name: 'E2 · „Jetzt sammeln" steht nur ueber einer essbaren Art — an JEDEM Tag des Jahres',
    lauf: () => {
      if (typeof gsInitSmartSeasonTip !== 'function') return { ok: false, warum: 'gsInitSmartSeasonTip gibt es nicht' };
      var echtMonat = Date.prototype.getMonth, echtTag = Date.prototype.getDate;
      var schlecht = [], geprueft = 0;
      try {
        // v33.09: hier stand `t <= 28; t += 3` — zehn von einunddreissig Tagen
        // je Monat, und der 29. bis 31. nie. `gsInitSmartSeasonTip` waehlt mit
        // `getDate() * 13 % pool.length`: einundzwanzig moegliche Auswahlen je
        // Monat wurden damit NIE gemessen. Genau dieses Loch hat in v33.08 den
        // Eiche-Fund monatelang verdeckt (dort: EIN Tag statt 372). Nachgemessen
        // hat der volle Durchlauf hier nichts Neues gefunden — die Stichprobe
        // war zufaellig ausreichend. „Zufaellig ausreichend" ist keine Eigenschaft,
        // auf die man sich verlaesst.
        for (var m = 0; m < 12; m++) {
          for (var t = 1; t <= 31; t++) {
            (function (mm, tt) {
              Date.prototype.getMonth = function () { return mm; };
              Date.prototype.getDate  = function () { return tt; };
            })(m, t);
            gsInitSmartSeasonTip();
            // Aus der KARTE lesen, nicht aus einer id: `#season-tip-kopf` gibt
            // es erst seit v32.86. Wer die id liest, bekommt gegen einen
            // aelteren Stand einen leeren String — und der enthaelt kein
            // „sammeln", also faellt jeder Tag durch und der Fall ist gruen,
            // ohne etwas gemessen zu haben. (Genau so passiert.)
            var karte = document.getElementById('season-tip-card');
            var kopf = (karte && karte.textContent) || '';
            var name = (document.getElementById('season-tip-name') || {}).textContent || '';
            if (!name) continue;
            geprueft++;
            if (!/sammeln/i.test(kopf)) continue;   // sagt nichts vom Sammeln → in Ordnung
            var teile = name.split(' · ');
            var treffer = DB.filter(function (s) {
              return s.name === teile[0] && (teile.length < 2 || s.lat === teile[1]);
            });
            if (!treffer.length) { schlecht.push('Monat ' + (m + 1) + ' Tag ' + t + ': „' + name + '" steht in keiner Art'); continue; }
            if (!treffer.some(function (sp) { return !!(sp && sp.edible); }))
              schlecht.push('Monat ' + (m + 1) + ' Tag ' + t + ': „' + teile[0] + '" ist nicht essbar');
          }
        }
      } finally { Date.prototype.getMonth = echtMonat; Date.prototype.getDate = echtTag; }
      if (!geprueft) return { ok: false, warum: 'kein einziger Tipp gerendert — der Fall misst nichts' };
      if (schlecht.length) return { ok: false, warum: schlecht.length + ' von ' + geprueft + ' zum Sammeln empfohlen, ohne essbar zu sein: ' + schlecht.slice(0, 3).join(' | ') };
      return { ok: true, info: geprueft + ' Tage geprueft, jeder Sammel-Tipp ist essbar' };
    },
  },
  {
    name: 'E4 · Das Tagesquiz stellt an JEDEM Tag eine beantwortbare Frage',
    lauf: () => {
      // Das Quiz WERTET (v32.93) — eine kaputte Frage ist keine Anzeige, sondern
      // eine falsche Note. Die Frage haengt am Datum
      // (`getFullYear()*10000 + (getMonth()+1)*100 + getDate()`), und bis v33.09
      // hat sie niemand ueber mehr als den laufenden Tag gemessen. Dieselbe
      // Luecke wie bei E3, nur noch ungemessen.
      if (typeof initQuiz !== 'function') return { ok: false, warum: 'initQuiz gibt es nicht' };
      var eJ = Date.prototype.getFullYear, eM = Date.prototype.getMonth, eT = Date.prototype.getDate;
      var verdaechtig = [], nichtEine = [], leer = [], gemessen = 0;
      try {
        for (var m = 0; m < 12; m++) {
          for (var t = 1; t <= 31; t++) {
            (function (mm, tt) {
              Date.prototype.getFullYear = function () { return 2026; };
              Date.prototype.getMonth = function () { return mm; };
              Date.prototype.getDate = function () { return tt; };
            })(m, t);
            initQuiz();
            var q = (document.getElementById('quiz-question') || {}).textContent || '';
            var btns = [].slice.call(document.querySelectorAll('#quiz-options .quiz-opt-btn'));
            if (!q || !btns.length) continue;
            gemessen++;
            var wo = (m + 1) + '/' + t + ': ';
            if (/undefined|null|NaN|\[object Object\]/.test(q)) verdaechtig.push(wo + q.replace(/\n/g, ' ').slice(0, 60));
            var richtig = btns.filter(function (b) { return b.dataset.correct === '1'; });
            if (richtig.length !== 1) nichtEine.push(wo + richtig.length + ' richtige von ' + btns.length);
            btns.forEach(function (b) {
              var txt = (b.textContent || '').trim();
              if (!txt) leer.push(wo + 'leere Antwortmoeglichkeit');
              else if (/undefined|null|NaN|\[object Object\]/.test(txt)) verdaechtig.push(wo + 'Option „' + txt.slice(0, 35) + '"');
            });
          }
        }
      } finally { Date.prototype.getFullYear = eJ; Date.prototype.getMonth = eM; Date.prototype.getDate = eT; }
      if (gemessen < 300) return { ok: false, warum: 'nur ' + gemessen + ' von 372 Tagen gebaut — der Fall misst zu wenig' };
      var klagen = [];
      if (verdaechtig.length) klagen.push(verdaechtig.length + 'x verdaechtiger Text: ' + verdaechtig.slice(0, 3).join(' · '));
      if (nichtEine.length) klagen.push(nichtEine.length + 'x nicht genau EINE richtige Antwort: ' + nichtEine.slice(0, 3).join(' · '));
      if (leer.length) klagen.push(leer.length + 'x leere Antwortmoeglichkeit: ' + leer.slice(0, 2).join(' · '));
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      initQuiz();   // wieder auf den echten Tag stellen
      return { ok: true, info: gemessen + ' Tage gebaut · jede Frage mit genau einer richtigen Antwort, kein „undefined", keine leere Option' };
    },
  },
  {
    name: 'E3 · Das Besteck-Symbol steht nur vor einer essbaren Art — an JEDEM Tag des Jahres',
    lauf: () => {
      // v33.08: dieser Fall hing am laufenden Datum. `gsInitDynamicFacts`
      // waehlt 60 von 3'654 Zeilen ueber `getDate()*7 + getMonth()`; der
      // Fehler mit der Eiche war 364 Tage unsichtbar und stand am 10.09.2026
      // ploetzlich da — auf `main`, ohne dass sich etwas geaendert haette.
      // Eine Frage, die nur EINEN Tag kennt, ist an den anderen 364 gruen,
      // ohne etwas zu wissen. Der Fall stellt jetzt das Datum und faehrt alle
      // 372 Kombinationen (31 Tage x 12 Monate) durch die ECHTE Funktion —
      // keine zweite Umsetzung der Auswahlregel im Pruefstand.
      if (typeof gsInitDynamicFacts !== 'function') return { ok: false, warum: 'gsInitDynamicFacts gibt es nicht' };
      var Echt = Date;
      var pruefe = function () {
        var zeilen = (typeof _dynF !== 'undefined' && _dynF) ? _dynF : [];
        var b = 0, schlecht = [];
        zeilen.forEach(function (z) {
          if (String(z).indexOf('&#127860;') !== 0) return;
          b++;
          var m = String(z).match(/<strong>([^<]+)<\/strong>/);
          if (!m) { schlecht.push('Zeile ohne Namen'); return; }
          // eigener Massstab (v32.86): der Eintrag, dessen Text daneben steht,
          // muss selbst essbar sein — nicht die Funktion fragen, die geprueft wird
          var treffer = DB.filter(function (s) { return s.name === m[1]; });
          if (!treffer.some(function (sp) { return !!(sp && sp.edible); })) schlecht.push(m[1]);
        });
        return { besteck: b, schlecht: schlecht, zeilen: zeilen.length };
      };
      var gesamtBesteck = 0, gesamtZeilen = 0, tageOhneBesteck = 0, funde = {}, tage = 0;
      try {
        for (var mon = 0; mon < 12; mon++) {
          for (var tag = 1; tag <= 31; tag++) {
            var fest = new Echt(2026, mon, Math.min(tag, 28), 12, 0, 0);
            // getDate() soll wirklich `tag` liefern — auch fuer den 29.-31.
            window.Date = function (a, b2, c) {
              if (arguments.length) return new Echt(a, b2, c);
              var d = new Echt(fest.getTime());
              d.getDate = function () { return tag; };
              return d;
            };
            window.Date.now = Echt.now;
            window.Date.parse = Echt.parse;
            window.Date.UTC = Echt.UTC;
            window.Date.prototype = Echt.prototype;
            gsInitDynamicFacts();
            var r = pruefe();
            tage++;
            gesamtBesteck += r.besteck; gesamtZeilen += r.zeilen;
            if (!r.besteck) tageOhneBesteck++;
            r.schlecht.forEach(function (n) { funde[n] = (funde[n] || 0) + 1; });
          }
        }
      } finally { window.Date = Echt; }
      if (!tage) return { ok: false, warum: 'kein einziger Tag durchgefahren — der Fall misst nichts' };
      if (!gesamtBesteck) return { ok: false, warum: 'an keinem der ' + tage + ' Tage eine Besteck-Zeile — der Fall misst nichts' };
      var namen = Object.keys(funde);
      if (namen.length) {
        return { ok: false, warum: namen.length + ' Art(en) mit Besteck ohne essbaren Eintrag, an ' +
          Object.values(funde).reduce(function (a, b3) { return a + b3; }, 0) + ' von ' + tage + ' Tagen: ' + namen.slice(0, 6).join(' · ') };
      }
      // Uhr wieder frei laufen lassen, damit die spaeteren Faelle den echten Tag sehen
      gsInitDynamicFacts();
      return { ok: true, info: tage + ' Tage durchgefahren · ' + gesamtBesteck + ' Besteck-Zeilen von ' + gesamtZeilen + ', alle mit essbarem Eintrag' +
        (tageOhneBesteck ? ' · ' + tageOhneBesteck + ' Tage ohne Besteck-Zeile' : '') };
    },
  },

  // ── Hauptfunktionen · Scanner 1/2/3/7 (11.11.2026) ───────────────────
  //
  // Vier Punkte aus docs/HAUPTFUNKTIONEN.md „Offen — Scanner", alle vorher in
  // der laufenden App nachgemessen: eine gewaehlte Alternative schrieb einen
  // zweiten Scan (Cloud immer, Verlauf nach zehn Sekunden), zeigte die
  // Merkmale der verworfenen Art, eine Korrektur aenderte nichts Sichtbares,
  // und „Nochmal versuchen" vergass „Trotzdem bestimmen".
  {
    name: 'H1 · Alternative wählen: ein Scan bleibt EIN Scan — Verlauf umbenannt, kein zweiter Upload; ein NEUER Scan zählt weiter',
    lauf: async () => {
      const altP = window.gsScanPersistToCloud; let persist = [];
      window.gsScanPersistToCloud = (r) => { persist.push(r.name); return Promise.resolve(true); };
      const hist = () => JSON.parse(localStorage.getItem('gs_scan_history') || '[]');
      const scan = () => ({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 62, edible: true, toxic: false, toxicity: 0, description: 'x',
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 30 }] });
      try {
        localStorage.setItem('gs_scan_history', '[]'); window._gsLastScanIdInfo = null;
        showScanResult(scan());
        if (hist().length !== 1 || persist.length !== 1) return { ok: false, warum: 'der Fall stellt den Zustand nicht her: nach dem Scan ' + hist().length + ' Einträge, ' + persist.length + ' Uploads' };
        // elf Sekunden spaeter — die alte Kennung galt nur zehn
        if (window._gsLastScanIdInfo) window._gsLastScanIdInfo.ts -= 11000;
        const key = Object.keys(window._gsAltCandidates || {}).filter(k => /maigl/i.test(window._gsAltCandidates[k].name))[0];
        if (!key) return { ok: false, warum: 'keine Alternative auf der Karte — der Fall misst nichts' };
        gsPickAlternative(key);
        const h = hist();
        if (h.length !== 1) return { ok: false, warum: 'nach der Wahl stehen ' + h.length + ' Einträge im Verlauf: ' + h.map(x => x.name).join(' · ') };
        if (h[0].name !== 'Maiglöckchen') return { ok: false, warum: 'der Verlauf heisst weiter „' + h[0].name + '"' };
        if (h[0].ki_name !== 'Bärlauch') return { ok: false, warum: 'der Eintrag weiss nicht mehr, was die KI gesagt hatte (ki_name = ' + h[0].ki_name + ')' };
        if (!(h[0].tox >= 3) || h[0].edible) return { ok: false, warum: 'der Verlauf trägt die Sicherheitsangaben der verworfenen Art (tox ' + h[0].tox + ', essbar ' + h[0].edible + ')' };
        if (persist.length !== 1) return { ok: false, warum: 'die Wahl hat einen zweiten Scan hochgeladen: ' + persist.join(' · ') };
        // zurueck zur ersten Antwort: wieder ein Eintrag, nichts mehr „geaendert"
        const k2 = Object.keys(window._gsAltCandidates || {}).filter(k => /rlauch/i.test(window._gsAltCandidates[k].name)).pop();
        if (!k2) return { ok: false, warum: 'die erste Bestimmung steht nicht bei den Alternativen — kein Weg zurück' };
        gsPickAlternative(k2);
        const hz = hist();
        if (hz.length !== 1 || hz[0].name !== 'Bärlauch' || hz[0].ki_name) return { ok: false, warum: 'zurück zur KI-Bestimmung: ' + JSON.stringify(hz.map(x => [x.name, x.ki_name])) };
        // Gegenrichtung: ein NEUER Scan ist ein neuer Eintrag und ein neuer Upload
        showScanResult({ name: 'Löwenzahn', latin: 'Taraxacum officinale', confidence: 90, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
        if (hist().length !== 2 || persist.length !== 2) return { ok: false, warum: 'ein neuer Scan zählt nicht mehr: ' + hist().length + ' Einträge, ' + persist.length + ' Uploads' };
        return { ok: true, info: 'Wahl nach 11 s: 1 Eintrag, umbenannt, KI-Name gemerkt, 1 Upload · zurück: wieder der erste · neuer Scan: 2/2' };
      } finally { window.gsScanPersistToCloud = altP; }
    },
  },
  {
    name: 'H2 · Alternative wählen: nichts von der verworfenen Art bleibt stehen — und die Karte sagt, dass gewählt wurde',
    lauf: () => {
      const r = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 62, edible: true, toxic: false, toxicity: 0,
        description: 'Breite Blätter mit Knoblauchduft.', tips: 'Reibtest-Tipp-der-alten-Art', uses: 'Pesto-der-alten-Art', warning: 'Warnung-der-alten-Art',
        diagnostic_features: ['Knoblauchgeruch beim Zerreiben', 'Einzelblatt mit Stiel'], next_photo_hint: 'Blattunterseite-matt-Hinweis',
        _gegenprobe: { name: 'Bärlauch', einig: true }, _tox_korrigiert: { von: 0, auf: 1 },
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 30 }, { name: 'Fantasiekraut', latin: 'Planta ficta', confidence: 12 }] };
      localStorage.setItem('gs_scan_history', '[]'); window._gsLastScanIdInfo = null;
      showScanResult(r);
      const karte = () => (document.getElementById('scan-result').textContent || '').replace(/\s+/g, ' ');
      // der Fall weist nach, dass die Merkmale VORHER dastehen
      if (!/Knoblauchgeruch beim Zerreiben/.test(karte()) || !/Blattunterseite-matt-Hinweis/.test(karte())) return { ok: false, warum: 'die Karte der ersten Bestimmung zeigt Merkmale und Foto-Hinweis gar nicht — der Fall misst nichts' };
      const kand = window._gsAltCandidates || {};
      gsPickAlternative(Object.keys(kand).filter(k => /maigl/i.test(kand[k].name))[0]);
      const t = karte(), n = _lastScanResult, klagen = [];
      ['Knoblauchgeruch beim Zerreiben', 'Blattunterseite-matt-Hinweis', 'Reibtest-Tipp-der-alten-Art', 'Pesto-der-alten-Art', 'Warnung-der-alten-Art'].forEach(x => { if (t.indexOf(x) >= 0) klagen.push('auf der Karte steht weiter „' + x + '"'); });
      if (n.diagnostic_features || n.next_photo_hint || n._gegenprobe || n._tox_korrigiert && n._tox_korrigiert.von === 0 && n._tox_korrigiert.auf === 1) klagen.push('das Ergebnis trägt Felder der verworfenen Art');
      if (!n._scanId || n._scanId !== r._scanId) klagen.push('die Kennung der Aufnahme ging verloren');
      if (n.confidence !== 30) klagen.push('Sicherheit ' + n.confidence + ' statt der 30, die die KI für diese Art nannte');
      if (!(n.toxicity >= 3) || n.edible) klagen.push('Maiglöckchen: tox ' + n.toxicity + ', essbar ' + n.edible + ' — nicht aus unserer Artenliste');
      if (!/Von dir gewählt/.test(t) || !/Die KI hatte „Bärlauch“ erkannt \(62 %\)/.test(t)) klagen.push('die Karte sagt nicht, dass gewählt wurde und was die KI gesagt hatte');
      // eine Art, die unsere Liste nicht kennt: keine Zusage, ein Vorbehalt
      const k3 = Object.keys(window._gsAltCandidates || {}).filter(k => /Fantasie/.test(window._gsAltCandidates[k].name))[0];
      if (!k3) klagen.push('die zweite Alternative ist nach der Wahl verschwunden');
      else {
        gsPickAlternative(k3);
        const t3 = karte(), n3 = _lastScanResult;
        if (n3.edible === true || /✅ Essbar/.test(t3)) klagen.push('unbekannte Art erbt „essbar"');
        if (!/nicht geprüft/.test(t3)) klagen.push('unbekannte Art ohne den Vorbehalt „nicht geprüft"');
        if (/Breite Blätter mit Knoblauchduft/.test(t3)) klagen.push('unbekannte Art erbt die Beschreibung der ersten');
        if (n3._ki_name !== 'Bärlauch') klagen.push('nach zwei Wechseln ist die erste KI-Antwort „' + n3._ki_name + '"');
      }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'vorher 2 Merkmale + Foto-Hinweis sichtbar, nach der Wahl 0 von 5 Resten · 30 % statt 60 · tox ' + n.toxicity + ' aus der Liste · unbekannte Art ungeprüft' };
    },
  },
  {
    name: 'H3 · Korrektur gilt: Ergebnis und Verlauf tragen den gemeldeten Namen, gemeldet wird gegen die ERSTE KI-Antwort',
    lauf: async () => {
      const altS = window._gsKorrekturSenden, altP = window.gsScanPersistToCloud; let gesendet = [], persist = 0;
      window.gsScanPersistToCloud = () => { persist++; return Promise.resolve(true); };
      const hist = () => JSON.parse(localStorage.getItem('gs_scan_history') || '[]');
      const name = () => ((document.querySelector('#scan-result .sr2-hero-name') || {}).textContent || '');
      const karte = () => (document.getElementById('scan-result').textContent || '').replace(/\s+/g, ' ');
      const klagen = [];
      try {
        for (const antwort of ['ok', 'abgelehnt']) {
          window._gsKorrekturSenden = async (s) => { gesendet.push(s); return antwort; };
          localStorage.setItem('gs_scan_history', '[]'); window._gsLastScanIdInfo = null; gesendet = []; persist = 0;
          showScanResult({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 62, edible: true, toxic: false, toxicity: 0, description: 'x',
            diagnostic_features: ['Knoblauchgeruch beim Zerreiben'], alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 30 }] });
          // gleicher Name → nichts aendert sich (Gegenrichtung)
          gsReportScanMistake(); document.getElementById('scan-fix-name').value = 'bärlauch';
          await gsSubmitScanMistake();
          if (name() !== 'Bärlauch' || hist()[0].ki_name) klagen.push(antwort + ': derselbe Name hat etwas geändert');
          // zuerst eine Alternative waehlen, DANN korrigieren
          const kand = window._gsAltCandidates || {};
          gsPickAlternative(Object.keys(kand).filter(k => /maigl/i.test(kand[k].name))[0]);
          gesendet = [];
          gsReportScanMistake(); document.getElementById('scan-fix-name').value = 'Herbstzeitlose';
          await gsSubmitScanMistake();
          const h = hist(), n = _lastScanResult, t = karte();
          if (name() !== 'Herbstzeitlose') klagen.push(antwort + ': auf der Karte steht weiter „' + name() + '"');
          if (h.length !== 1 || h[0].name !== 'Herbstzeitlose' || h[0].ki_name !== 'Bärlauch') klagen.push(antwort + ': Verlauf ' + JSON.stringify(h.map(x => [x.name, x.ki_name])));
          if (!(n.toxicity >= 5) || n.edible !== false) klagen.push(antwort + ': Herbstzeitlose mit tox ' + n.toxicity + ', essbar ' + n.edible);
          if (!/Colchicum/.test(n.latin || '')) klagen.push(antwort + ': das Binomen aus der Artenliste fehlt');
          if (/Knoblauchgeruch beim Zerreiben/.test(t)) klagen.push(antwort + ': die Merkmale der verworfenen Art stehen weiter da');
          if (!/Von dir korrigiert/.test(t) || !/Die KI hatte „Bärlauch“/.test(t)) klagen.push(antwort + ': die Karte sagt nicht, dass korrigiert wurde');
          if (/\b0\s?%/.test((document.querySelector('#scan-result .sr2-conf-card') || {}).textContent || '')) klagen.push(antwort + ': eine erfundene Sicherheit „0 %" steht neben der eigenen Angabe');
          const g = gesendet[gesendet.length - 1] || {};
          const txt = JSON.stringify(g);
          if (!/Bärlauch/.test(txt) || /Maiglöckchen/.test(JSON.stringify([g.ai_name, g.ai_species, g.original_name].filter(Boolean)))) klagen.push(antwort + ': gemeldet wurde nicht gegen die erste KI-Antwort: ' + txt.slice(0, 160));
          if (persist !== 1) klagen.push(antwort + ': ' + persist + ' Uploads für eine Aufnahme');
        }
      } finally { window._gsKorrekturSenden = altS; window.gsScanPersistToCloud = altP; try { closeModal('detail-modal'); } catch (_) {} }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Server sagt ja UND nein: Karte + Verlauf „Herbstzeitlose" (tox 5 aus der Liste), KI-Name gemerkt, 1 Eintrag, 1 Upload · gleicher Name ändert nichts' };
    },
  },
  {
    name: 'H3b · Korrektur-Feld schlägt Arten vor: Umlaute, je Art einmal, Deckel mit „+N weitere", fremder Text bleibt Text',
    lauf: () => {
      const klagen = [];
      const t1 = _gsKorrekturTreffer('barlau');
      if (!t1.liste.some(sp => /Bärlauch/.test(sp.name))) klagen.push('„barlau" findet den Bärlauch nicht');
      const t2 = _gsKorrekturTreffer('b');
      if (t2.liste.length) klagen.push('ein einzelner Buchstabe liefert ' + t2.liste.length + ' Vorschläge');
      const t3 = _gsKorrekturTreffer('am');
      if (t3.liste.length !== GS_KORREKTUR_VORSCHLAEGE_MAX || !(t3.mehr > 0)) klagen.push('„am": ' + t3.liste.length + ' Vorschläge, +' + t3.mehr + ' — Deckel oder Rest fehlt');
      const lats = _gsKorrekturTreffer('holunder').liste.map(sp => _gsNormLat(sp.lat));
      if (lats.length !== new Set(lats).size) klagen.push('dieselbe Art steht mehrfach in den Vorschlägen');
      if (_gsKorrekturTreffer('qqqxyz').liste.length) klagen.push('Unsinn liefert Vorschläge');
      // Anzeige: aus dem gerenderten Formular
      window.__pwned = 0;
      window._lastScanResult = null;
      _lastScanResult = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 62, _scanId: 'x',
        alternatives: [{ name: 'O\'Neill <img src=x onerror="window.__pwned=1">', latin: 'Bella "donna"', confidence: 20 }] };
      gsReportScanMistake();
      const box = document.getElementById('scan-fix-vorschlaege');
      if (!box) { klagen.push('das Formular hat kein Vorschlagsfeld'); }
      else {
        const b0 = box.querySelector('button');
        if (!b0 || !/hielt auch für möglich/.test(box.textContent)) klagen.push('vor dem Tippen stehen die Alternativen der KI nicht da');
        else {
          if (b0.querySelector('img')) klagen.push('der Name der Alternative wurde als HTML gebaut');
          try { new Function(b0.getAttribute('onclick')); } catch (e) { klagen.push('onclick der Alternative parst nicht: ' + e.message); }
          b0.click();
          if (document.getElementById('scan-fix-name').value.indexOf("O'Neill <img") !== 0) klagen.push('Antippen füllt den Namen nicht wörtlich: „' + document.getElementById('scan-fix-name').value + '"');
          if (document.getElementById('scan-fix-latin').value !== 'Bella "donna"') klagen.push('Antippen füllt das Binomen nicht wörtlich');
        }
        const inp = document.getElementById('scan-fix-name'); inp.value = 'am'; inp.dispatchEvent(new Event('input', { bubbles: true }));
        if (box.querySelectorAll('button').length !== GS_KORREKTUR_VORSCHLAEGE_MAX || !/\+\d+ weitere/.test(box.textContent)) klagen.push('getippt „am": ' + box.querySelectorAll('button').length + ' Knöpfe, „+N weitere" ' + (/\+\d+ weitere/.test(box.textContent) ? 'da' : 'fehlt'));
        inp.value = 'qqqxyz'; inp.dispatchEvent(new Event('input', { bubbles: true }));
        if (box.querySelector('button') || !/trotzdem absenden/.test(box.textContent)) klagen.push('ohne Treffer fehlt der Satz, dass man trotzdem absenden kann');
        inp.value = 'barlau'; inp.dispatchEvent(new Event('input', { bubbles: true }));
        const bb = Array.from(box.querySelectorAll('button')).filter(b => /Bärlauch/.test(b.textContent))[0];
        if (!bb) klagen.push('getippt „barlau": kein Knopf für den Bärlauch');
        else { bb.click(); if (!/Allium ursinum/.test(document.getElementById('scan-fix-latin').value)) klagen.push('der gewählte Vorschlag füllt das Binomen nicht'); }
      }
      try { closeModal('detail-modal'); } catch (_) {}
      if (window.__pwned) klagen.push('fremder Text wurde ausgeführt');
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '„barlau" → Bärlauch · „am": ' + t3.liste.length + ' + ' + t3.mehr + ' weitere · je Art einmal · Alternative mit Apostroph und <img> bleibt Text' };
    },
  },
  {
    name: 'H3c · Cloud-Abgleich: die verworfene Bestimmung kommt nicht als zweiter Eintrag zurück — ein anderer Scan schon',
    lauf: async () => {
      const altF = window.sbFetch, altL = window.sbIsLoggedIn, altP = window.gsScanPersistToCloud;
      const hist = () => JSON.parse(localStorage.getItem('gs_scan_history') || '[]');
      let gefragt = 0;
      try {
        window.gsScanPersistToCloud = () => Promise.resolve(true);
        localStorage.setItem('gs_scan_history', '[]'); window._gsLastScanIdInfo = null;
        showScanResult({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 62, edible: true, toxic: false, toxicity: 0, description: 'x',
          alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 30 }] });
        const kand = window._gsAltCandidates || {};
        gsPickAlternative(Object.keys(kand).filter(k => /maigl/i.test(kand[k].name))[0]);
        const ts = _gsScanZeit(hist()[0]);
        if (!ts) return { ok: false, warum: 'der Eintrag hat keine Zeit — der Fall stellt den Zustand nicht her' };
        window.sbIsLoggedIn = () => true;
        if (!gsStore.get('gs_sb_uid', null)) gsStore.set('gs_sb_uid', 'pruef-uid');
        window.sbFetch = async () => { gefragt++; return { data: [
          // die Zeile der ERSTEN Bestimmung, 40 s spaeter angelegt (nach dem Foto-Upload)
          { created_at: new Date(ts + 40000).toISOString(), species_name: 'Bärlauch', species_latin: 'Allium ursinum', category: 'wildpflanze', confidence: 62, toxicity: 0, edible: true, thumb: 'https://beispiel.invalid/foto.jpg', context: {} },
          // ein ANDERER Bärlauch-Scan von gestern
          { created_at: new Date(ts - 86400000).toISOString(), species_name: 'Bärlauch', species_latin: 'Allium ursinum', category: 'wildpflanze', confidence: 91, toxicity: 0, edible: true, thumb: '', context: {} },
        ], error: null }; };
        await gsLoadCloudScans();
        if (!gefragt) return { ok: false, warum: 'der Abgleich hat den Server nicht gefragt — der Fall misst nichts' };
        const h = hist();
        const heute = h.filter(x => Math.abs(_gsScanZeit(x) - ts) < 120000);
        if (heute.length !== 1) return { ok: false, warum: 'die verworfene Bestimmung steht wieder da: ' + heute.map(x => x.name).join(' · ') };
        if (heute[0].name !== 'Maiglöckchen') return { ok: false, warum: 'der Abgleich hat die Wahl überschrieben: „' + heute[0].name + '"' };
        if (heute[0].photoUrl !== 'https://beispiel.invalid/foto.jpg') return { ok: false, warum: 'das Foto aus der Cloud ging beim Zusammenführen verloren' };
        if (h.length !== 2 || !h.some(x => x.name === 'Bärlauch' && x.conf === 91)) return { ok: false, warum: 'der Scan von gestern fehlt (' + h.length + ' Einträge) — der Riegel verschluckt zu viel' };
        return { ok: true, info: 'Cloud-Zeile der ersten Bestimmung (+40 s) geht im umbenannten Eintrag auf, Foto übernommen · der Scan von gestern bleibt' };
      } finally { window.sbFetch = altF; window.sbIsLoggedIn = altL; window.gsScanPersistToCloud = altP; }
    },
  },
  {
    name: 'H3d · Korrektur aus dem Verlauf: der Eintrag trägt danach den gemeldeten Namen — abgebrochen ändert nichts',
    lauf: async () => {
      const altS = window._gsKorrekturSenden, altM = window.gsPromptModal;
      const hist = () => JSON.parse(localStorage.getItem('gs_scan_history') || '[]');
      let gesendet = [];
      try {
        window._gsKorrekturSenden = async (s) => { gesendet.push(s); return 'ok'; };
        localStorage.setItem('gs_scan_history', JSON.stringify([{ id: 'scan_h3d', ts: Date.now() - 5000, name: 'Bärlauch', latin: 'Allium ursinum', conf: 62, tox: 0, edible: true, warning: '', category: 'wildpflanze' }]));
        window.gsPromptModal = async () => null;
        await gsScanHistoryReportWrong(0);
        if (hist()[0].name !== 'Bärlauch' || gesendet.length) return { ok: false, warum: 'abgebrochen, und trotzdem geändert oder gesendet' };
        window.gsPromptModal = async () => 'Herbstzeitlose';
        await gsScanHistoryReportWrong(0);
        const h = hist()[0];
        const modal = document.getElementById('scan-detail-modal');
        const mt = modal ? modal.textContent.replace(/\s+/g, ' ') : '';
        if (modal) modal.style.display = 'none';
        if (gesendet.length !== 1) return { ok: false, warum: gesendet.length + ' Meldungen statt einer' };
        if (h.name !== 'Herbstzeitlose' || h.ki_name !== 'Bärlauch') return { ok: false, warum: 'Verlauf: „' + h.name + '", KI-Name ' + h.ki_name };
        if (!(h.tox >= 5) || h.edible) return { ok: false, warum: 'der Eintrag behält die Sicherheitsangaben der alten Art (tox ' + h.tox + ', essbar ' + h.edible + ')' };
        if (!/Herbstzeitlose/.test(mt) || !/die KI hatte „Bärlauch“ erkannt/.test(mt)) return { ok: false, warum: 'das Verlaufsdetail zeigt die Änderung nicht: „' + mt.slice(0, 120) + '"' };
        return { ok: true, info: 'abgebrochen: unverändert, 0 gesendet · gemeldet: „Herbstzeitlose", tox ' + h.tox + ', Detail nennt die KI-Antwort' };
      } finally { window._gsKorrekturSenden = altS; window.gsPromptModal = altM; }
    },
  },
  {
    name: 'H7 · „Nochmal versuchen" behält „Trotzdem bestimmen" — ohne die Wahl kommt die Rückfrage weiter',
    lauf: async () => {
      const flach = (() => { const c = document.createElement('canvas'); c.width = 160; c.height = 160; const g = c.getContext('2d'); g.fillStyle = '#7a8a6a'; g.fillRect(0, 0, 160, 160); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; })();
      const q = await gsBildQualitaetVonB64(flach, 'image/jpeg');
      if (!q.messbar || !gsQualitaetZuSchlecht(q)) return { ok: false, warum: 'Prüfbild gilt als lesbar — der Fall stellt den Zustand nicht her' };
      window.getApiConfig = () => ({ key: 'k' }); window.stopCamera = () => {}; window.gsResetScanner = () => {};
      window._gsScanDHash = async () => 'hash-h7'; window._gsScanCacheGet = async () => null; window._gsScanCachePut = () => {};
      window.gsBuildScanContext = () => ({ month: 'Juli', season: 'Sommer', monthNum: 7, canton: 'UR' });
      let rufe = 0, scheitern = true;
      window.callVisionAI = async () => { rufe++; if (scheitern) throw new Error('Zeitüberschreitung'); return JSON.stringify({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' }); };
      const karte = () => (document.getElementById('scan-result').textContent || '').replace(/\s+/g, ' ');
      window._gsLastScanPayload = null;
      // Gegenrichtung zuerst: ohne „Trotzdem" → Rückfrage, kein Aufruf
      await analyzeImage(flach, 'image/jpeg');
      if (rufe !== 0 || !/schwer zu lesen/.test(karte())) return { ok: false, warum: 'ohne „Trotzdem" kam keine Rückfrage (' + rufe + ' KI-Aufrufe)' };
      gsQualTrotzdem();
      for (let i = 0; i < 80 && !/fehlgeschlagen/.test(karte()); i++) await new Promise(r => setTimeout(r, 50));
      if (rufe < 1 || !/fehlgeschlagen/.test(karte())) return { ok: false, warum: 'der gestellte Fehlschlag kam nicht an (' + rufe + ' Aufrufe) — der Fall stellt den Zustand nicht her' };
      const vorher = rufe; scheitern = false;
      await _gsRetryLastScan();
      const t = karte();
      if (/schwer zu lesen/.test(t)) return { ok: false, warum: '„Nochmal versuchen" fragt wieder nach der Bildqualität — die Wahl „Trotzdem bestimmen" ging verloren' };
      if (rufe !== vorher + 1) return { ok: false, warum: 'der erneute Versuch hat die KI ' + (rufe - vorher) + '× gerufen statt 1×' };
      if (!/Bärlauch/.test(t)) return { ok: false, warum: 'nach dem erneuten Versuch steht kein Ergebnis da' };
      return { ok: true, info: 'ohne Wahl: Rückfrage, 0 Aufrufe · Trotzdem → Fehlschlag → Nochmal: 1 Aufruf, Ergebnis ohne zweite Rückfrage' };
    },
  },

  {
    name: 'H5 · Fehlerkarte: ganze Sätze statt Rohtext, Modellname und Rohmeldung nur für Admins, eine kaputte Antwort ist kein Schlüsselfehler',
    lauf: async () => {
      const altA = window.gsIsAdmin, altL = window.sbIsLoggedIn;
      window.getApiConfig = () => ({ key: 'k' }); window.stopCamera = () => {}; window.gsResetScanner = () => {};
      window._gsScanDHash = async () => null; window._gsScanCacheGet = async () => null; window._gsScanCachePut = () => {};
      window.gsBuildScanContext = () => ({ month: 'Juli', season: 'Sommer', monthNum: 7, canton: 'UR' });
      const c = document.createElement('canvas'); c.width = 160; c.height = 160; const g = c.getContext('2d');
      g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160); g.strokeStyle = '#3f9142'; g.lineWidth = 2;
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(10 + i * 12, 150); g.lineTo(60 + i * 8, 20); g.stroke(); }
      const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
      // die Meldungen, die callVisionAI wirklich wirft — ueber die echte Uebersetzung
      const faelle = {
        kaputt:  { ki: async () => 'Das sieht aus wie Bärlauch, aber {name: ...', status: /Nicht geklappt/ },
        h400:    { ki: async () => { throw new Error(_gsFriendlyApiError(400, 'messages.0.content.0.image.source.base64: image exceeds 5 MB maximum')); }, status: /Nicht geklappt/ },
        h404:    { ki: async () => { throw new Error(_gsFriendlyApiError(404, 'model: claude-sonnet-4-20250514')); }, status: /Nicht geklappt/ },
        h429:    { ki: async () => { throw new Error(_gsFriendlyApiError(429, 'rate_limit_error')); }, status: /Nicht geklappt/ },
        fremd:   { ki: async () => { throw new Error(_gsFriendlyApiError(418, 'overloaded_error: something odd')); }, status: /Nicht geklappt/ },
        prog:    { ki: async () => { null.x; }, status: /Nicht geklappt/ },
        keinMod: { ki: async () => { throw new Error('Kein KI-Modell erfolgreich. Bitte API-Key prüfen.'); }, status: /Nicht geklappt/ },
        fetch:   { ki: async () => { throw new TypeError('Failed to fetch'); }, status: /Keine Verbindung/ },
        h401:    { ki: async () => { throw new Error(_gsFriendlyApiError(401, 'invalid x-api-key')); }, status: /KI gerade nicht erreichbar/ },
      };
      const JARGON = /gsTestApiKey|claude-|Cannot read|Failed to fetch|exceeds|model:|API.?Key|JSON|\bretry\b|Rate-Limit|overloaded|messages\.0|\{name/i;
      const karte = () => (document.getElementById('scan-result').textContent || '').replace(/\s+/g, ' ');
      const klagen = []; let gesehen = 0;
      try {
        for (const admin of [false, true]) {
          window.gsIsAdmin = () => admin; window.sbIsLoggedIn = () => true;
          for (const k of Object.keys(faelle)) {
            window.callVisionAI = faelle[k].ki;
            await analyzeImage(b64, 'image/jpeg', '', null, { trotzdem: true });
            const t = karte();
            if (!/Scan fehlgeschlagen/.test(t)) { klagen.push(k + ': keine Fehlerkarte — der Fall stellt den Zustand nicht her'); continue; }
            gesehen++;
            const satz = ((document.querySelector('#scan-result p:nth-of-type(2)') || {}).textContent || '').trim();
            if (!admin) {
              if (JARGON.test(t)) klagen.push(k + ': Rohtext auf der Karte: „' + (t.match(JARGON) || [''])[0] + '"');
              if (/Modell:|Meldung:/.test(t)) klagen.push(k + ': die Admin-Zeile steht für jede Person da');
              if (!/[.!?]$/.test(satz) || satz.length < 30) klagen.push(k + ': kein ganzer Satz: „' + satz + '"');
              const st = (document.getElementById('scan-status') || {}).textContent || '';
              if (!faelle[k].status.test(st)) klagen.push(k + ': Statuszeile „' + st + '"');
            } else if (!/Modell:/.test(t) || !/Meldung:/.test(t)) klagen.push(k + ' (Admin): die Rohmeldung fehlt');
          }
        }
      } finally { window.gsIsAdmin = altA; window.sbIsLoggedIn = altL; }
      // eine kaputte Antwort zeigt keinen Anmelde- oder Schluessel-Kasten
      window.gsIsAdmin = () => false; window.sbIsLoggedIn = () => true;
      window.callVisionAI = faelle.kaputt.ki;
      await analyzeImage(b64, 'image/jpeg', '', null, { trotzdem: true });
      if (/KI gerade nicht erreichbar|Anmelden für die KI|API-Key/.test(karte())) klagen.push('kaputte Antwort: der Schlüssel-Kasten steht da');
      window.gsIsAdmin = altA; window.sbIsLoggedIn = altL;
      if (klagen.length) return { ok: false, warum: klagen.slice(0, 6).join(' · ') + (klagen.length > 6 ? ' · +' + (klagen.length - 6) + ' weitere' : '') };
      return { ok: true, info: gesehen + ' Fehlerkarten (9 Meldungen × Person/Admin): Person ohne Rohtext, mit ganzem Satz und passender Statuszeile; Admin mit Modell und Rohmeldung' };
    },
  },
  {
    name: 'H5b · „In einer Minute nochmal": zählt sichtbar herunter, antippen bricht ab, ohne Karte kein Versuch im Hintergrund',
    lauf: async () => {
      const altR = window._gsRetryLastScan; let versuche = 0;
      window._gsRetryLastScan = async () => { versuche++; };
      const warte = (ms) => new Promise(r => setTimeout(r, ms));
      const rd = document.getElementById('scan-result');
      const knopf = () => { rd.style.display = 'block'; rd.innerHTML = '<button id="scan-warte-btn" onclick="gsScanSpaeterVersuchen(2)">⏱️ In einer Minute nochmal</button>'; return document.getElementById('scan-warte-btn'); };
      const klagen = [];
      try {
        // 1 · zaehlt herunter und versucht genau einmal
        let b = knopf(); b.click();
        const t0 = b.textContent;
        if (!/Nochmal in 2 s/.test(t0)) klagen.push('kein Countdown nach dem Antippen: „' + t0 + '"');
        await warte(1150);
        if (!/Nochmal in 1 s/.test(b.textContent)) klagen.push('zählt nicht herunter: „' + b.textContent + '"');
        await warte(1300);
        if (versuche !== 1) klagen.push('nach Ablauf ' + versuche + ' Versuche statt 1');
        await warte(1200);
        if (versuche !== 1) klagen.push('nach Ablauf läuft der Zähler weiter: ' + versuche + ' Versuche');
        // 2 · antippen bricht ab
        versuche = 0; b = knopf(); b.click(); await warte(200); b.click();
        if (window._gsScanWarteTimer) klagen.push('abgebrochen, aber der Zähler läuft weiter');
        if (!/In einer Minute nochmal/.test(b.textContent)) klagen.push('nach dem Abbruch steht „' + b.textContent + '"');
        await warte(2400);
        if (versuche) klagen.push('trotz Abbruch ' + versuche + '× versucht');
        // 3 · Karte weg (neues Foto, Zurueck) → kein Versuch
        versuche = 0; b = knopf(); b.click(); rd.innerHTML = '';
        await warte(2400);
        if (versuche) klagen.push('ohne Karte im Hintergrund ' + versuche + '× versucht');
        if (window._gsScanWarteTimer) klagen.push('ohne Karte läuft der Zähler weiter');
        // 4 · zweimal gestartet: EIN Zaehler
        // (lang genug, dass ein verwaister zweiter Zaehler ein zweites Mal zuschlaegt)
        versuche = 0; b = knopf(); gsScanSpaeterVersuchen(2); gsScanSpaeterVersuchen(2);
        await warte(4300);
        if (versuche !== 1) klagen.push('zweimal gestartet → ' + versuche + ' Versuche');
      } finally { window._gsRetryLastScan = altR; try { _gsScanWarteStopp(); } catch (_) {} rd.innerHTML = ''; rd.style.display = 'none'; }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '2 → 1 → Versuch (genau 1) · Abbruch: 0 Versuche · Karte weg: 0 · doppelt gestartet: 1' };
    },
  },
  {
    // SCANNER-6. Der Verlauf ordnete einen Scan der Artenliste mit einem Namensvergleich zu
    // (`DB.find(name === …)`), die Ergebniskarte mit gsMatchScanToDb (Binomen vor Name). Gemessen
    // 16.11.2026: 189 deutsche Namen stehen fuer mehrere Arten; in 11 Faellen oeffnete „In Datenbank
    // oeffnen" eine ungiftige Art, obwohl eine giftige gescannt war (Hahnenfuss / Ranunculus acer,
    // Stufe 3 → Batrachium hederaceum, Stufe 0). Der Fall SUCHT sich so einen Namen in der Liste,
    // statt ihn festzuschreiben, und haelt den Verlauf gegen die Karte desselben Scans.
    name: 'SV1 · Scan-Verlauf ordnet die Art zu wie die Ergebniskarte: ein mehrdeutiger Name öffnet die gescannte Art, ein fremder Name mit bekanntem Binomen steht „in DB" — und ohne Treffer verspricht nichts einen Vorschlag',
    lauf: async () => {
      const altP = window.gsScanPersistToCloud;
      window.gsScanPersistToCloud = () => Promise.resolve(true);
      const klagen = [];
      const norm = (s) => String(s || '').toLowerCase().trim();
      const nach = {};
      for (const s of DB) { if (s && s.name && s.lat) (nach[norm(s.name)] = nach[norm(s.name)] || []).push(s); }
      let fall = null;
      for (const k of Object.keys(nach)) {
        const v = nach[k], erst = v[0];
        const s = v.find(x => _gsNormLat(x.lat) !== _gsNormLat(erst.lat) && (Number(x.tox) || 0) > (Number(erst.tox) || 0));
        if (s) { fall = { name: s.name, latin: s.lat, tox: Number(s.tox) || 0, erst }; break; }
      }
      if (!fall) return { ok: false, warum: 'kein deutscher Name mit einer giftigeren zweiten Art in der Liste — der Fall misst nichts' };
      const scans = [
        { schl: 'mehrdeutig', r: { name: fall.name, latin: fall.latin, confidence: 77, edible: false, toxic: true, toxicity: fall.tox } },
        { schl: 'fremdname',  r: { name: 'Wilder Knoblauch (Testname)', latin: 'Allium ursinum', confidence: 81, edible: true, toxic: false, toxicity: 0 } },
        { schl: 'zweitname',  r: { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 90, edible: true, toxic: false, toxicity: 0 } },
        { schl: 'unbekannt',  r: { name: 'Fantasiekraut', latin: 'Planta ficta', confidence: 70, edible: false, toxic: false, toxicity: 0 } },
      ];
      const idAus = (el) => { const m = el && /openDetail\('([^']+)'\)/.exec(el.getAttribute('onclick') || ''); return m ? m[1] : null; };
      const karteId = {};
      try {
        localStorage.setItem('gs_scan_history', '[]'); localStorage.setItem('gs_confirmed_species', '[]');
        for (const s of scans) {
          window._gsLastScanIdInfo = null;
          showScanResult(Object.assign({ alternatives: [], description: 'x' }, s.r));
          karteId[s.schl] = idAus(document.querySelector('#scan-result .sr2-cta-primary[onclick*="openDetail"]'));
        }
        if (!karteId.mehrdeutig || !karteId.fremdname) return { ok: false, warum: 'die Karte selbst findet die Art nicht (' + JSON.stringify(karteId) + ') — der Fall misst nichts' };
        if (karteId.unbekannt) return { ok: false, warum: 'die Karte findet „Planta ficta" in der Liste — der Fall misst nichts' };
        const geoeffnet = DB.find(x => x.id === karteId.mehrdeutig);
        if (!geoeffnet || _gsNormLat(geoeffnet.lat) !== _gsNormLat(fall.latin)) return { ok: false, warum: 'die Karte öffnet zu „' + fall.latin + '" eine andere Art — der Fall misst nichts' };
        const hist = JSON.parse(localStorage.getItem('gs_scan_history') || '[]');
        if (hist.length !== 4) return { ok: false, warum: 'der Fall stellt den Zustand nicht her: ' + hist.length + ' Einträge im Verlauf' };
        // 1 · Detail: dieselbe Art wie die Karte
        const detail = (schl) => {
          const i = hist.findIndex(h => h.name === scans.find(s => s.schl === schl).r.name && h.latin === scans.find(s => s.schl === schl).r.latin);
          gsScanHistoryOpen('h_' + i);
          const m = document.getElementById('scan-detail-modal');
          const o = { text: m ? m.textContent.replace(/\s+/g, ' ') : '', id: m ? idAus(m.querySelector('[onclick*="openDetail"]')) : null };
          closeScanDetail();
          return o;
        };
        const dM = detail('mehrdeutig');
        if (dM.id !== karteId.mehrdeutig) {
          const x = DB.find(s => s.id === dM.id);
          klagen.push('„' + fall.name + ' / ' + fall.latin + '" (Stufe ' + fall.tox + '): der Verlauf öffnet ' + (x ? '„' + x.lat + '" (Stufe ' + (x.tox | 0) + ')' : 'nichts') + ', die Karte ' + karteId.mehrdeutig);
        }
        const dF = detail('fremdname');
        if (dF.id !== karteId.fremdname) klagen.push('fremder Name mit bekanntem Binomen: der Verlauf öffnet ' + (dF.id || 'nichts') + ', die Karte ' + karteId.fremdname);
        if (/nicht in (der|unserer) (Datenbank|Artenliste)/i.test(dF.text)) klagen.push('fremder Name mit bekanntem Binomen: der Verlauf nennt die Art unbekannt');
        const dU = detail('unbekannt');
        if (dU.id) klagen.push('unbekannte Art: der Verlauf öffnet ' + dU.id);
        if (/vorgeschlagen|zur Prüfung/i.test(dU.text)) klagen.push('unbekannte Art: der Verlauf verspricht einen Vorschlag, den niemand nachgesehen hat');
        if (!/nicht in unserer Artenliste/.test(dU.text)) klagen.push('unbekannte Art: der Verlauf sagt nicht, dass sie nicht in der Liste steht');
        // 2 · Liste: Kopfzahlen, Abzeichen, Filter
        openScanHistoryFull();
        const kopf = (document.getElementById('scan-history-stats') || {}).textContent || '';
        const zahl = (re) => { const m = re.exec(kopf.replace(/\s+/g, ' ')); return m ? +m[1] : null; };
        if (zahl(/(\d+) in DB/) !== 3) klagen.push('Kopf: „' + zahl(/(\d+) in DB/) + ' in DB" statt 3');
        if (zahl(/(\d+) Arten/) !== 3) klagen.push('Kopf: „' + zahl(/(\d+) Arten/) + ' Arten" statt 3 — zwei Namen für Allium ursinum zählen als zwei Arten');
        const zeilen = () => [...document.querySelectorAll('#scan-history-list [data-uid]')].map(z => z.textContent.replace(/\s+/g, ' '));
        const mitDb = zeilen().filter(t => /in DB/.test(t)).length;
        if (mitDb !== 3) klagen.push('Abzeichen „in DB" an ' + mitDb + ' von 3 bekannten Scans');
        gsScanHistSetFilter('indb');
        if (zeilen().length !== 3) klagen.push('Filter „in DB": ' + zeilen().length + ' Zeilen statt 3');
        gsScanHistSetFilter('unknown');
        const unb = zeilen();
        if (unb.length !== 1 || !/Fantasiekraut/.test(unb[0] || '')) klagen.push('Filter „unbekannt": ' + unb.length + ' Zeilen (' + unb.map(t => t.slice(0, 24)).join(' · ') + ')');
        gsScanHistSetFilter('all');
      } finally {
        window.gsScanPersistToCloud = altP;
        try { closeScanDetail(); } catch (_) {}
        try { closeScanHistoryFull(); } catch (_) {}
        localStorage.setItem('gs_scan_history', '[]');
      }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '„' + fall.name + ' / ' + fall.latin + '" (Stufe ' + fall.tox + ') öffnet dieselbe Art wie die Karte, nicht „' + fall.erst.lat + '" · fremder Name mit Binomen: in DB · unbekannt: kein Versprechen · Kopf 3 in DB, 3 Arten bei 4 Scans' };
    },
  },
  {
    // SCANNER-6, zweite Haelfte: die Karte sagt zu 60 % „Möglich", der Verlauf sagte „Unsicher";
    // zu 72 % „Wahrscheinlich" gegen „Plausibel". Gelesen wird das WORT auf der echten Karte, nicht
    // eine Tabelle im Pruefstand — und die Farbe des Wortes muss dieselbe sein.
    name: 'SV2 · Scan-Verlauf: die Trefferquote trägt dasselbe Wort und dieselbe Textfarbe wie die Ergebniskarte — bei 60 %, 72 % und 90 %',
    lauf: async () => {
      const altP = window.gsScanPersistToCloud;
      window.gsScanPersistToCloud = () => Promise.resolve(true);
      const klagen = []; const gesehen = [];
      try {
        for (const c of [60, 72, 90]) {
          localStorage.setItem('gs_scan_history', '[]'); localStorage.setItem('gs_confirmed_species', '[]'); window._gsLastScanIdInfo = null;
          showScanResult({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: c, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
          const kEl = document.querySelector('#scan-result .sr2-conf-val');
          const wort = kEl ? kEl.textContent.trim() : '';
          if (!wort) { klagen.push(c + ' %: die Karte zeigt kein Wort — der Fall misst nichts'); continue; }
          const kFarbe = getComputedStyle(kEl).color;
          gsScanHistoryOpen('h_0');
          const m = document.getElementById('scan-detail-modal');
          if (!m) { klagen.push(c + ' %: der Verlauf öffnet keinen Eintrag'); continue; }
          const t = m.textContent.replace(/\s+/g, ' ');
          const vEl = [...m.querySelectorAll('div')].find(d => d.children.length === 0 && d.textContent.trim() === wort);
          gesehen.push(c + ' % „' + wort + '"');
          if (t.indexOf(c + '%') < 0) klagen.push(c + ' %: die Zahl fehlt im Verlauf');
          if (!vEl) klagen.push(c + ' %: die Karte sagt „' + wort + '", der Verlauf nicht (' + (t.match(/Trefferquote.{0,40}/) || [''])[0] + ')');
          else if (getComputedStyle(vEl).color !== kFarbe) klagen.push(c + ' %: „' + wort + '" in ' + getComputedStyle(vEl).color + ' statt ' + kFarbe + ' wie auf der Karte');
          closeScanDetail();
        }
      } finally { window.gsScanPersistToCloud = altP; try { closeScanDetail(); } catch (_) {} localStorage.setItem('gs_scan_history', '[]'); }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: gesehen.join(' · ') + ' — Karte und Verlauf gleich, in derselben Farbe' };
    },
  },
  {
    // SCANNER-6, die zweite Detailansicht (aus der Foto-Galerie, openScanHistoryDetail). Sie las die
    // Sicherheit aus dem GESPEICHERTEN Scan: ein alter Eintrag oder eine Cloud-Zeile mit „essbar" der
    // KI stand dort als „🥗 Essbar", auch fuer eine Art, die unsere Liste als toedlich fuehrt — und
    // „In DB öffnen" nahm den ersten Eintrag mit diesem Namen.
    name: 'SV3 · Galerie-Detail eines Scans: Giftstufe und „Essbar" kommen aus der Artenliste, nie aus dem gespeicherten Scan — ein KI-„Essbar" ohne Gegenprobe steht nicht da, eine KI-Warnung schon',
    lauf: async () => {
      const klagen = [];
      const altP = window.gsScanPersistToCloud;
      window.gsScanPersistToCloud = () => Promise.resolve(true);
      const text = () => { const m = document.getElementById('scan-detail-modal'); return m ? m.textContent.replace(/\s+/g, ' ') : ''; };
      const idAus = (el) => { const m = el && /openDetail\('([^']+)'\)/.exec(el.getAttribute('onclick') || ''); return m ? m[1] : null; };
      const zu = () => { const m = document.getElementById('scan-detail-modal'); if (m) m.remove(); };
      // ein mehrdeutiger Name, wie in SV1 aus der Liste gesucht
      const norm = (s) => String(s || '').toLowerCase().trim(); const nach = {};
      for (const s of DB) { if (s && s.name && s.lat) (nach[norm(s.name)] = nach[norm(s.name)] || []).push(s); }
      let fall = null;
      for (const k of Object.keys(nach)) { const v = nach[k], erst = v[0]; const s = v.find(x => _gsNormLat(x.lat) !== _gsNormLat(erst.lat) && (Number(x.tox) || 0) > (Number(erst.tox) || 0)); if (s) { fall = s; break; } }
      const herbst = gsMatchScanToDb('Herbstzeitlose', 'Colchicum autumnale');
      if (!fall || !herbst || !((_gsArtAnzeige(herbst).tox | 0) >= 4)) return { ok: false, warum: 'die Liste trägt die Fälle nicht (mehrdeutiger Name / Herbstzeitlose ≥ 4) — der Fall misst nichts' };
      const jetzt = Date.now();
      localStorage.setItem('gs_scan_history', JSON.stringify([
        // 0 · ein alter Eintrag mit dem, was die KI damals sagte
        { id: 'sv3_a', ts: jetzt - 1000, name: 'Herbstzeitlose', latin: 'Colchicum autumnale', conf: 72, tox: 0, edible: true, warning: '', category: 'wildpflanze' },
        // 1 · eine Art, die die Liste nicht kennt — „essbar" nur von der KI, dazu eine Warnung der KI
        { id: 'sv3_b', ts: jetzt - 2000, name: 'Fantasiekraut', latin: 'Planta ficta', conf: 88, tox: 2, edible: true, warning: '', category: 'wildpflanze' },
        // 2 · ein mehrdeutiger deutscher Name
        { id: 'sv3_c', ts: jetzt - 3000, name: fall.name, latin: fall.lat, conf: 90, tox: Number(fall.tox) || 0, edible: false, warning: '', category: 'wildpflanze' },
      ]));
      try {
        openScanHistoryDetail(0);
        const tA = text();
        if (!tA) return { ok: false, warum: 'das Galerie-Detail geht nicht auf — der Fall misst nichts' };
        if (/Essbar/.test(tA)) klagen.push('Herbstzeitlose (Liste: Stufe ' + _gsArtAnzeige(herbst).tox + '): das Detail zeigt „Essbar" aus dem gespeicherten Scan');
        if (!/Stark giftig/.test(tA)) klagen.push('Herbstzeitlose: das Detail nennt die Giftstufe der Liste nicht');
        // dasselbe Wort zur Sicherheit wie die Ergebniskarte (72 % → „Wahrscheinlich")
        showScanResult({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 72, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
        const wort = ((document.querySelector('#scan-result .sr2-conf-val') || {}).textContent || '').trim();
        localStorage.setItem('gs_scan_history', JSON.stringify(JSON.parse(localStorage.getItem('gs_scan_history') || '[]').filter(h => /^sv3_/.test(h.id))));
        if (wort && tA.indexOf(wort) < 0) klagen.push('72 %: die Karte sagt „' + wort + '", das Galerie-Detail nicht');
        zu();
        openScanHistoryDetail(1);
        const tB = text(); zu();
        if (/Essbar/.test(tB)) klagen.push('unbekannte Art: „Essbar" der KI ohne Gegenprobe steht da');
        if (!/Giftig/.test(tB)) klagen.push('unbekannte Art: die Warnung der KI (Stufe 2) fehlt');
        openScanHistoryDetail(2);
        const m = document.getElementById('scan-detail-modal');
        const id = idAus(m && m.querySelector('[onclick*="openDetail"]')); zu();
        const soll = gsMatchScanToDb(fall.name, fall.lat);
        if (!soll || id !== soll.id) { const x = DB.find(s => s.id === id); klagen.push('„' + fall.name + ' / ' + fall.lat + '": „In DB öffnen" führt zu ' + (x ? '„' + x.lat + '" (Stufe ' + (x.tox | 0) + ')' : 'nichts') + ' statt ' + (soll && soll.id)); }
      } finally { window.gsScanPersistToCloud = altP; zu(); localStorage.setItem('gs_scan_history', '[]'); }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Herbstzeitlose mit altem „essbar": „Stark giftig", kein „Essbar" · unbekannt: Warnung ja, „Essbar" nein · mehrdeutiger Name → die gescannte Art · 72 % wie auf der Karte' };
    },
  },
  {
    // SCANNER-10. Die Vorschau im Verlauf und das Foto fuer „Zu meinen Pflanzen" wurden aus dem
    // LAUFENDEN Video gezeichnet — aber analyzeImage stoppt die Kamera, sobald die Analyse beginnt
    // (v23.71). Bei der Ergebniskarte war srcObject immer null: thumb leer, _lastScanThumb null.
    // Und lief die Kamera doch, haette sie den Moment NACH dem Foto gezeigt, nicht das Foto.
    name: 'SB1 · Scan-Foto im Verlauf und in „Zu meinen Pflanzen": aus dem ANALYSIERTEN Bild, nicht aus dem (gestoppten) Video — und nie das Foto des vorigen Scans',
    lauf: async () => {
      const warte = (ms) => new Promise(r => setTimeout(r, ms));
      const bild = (farbe) => { const c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d'); g.fillStyle = farbe; g.fillRect(0, 0, 320, 240); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; };
      const mitte = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); const d = g.getImageData(i.width >> 1, i.height >> 1, 1, 1).data; ok([d[0], d[1], d[2]]); }; i.onerror = () => ok(null); i.src = src; });
      const rotGruen = (p) => p && p[0] > 180 && p[1] < 80 && p[2] < 80, blau = (p) => p && p[2] > 180 && p[0] < 80 && p[1] < 80;
      const sichern = { p: window.gsScanPersistToCloud, ort: window.gsPickScanLocation, li: window.sbIsLoggedIn, st: window.switchTab, mp: JSON.stringify(myPlants) };
      const klagen = [];
      try {
        window.gsScanPersistToCloud = () => Promise.resolve(true);
        const v = document.getElementById('video'); if (v) v.srcObject = null;      // wie nach analyzeImage
        localStorage.setItem('gs_scan_history', '[]');
        // 1 · erster Scan (rot): Verlauf und _lastScanThumb tragen DIESES Foto
        window._gsLastScanIdInfo = null;
        window._gsLastScanB64 = bild('#e01010'); window._gsLastScanMt = 'image/jpeg';
        showScanResult({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
        await warte(600);
        const h1 = JSON.parse(localStorage.getItem('gs_scan_history') || '[]')[0] || {};
        if (!/^data:image\//.test(h1.thumb || '')) klagen.push('Verlauf: kein Vorschaubild („' + String(h1.thumb || '').slice(0, 20) + '")');
        else if (!rotGruen(await mitte(h1.thumb))) klagen.push('Verlauf: das Vorschaubild zeigt nicht das gescannte Foto');
        if (!/^data:image\//.test(String(window._lastScanThumb || ''))) klagen.push('kein Foto für „Zu meinen Pflanzen" (_lastScanThumb ' + (window._lastScanThumb === null ? 'null' : typeof window._lastScanThumb) + ')');
        // 2 · zweiter Scan (blau): SOFORT danach traegt _lastScanThumb nicht mehr das rote Foto
        window._gsLastScanIdInfo = null;
        window._gsLastScanB64 = bild('#1010e0');
        showScanResult({ name: 'Löwenzahn', latin: 'Taraxacum officinale', confidence: 90, edible: true, toxic: false, toxicity: 0, alternatives: [], description: 'x' });
        if (window._lastScanThumb && rotGruen(await mitte(window._lastScanThumb))) klagen.push('direkt nach dem zweiten Scan trägt _lastScanThumb das Foto des ERSTEN');
        // „Zu meinen Pflanzen" gleich danach: es wartet auf das Foto dieses Scans
        window.gsPickScanLocation = async () => 'indoor'; window.sbIsLoggedIn = () => false; window.switchTab = () => {};
        const vorher = myPlants.length;
        await gsAddScanToMyPlants();
        const neu = myPlants.length > vorher ? myPlants[myPlants.length - 1] : null;
        if (!neu) klagen.push('„Zu meinen Pflanzen" legt keine Pflanze an — der Fall misst nichts');
        else if (!/^data:image\//.test(String(neu.photo || ''))) klagen.push('die neue Pflanze hat kein Foto („' + String(neu.photo || '').slice(0, 20) + '")');
        else if (!blau(await mitte(neu.photo))) klagen.push('die neue Pflanze trägt nicht das Foto des zweiten Scans');
      } finally {
        window.gsScanPersistToCloud = sichern.p; window.gsPickScanLocation = sichern.ort; window.sbIsLoggedIn = sichern.li; window.switchTab = sichern.st;
        try { myPlants.length = 0; JSON.parse(sichern.mp).forEach(x => myPlants.push(x)); savePlantsToStorage(); } catch (_) {}
        localStorage.setItem('gs_scan_history', '[]');
      }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Verlauf und „Zu meinen Pflanzen" tragen das gescannte Foto · nach einem neuen Scan nie das alte' };
    },
  },

  // ── v33.64 Pilz-Scanner (Brett 2026-11-11-2714): der Bildschirm mit dem höchsten Einsatz hatte keinen
  // einzigen Fall. Gerendert wird die ECHTE gsMushroomRenderResult mit Antworten in der Form der Function
  // (mushroom-identify), gemessen am Text des Bildschirms — nicht am Objekt.
  {
    name: 'PZ1 · Pilz tödlich: rotes Vollbild mit 145, Kopfzeile TÖDLICH, Notruf und Verwechslungs-Warnung — auch OHNE safety_color',
    lauf: async () => {
      const box = document.getElementById('mushroom-result');
      if (!box) return { ok: false, warum: '#mushroom-result fehlt — der Fall misst nichts' };
      const weg = () => { const o = document.getElementById('gs-mushroom-danger'); if (o) o.remove(); box.innerHTML = ''; };
      const antwort = (farbe) => ({
        matched_slug: 'amanita_phalloides', confidence: 92, reasoning: 'Grünlicher Hut, weisse Lamellen, Knolle mit Scheide.',
        mushroom: { slug: 'amanita_phalloides', common_name_de: 'Grüner Knollenblätterpilz', scientific_name: 'Amanita phalloides', family: 'Amanitaceae', edibility: 'toedlich', symptoms_if_toxic: 'Nach 6–24 h Brechdurchfall, danach Leberversagen.', emergency_action: 'Sofort Tox-Info anrufen.' },
        edibility: 'toedlich', safety_color: farbe, safety_advice: 'Tödlich giftig.',
        lookalikes: [{ edible_slug: 'russula_virescens', lookalike_slug: 'amanita_phalloides', confusion_risk: 'sehr_hoch_lebensgefahr', edible_common_name: 'Grasgrüner Täubling', visual_differences: 'Täublinge haben keine Knolle.' }],
        vapko_required: true, vapko_kontrollstelle: 'Pilzkontrolle Zürich', vapko_phone: '044 000 00 00',
      });
      const klagen = [];
      for (const farbe of ['red', null]) {
        weg();
        await gsMushroomRenderResult(antwort(farbe));
        const ov = document.getElementById('gs-mushroom-danger');
        const t = box.textContent || '';
        const kopf = (box.querySelector('div > div') || {}).textContent || '';
        const was = 'safety_color ' + JSON.stringify(farbe) + ': ';
        if (!ov) klagen.push(was + 'kein rotes Vollbild');
        else {
          if (!/TÖDLICH GIFTIG/.test(ov.textContent)) klagen.push(was + 'Vollbild ohne „TÖDLICH GIFTIG"');
          if (!ov.querySelector('a[href="tel:145"]')) klagen.push(was + 'Vollbild ohne Anruf 145');
        }
        if (!/TÖDLICH/.test(kopf)) klagen.push(was + 'Kopfzeile „' + kopf.slice(0, 50) + '" statt TÖDLICH');
        if (/Vorsicht|Speisepilz/.test(kopf)) klagen.push(was + 'Kopfzeile verharmlost: „' + kopf.slice(0, 50) + '"');
        if (!box.querySelector('a[href="tel:145"]')) klagen.push(was + 'kein Notruf 145 auf der Karte');
        if (!/VERWECHSLUNGS-RISIKO/.test(t) || !/LEBENSGEFAHR/.test(t)) klagen.push(was + 'Verwechslungs-Warnung fehlt');
        if (!/ersetzt KEINE offizielle Pilzkontrolle/.test(t)) klagen.push(was + 'Hinweis „ersetzt keine Pilzkontrolle" fehlt');
      }
      weg();
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'rot und ohne safety_color: Vollbild „TÖDLICH GIFTIG" + tel:145 · Kopfzeile TÖDLICH · Notruf · Lebensgefahr-Verwechsler · VAPKO-Hinweis' };
    },
  },
  {
    name: 'PZ2 · Pilz unsicher: unter der Schwelle des Servers (70 %) „NICHT essen" statt einer Essbarkeit — Kandidaten mit Namen, ein tödlicher mit Warnung, nie ein roher Slug',
    lauf: async () => {
      const box = document.getElementById('mushroom-result');
      if (!box) return { ok: false, warum: '#mushroom-result fehlt' };
      const weg = () => { const o = document.getElementById('gs-mushroom-danger'); if (o) o.remove(); box.innerHTML = ''; };
      const klagen = [];
      // a · kein Treffer, Kandidaten in der neuen Form (alternative_arten, Essbarkeit aus dem Register)
      weg();
      await gsMushroomRenderResult({ matched_slug: null, confidence: 40, mushroom: null, reasoning: 'Merkmale nicht eindeutig.', alternatives: ['amanita_phalloides', 'boletus_edulis'],
        alternative_arten: [{ slug: 'amanita_phalloides', name: 'Grüner Knollenblätterpilz', edibility: 'toedlich' }, { slug: 'boletus_edulis', name: 'Steinpilz', edibility: 'speisepilz' }], vapko_required: true });
      let t = box.textContent || '';
      if (!/UNSICHERE Identifikation/.test(t) || !/NICHT essen/.test(t)) klagen.push('a: „unsicher / NICHT essen" fehlt');
      if (!/Grüner Knollenblätterpilz\s*☠️\s*TÖDLICH/.test(t)) klagen.push('a: der tödliche Kandidat trägt keine Warnung („' + (t.match(/Möglicher Kandidat:[^\n]*/) || [''])[0].slice(0, 90) + '")');
      if (/Steinpilz\s*[☠⚠]/.test(t)) klagen.push('a: der Speisepilz trägt eine Warnung');
      if (/[a-z]+_[a-z]+/.test(t)) klagen.push('a: roher Slug auf dem Bildschirm (' + t.match(/[a-z]+_[a-z]+/)[0] + ')');
      if (document.getElementById('gs-mushroom-danger')) klagen.push('a: Vollbild ohne Treffer');
      // b · ältere Function: nur Slugs → lesbare Namen, kein Unterstrich
      weg();
      await gsMushroomRenderResult({ matched_slug: null, confidence: 35, mushroom: null, alternatives: ['amanita_phalloides', 'roehrling_flockenstielig'], vapko_required: true });
      t = box.textContent || '';
      if (!/Amanita phalloides/.test(t) || !/Roehrling flockenstielig/.test(t)) klagen.push('b: Slugs nicht lesbar gemacht („' + (t.match(/Möglicher Kandidat:[^\n]*/) || [''])[0].slice(0, 90) + '")');
      if (/_/.test(t)) klagen.push('b: Unterstrich auf dem Bildschirm');
      // c · Treffer bei 65 %: der Server verlangt die Kontrolle — die Karte darf nicht „Speisepilz" sagen
      weg();
      await gsMushroomRenderResult({ matched_slug: 'boletus_edulis', confidence: 65, mushroom: { slug: 'boletus_edulis', common_name_de: 'Steinpilz', scientific_name: 'Boletus edulis', edibility: 'speisepilz' }, edibility: 'speisepilz', safety_color: 'green', vapko_required: true });
      t = box.textContent || '';
      if (/Speisepilz/.test(t) && !/UNSICHERE/.test(t)) klagen.push('c: bei 65 % steht „Speisepilz" (der Server verlangt die Kontrolle unter 70 %)');
      if (!/NICHT essen/.test(t)) klagen.push('c: bei 65 % fehlt „NICHT essen"');
      // d · Gegenrichtung: 70 % ist eine Bestimmung — sonst wäre ein Scanner, der IMMER „unsicher" sagt, grün
      weg();
      await gsMushroomRenderResult({ matched_slug: 'boletus_edulis', confidence: 70, mushroom: { slug: 'boletus_edulis', common_name_de: 'Steinpilz', scientific_name: 'Boletus edulis', edibility: 'speisepilz' }, edibility: 'speisepilz', safety_color: 'green', vapko_required: false });
      t = box.textContent || '';
      if (!/Speisepilz/.test(t) || /UNSICHERE/.test(t)) klagen.push('d: bei 70 % keine Bestimmung („' + t.slice(0, 60) + '")');
      if (typeof GS_PILZ_SICHER_AB === 'undefined' || GS_PILZ_SICHER_AB !== 70) klagen.push('GS_PILZ_SICHER_AB ist ' + (typeof GS_PILZ_SICHER_AB === 'undefined' ? 'nicht definiert' : GS_PILZ_SICHER_AB));
      weg();
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '40 %: NICHT essen, Kandidat „Grüner Knollenblätterpilz ☠️ TÖDLICH", Steinpilz ohne Warnung · alte Form: „Amanita phalloides" statt Slug · 65 %: unsicher · 70 %: Speisepilz' };
    },
  },
  {
    name: 'PZ3 · Pilz essbar: grüne Karte mit Zubereitung, kein Vollbild — und der Hinweis „ersetzt keine Pilzkontrolle" steht trotzdem da',
    lauf: async () => {
      const box = document.getElementById('mushroom-result');
      if (!box) return { ok: false, warum: '#mushroom-result fehlt' };
      const o0 = document.getElementById('gs-mushroom-danger'); if (o0) o0.remove();
      box.innerHTML = '';
      await gsMushroomRenderResult({ matched_slug: 'boletus_edulis', confidence: 90, reasoning: 'Netz am Stiel, weisse Poren.', mushroom: { slug: 'boletus_edulis', common_name_de: 'Steinpilz', scientific_name: 'Boletus edulis', family: 'Boletaceae', edibility: 'speisepilz', cooking_preparation: 'Braten oder trocknen.' },
        edibility: 'speisepilz', safety_color: 'green', vapko_required: false, vapko_kontrollstelle: 'Pilzkontrolle Bern', lookalikes: [] });
      const t = box.textContent || '', klagen = [];
      const kopf = (box.querySelector('div > div') || {}).textContent || '';
      if (!/Speisepilz/.test(kopf)) klagen.push('Kopfzeile „' + kopf.slice(0, 40) + '"');
      if (document.getElementById('gs-mushroom-danger')) klagen.push('Vollbild bei einem Speisepilz');
      if (!/Zubereitung/.test(t)) klagen.push('Zubereitung fehlt');
      if (!/ersetzt KEINE offizielle Pilzkontrolle/.test(t)) klagen.push('Hinweis „ersetzt keine Pilzkontrolle" fehlt');
      if (!/Pilzkontrolle Bern/.test(t)) klagen.push('Kontrollstelle fehlt');
      box.innerHTML = '';
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Kopfzeile Speisepilz · kein Vollbild · Zubereitung · Kontrollstelle · Hinweis „ersetzt keine Pilzkontrolle"' };
    },
  },
  {
    name: 'PZ4 · Pilz-Scan: ein Fehler ist ein Satz (nie „rate_limited" oder „invalid token"), der feste Satz des Servers bleibt — und eine Antwort nach dem Abmelden kommt nicht auf den Bildschirm',
    lauf: async () => {
      const box = document.getElementById('mushroom-result');
      if (!box) return { ok: false, warum: '#mushroom-result fehlt' };
      const s = { f: window._gsFetch, tok: window._gsFreshToken, toast: window.showProfileToast, li: window.sbIsLoggedIn, foto: window._gsMushroomPhotoB64 };
      const toasts = [];
      const klagen = [];
      const tod = { matched_slug: 'amanita_phalloides', confidence: 92, mushroom: { slug: 'amanita_phalloides', common_name_de: 'Grüner Knollenblätterpilz', scientific_name: 'Amanita phalloides', edibility: 'toedlich' }, edibility: 'toedlich', safety_color: 'red', vapko_required: true };
      const lauf = async (status, body, waehrend) => {
        toasts.length = 0; box.innerHTML = '';
        const o = document.getElementById('gs-mushroom-danger'); if (o) o.remove();
        window._gsFetch = async () => { if (waehrend) waehrend(); return { ok: status >= 200 && status < 300, status, json: async () => { if (body === 'html') throw new SyntaxError('Unexpected token <'); return body; } }; };
        await gsMushroomRunScan();
        window.sbIsLoggedIn = s.li;
        return toasts.filter(x => x.typ === 'error').map(x => x.text).join(' | ');
      };
      try {
        window._gsFreshToken = async () => 'tok';
        window.showProfileToast = (text, typ) => toasts.push({ text: String(text), typ });
        window._gsMushroomPhotoB64 = 'data:image/jpeg;base64,AAAA';
        if (!(typeof sbIsLoggedIn === 'function' && sbIsLoggedIn()) || !_gsPerson()) return { ok: false, warum: 'keine angemeldete Sitzung — der Fall misst nichts' };
        let t = await lauf(429, { error: 'rate_limited', message: 'Zu viele Pilz-Scans in kurzer Zeit — bitte etwas später erneut.' });
        if (!/Zu viele Pilz-Scans/.test(t) || /rate_limited/.test(t)) klagen.push('429: „' + t + '"');
        t = await lauf(401, { error: 'invalid token' });
        if (/invalid token/.test(t) || !/Sitzung/.test(t)) klagen.push('401: „' + t + '"');
        t = await lauf(429, { error: 'Tageslimit für diese KI-Funktion erreicht. Morgen geht es weiter — oder mit einem Abo mehr.', code: 'quota_exceeded' });
        if (!/Tageslimit für diese KI-Funktion erreicht/.test(t)) klagen.push('KI-Tor: der feste Satz fehlt („' + t + '")');
        t = await lauf(502, 'html');
        if (!t || /Unexpected token/.test(t)) klagen.push('502 ohne JSON: „' + t + '"');
        // Abmelden WÄHREND der Bestimmung: die (tödliche) Antwort gehört der Person, die gefragt hat
        t = await lauf(200, tod, () => { window.sbIsLoggedIn = () => false; });
        if ((box.textContent || '').trim() || document.getElementById('gs-mushroom-danger')) klagen.push('nach dem Abmelden: die Antwort steht auf dem Bildschirm');
        // Gegenprobe: ohne Abmelden kommt sie an — sonst wäre ein Lauf, der nie zeichnet, grün
        t = await lauf(200, tod);
        if (!document.getElementById('gs-mushroom-danger') || !/TÖDLICH/.test(box.textContent || '')) klagen.push('Gegenprobe: ohne Abmelden kommt die Antwort nicht an');
      } finally {
        window._gsFetch = s.f; window._gsFreshToken = s.tok; window.showProfileToast = s.toast; window.sbIsLoggedIn = s.li; window._gsMushroomPhotoB64 = s.foto;
        const o = document.getElementById('gs-mushroom-danger'); if (o) o.remove();
        box.innerHTML = '';
      }
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: '429 → „Zu viele Pilz-Scans …" · 401 → Sitzung · Satz des KI-Tors bleibt · 502 ohne JSON → Satz · abgemeldet: nichts gezeichnet · Gegenprobe: angemeldet gezeichnet' };
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
    // HOME-2: dieselben Wetterwerte in BEIDEN Formaten von Open-Meteo — `current` (loadHomeWeather)
    // und `current_weather` (Zwischenspeicher, gsApplyWeatherToWidget). Stunden ab heute 00:00
    // Ortszeit, wie Open-Meteo sie liefert; `aendern(d)` stellt einzelne Werte um.
    window.__wetterDaten = function (aendern) {
      const pad = (n) => String(n).padStart(2, '0');
      const lokal = (x) => x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate()) + 'T' + pad(x.getHours()) + ':00';
      const heute = new Date(); const tag0 = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate());
      const zeiten = [], tage = [];
      for (let i = 0; i < 48; i++) zeiten.push(lokal(new Date(tag0.getTime() + i * 3600000)));
      for (let i = 0; i < 4; i++) { const t = new Date(tag0.getTime() + i * 86400000); tage.push(t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate())); }
      const d = { temp: 1.4, code: 3, wind: 12, feucht: 81, uv: 1, mins: [-1, 0, 1, 2], maxs: [6, 7, 8, 9], tageCode: [3, 61, 0, 2],
                  stundenCode: zeiten.map(() => 3), stundenWind: zeiten.map(() => 12), stundenRegen: zeiten.map(() => 10) };
      if (typeof aendern === 'function') aendern(d);
      const voll = (w) => zeiten.map(() => w);
      return {
        neu: { current: { temperature_2m: d.temp, weather_code: d.code, wind_speed_10m: d.wind, relative_humidity_2m: d.feucht, uv_index: d.uv },
               hourly: { time: zeiten, weather_code: d.stundenCode, wind_speed_10m: d.stundenWind, precipitation_probability: d.stundenRegen },
               daily: { time: tage, weather_code: d.tageCode, temperature_2m_max: d.maxs, temperature_2m_min: d.mins } },
        alt: { current_weather: { temperature: d.temp, weathercode: d.code, windspeed: d.wind },
               hourly: { time: zeiten, relativehumidity_2m: voll(d.feucht), uv_index: voll(d.uv), weathercode: d.stundenCode, windspeed_10m: d.stundenWind, precipitation_probability: d.stundenRegen },
               daily: { time: tage, weathercode: d.tageCode, temperature_2m_max: d.maxs, temperature_2m_min: d.mins } },
      };
    };
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
  // HK2 braucht eine EIGENE Seite: die zuletzt gezeigte Karte steht im sessionStorage, und gelesen
  // wird sie beim Bau der Reihe — also beim Laden. Gegnerische Prüfung (16.11.2026): die Reihe wird
  // gebaut, bevor Saison-Tipp und „Wusstest du?" gefüllt sind; eine gemerkte Karte 3 wurde verworfen.
  {
    const name = 'HK2 · Kartenreihe: die zuletzt gezeigte Karte kommt nach dem Neuladen wieder — auch wenn sie erst nach dem Bau der Reihe gefüllt wird';
    let r;
    try {
      const p2 = await ctx.newPage();
      await p2.route('**', (rr) => rr.request().url().startsWith('file:') ? rr.continue() : rr.abort());
      await p2.addInitScript(SEED);
      await p2.addInitScript(() => {
        try { sessionStorage.setItem('gs_home_widget_idx', '3'); } catch (_) {}
        // N beim Bau mitschreiben — so ist sichtbar, ob der Fall den Zustand herstellt, den er prüft
        let echt;
        Object.defineProperty(window, 'gsBuildWidgetStack', { configurable: true, get() { return echt; }, set(fn) { echt = function () { const x = fn.apply(this, arguments); if (window.__nBau == null && window._gsWStackBuilt) window.__nBau = window._gsWStackN; return x; }; } });
      });
      await p2.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
      await p2.waitForTimeout(6000);
      r = await p2.evaluate(() => {
        const nBau = window.__nBau, n = window._gsWStackN || 0;
        const aktiv = [].slice.call(document.querySelectorAll('#gs-wstack-dots .gs-wdot')).findIndex((d) => d.getAttribute('aria-selected') === 'true');
        if (nBau == null) return { ok: false, warum: 'die Reihe wurde nicht gebaut — der Fall misst nichts' };
        if (n < 4) return { ok: false, warum: 'nach dem Laden nur ' + n + ' Karten — Karte 4 gibt es nicht, der Fall misst nichts' };
        if (nBau > 3) return { ok: false, warum: 'beim Bau schon ' + nBau + ' Karten — der Fall stellt den Zustand nicht her, den er prüft' };
        if (aktiv !== 3) return { ok: false, warum: 'gemerkt war Karte 4 (Index 3), beim Bau gab es ' + nBau + ' Karten, jetzt ' + n + ' — gezeigt wird Index ' + aktiv };
        return { ok: true, info: 'gemerkt Index 3 · beim Bau ' + nBau + ' Karten, jetzt ' + n + ' · gezeigt Index ' + aktiv };
      });
      await p2.close();
    } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Fälle geprueft: ' + (FAELLE.length + 1) + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = (kaputt || !da) ? 1 : 0;
})();
