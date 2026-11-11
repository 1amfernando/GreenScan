// Uebersetzungen aus der Datenbank sind Fremdtext (v33.59, CLAUDE.md §3.6).
// i18n_translations schreibt eine KI (Edge-Function i18n-translate) und der
// Admin; der Cache gs_i18n_bundles liegt im localStorage und ueberlebt das
// Abmelden. Rund 900 Aufrufstellen setzen `_t(…)` roh in innerHTML oder in
// einen Attributwert — geschuetzt wird deshalb der EINE Eingang (gsI18n:
// Cache, Datenbank, Edge-Antwort), nicht jede Senke. Jeder Fall rendert die
// ECHTE Ansicht mit dem untergeschobenen Wert und misst die Wirkung.
'use strict';

const HREF_BOESE = '<div class="modal-overlay open">Sitzung abgelaufen <a href="https://evil.example/x/onmouseover=window.__pwned=7//" title="t onmouseover=window.__pwned=8//">neu anmelden</a></div>';

// Laedt die App neu, nachdem _seed.js gelaufen ist, mit gs_lang=fr und den
// gegebenen Ablagen — so, wie ein vergifteter Cache beim Start ankommt.
async function mitSprache(seite, h, ablage) {
  await seite.addInitScript((a) => {
    try {
      localStorage.setItem('gs_lang', 'fr');
      Object.keys(a).forEach(k => localStorage.setItem(k, JSON.stringify(a[k])));
    } catch (e) {}
  }, ablage);
  await seite.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await seite.waitForTimeout(4000);
  await seite.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    window.gsRequire = () => true; window.gsHaptic = () => {}; delete window.__pwned;
    // kein Neuladen aus der Datenbank waehrend der Messung (kein Netz ohnehin)
  });
}

// Rendert die Ansichten, in denen die Schluessel landen, und misst sie.
async function rendern(seite) {
  return seite.evaluate(async (HREF_BOESE) => {
    const out = { lang: gsI18n.getLang() };
    // (1) innerHTML: „Meine Sammlungen" (_gsCollT → gsI18n.t)
    try { gsOpenCollections(); } catch (e) { out.collErr = String(e.message); }
    await new Promise(r => setTimeout(r, 300));
    const h3 = Array.from(document.querySelectorAll('h3')).find(x => /Sammlungen|Collections|PRUEF/.test(x.textContent));
    out.coll = h3 ? { text: h3.textContent, kinder: h3.children.length, img: document.querySelectorAll('img[src="x"]').length } : null;
    const unter = h3 && h3.nextElementSibling;
    out.collUnter = unter ? { text: unter.textContent, br: unter.querySelectorAll('br').length, kinder: unter.querySelectorAll('*').length } : null;
    try { closeModal && document.querySelectorAll('.gs-dyn-overlay').forEach(o => o.remove()); } catch (e) {}
    // (2) Attribut: placeholder im Anmeldeformular (renderProfileLogin)
    const mc = document.createElement('div'); document.body.appendChild(mc);
    try { renderProfileLogin(mc); } catch (e) { out.loginErr = String(e.message); }
    const em = mc.querySelector('#prof-email');
    out.login = em ? { ph: em.getAttribute('placeholder'), attrs: Array.from(em.attributes).map(a => a.name), boese: Array.from(em.attributes).filter(a => /__pwned/.test(a.value) && a.name !== 'placeholder').length, img: mc.querySelectorAll('img').length } : null;
    mc.remove();
    // (2b) Attribut title: openDetail (modal_close)
    try {
      const sp = (window.DB || [])[0];
      if (sp) { openDetail(sp.id); await new Promise(r => setTimeout(r, 200));
        const b = document.querySelector('#detail-modal .modal-close-btn');
        out.detail = b ? { title: b.getAttribute('title'), attrs: Array.from(b.attributes).map(a => a.name) } : null;
        try { closeModal('detail-modal'); } catch (e) {} }
    } catch (e) { out.detailErr = String(e.message); }
    // (3) data-i18n-html: applyToDOM ueber gsSanitizeHtml
    const el = document.createElement('label'); el.setAttribute('data-i18n', 'fb_lbl_type'); el.setAttribute('data-i18n-html', '');
    el.setAttribute('data-i18n-fallback', 'Typ <span style="color:var(--c-danger)">*</span>'); el.textContent = 'Typ';
    const tx = document.createElement('span'); tx.setAttribute('data-i18n', 'coll_loading'); tx.textContent = '⏳ Lade…';
    document.body.appendChild(el); document.body.appendChild(tx);
    gsI18n.applyToDOM(el.parentNode);
    out.html = { overlay: !!el.querySelector('.modal-overlay'), klassen: el.querySelectorAll('[class]').length,
      fest: Array.from(el.querySelectorAll('*')).filter(x => getComputedStyle(x).position === 'fixed').length,
      href: el.querySelectorAll('[href]').length, title: el.querySelectorAll('[title]').length, a: el.querySelectorAll('a').length, text: el.textContent };
    out.textOnly = tx.textContent;
    el.remove(); tx.remove();
    // (4) tText (Toasts/Dialoge): Phrase → Uebersetzung
    const tt = gsI18n.tText('Neue Sammlung…');
    const d = document.createElement('div'); d.innerHTML = '<p title="' + tt + '">' + tt + '</p>'; document.body.appendChild(d);
    out.ttext = { wert: tt, kinder: d.querySelectorAll('p *').length, attrs: d.querySelector('p').attributes.length };
    d.remove();
    await new Promise(r => setTimeout(r, 400));
    out.pwned = window.__pwned; delete window.__pwned;
    return out;
  }, HREF_BOESE);
}

function urteil(r, erwartGut) {
  const f = [];
  if (r.lang !== 'fr') f.push('Sprache nicht fr: ' + r.lang);
  if (r.pwned !== undefined) f.push('Code lief (__pwned=' + r.pwned + ')');
  if (!r.coll) f.push('Sammlungen-Titel nicht gerendert' + (r.collErr ? ' (' + r.collErr + ')' : ''));
  else if (r.coll.kinder || r.coll.img) f.push('Sammlungen-Titel traegt Elemente: ' + JSON.stringify(r.coll));
  if (!r.login) f.push('Anmeldeformular nicht gerendert' + (r.loginErr ? ' (' + r.loginErr + ')' : ''));
  else if (r.login.img || r.login.boese || r.login.attrs.some(a => a === 'x' || a === 'autofocus' || a === 'onmouseover')) f.push('Anmeldefeld: Zusatz-Attribut/Element ' + JSON.stringify(r.login));
  if (r.detail && r.detail.attrs.some(a => /^on(?!click$)/.test(a) || a === 'x')) f.push('Detail-Schliessknopf: Zusatz-Attribut ' + JSON.stringify(r.detail));
  if (r.html.overlay || r.html.klassen || r.html.fest || r.html.href || r.html.title) f.push('data-i18n-html traegt Klasse/Ueberlagerung/Link: ' + JSON.stringify(r.html));
  if (r.ttext.kinder || r.ttext.attrs !== 1) f.push('tText: ' + JSON.stringify(r.ttext));
  if (erwartGut) {
    if (!r.collUnter || r.collUnter.br !== 1 || r.collUnter.text !== 'Dossiers pour plantesavec & plus') f.push('gute Uebersetzung mit <br> und & kam nicht an: ' + JSON.stringify(r.collUnter));
    if (!r.login || r.login.ph !== 'Adresse e-mail de l’utilisateur') f.push('Apostroph-Uebersetzung kam nicht typografisch an: ' + JSON.stringify(r.login));
    if (r.textOnly !== 'Chargement & tri') f.push('reiner Text mit & (textContent) veraendert: ' + JSON.stringify(r.textOnly));
    if (!/Type/.test(r.html.text)) f.push('data-i18n-html Text fehlt: ' + JSON.stringify(r.html));
  }
  return f;
}

const BOESES_BUNDLE = (h) => ({
  coll_title: h.BOESE + ' Collections',                       // innerHTML
  coll_subtitle: 'Dossiers pour plantes<br>avec &amp; plus'.replace('&amp;', '&'), // gut: <br> und &
  coll_loading: 'Chargement & tri',                             // gut: reiner Text mit &
  ph_email: 'Adresse e-mail de l\'utilisateur',                  // gut: Apostroph (Attribut)
  modal_close: 'Fermer" onmouseover="window.__pwned=4" x="',     // Attribut title/aria-label
  fb_lbl_type: 'Type ' + HREF_BOESE,                             // data-i18n-html
});

module.exports = [
  {
    name: 'Uebersetzung aus dem CACHE (gs_i18n_bundles) · innerHTML, placeholder/title, data-i18n-html, tText — feindlich faellt, <br>/&/Apostroph bleiben',
    lauf: async (seite, h) => {
      const bundle = BOESES_BUNDLE(h);
      // Ein zweites Anmeldefeld bekommt den Attribut-Ausbruch ueber tText (Phrase).
      await mitSprache(seite, h, {
        gs_i18n_bundles: { bundles: { fr: bundle }, ts: { fr: 9e15 } },   // Zukunfts-Zeitstempel: galt bis v33.56 fuer immer als frisch
        gs_i18n_srcmaps: { fr: { 'Neue Sammlung…': 'Nouvelle" onmouseover="window.__pwned=5" x="' + h.BOESE } },
      });
      const stale = await seite.evaluate(() => { const echt = Date.now; try { Date.now = () => echt() + 2 * 86400000; return gsI18n.isStale('fr'); } finally { Date.now = echt; } });
      const r = await rendern(seite);
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) r.pwned = p;
      const f = urteil(r, true);
      if (!stale) f.push('Cache mit Zukunfts-Zeitstempel gilt auch in zwei Tagen noch als frisch');
      await h.frisch();
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'Titel=„' + r.coll.text + '" · placeholder=„' + r.login.ph + '" · title=„' + (r.detail && r.detail.title) + '" · <br> 1 · & bleibt · 0 Klassen/Links · Zukunfts-ts geklemmt' };
    },
  },
  {
    name: 'Uebersetzung aus der DATENBANK (loadFromDb, entity-kodiert) und aus der Edge-Antwort (_setBundle) — dieselbe Regel',
    lauf: async (seite, h) => {
      await mitSprache(seite, h, {});
      const r = await seite.evaluate(async ({ BOESE, HREF_BOESE }) => {
        const enc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
        const zeilen = [
          ['E-Mail-Adresse', 'Adresse e-mail" autofocus onfocus="window.__pwned=6" x="'],
          ['Meine Sammlungen', BOESE + ' Collections'],
          ['Eigene Ordner für Pflanzen, Arten &amp; mehr', 'Dossiers pour plantes<br>avec & plus'],
          ['Schliessen', 'Fermer'],
          ['Typ <span style="color:var(--c-danger);">*</span>', 'Type ' + HREF_BOESE],
          ['sauer (pH < 6) — Heidelbeere, Hortensie', 'acide (pH < 6) — myrtille'],   // gut: ein `<`, das kein Tag ist
        ].map(([de, fr]) => ({ source_text: enc(de.replace('&amp;', '&')), translated_text: enc(fr) }));
        const echt = window.sbFetch;
        window.sbFetch = async () => ({ data: zeilen, error: null });
        let ok; try { ok = await gsI18n.loadFromDb('fr'); } finally { window.sbFetch = echt; }
        const b = gsI18n.getBundles().fr;
        const db = { ok, ph: b.ph_email, coll: b.coll_title, sub: b.coll_subtitle, typ: b.fb_lbl_type, ph6: b.soil_ph_acid };
        // Edge-Antwort (gsBuildI18n → _setBundle)
        gsI18n._setBundle('it', { ph_email: 'Indirizzo" onfocus="x', coll_title: BOESE, coll_subtitle: 'l\'app<br>ok' });
        const it = gsI18n.getBundles().it;
        // Ein erlaubtes <span style> in einem Wert, der in einem ATTRIBUT landet: das `"`
        // der Serialisierung beendet das Attribut — Leerraum oder `/` im Stil wuerden
        // dahinter neue Attribute (`autofocus`) bilden.
        gsI18n._setBundle('es', { ph_email: '<span style="color:red autofocus hidden">x</span>', coll_title: '<span style="font-size:calc(1em/autofocus/2)">y</span>' });
        const es = gsI18n.getBundles().es, stilAttrs = [];
        [es.ph_email, es.coll_title].forEach(w => { const ein = document.createElement('div'); ein.innerHTML = '<input placeholder="' + w + '">';
          stilAttrs.push.apply(stilAttrs, Array.from(ein.querySelector('input').attributes).map(a => a.name)); });
        return { db, it: { ph: it.ph_email, coll: it.coll_title, sub: it.coll_subtitle }, stilAttrs };
      }, { BOESE: h.BOESE, HREF_BOESE });
      const r2 = await seite.evaluate(async () => {
        const mc = document.createElement('div'); document.body.appendChild(mc);
        renderProfileLogin(mc);
        const em = mc.querySelector('#prof-email');
        const o = { ph: em.getAttribute('placeholder'), attrs: Array.from(em.attributes).map(a => a.name), boese: Array.from(em.attributes).filter(a => /__pwned/.test(a.value) && a.name !== 'placeholder').length };
        mc.remove(); await new Promise(r => setTimeout(r, 400)); o.pwned = window.__pwned; delete window.__pwned; return o;
      });
      await h.warte(300);
      const p = await h.pwned();
      await h.frisch();
      const f = [];
      if (!r.db.ok) f.push('loadFromDb lieferte false');
      if (p !== null || r2.pwned !== undefined) f.push('Code lief');
      if (/["<]/.test(r.db.ph) || r2.boese || r2.attrs.some(a => /^autofocus$|^x$/.test(a))) f.push('DB-Wert bricht aus dem placeholder aus: ' + JSON.stringify(r2));
      if (/<img/i.test(r.db.coll) || /<img/i.test(r.it.coll)) f.push('<img> blieb im Wert: ' + JSON.stringify([r.db.coll, r.it.coll]));
      if (typeof r.db.typ !== 'string') f.push('Typ-Uebersetzung nicht ins Bundle gekommen (Fall misst nichts)');
      else if (/class=|href=|title=/.test(r.db.typ)) f.push('Klasse/Link blieb in der Uebersetzung: ' + r.db.typ);
      if (!/<br>/.test(r.db.sub) || r.db.sub.indexOf('& plus') < 0 && r.db.sub.indexOf('&amp; plus') < 0) f.push('gute DB-Uebersetzung veraendert: ' + r.db.sub);
      if (/"/.test(r.it.ph) || r.it.sub !== 'l’app<br>ok') f.push('Edge-Antwort nicht gleich behandelt: ' + JSON.stringify(r.it));
      if (r.db.ph6 !== 'acide (pH < 6) — myrtille') f.push('„pH < 6" kam nicht als Text an (textContent zeigte sonst „&lt;"): ' + JSON.stringify(r.db.ph6));
      if (r.stilAttrs.some(a => /^(autofocus|hidden)$/.test(a))) f.push('style im Attribut bildet neue Attribute: ' + JSON.stringify(r.stilAttrs));
      if (f.length) return { ok: false, warum: f.join(' · ') };
      return { ok: true, info: 'DB: placeholder=„' + r2.ph + '" · Typ=' + JSON.stringify(r.db.typ) + ' · Edge: ' + JSON.stringify(r.it.sub) };
    },
  },
  {
    name: 'gsSanitizeHtml · class faellt: ein Fragment legt sich nicht als .modal-overlay.open ueber die App — <b>/<br>/<span style> bleiben',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(() => {
        const d = document.createElement('div'); document.body.appendChild(d);
        d.innerHTML = gsSanitizeHtml('<div class="modal-overlay open">deckt</div><b class="x">f</b><br><span style="color:var(--c-danger)">*</span>');
        const o = { klassen: d.querySelectorAll('[class]').length, fest: Array.from(d.querySelectorAll('*')).filter(x => getComputedStyle(x).position === 'fixed').length,
          b: d.querySelectorAll('b').length, br: d.querySelectorAll('br').length, span: (d.querySelector('span') || {}).getAttribute ? d.querySelector('span').getAttribute('style') : null };
        d.remove(); return o;
      });
      if (r.klassen || r.fest) return { ok: false, warum: 'class blieb: ' + JSON.stringify(r) };
      if (r.b !== 1 || r.br !== 1 || !r.span) return { ok: false, warum: 'gute Auszeichnung fiel mit: ' + JSON.stringify(r) };
      return { ok: true, info: '0 Klassen · 0 feste Schichten · b/br/span style bleiben' };
    },
  },
];
