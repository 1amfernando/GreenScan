// Gruppe n1 (v33.59): Wissens-Hub und Wissens-Tabellen — jedes Feld aus der Cloud
// kommt als TEXT an. Anlass: der Heilmittel-Zweig von gsRenderKnowledge setzte
// remedies.ingredients roh ein ('📋 ' + ing.join(', ')), und knowledge-bulk-gen
// schreibt Zutaten als Objekte {name, qty} — „[object Object]".
//
// Die Frage ist die KLASSE, nicht die eine Stelle: fuenf Abschnitte von
// gsRenderKnowledge, elf von gsRenderWissenWave9 samt Detailfenster (Pilz mit
// Verwechslern und Rezept), die Trefferkarten der Wissens-Suche. Die Feldnamen
// liest der Fall aus dem QUELLTEXT dieser Funktionen (jedes r.<feld>, rec.<feld>,
// la.<feld>, row.<feld>) — ein neues Feld ist damit ab dem Tag mitgeprueft, an dem
// es gerendert wird. Jede Zeile traegt in JEDEM Feld denselben feindlichen Wert,
// in sechs Formen (Text, Liste, Objekt, '-Ausbruch, &#39;-Ausbruch, "-Ausbruch).
// Gemessen werden __pwned, fremde Elemente im DOM und der sichtbare Text — vor UND
// nach dem Anklicken jedes Knopfs.
'use strict';
const fs = require('fs');
const path = require('path');

const FREMD = 'img[src="x"], img[onerror], [onmouseover], b.boese';

// Feldnamen aus dem Quelltext der Wissens-Renderer.
const FELDER = (function () {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');
  const a = src.indexOf('window._gsKnResultCard = function');
  const b = src.indexOf('function renderWissenSections(');
  const teil = (a > 0 && b > a) ? src.slice(a, b) : '';
  const s = new Set();
  const re = /\b(?:r|rec|la|row|x)\.([a-z][a-z0-9_]*)\b/g;
  let m;
  while ((m = re.exec(teil))) s.add(m[1]);
  ['length', 'slice', 'map', 'join', 'filter', 'forEach', 'indexOf', 'data', 'toLowerCase'].forEach(k => s.delete(k));
  return Array.from(s).sort();
})();

const ABSCHNITTE_KB = ['rezepte', 'heilmittel', 'folklore', 'techniken', 'blumen'];
const ABSCHNITTE_W9 = ['kompost', 'vermehrung', 'bodenpflege', 'heilpflanzen', 'samen', 'pilze', 'wasser', 'voegel', 'alpen', 'indoor', 'besucher'];

// Faehrt ALLE Wissens-Ansichten mit EINER Form des feindlichen Werts.
async function fahre(seite, wert, slug, marker) {
  return seite.evaluate(async ({ FELDER, wert, slug, marker, FREMD, KB, W9 }) => {
    const warte = (ms) => new Promise(r => setTimeout(r, ms));
    const klon = (v) => JSON.parse(JSON.stringify(v));
    function zeile(extra) {
      const o = {};
      FELDER.forEach(f => { o[f] = klon(wert); });
      o.slug = slug; o.id = slug; o.source_id = slug;
      return Object.assign(o, extra || {});
    }
    const echt = { sb: window.sbFetch, li: window.sbIsLoggedIn, hap: window.gsHaptic };
    const stellen = [];
    function miss(name, el) {
      if (!el) { stellen.push({ name, fehlt: true }); return; }
      const t = el.textContent || '';
      stellen.push({ name, fremd: el.querySelectorAll(FREMD).length, sichtbar: t.indexOf(marker) >= 0,
        objekt: (t.match(/\[object Object\]/gi) || []).length, pwned: window.__pwned === undefined ? null : window.__pwned });
      delete window.__pwned;   // jede Stelle misst nur, was SEIT der vorigen lief
    }
    async function klickeAlle(el, ohne) {
      if (!el) return;
      const ziele = Array.from(el.querySelectorAll('[onclick]')).filter(z => !ohne || !ohne(z));
      for (const z of ziele) { try { z.click(); } catch (e) {} await warte(30); }
      Array.from(el.querySelectorAll('input[onkeyup]')).forEach(i => { try { i.dispatchEvent(new KeyboardEvent('keyup')); } catch (e) {} });
      Array.from(el.querySelectorAll('select[onchange]')).forEach(s => { try { s.selectedIndex = s.options.length - 1; s.dispatchEvent(new Event('change')); } catch (e) {} });
    }
    // Pilz-Zeilen in drei Lagen, damit Gift- UND Speisepilz-Zweig laufen.
    const zeilen = [zeile(), zeile({ slug: slug + 'T', id: slug + 'T', edibility: 'toedlich', invasive_in_ch: true }), zeile({ slug: slug + 'S', id: slug + 'S', edibility: 'speisepilz' })];
    window.sbFetch = async function (p) {
      if (/fn_knowledge_(search2|recent|bookmarks_list)/.test(p)) {
        return { data: ['recipes', 'folk_lore', 'species', wert].map(st => Object.assign(zeile(), { source_type: typeof st === 'string' ? st : klon(st), kind: klon(wert), similarity: 0.5, created_at: new Date().toISOString(), is_bookmarked: false })), error: null };
      }
      if (/fn_knowledge_/.test(p)) return { data: true, error: null };
      if (/mushroom_lookalikes/.test(p)) return { data: zeilen.map(z => Object.assign(klon(z), { edible_slug: z.slug, lookalike_slug: klon(wert), confusion_risk: klon(wert) })), error: null };
      if (/\/rest\/v1\//.test(p)) return { data: klon(zeilen), error: null };
      return { data: null, error: { message: 'gestellt' } };
    };
    window.sbIsLoggedIn = () => true;
    window.gsHaptic = () => {};
    const el = document.getElementById('wissen-content');
    try {
      for (const s of KB) {
        window._gsKbFilters = {};
        await window.gsRenderKnowledge(s); await warte(350);
        miss('KB ' + s, el);
        await klickeAlle(el); await warte(450);
        miss('KB ' + s + ' (nach Klicks)', el);
      }
      for (const s of W9) {
        window._gsWave9Cache = {}; window._gsWave9Filter = {};
        await window.gsRenderWissenWave9(s); await warte(350);
        miss('W9 ' + s, el);
        const karten = Array.from(el.querySelectorAll('[onclick^="gsWave9OpenDetail"]'));
        await klickeAlle(el, z => /gsWave9OpenDetail/.test(z.getAttribute('onclick') || '')); await warte(350);
        miss('W9 ' + s + ' (nach Filtern)', el);
        for (let i = 0; i < karten.length; i++) {
          karten[i].click(); await warte(500);
          const mc = document.getElementById('modal-content');
          miss('W9 ' + s + ' Detail ' + i, mc);
          await klickeAlle(mc, z => /closeModal/.test(z.getAttribute('onclick') || '')); await warte(450);
          miss('W9 ' + s + ' Detail ' + i + ' (nach Klicks)', document.getElementById('modal-content'));
        }
        try { window.closeModal && window.closeModal('detail-modal'); } catch (e) {}
      }
      const res = document.getElementById('wissen-global-results');
      for (const [name, fn] of [['Suche', () => window.gsKnowledgeGlobalSearch('ab')], ['Neu', () => window.gsKnRenderDiscover()], ['Gemerkt', () => window.gsKnShowBookmarks()]]) {
        await fn(); await warte(350);
        miss('Treffer ' + name, res);
        await klickeAlle(res); await warte(450);
        miss('Treffer ' + name + ' (nach Klicks)', res);
        await fn(); await warte(200);
      }
    } finally {
      window.sbFetch = echt.sb; window.sbIsLoggedIn = echt.li; window.gsHaptic = echt.hap;
      window._gsWave9Cache = {}; window._gsWave9Filter = {}; window._gsKbFilters = {};
      try { window.closeModal && window.closeModal('detail-modal'); } catch (e) {}
    }
    await warte(350);
    return { stellen, pwned: window.__pwned === undefined ? null : window.__pwned };
  }, { FELDER, wert, slug, marker, FREMD, KB: ABSCHNITTE_KB, W9: ABSCHNITTE_W9 });
}

function urteil(r, h, opts) {
  const o = opts || {};
  const schlecht = r.stellen.filter(s => s.fehlt || s.fremd > 0 || s.pwned != null);
  const ohneText = o.text === false ? [] : r.stellen.filter(s => !s.fehlt && !s.sichtbar);
  const objekt = o.objekt ? r.stellen.filter(s => s.objekt > 0) : [];
  if (r.pwned != null || schlecht.length || ohneText.length || objekt.length) {
    return { ok: false, warum: (r.pwned != null ? '__pwned=' + r.pwned + ' · ' : '') +
      (schlecht.length ? 'Code/Auszeichnung: ' + schlecht.slice(0, 6).map(s => s.name + (s.fehlt ? ' fehlt' : ' fremd=' + s.fremd + ' pwned=' + s.pwned)).join(' | ') + ' · ' : '') +
      (ohneText.length ? 'Wert nicht als Text sichtbar: ' + ohneText.slice(0, 6).map(s => s.name).join(' | ') + ' · ' : '') +
      (objekt.length ? '„[object Object]": ' + objekt.slice(0, 6).map(s => s.name + '×' + s.objekt).join(' | ') : '') };
  }
  return { ok: true, info: r.stellen.length + ' Stellen gemessen, ' + FELDER.length + ' Felder je Zeile' };
}

module.exports = [
  {
    name: 'n1 · Wissen als TEXT: jedes Feld = <img onerror> — alle Abschnitte, Detailfenster, Trefferkarten, jeder Knopf geklickt; der Wert steht sichtbar da',
    lauf: async (seite, h) => urteil(await fahre(seite, h.BOESE, 'n1-text', 'onerror="window.__pwned=1"'), h),
  },
  {
    name: 'n1 · Wissen als LISTE: jedes Feld = [<img>, {name:<img>, qty:<img>}] — nichts laeuft, kein „[object Object]"',
    lauf: async (seite, h) => urteil(await fahre(seite, [h.BOESE, { name: h.BOESE, qty: h.BOESE }], 'n1-liste', 'onerror="window.__pwned=1"'), h, { objekt: true }),
  },
  {
    name: 'n1 · Wissen als OBJEKT: jedes Feld = {<img>: <img>, name, qty, text} — feindliche Schluessel UND Werte bleiben Text',
    lauf: async (seite, h) => urteil(await fahre(seite, { [h.BOESE]: h.BOESE, name: h.BOESE, qty: h.BOESE, text: h.BOESE }, 'n1-obj', 'onerror="window.__pwned=1"'), h, { objekt: true }),
  },
  {
    name: "n1 · Wissen im on*-Attribut: jedes Feld (id, slug, Abschnitt, Kategorie) = x');window.__pwned=1;// — jeder Knopf geklickt, nichts laeuft",
    lauf: async (seite, h) => urteil(await fahre(seite, h.OC, h.OC, '__pwned=1;//'), h),
  },
  {
    name: 'n1 · Wissen im on*-Attribut nach dem HTML-Parser: x&#39;);window.__pwned=1;// — nichts laeuft',
    lauf: async (seite, h) => urteil(await fahre(seite, h.OCQ, h.OCQ, '__pwned=1;//'), h),
  },
  {
    name: 'n1 · Wissen in "-Attributen (title, style, value): " onmouseover="… — kein fremdes Attribut entsteht',
    lauf: async (seite, h) => urteil(await fahre(seite, h.ATTR, 'n1-attr', 'onmouseover="window.__pwned=1'), h),
  },
  {
    name: 'n1 · Heilmittel-Zutaten: Objekte {name, qty} aus knowledge-bulk-gen lesbar („Kamille 2 EL"), Zeichenketten unveraendert, <img> als Text',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (BOESE) => {
        const echt = window.sbFetch;
        window.sbFetch = async () => ({ data: [{ id: 'n1-h', title: "Gärtner's Tee & Salbe", ailment: 'Husten', is_published: true,
          ingredients: ['Thymian', { name: 'Kamille', qty: '2 EL' }, { name: 'Honig', amount: '1 TL' }, { name: 'Salbei' }, BOESE] }], error: null });
        window._gsKbFilters = {};
        try { await window.gsRenderKnowledge('heilmittel'); } finally { window.sbFetch = echt; }
        await new Promise(r => setTimeout(r, 350));
        const el = document.getElementById('wissen-content');
        return { t: el.textContent, fremd: el.querySelectorAll('img[src="x"], img[onerror]').length, pwned: window.__pwned === undefined ? null : window.__pwned };
      }, h.BOESE);
      const soll = ['Thymian', 'Kamille 2 EL', 'Honig 1 TL', 'Salbei', 'onerror="window.__pwned=1"', "Gärtner's Tee & Salbe"];
      const fehlt = soll.filter(s => r.t.indexOf(s) < 0);
      if (r.pwned != null || r.fremd || fehlt.length || /\[object Object\]/.test(r.t)) return { ok: false, warum: 'pwned=' + r.pwned + ' fremd=' + r.fremd + ' fehlt: ' + fehlt.join(' | ') + (/\[object Object\]/.test(r.t) ? ' · [object Object] steht da' : '') };
      return { ok: true, info: 'Zutaten: Thymian, Kamille 2 EL, Honig 1 TL, Salbei, <img> als Text' };
    },
  },
  {
    // Gegenpruefung: dieselbe Quelle (remedies/recipes.ingredients) an der ANDEREN Senke —
    // die Tabs „Rezepte" und „Heilmittel" mappen die Cloud-Zeilen in recipesData/remediesData.
    name: 'n1 · Rezepte-/Heilmittel-Tab: Cloud-Zutaten und -Schritte als Objekte ({name, qty}, {text}) lesbar, <img> als Text — Liste UND Detail',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (BOESE) => {
        const echt = window.sbFetch;
        const ing = ['Thymian', { name: 'Kamille', qty: '2 EL' }, BOESE];
        window.sbFetch = async (p) => {
          if (/\/rest\/v1\/remedies\?/.test(p)) return { data: [{ id: 'n1-rem', slug: 'n1-rem', title: 'Tee n1', ingredients: ing, preparation: 'Ziehen', is_published: true }], error: null };
          if (/\/rest\/v1\/recipes\?/.test(p)) return { data: [{ id: 'n1-rez', slug: 'n1-rez', title: 'Pesto n1', ingredients: ing, steps: [{ text: 'Mixen' }, 'Servieren'], is_published: true }], error: null };
          return { data: [], error: null };
        };
        const out = {};
        try {
          await window.gsLoadCloudRemedies(); await window.gsLoadCloudRecipes();
          const rem = remediesData.find(x => x._cloud_id === 'n1-rem');
          const rez = recipesData.find(x => x._cloud_id === 'n1-rez');
          out.daten = (rem ? rem.ingredients : '(fehlt)') + ' | ' + (rez ? rez.ingredients + ' | ' + rez.steps : '(fehlt)');
          if (rem) { openRecipeDetail(rem.id); out.rem = document.getElementById('recipe-detail-body').textContent; }
          if (rez) { openRecipeDetail(rez.id); out.rez = document.getElementById('recipe-detail-body').textContent; }
          out.fremd = document.querySelectorAll('#recipe-detail-body img[src="x"], #recipe-detail-body img[onerror]').length;
        } finally {
          window.sbFetch = echt;
          for (const l of [remediesData, recipesData]) for (let i = l.length - 1; i >= 0; i--) if (/^n1-re[mz]$/.test(l[i]._cloud_id)) l.splice(i, 1);
          try { closeModal('modal-recipe-detail'); } catch (e) {}
        }
        await new Promise(r => setTimeout(r, 300));
        out.pwned = window.__pwned === undefined ? null : window.__pwned;
        return out;
      }, h.BOESE);
      const t = [r.daten, r.rem, r.rez].join(' ## ');
      const fehlt = ['Kamille 2 EL', 'Thymian', 'Mixen', 'Servieren'].filter(s => t.indexOf(s) < 0);
      if (r.pwned != null || r.fremd || fehlt.length || /\[object Object\]/.test(t) || !r.rem || !r.rez) return { ok: false, warum: 'pwned=' + r.pwned + ' fremd=' + r.fremd + ' fehlt: ' + fehlt.join(' | ') + ' · ' + String(r.daten).slice(0, 200) };
      return { ok: true, info: 'Daten: ' + String(r.daten).replace(/\n/g, ' / ').slice(0, 90) };
    },
  },
  {
    // Gegenpruefung: dieselben Renderer haben zwei weitere Aufrufer mit eigenem ed —
    // die Bodenpflege-Top-5 und die Pilz-Lernkarte.
    name: 'n1 · Bodenpflege-Detail und Pilz-Lernkarte: Listen mit Objekten lesbar, <img> als Text',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (BOESE) => {
        const warte = (ms) => new Promise(r => setTimeout(r, ms));
        const obj = { name: 'Kalk', qty: '2 kg' };
        const echt = window.sbFetch;
        const pilz = { slug: 'n1-pilz', common_name_de: 'Testling', scientific_name: 'Boletus n1', edibility: 'giftig',
          habitat: [obj, BOESE], symbiosis_partners: [obj], identifying_features: obj, toxic_compounds: BOESE };
        window.sbFetch = async () => ({ data: [pilz], error: null });
        const out = {};
        try {
          window._gsSoilTop5 = [{ slug: 'n1-soil', name_de: 'Testduenger', category: obj, description: BOESE, application_rate: obj, works_well_with: [obj, BOESE], best_for_soil: [obj] }];
          window.gsSoilOpenDetail('n1-soil');
          out.soil = document.getElementById('modal-content').textContent;
          try { closeModal('detail-modal'); } catch (e) {}
          window._gsMushRegistryCache = null;
          await gsOpenMushroomLearnCard('Testling'); await warte(300);
          out.pilz = document.getElementById('modal-content').textContent;
          out.fremd = document.querySelectorAll('#modal-content img[src="x"], #modal-content img[onerror]').length;
        } finally { window.sbFetch = echt; window._gsSoilTop5 = []; try { closeModal('detail-modal'); } catch (e) {} }
        await warte(300);
        out.pwned = window.__pwned === undefined ? null : window.__pwned;
        return out;
      }, h.BOESE);
      const fehlt = [['soil', 'Kalk 2 kg'], ['soil', 'Testduenger'], ['pilz', 'Kalk 2 kg'], ['pilz', 'Testling']].filter(([k, t]) => String(r[k] || '').indexOf(t) < 0);
      const obj = ['soil', 'pilz'].filter(k => /\[object Object\]/.test(r[k] || ''));
      if (r.pwned != null || r.fremd || fehlt.length || obj.length) return { ok: false, warum: 'pwned=' + r.pwned + ' fremd=' + r.fremd + ' fehlt: ' + fehlt.map(x => x.join(': ')).join(' | ') + ' · [object Object] in: ' + obj.join(',') };
      return { ok: true, info: 'beide Aufrufer lesbar, nichts laeuft' };
    },
  },
  {
    name: 'n1 · Blumen-Farbe: bloom_color ist ein CSS-Wert in style="" — „red;background-image:url(…)" laedt nichts, eine echte Farbe faerbt weiter',
    lauf: async (seite, h) => {
      h.anfragen();
      const r = await seite.evaluate(async () => {
        const echt = window.sbFetch;
        window.sbFetch = async () => ({ data: [
          { id: 'n1-b1', name: 'Boesblume', bloom_color: 'red;background-image:url(https://angreifer.example/css.png)' },
          { id: 'n1-b2', name: 'Gutblume', bloom_color: '#c2185b' },
        ], error: null });
        window._gsKbFilters = {};
        try { await window.gsRenderKnowledge('blumen'); } finally { window.sbFetch = echt; }
        await new Promise(r => setTimeout(r, 500));
        const sp = Array.from(document.querySelectorAll('#wissen-content span')).filter(s => /#c2185b|angreifer/.test(s.textContent));
        return sp.map(s => ({ t: s.textContent, bg: getComputedStyle(s).backgroundImage, farbe: getComputedStyle(s).backgroundColor }));
      });
      const anf = h.anfragen().filter(u => /angreifer/.test(u));
      const gut = r.find(x => x.t === '#c2185b');
      if (anf.length || r.some(x => x.bg && x.bg !== 'none') || !gut || gut.farbe !== 'rgb(194, 24, 91)') return { ok: false, warum: 'Anfragen ' + JSON.stringify(anf) + ' · ' + JSON.stringify(r) };
      return { ok: true, info: '0 Anfragen, #c2185b faerbt (' + gut.farbe + ')' };
    },
  },
  {
    name: `n1 · Gutartig unveraendert: Rezept („Gärtner's Bärlauch-Pesto & Brot", Zeilenumbruch, 15 min · 4 Portionen), Kompost-Monatsschritte, Vermehrungs-Schritte als Objekt, Pilzrezept-Zutaten {amount, unit, name}`,
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const warte = (ms) => new Promise(r => setTimeout(r, ms));
        const echt = window.sbFetch;
        window.sbFetch = async (p) => {
          if (/\/rest\/v1\/recipes\?/.test(p)) return { data: [{ id: 'g1', title: "Gärtner's Bärlauch-Pesto & Brot", subtitle: 'Frühling', description: 'Zeile eins\nZeile zwei', prep_time_min: 15, servings: 4, ingredients: ['200 g Bärlauch', 'Öl & Salz'], steps: ['Waschen', 'Mixen'] }], error: null };
          if (/compost_recipes/.test(p)) return { data: [{ slug: 'g-k', name_de: 'Heisskompost', method: 'heiss', duration_weeks_min: 0, duration_weeks_max: 8, monthly_steps: { '01': 'Aufsetzen', '02': "Umsetzen (Gärtner's Regel)" } }], error: null };
          if (/propagation_methods/.test(p)) return { data: [{ slug: 'g-v', name_de: 'Steckling', best_season: ['Mai', 'Juni'], step_by_step: { a: 'Schneiden', b: 'Stecken' } }], error: null };
          if (/mushroom_recipes\?slug/.test(p)) return { data: [{ slug: 'g-r', title: 'Steinpilz-Risotto', ingredients: [{ amount: 200, unit: 'g', name: 'Steinpilze' }, '1 Zwiebel'], steps: [{ text: 'Anbraten' }, 'Köcheln'] }], error: null };
          return { data: [], error: null };
        };
        const out = {};
        try {
          window._gsKbFilters = {};
          await window.gsRenderKnowledge('rezepte');
          out.rezept = document.getElementById('wissen-content').textContent;
          window._gsWave9Cache = {};
          await window.gsRenderWissenWave9('kompost'); window.gsWave9OpenDetail('kompost', 'g-k');
          out.kompost = document.getElementById('modal-content').textContent;
          window._gsWave9Cache = {};
          await window.gsRenderWissenWave9('vermehrung'); window.gsWave9OpenDetail('vermehrung', 'g-v');
          out.vermehrung = document.getElementById('modal-content').textContent;
          await window.gsMushroomRecipeOpen('g-r'); await warte(100);
          out.pilzrezept = document.getElementById('modal-content').textContent;
        } finally { window.sbFetch = echt; window._gsWave9Cache = {}; window._gsKbFilters = {}; try { closeModal('detail-modal'); } catch (e) {} }
        return out;
      });
      const soll = [['rezept', "Gärtner's Bärlauch-Pesto & Brot"], ['rezept', 'Zeile eins\nZeile zwei'], ['rezept', '15 min · 4 Portionen'], ['rezept', '200 g Bärlauch'], ['rezept', 'Öl & Salz'],
        ['kompost', '0-8 Wochen'], ['kompost', "Umsetzen (Gärtner's Regel)"], ['vermehrung', 'Mai, Juni'], ['vermehrung', 'Schneiden'], ['vermehrung', 'Stecken'],
        ['pilzrezept', '200 g Steinpilze'], ['pilzrezept', '1 Zwiebel'], ['pilzrezept', 'Anbraten'], ['pilzrezept', 'Köcheln']];
      const fehlt = soll.filter(([k, t]) => String(r[k] || '').indexOf(t) < 0);
      if (fehlt.length) return { ok: false, warum: 'fehlt: ' + fehlt.map(x => x.join(': ')).join(' | ') };
      return { ok: true, info: soll.length + ' gutartige Stellen exakt da' };
    },
  },
];
