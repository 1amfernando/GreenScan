#!/usr/bin/env node
/**
 * versprechen_check.js — wer verspricht etwas, das niemand geprüft hat?
 *
 * `save_check` fährt einzelne Speicherwege wirklich zu Ende. Das ist die
 * genauere Prüfung — und sie skaliert nicht: die App hat **109 echte
 * Schreibvorgänge**, und jeder Eintrag dort ist Handarbeit.
 *
 * Dieser Prüfstand stellt dieselbe Frage statisch über ALLE. Und er stellt sie
 * schärfer, denn nicht jeder fehlende Blick ist ein Fehler:
 *
 *   Ein stiller Hintergrund-Schreibvorgang darf scheitern. Er verspricht ja
 *   nichts. Zum Fehler wird es erst, wenn die App dem Nutzer sagt
 *   „gespeichert" — ohne nachgesehen zu haben, ob das stimmt.
 *
 * DREI KLASSEN, nicht zwei:
 *
 *   rot    nach dem Schreiben eine Erfolgsmeldung, ohne dass die Antwort
 *          angesehen wurde → ein Versprechen, das niemand geprüft hat
 *   grün   die Antwort wird angesehen (`.error`, leeres `data`, Statuscode)
 *   still  gar keine Meldung → vertretbar, wird nur gezählt
 *
 * WARUM `.catch()` NICHT ZÄHLT: `sbFetch` WIRFT NICHT. Es liefert
 * `{data, error}`. Ein `try/catch` um einen Schreibvorgang fängt deshalb nur
 * Netz- und JS-Fehler — eine Ablehnung durch den Server läuft mitten
 * hindurch, und die Erfolgsmeldung dahinter feuert. Genau das war die
 * v31.95-Klasse und in v32.27 noch einmal die Arten-Korrektur.
 *
 * UND: PostgREST liefert bei einer von RLS abgewiesenen Zeile **0 Datensätze
 * und keinen Fehler**. Wer nur `error` prüft, meldet dann Erfolg für nichts.
 *
 * EIN TREFFER IST EIN VERDACHT, KEIN URTEIL — wie bei `field_check.py`. Der
 * erste Lauf fand vier; alle vier waren echt, drei davon eindeutig.
 *
 * GRENZE: rein statisch. Wer die Antwort in einem Helfer prüft, den diese
 * Funktion aufruft, wird als rot gemeldet. Und RPC-Aufrufe sind ausgenommen —
 * dort ist POST das Protokoll, kein Schreiben (mein erster Zähler hat sie
 * mitgezählt und meldete 180 statt 34).
 *
 *   node scripts/versprechen_check.js
 */
const fs = require('fs');
const path = require('path');
const QUELLE = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// Kommentare entfernen, Zeichenketten MITFÜHREN. Die naive Variante zerlegt
// sich an `accept="image/*"` — das `/*` steht dort in einer Zeichenkette und
// schliesst nie (CLAUDE.md §7.1).
function ohneKommentare(s) {
  let out = '', i = 0; const n = s.length;
  while (i < n) {
    const c = s[i], c2 = s[i + 1];
    if (c === '/' && c2 === '/') { while (i < n && s[i] !== '\n') { out += ' '; i++; } continue; }
    if (c === '/' && c2 === '*') {
      out += '  '; i += 2;
      while (i < n && !(s[i] === '*' && s[i + 1] === '/')) { out += (s[i] === '\n' ? '\n' : ' '); i++; }
      out += '  '; i += 2; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const qz = c; out += c; i++;
      while (i < n && s[i] !== qz) { if (s[i] === '\\') { out += '  '; i += 2; continue; } out += s[i]; i++; }
      out += qz; i++; continue;
    }
    out += c; i++;
  }
  return out;
}
const Q = ohneKommentare(QUELLE);

function funktionUm(pos) {
  let start = -1;
  for (let i = pos; i > 0 && i > pos - 30000; i--) {
    if (Q.startsWith('function', i) && /[\s=(]/.test(Q[i - 1] || ' ')) { start = i; break; }
  }
  if (start < 0) return null;
  let i = Q.indexOf('{', start), d = 0, ende = -1;
  if (i < 0) return null;
  for (; i < Q.length && i < start + 60000; i++) {
    if (Q[i] === '{') d++;
    else if (Q[i] === '}') { d--; if (d === 0) { ende = i; break; } }
  }
  if (ende < 0 || ende < pos) return null;
  const kopf = Q.slice(start, Q.indexOf('(', start));
  return { start, ende, name: (kopf.match(/function\s+([A-Za-z0-9_$]+)/) || [, '(anonym)'])[1] };
}

const MELDER  = /(showProfileToast|gsToast)\s*\(/g;
const POSITIV = /(gespeichert|gesendet|übermittelt|uebermittelt|Danke|erfolgreich|angelegt|hinzugefügt|hinzugefuegt|aktualisiert|✅|🙏|angenommen|eingetragen|erstellt|festgehalten|Live im)/i;
// Eine ABSAGE ist kein Versprechen. Ohne diese Zeile meldet der Prüfstand die
// Reparatur als den Fehler: „Eintrag NICHT gespeichert" enthält „gespeichert".
// (Beim ersten Lauf nach dem Fix prompt passiert — ein Prüfstand, der die
// Verneinung nicht kennt, misst das Gegenteil dessen, was er behauptet.)
// 🚫 steht hier NICHT: in dieser App heisst es „Pestizid-frei", nicht
// „fehlgeschlagen". Ein Zeichen, das zwei Dinge bedeuten kann, taugt nicht als
// Merkmal — es hat `saveListing` verschluckt, das sehr wohl etwas verspricht.
const ABSAGE = /(\bnicht\b|fehlgeschlagen|misslungen|konnte nicht|'error'|"error"|'warn'|"warn"|⚠️|❌)/i;
// Was als „Antwort angesehen" zählt. Bewusst grosszügig: lieber eine echte
// Prüfung übersehen als eine erfinden.
const GEPRUEFT = /(_gsSchreibOk|\.error\b|\berror\s*\)|\.data\s*&&|\.data\s*\.\s*length|Array\.isArray\s*\(\s*\w+\.data|\bok\s*=|status\s*[<>=]|!\s*\w+\.error)/;
// `_gsSchreibOk` steht ganz vorn: er IST die Prüfung (error + leeres data in
// einer Zeile). Ohne ihn hier meldet der Prüfstand jede Stelle rot, die ihn
// benutzt — Reparatur und Prüfung brauchen dieselbe Regel (Lehre aus v32.16).

const rot = [], gruen = [], still = [];
const re = /sbFetch\s*\(/g; let m;
while ((m = re.exec(Q))) {
  let i = m.index + m[0].length, d = 1, ende = -1;
  while (i < Q.length && i < m.index + 4000) { const c = Q[i]; if (c === '(') d++; else if (c === ')') { d--; if (!d) { ende = i; break; } } i++; }
  if (ende < 0) continue;
  const aufruf = Q.slice(m.index, ende + 1);
  if (!/method:\s*'(POST|PATCH|DELETE|PUT)'/.test(aufruf)) continue;
  if (aufruf.includes('/rest/v1/rpc/')) continue;     // POST ist dort das Protokoll
  const f = funktionUm(m.index);
  const zeile = QUELLE.slice(0, m.index).split('\n').length;
  if (!f) { still.push({ zeile, name: '(keine Funktion)' }); continue; }
  const danach = Q.slice(ende, f.ende);
  // Nur das ARGUMENT der Meldung ansehen, nicht ein festes Fenster: sonst
  // ragt die Prüfung in den Fehlerzweig daneben und wertet eine echte
  // Erfolgsmeldung als Absage ab. (Erster Anlauf: grün fiel von 18 auf 6.)
  MELDER.lastIndex = 0;
  let meldung = null, mm;
  while ((mm = MELDER.exec(danach))) {
    let j = mm.index + mm[0].length, t = 1, schluss = -1;
    while (j < danach.length && j < mm.index + 1200) {
      const c = danach[j];
      if (c === '(') t++;
      else if (c === ')') { t--; if (!t) { schluss = j; break; } }
      j++;
    }
    const arg = danach.slice(mm.index, schluss < 0 ? mm.index + 260 : schluss + 1);
    if (POSITIV.test(arg) && !ABSAGE.test(arg)) { meldung = arg.slice(0, 100).replace(/\s+/g, ' '); break; }
  }
  if (!meldung) { still.push({ zeile, name: f.name }); continue; }
  (GEPRUEFT.test(danach.slice(0, 1200)) ? gruen : rot).push({ zeile, name: f.name, meldung });
}

console.log('=== versprechen_check — wer verspricht etwas, das niemand geprüft hat?');
console.log('  Schreibvorgänge (POST/PATCH/DELETE, ohne RPC): ' + (rot.length + gruen.length + still.length));
console.log('    grün  Antwort angesehen:                     ' + gruen.length);
console.log('    still kein Versprechen (vertretbar):         ' + still.length);
console.log('    ROT   Versprechen ohne Prüfung:              ' + rot.length);
console.log('');
rot.forEach(o => {
  console.log('  !! Zeile ' + o.zeile + '  ' + o.name);
  console.log('       verspricht: ' + o.meldung);
});
if (!rot.length) console.log('  ✓ Keine Erfolgsmeldung ohne Blick auf die Antwort.');
// `--alle` zeigt auch grün und still. Ein Prüfstand, der nur Fehler druckt,
// lässt offen, WARUM eine Stelle nicht auffällt — und genau daran habe ich
// beim Bau zweimal falsch geraten.
if (process.argv.includes('--alle')) {
  console.log('');
  console.log('  grün (Antwort angesehen):');
  gruen.forEach(o => console.log('     ' + String(o.zeile).padStart(6) + '  ' + o.name));
  console.log('  still (kein Versprechen erkannt):');
  still.forEach(o => console.log('     ' + String(o.zeile).padStart(6) + '  ' + o.name));
}
console.log('');
console.log('  Ein Treffer ist ein Verdacht, kein Urteil: wer die Antwort in einem');
console.log('  HELFER prüft, wird hier rot gemeldet. Nachsehen, dann entscheiden.');
process.exitCode = rot.length ? 1 : 0;
