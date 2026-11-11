// Gruppe v1 — eine Adresse in base64 ist eine Adresse (v33.6x, Release-Zug 11.11.2026).
// Gefunden bei der Sichtung der 123 nie gemergten claude/lucid-cerf-*-Branches: ein
// „Admin-Check (verschlüsselt)" trug zwei private E-Mail-Adressen als atob('…') und schrieb
// window._gsIsAdmin, das niemand las. Die Reparatur lag seit dem 31.07.2026 auf einem Branch
// (xf8w1q) und kam nie an — jede Auslieferung schickte die Adressen an jedes Telefon.
// Der Fall liest die ausgelieferten Dateien (Web-Root = Repo) und dekodiert JEDES
// base64-Literal ab 16 Zeichen in einem atob(…) oder einer Zuweisung; eine E-Mail-Form
// darin ist rot. Gegenrichtung: ein gebautes Literal mit Adresse wird erkannt, eines ohne nicht.
'use strict';
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const DATEIEN = ['index.html', 'sw.js', 'install.html', 'offline.html', 'privacy.html'];
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

function funde(text) {
  const aus = [];
  const re = /atob\(\s*['"]([A-Za-z0-9+/=]{16,})['"]\s*\)|['"]([A-Za-z0-9+/]{24,}={0,2})['"]/g;
  let m;
  while ((m = re.exec(text))) {
    const roh = m[1] || m[2];
    let klar = '';
    try { klar = Buffer.from(roh, 'base64').toString('utf8'); } catch (e) { continue; }
    // nur lesbarer Text zaehlt (Bilder, Schluessel-Bytes sind kein Klartext)
    if (!/^[\x20-\x7e|,;]+$/.test(klar)) continue;
    if (EMAIL.test(klar)) aus.push({ stelle: text.slice(0, m.index).split('\n').length, laenge: roh.length });
  }
  return aus;
}

module.exports = [
  {
    name: 'V1 · keine E-Mail-Adresse in base64 in einer ausgelieferten Datei (index.html, sw.js, die drei Seiten)',
    lauf: async () => {
      const gefunden = [];
      for (const d of DATEIEN) {
        const p = path.join(WURZEL, d);
        if (!fs.existsSync(p)) continue;
        funde(fs.readFileSync(p, 'utf8')).forEach(f => gefunden.push(d + ':' + f.stelle));
      }
      // Gegenrichtung am gebauten Text — sonst waere ein Fall, der nie etwas findet, auch gruen
      const gut = funde("var a = atob('" + Buffer.from('nur-ein-text-ohne-adresse').toString('base64') + "');").length === 0;
      const boese = funde("var a = atob('" + Buffer.from('jemand@beispiel.ch|zweite@beispiel.ch').toString('base64') + "');").length === 1;
      if (!gut || !boese) return { ok: false, warum: 'die Suche selbst irrt (gebaut: ohne Adresse ' + (gut ? 'still' : 'gemeldet') + ', mit Adresse ' + (boese ? 'gemeldet' : 'still') + ')' };
      return gefunden.length
        ? { ok: false, warum: gefunden.length + ' Literal(e) mit E-Mail-Form: ' + gefunden.join(', ') }
        : { ok: true, info: DATEIEN.length + ' Dateien · 0 Adressen in base64 · Gegenrichtung erkannt' };
    },
  },
];
