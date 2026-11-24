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
    name: 'A2 · Community-Feed: `type` aus social_posts steht als Text im title-Attribut, ein javascript:-Bild faellt weg, ein Bild aus dem eigenen Speicher bleibt (seit v33.59 kein fremder https-Host mehr)',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        const iso = new Date().toISOString();
        socialPosts = [
          { id: 'p1', user_id: 'u-x', type: '" onmouseover="window.__pwned=1', author_name: 'A', content: 't', created_at: iso, photo_url: 'javascript:window.__pwned=1' },
          { id: 'p2', user_id: 'u-y', type: 'fund', author_name: 'B', content: 'u', created_at: iso, photo_url: SB_URL_DEFAULT + '/storage/v1/object/public/post-images/u-y/x.jpg' },
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
      if (!r.bilder2 || r.bilder2.length !== 1 || !/\/storage\/v1\/object\/public\/post-images\/u-y\/x\.jpg$/.test(r.bilder2[0])) return { ok: false, warum: 'Speicher-Bild fehlt: ' + JSON.stringify(r.bilder2) };
      return { ok: true, info: 'title = roher Text · 0 onmouseover · javascript:-Bild weg · Speicher-Bild da' };
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
    name: 'A3b · Trefferliste: Name und lateinischer Name einer Community-Art stehen als Text — mit und ohne Suchwort, auch auf Seite 2',
    lauf: async () => {
      const r = await __seite.evaluate(async (BOESE) => {
        const neu = [];
        for (let i = 0; i < 100; i++) neu.push({ id: 'COM_l' + i, name: 'Qqliste ' + i + ' ' + BOESE, lat: BOESE + ' lat' + i, cat: 'qqkat', emoji: '🌿', edible: false, toxic: false, tox: null, _community: true, _unverified: true });
        neu.forEach(s => DB.push(s));
        const zaehl = () => { const l = document.getElementById('results-list'); return { imgs: Array.from(l.querySelectorAll('img')).filter(i => i.getAttribute('src') === 'x').length, karten: l.querySelectorAll('.sp-card').length, text: (l.textContent || '').indexOf('<img src=x') >= 0, mark: l.querySelectorAll('mark').length }; };
        try {
          switchTab('search');
          currentFilter = 'qqkat'; searchText = ''; renderList();
          await new Promise(r => setTimeout(r, 350));
          const ohne = zaehl();
          loadMoreList();
          await new Promise(r => setTimeout(r, 350));
          const seite2 = zaehl();
          currentFilter = ''; doSearch('qqliste');
          await new Promise(r => setTimeout(r, 600));
          const mit = zaehl();
          // Die Markierung sucht am ROHEN Text: „amp" darf das &amp; eines Namens nicht zerreissen.
          const amp = gsHighlight('A&B', 'amp');
          return { pwned: window.__pwned, ohne, seite2, mit, amp };
        } finally {
          neu.forEach(s => { const i = DB.indexOf(s); if (i >= 0) DB.splice(i, 1); });
          currentFilter = ''; searchText = ''; try { doSearch(''); } catch (_) {}
        }
      }, BOESE);
      if (r.pwned !== undefined) return { ok: false, warum: 'Code lief (__pwned)' };
      for (const k of ['ohne', 'seite2', 'mit']) {
        if (r[k].imgs) return { ok: false, warum: k + ': ' + r[k].imgs + ' <img> gerendert' };
        if (!r[k].karten || !r[k].text) return { ok: false, warum: k + ': der Wert steht nicht als Text da (' + JSON.stringify(r[k]) + ')' };
      }
      if (r.seite2.karten <= r.ohne.karten) return { ok: false, warum: 'Seite 2 kam nicht dazu — der Fall misst sie nicht' };
      if (!r.mit.mark) return { ok: false, warum: 'die Hervorhebung des Suchworts ist weg' };
      if (r.amp !== 'A&amp;B') return { ok: false, warum: 'die Markierung zerreisst eine Entity: ' + r.amp };
      return { ok: true, info: 'ohne Suchwort ' + r.ohne.karten + ' Karten · Seite 2 ' + r.seite2.karten + ' · mit Suchwort ' + r.mit.karten + ' (' + r.mit.mark + ' Markierungen) · 0 <img>' };
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
    // v33.54: der style-Filter war eine VERBOTSliste auf dem Rohtext
    // (url\s*\( usw.). CSS-Escapes (u\72l, \75rl, u\rl) und image-set("…")
    // laden eine fremde Adresse, ohne dass „url(" im Text steht — gefunden von der
    // gegnerischen Pruefung zu v33.53, in Chromium nachgestellt. Der Fall rendert
    // jeden Stil WIRKLICH ins Dokument und zaehlt die Anfragen, die der Browser
    // stellt. Die Gegenrichtung gehoert dazu: die Stile, die die Uebersetzungen
    // heute tragen (data-i18n-html), muessen unveraendert durchkommen.
    name: 'A10b · gsSanitizeHtml: kein style laedt eine fremde Adresse (CSS-Escapes, image-set) — und die Stile der Uebersetzungen bleiben',
    lauf: async () => {
      const BOES = [
        'background:u\\72l(https://evil.example/1.png)',
        'background:\\75rl(https://evil.example/2.png)',
        'background:u\\rl(https://evil.example/3.png)',
        'background-image:image-set("https://evil.example/4.png" 1x)',
        'border:10px solid;border-image:image-set("https://evil.example/5.png" 1x) 30 round',
        'list-style:inside u\\72l(https://evil.example/6.png)',
      ];
      const GUT = ['color:var(--c-danger)', 'display:block', 'font-size:var(--fs-sm)', 'font-weight:700',
        'margin:4px 0 4px', 'margin-bottom:4px', 'color:red', 'color:rgb(10, 20, 30)'];
      __anfragen.length = 0;
      const r = await __seite.evaluate(async ({ BOES, GUT }) => {
        const box = document.createElement('div');
        box.style.cssText = 'position:absolute;left:0;top:0;width:300px;';
        box.innerHTML = BOES.map((st, i) => gsSanitizeHtml('<div style="' + st.replace(/"/g, '&quot;') + '">b' + i + '</div>')).join('')
          + gsSanitizeHtml('<span style="position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:99999">deckt</span>')
          + GUT.map(st => gsSanitizeHtml('<span style="' + st + '">g</span>')).join('');
        document.body.appendChild(box);
        await new Promise(r => setTimeout(r, 600));
        const spans = box.querySelectorAll('span');
        const ueberlagert = getComputedStyle(spans[0]).position === 'fixed';
        const gut = GUT.map((st, i) => [st, spans[i + 1] ? spans[i + 1].getAttribute('style') : null]);
        box.remove();
        return { ueberlagert, gut };
      }, { BOES, GUT });
      const fremd = __anfragen.filter(u => /evil\.example/.test(u));
      const gutKaputt = r.gut.filter(([st, ist]) => ist !== st);
      if (fremd.length) return { ok: false, warum: fremd.length + ' Anfrage(n) an die fremde Adresse: ' + fremd.slice(0, 3).join(', ') };
      if (r.ueberlagert) return { ok: false, warum: 'ein style legt sich mit position:fixed ueber die ganze App' };
      if (gutKaputt.length) return { ok: false, warum: 'gute Stile veraendert: ' + gutKaputt.map(x => x[0] + ' → ' + x[1]).join(' · ') };
      return { ok: true, info: BOES.length + ' boese Stile, 0 Anfragen an die fremde Adresse · Ueberlagerung entfernt · ' + GUT.length + ' gute Stile unveraendert' };
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
  {
    // v33.71 (Audit „escape", jeder Fund gegengeprueft). Sieben Stellen, an
    // denen ein Wert aus fremder Hand als Code ankam oder einen Knopf zerbrach.
    name: 'Karten-Popup · die Foto-Adresse eines Fundes (map_user_finds.photo_url) wird kein Attribut: x" onerror=… bekommt kein <img> — beim EIGENEN Fund https und der lokale Platzhalter schon, beim FREMDEN nur der eigene Speicher',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        if (typeof _gsBuildFindPopup !== 'function') return { fehlt: true };
        const meta = { emoji: '🍄', color: '#2e7d32', label: 'Pilz' };
        const box = document.createElement('div'); document.body.appendChild(box);
        delete window.__pwned;
        const bau = (u, opts) => { box.innerHTML = _gsBuildFindPopup(meta, 'Steinpilz', 'am Waldrand', new Date(), u, opts); return Array.from(box.querySelectorAll('img')).map(i => ({ src: i.getAttribute('src'), on: i.getAttribute('onerror') })); };
        // Seit v33.59 (main) trennt _gsFundFoto zwei Zweige: der EIGENE Fund (ohne opts) und der
        // FREMDE ({fremd:true}) — dort zaehlt nur der eigene Speicher (_gsFremdBild).
        try {
          const boese = bau('x" onerror="window.__pwned=1');
          await new Promise(res => setTimeout(res, 350));          // onerror feuert erst, wenn das Bild fehlschlaegt
          const pw = window.__pwned;
          const js = bau('javascript:window.__pwned=2');
          const https = bau('https://bilder.example/fund.jpg?a=1&b=2');
          const lokal = bau('gsphoto://7');
          const text = box.textContent;
          const eigen = String(SB_URL_DEFAULT).replace(/\/+$/, '') + '/storage/v1/object/public/map-find-photos/u1/f.jpg';
          const fremd = { boese: bau('x" onerror="window.__pwned=3', { fremd: true }), https: bau('https://bilder.example/fund.jpg', { fremd: true }), eigen: bau(eigen, { fremd: true }), eigenUrl: eigen };
          await new Promise(res => setTimeout(res, 350));
          return { boese, pw: pw !== undefined ? pw : window.__pwned, js, https, lokal, fremd, name: /Steinpilz/.test(text) };
        } finally { box.remove(); delete window.__pwned; }
      });
      if (r.fehlt) return { ok: false, warum: '_gsBuildFindPopup fehlt' };
      if (r.pw !== undefined) return { ok: false, warum: 'Code lief: window.__pwned = ' + r.pw + ' (die Adresse wurde zu einem onerror-Attribut: ' + JSON.stringify(r.boese) + ')' };
      if (r.boese.some(i => i.on)) return { ok: false, warum: 'das <img> traegt ein onerror-Attribut: ' + JSON.stringify(r.boese) };
      if (r.boese.length || r.js.length) return { ok: false, warum: 'eine verworfene Adresse bekam trotzdem ein <img>: ' + JSON.stringify(r.boese.concat(r.js)) };
      if (r.https.length !== 1 || r.https[0].src !== 'https://bilder.example/fund.jpg?a=1&b=2') return { ok: false, warum: 'https-Foto fehlt oder ist veraendert: ' + JSON.stringify(r.https) };
      if (r.lokal.length !== 1) return { ok: false, warum: 'der lokale Platzhalter gsphoto://7 bekam kein <img> — eigene Fotos waeren weg' };
      if (!r.name) return { ok: false, warum: 'der Name steht nicht mehr im Popup' };
      if (r.fremd.boese.length || r.fremd.https.length) return { ok: false, warum: 'ein FREMDER Fund zeigt eine Adresse ausserhalb des eigenen Speichers: ' + JSON.stringify(r.fremd.boese.concat(r.fremd.https)) };
      if (r.fremd.eigen.length !== 1 || r.fremd.eigen[0].src !== r.fremd.eigenUrl) return { ok: false, warum: 'ein FREMDER Fund mit einem Foto aus dem eigenen Speicher bekommt kein <img>: ' + JSON.stringify(r.fremd.eigen) };
      return { ok: true, info: 'eigener Fund: x" onerror=… und javascript: → kein <img>, https exakt, gsphoto://7 bleibt · fremder Fund: nur der eigene Speicher, https und x" → kein <img> · nichts lief' };
    },
  },
  {
    name: 'Marktplatz-Detail · die Foto-Adressen eines FREMDEN Inserats stehen in keinem onclick: &#39;-Ausbruch laeuft nicht, ein Tipp aufs Vorschaubild setzt genau dessen Adresse, javascript: bekommt keines',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        if (typeof gsMarketShowDetail !== 'function') return { fehlt: true };
        delete window.__pwned;
        // Seit v33.59 nimmt das Inserat nur Bilder aus dem EIGENEN Speicher (_gsFremdBild):
        // eine fremde Adresse bekommt so wenig ein Vorschaubild wie javascript:.
        const eigen = String(SB_URL_DEFAULT).replace(/\/+$/, '') + '/storage/v1/object/public/market-images/u-fremd/';
        const l = { id: 'l-esc', title: 'Tomaten', description: 'frisch', price: 5, currency: 'CHF', cat: 'produkte', seller: 'Anna', sellerId: 'u-fremd',
          images: [eigen + '1.jpg', eigen + "2.jpg?x=&#39;;window.__pwned=1;//", 'javascript:window.__pwned=3', 'https://a.example/fremd.jpg', eigen + '4.jpg?a=1&b=2', eigen + '5.jpg'] };
        try {
          gsMarketShowDetail(l);
          await new Promise(res => setTimeout(res, 250));
          const haupt = document.getElementById('mklist-main-img');
          if (!haupt) return { keinBild: true };
          const daumen = Array.from(haupt.parentElement.querySelectorAll('img')).filter(i => i !== haupt);
          const klicks = [];
          for (const d of daumen) {
            let fehler = null;
            try { new Function(d.getAttribute('onclick') || ''); } catch (e) { fehler = 'Parser: ' + e.message; }
            try { d.click(); } catch (e) { fehler = fehler || String(e.message); }
            klicks.push({ soll: d.getAttribute('src'), ist: haupt.getAttribute('src'), gleich: haupt.src === d.src, fehler, on: d.getAttribute('onclick') });
          }
          return { n: daumen.length, klicks, pw: window.__pwned, fremd: daumen.some(d => /a\.example|javascript:/.test(d.getAttribute('src') || '')) };
        } finally { try { closeModal('detail-modal'); } catch (_) {} delete window.__pwned; }
      });
      if (r.fehlt) return { ok: false, warum: 'gsMarketShowDetail fehlt' };
      if (r.keinBild) return { ok: false, warum: 'kein #mklist-main-img — der Fall stellt seinen Zustand nicht her' };
      if (r.pw !== undefined) return { ok: false, warum: 'Code lief beim Antippen eines Vorschaubilds: window.__pwned = ' + r.pw };
      const mitWert = r.klicks.filter(k => /https?:|javascript:/.test(k.on || ''));
      if (mitWert.length) return { ok: false, warum: mitWert.length + ' Vorschaubild(er) tragen die Adresse im onclick: ' + String(mitWert[0].on).slice(0, 110) };
      const kaputt = r.klicks.filter(k => k.fehler || !k.gleich);
      if (kaputt.length) return { ok: false, warum: 'ein Tipp setzt nicht die Adresse des Vorschaubilds: ' + JSON.stringify(kaputt[0]).slice(0, 220) };
      if (r.fremd) return { ok: false, warum: 'ein Vorschaubild zeigt eine fremde Adresse oder javascript:' };
      // Vier aus dem eigenen Speicher (1, 2 mit dem &#39;-Wert, 4, 5) — der &#39;-Wert ist dort
      // eine harmlose Zeichenkette im src, solange er in keinem onclick steht.
      if (r.n !== 4) return { ok: false, warum: r.n + ' Vorschaubilder statt 4 (eigener Speicher: 1, 2, 4, 5 — javascript: und der fremde Host bekommen keines)' };
      return { ok: true, info: '4 Vorschaubilder aus dem eigenen Speicher (javascript: und fremder Host: keines) · jedes setzt per this.src genau seine Adresse, auch die mit &#39; · kein Wert im onclick · nichts lief' };
    },
  },
  {
    name: '_gsOcArg · der alte Helfer IST _gsOcStr: &#39; im Wert, einsames \\r und \\r\\n kommen exakt an (vorher: Parser-Fehler oder Ausbruch) — und jeder Aufrufer bekommt denselben',
    lauf: async () => __seite.evaluate(() => {
      if (typeof _gsOcArg !== 'function' || typeof _gsOcStr !== 'function') return { ok: false, warum: '_gsOcArg/_gsOcStr fehlt' };
      const werte = ['5 &#39; lang', "x');window.__pwned=1;//", 'cr\rmitte', 'crlf\r\nende', 'sep zeile', "O'Brien & Söhne"];
      const box = document.createElement('div'); document.body.appendChild(box);
      const got = []; window.__cap = (v) => got.push(v); delete window.__pwned;
      try {
        const klagen = [];
        werte.forEach((v) => {
          box.innerHTML = '<button onclick="window.__cap(\'' + _gsOcArg(v) + '\')"></button>';
          const b = box.querySelector('button'); const vorher = got.length;
          try { new Function(b.getAttribute('onclick')); b.click(); } catch (e) { klagen.push(JSON.stringify(v) + ' → Parser-Fehler'); return; }
          if (got.length === vorher || got[got.length - 1] !== v) klagen.push(JSON.stringify(v) + ' → ' + JSON.stringify(got[got.length - 1]));
        });
        if (window.__pwned !== undefined) klagen.unshift('Code lief (window.__pwned = ' + window.__pwned + ')');
        if (klagen.length) return { ok: false, warum: klagen.slice(0, 4).join(' · ') };
        if (_gsOcArg !== _gsOcStr) return { ok: false, warum: '_gsOcArg ist eine EIGENE Funktion — zwei Helfer fuer einen Kontext laufen auseinander' };
        return { ok: true, info: werte.length + ' Werte exakt zurueck (auch &#39;, \\r, \\r\\n, U+2028) · _gsOcArg === _gsOcStr' };
      } finally { box.remove(); delete window.__cap; delete window.__pwned; }
    }),
  },
  {
    name: 'Garten-Scan · das Detail einer Pflanze zeigt KI-Felder als TEXT: Name, lat. Name, Begruendung und jede Tabellenzeile — kein Tag aus der Antwort wird ein Element',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        if (typeof gsGardenScanShowPlant !== 'function') return { fehlt: true };
        const alt = window._gsGardenScan; delete window.__pwned;
        const boese = '<img src=x onerror="window.__pwned=1">';
        window._gsGardenScan = { plan_id: 'p-esc', analysis: { recommended_plants: [{
          name: boese + 'Tomate', lat: 'Solanum <b>lyco</b>', reason: 'sonnig ' + boese, category: '<i>gemuese</i>', qty: 2,
          sow_date: '<u>April</u>', companion_plants: ['<s>Basilikum</s>'], incompatible_plants: ['Kartoffel'], care_intensity: 'mittel' }] } };
        try {
          gsGardenScanShowPlant(0);
          await new Promise(res => setTimeout(res, 400));
          const mc = document.getElementById('modal-content');
          const t = mc ? mc.textContent : '';
          const erst = { da: !!mc, pw: window.__pwned, fremd: mc ? mc.querySelectorAll('img, b, i, u, s').length : -1,
            em: mc ? mc.querySelectorAll('em').length : -1,
            text: /<img src=x onerror=/.test(t) && /Solanum <b>lyco<\/b>/.test(t) && /<u>April<\/u>/.test(t) && /<s>Basilikum<\/s>/.test(t) };
          // Die KI liefert das Feld auch als TEXT statt als Liste (das Schema verlangt eine Liste,
          // halten tut es niemand): das Fenster muss trotzdem aufgehen (main hatte [].concat;
          // beim Aufloesen des Merges verloren und wiederhergestellt, Gegenlesen 24.11.2026).
          try { if (typeof gsGardenScanCloseDetail === 'function') gsGardenScanCloseDetail(); } catch (_) {}
          window._gsGardenScan.analysis.recommended_plants[0].incompatible_plants = 'Kartoffel, Fenchel';
          window._gsGardenScan.analysis.recommended_plants[0].companion_plants = 'Basilikum';
          let fehler = null;
          try { gsGardenScanShowPlant(0); } catch (e) { fehler = e.message; }
          await new Promise(res => setTimeout(res, 300));
          const mc2 = document.getElementById('modal-content');
          erst.textFeld = { fehler, ok: !!mc2 && /Kartoffel, Fenchel/.test(mc2.textContent) && /Basilikum/.test(mc2.textContent) };
          return erst;
        } finally { window._gsGardenScan = alt; try { if (typeof gsGardenScanCloseDetail === 'function') gsGardenScanCloseDetail(); } catch (_) {} try { closeModal('detail-modal'); } catch (_) {} delete window.__pwned; }
      });
      if (r.fehlt) return { ok: false, warum: 'gsGardenScanShowPlant fehlt' };
      if (!r.da) return { ok: false, warum: 'kein #modal-content' };
      if (r.pw !== undefined) return { ok: false, warum: 'Code lief (window.__pwned = ' + r.pw + ')' };
      if (r.fremd) return { ok: false, warum: r.fremd + ' Element(e) aus der KI-Antwort im Dokument (img/b/i/u/s)' };
      if (!r.text) return { ok: false, warum: 'die Werte stehen nicht als sichtbarer Text da — ein Escaper, der den Text verschluckt, waere auch „sicher"' };
      if (r.em !== 1) return { ok: false, warum: 'der lateinische Name steht nicht mehr kursiv da (' + r.em + ' <em>)' };
      if (!r.textFeld || !r.textFeld.ok) return { ok: false, warum: 'ein KI-Feld als TEXT statt Liste: das Fenster zeigt es nicht (' + JSON.stringify(r.textFeld) + ')' };
      return { ok: true, info: 'fuenf Felder mit Tags → 0 fremde Elemente, alles als Text sichtbar · lat. Name weiter kursiv (das <em> setzt die Ausgabe) · ein Feld als Text statt Liste: Fenster geht auf' };
    },
  },
  {
    name: 'Rezept-Detail · Foto-Adressen stehen in keinem onclick: ein Apostroph im Dateinamen macht das Foto nicht tot, javascript: bekommt kein Bild, ein Tipp oeffnet genau die Adresse',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        if (typeof openRecipeDetail !== 'function' || typeof recipesData === 'undefined' || !recipesData.length) return { fehlt: true };
        const rez = recipesData[0]; const alt = rez.photo_urls; const echtAnsicht = window.gsFotoAnsicht; const echtOpen = window.open; const auf = []; delete window.__pwned;
        rez.photo_urls = ["https://a.example/l'ete.jpg", "https://a.example/x.jpg?');window.__pwned=1;//", 'javascript:window.__pwned=2', 'https://a.example/ok.jpg'];
        // Seit v33.60 oeffnet ein Tipp die Ansicht IN der App (gsFotoAnsicht(this.src)); ein
        // window.open waere der alte Weg — er zaehlt mit, damit ein Rueckfall auffiele.
        window.gsFotoAnsicht = function (u) { auf.push(String(u)); return true; };
        window.open = function (u) { auf.push('window.open:' + String(u)); return null; };
        try {
          openRecipeDetail(rez.id);
          await new Promise(res => setTimeout(res, 300));
          const imgs = Array.from(document.querySelectorAll('#modal-recipe-detail img, #detail-modal img, .modal-overlay.open img')).filter(i => /a\.example|javascript:/.test(i.getAttribute('src') || ''));
          const klagen = [];
          imgs.forEach(i => { try { new Function(i.getAttribute('onclick') || ''); i.click(); } catch (e) { klagen.push((i.getAttribute('src') || '').slice(0, 40) + ' → ' + e.message); } });
          return { n: imgs.length, srcs: imgs.map(i => i.src), auf, klagen, pw: window.__pwned, on: imgs.map(i => i.getAttribute('onclick')) };
        } finally { rez.photo_urls = alt; window.gsFotoAnsicht = echtAnsicht; window.open = echtOpen; try { closeModal('modal-recipe-detail'); } catch (_) {} delete window.__pwned; }
      });
      if (r.fehlt) return { ok: false, warum: 'openRecipeDetail/recipesData fehlt' };
      if (r.pw !== undefined) return { ok: false, warum: 'Code lief (window.__pwned = ' + r.pw + ')' };
      if (r.klagen.length) return { ok: false, warum: 'ein Foto ist tot: ' + r.klagen[0] };
      if (r.n !== 3) return { ok: false, warum: r.n + ' Fotos statt 3 (javascript: darf keines bekommen)' };
      if (r.on.some(o => /a\.example/.test(o || ''))) return { ok: false, warum: 'die Adresse steht im onclick: ' + String(r.on.find(o => /a\.example/.test(o || ''))).slice(0, 100) };
      if (r.auf.length !== 3 || r.auf.some((u, i) => u !== r.srcs[i])) return { ok: false, warum: 'ein Tipp oeffnet nicht die Adresse des Fotos: ' + JSON.stringify(r.auf).slice(0, 200) };
      return { ok: true, info: '3 Fotos (javascript: keines) · Apostroph im Dateinamen: Foto lebt · jeder Tipp oeffnet die Ansicht mit genau seiner Adresse · nichts lief' };
    },
  },
  {
    name: 'Diagnose-Kamera · die Pflanzenauswahl zeigt Name und Spitzname als TEXT — ein < verschluckt nichts, und der gewaehlte Wert ist weiter die id',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        if (typeof openDiagnosisCamera !== 'function') return { fehlt: true };
        const mp0 = JSON.stringify(myPlants);
        const echtGUM = navigator.mediaDevices && navigator.mediaDevices.getUserMedia;
        try { if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => { throw new Error('keine Kamera im Pruefstand'); }; } catch (_) {}
        try {
          myPlants = [{ id: 'esc-1', name: 'R&D <3', nick: 'Fenster <links>', tasks: {} }, { id: 'esc-2', name: 'Tomate', nick: '', tasks: {} }];
          try { openDiagnosisCamera(); } catch (_) {}
          await new Promise(res => setTimeout(res, 300));
          const sel = document.getElementById('diag-plant-sel');
          if (!sel) return { keinSel: true };
          const opts = Array.from(sel.querySelectorAll('option'));
          return { texte: opts.map(o => o.textContent), werte: opts.map(o => o.value), fremd: Array.from(sel.querySelectorAll('*')).filter(e => e.tagName !== 'OPTION').length };
        } finally {
          try { myPlants = JSON.parse(mp0); } catch (_) {}
          try { if (echtGUM) navigator.mediaDevices.getUserMedia = echtGUM; } catch (_) {}
          try { if (typeof closeDiagnosisCamera === 'function') closeDiagnosisCamera(); } catch (_) {}
          document.querySelectorAll('.modal-overlay.open').forEach(m => { try { closeModal(m.id); } catch (_) {} });
        }
      });
      if (r.fehlt) return { ok: false, warum: 'openDiagnosisCamera fehlt' };
      if (r.keinSel) return { ok: false, warum: 'kein #diag-plant-sel — der Fall stellt seinen Zustand nicht her' };
      if (r.fremd) return { ok: false, warum: r.fremd + ' fremde(s) Element(e) in der Auswahl' };
      if (r.texte[1] !== 'R&D <3 – Fenster <links>') return { ok: false, warum: 'Option 1 heisst „' + r.texte[1] + '" statt „R&D <3 – Fenster <links>"' };
      if (r.werte[1] !== 'esc-1' || r.werte[2] !== 'esc-2') return { ok: false, warum: 'die Werte sind nicht mehr die ids: ' + JSON.stringify(r.werte) };
      return { ok: true, info: '„R&D <3 – Fenster <links>" steht woertlich da · Werte bleiben die ids · kein fremdes Element' };
    },
  },
  {
    name: 'Registrierung · eine Adresse mit Apostroph (o\'neil@…) zerbricht den Knopf „Zur Anmeldung" nicht und steht als Text da',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        if (typeof profileDoRegister !== 'function') return { fehlt: true };
        const adresse = "o'neil@example.ch";
        const neu = []; const mach = (tag, id, wert, typ) => { let el = document.getElementById(id); if (!el) { el = document.createElement(tag); el.id = id; if (typ) el.type = typ; document.body.appendChild(el); neu.push(el); } if (wert != null) el.value = wert; return el; };
        const e2 = mach('input', 'prof-email2', adresse, 'text'), p2 = mach('input', 'prof-pw2', 'geheim-geheim-1', 'password'), p2b = mach('input', 'prof-pw2b', 'geheim-geheim-1', 'password');
        const ziel = mach('input', 'prof-email', '', 'text');
        let mc = document.getElementById('profile-modal-content'); if (!mc) { mc = document.createElement('div'); mc.id = 'profile-modal-content'; document.body.appendChild(mc); neu.push(mc); }
        const mc0 = mc.innerHTML;
        const echtReg = window.sbRegister, echtTab = window.profSwitchTab;
        window.sbRegister = async function () { return { ok: true, user: { id: 'u-neu' } }; };   // ohne access_token: Bestaetigungs-Mail noetig
        window.profSwitchTab = function () {};
        try {
          await profileDoRegister();
          await new Promise(res => setTimeout(res, 200));
          const knopf = Array.from(mc.querySelectorAll('button')).find(b => /prof-email/.test(b.getAttribute('onclick') || ''));
          if (!knopf) return { keinKnopf: true, html: mc.textContent.slice(0, 120) };
          let parser = null; try { new Function(knopf.getAttribute('onclick')); } catch (e) { parser = e.message; }
          try { knopf.click(); } catch (_) {}
          const z = document.getElementById('prof-email');
          return { parser, wert: z ? z.value : null, text: mc.textContent.indexOf(adresse) >= 0, strong: mc.querySelectorAll('strong *').length };
        } finally {
          window.sbRegister = echtReg; window.profSwitchTab = echtTab; mc.innerHTML = mc0;
          neu.forEach(el => { try { el.remove(); } catch (_) {} });
        }
      });
      if (r.fehlt) return { ok: false, warum: 'profileDoRegister fehlt' };
      if (r.keinKnopf) return { ok: false, warum: 'der Hinweisbildschirm kam nicht — der Fall stellt seinen Zustand nicht her („' + r.html + '")' };
      if (r.parser) return { ok: false, warum: 'der Knopf „Zur Anmeldung" ist tot: ' + r.parser };
      if (r.wert !== "o'neil@example.ch") return { ok: false, warum: 'das Anmeldefeld bekommt „' + r.wert + '" statt der Adresse' };
      if (!r.text) return { ok: false, warum: 'die Adresse steht nicht als Text auf dem Bildschirm' };
      return { ok: true, info: "o'neil@example.ch → Knopf parst, Feld bekommt genau die Adresse, Anzeige als Text" };
    },
  },
  {
    // v33.60 · gemessen am 11.11.2026: openPlantDiary setzte den Titel eines Eintrags roh ins
    // innerHTML und die Foto-Adresse roh ins src-Attribut. Beide kommen aus `p.diary` — also aus
    // dem gesyncten Blob oder aus einem eingespielten Backup, nicht nur aus dieser App. Ein Titel
    // mit einem Tag lief als Code, eine Adresse mit einem Anfuehrungszeichen brach aus dem Attribut
    // aus. Geprueft wird die WIRKUNG (window.__pwned bleibt unberuehrt) UND dass der Wert dasteht —
    // ein Leser, der den Titel verschluckt, waere auch „sicher".
    name: 'Pflanzentagebuch · ein Titel mit <img onerror> steht als Text, eine Foto-Adresse mit Anführungszeichen bricht nicht aus dem Attribut aus, javascript: bekommt kein <img> — https und data:image schon',
    lauf: async () => {
      const r = await __seite.evaluate(async () => {
        const p = (myPlants || []).find(x => x && x.id === 'p2');
        if (!p) return { fehlt: 'p2' };
        const alt = p.diary;
        const t0 = Date.now();
        delete window.__pwned;
        p.diary = [
          { ts: t0 - 1000, action: 'note', title: 'Titel <img src=x onerror="window.__pwned=\'titel\'">', note: 'eins' },
          { ts: t0 - 2000, action: 'photo', title: 'Foto A', photo: 'x" onerror="window.__pwned=\'foto\'' },
          { ts: t0 - 3000, action: 'photo', title: 'Foto B', photo: 'javascript:window.__pwned=\'js\'' },
          { ts: t0 - 4000, action: 'photo', title: 'Foto C', photo: 'https://bilder.example/c.jpg' },
          { ts: t0 - 5000, action: 'photo', title: 'Foto D', photo: 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=' },
        ];
        try {
          openPlantDiary('p2');
          await new Promise(r => setTimeout(r, 450));       // ein fehlschlagendes Bild braucht Zeit fuer onerror
          const m = document.getElementById('plant-diary-modal');
          if (!m) return { fehlt: 'modal' };
          // ohne die Vorschau des Erfassungs-Formulars (#diary-photo-img) — die traegt kein Foto eines Eintrags
          const imgs = Array.from(m.querySelectorAll('img:not(#diary-photo-img)'));
          return {
            pwned: window.__pwned === undefined ? null : String(window.__pwned),
            text: m.textContent.indexOf('Titel <img src=x onerror=') >= 0,
            srcs: imgs.map(i => i.getAttribute('src')),
            attr: imgs.filter(i => i.hasAttribute('onerror')).length,
            klick: imgs.map(i => i.getAttribute('onclick') || ''),
            namen: ['Foto A', 'Foto B', 'Foto C', 'Foto D'].filter(n => m.textContent.indexOf(n) >= 0).length,
          };
        } finally {
          p.diary = alt;
          const m2 = document.getElementById('plant-diary-modal'); if (m2) m2.remove();
          delete window.__pwned;
        }
      });
      if (r.fehlt) return { ok: false, warum: 'Fall nicht hergestellt: ' + r.fehlt + ' fehlt' };
      const klagen = [];
      if (r.pwned !== null) klagen.push('Code lief (window.__pwned = „' + r.pwned + '")');
      if (!r.text) klagen.push('der Titel steht nicht als sichtbarer Text da');
      if (r.attr) klagen.push(r.attr + ' Bild(er) tragen ein onerror-Attribut — die Adresse brach aus dem src aus');
      if (r.namen !== 4) klagen.push('nur ' + r.namen + ' von 4 Einträgen stehen da');
      const erwartet = ['https://bilder.example/c.jpg', 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA='];
      if (JSON.stringify(r.srcs) !== JSON.stringify(erwartet)) klagen.push('Bilder: ' + JSON.stringify(r.srcs) + ' statt genau https und data:image');
      if (r.klick.some(k => k !== 'gsFotoAnsicht(this.src)')) klagen.push('ein Foto öffnet nicht über gsFotoAnsicht(this.src): ' + JSON.stringify(r.klick));
      if (klagen.length) return { ok: false, warum: klagen.join(' · ') };
      return { ok: true, info: 'Titel als Text · 2 Bilder (https, data:image) · javascript: und die Adresse mit Anführungszeichen ohne <img> · kein Code lief' };
    },
  },
  {
    // Gemessen am 11.11.2026: die Adresse eines Rezeptfotos stand nur mit
    // gsHTMLEscape in einem JS-String im onclick (`window.open('<adresse>','_blank')`)
    // — der Wert durchlaeuft ZWEI Parser, ein `'` beendet den String (v32.66).
    // Seither bekommt das Vorschaubild nur `gsFotoAnsicht(this.src)`, und die
    // Ansicht laedt keine Adresse, die `_gsFotoAdresse` nicht kennt.
    name: 'Foto-Ansicht · eine Adresse mit Apostroph laeuft nicht als Code, javascript:/data:text/fremdes blob: oeffnen nichts, https · data:image · eigenes blob: oeffnen genau EIN Bild',
    lauf: async () => {
      const anfragenVor = __anfragen.length;
      const r = await __seite.evaluate(async () => {
        const warte = (ms) => new Promise(r => setTimeout(r, ms));
        const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAGCAIAAABxZ0isAAAAEUlEQVR4nGPQqzXCihgGUgIAJFopcWysNWAAAAAASUVORK5CYII=';
        const KNACK = "https://bilder.example/a.jpg');window.__pwned=1;('";
        const out = { pwned0: window.__pwned };
        const rz = recipesData[0]; const vorher = rz.photo_urls;
        const echtOpen = window.open; let hinaus = 0; window.open = function () { hinaus++; return null; };
        const ansicht = () => document.getElementById('gs-foto-ansicht');
        const weg = async () => { const a = ansicht(); if (a) { try { gsDismissOverlay(a); } catch (_) { a.remove(); } } await warte(60); };
        try {
          // 1 · das Rezept: drei Adressen aus fremder Hand
          rz.photo_urls = ['https://bilder.example/gut.jpg', 'javascript:window.__pwned=1', KNACK];
          openRecipeDetail(rz.id);
          await warte(400);
          const imgs = Array.from(document.querySelectorAll('#recipe-detail-body img'));
          out.srcs = imgs.map(i => i.getAttribute('src'));
          out.fremdeAttribute = imgs.filter(i => Array.from(i.attributes).some(a => /^on(error|load|mouse)/.test(a.name))).length;
          for (const i of imgs) { try { i.click(); } catch (e) { out.klickFehler = e.message; } await warte(120); await weg(); }
          out.pwnedNachKlick = window.__pwned;
          out.hinaus = hinaus;
          // 2 · die Ansicht selbst
          out.hatFunktion = typeof gsFotoAnsicht === 'function';
          const probe = async (u) => {
            let rueck = null;
            try { rueck = gsFotoAnsicht(u); } catch (e) { rueck = 'FEHLER ' + e.message; }
            await warte(120);
            const a = ansicht();
            // Ein Bild, das nicht laedt (hier ist das Netz gekappt), wird durch einen
            // Satz ersetzt — auch das ist „genau ein Inhalt", nur kein <img>.
            const erg = { rueck: rueck, offen: !!a, bilder: a ? a.querySelectorAll('img').length : 0,
              src: a && a.querySelector('img') ? a.querySelector('img').getAttribute('src') : null,
              satz: a && a.querySelector('[role="status"]') ? a.querySelector('[role="status"]').textContent : null,
              kinder: a ? a.querySelectorAll('*').length : 0,
              skripte: a ? a.querySelectorAll('script, iframe, [onerror], [onload]').length : 0 };
            await weg();
            return erg;
          };
          const blobUrl = URL.createObjectURL(new Blob([Uint8Array.from(atob(PNG.split(',')[1]), c => c.charCodeAt(0))], { type: 'image/png' }));
          out.boese = {};
          const BOESE_ADRESSEN = ['javascript:window.__pwned=1', 'JaVaScRiPt:window.__pwned=1', 'data:text/html,<script>window.__pwned=1<\/script>',
            'vbscript:x', '//evil.example/x.png', 'blob:https://evil.example/00000000-0000-0000-0000-000000000000',
            'file:///etc/passwd', 'gsphoto://7', '', null];
          for (const u of BOESE_ADRESSEN) out.boese[String(u)] = out.hatFunktion ? await probe(u) : null;
          out.gut = {};
          out.gut.https = out.hatFunktion ? await probe('https://bilder.example/x.jpg"><img src=x onerror="window.__pwned=1">') : null;
          out.gut.data = out.hatFunktion ? await probe(PNG) : null;
          out.gut.blob = out.hatFunktion ? await probe(blobUrl) : null;
          out.blobUrl = blobUrl; out.PNG = PNG;
          out.pwned = window.__pwned;
          out.imgX = document.querySelectorAll('img[src="x"]').length;
        } finally {
          window.open = echtOpen; rz.photo_urls = vorher;
          await weg();
          try { closeModal('modal-recipe-detail'); } catch (_) {}
          await warte(250);
        }
        return out;
      });
      const neu = __anfragen.slice(anfragenVor);
      const boeseAnfragen = neu.filter(u => /evil\.example|etc\/passwd/.test(u));
      if (r.pwned0 !== undefined) return { ok: false, warum: '__pwned war schon vor dem Fall gesetzt — der Fall misst nichts' };
      if (r.pwnedNachKlick !== undefined) return { ok: false, warum: 'Code lief beim Antippen eines Rezeptfotos (die Adresse mit Apostroph brach aus dem onclick aus) — ' + r.hinaus + '× window.open' };
      if (r.hinaus) return { ok: false, warum: r.hinaus + '× window.open beim Antippen der Rezeptfotos — das Foto verlaesst die App' };
      if (r.fremdeAttribute) return { ok: false, warum: r.fremdeAttribute + ' Vorschaubild(er) mit eingeschleustem on*-Attribut' };
      if (!r.srcs || r.srcs.length !== 2 || r.srcs.some(s => /^javascript:/i.test(s))) return { ok: false, warum: 'Vorschaubilder im Rezept: ' + JSON.stringify(r.srcs) + ' (erwartet zwei https-Bilder, keines mit javascript:)' };
      if (!r.hatFunktion) return { ok: false, warum: 'gsFotoAnsicht fehlt' };
      const durch = Object.keys(r.boese).filter(k => r.boese[k].offen || r.boese[k].rueck !== false);
      if (durch.length) return { ok: false, warum: durch.length + ' von ' + Object.keys(r.boese).length + ' unerlaubten Adressen oeffneten die Ansicht: ' + durch.map(k => JSON.stringify(k) + ' → ' + JSON.stringify(r.boese[k])).join(' · ') };
      if (boeseAnfragen.length) return { ok: false, warum: 'eine abgewiesene Adresse wurde trotzdem angefragt: ' + boeseAnfragen.slice(0, 2).join(', ') };
      const g = r.gut;
      const schlecht = [];
      // https: hier ist das Netz gekappt — die Ansicht fragt die Adresse GENAU EINMAL an
      // (das Markup darin prozent-kodiert, nicht als Markup) und zeigt dann den Satz.
      const httpsAnfragen = neu.filter(u => /^https:\/\/bilder\.example\/x\.jpg/.test(u));
      if (!(g.https.rueck === true && g.https.offen && g.https.skripte === 0 && g.https.bilder + (g.https.satz ? 1 : 0) === 1
            && httpsAnfragen.length === 1 && /%22%3E%3Cimg/.test(httpsAnfragen[0]) && !/[<>"]/.test(httpsAnfragen[0])))
        schlecht.push('https: ' + JSON.stringify(g.https) + ' · Anfragen ' + JSON.stringify(httpsAnfragen));
      if (!(g.data.rueck === true && g.data.offen && g.data.bilder === 1 && g.data.src === r.PNG)) schlecht.push('data:image: ' + JSON.stringify(g.data).slice(0, 120));
      if (!(g.blob.rueck === true && g.blob.offen && g.blob.bilder === 1 && g.blob.src === r.blobUrl)) schlecht.push('eigenes blob: ' + JSON.stringify(g.blob));
      if (schlecht.length) return { ok: false, warum: 'eine ERLAUBTE Adresse oeffnet die Ansicht nicht mit genau einem Bild: ' + schlecht.join(' · ') };
      if (r.pwned !== undefined || r.imgX) return { ok: false, warum: 'Code lief oder ein <img src=x> entstand: ' + JSON.stringify({ pwned: r.pwned, imgX: r.imgX }) };
      return { ok: true, info: 'Rezept: 2 Bilder (javascript: ohne <img>), Apostroph-Adresse angetippt → nichts lief, 0× window.open · ' + Object.keys(r.boese).length + ' unerlaubte Adressen: keine Ansicht, 0 Anfragen · https (mit Markup in der Adresse: 1 Anfrage, prozent-kodiert, dann der Satz „' + (g.https.satz || 'Bild') + '") · data:image · eigenes blob: je genau 1 Bild' };
    },
  },
];

var __anfragen = [];
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage(); __seite = p;
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  // v33.54: jede Anfrage, die die Seite STELLT (auch die abgebrochenen) —
  // ein style, der eine fremde Adresse laedt, faellt hier auf, nicht erst im Netz.
  p.on('request', rq => { __anfragen.push(rq.url()); });
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
