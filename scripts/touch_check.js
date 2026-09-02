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
const SCAN=()=>{
  const out=[];
  document.querySelectorAll('button,a[href],[onclick],[role="button"],input,select,summary').forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden'||cs.pointerEvents==='none')return;
    const r=el.getBoundingClientRect();
    if(r.width<1||r.height<1)return;
    // Elemente, die andere bedienbare Elemente enthalten, sind Container — die
    // eigentliche Flaeche ist das Kind. Nicht doppelt zaehlen.
    if(el.querySelector('button,a[href],[onclick],[role="button"],input,select')) return;
    const w=Math.round(r.width), h=Math.round(r.height);
    const min=Math.min(w,h);
    if(min>=24)return;
    const txt=(el.textContent||'').trim().slice(0,20);
    out.push({w,h,min,txt,
      el:el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:''),
      label: el.getAttribute('aria-label')||''});
  });
  return out;
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
const AUSSERHALB = () => {
  const W = document.documentElement.clientWidth, out = [];
  document.querySelectorAll('button,a[href],[onclick],[role="button"],input,select,textarea').forEach(el => {
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

(async()=>{
  const br=await chromium.launch();
  const ctx=await br.newContext({viewport:{width:412,height:915}}); const p=await ctx.newPage();
  await p.route('**',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + require('path').join(__dirname,'..','index.html'),{waitUntil:'domcontentloaded',timeout:90000});
  await p.waitForTimeout(3500);
  await p.evaluate(()=>{document.documentElement.classList.remove('gs-preauth');
    const o=document.getElementById('gs-onboarding');if(o)o.style.setProperty('display','none','important');});
  const seen=new Map(); const raus=new Map();
  for(const t of TABS){ try{await p.evaluate(t=>switchTab(t),t)}catch(e){}
    await p.waitForTimeout(600);
    (await p.evaluate(SCAN)).forEach(o=>{const k=o.el+'|'+o.txt; if(!seen.has(k))seen.set(k,{...o,tab:t});});
    (await p.evaluate(AUSSERHALB)).forEach(o=>{const k=o.el+'|'+o.txt; if(!raus.has(k))raus.set(k,{...o,tab:t});}); }
  const list=[...seen.values()].sort((a,b)=>a.min-b.min);
  console.log('Bedienelemente unter 24×24 CSS-px (WCAG 2.5.8 AA):', list.length);
  list.slice(0,20).forEach(o=>console.log(`   ${String(o.w).padStart(3)}×${String(o.h).padEnd(3)}  ${o.tab.padEnd(9)} ${o.el.slice(0,40).padEnd(41)} „${o.txt}" ${o.label?'aria:'+o.label:''}`));

  const rausL=[...raus.values()].sort((a,b)=>b.fehlt-a.fehlt);
  console.log('Bedienelemente, die seitlich aus dem Bildschirm ragen:', rausL.length);
  rausL.slice(0,15).forEach(o=>console.log(`   ${String(o.fehlt).padStart(3)}px draussen  ${o.tab.padEnd(9)} ${o.el.slice(0,40).padEnd(41)} „${o.txt}"`));
  await br.close();
  process.exitCode = (list.length + rausL.length) ? 1 : 0;
})();
