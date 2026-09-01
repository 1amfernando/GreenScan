#!/usr/bin/env node
/**
 * wiring_check.js — prueft die Verdrahtung: fuehrt jeder Knopf irgendwohin?
 *
 * Warum das existiert: alle bisherigen Pruefstaende messen, wie die App
 * AUSSIEHT. Keiner prueft, ob das Angetippte auch ankommt. Ein
 *   <button onclick="gsMachWas()">
 * ohne dazugehoerige Funktion sieht vollkommen normal aus, misst sich
 * vollkommen normal — und tut beim Antippen nichts. In der Browser-Konsole
 * steht dann "gsMachWas is not defined", aber nur, wenn jemand tippt.
 *
 * Dieser Pruefstand loest die Namen VOR dem Antippen auf:
 *   1. jedes on*-Attribut im Dokument einsammeln,
 *   2. daraus die aufgerufenen Namen ziehen,
 *   3. gegen den tatsaechlichen Bindungsbereich pruefen (window + lokal).
 *
 * Was er NICHT kann: Namen finden, die erst zur Laufzeit entstehen
 * (window[name]()), und Knoepfe, die es im Ausgangszustand nicht gibt.
 * Deshalb baut er vorher jeden der elf Tabs auf und oeffnet danach jedes
 * Modal, das sich ohne Netz oeffnen laesst.
 *
 *   node scripts/wiring_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');

const TABS = ['home','garden','wissen','favs','search','social','market','recipes','remedies','map','scanner'];

const SEED = require('./_seed.js');

// Aus einem Attributwert die aufgerufenen Namen ziehen. Bewusst grob: lieber
// ein Name zuviel (der sich dann als vorhanden erweist) als einer zuwenig.
// Erfasst  foo(...)  und  foo.bar(...)  — beim zweiten wird foo geprueft.
// Zwei Sorten Falschmeldung mussten raus, bevor die Zahl etwas wert war:
//   1. Verkettungen — bei  foo(x).then(...)  oder  el.classList.add(...)
//      begann der Ausdruck mitten drin und „then"/„classList" wurden als
//      eigene Aufrufe gelesen. Der Rueckblick auf das Zeichen davor
//      (kein . ) ] Wortzeichen Anfuehrungszeichen) schliesst das aus.
//   2. Oertliche Namen — „var e=document.getElementById(…);if(e)e.focus()"
//      steht vollstaendig IM Attribut. Solche Namen erst gar nicht melden.
const NAMEN = `(wert) => {
  const oertlich = new Set();
  const dekl = /\\b(?:var|let|const)\\s+([A-Za-z_$][\\w$]*)/g;
  let d; while ((d = dekl.exec(wert))) oertlich.add(d[1]);
  // Auch Parameter eines Pfeilausdrucks im Attribut:  (e)=>…  bzw.  e=>…
  const pf = /(?:\\(([^)]*)\\)|([A-Za-z_$][\\w$]*))\\s*=>/g;
  let f; while ((f = pf.exec(wert))) (f[1] || f[2] || '').split(',')
    .forEach(t => { const n = t.trim().split(/[\\s=]/)[0]; if (n) oertlich.add(n); });

  const raus = new Set();
  const re = /(^|[^.\\w$)\\]'\"\`])([A-Za-z_$][\\w$]*)\\s*(?:\\.\\s*[\\w$]+\\s*)*\\(/g;
  let m;
  while ((m = re.exec(wert))) { if (!oertlich.has(m[2])) raus.add(m[2]); re.lastIndex--; }
  return [...raus];
}`;

// Schluesselwoerter und eingebaute Namen, die wie Aufrufe aussehen.
const IGNORIEREN = new Set([
  'if','for','while','switch','catch','return','typeof','function','new','delete',
  'void','in','of','do','else','try','throw','case','with','yield','await','this',
  'Array','Object','String','Number','Boolean','Math','JSON','Date','RegExp','Error',
  'Promise','Map','Set','parseInt','parseFloat','isNaN','encodeURIComponent',
  'decodeURIComponent','setTimeout','setInterval','clearTimeout','alert','confirm',
  'prompt','console','document','window','localStorage','sessionStorage','navigator',
  'event','fetch','requestAnimationFrame','queueMicrotask','structuredClone',
  // CSS-Funktionen: stehen in style-Zuweisungen innerhalb der Attribute und
  // sehen von aussen wie Aufrufe aus.
  'rgb','rgba','hsl','hsla','var','calc','url','translate','translateX','translateY',
  'scale','rotate','blur','clamp','min','max','cubic',
]);

(async () => {
  const datei = process.argv[2] || path.join(__dirname, '..', 'index.html');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport:{ width:412, height:915 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message.split('\n')[0]));
  await page.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.addInitScript(SEED);
  await page.goto('file://' + path.resolve(datei), { waitUntil:'domcontentloaded', timeout:90000 });
  await page.waitForTimeout(3500);
  await page.evaluate(() => {
    try { document.documentElement.classList.remove('gs-preauth'); } catch (e) {}
    const o = document.getElementById('gs-onboarding');
    if (o) o.style.setProperty('display','none','important');
  });

  // Jeden Tab aufbauen, damit auch nachtraeglich erzeugte Knoepfe im Dokument
  // stehen. Eingesammelt wird nach JEDEM Tab, weil manche Ansichten sich
  // gegenseitig ersetzen.
  const gefunden = new Map();   // name -> {attr, wo, beispiel}
  const einsammeln = async (phase) => {
    const treffer = await page.evaluate(({ namenSrc, phase }) => {
      const zieh = eval('(' + namenSrc + ')');
      const raus = [];
      document.querySelectorAll('*').forEach(el => {
        for (const a of el.attributes) {
          if (!/^on[a-z]+$/.test(a.name)) continue;
          zieh(a.value).forEach(n => raus.push({
            name: n, attr: a.name, phase,
            wo: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
                (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : ''),
            txt: (el.textContent || '').trim().slice(0, 40),
          }));
        }
      });
      return raus;
    }, { namenSrc: NAMEN, phase });
    treffer.forEach(t => { if (!gefunden.has(t.name)) gefunden.set(t.name, t); });
  };

  await einsammeln('start');
  for (const t of TABS) {
    try { await page.evaluate(t => { if (typeof switchTab === 'function') switchTab(t); }, t); } catch (_) {}
    await page.waitForTimeout(500);
    await einsammeln(t);
  }

  // Jetzt aufloesen — im Seitenkontext, damit auch Funktionen zaehlen, die
  // nicht an window haengen, aber im Bindungsbereich des Inline-Skripts
  // stehen. Genau so loest der Browser einen on*-Aufruf auf.
  const namen = [...gefunden.keys()].filter(n => !IGNORIEREN.has(n));
  const stand = await page.evaluate(namen => namen.map(n => {
    let art = 'FEHLT';
    try {
      // Wie ein on*-Attribut: erst der Bindungsbereich, dann window.
      const w = eval('typeof ' + n);
      art = (w === 'undefined') ? 'FEHLT' : w;
    } catch (e) { art = 'FEHLT'; }
    return { n, art };
  }), namen);

  const kaputt = stand.filter(s => s.art === 'FEHLT');
  const keineFunktion = stand.filter(s => s.art !== 'FEHLT' && s.art !== 'function');

  console.log('=== ' + path.basename(datei));
  console.log('  on*-Aufrufe gepruefte Namen:', namen.length);
  console.log('  JS-Fehler beim Aufbau:', fehler.length ? [...new Set(fehler)].slice(0,4).join(' | ') : 'keine');
  console.log('  NICHT AUFLOESBAR:', kaputt.length);
  kaputt.forEach(k => {
    const g = gefunden.get(k.n);
    console.log('    ' + k.n + '()  ← ' + g.attr + ' an ' + g.wo + (g.txt ? '  „' + g.txt + '"' : '') + '  [' + g.phase + ']');
  });
  if (keineFunktion.length) {
    console.log('  vorhanden, aber keine Funktion:', keineFunktion.map(k => k.n + ':' + k.art).join(' '));
  }

  // ── Zweite Richtung: Nachschlagungen ins Leere ────────────────────────
  //
  // Der teurere Fehler geht andersherum. Ein Knopf, dessen Funktion fehlt,
  // meldet sich wenigstens in der Konsole. Eine Funktion, die ein Element
  // sucht, das es nicht mehr gibt, ist still — und wenn der Zugriff
  // UNGESICHERT ist, bricht ab dieser Zeile alles Weitere ab.
  //
  // Genau so lag v31.40 im Argen: showLuxResult griff auf lux-val zu, die id
  // hiess laengst lux-value. Erste Zeile TypeError, danach lief nichts mehr —
  // der Lichtmesser zeigte nie ein Ergebnis und der Knopf blieb haengen.
  // Gefunden wurde das beim Durchsehen. Hier ist es messbar.
  //
  // Geprueft wird am Quelltext, nicht am Dokument: die meisten ids entstehen
  // erst beim Rendern, ein laufender Abgleich haette lauter Falschmeldungen.
  const quelle = require('fs').readFileSync(path.resolve(datei), 'utf8');

  // Kommentare zaehlen nicht — und das ist genau die Stelle, an der ein
  // Pruefstand still falsch wird.
  //
  // Erster Anlauf: „steht ein /* naeher als das letzte */?" Damit meldete er
  // Zeile 30038 nicht mehr (richtig — dort steht getElementById('lux-val') im
  // Kommentar, der beschreibt, warum die Zeile in v31.40 entfernt wurde),
  // aber auch die elf echten Funde des Raumscans nicht mehr (falsch).
  // Ursache: Zeile 29648 enthaelt  accept="image/*"  — das /* steht IN einer
  // Zeichenkette und schliesst nie. Ab dort galt der Rest der Datei als
  // Kommentar. Eine Pruefung, die zu wenig meldet, ist schlimmer als eine,
  // die zu viel meldet: das Zuviel faellt auf.
  //
  // Also einmal durchgehen und dabei Zeichenketten mitfuehren.
  const maske = (() => {
    const m = new Uint8Array(quelle.length);
    let z = 0;   // 0 Code · 1 ' · 2 " · 3 ` · 4 // · 5 /*
    for (let i = 0; i < quelle.length; i++) {
      const c = quelle[i], n = quelle[i+1];
      if (z === 0) {
        if (c === '/' && n === '/') { z = 4; m[i] = m[i+1] = 1; i++; }
        else if (c === '/' && n === '*') { z = 5; m[i] = m[i+1] = 1; i++; }
        else if (c === "'") z = 1; else if (c === '"') z = 2; else if (c === '`') z = 3;
      } else if (z === 4) { m[i] = 1; if (c === '\n') z = 0; }
      else if (z === 5) { m[i] = 1; if (c === '*' && n === '/') { m[i+1] = 1; i++; z = 0; } }
      else {
        if (c === '\\') { i++; continue; }
        if ((z === 1 && c === "'") || (z === 2 && c === '"') || (z === 3 && c === '`')) z = 0;
        // Eine nicht abgeschlossene Zeichenkette am Zeilenende ist in dieser
        // Datei immer ein Regexp-Zeichen oder ein Apostroph im Text („Bloom's").
        // Dann lieber zurueck auf Code als den Rest der Datei verschlucken.
        else if (c === '\n' && z !== 3) z = 0;
      }
    }
    return m;
  })();
  const imKommentar = (i) => maske[i] === 1;

  const erzeugt = new Set();
  [/\bid\s*=\s*(?:\\?["'])([A-Za-z0-9_\-:.]+)(?:\\?["'])/g,
   /\.id\s*=\s*['"]([A-Za-z0-9_\-:.]+)['"]/g,
   /setAttribute\(\s*['"]id['"]\s*,\s*['"]([A-Za-z0-9_\-:.]+)['"]/g,
   // Ueber den Umweg einer Variablen:  var bodyId = 'gs-community-body';
   //   … '<div id="' + bodyId + '"></div>' …
   // Der erste Lauf meldete gs-community-body dreimal als „nie erzeugt" —
   // es steht aber sehr wohl im Dokument, nur nicht als Literal am id=.
   // Auf Namen beschraenkt, die auf „id" enden: sonst gilt jede
   // Zeichenkette im Programm als moegliche id und die Pruefung meldet nichts mehr.
   /(?:var|let|const)\s+\w*[iI]d\s*=\s*['"]([A-Za-z0-9_\-:.]+)['"]/g,
  ].forEach(re => { let m; while ((m = re.exec(quelle))) erzeugt.add(m[1]); });

  const nachschlag = new Map();
  [/getElementById\(\s*['"]([A-Za-z0-9_\-:.]+)['"]\s*\)/g,
   /querySelector(?:All)?\(\s*['"]#([A-Za-z0-9_\-:.]+)['"]/g,
  ].forEach(re => { let m; while ((m = re.exec(quelle))) {
    if (imKommentar(m.index)) continue;
    if (!nachschlag.has(m[1])) nachschlag.set(m[1], []);
    nachschlag.get(m[1]).push(m.index);
  }});

  const nirgends = [...nachschlag.entries()].filter(([id]) => !erzeugt.has(id));

  // Ungesichert heisst: das Ergebnis wird sofort entwertet — .textContent,
  // .style, .value — ohne if davor und ohne ?. dazwischen. Nur diese Sorte
  // reisst den Rest der Funktion mit.
  const ungesichert = [];
  const reU = /document\.getElementById\(\s*['"]([A-Za-z0-9_\-:.]+)['"]\s*\)\s*(\.[\w$]+)/g;
  let u;
  while ((u = reU.exec(quelle))) {
    if (erzeugt.has(u[1]) || imKommentar(u.index)) continue;
    ungesichert.push({ id: u[1], nach: u[2], zeile: quelle.slice(0, u.index).split('\n').length });
  }

  console.log('  ---');
  console.log('  Element-Nachschlagungen:', nachschlag.size, '· davon nie erzeugt:', nirgends.length);
  console.log('  davon UNGESICHERT entwertet:', ungesichert.length);
  ungesichert.forEach(x => console.log('    Zeile ' + x.zeile + ':  getElementById(\'' + x.id + '\')' + x.nach + '  → wirft'));
  if (nirgends.length) {
    console.log('  abgesichert (still, aber folgenlos): ' +
      nirgends.filter(([id]) => !ungesichert.some(x => x.id === id))
              .map(([id, v]) => id + (v.length > 1 ? '×' + v.length : '')).join(' '));
  }

  await browser.close();
  process.exit((kaputt.length + ungesichert.length) ? 1 : 0);
})();
