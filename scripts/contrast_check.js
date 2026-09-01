#!/usr/bin/env node
/**
 * contrast_check.js — misst den WCAG-Kontrast jeder sichtbaren Textstelle in
 * beiden Modi und meldet gruppiert, was unter AA liegt (4.5:1, bei grosser
 * Schrift 3:1). Ergaenzt scripts/render_check.js.
 *
 * Zwei Dinge meldet er bewusst NICHT:
 *   - Text auf einem Farbverlauf (nicht als eine Farbe messbar)
 *   - reine Emoji — deren color-Eigenschaft sagt nichts ueber die Darstellung.
 *     Der erste Lauf meldete davon ein Dutzend als Fehler.
 *
 * Halbtransparente Schichten werden korrekt uebereinandergelegt, bis die
 * erste undurchsichtige Flaeche erreicht ist.
 *
 *   node scripts/contrast_check.js
 */
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const TABS=['home','garden','wissen','favs','search','social','market','recipes','remedies'];
const D=86400000, now=1756684800000;
const SEED=()=>{try{const set=(k,v)=>localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
  set('gs_sb_token','pruefstand'); set('gs_sb_expires',String(now+30*D));
  set('gs_sb_display_name','Testnutzerin'); set('gs_lang','de');
  set('myPlants',[{id:'p1',name:'Basilikum',emoji:'🌿',added:now-20*D,lastWatered:now-4*D,waterEvery:3}]);
}catch(e){}};
const SCAN=()=>{
  const lum=c=>{const s=c.map(v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*s[0]+.7152*s[1]+.0722*s[2]};
  const cr=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)};
  const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/); if(!m)return null;
    const p=m[1].split(',').map(x=>parseFloat(x)); return {rgb:p.slice(0,3), a:p.length>3?p[3]:1}};
  // echte Hintergrundfarbe: erste undurchsichtige Flaeche nach oben, alle
  // halbtransparenten Schichten davor korrekt uebereinanderlegen
  const bgOf=el=>{
    const stack=[];
    for(let p=el; p; p=p.parentElement){
      const c=parse(getComputedStyle(p).backgroundColor);
      if(getComputedStyle(p).backgroundImage!=='none') return null;   // Verlauf → nicht messbar
      if(!c||c.a===0) continue;
      stack.push(c); if(c.a===1) break;
    }
    if(!stack.length||stack[stack.length-1].a!==1) return null;
    let out=stack.pop().rgb;
    while(stack.length){const t=stack.pop(); out=out.map((v,i)=>Math.round(t.a*t.rgb[i]+(1-t.a)*v));}
    return out;
  };
  const out=[];
  document.querySelectorAll('*').forEach(el=>{
    const cs=getComputedStyle(el);
    if(cs.display==='none'||cs.visibility==='hidden')return;
    // nur Elemente mit eigenem Text
    const txt=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join(' ').trim();
    if(txt.length<2)return;
    // Emoji-only: die color-Eigenschaft sagt nichts ueber die Darstellung —
    // Emoji bringen ihre eigenen Farben mit. Der erste Lauf meldete davon
    // ein Dutzend als Fehler.
    if(!/[a-zA-Z0-9\u00c0-\u024f]/.test(txt)) return;
    const b=el.getBoundingClientRect(); if(b.width<4||b.height<4)return;
    const fg=parse(cs.color); const bg=bgOf(el);
    if(!fg||!bg||fg.a<1)return;
    const fs=parseFloat(cs.fontSize), fw=parseInt(cs.fontWeight)||400;
    const gross = fs>=24 || (fs>=18.66 && fw>=700);
    const r=cr(fg.rgb,bg);
    const min = gross?3:4.5;
    if(r<min) out.push({t:txt.slice(0,34), r:Math.round(r*100)/100, min, fs, fw,
      fg:'rgb('+fg.rgb.join(',')+')', bg:'rgb('+bg.join(',')+')',
      sel:el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:'')});
  });
  return out;
};
(async()=>{
  const br=await chromium.launch();
  for(const dark of [false,true]){
    const ctx=await br.newContext({viewport:{width:412,height:915}}); const p=await ctx.newPage();
    await p.route('**',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
    await p.addInitScript(SEED);
    await p.goto('file://' + require('path').join(__dirname,'..','index.html') + '',{waitUntil:'domcontentloaded',timeout:90000});
    await p.waitForTimeout(3500);
    await p.evaluate(d=>{document.documentElement.classList.remove('gs-preauth');
      const o=document.getElementById('gs-onboarding'); if(o)o.style.setProperty('display','none','important');
      document.body.classList.toggle('dark', d);}, dark);
    const seen=new Map();
    for(const t of TABS){ try{await p.evaluate(t=>switchTab(t),t)}catch(e){}
      await p.waitForTimeout(500);
      (await p.evaluate(SCAN)).forEach(o=>{ const k=o.sel+'|'+o.t; if(!seen.has(k)) seen.set(k,{...o,tab:t}); }); }
    console.log('\n=== ' + (dark?'DUNKELMODUS':'HELLMODUS') + ' — ' + seen.size + ' Textstellen unter AA');
    const g={};
    [...seen.values()].forEach(o=>{ const k=o.sel.split('.')[1]||o.sel.split('#')[1]||o.sel;
      (g[k]=g[k]||{n:0,min:99,bg:new Set(),fg:new Set(),bsp:''}); g[k].n++;
      if(o.r<g[k].min){g[k].min=o.r; g[k].bsp=o.t;} g[k].bg.add(o.bg); g[k].fg.add(o.fg); });
    Object.entries(g).sort((a,b)=>b[1].n-a[1].n).slice(0,16).forEach(([k,v])=>
      console.log(`  ${String(v.n).padStart(4)}×  schlechtester ${String(v.min).padStart(5)}:1  ${k.slice(0,30).padEnd(31)} ${[...v.fg][0]} auf ${[...v.bg][0]}  „${v.bsp}"`));
    await ctx.close();
  }
  await br.close();
})();
