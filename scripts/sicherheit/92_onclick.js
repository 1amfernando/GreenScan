// Gruppe w3 — die onclick-Bauform als KLASSE (v33.59).
// Ein Wert in einem '-zitierten JS-String innerhalb von on*="…" durchlaeuft
// ZWEI Parser: erst HTML (loest &#39; zu ' auf), dann JS. escHtml/esc/ed allein
// reichen deshalb nicht, gar kein Escape erst recht nicht (CLAUDE.md §3.6).
// Richtig: _gsOcStr(wert) im String, _gsOcJson(wert) als ganzes Argument.
//
// Zwei Haelften: (1) die Suche ueber den Quelltext als Deckel — 0 Stellen der
// verbotenen Bauform, mit Gegenrichtung (eine kuenstliche Zeile MUSS gefunden
// werden); (2) drei echte Ansichten, mit feindlichen und gutartigen Werten
// gerendert und ANGETIPPT: der Wert kommt unveraendert in der Funktion an.
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./_onclick_suche.js');

// Stellen, die bewusst bleiben (Ausdruck → Grund). Gezaehlt wird nur, was NICHT
// im Handler steht — im Handler gibt es keine Ausnahme.
const OHNE_HANDLER = {
  '_safePhoto': 'CSS-url() in style, kein JS-String (Zeichen werden vorher entfernt)',
  'img': 'CSS-url() in style, schon _gsCssUrl(_gsFremdBild(…))',
  '_heroUrl': 'CSS-url() in style, schon _gsCssUrl',
  '_recipeCurrentFilter': 'Vergleich mit getAttribute(\'onclick\'), keine Senke',
  'z.tab': 'Mitteilungs-Router: Ziel aus der festen Tabelle GS_NOTIF_ZIELE; das ganze JS geht durch escHtml an der Senke (gsNcRender)',
  "tab.replace(/[^a-z_-]/gi,'')": 'Mitteilungs-Router: auf [a-z_-] gefiltert, escHtml an der Senke',
  '_tab': 'Mitteilungs-Router: auf [a-z] gefiltert, escHtml an der Senke',
  '_ank': 'Mitteilungs-Router: auf [A-Za-z0-9_#-] gefiltert, escHtml an der Senke',
};

function suche(text) {
  const t = S.ohneChangelog(S.nurSkript(text));
  return S.finde(t).map(x => Object.assign(x, { k: S.klasse(x.ausdruck, x.art) }));
}

// Rendert eine Ansicht, ersetzt die Zielfunktionen durch Rekorder, tippt jedes
// passende Element an und gibt die angekommenen Argumente zurueck.
async function antippen(seite, h, aufbau, ziel, namen, werte) {
  const r = await seite.evaluate(([aufbau, ziel, namen, werte]) => {
    const alt = {}; const got = [];
    namen.forEach(n => { alt[n] = window[n]; window[n] = function () { got.push([n].concat(Array.from(arguments).filter(a => typeof a === 'string'))); return Promise.resolve(); }; });
    let fehler = null;
    try { (new Function('werte', aufbau))(werte); } catch (e) { fehler = String(e.message); }
    const els = Array.from(document.querySelectorAll(ziel));
    els.forEach(el => { try { el.click(); } catch (e) {} });
    namen.forEach(n => { window[n] = alt[n]; });
    return { fehler, n: els.length, got };
  }, [aufbau, ziel, namen, werte]);
  await h.warte(350);
  r.pwned = await h.pwned();
  const angekommen = new Set();
  r.got.forEach(a => a.slice(1).forEach(v => angekommen.add(v)));
  r.fehlt = werte.filter(w => !angekommen.has(w));
  return r;
}

function urteil(r, werte, was) {
  if (r.fehler) return { ok: false, warum: 'Aufbau warf: ' + r.fehler };
  if (r.pwned !== null) return { ok: false, warum: 'Code lief (__pwned=' + r.pwned + ') in ' + was };
  if (!r.n) return { ok: false, warum: 'kein Element gefunden — der Fall misst nichts' };
  if (r.fehlt.length) return { ok: false, warum: r.fehlt.length + ' von ' + werte.length + ' Werten kamen nicht unveraendert an: ' + JSON.stringify(r.fehlt) + ' · angekommen: ' + JSON.stringify(r.got.slice(0, 6)) };
  return { ok: true, info: r.n + ' Elemente angetippt · ' + werte.length + ' Werte unveraendert angekommen (feindlich UND „Bär\'s Garten", „l\'Orto") · 0 Code' };
}

module.exports = [
  {
    name: 'Suche · im ganzen index.html steht kein Wert mit HTML-Escape allein (oder roh) in einem JS-String eines on*-Attributs',
    lauf: async () => {
      const roh = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
      const tr = suche(roh);
      const imH = tr.filter(x => x.handler);
      const c = imH.filter(x => x.k === 'c');
      const ohne = tr.filter(x => !x.handler && x.k === 'c');
      const unbegruendet = ohne.filter(x => !OHNE_HANDLER[x.ausdruck]);
      const zahl = { a: imH.filter(x => x.k === 'a').length, b: imH.filter(x => x.k === 'b').length, c: c.length };
      if (c.length) return { ok: false, warum: c.length + ' Stellen: ' + c.slice(0, 8).map(x => 'Z.' + x.zeile + ' ' + x.ausdruck).join(' · ') };
      if (zahl.b < 100) return { ok: false, warum: 'nur ' + zahl.b + ' geschuetzte Stellen gefunden — die Suche sieht offenbar nichts mehr' };
      if (unbegruendet.length) return { ok: false, warum: 'JS-Fragment ausserhalb eines on*= ohne Eintrag in OHNE_HANDLER: ' + unbegruendet.slice(0, 6).map(x => 'Z.' + x.zeile + ' ' + x.ausdruck).join(' · ') };
      return { ok: true, info: 'im Handler: ' + zahl.b + ' mit _gsOcStr/_gsOcJson/_gsIdSicher · ' + zahl.a + ' Zahl/Index · 0 verboten · ausserhalb ' + ohne.length + ' namentlich begruendet' };
    },
  },
  {
    name: 'Suche · Gegenrichtung: die verbotene Bauform wird gefunden (vier Schreibweisen), Kommentar und Changelog nicht, _gsOcStr gilt als geschuetzt',
    lauf: async () => {
      const probe = [
        '<script>',
        "var a = '<b onclick=\"f(\\'' + esc(x.id) + '\\')\">';",
        'var b = "<b onclick=\\"g(\'" + l.id + "\')\\">";',
        "var c = '<i onclick=\"h(&quot;' + escHtml(n) + '&quot;)\">';",
        'var d = `<u onclick="k(\'${row.slug}\')">`;',
        "var e = '<p onclick=\"m(\\'' + _gsOcStr(x.id) + '\\')\">';",
        "var f = '<p onclick=\"m(\\'' + i + '\\')\">';",
        "var j = '<p onclick=\"m(\\'' + _gsOcJson(falschJson) + '\\')\">';",
        "var o = '<p onclick=\"m(&quot;' + _gsOcStr(falschQuot) + '&quot;)\">';",
        "// var g = '<b onclick=\"f(\\'' + esc(KOMMENTAR) + '\\')\">';",
        "/* var h = '<b onclick=\"f(\\'' + esc(BLOCK) + '\\')\">'; */",
        "var r = s.replace(/'/g, \"\\\\'\"); var q = '<b onclick=\"f(\\'' + nachRegex + '\\')\">';",
        'window.GS_RELEASES = [',
        "  {text: '<b onclick=\"f(\\'' + esc(CHANGELOG) + '\\')\">'}",
        '];',
        '</script>',
      ].join('\n');
      const tr = suche(probe);
      const c = tr.filter(x => x.handler && x.k === 'c').map(x => x.ausdruck).sort();
      const b = tr.filter(x => x.handler && x.k === 'b').length;
      const a = tr.filter(x => x.handler && x.k === 'a').length;
      const soll = ['_gsOcJson(falschJson)', '_gsOcStr(falschQuot)', 'esc(x.id)', 'escHtml(n)', 'l.id', 'nachRegex', 'row.slug'].sort();
      if (JSON.stringify(c) !== JSON.stringify(soll)) return { ok: false, warum: 'gefunden ' + JSON.stringify(c) + ', erwartet ' + JSON.stringify(soll) };
      if (b !== 1 || a !== 1) return { ok: false, warum: '_gsOcStr/Index falsch eingeordnet: b=' + b + ' a=' + a };
      return { ok: true, info: '7 von 7 verbotenen Stellen gefunden (\' · " · &quot; · Vorlage · nach /\'/g · Helfer im falschen Kontext) · Kommentar, Block und Changelog still · _gsOcStr und Index nicht gemeldet' };
    },
  },
  {
    name: 'Meine Pflanzen · Aufgaben-Karte: eine Pflanzen-Id mit \' oder &#39; (Backup, Cloud-Blob) kommt beim Abhaken unveraendert an',
    lauf: async (seite, h) => {
      const werte = [h.OC, h.OCQ, "Bär's Garten", "l'Orto"];
      const r = await antippen(seite, h,
        "var alt = new Date(Date.now() - 5 * 864e5).toISOString();" +
        "myPlants = werte.map(function (id) { return { id: id, name: 'P ' + id, emoji: '🌿', tasks: { water: { active: true, intervalDays: 1, lastDone: alt } } }; });" +
        "try { plantings = []; } catch (e) {} renderMyPlants();",
        '#plants-due-list .due-card-check, #plants-due-list .due-card-btn',
        ['gsDueCardDone', 'gsSnoozeTask'], werte);
      return urteil(r, werte, 'der Aufgaben-Karte');
    },
  },
  {
    name: 'Marktplatz · Inserat-Detail: eine Inserat-Id mit \' oder &#39; kommt bei Kontakt/Bewerten/Melden unveraendert an',
    lauf: async (seite, h) => {
      const werte = [h.OC, h.OCQ, "Bär's Garten", "l'Orto"];
      const r = await antippen(seite, h,
        "werte.forEach(function (id) { gsMarketShowDetail({ id: id, title: 'Inserat', desc: 'x', cat: 'samen', images: [], sellerName: 'A', sellerId: 'nicht-ich', status: 'active' });" +
        " var m = document.getElementById('detail-modal'); var box = document.createElement('div'); box.className = 'w3-probe'; box.innerHTML = (document.getElementById('detail-content') || m).innerHTML; document.body.appendChild(box); });",
        '.w3-probe button[onclick*="contactSeller"], .w3-probe button[onclick*="reportListing"], .w3-probe button[onclick*="openRateListing"]',
        ['contactSeller', 'reportListing', 'openRateListing'], werte);
      await seite.evaluate(() => { document.querySelectorAll('.w3-probe').forEach(e => e.remove()); try { closeModal('detail-modal'); } catch (e) {} });
      return urteil(r, werte, 'dem Inserat-Detail');
    },
  },
  {
    name: 'Community · Kommentar-Reaktionen: eine Kommentar-Id mit \' oder &#39; kommt bei Gefaellt mir/Teilen unveraendert an',
    lauf: async (seite, h) => {
      const werte = [h.OC, h.OCQ, "Bär's Garten", "l'Orto"];
      const r = await antippen(seite, h,
        "werte.forEach(function (id) { var d = document.createElement('div'); d.className = 'w3-probe'; document.body.appendChild(d); _gsRenderReactBar(d, id, 2, 1, 0); });",
        '.w3-probe button',
        ['gsCommentReact', 'gsShareComment'], werte);
      await seite.evaluate(() => { document.querySelectorAll('.w3-probe').forEach(e => e.remove()); });
      return urteil(r, werte, 'der Reaktionsleiste');
    },
  },
];
