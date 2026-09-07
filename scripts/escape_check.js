#!/usr/bin/env node
// escape_check.js — kommt Fremdtext als TEXT an, oder als Code?
//
//   node scripts/escape_check.js
//
// Anlass: docs/PROFESSIONALITAET-AUDIT-2026-09-06.md §A2–A4 und der HTML-Teil
// von §A10. Vier Klassen von Stellen, an denen Text, den ANDERE schreiben
// (Community-Beitraege, Arten aus der `species`-Tabelle, Mitteilungen aus
// SECURITY-DEFINER-Triggern, Uebersetzungen, KI-Ausgaben, Push-Nutzlasten),
// ohne Pruefung in HTML, in ein onclick-Attribut, in location.href oder in
// einen Service-Worker-Navigate lief. Jeder Fall RENDERT wirklich — mit
// einem Wert, der bei roher Einsetzung Code ausfuehren wuerde
// (`<img src=x onerror="window.__pwned=1">`, `' );alert(1);//`,
// `javascript:`) — und misst danach zwei Dinge: ist __pwned unberuehrt, und
// steht der Wert als sichtbarer TEXT da (nicht verschluckt, nicht verstuemmelt).
// Beide Richtungen je Fall (CLAUDE.md §4b): der feindliche Wert bleibt Text,
// der gutartige rendert weiter (Bild mit https, Link mit Anker, <b> im Chat).
//
// Grenze: geprueft sind die STELLEN aus dem Audit und die vier Helfer
// (escHtml, _gsOcStr, _gsSafeLink, gsSanitizeHtml, swSafeUrl). Eine
// fuenfte rohe Einsetzung irgendwo anders sieht dieser Pruefstand nicht —
// dafuer ist er die Vorlage: Stelle finden, feindlichen Wert rendern, messen.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const BOESE = '<img src=x onerror="window.__pwned=1">';
let __seite = null;
const warte = (ms) => new Promise(r => setTimeout(r, ms));

const FAELLE = [
  {
    name: 'A2 · Community-Feed: `type` aus social_posts steht als Text im title-Attribut, ein javascript:-Bild faellt weg, ein https-Bild bleibt',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        const iso = new Date().toISOString();
        socialPosts = [
          { id: 'p1', user_id: 'u-x', type: '" onmouseover="window.__pwned=1', author_name: 'A', content: 't', created_at: iso, photo_url: 'javascript:window.__pwned=1' },
          { id: 'p2', user_id: 'u-y', type: 'fund', author_name: 'B', content: 'u', created_at: iso, photo_url: 'https://bilder.example/x.jpg' },
        ];
        currentSocialFilter = 'all';
        renderSocialFeed();
        await new Promise(r => setTimeout(r, 300));
        const feed = document.getElementById('social-feed');
        const p1 = feed.querySelector('#post-p1'), p2 = feed.querySelector('#post-p2');
        const span = p1 && Array.from(p1.querySelectorAll('span[title]')).find(s => /pwned/.test(s.getAttribute('title')));
        return {
          pwned: window.__pwned, onmouse: feed.querySelectorAll('[onmouseover]').length,
          titel: span ? span.getAttribute('title') : null,
          bilder1: p1 ? Array.from(p1.querySelectorAll('img')).map(i => i.getAttribute('src')) : null,
          bilder2: p2 ? Array.from(p2.querySelectorAll('img')).map(i => i.getAttribute('src')) : null,
        };
      });
      if (r.pwned !== undefined || r.onmouse) return { ok: false, warum: 'Code lief: ' + JSON.stringify(r) };
      if (r.titel !== '" onmouseover="window.__pwned=1') return { ok: false, warum: 'title-Attribut nicht der rohe Text: ' + JSON.stringify(r.titel) };
      if (!r.bilder1 || r.bilder1.length !== 0) return { ok: false, warum: 'javascript:-Bild gerendert: ' + JSON.stringify(r.bilder1) };
      if (!r.bilder2 || r.bilder2.length !== 1 || !/^https:\/\/bilder\.example\/x\.jpg$/.test(r.bilder2[0])) return { ok: false, warum: 'https-Bild fehlt: ' + JSON.stringify(r.bilder2) };
      return { ok: true, info: 'title = roher Text · 0 onmouseover · javascript:-Bild weg · https-Bild da' };
    },
  },
  {
    name: 'A3 · Artendetail einer Community-Art: Name mit Apostroph und <img onerror> in sieben Feldern — nichts laeuft, alles steht als Text, der KI-Knopf uebergibt den Namen EXAKT',
    lauf: async () => {
      const r = await __seite.evaluate(async (BOESE) => {
        const name = "Bär's Lauch " + BOESE;
        const sp = { id: 'COM_boese', name, lat: BOESE + " Allium'ursi", fam: BOESE, cat: 'wildpflanze', emoji: '🌿', desc: 'd ' + BOESE,
          habitat: 'Wald ' + BOESE, season: 'Mai ' + BOESE, uses: 'u ' + BOESE, medicinalUse: 'm ' + BOESE, care: 'c ' + BOESE,
          warning: 'w ' + BOESE, waterFrequency: '3' + BOESE, edible: false, toxic: false, tox: null, _community: true, _unverified: true };
        DB.push(sp);
        const cap = {}; const echtChat = window.openDetailChat, echtShare = window.gsShareSpecies;
        window.openDetailChat = (id, n, l, t) => { cap.chat = { id, n, l, t }; };
        window.gsShareSpecies = (n, l) => { cap.share = { n, l }; };
        try {
          openDetail('COM_boese');
          await new Promise(r => setTimeout(r, 400));
          const mc = document.getElementById('modal-content') || document.body;
          const imgs = Array.from(mc.querySelectorAll('img')).filter(i => i.getAttribute('src') === 'x').length;
          const txt = mc.textContent || '';
          const felder = ['Wald ', 'Mai ', 'u ', 'm ', 'c ', 'w '].filter(f => txt.indexOf(f + '<img src=x') < 0);
          const kiBtn = Array.from(mc.querySelectorAll('[onclick]')).find(b => /openDetailChat/.test(b.getAttribute('onclick')));
          const shBtn = Array.from(mc.querySelectorAll('[onclick]')).find(b => /gsShareSpecies/.test(b.getAttribute('onclick')));
          let parse = null;
          try { new Function(kiBtn.getAttribute('onclick')); new Function(shBtn.getAttribute('onclick')); } catch (e) { parse = e.message; }
          if (kiBtn) kiBtn.click();
          if (shBtn) shBtn.click();
          return { pwned: window.__pwned, imgs, felder, parse, chat: cap.chat, share: cap.share, name, lat: sp.lat, titel: (mc.querySelector('h2') || {}).textContent };
        } finally {
          window.openDetailChat = echtChat; window.gsShareSpecies = echtShare;
          const i = DB.indexOf(sp); if (i >= 0) DB.splice(i, 1);
          try { closeModal('detail-modal'); } catch (_) {}
        }
      }, BOESE);
      if (r.pwned !== undefined || r.imgs) return { ok: false, warum: 'Code lief oder <img> gerendert: ' + JSON.stringify({ pwned: r.pwned, imgs: r.imgs }) };
      if (r.felder.length) return { ok: false, warum: 'Felder nicht als Text da: ' + r.felder.join(', ') + ' (Titel: ' + r.titel + ')' };
      if (r.parse) return { ok: false, warum: 'onclick parst nicht: ' + r.parse };
      if (!r.chat || r.chat.n !== r.name || r.chat.l !== r.lat || r.chat.t !== null) return { ok: false, warum: 'KI-Knopf uebergibt nicht exakt: ' + JSON.stringify(r.chat) };
      if (!r.share || r.share.n !== r.name) return { ok: false, warum: 'Teilen-Knopf uebergibt nicht exakt: ' + JSON.stringify(r.share) };
      return { ok: true, info: '0 <img>, __pwned unberuehrt, 6 Felder als Text, beide onclick parsen, Name mit Apostroph + Tag exakt uebergeben, tox null bleibt null' };
    },
  },
  {
    name: '_gsOcStr · Rundreise durch HTML- und JS-Parser fuer 7 Werte (Apostroph, Anfuehrungszeichen, Backslash, &#39;, Tag, Zeilenumbruch, &amp;) — und escHtml allein scheitert am Apostroph (Gegenprobe)',
    lauf: async () => __seite.evaluate(() => {
      const werte = ["O'Brien", 'a"b', 'back\\slash', '&#39;x', '<b>y</b>', 'line\nbreak', '&amp; und &'];
      const box = document.createElement('div'); document.body.appendChild(box);
      const got = []; window.__cap = (v) => got.push(v);
      try {
        box.innerHTML = werte.map(v => '<button onclick="window.__cap(\'' + _gsOcStr(v) + '\')"></button>').join('');
        Array.from(box.querySelectorAll('button')).forEach(b => b.click());
        const falsch = werte.filter((v, i) => got[i] !== v).map((v, i) => JSON.stringify(v) + ' → ' + JSON.stringify(got[werte.indexOf(v)]));
        if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
        // Gegenprobe: escHtml (ohne JS-Escaping) bricht bei O'Brien den String — Parser-Fehler oder falscher Wert
        got.length = 0; let alt = 'lief';
        box.innerHTML = '<button onclick="window.__cap(\'' + escHtml("O'Brien") + '\')"></button>';
        try { new Function(box.querySelector('button').getAttribute('onclick')); box.querySelector('button').click(); } catch (e) { alt = 'Parser-Fehler'; }
        const gegen = (alt === 'Parser-Fehler') || got[0] !== "O'Brien";
        if (!gegen) return { ok: false, warum: 'die Gegenprobe wird nicht rot: escHtml reicht offenbar — dann misst dieser Fall nichts' };
        return { ok: true, info: werte.length + ' Werte exakt zurueck · escHtml allein: ' + (alt === 'Parser-Fehler' ? 'Parser-Fehler' : 'Wert ' + JSON.stringify(got[0])) };
      } finally { box.remove(); delete window.__cap; }
    }),
  },
  {
    name: 'A4 · Mitteilungs-Router: javascript: und //fremd werden zu „kein Ziel", https oeffnet ein neues Fenster, /?screen=…#anker springt an, ein Anker mit Code parst harmlos',
    lauf: async () => __seite.evaluate(() => {
      const t = (l) => ({ ok: (v) => v === '' || v == null, });
      const tab = { 'javascript:alert(1)': '', '//evil.example/x': '', 'https://evil.example/x': 'https://evil.example/x', '/?screen=garden#geraet-abc': '/?screen=garden#geraet-abc',
        "#favs' );alert(1);//": '#favs);alert(1);//', 'data:text/html,x': '', '  /?a=1 ': '/?a=1', 'vbscript:x': '', '': '' };
      const falsch = Object.keys(tab).filter(k => _gsSafeLink(k) !== tab[k]).map(k => JSON.stringify(k) + ' → ' + JSON.stringify(_gsSafeLink(k)));
      if (falsch.length) return { ok: false, warum: '_gsSafeLink: ' + falsch.join(' · ') };
      const iso = new Date().toISOString(); const echt = window._gsServerNotifs;
      window._gsServerNotifs = [
        { id: 'n2', kind: 'zzz_unbekannt', link: 'javascript:window.__pwned=1', title: 'x', created_at: iso },
        { id: 'n3', kind: 'zzz_unbekannt', link: 'https://evil.example/x', title: 'x', created_at: iso },
        { id: 'n4', kind: 'zzz_unbekannt', link: '/?screen=garden#geraet-abc', title: 'x', created_at: iso },
        { id: 'n5', kind: 'zzz_unbekannt', link: "#favs' );window.__pwned=1;//", title: 'x', created_at: iso },
        { id: 'n6', kind: 'zzz_unbekannt', link: '//evil.example/x', title: 'x', created_at: iso },
      ];
      try {
        const out = gsCollectNotifs().filter(o => o.type === 'server');
        const a = Object.fromEntries(out.map(o => [o.id.replace('srv_', ''), o.action]));
        const parse = Object.keys(a).filter(k => { try { new Function(a[k]); return false; } catch (_) { return true; } });
        if (parse.length) return { ok: false, warum: 'Aktion parst nicht: ' + parse.join(',') };
        if (/javascript|pwned/.test(a.n2) || !/kein Ziel/.test(a.n2)) return { ok: false, warum: 'n2: ' + a.n2 };
        if (!/window\.open\('https:\/\/evil\.example\/x','_blank'\)/.test(a.n3)) return { ok: false, warum: 'n3: ' + a.n3 };
        if (!/switchTab\('garden'\)/.test(a.n4) || !/gsAnkerAnspringen\('#geraet-abc'\)/.test(a.n4)) return { ok: false, warum: 'n4: ' + a.n4 };
        if (/window\.__pwned\s*=|\)\s*;/.test(a.n5.replace(/^.*?switchTab\('/, '').replace(/'\);\},250\);$/, '')) || !/switchTab\('favs[a-z_]*'\)/.test(a.n5)) return { ok: false, warum: 'n5: ' + a.n5 };
        if (/evil/.test(a.n6) || !/kein Ziel/.test(a.n6)) return { ok: false, warum: 'n6: ' + a.n6 };
        Object.keys(a).forEach(k => { try { new Function(a[k])(); } catch (_) {} });
        if (window.__pwned !== undefined) return { ok: false, warum: 'eine Aktion hat Code ausgefuehrt' };
        return { ok: true, info: '9 Werte _gsSafeLink · javascript: → kein Ziel · https → window.open · /?screen#anker → switchTab+Anker · Anker mit Code → harmlos · //fremd → kein Ziel · alle 5 Aktionen ausgefuehrt, __pwned unberuehrt' };
      } finally { window._gsServerNotifs = echt; }
    }),
  },
  {
    name: 'A4 · Service Worker: swSafeUrl laesst nur den eigenen Ursprung durch, und notificationclick benutzt sie',
    lauf: async () => {
      const src = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
      const m = src.match(/function swSafeUrl\(u\) \{[\s\S]*?\n\}/);
      if (!m) return { ok: false, warum: 'swSafeUrl nicht in sw.js' };
      const fn = new Function('self', m[0] + '\nreturn swSafeUrl;')({ location: { origin: 'https://green-scan.ch' } });
      const tab = { 'javascript:alert(1)': '/', 'https://evil.example/x': '/', '//evil.example/x': '/', '/?screen=favs': '/?screen=favs', '/?screen=garden#geraet-1': '/?screen=garden#geraet-1',
        'https://green-scan.ch/?screen=map': '/?screen=map', 'data:text/html,x': '/', 'vbscript:x': '/' };
      const falsch = Object.keys(tab).filter(k => fn(k) !== tab[k]).map(k => k + ' → ' + fn(k));
      if (fn(undefined) !== '/' || fn(null) !== '/') falsch.push('undefined/null → ' + fn(undefined) + '/' + fn(null));
      if (falsch.length) return { ok: false, warum: falsch.join(' · ') };
      const click = src.slice(src.indexOf("addEventListener('notificationclick'"));
      if (!/const url = swSafeUrl\(/.test(click.slice(0, 400))) return { ok: false, warum: 'notificationclick liest die URL nicht durch swSafeUrl' };
      return { ok: true, info: '10 Werte · fremder Ursprung → / · eigener Ursprung als Pfad · Handler ruft swSafeUrl' };
    },
  },
  {
    name: 'A10 · gsSanitizeHtml: <b>/<a https> bleiben, img/script/onclick/javascript-href/url()-style fallen, unbekannte Tags werden ausgepackt — und lebt an drei Stellen (Uebersetzung, Scan-Chat, Admin-Triage)',
    lauf: async () => {
      const r = await __seite.evaluate(async (BOESE) => {
        const roh = '<b>ok</b>' + BOESE + '<a href="javascript:window.__pwned=1">l</a><a href="https://x.example/">e</a><span onclick="window.__pwned=1" style="color:red">s</span><script>window.__pwned=1</script><blink>t</blink><i style="background:url(x)">i</i><!-- k --><br>';
        const s = gsSanitizeHtml(roh);
        const box = document.createElement('div'); box.innerHTML = s; document.body.appendChild(box);
        await new Promise(r => setTimeout(r, 200));
        const u = {
          b: !!box.querySelector('b'), img: box.querySelectorAll('img').length, script: box.querySelectorAll('script').length,
          onclick: box.querySelectorAll('[onclick]').length, l: box.querySelector('a') && box.querySelector('a').hasAttribute('href'),
          e: (() => { const a = box.querySelectorAll('a')[1]; return a && a.getAttribute('href') === 'https://x.example/' && a.getAttribute('rel') === 'noopener noreferrer' && a.getAttribute('target') === '_blank'; })(),
          span: box.querySelector('span') && box.querySelector('span').getAttribute('style') === 'color:red',
          blink: box.querySelectorAll('blink').length === 0 && /t/.test(box.textContent),
          istyle: box.querySelector('i') && !box.querySelector('i').hasAttribute('style'),
          br: !!box.querySelector('br'), kommentar: s.indexOf('<!--') < 0, pwned: window.__pwned,
        };
        box.remove();
        // Uebersetzung (data-i18n-html)
        const el = document.createElement('div'); el.id = 'esc-i18n'; el.setAttribute('data-i18n', 'esc_test_key_ohne_uebersetzung'); el.setAttribute('data-i18n-html', '');
        el.setAttribute('data-i18n-fallback', 'Tippe<br>hier ' + BOESE + '<b>fett</b>'); document.body.appendChild(el);
        gsI18n.applyToDOM(document.body.parentNode ? el.parentNode : document);
        await new Promise(r => setTimeout(r, 200));
        const i18n = { img: el.querySelectorAll('img').length, br: el.querySelectorAll('br').length, b: el.querySelectorAll('b').length };
        el.remove();
        // Scan-Chat
        const log = document.getElementById('scan-chat-log'); let chat = null;
        if (log) { log.innerHTML = ''; addScanChatMsg('assistant', '<strong>Art</strong> ' + BOESE, true); await new Promise(r => setTimeout(r, 200));
          chat = { img: log.querySelectorAll('img').length, strong: log.querySelectorAll('strong').length }; log.innerHTML = ''; }
        // Admin-Triage
        const echtAdmin = window.gsIsAdmin, echtFetch = window.sbFetch;
        window.gsIsAdmin = () => true;
        window.sbFetch = async () => ({ data: { analyzed: 1, items: [{ priority: 5, category: 'k' + BOESE, summary: 's' + BOESE, rationale: 'r' + BOESE, actionable: true, suggested_action: 'a' + BOESE, implementation_effort: 'e' + BOESE }] }, error: null });
        const ids = ['ki-improve-status', 'ki-improve-result', 'ki-run-server-btn'].map(id => { let e = document.getElementById(id); if (!e) { e = document.createElement(id === 'ki-run-server-btn' ? 'button' : 'div'); e.id = id; e.setAttribute('data-esc-temp', '1'); document.body.appendChild(e); } return e; });
        let triage = null;
        try { await gsRunServerTriage(); await new Promise(r => setTimeout(r, 200)); const res = document.getElementById('ki-improve-result'); triage = { img: res.querySelectorAll('img').length, text: /s<img src=x/.test(res.textContent) && /a<img src=x/.test(res.textContent) }; }
        finally { window.gsIsAdmin = echtAdmin; window.sbFetch = echtFetch; ids.forEach(e => { if (e.getAttribute('data-esc-temp')) e.remove(); }); }
        return { u, i18n, chat, triage, pwned: window.__pwned };
      }, BOESE);
      const u = r.u;
      if (r.pwned !== undefined) return { ok: false, warum: 'Code lief' };
      if (!u.b || u.img || u.script || u.onclick || u.l || !u.e || !u.span || !u.blink || !u.istyle || !u.br || !u.kommentar) return { ok: false, warum: 'Sanitizer: ' + JSON.stringify(u) };
      if (r.i18n.img || r.i18n.br !== 1 || r.i18n.b !== 1) return { ok: false, warum: 'Uebersetzung: ' + JSON.stringify(r.i18n) };
      if (!r.chat || r.chat.img || r.chat.strong !== 1) return { ok: false, warum: 'Scan-Chat: ' + JSON.stringify(r.chat) };
      if (!r.triage || r.triage.img || !r.triage.text) return { ok: false, warum: 'Triage: ' + JSON.stringify(r.triage) };
      return { ok: true, info: 'Sanitizer 11 Merkmale · Uebersetzung: br bleibt, img weg · Scan-Chat: strong bleibt, img weg · Triage: 5 Felder als Text' };
    },
  },
  {
    name: 'A10 · Karte „Meine Funde": ein Foto mit javascript: bekommt kein <img>, eines mit https schon',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        const echt = window.gsMapFinds; const iso = new Date().toISOString();
        window.gsMapFinds = { list: async () => [
          { id: 'f1', species_name: 'Eins', photo_url: 'javascript:window.__pwned=1', category: 'pilz', found_at: iso },
          { id: 'f2', species_name: 'Zwei', photo_url: 'https://p.example/a.jpg', category: 'pilz', found_at: iso },
        ] };
        try {
          await gsOpenMyFinds(); await new Promise(r => setTimeout(r, 300));
          const l = document.getElementById('gs-myfinds-list');
          return { imgs: Array.from(l.querySelectorAll('img')).map(i => i.getAttribute('src')), pwned: window.__pwned, namen: l.textContent.indexOf('Eins') >= 0 && l.textContent.indexOf('Zwei') >= 0 };
        } finally { window.gsMapFinds = echt; try { closeModal('detail-modal'); } catch (_) {} }
      });
      if (r.pwned !== undefined) return { ok: false, warum: 'Code lief' };
      if (r.imgs.length !== 1 || r.imgs[0] !== 'https://p.example/a.jpg' || !r.namen) return { ok: false, warum: JSON.stringify(r) };
      return { ok: true, info: '1 Bild (https), javascript: ohne <img>, beide Funde in der Liste' };
    },
  },
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); __seite = p;
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true;
    window.gsToast = () => {}; window.showProfileToast = () => {}; window.gsHaptic = () => {};
  });
  console.log('\n=== escape_check — kommt Fremdtext als Text an, oder als Code?');
  let kaputt = 0;
  for (const f of FAELLE) {
    let r;
    try { r = await f.lauf(); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }
  await br.close();
  console.log('  ---');
  console.log('  Faelle geprueft: ' + FAELLE.length + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  console.log('  Grenze: geprueft sind die Stellen aus dem Audit (A2–A4, A10) und die fuenf Helfer —');
  console.log('  eine rohe Einsetzung anderswo sieht dieser Pruefstand nicht.');
  process.exitCode = kaputt ? 1 : 0;
})();
