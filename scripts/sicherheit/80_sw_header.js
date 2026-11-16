// Kopfzeilen, pdf.js, Schriften, Changelog-Archiv (v33.59, Gruppe k8).
// Die Service-Worker-Faelle stehen in offline_check (sie brauchen einen echten
// Worker ueber HTTP, `node scripts/offline_check.js haertung` faehrt nur sie);
// hier steht, was sich aus dem Quelltext lesen oder in der Seite RUFEN laesst.
'use strict';
const fs = require('fs');
const path = require('path');
const WURZEL = path.resolve(__dirname, '..', '..');
const lies = (f) => fs.readFileSync(path.join(WURZEL, f), 'utf8');

function kopf(name) {
  const m = lies('_headers').match(new RegExp('^\\s+' + name + ':\\s*(.+)$', 'm'));
  return m ? m[1] : '';
}
function direktive(csp, d) {
  const m = csp.match(new RegExp('(?:^|;)\\s*' + d + ' ([^;]*)'));
  return m ? m[1].trim().split(/\s+/) : null;
}
// Der Code ohne Kommentarzeilen und ohne die Release-Notizen (die nennen Hosts
// als Zitat). Keine Suche nach /* … */: `accept="image/*"` oeffnet sonst einen
// „Kommentar", der den halben Rest der Datei verschluckt (CLAUDE.md §7.1).
function code(datei) {
  let t = lies(datei).replace(/<!--[\s\S]*?-->/g, '');
  const a = t.indexOf('window.GS_RELEASES = ['), e = a >= 0 ? t.indexOf('\n];', a) : -1;
  if (a >= 0 && e > a) t = t.slice(0, a) + t.slice(e);
  return t.split('\n').filter(z => !/^\s*(\/\/|\*|\/\*)/.test(z)).join('\n');
}

module.exports = [
  {
    name: 'CSP · object-src none, kein cdnjs (pdf.js selbst gehostet, Version im Pfad), connect-src nennt nur Hosts, die der Code anspricht (ein Supabase-Projekt, kein *.fastly.net, kein www.google.com)',
    lauf: async (seite) => {
      const csp = kopf('Content-Security-Policy');
      const f = [];
      const obj = direktive(csp, 'object-src');
      if (!obj || obj.join(' ') !== "'none'") f.push('object-src: ' + (obj ? obj.join(' ') : 'fehlt — faellt auf default-src zurueck'));
      const def = direktive(csp, 'default-src') || [];
      if (def.indexOf('https:') >= 0) f.push("default-src erlaubt jeden https-Host");
      // pdf.js: selbst gehostet, Version im Pfad — dann braucht die CSP gar kein cdnjs.
      const pdf = await seite.evaluate(() => ({ url: window._gsPdfjsUrl, worker: window._gsPdfjsWorkerUrl }));
      const pfad = String(pdf.url || '').replace(/[^/]+$/, '');
      if (/cdnjs/.test(csp)) f.push('cdnjs steht noch in der CSP');
      if (!/^assets\/pdfjs\/\d+\.\d+\.\d+\/$/.test(pfad)) f.push('pdf.js nicht selbst gehostet mit Version im Pfad: ' + pdf.url);
      if (String(pdf.worker || '').indexOf(pfad) !== 0) f.push('Worker-Pfad liegt nicht unter ' + pfad);
      [pdf.url, pdf.worker].forEach(u => { if (u && !fs.existsSync(path.join(WURZEL, u))) f.push('fehlt im Repo: ' + u); });
      const conn = direktive(csp, 'connect-src') || [];
      const roh = code('index.html') + '\n' + code('sw.js');
      const ungenutzt = conn.filter(x => /^(https|wss):/.test(x)).filter(x => {
        // Ein Platzhalter nur fuer die Unterdomain-Vorlage einer Karte ({s}.tile.…)
        if (x.indexOf('*') >= 0) return roh.indexOf(x.replace('*.', '{s}.')) < 0;
        const host = x.replace(/^(https|wss):\/\//, '');
        if (/^wss:/.test(x)) return roh.indexOf(host) < 0;     // wss: Realtime auf dem Projekt-Host
        return roh.indexOf(x) < 0;
      });
      if (ungenutzt.length) f.push('connect-src ohne Aufrufer oder mit Platzhalter: ' + ungenutzt.join(' '));
      const sb = await seite.evaluate(() => (typeof SB_URL_DEFAULT !== 'undefined') ? SB_URL_DEFAULT : '');
      if (sb && conn.indexOf(sb) < 0) f.push('connect-src ohne das Projekt ' + sb);
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: "object-src 'none' · kein cdnjs, pdf.js aus " + pfad + ' · connect-src ' + conn.length + ' Quellen, jede mit Aufrufer' };
    },
  },
  {
    name: 'Permissions-Policy · was die App ruft (Kamera, Standort, Mikrofon, Lagesensoren), ist fuer den eigenen Ursprung erlaubt — und kein interest-cohort',
    lauf: async () => {
      const pp = kopf('Permissions-Policy');
      const regeln = {};
      pp.split(',').forEach(t => { const m = t.trim().match(/^([a-z-]+)=\((.*)\)$/); if (m) regeln[m[1]] = m[2].trim(); });
      const c = code('index.html');
      const braucht = [
        ['camera', /getUserMedia\s*\(/],
        ['geolocation', /navigator\.geolocation/],
        ['microphone', /SpeechRecognition/],
        ['accelerometer', /'deviceorientation'/], ['gyroscope', /'deviceorientation'/], ['magnetometer', /'deviceorientation'/],
      ];
      const f = [];
      let gebraucht = 0;
      braucht.forEach(([feat, muster]) => {
        if (!muster.test(c)) return;
        gebraucht++;
        if (!(feat in regeln)) return;                          // nicht genannt = Vorgabe (self)
        if (!/\bself\b/.test(regeln[feat])) f.push(feat + '=(' + regeln[feat] + ') — die App ruft es');
      });
      if ('interest-cohort' in regeln) f.push('interest-cohort kennt kein Browser mehr (browsing-topics)');
      if (!('browsing-topics' in regeln)) f.push('browsing-topics nicht gesperrt');
      if (!('usb' in regeln) || regeln.usb !== '') f.push('usb nicht gesperrt');
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: gebraucht + ' benutzte Faehigkeiten alle (self) · usb/browsing-topics ()' };
    },
  },
  {
    name: 'Changelog-Archiv · gsLoadReleaseArchive laedt data/releases.v1.js mit der LAUFENDEN Version in der Adresse (die Datei aendert sich bei jedem Bump, /data/* ist immutable)',
    lauf: async (seite) => {
      const r = await seite.evaluate(() => {
        const vorher = window.GS_RELEASES_ARCHIVE;
        try { delete window.GS_RELEASES_ARCHIVE; } catch (_) { window.GS_RELEASES_ARCHIVE = undefined; }
        window._gsRelArchiveQ = null;
        Array.from(document.querySelectorAll('script[src*="releases.v1.js"]')).forEach(s => s.remove());
        window.gsLoadReleaseArchive(function () {});
        const s = document.querySelector('script[src*="releases.v1.js"]');
        if (vorher) window.GS_RELEASES_ARCHIVE = vorher;
        return { src: s ? s.getAttribute('src') : null, v: (typeof GS_VERSION === 'string') ? GS_VERSION : null };
      });
      if (!r.src) return { ok: false, warum: 'kein <script> fuer das Archiv angelegt' };
      const v = (r.src.match(/[?&]v=([^&]+)/) || [])[1];
      if (!r.v || v !== encodeURIComponent(r.v)) return { ok: false, warum: 'Adresse ' + r.src + ' — laufende Version ' + r.v };
      return { ok: true, info: r.src };
    },
  },
  {
    name: 'pdf.js · extractPdfText oeffnet ein Dokument mit isEvalSupported: false (CVE-2024-4367 betrifft pdf.js < 4.2.67) — mit einer gestellten Bibliothek gerufen',
    lauf: async (seite) => {
      const r = await seite.evaluate(async () => {
        const echt = window._pdfjsLib;
        let opts = null;
        window._pdfjsLib = { getDocument: (o) => { opts = o; return { promise: Promise.resolve({ numPages: 1, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: 'Bärlauch' }] }) }) }) }; } };
        // extractPdfText liegt in einer IIFE — erreichbar ueber den Weg, der sie ruft, ist er nicht
        // ohne Admin-Formular; deshalb aus dem Quelltext der Seite geholt und GERUFEN (dieselbe Funktion).
        let text = null, fehler = null;
        try {
          const quelle = Array.from(document.scripts).map(s => s.textContent).find(t => t.indexOf('async function extractPdfText(') >= 0) || '';
          const a = quelle.indexOf('async function extractPdfText(');
          let i = quelle.indexOf('{', a), tiefe = 0, e = -1;
          for (; i < quelle.length; i++) { if (quelle[i] === '{') tiefe++; else if (quelle[i] === '}') { tiefe--; if (!tiefe) { e = i; break; } } }
          const fn = (0, eval)('(' + quelle.slice(a, e + 1) + ')');
          text = await fn({ arrayBuffer: async () => new ArrayBuffer(4) });
        } catch (x) { fehler = String(x && x.message); }
        window._pdfjsLib = echt;
        return { opts: opts ? Object.keys(opts).reduce((o, k) => (o[k] = (k === 'data') ? '[buf]' : opts[k], o), {}) : null, text, fehler };
      });
      if (r.fehler) return { ok: false, warum: 'Aufruf scheiterte: ' + r.fehler };
      if (!r.opts) return { ok: false, warum: 'getDocument wurde nicht gerufen' };
      if (r.opts.isEvalSupported !== false) return { ok: false, warum: 'getDocument(' + JSON.stringify(r.opts) + ') — isEvalSupported nicht false' };
      if (!r.text || r.text[0] !== 'Bärlauch') return { ok: false, warum: 'Text kam nicht an: ' + JSON.stringify(r.text) };
      return { ok: true, info: 'getDocument(' + JSON.stringify(r.opts) + ') · Text kommt an' };
    },
  },
  {
    name: 'Schriften · kein Google-Fonts-Link in index.html/install.html, die @font-face-Dateien liegen im Repo und die Seite RENDERT mit DM Sans und Playfair Display',
    lauf: async (seite) => {
      const f = [];
      for (const d of ['index.html', 'install.html', 'offline.html', 'privacy.html']) {
        const t = code(d);
        if (/fonts\.(googleapis|gstatic)\.com/.test(t)) f.push(d + ' nennt fonts.googleapis/gstatic');
      }
      const csp = kopf('Content-Security-Policy');
      if (/fonts\.(googleapis|gstatic)\.com/.test(csp)) f.push('CSP erlaubt Google Fonts noch');
      const urls = Array.from(lies('index.html').matchAll(/url\(['"]?(assets\/fonts\/[^'")]+)['"]?\)/g)).map(m => m[1]);
      if (!urls.length) f.push('kein lokales @font-face in index.html');
      urls.forEach(u => { if (!fs.existsSync(path.join(WURZEL, u))) f.push('fehlt: ' + u); });
      const geladen = await seite.evaluate(async () => {
        await document.fonts.load('400 16px "DM Sans"'); await document.fonts.load('800 16px "Playfair Display"');
        return { dm: document.fonts.check('400 16px "DM Sans"'), pf: document.fonts.check('800 16px "Playfair Display"'),
                 status: Array.from(document.fonts).filter(x => /DM Sans|Playfair/.test(x.family)).map(x => x.family + ' ' + x.weight + ' ' + x.status).filter(s => /loaded/.test(s)).length };
      });
      if (!geladen.status) f.push('keine der Schriften wurde geladen: ' + JSON.stringify(geladen));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: urls.length + ' Schriftdateien lokal · ' + geladen.status + ' Schnitte in der Seite geladen' };
    },
  },
];
