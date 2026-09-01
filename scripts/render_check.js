#!/usr/bin/env node
/**
 * render_check.js — laedt index.html im Gast-Modus, baut jeden Tab auf und
 * meldet, was tatsaechlich gerendert wird.
 *
 * Warum das existiert: bis v31.29 liessen sich optische Aenderungen nicht am
 * laufenden Programm pruefen. Ohne Anmeldung blieb die App im Onboarding
 * haengen, und Vorher/Nachher-Vergleiche stuetzten sich auf ein Dutzend
 * Elemente. Der vorgesehene Weg ohne Konto ist der GAST-MODUS
 * (localStorage.gs_guest_mode='true') — den setzt dieses Skript.
 *
 *   node scripts/render_check.js                  → aktuelle index.html pruefen
 *   node scripts/render_check.js a.html b.html    → zwei Staende vergleichen
 *
 * Netzwerk ist blockiert: geprueft wird die Huelle, nicht Supabase.
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');

const TABS = ['home','garden','wissen','favs','search','social','market','recipes','remedies','map','scanner'];

// Der Gast-Modus ist KEIN Weg hinein: er wurde in v25.33 abgeschaltet
// (gsActivateGuestMode ist ein leerer Rumpf), der Zweig in gsCheckOnboarding
// ist tot. Was die App-Huelle verdeckt, ist der Login-Flash-Guard: ohne
// gs_sb_token setzt er html.gs-preauth und damit
//   #app{display:none!important} + #gs-onboarding{display:block!important}
// Also einen Token setzen — dann greift der Guard gar nicht erst. Dazu ein
// wenig Beispieldaten, sonst zeigen die Tabs nur Leerzustaende.
const SEED = () => { try {
  const D = 86400000, now = 1756684800000;   // fest, damit Laeufe vergleichbar bleiben
  const set = (k, v) => localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  set('gs_sb_token', 'pruefstand-kein-echter-token');   // nur gegen den Flash-Guard
  set('gs_sb_expires', String(now + 30*D));
  set('gs_consent', { analytics:false });
  set('gs_lang', 'de');
  set('gs_sb_display_name', 'Testnutzerin');
  set('gs_user_location', { lat:47.3769, lon:8.5417, name:'Zürich', canton:'ZH', country:'CH', zip:'8001' });
  set('gs_home_weather_loc', { lat:47.3769, lon:8.5417, name:'Zürich' });
  set('myPlants', [
    { id:'p1', name:'Basilikum', species:'Ocimum basilicum', emoji:'🌿', added:now-20*D, lastWatered:now-4*D, waterEvery:3, location:'Küchenfenster' },
    { id:'p2', name:'Monstera',  species:'Monstera deliciosa', emoji:'🪴', added:now-90*D, lastWatered:now-1*D, waterEvery:7, location:'Wohnzimmer' },
    { id:'p3', name:'Tomate',    species:'Solanum lycopersicum', emoji:'🍅', added:now-45*D, lastWatered:now-2*D, waterEvery:2, location:'Balkon' }
  ]);
  set('gs_gardens', [{ id:'g1', name:'Balkon Süd', size_m2:6, type:'balkon', created:now-60*D }]);
  set('gs_scan_history', [
    { id:'s1', name:'Löwenzahn', latin:'Taraxacum officinale', ts:now-2*D, confidence:0.94, kind:'plant' },
    { id:'s2', name:'Steinpilz', latin:'Boletus edulis',       ts:now-9*D, confidence:0.88, kind:'fungus' }
  ]);
  set('gs_ernte_log', [{ id:'e1', plant:'Tomate', amount:420, unit:'g', ts:now-3*D }]);
  set('gs_confirmed_species', ['Taraxacum officinale','Boletus edulis']);
  set('gs_wissen_read', ['alpen-1','voegel-2']);
  set('gs_last_active_day_iso', new Date(now).toISOString().slice(0,10));
} catch(e){} };

const CENSUS = () => {
  const out = [];
  // Hat ein Vorfahre eine waagrechte Scroll-Flaeche? Dann ist Herausragen gewollt.
  const scrollsX = el => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll') return true;
      if (p.scrollWidth - p.clientWidth > 1 && o !== 'visible') return true;
    }
    return false;
  };
  // Senkrechtes Clipping auf einem Bildschirm-Container ist normales Scrollen
  // der Seite, kein verlorener Inhalt.
  const isScreen = el => el.classList && (el.classList.contains('screen') || el.id === 'app' || el.id === 'main');
  document.querySelectorAll('*').forEach(el => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || !cs.opacity || cs.opacity === '0') return;
    const b = el.getBoundingClientRect();
    if (b.width < 2 || b.height < 2) return;
    const cls = (typeof el.className === 'string') ? el.className.trim().slice(0, 48) : '';

    // Ueberlauf: Inhalt breiter/hoeher als der Kasten UND abgeschnitten.
    // Nur zaehlen, wenn wirklich etwas verloren geht — also nicht bei
    // overflow:auto/scroll (da kann der Nutzer scrollen) und nicht bei
    // Rundungsresten unter 1px.
    const ox = cs.overflowX, oy = cs.overflowY;
    const clipX = (ox === 'hidden' || ox === 'clip');
    const clipY = (oy === 'hidden' || oy === 'clip');
    const overX = el.scrollWidth  - el.clientWidth;
    const overY = el.scrollHeight - el.clientHeight;
    const ell = cs.textOverflow === 'ellipsis';

    out.push({
      // v31.38: Elemente OHNE id, Klasse und Text teilten sich sonst den
      // Schluessel „SVG|||". Der Vergleich paarte dann zwei voellig
      // verschiedene Elemente und meldete eine Groessenaenderung, die es nicht
      // gab. Ein kurzer Pfad (Tag + Position unter Geschwistern, 4 Ebenen)
      // macht ihn eindeutig.
      key: (() => { let pfad = '', q = el, tiefe = 0;
        while (q && q.parentElement && tiefe < 4) {
          const gl = [...q.parentElement.children].filter(c => c.tagName === q.tagName);
          pfad = q.tagName + (gl.length > 1 ? ':' + gl.indexOf(q) : '') + '>' + pfad;
          q = q.parentElement; tiefe++;
        }
        return pfad; })() + '|' + (el.id || '') + '|' + cls + '|' + (el.textContent || '').trim().slice(0, 24),
      r: parseFloat(cs.borderTopLeftRadius) || 0,
      fs: parseFloat(cs.fontSize) || 0,
      lh: parseFloat(cs.lineHeight) || 0,
      // Groesse aus der Layout-Box, NICHT aus getBoundingClientRect(): letzteres
      // misst die transformierte Huelle. Ein Ladekreisel (.gs-spin, 14x14,
      // animation:rotate) liefert darueber je nach Winkel 14 bis 20px und
      // erschien im Vergleich als "Layout geaendert" — jedes Mal an einer
      // anderen Stelle. offsetWidth/Height ignorieren Transformationen.
      // Inline-Elemente haben offsetWidth 0; dort bleibt das Rechteck.
      w: Math.round(el.offsetWidth || b.width), h: Math.round(el.offsetHeight || b.height),
      color: cs.color, bg: cs.backgroundColor,
      // abgeschnitten = Inhalt laeuft ueber UND wird geclippt (Ellipsis ist gewollt)
      clipX: clipX && overX > 1 && !ell ? overX : 0,
      clipY: (clipY && overY > 1 && !isScreen(el)) ? overY : 0,
      // Rechts aus dem Bildschirm heraus ist NUR dann ein Fehler, wenn kein
      // Vorfahre waagrecht scrollt. Chip-Leisten (Kategorien, Filter) ragen
      // absichtlich hinaus — der erste Anlauf meldete davon 72 Stueck als
      // Fehler. Ein Pruefstand, der Falschalarme produziert, ist schlechter
      // als keiner.
      offscreen: (b.right > 412.5 && !scrollsX(el)) ? Math.round(b.right - 412) : 0,
    });
  });
  return out;
};

async function scan(browser, file) {
  const ctx = await browser.newContext({ viewport:{ width:412, height:915 }, deviceScaleFactor:1 });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await page.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.addInitScript(SEED);
  await page.goto('file://' + path.resolve(file), { waitUntil:'domcontentloaded', timeout:90000 });
  await page.waitForTimeout(3500);
  // Der Token ist nicht echt, also zeigt gsCheckOnboarding trotzdem das
  // Onboarding — aber ohne gs-preauth laesst es sich normal schliessen.
  await page.evaluate(() => {
    try { document.documentElement.classList.remove('gs-preauth'); } catch (e) {}
    const o = document.getElementById('gs-onboarding');
    if (o) { o.style.setProperty('display', 'none', 'important'); }
  });
  await page.waitForTimeout(400);

  // Direkt nach dem Laden pruefen, nicht erst nach dem Tab-Durchlauf: ein
  // spaeterer switchTab kann das Onboarding erneut anstossen, und dann meldet
  // der Pruefstand einen Fehler, den es beim Laden gar nicht gab.
  const onb = await page.evaluate(() => {
    const o = document.getElementById('gs-onboarding');
    return !!(o && getComputedStyle(o).display !== 'none' && o.getBoundingClientRect().height > 10);
  });

  const rows = [];
  const perTab = {};
  for (const t of TABS) {
    try { await page.evaluate(t => { if (typeof switchTab === 'function') switchTab(t); }, t); } catch (_) {}
    await page.waitForTimeout(600);
    const c = await page.evaluate(CENSUS);
    perTab[t] = c.length;
    rows.push(...c.map(o => ({ ...o, key: t + '::' + o.key })));
  }
  await ctx.close();
  return { rows, errs, perTab, onb };
}

(async () => {
  const args = process.argv.slice(2);
  const files = args.length ? args : [path.join(__dirname, '..', 'index.html')];
  const browser = await chromium.launch();
  const res = [];
  for (const f of files) res.push([f, await scan(browser, f)]);
  await browser.close();

  for (const [f, r] of res) {
    console.log('=== ' + path.basename(f));
    console.log('  Onboarding blockiert noch:', r.onb ? 'JA (Gast-Modus griff nicht)' : 'nein');
    console.log('  JS-Fehler:', r.errs.length ? [...new Set(r.errs)].slice(0,4).join(' | ') : 'keine');
    console.log('  sichtbare Elemente je Tab:', Object.entries(r.perTab).map(([k,v]) => k+'='+v).join(' '));
    console.log('  gesamt vermessen:', r.rows.length);
    const cut  = r.rows.filter(o => o.clipX || o.clipY);
    const offs = r.rows.filter(o => o.offscreen);
    console.log('  abgeschnittener Inhalt:', cut.length, '| ragt aus dem Bildschirm:', offs.length);
    const show = (list, f) => [...list].sort((a,b) => f(b) - f(a)).slice(0, 8)
      .forEach(o => console.log('     ', String(f(o)) + 'px  ' + o.key.replace(/\|/g,' ').slice(0, 88)));
    if (cut.length)  { console.log('   -- am staerksten abgeschnitten:'); show(cut,  o => Math.max(o.clipX, o.clipY)); }
    if (offs.length) { console.log('   -- am weitesten draussen:');       show(offs, o => o.offscreen); }
  }

  if (res.length === 2) {
    const [[, A], [, B]] = res;
    const ma = new Map(A.rows.map(o => [o.key, o])), mb = new Map(B.rows.map(o => [o.key, o]));
    let n = 0, dr = 0, dfs = 0, dsize = 0, dcolor = 0, maxR = 0, maxFs = 0;
    const ex = [];
    for (const [k, a] of ma) {
      const b = mb.get(k); if (!b) continue;
      n++;
      if (a.r !== b.r)   { dr++;  if (Math.abs(b.r-a.r)   > Math.abs(maxR))  maxR  = b.r - a.r; }
      if (a.fs !== b.fs) { dfs++; if (Math.abs(b.fs-a.fs) > Math.abs(maxFs)) maxFs = b.fs - a.fs; }
      if (a.w !== b.w || a.h !== b.h) { dsize++; if (ex.length < 10) ex.push(`${a.w}x${a.h} → ${b.w}x${b.h}  ${k.slice(0,70)}`); }
      if (a.color !== b.color || a.bg !== b.bg) dcolor++;
    }
    console.log('\n=== Vergleich');
    console.log('  vergleichbare Elemente:', n);
    console.log('  Radius geaendert:', dr, '| groesste Bewegung', maxR + 'px');
    console.log('  Schriftgroesse geaendert:', dfs, '| groesste Bewegung', maxFs + 'px');
    console.log('  GROESSE geaendert (Layout!):', dsize);
    ex.forEach(e => console.log('     ', e));
    console.log('  Farbe geaendert:', dcolor);
  }
})();
