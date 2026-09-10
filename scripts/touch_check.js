#!/usr/bin/env node
/**
 * touch_check.js — misst jede Antippflaeche in der App und meldet, was unter
 * 24x24 CSS-px liegt (WCAG 2.5.8, Stufe AA).
 *
 * Zwei Dinge, die er bewusst NICHT meldet:
 *   - Container, die selbst weitere bedienbare Elemente enthalten. Die
 *     eigentliche Flaeche ist dann das Kind; sonst zaehlt man doppelt.
 *   - Unsichtbares (display:none, visibility:hidden, pointer-events:none).
 *
 * Achtung beim Auswerten: gemessen wird getBoundingClientRect(), also die
 * TRANSFORMIERTE Huelle. Bei etwas Rotierendem ist der Wert nicht stabil —
 * siehe den Hinweis in render_check.js.
 *
 *   node scripts/touch_check.js
 */
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const TABS=['home','garden','wissen','favs','search','social','market','recipes','remedies','map','scanner'];
const D=86400000, now=1756684800000;
const SEED=()=>{try{const set=(k,v)=>localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
  set('gs_sb_token','pruefstand'); set('gs_sb_expires',String(now+30*D));
  set('gs_sb_display_name','Testnutzerin'); set('gs_lang','de');
  set('myPlants',[{id:'p1',name:'Basilikum',emoji:'🌿',added:now-20*D,lastWatered:now-4*D,waterEvery:3}]);
}catch(e){}};
// WCAG 2.5.8 (AA) verlangt 24x24 CSS-px, Apple/Google empfehlen 44 bzw. 48.
// v33.09: SCAN nimmt eine WURZEL entgegen. Ohne Argument misst er das ganze
// Dokument (die elf Bildschirme, wie bisher); mit einem Selektor nur das, was
// IN einem geoeffneten Fenster steht. EINE Regel fuer beides — ein zweiter
// Scanner fuer Fenster waere die Falle aus v32.16 (Reparatur und Pruefung
// brauchen dieselbe Regel), diesmal zwischen zwei Pruefungen.
const SCAN=(wurzelSel)=>{
  const wurzel = wurzelSel ? document.querySelector(wurzelSel) : document;
  if (!wurzel) return { funde: [], konform: 0, ziele: 0 };
  const out=[]; const klein=[]; const alle=[];
  wurzel.querySelectorAll('button,a[href],[onclick],[role="button"],input,select,summary').forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||cs.pointerEvents==='none')return;
    const r=el.getBoundingClientRect();
    if(r.width<1||r.height<1)return;
    // Elemente, die andere bedienbare Elemente enthalten, sind Container — die
    // eigentliche Flaeche ist das Kind. Nicht doppelt zaehlen.
    if(el.querySelector('button,a[href],[onclick],[role="button"],input,select')) return;
    // v32.16 — und die Umkehrung. WCAG 2.5.8 meint die Flaeche, die den
    // Zeiger ANNIMMT. Liegt dieses Element vollstaendig in einem groesseren
    // Bedienelement, das denselben Klick behandelt, ist NICHT dieses hier das
    // Ziel, sondern der Kasten darum.
    //
    // Anlass war v32.16: die Tastatur-Nachruestung macht bei Karten mit
    // eigenen Knoepfen die UEBERSCHRIFT fokussierbar (`role="button"`), damit
    // kein Knopf im Knopf entsteht. Angetippt wird weiterhin die ganze Karte.
    // Ohne diese Zeile meldete der Pruefstand 79 Rezept- und Heilmittel-Titel
    // als „352x18, zu klein" — ein Ziel, das niemand antippt, weil der Finger
    // die Karte trifft.
    //
    // Die Bedingung ist ZWEIFACH eng, und der zweite Teil hat mich einen
    // Anlauf gekostet: der Vorfahr muss den Klick wirklich behandeln UND
    // gross genug sein — und das Element selbst darf KEINE eigene Handlung
    // haben. Ein echter kleiner Knopf in einer Karte (das Herz zum Merken)
    // ist sehr wohl ein eigenes Ziel: der Finger trifft ihn, nicht die
    // Karte. Nur ein reiner Tastatur-Stellvertreter — `role`/`tabindex` ohne
    // eigenes `onclick` — ist keins.
    //
    // Gegenprobe gemacht: 10x10-Knopf frei im Fluss → gemeldet. Derselbe
    // Knopf in einer 300x80-Karte → ebenfalls gemeldet. Ein Titel-Div mit
    // `role="button"` in derselben Karte → still. Genau so soll es sein.
    const eigeneHandlung = el.hasAttribute('onclick') || el.tagName==='BUTTON'
      || (el.tagName==='A' && el.hasAttribute('href'))
      || el.tagName==='INPUT' || el.tagName==='SELECT' || el.tagName==='SUMMARY';
    if(!eigeneHandlung)
    for(let a=el.parentElement; a && a!==document.body; a=a.parentElement){
      const traegt = a.hasAttribute('onclick') || a.getAttribute('role')==='button'
                     || a.tagName==='BUTTON' || (a.tagName==='A' && a.hasAttribute('href'));
      if(!traegt) continue;
      const ar=a.getBoundingClientRect();
      if(Math.min(Math.round(ar.width),Math.round(ar.height))>=24
         && ar.top<=r.top+1 && ar.left<=r.left+1
         && ar.bottom>=r.bottom-1 && ar.right>=r.right-1) return;
      break;
    }
    const w=Math.round(r.width), h=Math.round(r.height);
    const min=Math.min(w,h);
    alle.push({el,r});
    if(min>=24)return;
    const txt=(el.textContent||'').trim().slice(0,20);
    klein.push({el,r,w,h,min,txt,
      el2:el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:''),
      label: el.getAttribute('aria-label')||''});
  });

  // ── v33.09 · Die AUSNAHME, die WCAG 2.5.8 ausdruecklich vorsieht ────────
  //
  // „Spacing": ein Kreis mit 24 px DURCHMESSER (Radius 12), zentriert auf der
  // Umrandung des zu kleinen Ziels, darf die Umrandung keines anderen Ziels
  // schneiden und den Kreis keines anderen zu kleinen Ziels. Ist genug Luft
  // da, ist das kleine Ziel KONFORM.
  //
  // Warum das hier steht: ohne die Ausnahme meldet der Durchgang durch die
  // 43 Fenster **47** Treffer, die alle konform sind — Kaestchen und
  // Auswahlfelder in ihrer Standardgroesse mit reichlich Luft darum. Ein
  // Bericht mit siebenundvierzig richtigen Zeilen, die keine Fehler sind,
  // ist der Bericht, den man zu ignorieren lernt (v32.21).
  //
  // Und ein Wort zur GEOMETRIE, weil ich sie zuerst falsch hatte: fuer ein
  // GROSSES Nachbarziel zaehlt sein RECHTECK, nicht ein Kreis. Mit Kreisen
  // gerechnet kam 0 heraus, mit der Umrandung 1 — die nachgiebige Rechnung
  // haette einen echten Fund verborgen.
  const mitte = (r) => ({ x: r.left + r.width/2, y: r.top + r.height/2 });
  const schneidet = (cx, cy, rad, r) => {
    const nx = Math.max(r.left, Math.min(cx, r.right));
    const ny = Math.max(r.top,  Math.min(cy, r.bottom));
    const dx = cx - nx, dy = cy - ny;
    return (dx*dx + dy*dy) < rad*rad;
  };
  const kleinSet = new Set(klein.map(k => k.el));
  let konform = 0;
  klein.forEach(k => {
    const a = mitte(k.r);
    let eng = false;
    for (const o of alle) {
      if (o.el === k.el || eng) continue;
      if (kleinSet.has(o.el)) {
        const b = mitte(o.r), dx = a.x - b.x, dy = a.y - b.y;
        if (Math.sqrt(dx*dx + dy*dy) < 24) eng = true;
      } else if (schneidet(a.x, a.y, 12, o.r)) eng = true;
    }
    if (!eng) { konform++; return; }
    out.push({ w:k.w, h:k.h, min:k.min, txt:k.txt, el:k.el2, label:k.label });
  });
  return { funde: out, konform: konform, ziele: alle.length };
};
// ── v32.07: Bedienelemente, die seitlich aus dem Bild ragen ──────────────
//
// Ein Knopf, dessen halbe Antippflaeche ausserhalb des Bildschirms liegt, ist
// so unerreichbar wie einer, der 8x8 gross ist — dieselbe Frage, andere
// Ursache. Gefunden wurde damit „↻ Zuruecksetzen" im Marktplatz: eine
// Flex-Zeile ohne Umbruch schob ihn auf 412 px bis 450 px hinaus, 38 px
// draussen, die Beschriftung abgeschnitten. Die SEITE scrollt dabei nicht —
// es sieht also nach nichts aus.
//
// **Gemeldet wird nur, was im normalen Fluss liegt.** Dekorative Elemente mit
// `position:absolute` (die grossen Emoji-Wasserzeichen hinter den Ueberschriften
// von Wissen, Rezepte, Heilmittel und Community) ragen ABSICHTLICH hinaus und
// werden vom Rand beschnitten — genau die Sorte Falschmeldung, vor der
// CLAUDE.md §7.1 warnt. Sie sind hier ausgenommen, und zwar nach einer Regel,
// nicht nach einer Liste.
const AUSSERHALB = (wurzelSel) => {
  const wurzel = wurzelSel ? document.querySelector(wurzelSel) : document;
  if (!wurzel) return [];
  const W = document.documentElement.clientWidth, out = [];
  wurzel.querySelectorAll('button,a[href],[onclick],[role="button"],input,select,textarea').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !el.getClientRects().length) return;
    if (cs.position === 'absolute' || cs.position === 'fixed') return;   // Zierde, siehe oben
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const fehlt = Math.round(Math.max(r.right - W, 0 - r.left));
    if (fehlt <= 1) return;
    // Ein waagrecht scrollender Vorfahre ist Absicht (Chip-Leisten).
    let sc = el.parentElement;
    while (sc && sc !== document.body) {
      if (/(auto|scroll)/.test(getComputedStyle(sc).overflowX)) return;
      sc = sc.parentElement;
    }
    out.push({ fehlt, txt: (el.textContent || '').trim().slice(0, 24),
      el: el.tagName + (el.id ? '#' + el.id : '') +
          (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/)[0] : '') });
  });
  return out;
};

// v32.25: ZWEI Breiten. Bis v32.24 mass dieser Pruefstand nur 412 px — die
// Breite eines heutigen Mittelklasse-Telefons. 320 px (iPhone SE, aeltere
// Android-Geraete) ist die schmalste Breite, die real vorkommt, und dort
// wird jede zu enge Zeile zuerst eng. Eine Antippflaeche, die bei 412 passt
// und bei 320 aus dem Bild laeuft, faellt sonst niemandem auf.
// Gemeldet wird MIT Breite, sonst weiss der Leser nicht, wo er nachsehen muss.
const BREITEN = [412, 320];

(async()=>{
  const br=await chromium.launch();
  const seen=new Map(); const raus=new Map();
  let konformGesamt = 0, fensterGemessen = 0, fensterLeer = 0;
  const MODAL_OEFFNER = (() => {
    const quelleTxt = require('fs').readFileSync(require('path').join(__dirname,'..','index.html'),'utf8');
    const out = [];
    const re = /(?:async\s+)?function\s+((?:gsOpen|open|show|gsShow)[A-Za-z0-9_]*|gs[A-Za-z0-9_]*Oeffnen)\s*\(\s*\)\s*\{/g;
    let m;
    while ((m = re.exec(quelleTxt))) {
      let d = 0, i = re.lastIndex - 1, ende = -1;
      while (i < quelleTxt.length && i < re.lastIndex + 40000) {
        const c = quelleTxt[i];
        if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { ende = i; break; } }
        i++;
      }
      if (ende > 0 && quelleTxt.slice(re.lastIndex, ende).indexOf('openModal(') >= 0) out.push(m[1]);
    }
    return [...new Set(out)].sort();
  })();
  // Der Oeffner laeuft im Seitenkontext und liefert einen SELEKTOR auf das
  // geoeffnete Fenster zurueck — Sperren werden ERFUELLT, nicht umgangen.
  const OEFFNE = (nm) => {
    document.querySelectorAll('.modal-overlay, .overlay-modal').forEach(el => {
      el.classList.remove('open'); el.style.display = 'none';
    });
    window.sbIsLoggedIn = () => true; window.gsIsAdmin = () => true;
    window.gsIsStaff = () => true; window.gsRequire = () => true;
    window._sbProfile = window._sbProfile || { id:'u1', email:'p@r.ch', role:'admin' };
    const f = window[nm];
    if (typeof f !== 'function') return null;
    try { f(); } catch(_) { return null; }
    const offen = [...document.querySelectorAll('.modal-overlay, .overlay-modal')]
      .filter(el => el.classList.contains('open') || el.style.display === 'flex')
      .filter(el => (el.textContent||'').trim().length > 12);
    if (!offen.length) return null;
    const el = offen[0];
    if (!el.id) el.id = 'gs-touch-probe';
    return '#' + el.id;
  };
  for (const BR of BREITEN) {
  const ctx=await br.newContext({viewport:{width:BR,height:915}}); const p=await ctx.newPage();
  await p.route('**',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + require('path').join(__dirname,'..','index.html'),{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForTimeout(3500);
  await p.evaluate(()=>{document.documentElement.classList.remove('gs-preauth');
    const o=document.getElementById('gs-onboarding');if(o)o.style.setProperty('display','none','important');});
  for(const t of TABS){ try{await p.evaluate(t=>switchTab(t),t)}catch(e){}
    await p.waitForTimeout(600);
    const rT = await p.evaluate(SCAN);
    konformGesamt += rT.konform;
    rT.funde.forEach(o=>{const k=BR+'|'+o.el+'|'+o.txt; if(!seen.has(k))seen.set(k,{...o,tab:t,br:BR});});
    (await p.evaluate(AUSSERHALB)).forEach(o=>{const k=BR+'|'+o.el+'|'+o.txt; if(!raus.has(k))raus.set(k,{...o,tab:t,br:BR});}); }

  // ── v33.09 · Und jetzt die FENSTER ─────────────────────────────────────
  //
  // Bis hierher mass dieser Pruefstand nur die elf Bildschirme, und CLAUDE.md
  // sagte dazu: „wer Farbe in einem Modal setzt, das der Pruefstand nicht
  // oeffnet, rechnet selbst nach". `contrast_check` hat in v32.25 dieselbe
  // Ansage gehabt — und festgestellt: niemand rechnet selbst nach. Dort
  // wurden daraufhin 44 bzw. 56 nie gemessene Stellen gefunden.
  //
  // Dieselbe Entdeckung, derselbe Oeffner-Text: jeder Oeffner ohne Parameter,
  // dessen Rumpf `openModal(` enthaelt, wird WIRKLICH aufgerufen. Eine Liste
  // von Hand veraltet; diese Regel nimmt neue Fenster ab dem Tag ihrer
  // Entstehung mit.
  for (const name of MODAL_OEFFNER) {
    const sel = await p.evaluate(OEFFNE, name).catch(() => null);
    if (!sel) { fensterLeer++; continue; }
    fensterGemessen++;
    const rF = await p.evaluate(SCAN, sel);
    konformGesamt += rF.konform;
    rF.funde.forEach(o=>{const k=BR+'|'+o.el+'|'+o.txt; if(!seen.has(k))seen.set(k,{...o,tab:name,br:BR});});
    (await p.evaluate(AUSSERHALB, sel)).forEach(o=>{const k=BR+'|'+o.el+'|'+o.txt; if(!raus.has(k))raus.set(k,{...o,tab:name,br:BR});});
  }
  await ctx.close();
  }
  const list=[...seen.values()].sort((a,b)=>a.min-b.min);
  console.log('Breiten gemessen: ' + BREITEN.map(b=>b+' px').join(' · '));
  console.log('Fenster automatisch geoeffnet: ' + fensterGemessen + ' (ohne Inhalt: ' + fensterLeer + ')');
  console.log('Zu klein, aber durch ABSTAND konform (WCAG 2.5.8 Ausnahme, keine Meldung): ' + konformGesamt);
  console.log('Bedienelemente unter 24×24 CSS-px (WCAG 2.5.8 AA):', list.length);
  list.slice(0,20).forEach(o=>console.log(`   ${String(o.w).padStart(3)}×${String(o.h).padEnd(3)}  ${(o.br+'px').padEnd(6)} ${o.tab.padEnd(9)} ${o.el.slice(0,40).padEnd(41)} „${o.txt}" ${o.label?'aria:'+o.label:''}`));

  const rausL=[...raus.values()].sort((a,b)=>b.fehlt-a.fehlt);
  console.log('Bedienelemente, die seitlich aus dem Bildschirm ragen:', rausL.length);
  rausL.slice(0,15).forEach(o=>console.log(`   ${String(o.fehlt).padStart(3)}px draussen  ${(o.br+'px').padEnd(6)} ${o.tab.padEnd(9)} ${o.el.slice(0,40).padEnd(41)} „${o.txt}"`));
  await br.close();
  process.exitCode = (list.length + rausL.length) ? 1 : 0;
})();
