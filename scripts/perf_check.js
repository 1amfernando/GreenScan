#!/usr/bin/env node
/**
 * perf_check.js — misst den Kaltstart unter Telefon-Bedingungen und trennt
 * App-JavaScript von Parsen/Kompilieren.
 *
 * Warum die Trennung wichtig ist: die App ist ein 5,7-MB-Monolith. Ein grosser
 * Teil der Startzeit ist das Parsen dieser Datei — das ist eine Eigenschaft der
 * Architektur, nicht ein Fehler im Code. Interessant ist die Spalte APP-JS: das
 * ist die Arbeit, die man tatsaechlich beeinflussen kann.
 *
 * Drosselung: 1x Desktop, 4x Mittelklasse-Telefon, 6x Einsteigergeraet.
 *
 *   node scripts/perf_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const FILE = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'index.html');

const SEED = () => {
  try {
    localStorage.setItem('gs_sb_token', 'pruefstand');
    localStorage.setItem('gs_sb_expires', String(Date.now() + 2592000000));
  } catch (e) {}
  window.__long = [];
  try {
    new PerformanceObserver(l => { l.getEntries().forEach(e => window.__long.push(Math.round(e.duration))); })
      .observe({ entryTypes: ['longtask'] });
  } catch (e) {}
};

(async () => {
  console.log('Kaltstart von', path.basename(FILE), '(lokale Datei, kein Netz)\n');
  console.log('Geraet                       FCP     DCL   App-JS  Parsen   lange Aufgaben');
  for (const [label, rate] of [['Desktop (1x)', 1], ['Mittelklasse-Telefon (4x)', 4], ['Einsteiger-Telefon (6x)', 6]]) {
    const br = await chromium.launch();
    const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await p.addInitScript(SEED);
    await cdp.send('Profiler.start');
    await p.goto('file://' + FILE, { waitUntil: 'domcontentloaded', timeout: 180000 });
    await p.waitForTimeout(7000);
    const { profile } = await cdp.send('Profiler.stop');

    const byId = new Map(profile.nodes.map(n => [n.id, n]));
    const self = new Map();
    const dt = profile.timeDeltas || [];
    profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (dt[i] || 0)));
    let app = 0, prog = 0;
    const named = [];
    for (const [id, us] of self) {
      const f = (byId.get(id) || {}).callFrame || {};
      const fn = f.functionName || '(anonym)';
      const ms = us / 1000;
      if (fn === '(program)' || fn === '(root)') prog += ms;
      else if (fn === '(idle)' || fn === '(garbage collector)') { /* nicht zurechenbar */ }
      else { app += ms; named.push({ fn, ms, zeile: f.lineNumber != null ? f.lineNumber + 1 : '?' }); }
    }
    const m = await p.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const paints = {}; performance.getEntriesByType('paint').forEach(e => paints[e.name] = Math.round(e.startTime));
      const L = window.__long || [];
      return { fcp: paints['first-contentful-paint'] || 0, dcl: Math.round(nav.domContentLoadedEventEnd || 0),
               n: L.length, sum: L.reduce((a, b) => a + b, 0), max: Math.max(0, ...L) };
    });
    console.log(label.padEnd(27),
      String(m.fcp).padStart(5) + 'ms', String(m.dcl).padStart(6) + 'ms',
      String(Math.round(app)).padStart(6) + 'ms', String(Math.round(prog)).padStart(6) + 'ms',
      '  ' + m.n + ' Stueck, ' + m.sum + 'ms, laengste ' + m.max + 'ms');
    if (rate === 4) {
      named.sort((a, b) => b.ms - a.ms);
      console.log('   groesste App-Posten:', named.slice(0, 6)
        .map(r => `${r.fn.slice(0, 22)}(:${r.zeile}) ${Math.round(r.ms)}ms`).join(' · '));
    }
    await br.close();
  }
})();
