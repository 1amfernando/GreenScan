#!/usr/bin/env node
/**
 * planer_check.js — rechnet der Planer, was er behauptet?
 *
 * Das Pruefwerk (`_gsPlanPruefwerk`, index.html) hat dreizehn rechnende
 * Regeln und hatte bis v31.93 keinen Pruefstand. Das ist die schlechteste
 * Kombination, die es gibt: eine Pruefung, die selbst ungeprueft ist, sagt
 * „alles in Ordnung" auch dann noch, wenn sie gar nichts mehr rechnet.
 *
 * Zwei Lehren aus CLAUDE.md §4b stehen hier als Bauplan drin:
 *
 *   1. „Eine Pruefung, die die richtigen Faelle meldet, ist wertlos."
 *      Deshalb laeuft jede Regel hier gegen einen GUTEN Plan (darf nichts
 *      melden) UND gegen einen schlechten (muss melden). Nur beides
 *      zusammen ist eine Aussage.
 *
 *   2. Jede Regel hat drei Zustaende: erfuellt · verletzt · nicht pruefbar.
 *      „Nicht pruefbar" MUSS `null` sein und einen Grund nennen — `{}` oder
 *      `0` liesse sich als „alles in Ordnung" lesen. Der Pruefstand haelt
 *      genau das fest.
 *
 * Die Faelle laufen IM Browser, gegen die echte index.html, mit den
 * Beispieldaten aus _seed.js. Kein Netz, keine KI — geprueft wird nur, was
 * der Code selbst ausrechnet.
 *
 *   node scripts/planer_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

// Ein Fall: Ausgangslage herstellen, Plan durchrechnen, Ergebnis pruefen.
// `lauf` laeuft im Browser und gibt {ok, warum} zurueck.
const FAELLE = [

  // ── R11 · Fruchtfolge je Beet (v31.93) ──────────────────────────────────
  {
    name: 'R11 · Beet-Wechsel: Tomate meidet das Beet vom letzten Jahr',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet C', x_m: 2.8, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        // In Beet A stand dieses Jahr eine Tomate — Nachtschatten.
        zwillingPflanzen: [{ name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 }],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      const p = plan.plants[0];
      if (!plan._beetfolge) return { ok: false, warum: 'keine Beet-Fruchtfolge gerechnet: ' + (plan._beetfolge_grund || '?') };
      if (p._beet_txt === 'Beet A') return { ok: false, warum: 'Tomate blieb in Beet A, obwohl B und C frei sind' };
      if (plan._beetfolge.konflikt.length) return { ok: false, warum: 'Konflikt gemeldet, obwohl ausgewichen wurde' };
      if (!p._beet_txt) return { ok: false, warum: 'Pflanze liegt in keinem Beet' };
      return { ok: true, info: 'gesetzt in ' + p._beet_txt };
    },
  },
  {
    name: 'R11 · kein Ausweg → ehrlicher Konflikt MIT Vorschlag',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [
          { name: 'Tomate',   x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 },
          { name: 'Kohlrabi', x_m: 1.6, y_m: 0.2, w_m: 0.5, h_m: 0.5 },
        ],
      });
      // Beide Beete tragen dieses Jahr eine Familie. Die Tomate MUSS also in
      // eines der beiden — aber Beet B (Kreuzbluetler) ist fuer sie besser.
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      const p = plan.plants[0];
      if (!plan._beetfolge) return { ok: false, warum: 'nicht gerechnet' };
      if (p._beet_txt !== 'Beet B') return { ok: false, warum: 'landete in ' + (p._beet_txt || '(keinem Beet)') + ', erwartet Beet B' };
      if (plan._beetfolge.konflikt.length) return { ok: false, warum: 'Konflikt gemeldet, obwohl Beet B fuer Nachtschatten frei ist' };
      return { ok: true, info: 'Beet B gewaehlt (dort stand Kreuzbluetler, nicht Nachtschatten)' };
    },
  },
  {
    name: 'R11 · beide Beete belegt → Konflikt wird benannt, nicht verschwiegen',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [
          { name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 },
          { name: 'Tomate', x_m: 1.6, y_m: 0.2, w_m: 0.5, h_m: 0.5 },
        ],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      if (!plan._beetfolge) return { ok: false, warum: 'nicht gerechnet' };
      const k = plan._beetfolge.konflikt;
      if (!k.length) return { ok: false, warum: 'kein Konflikt gemeldet, obwohl in BEIDEN Beeten dieses Jahr Nachtschatten stand' };
      if (k[0].besser) return { ok: false, warum: 'nennt „' + k[0].besser + '" als besser — es gibt aber kein besseres Beet' };
      if (plan._beetfolge.ok) return { ok: false, warum: 'meldet gleichzeitig ' + plan._beetfolge.ok + ' erfuellte Kulturen' };
      return { ok: true, info: k[0].name + ' in ' + k[0].beet + ', Pause ' + k[0].pause + ' Jahre' };
    },
  },
  {
    name: 'R11 · fruehere Pläne derselben Fläche zaehlen mit',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [],
        // Kein Zwilling-Bestand, aber ein Plan von letztem Jahr: Tomate in A.
        altePlaene: [{
          id: 'plan-alt', created: new Date(new Date().getFullYear() - 1, 4, 1).toISOString(),
          plan: { bed: { width_m: 4, length_m: 3 },
                  plants: [{ name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 }] },
        }],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      if (!plan._beetfolge) return { ok: false, warum: 'nicht gerechnet: ' + (plan._beetfolge_grund || '?') };
      if (!plan._beetfolge.quellen.plaene) return { ok: false, warum: 'der alte Plan wurde nicht gelesen' };
      if (plan.plants[0]._beet_txt === 'Beet A') return { ok: false, warum: 'wieder in Beet A gesetzt' };
      return { ok: true, info: plan._beetfolge.quellen.plaene + ' Eintrag/Eintraege aus alten Plaenen' };
    },
  },
  {
    name: 'R11 · Plan anderer Fläche wird NICHT verwendet (Koordinaten lägen falsch)',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [],
        altePlaene: [{
          id: 'plan-fremd', created: new Date(new Date().getFullYear() - 1, 4, 1).toISOString(),
          plan: { bed: { width_m: 12, length_m: 9 },     // ganz andere Flaeche
                  plants: [{ name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 }] },
        }],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      if (plan._beetfolge) return { ok: false, warum: 'hat gerechnet, obwohl die einzige Quelle eine andere Flaeche ist' };
      if (!plan._beetfolge_grund) return { ok: false, warum: 'kein Grund genannt — „nicht pruefbar" ohne Grund ist eine leere Anzeige' };
      return { ok: true, info: 'null + Grund: ' + plan._beetfolge_grund.slice(0, 48) + '…' };
    },
  },
  {
    name: 'R11 · nur ein Beet → nicht pruefbar, mit Grund',
    lauf: () => {
      _pfAufbau({
        beete: [{ label: 'Beet A', x_m: 0, y_m: 0, w_m: 3.8, h_m: 2.8 }],
        zwillingPflanzen: [{ name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 }],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      if (plan._beetfolge) return { ok: false, warum: 'rechnet einen Beet-Wechsel bei einem einzigen Beet' };
      if (!/ein Beet/.test(plan._beetfolge_grund || '')) return { ok: false, warum: 'Grund passt nicht: ' + plan._beetfolge_grund };
      return { ok: true, info: plan._beetfolge_grund };
    },
  },
  {
    name: 'R11 · gar keine Beete → nicht pruefbar, und der Platzierer laeuft trotzdem',
    lauf: () => {
      _pfAufbau({ beete: [], zwillingPflanzen: [{ name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 }] });
      const plan = _pfPlan([{ name: 'Kohlrabi', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      if (plan._beetfolge) return { ok: false, warum: 'rechnet ohne Beete' };
      const p = plan.plants[0];
      if (!isFinite(p.x_m) || !isFinite(p.y_m)) return { ok: false, warum: 'Pflanze hat keine Koordinaten mehr' };
      if (p._kein_platz) return { ok: false, warum: 'meldet „kein Platz" auf leerer Flaeche' };
      return { ok: true, info: 'ohne Beete gesetzt auf ' + p.x_m + '/' + p.y_m };
    },
  },
  {
    name: 'R11 · unbekannte Familie verhindert nichts (wird als ungeprueft gezaehlt)',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [{ name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 }],
      });
      const plan = _pfPlan([{ name: 'Zzzfantasiekraut', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      const p = plan.plants[0];
      if (!p._beet_txt) return { ok: false, warum: 'ohne bekannte Familie gar nicht ins Beet gesetzt' };
      if (!plan._beetfolge) return { ok: false, warum: 'nicht gerechnet' };
      if (!plan._beetfolge.ungeprueft) return { ok: false, warum: 'nicht als „ungeprueft" gezaehlt — dann behauptet die Anzeige etwas' };
      return { ok: true, info: plan._beetfolge.ungeprueft + ' ohne Familie, trotzdem in ' + p._beet_txt };
    },
  },

  // ── R12 · Nachkultur je Beet (v31.94) ───────────────────────────────────
  {
    name: 'R12 · Nachkultur: Beet wird frei, Vorschlag kommt MIT Ort und Fläche',
    lauf: () => {
      _pfAufbau({
        beete: [{ label: 'Frühbeet', x_m: 0, y_m: 0, w_m: 1.2, h_m: 2 }],
        zwillingPflanzen: [],
      });
      // Kohlrabi ist im Juli abgeerntet — danach bleibt die halbe Saison.
      const plan = _pfPlan([{ name: 'Kohlrabi', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 0.1,
                              sow_date: '2026-04-01', harvest_from: '2026-06-15', harvest_to: '2026-07-10' }]);
      if (!plan._nachkultur) return { ok: false, warum: 'nicht gerechnet: ' + (plan._nachkultur_grund || '?') };
      const b = plan._nachkultur.beete[0];
      if (!b) return { ok: false, warum: 'kein Beet gemeldet, obwohl das Frühbeet im Juli frei wird' };
      if (b.label !== 'Frühbeet') return { ok: false, warum: 'falsches Beet: ' + b.label };
      if (!b.flaeche) return { ok: false, warum: 'keine Fläche genannt — dann ist es wieder nur eine Zeitangabe' };
      // Kreuzbluetler standen dieses Jahr hier — duerfen NICHT vorgeschlagen werden.
      const kreuz = b.vorschlaege.filter(v => /Kreuzbl/.test(v.family));
      if (kreuz.length) return { ok: false, warum: 'schlägt dieselbe Familie vor: ' + kreuz.map(v => v.crop).join(', ') };
      return { ok: true, info: b.label + ' frei, ' + b.flaeche + ' m², ' + b.tage + ' Tage → ' + b.vorschlaege.map(v => v.crop).join(', ') };
    },
  },
  {
    name: 'R12 · Beet-Vorgeschichte schliesst Vorschläge aus (nicht nur der Plan)',
    lauf: () => {
      _pfAufbau({
        beete: [{ label: 'Frühbeet', x_m: 0, y_m: 0, w_m: 1.2, h_m: 2 }],
        // Spinat (Fuchsschwanz) stand dieses Jahr schon hier.
        zwillingPflanzen: [{ name: 'Spinat', x_m: 0.9, y_m: 1.5, w_m: 0.2, h_m: 0.2 }],
      });
      const plan = _pfPlan([{ name: 'Kohlrabi', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 0.1,
                              sow_date: '2026-04-01', harvest_from: '2026-06-15', harvest_to: '2026-07-10' }]);
      if (!plan._nachkultur || !plan._nachkultur.beete.length) return { ok: false, warum: 'nicht gerechnet' };
      const v = plan._nachkultur.beete[0].vorschlaege;
      if (v.some(x => x.crop === 'Spinat')) return { ok: false, warum: 'schlägt Spinat vor, obwohl er dieses Jahr in diesem Beet stand' };
      if (!v.length) return { ok: false, warum: 'gar kein Vorschlag mehr — zu streng' };
      return { ok: true, info: 'ohne Spinat: ' + v.map(x => x.crop).join(', ') };
    },
  },
  {
    name: 'R12 · eine Pflanze ohne Erntedatum → gesagt, nicht geraten',
    lauf: () => {
      _pfAufbau({ beete: [{ label: 'Frühbeet', x_m: 0, y_m: 0, w_m: 1.2, h_m: 2 }], zwillingPflanzen: [] });
      const plan = _pfPlan([
        { name: 'Kohlrabi', w_m: 0.5, h_m: 0.5, x_m: 0.1, y_m: 0.1,
          sow_date: '2026-04-01', harvest_from: '2026-06-15', harvest_to: '2026-07-10' },
        { name: 'Radieschen', w_m: 0.3, h_m: 0.3, x_m: 0.1, y_m: 1.0, sow_date: '2026-04-01' },
      ]);
      if (!plan._nachkultur) return { ok: false, warum: 'nicht gerechnet: ' + (plan._nachkultur_grund || '?') };
      if (plan._nachkultur.beete.length) return { ok: false, warum: 'behauptet ein Freiwerdedatum, obwohl eine Pflanze keines hat' };
      if (!plan._nachkultur.offen.length) return { ok: false, warum: 'sagt gar nichts — dann fehlt die Angabe stillschweigend' };
      return { ok: true, info: plan._nachkultur.offen[0].label + ': ' + plan._nachkultur.offen[0].warum };
    },
  },
  {
    name: 'R12 · späte Ernte → keine Nachkultur behauptet',
    lauf: () => {
      _pfAufbau({ beete: [{ label: 'Frühbeet', x_m: 0, y_m: 0, w_m: 1.2, h_m: 2 }], zwillingPflanzen: [] });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 0.1,
                             sow_date: '2026-04-05', harvest_from: '2026-07-15', harvest_to: '2026-10-10' }]);
      if (plan._nachkultur && plan._nachkultur.beete.length)
        return { ok: false, warum: 'schlägt eine Nachkultur vor, obwohl erst im Oktober geerntet wird' };
      if (!plan._nachkultur_grund && !(plan._nachkultur && plan._nachkultur.offen.length))
        return { ok: false, warum: 'weder Vorschlag noch Grund' };
      return { ok: true, info: plan._nachkultur_grund || 'nichts behauptet' };
    },
  },
  {
    name: 'R12 · Anzeige: die Nachkultur-Zeile steht wirklich in der Plan-Prüfung',
    lauf: () => {
      _pfAufbau({ beete: [{ label: 'Frühbeet', x_m: 0, y_m: 0, w_m: 1.2, h_m: 2 }], zwillingPflanzen: [] });
      const plan = _pfPlan([{ name: 'Kohlrabi', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 0.1,
                             sow_date: '2026-04-01', harvest_from: '2026-06-15', harvest_to: '2026-07-10' }]);
      const html = gsPPrenderPlan(plan, { width: 4, length: 3 });
      if (html.indexOf('Nachkultur') < 0) return { ok: false, warum: 'die Zeile fehlt im gerenderten Plan' };
      const d = document.createElement('div'); d.innerHTML = html;
      const txt = d.textContent || '';
      if (/undefined|NaN|\[object Object\]|Invalid Date/.test(txt))
        return { ok: false, warum: 'Platzhalter im Text: ' + txt.slice(txt.search(/undefined|NaN|\[object|Invalid/), 90) };
      const m = txt.match(/Frühbeet wird am [^—]+/);
      if (!m) return { ok: false, warum: 'kein Freiwerdedatum im Text' };
      return { ok: true, info: m[0].trim() };
    },
  },

  // ── Der Auftragstext an die KI ──────────────────────────────────────────
  // Was im Prompt nicht steht, kann die KI nicht beachten. Und ein Prompt-
  // Baustein, der still '' zurueckgibt, sieht aus wie einer, der funktioniert.
  {
    name: 'Prompt · Beet-Vorgeschichte steht wirklich im Auftragstext',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [{ name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.5, h_m: 0.5 }],
      });
      const ctx = gsPPbuildUserContext();
      if (!ctx.twin) return { ok: false, warum: 'gsPPbuildUserContext liefert keinen Zwilling' };
      const txt = gsPPtwinBlock(ctx.twin);
      if (!txt) return { ok: false, warum: 'gsPPtwinBlock gibt einen leeren Text zurueck' };
      if (txt.indexOf('BEET-VORGESCHICHTE') < 0) return { ok: false, warum: 'keine Beet-Vorgeschichte im Text' };
      if (txt.indexOf('Nachtschatten') < 0) return { ok: false, warum: 'die Familie aus dem Zwilling fehlt' };
      if (txt.indexOf('Beet B: nichts bekannt') < 0) return { ok: false, warum: 'ein leeres Beet wird nicht als leer benannt' };
      return { ok: true, info: txt.split('\n').filter(l => /Beet [AB]:/.test(l)).join(' | ') };
    },
  },
  {
    name: 'Prompt · gescannter, aber LEERER Garten nennt trotzdem seine Beete',
    lauf: () => {
      _pfAufbau({
        beete: [{ label: 'Hochbeet', x_m: 0, y_m: 0, w_m: 1.2, h_m: 3 }],
        zwillingPflanzen: [],
      });
      const ctx = gsPPbuildUserContext();
      if (!ctx.twin) return { ok: false, warum: 'ohne Pflanzen kein Zwilling im Kontext — die Beete faellen unter den Tisch' };
      const txt = gsPPtwinBlock(ctx.twin);
      if (!txt || txt.indexOf('Hochbeet') < 0) return { ok: false, warum: 'das Beet steht nicht im Auftragstext' };
      return { ok: true, info: 'leerer Garten, Beet im Prompt' };
    },
  },

  // ── Der gute Plan: hier darf NICHTS gemeldet werden ──────────────────────
  {
    name: 'Guter Plan · drei Familien, drei Beete → kein einziger Vorwurf',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet C', x_m: 2.8, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [{ name: 'Spinat', x_m: 0.2, y_m: 0.2, w_m: 0.4, h_m: 0.4 }],
      });
      const plan = _pfPlan([
        { name: 'Tomate',     w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 },
        { name: 'Kohlrabi',   w_m: 0.5, h_m: 0.5, x_m: 1.5, y_m: 1.0 },
        { name: 'Buschbohne', w_m: 0.5, h_m: 0.5, x_m: 2.9, y_m: 1.0 },
      ]);
      if (!plan._beetfolge) return { ok: false, warum: 'nicht gerechnet' };
      if (plan._beetfolge.konflikt.length)
        return { ok: false, warum: 'meldet ' + plan._beetfolge.konflikt.length + ' Konflikt(e) in einem sauberen Plan: ' +
                                    plan._beetfolge.konflikt.map(k => k.name + '/' + k.beet).join(', ') };
      if (plan._beetfolge.ok !== 3) return { ok: false, warum: 'nur ' + plan._beetfolge.ok + ' von 3 als erfuellt gezaehlt' };
      if (plan._beete && plan._beete.daneben.length)
        return { ok: false, warum: plan._beete.daneben.join(', ') + ' liegen ausserhalb der Beete' };
      return { ok: true, info: '3 Kulturen, 3 Beete, keine Meldung' };
    },
  },
  {
    name: 'Guter Plan · Musterplan aus _seed.js loest keinen Fehlalarm aus',
    lauf: () => {
      _pfAufbau({ beete: [], zwillingPflanzen: [] });
      localStorage.removeItem('gs_plantings');
      localStorage.removeItem('gs_ernte_log');
      window.myPlants = [];
      const plan = JSON.parse(JSON.stringify(window._PF_MUSTER));
      _gsSanitizePlannerPlan(plan);
      _gsPlanPruefwerk(plan, { width: 4, length: 3 });
      const klagen = [];
      if (plan._aussaat && plan._aussaat.falsch && plan._aussaat.falsch.length) klagen.push('Aussaat: ' + plan._aussaat.falsch.map(f => f.name).join(','));
      if (plan._dauer && plan._dauer.kurz.length) klagen.push('Standdauer: ' + plan._dauer.kurz.map(f => f.name).join(','));
      if (plan._folge && plan._folge.konflikt.length) klagen.push('Fruchtfolge: ' + plan._folge.konflikt.map(f => f.name).join(','));
      if (plan._ohnePlatz && plan._ohnePlatz.length) klagen.push('Platz: ' + plan._ohnePlatz.join(','));
      return klagen.length ? { ok: false, warum: 'Fehlalarm — ' + klagen.join(' · ') } : { ok: true, info: 'kein Fehlalarm' };
    },
  },

  // ── Die Anzeige ─────────────────────────────────────────────────────────
  // v31.90 hat es teuer gezeigt: ein Anzeige-Block kann tot sein, ohne dass
  // irgendetwas einen Fehler meldet — die Karte sah nur unveraendert aus.
  // Also wird hier das gerenderte HTML gelesen, nicht der Zustand im Objekt.
  {
    name: 'Anzeige · die Beet-Wechsel-Zeile steht wirklich in der Plan-Prüfung',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [
          { name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.4, h_m: 0.4 },
          { name: 'Tomate', x_m: 1.6, y_m: 0.2, w_m: 0.4, h_m: 0.4 },
        ],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      const html = gsPPrenderPlan(plan, { width: 4, length: 3 });
      if (html.indexOf('Beet-Wechsel') < 0) return { ok: false, warum: 'die Zeile fehlt im gerenderten Plan' };
      if (html.indexOf('Nachtschatten') < 0) return { ok: false, warum: 'die Familie wird nicht genannt' };
      const d = document.createElement('div'); d.innerHTML = html;
      const txt = d.textContent || '';
      if (/undefined|NaN|\[object Object\]/.test(txt)) return { ok: false, warum: 'Platzhalter im Text: ' + txt.slice(txt.search(/undefined|NaN|\[object/), 90) };
      // Und die Begruendung an der Pflanze selbst.
      if (!(plan.plants[0]._warum || []).some(w => /Beet [AB]/.test(w)))
        return { ok: false, warum: 'die Pflanze sagt nicht, in welchem Beet sie liegt' };
      return { ok: true, info: (plan.plants[0]._warum || []).filter(w => /Beet/.test(w)).join(' · ') };
    },
  },
  {
    name: 'Anzeige · guter Plan zeigt die Verteilung, nicht einen Vorwurf',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet C', x_m: 2.8, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [{ name: 'Spinat', x_m: 0.2, y_m: 0.2, w_m: 0.4, h_m: 0.4 }],
      });
      const plan = _pfPlan([
        { name: 'Tomate',     w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 },
        { name: 'Kohlrabi',   w_m: 0.5, h_m: 0.5, x_m: 1.5, y_m: 1.0 },
        { name: 'Buschbohne', w_m: 0.5, h_m: 0.5, x_m: 2.9, y_m: 1.0 },
      ]);
      const html = gsPPrenderPlan(plan, { width: 4, length: 3 });
      if (html.indexOf('Verteilung') < 0) return { ok: false, warum: 'die Verteilung auf die Beete wird nicht gezeigt' };
      const d = document.createElement('div'); d.innerHTML = html;
      const txt = d.textContent || '';
      const m = txt.match(/Verteilung[^.]*\./);
      if (/undefined|NaN/.test(txt)) return { ok: false, warum: 'Platzhalter im Text' };
      return { ok: true, info: m ? m[0].trim() : 'gefunden' };
    },
  },

  // ── v31.97 · Das Urteil über der Tafel ──────────────────────────────────
  {
    name: 'Urteil · die Zählung stimmt mit den Zeilen überein',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [
          { name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.4, h_m: 0.4 },
          { name: 'Tomate', x_m: 1.6, y_m: 0.2, w_m: 0.4, h_m: 0.4 },
        ],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      const d = document.createElement('div');
      d.innerHTML = gsPPrenderPlan(plan, { width: 4, length: 3 });
      const summe = d.querySelector('.gs-pk-summe');
      if (!summe) return { ok: false, warum: 'kein Urteil über der Tafel' };
      const zeilen = d.querySelectorAll('.gs-pk-zeile');
      if (!zeilen.length) return { ok: false, warum: 'keine Zeilen' };
      const txt = summe.textContent || '';
      const zahl = re => { const m = txt.match(re); return m ? Number(m[1]) : 0; };
      const summiert = zahl(/(\d+) Hinweis/) + zahl(/(\d+) bestanden/) + zahl(/(\d+) nicht prüfbar/);
      if (summiert !== zeilen.length)
        return { ok: false, warum: 'Urteil zählt ' + summiert + ', die Tafel hat ' + zeilen.length + ' Zeilen — „' + txt.trim() + '"' };
      if (zahl(/(\d+) Hinweis/) < 1) return { ok: false, warum: 'kein Hinweis gezählt, obwohl ein Fruchtfolge-Konflikt vorliegt' };
      return { ok: true, info: txt.trim() + ' · ' + zeilen.length + ' Zeilen' };
    },
  },
  {
    name: 'Urteil · Hinweise stehen ÜBER dem Bestandenen',
    lauf: () => {
      _pfAufbau({
        beete: [
          { label: 'Beet A', x_m: 0,   y_m: 0, w_m: 1.2, h_m: 3 },
          { label: 'Beet B', x_m: 1.4, y_m: 0, w_m: 1.2, h_m: 3 },
        ],
        zwillingPflanzen: [
          { name: 'Tomate', x_m: 0.2, y_m: 0.2, w_m: 0.4, h_m: 0.4 },
          { name: 'Tomate', x_m: 1.6, y_m: 0.2, w_m: 0.4, h_m: 0.4 },
        ],
      });
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }]);
      const d = document.createElement('div');
      d.innerHTML = gsPPrenderPlan(plan, { width: 4, length: 3 });
      const marken = [...d.querySelectorAll('.gs-pk-zeile .gs-pk-marke')].map(e => (e.textContent || '').trim());
      const rang = { '⚠': 0, '✓': 1, '–': 2 };
      for (let i = 1; i < marken.length; i++) {
        const a = rang[marken[i - 1]], b = rang[marken[i]];
        if (a !== undefined && b !== undefined && a > b)
          return { ok: false, warum: 'falsche Reihenfolge bei ' + (i + 1) + ': ' + marken.join(' ') };
      }
      if (!marken.length) return { ok: false, warum: 'keine Marken gefunden' };
      return { ok: true, info: marken.join(' ') };
    },
  },

  // ── Die Drei-Zustaende-Regel, ueber alle Regeln hinweg ───────────────────
  {
    name: 'Drei Zustände · ohne Daten ist jede Regel null, nie {} oder 0',
    lauf: () => {
      _pfAufbau({ beete: [], zwillingPflanzen: [] });
      window._gsPPagroCache = null;              // keine Agronomie-Referenz
      window._gsKonfliktMap = null;              // keine Mischkultur-Matrix
      localStorage.removeItem('gs_seed_inventory');
      localStorage.removeItem('gs_plantings');
      localStorage.removeItem('gs_ernte_log');
      window.myPlants = [];
      const plan = _pfPlan([{ name: 'Tomate', w_m: 0.6, h_m: 0.6, x_m: 0.1, y_m: 1.0 }], true);
      const muessenNull = ['_aussaat', '_dauer', '_folge', '_beetfolge', '_nachkultur'];
      const falsch = muessenNull.filter(k => plan[k] !== null && plan[k] !== undefined);
      return falsch.length
        ? { ok: false, warum: falsch.map(k => k + ' = ' + JSON.stringify(plan[k]).slice(0, 60)).join(' · ') + ' — ohne Daten muss das null sein' }
        : { ok: true, info: muessenNull.join(', ') + ' alle null' };
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

  // Die zwei Werkzeuge, die jeder Fall benutzt. Sie leben im Seitenkontext.
  await p.evaluate(({ agro, muster }) => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = function () { return true; };
    window.gsToast = function () {}; window.showProfileToast = function () {};
    window._PF_AGRO = agro;
    window._PF_MUSTER = muster;

    // Ausgangslage: Zwilling mit Beeten + optionale alte Plaene.
    window._pfAufbau = function (o) {
      window._gsPPagroCache = { rows: JSON.parse(JSON.stringify(window._PF_AGRO)) };
      var t = {
        v: 1, ts: Date.now(), photo: null,
        bed: { width_m: 4, length_m: 3 },
        plants: (o.zwillingPflanzen || []).map(function (x, i) {
          return { id: 'p' + i, name: x.name, latin: '', emoji: '🌿',
                   x_m: x.x_m, y_m: x.y_m, w_m: x.w_m, h_m: x.h_m,
                   bed: '', light: '', confidence: 0.9, ix: null, iy: null };
        }),
        beds: (o.beete || []).map(function (b, i) {
          return { id: 'b' + i, label: b.label, x_m: b.x_m, y_m: b.y_m, w_m: b.w_m, h_m: b.h_m };
        }),
        zones: [], summary: '',
      };
      localStorage.setItem('gs_garden_twin', JSON.stringify(t));
      localStorage.setItem('gs_garden_plans', JSON.stringify(o.altePlaene || []));
      localStorage.removeItem('gs_plantings');
      localStorage.removeItem('gs_ernte_log');
      window.myPlants = [];
    };

    // Ein Plan aus einer knappen Liste — durchgerechnet wie im Ernstfall.
    window._pfPlan = function (pflanzen, ohnePruefwerk) {
      var plan = {
        summary: 'Prüfstand', bed: { width_m: 4, length_m: 3 },
        plants: pflanzen.map(function (x) {
          return { name: x.name, latin: '', count: 1, w_m: x.w_m, h_m: x.h_m,
                   x_m: x.x_m, y_m: x.y_m, light: '',
                   sow_date: x.sow_date || '', harvest_from: x.harvest_from || '',
                   harvest_to: x.harvest_to || '' };
        }),
      };
      _gsSanitizePlannerPlan(plan);
      if (!ohnePruefwerk) _gsPlanPruefwerk(plan, { width: 4, length: 3 });
      else _gsPlanPruefwerk(plan, {});
      return plan;
    };
  }, { agro: SEED.AGRONOMIE, muster: SEED.MUSTERPLAN });

  console.log('\n=== planer_check — rechnet der Planer, was er behauptet?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try {
      r = await p.evaluate(new Function('return (' + f.lauf.toString() + ')()'));
    } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Fälle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
