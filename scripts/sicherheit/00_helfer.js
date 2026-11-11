// Die fuenf Helfer aus v33.59 — je Helfer beide Richtungen, gemessen an der WIRKUNG:
// der Wert wird wirklich in ein Element gerendert und (bei on*-Attributen) geklickt.
'use strict';
module.exports = [
  {
    name: 'Helfer · _gsEmoji: ein Emoji bleibt, Auszeichnung und Anfuehrungszeichen werden zum Rueckfall',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        const gut = ['🌿', '🍅', '👨‍👩‍👧‍👦', '1️⃣', '🇨🇭'];
        const schlecht = [boese, '"onmouseover="x', "'", '<b>', 'a b', 'javascript:x', '🌿🌿🌿🌿🌿🌿🌿🌿🌿', '', null, undefined, {}, '&lt;'];
        const d = document.createElement('div'); document.body.appendChild(d);
        d.innerHTML = schlecht.map(x => '<i title="' + _gsEmoji(x, '🌱') + '">' + _gsEmoji(x, '🌱') + '</i>').join('');
        const out = { gut: gut.map(x => _gsEmoji(x, '🌱') === x), schlecht: Array.from(d.querySelectorAll('i')).map(i => i.textContent + '|' + i.getAttribute('title')), kinder: d.querySelectorAll('i *').length, attrs: Array.from(d.querySelectorAll('i')).filter(i => i.attributes.length !== 1).length };
        d.remove(); return out;
      }, h.BOESE);
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.gut.some(x => !x)) return { ok: false, warum: 'ein echtes Emoji wurde verworfen: ' + JSON.stringify(r.gut) };
      if (r.kinder || r.attrs) return { ok: false, warum: 'Auszeichnung oder Zusatz-Attribut entstanden: ' + JSON.stringify(r) };
      const falsch = r.schlecht.filter(x => x !== '🌱|🌱' && x !== '[object Object]|[object Object]');
      if (falsch.length) return { ok: false, warum: 'kein Rueckfall bei: ' + JSON.stringify(falsch) };
      return { ok: true, info: '5 Emojis bleiben · 12 unbrauchbare Werte → Rueckfall · 0 Elemente, 0 Zusatz-Attribute' };
    },
  },
  {
    name: 'Helfer · _gsOcJson: jeder Wert kommt nach ZWEI Parsern unveraendert in der Funktion an — und die alte Bauform bricht (Gegenprobe)',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(() => {
        const werte = ["a'b", 'a"b', 'a\\b', 'a&quot;);window.__pwned=1;(&quot;', 'a&#39;b', '</div><img src=x onerror=window.__pwned=1>', 'zeile\n2', { n: 'x"y', l: [1, "'"] }, 42, null, 'a&amp;b'];
        const d = document.createElement('div'); document.body.appendChild(d);
        window.__got = [];
        window.__nimm = function (v) { window.__got.push(v); };
        d.innerHTML = werte.map(w => '<button onclick="__nimm(' + _gsOcJson(w) + ')">x</button>').join('');
        Array.from(d.querySelectorAll('button')).forEach(b => b.click());
        const gleich = werte.map((w, i) => JSON.stringify(window.__got[i]) === JSON.stringify(w));
        // Gegenprobe: die alte Bauform mit demselben feindlichen Wert
        let altBricht = false;
        const alt = 'a&quot;);window.__pwned2=1;(&quot;';
        d.innerHTML = '<button onclick="__nimm(' + JSON.stringify(alt).replace(/"/g, '&quot;') + ')">x</button>';
        try { d.querySelector('button').click(); } catch (e) {}
        altBricht = window.__pwned2 === 1; delete window.__pwned2;
        d.remove(); delete window.__got; delete window.__nimm;
        return { gleich, altBricht, n: werte.length };
      });
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.gleich.some(x => !x)) return { ok: false, warum: 'Wert kam veraendert an: ' + JSON.stringify(r.gleich) };
      if (!r.altBricht) return { ok: false, warum: 'Gegenprobe misst nichts: die alte Bauform fuehrt den Wert NICHT aus' };
      return { ok: true, info: r.n + ' Werte unveraendert angekommen · alte Bauform fuehrt denselben Wert aus (Gegenprobe)' };
    },
  },
  {
    name: 'Helfer · _gsCssUrl: eine Adresse bleibt in url(\'…\'), ein Ausbruch aus Anfuehrung, Klammer oder Attribut gelingt nicht',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(() => {
        const boese = ["https://a.example/x.jpg');position:fixed;inset:0;z-index:99999;background:red;x:url('", 'https://a.example/x.jpg" onmouseover="window.__pwned=1', 'javascript:alert(1)', 'https://a.example/x.jpg);} body{display:none', '//a.example/x.jpg', 'https://a.example/a b.jpg'];
        const d = document.createElement('div'); document.body.appendChild(d);
        d.innerHTML = boese.map(u => { const c = _gsCssUrl(u); return '<p style="' + (c ? "background-image:url('" + c + "');" : '') + 'color:rgb(1, 2, 3)">x</p>'; }).join('');
        const ps = Array.from(d.querySelectorAll('p'));
        const out = {
          attrs: ps.filter(p => p.attributes.length !== 1).length,
          pos: ps.filter(p => getComputedStyle(p).position !== 'static').length,
          farbe: ps.filter(p => getComputedStyle(p).color !== 'rgb(1, 2, 3)').length,
          leer: [_gsCssUrl('javascript:alert(1)'), _gsCssUrl('//a.example/x.jpg'), _gsCssUrl(''), _gsCssUrl(null)],
          gut: _gsCssUrl('https://vow.supabase.co/storage/v1/object/public/b/u/1.jpg?x=1&y=2'),
        };
        const g = document.createElement('p'); g.setAttribute('style', "background-image:url('" + out.gut.replace(/&amp;/g, '&') + "')"); d.appendChild(g);
        out.gutBild = g.style.backgroundImage;
        d.remove(); return out;
      });
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.attrs || r.pos || r.farbe) return { ok: false, warum: 'Ausbruch: ' + JSON.stringify({ attrs: r.attrs, pos: r.pos, farbe: r.farbe }) };
      if (r.leer.some(x => x !== '')) return { ok: false, warum: 'unerlaubtes Schema nicht leer: ' + JSON.stringify(r.leer) };
      if (!/storage\/v1\/object\/public\/b\/u\/1\.jpg\?x=1&y=2/.test(r.gutBild)) return { ok: false, warum: 'gute Adresse verstuemmelt: ' + r.gutBild };
      return { ok: true, info: '6 feindliche Adressen: 0 Zusatz-Attribute, 0 verschobene Kaesten, Folgedeklaration bleibt · gute Adresse unveraendert' };
    },
  },
  {
    name: 'Helfer · _gsIdSicher und _gsFremdBild: eine echte Id bleibt, eine praeparierte verliert ihre Zeichen; ein Bild nur aus dem eigenen Speicher',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(() => {
        const basis = SB_URL_DEFAULT + '/storage/v1/object/public/';
        return {
          ids: [_gsIdSicher('3f2a7c1e-0b1d-4c2a-9e7f-1234567890ab'), _gsIdSicher('cloud_12'), _gsIdSicher(42), _gsIdSicher("x');alert(1);//"), _gsIdSicher('a" onx="1'), _gsIdSicher(null)],
          gut: [_gsFremdBild(basis + 'post-images/u1/a.jpg'), _gsFremdBild('data:image/png;base64,iVBORw0KGgo=')].map(x => !!x),
          boese: ['https://evil.example/p.gif', basis.replace('https://', 'https://evil.example/?') + 'x.jpg', basis + 'b/../../../auth/v1/logout', basis + 'b/x.jpg" onerror="1', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html,x', '', null].map(x => _gsFremdBild(x)),
        };
      });
      const soll = ['3f2a7c1e-0b1d-4c2a-9e7f-1234567890ab', 'cloud_12', '42', 'xalert1', 'aonx1', ''];
      if (JSON.stringify(r.ids) !== JSON.stringify(soll)) return { ok: false, warum: 'Ids: ' + JSON.stringify(r.ids) };
      if (r.gut.some(x => !x)) return { ok: false, warum: 'eigenes Bild verworfen: ' + JSON.stringify(r.gut) };
      if (r.boese.some(x => x !== '')) return { ok: false, warum: 'fremdes Bild durchgelassen: ' + JSON.stringify(r.boese) };
      return { ok: true, info: '3 echte Ids unveraendert, 2 praeparierte entschaerft · 2 eigene Bilder ja, 9 fremde/unbrauchbare nein' };
    },
  },
];
