#!/usr/bin/env node
/**
 * offline_check.js — hält die PWA, was sie ohne Empfang verspricht?
 *
 * GreenScan wird im Wald benutzt. Genau dort gibt es keinen Empfang, und
 * genau dafür gibt es den Service Worker: 4'342 Arten, die Karte, die
 * eigenen Pflanzen — alles soll auch ohne Netz da sein.
 *
 * Geprüft hat das bisher nichts. Und ein Offline-Fehler ist die stillste
 * Sorte, die es gibt: er tritt nur dort auf, wo niemand ihn melden kann.
 *
 * Die fünf Fragen dieses Prüfstands:
 *
 *   1. Installiert sich der Service Worker überhaupt?
 *   2. Liegt nach der Installation wirklich alles im Shell-Cache, was
 *      `SHELL_URLS` verspricht?
 *   3. Startet die App ohne Netz — mit allen 4'342 Arten?
 *   4. Wird eine vorgeladene Datei auch dann noch gefunden, wenn der
 *      Runtime-Cache weg ist? (Das ist der Fall, der zählt: Browser
 *      verdrängen Caches einzeln, und der Shell-Cache ist der, der
 *      überleben soll.)
 *   5. Liegt dieselbe Datei doppelt auf dem Gerät?
 *
 * Warum ein eigener HTTP-Server: ein Service Worker braucht einen sicheren
 * Kontext. `file://` ist keiner, `http://127.0.0.1` schon — deshalb 30
 * Zeilen statischer Server statt eines weiteren npm-Pakets.
 *
 *   node scripts/offline_check.js
 */
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');

const WURZEL = path.resolve(__dirname, '..');
const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};

function server() {
  return new Promise((fertig) => {
    const s = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      // Kein Ausbruch aus dem Repo — der Server steht nur fuer diesen Lauf.
      const datei = path.join(WURZEL, path.normalize(p).replace(/^([/\\])+/, ''));
      if (!datei.startsWith(WURZEL) || !fs.existsSync(datei) || fs.statSync(datei).isDirectory()) {
        res.writeHead(404); res.end('nicht da'); return;
      }
      res.writeHead(200, {
        'Content-Type': TYPEN[path.extname(datei).toLowerCase()] || 'application/octet-stream',
        'Service-Worker-Allowed': '/',
      });
      fs.createReadStream(datei).pipe(res);
    });
    s.listen(0, '127.0.0.1', () => fertig({ s, port: s.address().port }));
  });
}

(async () => {
  const { s, port } = await server();
  const basis = 'http://127.0.0.1:' + port;
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 }, serviceWorkers: 'allow' });
  const p = await ctx.newPage();
  const fehler = [];
  p.on('pageerror', e => fehler.push(e.message.split('\n')[0]));

  console.log('\n=== offline_check — hält die PWA, was sie ohne Empfang verspricht?');
  let kaputt = 0;
  const melde = (name, ok, info) => {
    if (ok) console.log('  ok   ' + name + (info ? '   [' + info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + name + '\n         → ' + info); }
  };

  // ── 1 · Installiert sich der Service Worker? ─────────────────────────
  await p.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(2500);
  let bereit = false;
  try {
    bereit = await p.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const r = await Promise.race([
        navigator.serviceWorker.ready.then(() => true),
        new Promise(z => setTimeout(() => z(false), 20000)),
      ]);
      return !!r;
    });
  } catch (_) {}
  melde('Der Service Worker installiert sich', bereit,
        bereit ? 'navigator.serviceWorker.ready' : 'kein aktiver Service Worker nach 20 s — alles Weitere prueft dann nichts');
  if (!bereit) { await br.close(); s.close(); process.exitCode = 1; return; }

  // Dem Vor-Cachen Zeit geben (2,1 MB Artenliste ueber die Schleife).
  await p.waitForTimeout(4000);

  // ── 2 · Liegt im Shell-Cache, was SHELL_URLS verspricht? ─────────────
  const swQuelle = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
  const mListe = swQuelle.match(/const SHELL_URLS = \[([\s\S]*?)\n\];/);
  const versprochen = mListe
    ? [...mListe[1].matchAll(/^\s*'([^']+)'/gm)].map(x => x[1])
    : [];
  const version = (swQuelle.match(/const VERSION = '([^']+)'/) || [])[1] || '';

  const shellStand = await p.evaluate(async (v) => {
    const c = await caches.open(v + '-shell');
    const drin = (await c.keys()).map(r => r.url);
    return drin;
  }, version);
  const fehlend = versprochen.filter(u => {
    if (/^https?:/.test(u)) return !shellStand.some(x => x === u);      // pdf.js: CDN, im Lauf nicht erreichbar
    return !shellStand.some(x => x.endsWith(u) || x === basis + u);
  }).filter(u => !/^https?:/.test(u));   // externe Quellen sind hier nicht pruefbar
  // Grenze, damit sie niemand neu entdeckt: EXTERNE Quellen (pdf.js vom CDN)
  // sind von hier aus nicht erreichbar — die Netz-Richtlinie der Cloud-Umgebung
  // laesst nichts ausserhalb der Freigabeliste durch. Sie werden deshalb
  // ausgenommen und die Zahl sagt, wie viele das waren.
  const extern = versprochen.filter(u => /^https?:/.test(u)).length;
  melde('Der Shell-Cache enthält, was SHELL_URLS verspricht', fehlend.length === 0,
        fehlend.length ? fehlend.length + ' von ' + (versprochen.length - extern) + ' fehlen: ' + fehlend.slice(0, 5).join(', ')
                       : shellStand.length + ' Einträge, keine Lücke (' + extern + ' externe Quelle' +
                         (extern === 1 ? '' : 'n') + ' hier nicht prüfbar)');

  // ── 3 · Liegt dieselbe Datei doppelt auf dem Geraet? ─────────────────
  //
  // Diese Frage MUSS vor dem Abschalten kommen — und nach einem zweiten
  // Besuch MIT Netz. Grund: beim ersten Besuch installiert sich der Service
  // Worker erst waehrend die Seite laedt, er sieht ihre Unterdateien also
  // gar nicht. Erst beim zweiten Aufruf greift er auf jede einzelne zu, und
  // erst dann kann ueberhaupt eine zweite Kopie entstehen.
  //
  // Ohne diesen Schritt waere die Frage gruen, auch wenn die Weiche zum
  // Shell-Cache ganz fehlte — sie pruefte dann nur, dass nichts passiert.
  // (Gegenprobe gemacht: Weiche aus → diese Zeile meldet, mit Weiche → still.)
  await p.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await p.waitForTimeout(3500);
  const doppelt = await p.evaluate(async () => {
    const namen = await caches.keys();
    const wo = {};
    for (const n of namen) {
      const c = await caches.open(n);
      for (const r of await c.keys()) {
        const u = new URL(r.url);
        const k = u.pathname + u.search;
        (wo[k] = wo[k] || []).push(n);
      }
    }
    return Object.entries(wo).filter(([, l]) => l.length > 1).map(([u, l]) => u + ' in ' + l.join(' + '));
  });
  melde('Keine Datei liegt in zwei Caches gleichzeitig', doppelt.length === 0,
        doppelt.length ? doppelt.length + '× doppelt: ' + doppelt.slice(0, 4).join(' · ') : 'jede Datei genau einmal');

  // ── 4 · Startet die App ohne Netz? ───────────────────────────────────
  s.close();                                   // das Netz ist jetzt wirklich weg
  await ctx.setOffline(true);
  fehler.length = 0;
  await p.goto(basis + '/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(4000);
  const ohneNetz = await p.evaluate(() => ({
    arten: (typeof DB !== 'undefined' && DB && DB.length) ? DB.length : 0,
    version: window.GS_VERSION || null,
    app: !!document.getElementById('app'),
    leaflet: typeof window.L !== 'undefined',
  }));
  melde('Die App startet ohne Netz — mit allen Arten', ohneNetz.arten >= 4000 && !!ohneNetz.version,
        ohneNetz.arten >= 4000 ? ohneNetz.arten + ' Arten · ' + ohneNetz.version + ' · Leaflet ' + (ohneNetz.leaflet ? 'da' : 'fehlt')
          : 'nur ' + ohneNetz.arten + ' Arten geladen (Version ' + ohneNetz.version + ') — ohne Artenliste bestimmt die App nichts');

  // ── 5 · Der Fall, der zählt: Runtime-Cache verdrängt ─────────────────
  //
  // Browser verdrängen Caches EINZELN, wenn der Speicher knapp wird. Der
  // Shell-Cache ist der, der überleben soll — dafür wird er vorgeladen.
  // Diese Prüfung stellt genau das her: Runtime weg, Shell da.
  const nachRaeumung = await p.evaluate(async (v) => {
    const raus = (await caches.keys()).filter(k => k.indexOf('-shell') < 0);
    await Promise.all(raus.map(k => caches.delete(k)));
    // Direkt den Service Worker fragen, so wie es die Seite täte.
    const proben = ['/data/plants.v1.js?v=1', '/assets/leaflet.js', '/assets/three.min.js'];
    const raus2 = {};
    for (const u of proben) {
      try {
        const r = await fetch(u);
        raus2[u] = (r && r.ok) ? r.status : (r ? r.status : 'kein Ergebnis');
      } catch (e) { raus2[u] = 'Fehler: ' + (e.message || e); }
    }
    return { geloescht: raus, ergebnis: raus2 };
  }, version);
  const verloren = Object.entries(nachRaeumung.ergebnis).filter(([, v]) => v !== 200);
  melde('Eine vorgeladene Datei überlebt die Verdrängung des Runtime-Caches', verloren.length === 0,
        verloren.length
          ? verloren.map(([u, v]) => u + ' → ' + v).join(' · ') +
            '  (vorgeladen im Shell-Cache, aber nicht von dort ausgeliefert)'
          : 'alle drei aus dem Shell-Cache bedient');

  console.log('  ---');
  console.log('  Fragen geprueft: 5 · davon rot: ' + kaputt);
  console.log('  JS-Fehler im Offline-Start: ' + (fehler.length ? fehler.length + ' (' + fehler.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();
