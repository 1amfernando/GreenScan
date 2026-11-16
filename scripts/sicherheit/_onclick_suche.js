// _onclick_suche.js — sucht die Bauform „Wert in einem JS-String eines
// on*-Attributs" im Quelltext von index.html (v33.59). Kein Fall-Modul (der
// Unterstrich haelt es aus sicherheit_check heraus); 92_onclick.js benutzt es.
//
// Warum ein eigener Zerleger statt einer Zeilensuche: Kommentare muessen raus
// (sonst findet die Suche ihre eigene Fehlerdokumentation), und ein naiver
// Kommentar-Schnitt stolpert ueber Regex-Literale wie /'/g und ueber
// `accept="image/*"` (CLAUDE.md §7.1). Der Zerleger kennt Zeichenketten,
// Vorlagen, Regex-Literale und Kommentare und laesst Zeilennummern stehen.
'use strict';

const REGEX_DAVOR = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_WORT = /(?:^|[^\w$])(return|typeof|case|in|of|new|delete|void|throw|else|do|yield|await)$/;

// Gibt den Text mit ausgeleerten Kommentaren zurueck (Zeilenumbrueche bleiben),
// nur innerhalb von <script>-Bloecken ohne src; alles andere wird Leerraum.
function nurSkript(t) {
  const out = t.split('');
  const blank = (a, b) => { for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' '; };
  let pos = 0;
  const re = /<script(\s[^>]*)?>/gi;
  let m;
  const bereiche = [];
  while ((m = re.exec(t))) {
    if (/\ssrc=/.test(m[1] || '')) continue;
    const a = m.index + m[0].length;
    const e = t.indexOf('</script>', a);
    if (e < 0) break;
    bereiche.push([a, e]);
    re.lastIndex = e + 9;
  }
  for (const [a, e] of bereiche) { blank(pos, a); pos = e; }
  blank(pos, t.length);
  for (const [a, e] of bereiche) {
    let i = a, prev = '';   // prev = letztes bedeutsames Zeichen/Wort
    let vorWort = '';
    const tpl = [];         // Stapel offener ${ in Vorlagen (Klammertiefe)
    let tiefe = 0;
    while (i < e) {
      const c = t[i], c2 = t[i + 1];
      if (c === '/' && c2 === '/') { const n = t.indexOf('\n', i); const z = n < 0 || n > e ? e : n; blank(i, z); i = z; continue; }
      if (c === '/' && c2 === '*') { const n = t.indexOf('*/', i + 2); const z = n < 0 || n > e ? e : n + 2; blank(i, z); i = z; continue; }
      if (c === '"' || c === "'") {
        i++; while (i < e && t[i] !== c && t[i] !== '\n') { if (t[i] === '\\') i++; i++; }
        i++; prev = 'str'; vorWort = ''; continue;
      }
      if (c === '`' || (c === '}' && tpl.length && tpl[tpl.length - 1] === tiefe)) {
        if (c === '}') tpl.pop();
        i++;
        while (i < e && t[i] !== '`') {
          if (t[i] === '\\') { i += 2; continue; }
          if (t[i] === '$' && t[i + 1] === '{') { tpl.push(tiefe); i += 2; break; }
          i++;
        }
        if (t[i] === '`') { i++; prev = 'str'; }
        else prev = '(';
        vorWort = '';
        continue;
      }
      if (c === '/') {
        const istRegex = prev === '' || REGEX_DAVOR.has(prev) || REGEX_WORT.test(vorWort);
        if (istRegex) {
          i++; let klasse = false;
          while (i < e && t[i] !== '\n') {
            if (t[i] === '\\') { i += 2; continue; }
            if (t[i] === '[') klasse = true; else if (t[i] === ']') klasse = false;
            else if (t[i] === '/' && !klasse) break;
            i++;
          }
          i++; while (/[a-z]/.test(t[i] || '')) i++;
          prev = 'rx'; vorWort = ''; continue;
        }
      }
      if (/\s/.test(c)) { i++; continue; }
      if (/[\w$]/.test(c)) { let w = ''; while (i < e && /[\w$]/.test(t[i])) w += t[i++]; prev = 'w'; vorWort = w; if (/^(return|typeof|case|in|of|new|delete|void|throw|else|do|yield|await)$/.test(w)) prev = ''; continue; }
      if (c === '{' || c === '(' || c === '[') tiefe++;
      if (c === '}' || c === ')' || c === ']') tiefe--;
      prev = c === ')' || c === ']' ? 'w' : c; vorWort = ''; i++;
    }
  }
  return out.join('');
}

function ohneChangelog(t) {
  const a = t.indexOf('window.GS_RELEASES = [');
  if (a < 0) return t;
  const b = t.indexOf('\n];', a);
  if (b < 0) return t;
  return t.slice(0, a) + t.slice(a, b + 3).replace(/[^\n]/g, ' ') + t.slice(b + 3);
}

// Der Ausdruck zwischen zwei Verkettungen: Klammern zaehlen, Zeichenketten
// ueberspringen, bis ein `+` auf Tiefe 0 kommt, dem ein Anfuehrungszeichen folgt.
const HANDLER = /\bon(click|change|input|keydown|keyup|keypress|blur|focus|submit|error|load|touchstart|touchend|pointerdown|pointerup|mousedown|mouseup|mouseover|mouseenter|mouseleave|dblclick|contextmenu)\s*=\s*(\\?["'])/gi;

// Bauformen: [Name, Regex fuer das OEFFNENDE Stueck, Schliessen-Erkenner]
//   sq  : '…\'' + X + '\'…'      (JS in '…', Argument in \')
//   dq  : "…'" + X + "'…"        (JS in "…", Argument in ')
//   quot: '…&quot;' + X + '&quot;…'
//   tpl : `…'${X}'…`
function finde(text) {
  const zeilen = text.split('\n');
  const treffer = [];
  const muster = [
    { art: 'sq', re: /\\'\s*'\s*\+\s*/g, zu: /^\s*\+\s*'\\'/ },
    { art: 'dq', re: /'"\s*\+\s*/g, zu: /^\s*\+\s*"'/ },
    { art: 'quot', re: /&quot;'\s*\+\s*/g, zu: /^\s*\+\s*'&quot;/ },
    { art: 'quotdq', re: /&quot;"\s*\+\s*/g, zu: /^\s*\+\s*"&quot;/ },
  ];
  zeilen.forEach((z, zi) => {
    if (!z.trim()) return;
    // Kontext: diese Zeile + bis zu 3 Zeilen davor (Verkettungen ueber Zeilen)
    let kontext = z, k0 = zi;
    while (k0 > 0 && zi - k0 < 3 && (/^\s*\+/.test(zeilen[k0]) || /\+\s*$/.test(zeilen[k0 - 1]))) { k0--; kontext = zeilen[k0] + '\n' + kontext; }
    const versatz = kontext.length - z.length;
    for (const m of muster) {
      m.re.lastIndex = 0;
      let r;
      while ((r = m.re.exec(z))) {
        const start = r.index + r[0].length;
        // Ausdruck einlesen
        let i = start, d = 0, ausdruck = '';
        while (i < z.length) {
          const c = z[i];
          if (c === '"' || c === "'" || c === '`') {
            if (d === 0 && /\+\s*$/.test(ausdruck)) break;
            const q = c; ausdruck += c; i++;
            while (i < z.length && z[i] !== q) { if (z[i] === '\\') { ausdruck += z[i]; i++; } ausdruck += z[i]; i++; }
            ausdruck += z[i] || ''; i++; continue;
          }
          if (c === '(' || c === '[' || c === '{') d++;
          if (c === ')' || c === ']' || c === '}') { if (d === 0) break; d--; }
          if (d === 0 && (c === ';' || c === ',')) break;
          ausdruck += c; i++;
        }
        ausdruck = ausdruck.replace(/\s*\+\s*$/, '').trim();
        const rest = z.slice(start + ausdruck.length);
        const schliesst = m.zu.test(rest) || (ausdruck && /^\s*\+\s*$/.test(rest));
        if (!ausdruck || !schliesst) continue;
        const vor = kontext.slice(0, versatz + r.index);
        const handler = imHandler(vor, m.art);
        treffer.push({ zeile: zi + 1, art: m.art, ausdruck, handler, text: z.trim().slice(0, 220) });
      }
    }
    // Vorlagen: '${X}' innerhalb einer Vorlage, die on*= traegt
    const tre = /'\$\{([^}]*)\}'/g;
    let r;
    while ((r = tre.exec(z))) {
      const vor = kontext.slice(0, versatz + r.index);
      treffer.push({ zeile: zi + 1, art: 'tpl', ausdruck: r[1].trim(), handler: imHandler(vor, 'tpl'), text: z.trim().slice(0, 220) });
    }
  });
  return treffer;
}

// Steht die Stelle in einem noch offenen on*="…"? Gesucht wird das letzte
// on*= davor; offen ist es, wenn sein Anfuehrungszeichen danach nicht wieder
// vorkommt (in derselben Schreibweise: \" bzw. ").
function imHandler(vor, art) {
  HANDLER.lastIndex = 0;
  let m, letzter = null;
  while ((m = HANDLER.exec(vor))) letzter = m;
  if (!letzter) return false;
  const q = letzter[2];
  const danach = vor.slice(letzter.index + letzter[0].length);
  if (q === '\\"' || q === "\\'") return danach.indexOf(q) < 0;
  // " ohne Backslash: im '-Quelltext ist das das Attributende
  const qq = q;
  for (let i = 0; i < danach.length; i++) if (danach[i] === qq && danach[i - 1] !== '\\') return false;
  return true;
}

// Klassen: a = Zahl/Konstante aus eigener Rechnung, b = schon geschuetzt, c = zu aendern
const SICHER = /^(_gsOcStr|_gsOcArg|_gsOcJson|_gsIdSicher)\((.*)\)$/s;
const ZAHL = /^(\d+|i|j|idx|index|\(?(i|j|idx)\s*[+-]\s*\d+\)?|Number\([^()]*\)|parseInt\([^()]*\)|[\w.]+\.length)$/;
// Ein Helfer schuetzt nur in SEINEM Kontext: _gsOcStr nur in '…' (in &quot;…&quot;
// beendet ein " im Wert den String), _gsOcJson nur als ganzes Argument (in '…'
// wird sein &#39; zu ' und beendet den String). _gsIdSicher passt ueberall.
function klasse(ausdruck, art) {
  const h = (ausdruck.match(SICHER) || [])[1];
  if (h === '_gsOcJson' && art && art !== 'nq') return 'c';
  if ((h === '_gsOcStr' || h === '_gsOcArg') && (art === 'quot' || art === 'quotdq')) return 'c';
  if (SICHER.test(ausdruck)) {
    // nur, wenn der ganze Ausdruck EIN Aufruf ist (keine zweite Klammer-Ebene oben)
    let d = 0, oben = 0;
    for (const c of ausdruck) { if (c === '(') { if (d === 0) oben++; d++; } else if (c === ')') d--; }
    if (oben === 1) return 'b';
  }
  if (ZAHL.test(ausdruck)) return 'a';
  return 'c';
}

module.exports = { nurSkript, ohneChangelog, finde, klasse };
