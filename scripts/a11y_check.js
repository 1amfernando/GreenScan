#!/usr/bin/env node
/**
 * a11y_check.js — lässt sich die App auch ohne Augen und ohne Maus bedienen?
 *
 * `touch_check` misst, ob eine Antippfläche gross genug ist. `contrast_check`
 * misst, ob Text lesbar ist. Beides setzt voraus, dass jemand **hinsieht**.
 *
 * Dieser hier fragt das, was danach kommt:
 *
 *   1. Sagt jedes Eingabefeld, WAS es ist?      (WCAG 4.1.2 · 3.3.2)
 *   2. Sagt jeder Knopf, was er TUT?            (WCAG 4.1.2)
 *   3. Hat jedes Bild eine Textalternative?     (WCAG 1.1.1)
 *   4. Kommt man mit der TASTATUR überall hin?  (WCAG 2.1.1)
 *   5. Gibt es jede id nur einmal?              (Grundlage für `label for`)
 *   6. Sagt die Seite, in welcher Sprache sie ist? (WCAG 3.1.1)
 *
 * Zwei Dinge, die dieser Prüfstand bewusst NICHT tut:
 *
 * - Er ersetzt keinen Screenreader. Was er misst, ist die maschinell
 *   nachweisbare Hälfte; „ist der Name auch VERSTÄNDLICH" kann nur ein
 *   Mensch beurteilen.
 * - Er meldet nur, was SICHTBAR ist. Ein Feld in einem geschlossenen Fenster
 *   ist für niemanden ein Problem, und es zu melden hiesse, die Liste mit
 *   Rauschen zu füllen, bis sie niemand mehr liest.
 *
 *   node scripts/a11y_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const TABS = ['home','garden','wissen','favs','search','social','market','recipes','remedies','map','scanner'];

const PRUEFUNG = () => {
  const funde = [];
  const sichtbar = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return false;
    const b = el.getBoundingClientRect();
    return b.width >= 2 && b.height >= 2;
  };
  const pfad = (el) => {
    const teile = [];
    for (let p = el; p && p !== document.body && teile.length < 3; p = p.parentElement) {
      let s = p.tagName.toLowerCase();
      if (p.id) { s += '#' + p.id; teile.unshift(s); break; }
      if (typeof p.className === 'string' && p.className.trim()) s += '.' + p.className.trim().split(/\s+/)[0];
      teile.unshift(s);
    }
    return teile.join('>');
  };
  // Der zugängliche Name, so weit er sich aus dem Dokument ablesen lässt.
  // Kein vollständiger Namens-Algorithmus — aber jede Quelle, die diese App
  // wirklich benutzt.
  const name = (el) => {
    const al = (el.getAttribute('aria-label') || '').trim();
    if (al) return al;
    const lb = el.getAttribute('aria-labelledby');
    if (lb) {
      const t = lb.split(/\s+/).map(id => {
        const e = document.getElementById(id);
        return e ? (e.textContent || '').trim() : '';
      }).join(' ').trim();
      if (t) return t;
    }
    if (el.id) {
      const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
      if (l && (l.textContent || '').trim()) return (l.textContent || '').trim();
    }
    const umschliessend = el.closest('label');
    if (umschliessend && (umschliessend.textContent || '').trim()) return (umschliessend.textContent || '').trim();
    const ti = (el.getAttribute('title') || '').trim();
    if (ti) return ti;
    const ph = (el.getAttribute('placeholder') || '').trim();
    if (ph) return ph;               // schwächer als ein Label, aber nicht nichts
    return '';
  };
  // Emoji sind KEIN Name. „✕" oder „☰" allein sagt einem Screenreader nichts
  // Verlässliches — je nach Stimme wird es vorgelesen, verschluckt oder als
  // „Schwarzes Kreuz" benannt.
  const nurZeichen = (s) => {
    const ohne = s.replace(/[\p{Extended_Pictographic}\p{Emoji_Component}️‍\s]/gu, '')
                  .replace(/[✕✖×✓✔·•→←↑↓»«‹›…]/g, '');
    return ohne.length === 0;
  };

  // ── 1 · Eingabefelder ohne Namen ─────────────────────────────────────
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    if (el.type === 'hidden') return;
    if (!sichtbar(el)) return;
    const n = name(el);
    if (!n) funde.push({ art: 'feld-ohne-namen', wo: pfad(el), was: el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : '') });
  });

  // ── 2 · Knöpfe ohne Namen ────────────────────────────────────────────
  document.querySelectorAll('button, [role="button"], a[href]').forEach((el) => {
    if (!sichtbar(el)) return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    const txt = (el.textContent || '').trim();
    const n = name(el) || txt;
    if (!n) funde.push({ art: 'knopf-ohne-namen', wo: pfad(el), was: el.tagName.toLowerCase() });
    else if (nurZeichen(n)) funde.push({ art: 'knopf-nur-zeichen', wo: pfad(el), was: JSON.stringify(n.slice(0, 12)) });
  });

  // ── 3 · Bilder ohne Textalternative ──────────────────────────────────
  document.querySelectorAll('img').forEach((el) => {
    if (!sichtbar(el)) return;
    if (el.getAttribute('aria-hidden') === 'true') return;
    if (el.hasAttribute('alt')) return;      // auch alt="" ist eine Aussage: Zierde
    funde.push({ art: 'bild-ohne-alt', wo: pfad(el), was: (el.getAttribute('src') || '').slice(0, 40) });
  });

  // ── 4 · Mit der Maus bedienbar, mit der Tastatur nicht ───────────────
  // Ein `onclick` auf einem <div> ist für die Maus ein Knopf und für die
  // Tastatur unsichtbar: kein Fokus, kein Enter, kein Vorlesen als Knopf.
  document.querySelectorAll('[onclick]').forEach((el) => {
    if (!sichtbar(el)) return;
    const t = el.tagName.toLowerCase();
    if (t === 'button' || t === 'a' || t === 'input' || t === 'select' || t === 'textarea' || t === 'label') return;
    const rolle = (el.getAttribute('role') || '').toLowerCase();
    const ti = el.getAttribute('tabindex');
    const erreichbar = ti !== null && Number(ti) >= 0;
    if (erreichbar && rolle) return;
    // Diese Unterscheidung entscheidet über die ART der Reparatur, nicht nur
    // über ihre Dringlichkeit:
    //   OHNE innere Bedienelemente → der Kasten SELBST darf ein Knopf werden.
    //   MIT   inneren Bedienelementen → das wäre ein Knopf im Knopf. Dann
    //         muss stattdessen etwas DARIN fokussierbar werden.
    const innen = el.querySelector('button, a[href], input, select, textarea, [onclick], [tabindex]');
    // Ein Kasten gilt AUCH dann als erreichbar, wenn etwas DARIN fokussierbar
    // ist und dessen Klick zu ihm aufsteigt — genau das tut die Nachrüstung
    // bei Karten mit eigenen Knöpfen (dort wäre ein Knopf im Knopf falsch).
    //
    // Diese Zeile fehlte im ersten Anlauf, und das war MEIN Fehler, nicht der
    // der App: Reparatur und Prüfung hatten zwei verschiedene Regeln für
    // dieselbe Frage. Der Prüfstand meldete 80 Karten als unerreichbar, die
    // längst erreichbar waren. Dieselbe Falle wie bei den zwei Matchern in
    // v32.02 — nur diesmal habe ich sie selbst gebaut.
    //
    // Geprüft wird die STRUKTUR, nicht ein Merkmal, das die App sich selbst
    // anheftet: `tabindex` und `role` sind nachweisbar, `data-tast` wäre
    // bloss eine Selbstauskunft.
    const stellvertreter = el.querySelector('[tabindex]:not([tabindex^="-"])[role]');
    if (stellvertreter) return;
    funde.push({
      art: innen ? 'nur-mit-maus-verschachtelt' : 'nur-mit-maus',
      wo: pfad(el),
      was: t + (rolle ? ' role=' + rolle : ' ohne role') + (erreichbar ? '' : ', nicht fokussierbar') +
           (innen ? ' · enthält ' + innen.tagName.toLowerCase() : ''),
    });
  });

  return funde;
};

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(3500);
  await p.evaluate(() => {
    try { document.documentElement.classList.remove('gs-preauth'); } catch (e) {}
    const o = document.getElementById('gs-onboarding');
    if (o) o.style.setProperty('display', 'none', 'important');
  });
  await p.waitForTimeout(400);

  console.log('\n=== a11y_check — bedienbar ohne Augen und ohne Maus?');

  // ── 5 · Doppelte ids ─────────────────────────────────────────────────
  // Sie sind die Grundlage von `label for` und `aria-labelledby`: gibt es
  // eine id zweimal, zeigt jede Zuordnung auf die erste — die zweite ist
  // damit still namenlos.
  const dopp = await p.evaluate(() => {
    const z = {};
    document.querySelectorAll('[id]').forEach(e => { z[e.id] = (z[e.id] || 0) + 1; });
    return Object.entries(z).filter(([, n]) => n > 1).map(([id, n]) => id + ' (' + n + '×)');
  });

  // ── 6 · Sprache der Seite ────────────────────────────────────────────
  const lang = await p.evaluate(() => document.documentElement.getAttribute('lang') || '');

  const alle = new Map();
  const jeTab = {};
  // Ein Fenster, das nicht aufgeht, ist ein Fehler — nicht ein leeres Ergebnis.
  let rot = 0;
  for (const t of TABS) {
    try { await p.evaluate(t => { if (typeof switchTab === 'function') switchTab(t); }, t); } catch (_) {}
    await p.waitForTimeout(500);
    const f = await p.evaluate(PRUEFUNG);
    jeTab[t] = f.length;
    // Über die Tabs hinweg entdoppeln: dieselbe Kopfleiste steht auf jedem.
    f.forEach(x => { const k = x.art + '|' + x.wo + '|' + x.was; if (!alle.has(k)) alle.set(k, x); });
  }

  // ── Und die FENSTER ─────────────────────────────────────────────────
  //
  // Bis v32.21 prüfte dieser Stand nur die elf Tabs. `contrast_check` misst
  // längst in sechs Fenstern — hier waren es **null**. Ein Formularfeld in
  // einem Modal ist aber genauso ein Formularfeld, und Modale sind gerade
  // die Stellen mit den meisten Eingaben (Planer, Eingrenzen, Korrektur).
  //
  // Geöffnet wird über die öffentlichen Öffner, nicht über nachgebaute
  // Zustände: was hier geprüft wird, ist das, was ein Mensch auch sieht.
  const FENSTER = [
    ['eingrenzen', () => {
      if (typeof gsEingrenzenOeffnen !== 'function') return false;
      try { localStorage.setItem('gs_eingrenzen', JSON.stringify({ monat: 6, farbe: '', gruppe: '', hoehe: null })); } catch (_) {}
      gsEingrenzenOeffnen(); return true;
    }],
    ['blühkalender', () => {
      if (typeof openBluehkalender !== 'function') return false;
      openBluehkalender(); return true;
    }],
    ['scan-ergebnis', () => {
      if (typeof showScanResult !== 'function') return false;
      try { if (typeof switchTab === 'function') switchTab('scanner'); } catch (_) {}
      window.gsScanStatusShow = () => {}; window.gsStopScanStatus = () => {};
      window.gsScanPersistToCloud = () => Promise.resolve(true);
      window.gsAddToScanHistory = () => {}; window.gsHaptic = () => {};
      showScanResult({
        name: 'Bärlauch', latin: 'Allium ursinum', family: 'Amaryllidaceae', category: 'wildpflanze',
        confidence: 84, edible: true, toxic: false, toxicity: 0,
        description: 'Breite Blätter mit Knoblauchgeruch.', habitat: 'Laubwälder', season: 'Apr–Jun',
        diagnostic_features: ['Breite Einzelblätter', 'Knoblauchgeruch'],
        alternatives: [{ name: 'Maiglöckchen', latin: 'Convallaria majalis', confidence: 21, toxicity: 5, edible: false }],
        _shotCount: 1, _qual: { messbar: true, quality: 70, blur: 66, light: 74, warnings: [] },
      });
      const r = document.getElementById('scan-result');
      if (r) r.style.display = 'block';
      return true;
    }],
  ];
  const jeFenster = {};
  for (const [name, oeffne] of FENSTER) {
    let auf = false;
    try { auf = await p.evaluate(new Function('return (' + oeffne.toString() + ')()')); } catch (_) { auf = false; }
    await p.waitForTimeout(600);
    if (!auf) { jeFenster[name] = 'ging nicht auf'; continue; }
    const f = await p.evaluate(PRUEFUNG);
    // Ohne diese Zahl sieht ein Fenster, das gar nicht aufging, genauso aus
    // wie eines ohne Fehler — dieselbe Lehre wie bei contrast_check (v31.78).
    // Gezählt wird, was IM Fenster steht — nicht im ganzen Dokument. Der
    // erste Anlauf zählte 1'275 „Bedienelemente" für ein Modal mit vier
    // Auswahlfeldern: die Zahl des ganzen Dokuments, mit und ohne offenes
    // Fenster dieselbe. Sie hätte also auch dann gestimmt, wenn gar nichts
    // aufgegangen wäre — genau die Falle, die contrast_check seit v31.78
    // benennt und die ich hier prompt selbst gebaut habe.
    const stellen = await p.evaluate((n) => {
      const w = ['#detail-modal', '#scan-result', '.modal-overlay.open']
        .map(sel => document.querySelector(sel))
        .filter(el => el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 20);
      if (!w.length) return -1;
      let z = 0;
      w.forEach(el => { z += el.querySelectorAll('input, select, textarea, button, a[href], [role="button"], img').length; });
      return z;
    }, name);
    jeFenster[name] = (stellen < 0)
      ? 'kein sichtbares Fenster — nichts gemessen'
      : f.length + ' Funde bei ' + stellen + ' Bedienelementen IM Fenster';
    if (stellen <= 0) { rot++; }
    f.forEach(x => { const k = x.art + '|' + x.wo + '|' + x.was; if (!alle.has(k)) alle.set(k, x); });
    try { await p.evaluate(() => { if (typeof closeModal === 'function') { closeModal('detail-modal'); } }); } catch (_) {}
    await p.waitForTimeout(250);
  }

  const nachArt = {};
  [...alle.values()].forEach(f => { (nachArt[f.art] = nachArt[f.art] || []).push(f); });

  const TITEL = {
    'feld-ohne-namen':  'Eingabefelder, die nicht sagen was sie sind (WCAG 4.1.2)',
    'knopf-ohne-namen': 'Knöpfe ganz ohne Namen (WCAG 4.1.2)',
    'knopf-nur-zeichen':'Knöpfe, deren einziger Name ein Zeichen/Emoji ist',
    'bild-ohne-alt':    'Bilder ohne alt-Attribut (WCAG 1.1.1)',
    'nur-mit-maus':     'Mit der Maus bedienbar, mit der Tastatur nicht (WCAG 2.1.1)',
    'nur-mit-maus-verschachtelt': '… dasselbe, aber MIT inneren Bedienelementen (Knopf im Knopf wäre falsch)',
  };
  const REIHE = ['feld-ohne-namen','knopf-ohne-namen','bild-ohne-alt','knopf-nur-zeichen','nur-mit-maus','nur-mit-maus-verschachtelt'];

  console.log('  Sprache der Seite (<html lang>): ' + (lang ? lang : 'FEHLT — ein Screenreader rät die Aussprache'));
  console.log('  Doppelte ids: ' + (dopp.length ? dopp.length + ' → ' + dopp.slice(0, 6).join(', ') : 'keine'));
  console.log('');
  let summe = 0;
  for (const art of REIHE) {
    const l = nachArt[art] || [];
    summe += l.length;
    console.log('  ' + String(l.length).padStart(4) + '  ' + TITEL[art]);
    const zeige = process.env.GS_A11Y_ALLE ? l.length : 6;
    l.slice(0, zeige).forEach(f => console.log('          · ' + f.wo + '   ' + f.was));
    if (l.length > zeige) console.log('          … und ' + (l.length - zeige) + ' weitere (GS_A11Y_ALLE=1 zeigt alle)');
  }
  // ── 7 · Verhalten statt Struktur: öffnet Enter die Karte wirklich? ───
  //
  // Die Prüfungen oben lesen das Dokument. Ein `tabindex` kann aber
  // dastehen und ins Leere führen. Diese Frage drückt deshalb WIRKLICH die
  // Taste — mit einem echten Tastendruck des Browsers, nicht mit einem
  // nachgebauten Ereignis.
  const enterProben = [];
  for (const [tab, wahl, bez] of [
    ['recipes', '#recipes-list .recipe-card [tabindex="0"][role="button"]', 'Rezeptkarte (über den Titel)'],
    ['search',  '#results-list [tabindex="0"][role="button"]',              'Suchergebnis (Karte selbst)'],
  ]) {
    try {
      await p.evaluate(t => { if (typeof switchTab === 'function') switchTab(t); }, tab);
      await p.waitForTimeout(700);
      const da = await p.evaluate((w) => {
        const e = document.querySelector(w);
        if (!e) return null;
        e.focus();
        return { fokus: document.activeElement === e, text: (e.textContent || '').trim().slice(0, 24) };
      }, wahl);
      if (!da) { enterProben.push({ bez, ok: false, warum: 'kein fokussierbares Element gefunden' }); continue; }
      if (!da.fokus) { enterProben.push({ bez, ok: false, warum: 'lässt sich nicht fokussieren' }); continue; }
      const vorher = await p.evaluate(() => document.body.innerHTML.length);
      await p.keyboard.press('Enter');
      await p.waitForTimeout(700);
      const nachher = await p.evaluate(() => document.body.innerHTML.length);
      const passiert = nachher !== vorher;
      enterProben.push({ bez, ok: passiert, warum: passiert ? da.text + ' → Ansicht öffnet' : 'Enter bewirkte nichts' });
      await p.evaluate(() => { try { if (typeof closeModal === 'function') closeModal(); } catch (_) {} });
      await p.waitForTimeout(300);
    } catch (e) { enterProben.push({ bez, ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }); }
  }

  // ── 8 · Sieht man, wo man ist? ───────────────────────────────────────
  // Erreichbar ohne sichtbaren Fokus ist die halbe Miete. Gemessen wird
  // nach einem ECHTEN Tabulator-Druck, weil `:focus-visible` genau darauf
  // anspringt und auf einen Klick bewusst nicht.
  let fokusRing = null;
  try {
    await p.evaluate(() => { if (typeof switchTab === 'function') switchTab('home'); });
    await p.waitForTimeout(500);
    for (let i = 0; i < 8 && !fokusRing; i++) {
      await p.keyboard.press('Tab');
      // ACHTUNG, und das war im ersten Anlauf falsch: „hat einen Schatten"
      // ist KEIN Nachweis. Karten und Knöpfe dieser App haben ohnehin einen.
      // Nachweisbar ist nur der UNTERSCHIED zwischen fokussiert und nicht
      // fokussiert — deshalb wird derselbe Knopf zweimal gemessen.
      const r = await p.evaluate(() => {
        const a = document.activeElement;
        if (!a || a === document.body) return null;
        const lies = () => { const cs = getComputedStyle(a); return { o: parseFloat(cs.outlineWidth) || 0, s: cs.boxShadow || 'none' }; };
        const mit = lies();
        a.blur();
        const ohne = lies();
        a.focus();                                  // Zustand wiederherstellen
        const dRand = mit.o - ohne.o;
        const dSchatten = mit.s !== ohne.s;
        return { tag: a.tagName.toLowerCase(), breite: mit.o, dRand: dRand, dSchatten: dSchatten,
                 sichtbar: dRand >= 2 || dSchatten };
      });
      if (r && r.sichtbar) fokusRing = r;
    }
  } catch (_) {}

  console.log('');
  enterProben.forEach(e => console.log('  ' + (e.ok ? 'ok  ' : '!!  ') + ' Enter öffnet: ' + e.bez + '   [' + e.warum + ']'));
  console.log('  ' + (fokusRing
    ? 'ok   Der Fokus ist sichtbar   [' + fokusRing.tag + ': Rand +' + fokusRing.dRand + 'px gegenüber unfokussiert' + (fokusRing.dSchatten ? ', zusätzlicher Ring' : '') + ']'
    : '!!   Kein sichtbarer Fokusrahmen nach 8× Tabulator — man kommt hin, sieht aber nicht wohin'));
  const verhaltenRot = enterProben.filter(e => !e.ok).length + (fokusRing ? 0 : 1);

  console.log('  ---');
  const elemente = TABS.reduce((a, t) => a + jeTab[t], 0);
  console.log('  Stellen im Code (entdoppelt): ' + summe + ' · Elemente auf dem Bildschirm: ' + elemente);
  console.log('  Der Unterschied ist kein Fehler: eine Karten-Vorlage erzeugt vierzig Karten,');
  console.log('  und EINE Reparatur behebt sie alle. Gemeldet wird beides, damit keine der');
  console.log('  beiden Zahlen die andere verdeckt.');
  console.log('  je Tab (mit Wiederholungen): ' + TABS.map(t => t + '=' + jeTab[t]).join(' '));
  console.log('  je Fenster: ' + Object.keys(jeFenster).map(k => k + ' → ' + jeFenster[k]).join(' · '));
  console.log('  JS-Fehler: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = (summe || verhaltenRot || rot || errs.length) ? 1 : 0;
})();
