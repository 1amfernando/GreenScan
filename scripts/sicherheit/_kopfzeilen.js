// Helfer (kein Fall): ein Pruefserver, der das Repo MIT den Kopfzeilen aus _headers
// ausliefert — so, wie beide Hoster es tun (CLAUDE.md §2.1). Anlass v33.59: drei Lehren
// (COOP macht window.opener null, eine Permissions-Policy legt Geraete still, connect-src
// verbietet fetch(data:)) hatten dieselbe Ursache — die Pruefstaende liefen ohne die
// Kopfzeilen der Auslieferung. Wer einen Ablauf ueber zwei Fenster prueft, nimmt diesen Server.
//
//   const { kopfzeilenFuer, repoServer } = require('./_kopfzeilen.js');
//   kopfzeilenFuer('/index.html')                  → { 'Cross-Origin-Opener-Policy': …, … }
//   const s = await repoServer({ ohne: ['Cross-Origin-Opener-Policy'] });   // Gegenprobe
//   s.basis  → 'http://127.0.0.1:<port>/'   ·  s.schliessen()
//
// Zwei Abweichungen von der Auslieferung, beide wegen http statt https und benannt:
// `upgrade-insecure-requests` faellt aus der CSP (sonst holte der Browser jede Datei des
// Pruefservers ueber https), und HSTS wird mitgeschickt, wirkt ueber http aber nicht.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');

const WURZEL = path.resolve(__dirname, '..', '..');

// _headers in Bloecke: [{ muster, kopf: [[name, wert], …] }] — Kommentare und Leerzeilen fallen weg.
function bloecke(text) {
  const out = [];
  let akt = null;
  String(text).split('\n').forEach((z) => {
    if (/^\s*#/.test(z) || !z.trim()) return;
    if (!/^\s/.test(z)) { akt = { muster: z.trim(), kopf: [] }; out.push(akt); return; }
    const m = z.match(/^\s+([A-Za-z0-9-]+):\s*(.*)$/);
    if (m && akt) akt.kopf.push([m[1], m[2].trim()]);
  });
  return out;
}

// Ein Muster aus _headers gegen einen Pfad: `*` steht fuer beliebig viele Zeichen (wie auf
// Cloudflare Pages und Netlify), sonst exakt.
function passt(muster, pfad) {
  const re = new RegExp('^' + muster.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
  return re.test(pfad);
}

// Alle Kopfzeilen, die fuer einen Pfad gelten — jeder passende Block, ein spaeterer Block
// ueberschreibt denselben Namen (z. B. Content-Type der manifest.json).
function kopfzeilenFuer(pfad, opts) {
  opts = opts || {};
  const text = fs.readFileSync(path.join(WURZEL, '_headers'), 'utf8');
  const k = {};
  bloecke(text).forEach((b) => { if (passt(b.muster, pfad)) b.kopf.forEach(([n, w]) => { k[n] = w; }); });
  if (k['Content-Security-Policy'] && opts.upgrade !== true) {
    k['Content-Security-Policy'] = k['Content-Security-Policy'].replace(/;\s*upgrade-insecure-requests\s*/, '').trim();
  }
  (opts.ohne || []).forEach((n) => { Object.keys(k).forEach((x) => { if (x.toLowerCase() === String(n).toLowerCase()) delete k[x]; }); });
  return k;
}

const TYPEN = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

// Ein Server ueber dem Repo mit den Kopfzeilen aus _headers. opts.ohne: Namen, die fuer eine
// Gegenprobe wegfallen. opts.ankunft: Liste, in die jede Anfrage (Methode + Pfad + Suche) kommt.
function repoServer(opts) {
  opts = opts || {};
  return new Promise((fertig) => {
    const s = http.createServer((rq, rs) => {
      const roh = String(rq.url || '/');
      let p = decodeURIComponent(roh.split('?')[0]);
      if (opts.ankunft) opts.ankunft.push(rq.method + ' ' + roh);
      const pfadKopf = p;
      if (p === '/' || p === '') p = '/index.html';
      const f = path.join(WURZEL, path.normalize(p).replace(/^([/\\])+/, ''));
      if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); rs.end(); return; }
      const k = Object.assign({ 'Content-Type': TYPEN[path.extname(f).toLowerCase()] || 'application/octet-stream' }, kopfzeilenFuer(pfadKopf, opts));
      rs.writeHead(200, k); fs.createReadStream(f).pipe(rs);
    });
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      fertig({ s, port, basis: 'http://127.0.0.1:' + port + '/', schliessen: () => new Promise((r) => { try { s.closeAllConnections(); } catch (e) {} s.close(() => r()); }) });
    });
  });
}

module.exports = { kopfzeilenFuer, repoServer, bloecke, passt, WURZEL };
