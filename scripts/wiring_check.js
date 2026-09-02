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

  // ── Das Hauptmenue: Aktionen, die in keinem on*-Attribut stehen ──────
  //
  // MENU_ITEMS ist eine Liste von 40 Eintraegen mit je einem action-Text.
  // Der laeuft wie ein onclick, steht aber in einem Array — Richtung 1 sieht
  // ihn also nicht. Beim ersten Lauf waren drei davon kaputt: sie sprangen auf
  // einen Bildschirm und tippten dann auf ein Element, das es nicht gibt.
  // Der Nutzer sucht im Menue, tippt den Treffer an und landet irgendwo, wo
  // nichts passiert — ohne Fehlermeldung.
  const menue = await page.evaluate(({ namenSrc, egalListe }) => {
    if (typeof MENU_ITEMS === 'undefined') return null;
    const zieh = eval('(' + namenSrc + ')');
    const egal = new Set(egalListe);
    const raus = [];
    MENU_ITEMS.forEach(it => {
      const a = it.action || '';
      const fehltFn = [];
      zieh(a).forEach(n => {
        if (egal.has(n)) return;
        let t = 'undefined';
        try { t = eval('typeof ' + n); } catch (e) {}
        if (t !== 'function') fehltFn.push(n);
      });
      const fehltId = [];
      const rid = /getElementById\(\s*['"]([A-Za-z0-9_\-:.]+)['"]/g;
      let g; while ((g = rid.exec(a))) if (!document.getElementById(g[1])) fehltId.push(g[1]);
      if (fehltFn.length || fehltId.length) raus.push({ label: it.label, fehltFn, fehltId });
    });
    return { gesamt: MENU_ITEMS.length, kaputt: raus };
  }, { namenSrc: NAMEN, egalListe: [...IGNORIEREN] });

  if (menue) {
    console.log('  ---');
    console.log('  Hauptmenue-Eintraege:', menue.gesamt, '· davon kaputt:', menue.kaputt.length);
    menue.kaputt.forEach(x => console.log('    ' + x.label +
      (x.fehltFn.length ? '   Funktion fehlt: ' + x.fehltFn.join(', ') : '') +
      (x.fehltId.length ? '   Element fehlt: #' + x.fehltId.join(' #') : '')));
  }

  // ── Dritte Liste: wohin fuehren Benachrichtigungen? ───────────────────
  //
  // Wie MENU_ITEMS eine Datenstruktur, die kein Blick aufs Dokument findet:
  // GS_NOTIF_ZIELE bildet die Art einer Mitteilung auf eine Zielfunktion
  // oder einen Tab ab. Bis v31.81 deckte der Router sieben Arten ab; alles
  // andere ohne Link landete bei `closeMainMenu();` — ein Tipp, der nur das
  // Fenster schloss. Genau das hat Fernando gemeldet.
  //
  // Hier wird jede eingetragene Art durchgefahren: loest die Zielfunktion
  // auf? Gibt es den Tab? Eine Zeile, die ins Leere zeigt, ist ein Fund.
  const notif = await page.evaluate(() => {
    if (typeof GS_NOTIF_ZIELE !== 'object' || !GS_NOTIF_ZIELE) return null;
    const tabs = ['home','garden','wissen','favs','search','social','market','recipes','remedies','map','scanner'];
    const kaputt = [];
    Object.keys(GS_NOTIF_ZIELE).forEach(k => {
      const z = GS_NOTIF_ZIELE[k];
      const a = (typeof _gsNotifZiel === 'function') ? _gsNotifZiel(k) : null;
      if (!a) { kaputt.push({ kind: k, grund: 'kein Ziel' }); return; }
      if (z.fn && typeof window[z.fn] !== 'function') kaputt.push({ kind: k, grund: 'Funktion fehlt: ' + z.fn });
      if (z.tab && tabs.indexOf(z.tab) < 0)          kaputt.push({ kind: k, grund: 'Tab gibt es nicht: ' + z.tab });
    });
    return { gesamt: Object.keys(GS_NOTIF_ZIELE).length, kaputt };
  });

  if (notif) {
    console.log('  ---');
    console.log('  Benachrichtigungs-Ziele:', notif.gesamt, '· davon kaputt:', notif.kaputt.length);
    notif.kaputt.forEach(x => console.log('    ' + x.kind + '   ' + x.grund));
  } else {
    console.log('  ---');
    console.log('  Benachrichtigungs-Ziele: GS_NOTIF_ZIELE nicht gefunden (Pruefung uebersprungen)');
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

  // Eine Nachschlagung, auf die unmittelbar ein  ||  folgt, ist KEIN Fund: sie
  // ist das erste Glied einer Rueckfallkette, und der Autor hat den Fall, dass
  // sie leer ausgeht, bereits bedacht. Zwei Beispiele aus dieser Datei:
  //   getElementById('camera-wrapper') || video.parentElement || document.body
  //   getElementById('kb-loading-biblio') || getElementById('kb-loading')
  //     || getElementById('bibliothek-loading') || querySelector('.kb-loading')
  // Der Pruefstand meldete davon drei Stueck. Das ist Falschalarm an
  // vorbildlichem Code — und Falschalarme sind das Einzige, was einen
  // Pruefstand zuverlaessig unbrauchbar macht. Das LETZTE Glied einer Kette
  // wird weiterhin geprueft: wenn auch das ins Leere geht, faellt die Kette
  // als Ganzes um.
  const folgtRueckfall = (endeIndex) => {
    const rest = quelle.slice(endeIndex, endeIndex + 40);
    return /^\s*\|\|/.test(rest);
  };

  const nachschlag = new Map();
  [/getElementById\(\s*['"]([A-Za-z0-9_\-:.]+)['"]\s*\)/g,
   /querySelector(?:All)?\(\s*['"]#([A-Za-z0-9_\-:.]+)['"]/g,
  ].forEach(re => { let m; while ((m = re.exec(quelle))) {
    if (imKommentar(m.index)) continue;
    if (folgtRueckfall(m.index + m[0].length)) continue;
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

  // ── v31.98, Richtung 3: geht das Fenster ueberhaupt auf? ──────────────
  //
  // Der teuerste Fund dieser Woche (v31.95): VIER Bildschirme liessen sich
  // gar nicht oeffnen — „Bestaetigte Scans", der Supabase-Schluessel, das
  // Admin-Panel und der Experten-Antrag. Alle vier warfen an derselben
  // Zeile, und zwar VOR `openModal`. Keine Fehlermeldung, kein leeres
  // Fenster: es passierte nichts.
  //
  // Und genau deshalb meldet das niemand. Ein Fenster, das nicht aufgeht,
  // sieht aus wie ein Fingerfehler — man tippt nochmal, wieder nichts, man
  // macht etwas anderes. Hinter dem Experten-Antrag lag dadurch ein zweiter
  // Fehler jahrelang unbemerkt.
  //
  // Also: jeden Oeffner ohne Parameter WIRKLICH aufrufen und nachsehen, ob
  // danach ein Fenster sichtbar ist. Aufgerufen wird nur, was der Konvention
  // nach oeffnet (`open…` / `gsOpen…` / `show…`) und keine Argumente
  // braucht — geraten wird nichts.
  const oeffnerNamen = await page.evaluate((quelleTxt) => {
    const out = [];
    // v32.20: `…Oeffnen` gehoert dazu. Dieses Repo benennt auf Deutsch
    // (`gsKorrekturOeffnen` seit v32.05, `gsEingrenzenOeffnen` seit v32.20) —
    // und beide fielen durch dieses Muster, weil es nur die englischen
    // Praefixe kannte. Zwei Fenster, die niemand geprueft hat, ohne dass
    // irgendetwas rot war. Ein Pruefstand, der nach NAMEN sucht, uebersieht
    // genau das, was anders heisst.
    const re = /(?:async\s+)?function\s+((?:gsOpen|open|show|gsShow)[A-Za-z0-9_]*|gs[A-Za-z0-9_]*Oeffnen)\s*\(\s*\)\s*\{/g;
    let m;
    while ((m = re.exec(quelleTxt))) {
      let d = 0, i = re.lastIndex - 1, ende = -1;
      while (i < quelleTxt.length && i < re.lastIndex + 40000) {
        const c = quelleTxt[i];
        if (c === '{') d++;
        else if (c === '}') { d--; if (d === 0) { ende = i; break; } }
        i++;
      }
      if (ende > 0 && quelleTxt.slice(re.lastIndex, ende).indexOf('openModal(') >= 0) out.push(m[1]);
    }
    return [...new Set(out)].sort();
  }, quelle);

  const oeffner = [];
  for (const name of oeffnerNamen) {
    const r = await page.evaluate(async (fn) => {
      // Vorher alles schliessen, damit ein offenes Fenster nicht als Erfolg
      // des naechsten durchgeht.
      document.querySelectorAll('.modal-overlay, .overlay-modal').forEach(el => {
        el.classList.remove('open'); el.style.display = 'none';
      });
      const f = window[fn];
      if (typeof f !== 'function') return { name: fn, warum: 'Funktion fehlt' };
      // Sperren ERFUELLEN, nicht umgehen: ein Oeffner, der ohne Anmeldung
      // absichtlich abbricht („Bitte zuerst anmelden"), ist richtig — und
      // waere ohne das hier als Fehler gemeldet worden. Geprueft wird, ob
      // das Fenster aufgeht, wenn es DARF.
      window.sbIsLoggedIn = () => true;
      window.gsIsAdmin = () => true;
      window.gsIsStaff = () => true;
      window.gsRequire = () => true;
      window._sbProfile = window._sbProfile || { id: 'u1', email: 'p@r.ch', role: 'admin' };
      // Ein Oeffner darf auch mit erfuellten Sperren bewusst ablehnen —
      // `gsOpenExpertApplication` etwa sagt Admins „bist du schon". Solche
      // Faelle sagen es dem Nutzer mit einer Meldung. Wer NICHTS sagt und
      // NICHTS oeffnet, ist kaputt; das ist die Unterscheidung, die zaehlt.
      let gesagt = null;
      const echt = { toast: window.showProfileToast, gs: window.gsToast };
      window.showProfileToast = m => { gesagt = typeof m === 'string' ? m : ((m && (m.title || m.body)) || 'Meldung'); };
      window.gsToast = m => { gesagt = String(m || 'Meldung'); };
      let fehler = null;
      try { const p = f(); if (p && typeof p.then === 'function') await p; }
      catch (e) { fehler = (e && e.message) || String(e); }
      // Kurz warten: manche Oeffner rendern im naechsten Frame.
      await new Promise(r => setTimeout(r, 60));
      window.showProfileToast = echt.toast; window.gsToast = echt.gs;
      const offen = [...document.querySelectorAll('.modal-overlay, .overlay-modal')]
        .filter(el => el.classList.contains('open') || el.style.display === 'flex');
      const mitInhalt = offen.filter(el => (el.textContent || '').trim().length > 12);
      if (fehler) return { name: fn, warum: 'wirft: ' + fehler };
      if (!offen.length && gesagt) return { name: fn, ok: true, abgelehnt: gesagt };
      if (!offen.length) return { name: fn, warum: 'kein Fenster, keine Meldung — es passiert nichts' };
      if (!mitInhalt.length) return { name: fn, warum: 'Fenster ist offen, aber leer' };
      return { name: fn, ok: true, id: mitInhalt[0].id || '(ohne id)' };
    }, name);
    oeffner.push(r);
  }
  const oeffnerKaputt = oeffner.filter(o => !o.ok);

  // ── v31.95, Richtung 2b: Klassen-Ketten, die sofort entwertet werden ──
  //
  // `getElementById` oben deckt ids ab. Nicht abgedeckt war die Form
  //   document.getElementById('x').querySelector('.y').textContent = …
  // und genau daran hingen VIER Bildschirme: `.modal-title` gibt es in
  // `#modal-recipe-detail` nicht, also warf die Zeile jedes Mal — und zwar
  // VOR `openModal`. „Bestaetigte Scans", „Supabase API-Key", das
  // ADMIN-PANEL und der Experten-Antrag liessen sich dadurch gar nicht
  // oeffnen. Keine Fehlermeldung, kein leeres Fenster: es passierte nichts.
  //
  // Gemeldet wird nur, was WIRKLICH wirft: eine Klasse, die in keinem
  // `class="…"` und in keinem `classList.add` / `className` vorkommt, und
  // deren Ergebnis sofort dereferenziert wird.
  const klassenDa = new Set();
  [/class\s*=\s*["']([^"']+)["']/g,
   /classList\.(?:add|toggle|remove)\(\s*['"]([A-Za-z0-9_\- ]+)['"]/g,
   /className\s*=\s*['"]([A-Za-z0-9_\- ]+)['"]/g,
  ].forEach(re => { let m; while ((m = re.exec(quelle))) m[1].split(/\s+/).forEach(c => c && klassenDa.add(c)); });

  const klassenKette = [];
  const reK = /\.querySelector\(\s*['"]\.([A-Za-z0-9_\-]+)['"]\s*\)\s*(\.[\w$]+)\s*[=.(]/g;
  let k;
  while ((k = reK.exec(quelle))) {
    if (imKommentar(k.index)) continue;
    if (klassenDa.has(k[1])) continue;
    klassenKette.push({ cls: k[1], nach: k[2], zeile: quelle.slice(0, k.index).split('\n').length });
  }

  console.log('  ---');
  const abgelehnt = oeffner.filter(o => o.ok && o.abgelehnt);
  console.log('  Fenster-Oeffner aufgerufen:', oeffner.length,
              '· gehen auf:', oeffner.filter(o => o.ok && !o.abgelehnt).length,
              '· lehnen mit Meldung ab:', abgelehnt.length,
              '· KAPUTT:', oeffnerKaputt.length);
  oeffnerKaputt.forEach(o => console.log('    !! ' + o.name + '()  →  ' + o.warum));
  abgelehnt.forEach(o => console.log('    –  ' + o.name + '()  sagt: ' + o.abgelehnt));

  console.log('  ---');
  console.log('  Element-Nachschlagungen:', nachschlag.size, '· davon nie erzeugt:', nirgends.length);
  console.log('  Klassen-Ketten ohne Element (werfen sofort):', klassenKette.length);
  klassenKette.forEach(x => console.log('    Zeile ' + x.zeile + ':  querySelector(\'.' + x.cls + '\')' + x.nach + '  → wirft'));
  console.log('  davon UNGESICHERT entwertet:', ungesichert.length);
  ungesichert.forEach(x => console.log('    Zeile ' + x.zeile + ':  getElementById(\'' + x.id + '\')' + x.nach + '  → wirft'));
  if (nirgends.length) {
    console.log('  abgesichert (still, aber folgenlos): ' +
      nirgends.filter(([id]) => !ungesichert.some(x => x.id === id))
              .map(([id, v]) => id + (v.length > 1 ? '×' + v.length : '')).join(' '));
  }

  await browser.close();
  process.exit((kaputt.length + ungesichert.length + klassenKette.length + oeffnerKaputt.length + (menue ? menue.kaputt.length : 0)) ? 1 : 0);
})();
