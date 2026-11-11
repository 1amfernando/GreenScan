#!/usr/bin/env node
// statik_check.js — was sagt ein PARSER ueber den Quelltext, das kein Lauf zeigt?
//
//   node scripts/statik_check.js
//
// Anlass (v33.59): Fernandos „Checke alle Fehler, unschöne Programmierungen
// und ähnliches." Die 39 anderen Pruefstaende FAHREN die App oder suchen mit
// Mustern im Text. Keiner LIEST sie als Programm. Ein Parser sieht in einer
// Sekunde, was ein Lauf nur zeigt, wenn er zufaellig durch die Zeile kommt:
//
//   - `_gsSichtbar` stand ZWEIMAL als Funktion in derselben Datei (v33.25 und
//     v33.43, zwei verschiedene Regeln). In JavaScript gewinnt still die
//     spaetere — der Zurueck-Knopf rechnete mit der Regel des Update-Waechters.
//   - `HABITAT_TEMPLATES` wurde gelesen und nirgends definiert; die Funktion
//     darum (`gsAutoFillDBGaps`) hatte keinen Aufrufer ausser ihrem eigenen
//     `setTimeout` — robust_check C2 hielt die Selbstnennung fuer einen Aufruf.
//     Sechs Funktionen lagen so unter dem Raster, zwei davon wurden noch in
//     v32.93 und v33.27 GEPFLEGT.
//   - `color:var(--fg,#1a1a1a)`: `--fg` gibt es nicht. Der zentrale
//     Rueckfrage-Dialog (49 Aufrufstellen) zeigte im Dunkelmodus Titel, Text
//     und „Abbrechen" mit 1,06:1 — schwarz auf schwarz.
//
// Was er prueft (jeder Fall nennt eine Zahl, die im Fehlerfall anders waere):
//   S0  alles parst (Inline-Skripte, sw.js, Datendateien, kleine Seiten, Pruefstaende)
//   S1  keine Funktion ist im selben Geltungsbereich zweimal deklariert
//   S2  kein Name wird benutzt, den es nirgends gibt (Lesen ohne Schutz, oder
//       eine Zuweisung, die still eine Globale anlegt)
//   S3  kein `typeof X`-Schutz vor etwas, das es NIE gibt (der Zweig dahinter ist tot)
//   S4  die Korrektheitsregeln des Linters, null Toleranz (doppelte Schluessel,
//       unerreichbarer Code, Selbstvergleich, ueberschriebene Funktion, …)
//   S5  keine Funktion, deren einzige weitere Nennungen im EIGENEN Rumpf stehen
//   S6  jede benutzte CSS-Variable ist definiert (sonst: feste Farbe mit Tarnkappe)
//   S7  sw.js: dieselben Regeln mit den Namen eines Service Workers
//
// Er braucht ESLint (nur als Bibliothek: Parser + Geltungsbereiche), in CI aus
// scripts/package.json, in der Claude-Cloud global. Ohne ESLint: „nicht
// pruefbar" (Exit 2), nie gruen. Die Namen des Browsers holt er aus einem
// echten Chromium in einem SICHEREN Kontext — in about:blank fehlt z.B.
// `caches`, und eine Liste von Hand veraltet.
//
// Grenze: er findet, was sich aus dem TEXT entscheiden laesst. Ein Name, der
// erst zur Laufzeit entsteht (`window[name] = …`), ist ihm unbekannt — solche
// Stellen stehen mit Grund in EXTERN. Ob eine Funktion das RICHTIGE tut, sagt
// kein Parser; dafuer sind die anderen 39 da.
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const WURZEL = path.resolve(__dirname, '..');
const { nennungsKorpus, bereinigt } = require('./_korpus.js');

function ladeEslint() {
  const kandidaten = [process.env.GS_ESLINT, path.join(__dirname, 'node_modules', 'eslint'), '/opt/node22/lib/node_modules/eslint'].filter(Boolean);
  for (const k of kandidaten) { try { const m = require(k); if (m && m.Linter) return m; } catch (_) {} }
  return null;
}
const ESLINT = ladeEslint();

// ── Namen, die es gibt, obwohl sie in keinem Inline-Skript deklariert sind ──
// Jeder Eintrag mit GRUND. Die Liste ist die Pruefung: ein Name, der hier
// steht und im Quelltext nicht mehr vorkommt, wird gemeldet (sonst waechst sie
// nur — v33.01: eine Regel ohne Ausloeser ist eine Bitte).
const EXTERN = {
  L: 'Leaflet — assets/leaflet.js haengt `L` an window (UMD, im minifizierten Text nicht als Zuweisung lesbar)',
  THREE: 'Three.js — wird erst bei Bedarf geladen (_gsLoadThree), nie beim Start',
};
// Browser-Schnittstellen, die es nicht ueberall gibt. Sie duerfen NUR hinter
// einem `typeof`-Schutz stehen; dort sind sie richtig und kein toter Zweig.
const OPTIONALE_APIS = {
  AmbientLightSensor: 'Generic Sensor API — in Chromium hinter einem Flag, in Safari/Firefox gar nicht; der Lichtmesser faellt sonst auf die Kamera zurueck',
};
// Was ein Service Worker hat und eine Seite nicht — und umgekehrt.
const SW_EIGEN = ['clients', 'registration', 'skipWaiting', 'importScripts'];
const SW_VERBOTEN = ['window', 'document', 'localStorage', 'sessionStorage', 'alert', 'confirm', 'prompt'];

// ── Inline-Skripte zeilentreu ziehen ────────────────────────────────────────
// Alles ausserhalb der Skripte wird zu Leerzeilen: die Zeilennummern stimmen
// mit der HTML-Datei ueberein. HTML-Kommentare werden uebersprungen — in
// index.html steht ein `<script type="module">` in einem Kommentar (pdf.js,
// v32.79), und ein Schnitt daran meldete einen Syntaxfehler, den es nicht gibt.
function inlineSkripte(html) {
  const teile = [];
  const re = /<script\b([^>]*)>|<!--/gi;
  let m;
  while ((m = re.exec(html))) {
    if (m[0] === '<!--') { const e = html.indexOf('-->', m.index); re.lastIndex = e < 0 ? html.length : e + 3; continue; }
    const attr = m[1];
    const start = m.index + m[0].length;
    const ende = html.indexOf('</script>', start);
    if (ende < 0) break;
    re.lastIndex = ende + 9;
    if (/\bsrc\s*=/.test(attr)) continue;
    if (/type\s*=\s*["'](?!text\/javascript|module)[^"']+["']/i.test(attr)) continue;   // JSON-LD u.ae.
    teile.push({ start, ende, modul: /type\s*=\s*["']module["']/i.test(attr) });
  }
  return teile;
}
function zeilentreu(html, teile) {
  let aus = '', pos = 0;
  const leer = (s) => s.replace(/[^\n]/g, '');
  for (const t of teile) { aus += leer(html.slice(pos, t.start)) + ';' + html.slice(t.start, t.ende) + ';'; pos = t.ende; }
  return aus + leer(html.slice(pos));
}

// ── Die eine Sammel-Regel ───────────────────────────────────────────────────
// ESLint dient hier als Parser mit Geltungsbereichen. Die Regel MELDET nichts,
// sie SAMMELT: doppelte Funktionsdeklarationen, unaufgeloeste Namen (mit der
// Frage, ob ein Schutz davorsteht) und die Funktionen der obersten Ebene.
function sammelRegel(aus) {
  return {
    meta: { type: 'problem', schema: [] },
    create(context) {
      const sc = context.sourceCode;
      const text = (n) => sc.getText(n);
      const esc = (s) => s.replace(/[$]/g, '\\$&');
      // Ein Schutz ist: `typeof X`, `window.X` / `self.X` / `globalThis.X`, `'X' in window`.
      const schutzRe = (name) => new RegExp('typeof\\s+' + esc(name) + '(?![\\w$])|(?:window|self|globalThis)\\.' + esc(name) + '(?![\\w$])|[\'"]' + esc(name) + '[\'"]\\s+in\\s+(?:window|self|globalThis)');
      function geschuetzt(id, name) {
        const re = schutzRe(name);
        let n = id;
        while (n.parent) {
          const p = n.parent;
          if ((p.type === 'IfStatement' || p.type === 'ConditionalExpression') && n !== p.test && re.test(text(p.test))) return true;
          if (p.type === 'LogicalExpression' && p.right === n && re.test(text(p.left))) return true;
          // Fruehes Aussteigen: `if (typeof X === 'undefined') return;` weiter oben im selben Block.
          const liste = Array.isArray(p.body) ? p.body : null;
          if (liste) {
            const i = liste.indexOf(n);
            for (let k = 0; k < i; k++) {
              const s = liste[k];
              if (s.type === 'IfStatement' && re.test(text(s.test)) && /\b(?:return|throw|continue|break)\b/.test(text(s.consequent))) return true;
            }
          }
          n = p;
        }
        return false;
      }
      return {
        'Program:exit'(prog) {
          for (const scope of sc.scopeManager.scopes) {
            for (const v of scope.variables) {
              const fd = v.defs.filter(d => d.type === 'FunctionName' && d.node.type === 'FunctionDeclaration');
              if (fd.length > 1) aus.doppelt.push({ name: v.name, zeilen: fd.map(d => d.node.loc.start.line) });
            }
          }
          const global = sc.scopeManager.scopes[0];
          for (const ref of global.through) {
            const id = ref.identifier;
            const typeofArg = !!(id.parent && id.parent.type === 'UnaryExpression' && id.parent.operator === 'typeof');
            aus.unaufgeloest.push({
              name: id.name, zeile: id.loc.start.line, schreibt: ref.isWrite(), typeofArg,
              geschuetzt: typeofArg || geschuetzt(id, id.name),
            });
          }
          for (const n of prog.body) {
            if (n.type === 'FunctionDeclaration' && n.id) aus.funktionen.push({ name: n.id.name, start: n.range[0], ende: n.range[1], zeile: n.loc.start.line, bis: n.loc.end.line });
          }
        },
      };
    },
  };
}

// Die Korrektheitsregeln: jede hat im Monolithen heute NULL Treffer. Regeln
// mit harmlosen Treffern (no-redeclare fuer `var` in derselben Funktion, elf
// Stellen; no-cond-assign mit Absicht) sind bewusst NICHT dabei — ein Bericht
// wird durch eine Zahl unlesbar, die man zu ignorieren gelernt hat (v32.21).
const REGELN = {
  'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-duplicate-case': 'error', 'no-dupe-else-if': 'error',
  'no-unreachable': 'error', 'no-func-assign': 'error', 'no-self-assign': 'error', 'no-self-compare': 'error',
  'use-isnan': 'error', 'valid-typeof': 'error', 'no-unsafe-negation': 'error', 'no-constant-binary-expression': 'error',
  'no-unsafe-finally': 'error', 'no-sparse-arrays': 'error', 'no-loss-of-precision': 'error', 'no-compare-neg-zero': 'error',
  'no-const-assign': 'error', 'no-obj-calls': 'error', 'no-setter-return': 'error', 'getter-return': 'error',
  'no-unsafe-optional-chaining': 'error', 'no-invalid-regexp': 'error', 'no-async-promise-executor': 'error',
  'for-direction': 'error', 'no-fallthrough': 'error', 'no-empty-character-class': 'error', 'no-ex-assign': 'error',
  'no-global-assign': 'error', 'no-shadow-restricted-names': 'error', 'no-delete-var': 'error',
  'no-dupe-class-members': 'error', 'no-class-assign': 'error', 'no-this-before-super': 'error',
  'no-new-native-nonconstructor': 'error', 'no-useless-backreference': 'error', 'no-empty-pattern': 'error',
  'no-nonoctal-decimal-escape': 'error', 'no-import-assign': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'array-callback-return': ['error', { checkForEach: false }],
  // Ein kombinierendes Zeichen in einer Zeichenklasse ist nur als ESCAPE lesbar
  // (‍, ⃣) — roh sieht man im Editor nicht, was in der Klasse steht.
  'no-misleading-character-class': ['error', { allowEscape: true }],
};

function analysiere(code, name) {
  const aus = { doppelt: [], unaufgeloest: [], funktionen: [], meldungen: [], fatal: null };
  const linter = new ESLINT.Linter({ configType: 'flat' });
  const meldungen = linter.verify(code, [{
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script' },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    plugins: { gs: { rules: { sammeln: sammelRegel(aus) } } },
    rules: Object.assign({ 'gs/sammeln': 'error' }, REGELN),
  }], { filename: name });
  for (const m of meldungen) {
    if (m.fatal) aus.fatal = 'Zeile ' + m.line + ': ' + m.message;
    else if (m.ruleId && m.ruleId !== 'gs/sammeln') aus.meldungen.push({ regel: m.ruleId, zeile: m.line, text: m.message });
    else if (!m.ruleId) aus.meldungen.push({ regel: '(linter)', zeile: m.line, text: m.message });
  }
  return aus;
}

// ── Die Namen des Browsers, aus einem echten Chromium ───────────────────────
// SICHERER Kontext: die Anfrage an https://green-scan.ch/ wird hier im
// Pruefstand beantwortet (kein Netz). In about:blank fehlen die Schnittstellen,
// die nur ein sicherer Kontext hat — `caches` zum Beispiel.
async function browserNamen() {
  const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
  const b = await chromium.launch();
  try {
    const p = await b.newPage();
    await p.route('**/*', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><title>statik</title>' }));
    await p.goto('https://green-scan.ch/');
    const namen = await p.evaluate(() => {
      const s = new Set(); let o = window;
      while (o) { Object.getOwnPropertyNames(o).forEach(n => s.add(n)); o = Object.getPrototypeOf(o); }
      return { namen: [...s], sicher: window.isSecureContext === true };
    });
    return namen;
  } finally { await b.close(); }
}

// ── Gemeinsamer Zustand der Faelle ──────────────────────────────────────────
const Z = { html: null, code: null, an: null, bekannt: null, sw: null, browser: null };

function vorbereiten() {
  Z.html = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
  Z.teile = inlineSkripte(Z.html);
  Z.code = zeilentreu(Z.html, Z.teile);
}

// Statische Zuweisungen an das globale Objekt — auch aus den Dateien, die
// index.html per <script src> laedt (data/plants.v1.js setzt window.DB).
function statischeNamen() {
  const s = new Set();
  const quellen = [Z.code];
  for (const m of Z.html.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']\/?([^"'?#]+)[^"']*["']/gi)) {
    const p = path.join(WURZEL, m[1]);
    if (/^https?:/.test(m[1]) || !fs.existsSync(p)) continue;
    if (fs.statSync(p).size < 4 * 1024 * 1024) quellen.push(fs.readFileSync(p, 'utf8'));
  }
  // was erst spaeter nachgeladen wird und Namen setzt (Changelog-Archiv)
  for (const f of ['data/releases.v1.js']) { try { quellen.push(fs.readFileSync(path.join(WURZEL, f), 'utf8')); } catch (_) {} }
  for (const q of quellen) {
    for (const m of q.matchAll(/(?:window|self|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) s.add(m[1]);
    for (const m of q.matchAll(/(?:window|self|globalThis)\[\s*['"]([A-Za-z_$][\w$]*)['"]\s*\]\s*=(?!=)/g)) s.add(m[1]);
    for (const m of q.matchAll(/Object\.defineProperty\(\s*(?:window|self|globalThis)\s*,\s*['"]([A-Za-z_$][\w$]*)['"]/g)) s.add(m[1]);
  }
  return s;
}

async function s0() {
  const klagen = [];
  let n = 0;
  // jedes Inline-Skript EINZELN (ein Fehler in einem Skript legt nur dieses lahm — aber ganz)
  const linter = new ESLINT.Linter({ configType: 'flat' });
  const parst = (code, name, modul) => {
    n++;
    const m = linter.verify(code, [{ files: ['**/*.js', '**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: modul ? 'module' : 'script' }, rules: {} }], { filename: modul ? name + '.mjs' : name + '.js' });
    const f = m.find(x => x.fatal);
    if (f) klagen.push(name + ' Zeile ' + f.line + ': ' + f.message);
  };
  Z.teile.forEach((t, i) => {
    const vor = Z.html.slice(0, t.start).replace(/[^\n]/g, '');
    parst(vor + Z.html.slice(t.start, t.ende), 'index.html#skript' + (i + 1), t.modul);
  });
  for (const seite of ['install.html', 'offline.html', 'privacy.html']) {
    const p = path.join(WURZEL, seite);
    if (!fs.existsSync(p)) continue;
    const h = fs.readFileSync(p, 'utf8');
    inlineSkripte(h).forEach((t, i) => parst(h.slice(0, t.start).replace(/[^\n]/g, '') + h.slice(t.start, t.ende), seite + '#skript' + (i + 1), t.modul));
  }
  for (const f of ['sw.js', 'data/plants.v1.js', 'data/releases.v1.js']) parst(fs.readFileSync(path.join(WURZEL, f), 'utf8'), f, false);
  // Pruefstaende und die geteilten Module der Edge-Functions: node --check (kennt CommonJS und ESM)
  const dateien = [];
  for (const f of fs.readdirSync(__dirname)) if (/\.js$/.test(f)) dateien.push(path.join(__dirname, f));
  const shared = path.join(WURZEL, 'supabase', 'functions', '_shared');
  if (fs.existsSync(shared)) for (const f of fs.readdirSync(shared)) if (/\.mjs$/.test(f)) dateien.push(path.join(shared, f));
  for (const d of dateien) {
    n++;
    const r = spawnSync(process.execPath, ['--check', d], { encoding: 'utf8' });
    if (r.status !== 0) klagen.push(path.relative(WURZEL, d) + ': ' + String(r.stderr || '').split('\n').slice(0, 3).join(' ').slice(0, 200));
  }
  if (Z.teile.length < 5) klagen.push('nur ' + Z.teile.length + ' Inline-Skripte in index.html gefunden — der Fall misst offenbar etwas anderes');
  if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') };
  return { ok: true, info: n + ' Quellen geparst · ' + Z.teile.length + ' Inline-Skripte in index.html · ' + dateien.length + ' Dateien mit node --check' };
}

async function s1() {
  Z.an = analysiere(Z.code, 'index.js');
  if (Z.an.fatal) return { ok: false, warum: 'index.html als EIN Programm parst nicht: ' + Z.an.fatal };
  if (Z.an.funktionen.length < 500) return { ok: false, warum: 'nur ' + Z.an.funktionen.length + ' Funktionen auf oberster Ebene — der Fall misst offenbar etwas anderes' };
  if (Z.an.doppelt.length) {
    return { ok: false, warum: Z.an.doppelt.length + ' doppelt deklariert (die SPAETERE gewinnt still, fuer alle Aufrufer): ' +
      Z.an.doppelt.slice(0, 6).map(d => d.name + ' Z. ' + d.zeilen.join(' + ')).join(' · ') };
  }
  return { ok: true, info: Z.an.funktionen.length + ' Funktionen auf oberster Ebene, keine doppelt (auch in keinem inneren Geltungsbereich)' };
}

async function s2s3() {
  const br = await browserNamen();
  Z.browser = new Set(br.namen);
  const stat = statischeNamen();
  Z.bekannt = (n) => Z.browser.has(n) || stat.has(n) || Object.prototype.hasOwnProperty.call(EXTERN, n);
  const unbekannt = Z.an.unaufgeloest.filter(u => !Z.bekannt(u.name));
  const rot = new Map(), tot = new Map();
  for (const u of unbekannt) {
    const optional = Object.prototype.hasOwnProperty.call(OPTIONALE_APIS, u.name);
    if (u.schreibt && !u.geschuetzt) { if (!rot.has(u.name)) rot.set(u.name, { art: 'legt still eine Globale an', z: [] }); rot.get(u.name).z.push(u.zeile); }
    else if (!u.geschuetzt) { if (!rot.has(u.name)) rot.set(u.name, { art: 'gelesen ohne Schutz', z: [] }); rot.get(u.name).z.push(u.zeile); }
    else if (!optional) { if (!tot.has(u.name)) tot.set(u.name, []); tot.get(u.name).push(u.zeile); }
  }
  Z.s2 = { rot, tot, br, stat, unaufgeloest: Z.an.unaufgeloest.length };
}

async function s2() {
  if (!Z.an || Z.an.fatal) return { ok: false, warum: 'S1 hat keinen Baum geliefert' };
  await s2s3();
  const { rot, br, stat } = Z.s2;
  const klagen = [];
  if (!br.sicher) klagen.push('die Browser-Namen stammen nicht aus einem sicheren Kontext — `caches` & Co. fehlten dann');
  if (Z.browser.size < 700) klagen.push('nur ' + Z.browser.size + ' Browser-Namen gesammelt — Chromium hat nicht geliefert');
  for (const n of Object.keys(EXTERN)) if (!new RegExp('(?<![\\w$.])' + n + '(?![\\w$])').test(Z.code)) klagen.push('EXTERN nennt `' + n + '`, der Quelltext nicht mehr — Eintrag ist ueberholt');
  if (rot.size) {
    klagen.push(rot.size + ' Name(n), die es nirgends gibt: ' + [...rot.entries()].slice(0, 8).map(([n, v]) => n + ' (' + v.art + ', Z. ' + v.z.slice(0, 4).join(', ') + (v.z.length > 4 ? ' …' : '') + ')').join(' · '));
  }
  if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
  return { ok: true, info: Z.s2.unaufgeloest + ' Namen ausserhalb der Skripte aufgeloest gegen ' + Z.browser.size + ' Browser-Namen (sicherer Kontext) + ' + stat.size + ' Zuweisungen an window + ' + Object.keys(EXTERN).length + ' extern (mit Grund) — 0 unbekannt' };
}

async function s3() {
  if (!Z.s2) return { ok: false, warum: 'S2 ist nicht gelaufen' };
  const { tot } = Z.s2;
  const klagen = [];
  // Gegenrichtung: eine optionale Schnittstelle, die OHNE Schutz benutzt wird, steht schon in S2 rot.
  for (const n of Object.keys(OPTIONALE_APIS)) if (!new RegExp('(?<![\\w$.])' + n + '(?![\\w$])').test(Z.code)) klagen.push('OPTIONALE_APIS nennt `' + n + '`, der Quelltext nicht mehr');
  if (tot.size) {
    const stellen = [...tot.values()].reduce((a, z) => a + z.length, 0);
    klagen.push(tot.size + ' Schutz/Schuetze vor etwas, das es nie gibt (' + stellen + ' Stellen — der Zweig dahinter laeuft nie): ' +
      [...tot.entries()].slice(0, 8).map(([n, z]) => n + ' ×' + z.length + ' (Z. ' + z.slice(0, 3).join(', ') + (z.length > 3 ? ' …' : '') + ')').join(' · '));
  }
  if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
  const opt = Z.an.unaufgeloest.filter(u => Object.prototype.hasOwnProperty.call(OPTIONALE_APIS, u.name));
  return { ok: true, info: 'kein toter Schutz · optionale Schnittstellen hinter Schutz: ' + Object.keys(OPTIONALE_APIS).join(', ') + ' (' + opt.length + ' Stellen, alle geschuetzt)' };
}

async function s4() {
  if (!Z.an || Z.an.fatal) return { ok: false, warum: 'S1 hat keinen Baum geliefert' };
  const m = Z.an.meldungen;
  if (m.length) {
    const je = {}; m.forEach(x => { je[x.regel] = (je[x.regel] || 0) + 1; });
    return { ok: false, warum: m.length + ' Treffer: ' + Object.entries(je).map(([r, n]) => r + ' ×' + n).join(', ') + ' — z.B. ' +
      m.slice(0, 4).map(x => 'Z. ' + x.zeile + ' ' + x.regel + ' („' + x.text.slice(0, 70) + '")').join(' · ') };
  }
  return { ok: true, info: Object.keys(REGELN).length + ' Regeln ueber ' + Z.code.split('\n').length + ' Zeilen — 0 Treffer' };
}

async function s5() {
  if (!Z.an || Z.an.fatal) return { ok: false, warum: 'S1 hat keinen Baum geliefert' };
  // Dieselbe Zaehlung wie robust_check C2 (ein Korpus, scripts/_korpus.js) —
  // nur wird hier abgezogen, was im EIGENEN Rumpf steht. Eine Funktion, die
  // sich per setTimeout selbst wieder ruft, hat damit keinen Aufrufer.
  const selbst = [path.join('scripts', 'robust_check.js'), path.join('scripts', path.basename(__filename))];
  const { zaehl, dateien } = nennungsKorpus(WURZEL, selbst);
  const nurSelbst = [];
  for (const f of Z.an.funktionen) {
    const gesamt = zaehl.get(f.name) || 0;
    if (gesamt <= 1) continue;                         // gar keine zweite Nennung: das meldet robust_check C2
    const rumpf = bereinigt(Z.code.slice(f.start, f.ende));
    const innen = (rumpf.match(new RegExp('(?<![\\w$])' + f.name.replace(/[$]/g, '\\$&') + '(?![\\w$])', 'g')) || []).length;
    if (gesamt - innen <= 0) nurSelbst.push(f.name + ' (Z. ' + f.zeile + '–' + f.bis + ', ' + gesamt + ' Nennungen, alle im eigenen Rumpf)');
  }
  if (nurSelbst.length) return { ok: false, warum: nurSelbst.length + ' Funktion(en) ohne Aufrufer ausser sich selbst: ' + nurSelbst.slice(0, 8).join(' · ') };
  return { ok: true, info: Z.an.funktionen.length + ' Funktionen gegen den Korpus (' + (dateien.length + 1) + ' Dateien) — keine, deren Nennungen alle im eigenen Rumpf stehen' };
}

// CSS-Variablen: benutzt gegen definiert. `var(--x, rueckfall)` mit einem
// Namen, den niemand definiert, ist eine feste Farbe mit Tarnkappe — sie kippt
// nicht mit dem Modus und faellt niemandem auf, der nach Farben sucht (v32.35).
function cssVariablen(text) {
  const defs = new Set();
  for (const m of text.matchAll(/(?:^|[;{\s"'])(--[A-Za-z0-9_-]+)\s*:/g)) defs.add(m[1]);
  for (const m of text.matchAll(/setProperty\(\s*['"](--[A-Za-z0-9_-]+)['"]/g)) defs.add(m[1]);
  const dyn = [...text.matchAll(/setProperty\(\s*['"](--[A-Za-z0-9_-]{2,})['"]\s*\+/g)].map(m => m[1]);
  const benutzt = new Map();
  let pos = 0, zeile = 1;
  for (const m of text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g)) {
    for (; pos < m.index; pos++) if (text.charCodeAt(pos) === 10) zeile++;
    if (!benutzt.has(m[1])) benutzt.set(m[1], { mit: 0, ohne: 0, z: [] });
    const u = benutzt.get(m[1]); if (m[2]) u.mit++; else u.ohne++; if (u.z.length < 4) u.z.push(zeile);
  }
  const fehlt = [...benutzt.entries()].filter(([n]) => !defs.has(n) && !dyn.some(p => n.startsWith(p)));
  return { defs, benutzt, fehlt };
}

async function s6() {
  const klagen = [];
  let gesamt = 0, definiert = 0;
  for (const seite of ['index.html', 'install.html', 'offline.html', 'privacy.html']) {
    const p = path.join(WURZEL, seite);
    if (!fs.existsSync(p)) continue;
    const r = cssVariablen(fs.readFileSync(p, 'utf8'));
    gesamt += r.benutzt.size; definiert += r.defs.size;
    if (seite === 'index.html' && r.benutzt.size < 50) klagen.push('index.html: nur ' + r.benutzt.size + ' benutzte Variablen — der Fall misst offenbar etwas anderes');
    for (const [n, u] of r.fehlt) klagen.push(seite + ': ' + n + ' benutzt (' + (u.mit + u.ohne) + '×, Z. ' + u.z.join(', ') + '), nirgends definiert' + (u.ohne ? ' — OHNE Rueckfall: die Deklaration ist ungueltig' : ' — der Rueckfall gilt in BEIDEN Modi'));
  }
  if (klagen.length) return { ok: false, warum: klagen.slice(0, 6).join(' · ') + (klagen.length > 6 ? ' · … (' + klagen.length + ')' : '') };
  return { ok: true, info: gesamt + ' benutzte CSS-Variablen in vier Seiten, jede definiert (' + definiert + ' Definitionen)' };
}

async function s7() {
  const code = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
  const an = analysiere(code, 'sw.js');
  if (an.fatal) return { ok: false, warum: 'sw.js parst nicht: ' + an.fatal };
  if (!Z.browser) return { ok: false, warum: 'S2 hat keine Browser-Namen geliefert' };
  const klagen = [];
  if (an.doppelt.length) klagen.push('doppelt deklariert: ' + an.doppelt.map(d => d.name).join(', '));
  if (an.meldungen.length) klagen.push(an.meldungen.length + ' Regeltreffer: ' + an.meldungen.slice(0, 3).map(x => 'Z. ' + x.zeile + ' ' + x.regel).join(', '));
  const verboten = an.unaufgeloest.filter(u => SW_VERBOTEN.includes(u.name) && !u.geschuetzt);
  if (verboten.length) klagen.push('im Worker gibt es das nicht: ' + [...new Set(verboten.map(u => u.name + ' Z. ' + u.zeile))].slice(0, 5).join(', '));
  const unbekannt = an.unaufgeloest.filter(u => !Z.browser.has(u.name) && !SW_EIGEN.includes(u.name) && !u.geschuetzt);
  if (unbekannt.length) klagen.push('unbekannte Namen: ' + [...new Set(unbekannt.map(u => u.name + ' Z. ' + u.zeile))].slice(0, 6).join(', '));
  if (an.funktionen.length < 5) klagen.push('nur ' + an.funktionen.length + ' Funktionen in sw.js — der Fall misst offenbar etwas anderes');
  if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
  return { ok: true, info: an.funktionen.length + ' Funktionen · ' + an.unaufgeloest.length + ' fremde Namen, alle aus dem Worker-Umfeld · 0 Regeltreffer · kein window/document/localStorage' };
}

const FAELLE = [
  { name: 'S0 · Alles parst — jedes Inline-Skript einzeln, sw.js, die Datendateien, die kleinen Seiten, jeder Prüfstand', lauf: s0 },
  { name: 'S1 · Keine Funktion ist zweimal deklariert (die spätere gewönne still, für alle Aufrufer)', lauf: s1 },
  { name: 'S2 · Kein Name wird benutzt, den es nirgends gibt — kein Lesen ohne Schutz, keine Zuweisung, die still eine Globale anlegt', lauf: s2 },
  { name: 'S3 · Kein typeof-Schutz vor etwas, das es nie gibt (der Zweig dahinter wäre tot)', lauf: s3 },
  { name: 'S4 · Die Korrektheitsregeln des Linters: null Treffer (doppelte Schlüssel, unerreichbarer Code, überschriebene Funktion …)', lauf: s4 },
  { name: 'S5 · Keine Funktion, deren einzige weitere Nennungen im eigenen Rumpf stehen (ein Selbstaufruf ist kein Aufrufer)', lauf: s5 },
  { name: 'S6 · Jede benutzte CSS-Variable ist definiert — sonst ist der Rückfall eine feste Farbe, die im Dunkelmodus nicht kippt', lauf: s6 },
  { name: 'S7 · sw.js: dieselben Regeln mit den Namen eines Service Workers — und kein window, document, localStorage', lauf: s7 },
];

(async () => {
  console.log('\n=== statik_check — was sagt ein Parser ueber den Quelltext?');
  if (!ESLINT) {
    console.log('  NICHT PRUEFBAR: ESLint nicht gefunden (GS_ESLINT, scripts/node_modules/eslint, /opt/node22/lib/node_modules/eslint).');
    console.log('  In CI kommt es aus scripts/package.json. Ohne Parser gibt es hier keine Aussage — und deshalb auch kein Gruen.');
    process.exitCode = 2;
    return;
  }
  vorbereiten();
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + (e && e.message) }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  ---');
  console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt + ' · ESLint ' + (ESLINT.Linter.version || '?') + ' (nur als Parser mit Geltungsbereichen)');
  console.log('  Grenze: gelesen wird der TEXT. Ein Name, der erst zur Laufzeit entsteht, steht mit Grund in');
  console.log('  EXTERN; ob eine Funktion das Richtige tut, sagt kein Parser — dafuer sind die anderen da.');
  process.exitCode = kaputt ? 1 : 0;
})();
