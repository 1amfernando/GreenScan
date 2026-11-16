// Gruppe w5 — Nebenbefunde der Sicherheitspruefung (v33.59): Funktionen, die still
// nichts tun. Keine Luecken, aber Zusagen ohne Wirkung — der Wissens-Cache, der nie
// gefuellt wurde, das Tagebuch-Foto, das nie erschien, ein Wetterkasten ohne Kasten,
// „kopiert" vor dem Ergebnis. Jeder Fall faehrt die ECHTE Funktion und misst, was
// danach wirklich dasteht — und den feindlichen Wert daneben.
// (Die Feedback-Stimmen sind eine Server-Frage: scripts/rls/60_feedback.js.)
'use strict';

const FREMD = 'img[src="x"], img[onerror], [onmouseover], b.boese';
const SPEICHER = 'https://xyzcompany.supabase.co/storage/v1/object/public/garden-diary-photos/u1/';

// Gestelltes sbFetch: der Wissens-Pull bekommt je Tabelle eine Antwort in der
// FORM, die sbFetch wirklich liefert ({data, error}) — keine nackte Liste.
async function wissenPull(seite, modus, boese) {
  return seite.evaluate(async ([modus, boese]) => {
    const alt = window.sbFetch;
    window.sbFetch = async function (pfad) {
      if (modus === 'fehler') return { data: null, error: { message: 'Failed to fetch', status: 0 } };
      if (pfad.indexOf('/rest/v1/species') === 0) return { data: [
        { id: 'w5-feuerlilie', name: 'Feuerlilie Wfuenf', lat: 'Lilium bulbiferum', description: 'Orange Bluete, geschuetzt' },
        { id: 'w5-boese', name: 'Wfuenf ' + boese, lat: 'Boesus', description: boese },
      ], error: null };
      if (pfad.indexOf('/rest/v1/recipes') === 0) return { data: [{ id: 'w5-r1', title: "Holunder-Sirup Wfuenf (Tom's)", description: 'Bluetensirup' }], error: null };
      return { data: [], error: null };
    };
    let r;
    try { r = await window.gsKnowledgePull(true); } finally { window.sbFetch = alt; }
    return r === undefined ? null : r;
  }, [modus, boese]);
}

async function univSuche(seite, h, q) {
  await seite.evaluate((q) => {
    try { window.gsCloseUniversalSearch && window.gsCloseUniversalSearch(); } catch (e) {}
    window.gsOpenUniversalSearch();
    const i = document.getElementById('gs-univ-input');
    i.value = q; i.dispatchEvent(new Event('input', { bubbles: true }));
  }, q);
  await h.warte(700);
  const r = await seite.evaluate((fremd) => {
    const b = document.getElementById('gs-univ-results');
    const out = b ? { text: b.textContent, fremd: b.querySelectorAll(fremd).length, treffer: b.querySelectorAll('.gs-univ-hit').length } : null;
    try { window.gsCloseUniversalSearch && window.gsCloseUniversalSearch(); } catch (e) {}
    return out;
  }, FREMD);
  return r;
}

// Zwischenablage gestellt: writeText gibt ein Promise zurueck, das der Fall selbst
// erfuellt oder ablehnt. Gezaehlt wird jede Meldung — mit dem Zeitpunkt relativ
// zum Ergebnis.
async function ablageStellen(seite) {
  await seite.evaluate(() => {
    window.__ablage = { geschrieben: [], meldungen: [], offen: null };
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: function (t) {
      window.__ablage.geschrieben.push(t);
      return new Promise(function (ja, nein) { window.__ablage.offen = { ja: ja, nein: nein }; });
    } } });
    if (!window.__toastOrig) window.__toastOrig = { g: window.gsToast, p: window.showProfileToast };
    window.gsToast = function (m, t) { window.__ablage.meldungen.push((t || '') + '|' + m); };
    window.showProfileToast = function (m, t) { window.__ablage.meldungen.push((t || '') + '|' + m); };
  });
}
async function ablageLoesen(seite, h, ja) {
  const vorher = await seite.evaluate(() => window.__ablage.meldungen.slice());
  await seite.evaluate((ja) => { const o = window.__ablage.offen; if (o) { if (ja) o.ja(); else o.nein(new DOMException('Write permission denied.', 'NotAllowedError')); } }, ja);
  await h.warte(120);
  const nachher = await seite.evaluate(() => window.__ablage.meldungen.slice());
  return { vorher, nachher, geschrieben: await seite.evaluate(() => window.__ablage.geschrieben.slice()) };
}
async function ablageZurueck(seite) {
  await seite.evaluate(() => { if (window.__toastOrig) { window.gsToast = window.__toastOrig.g; window.showProfileToast = window.__toastOrig.p; delete window.__toastOrig; } delete window.__ablage; });
}

module.exports = [
  {
    name: 'Wissens-Cache · gsKnowledgePull liest {data} aus sbFetch: die Universal-Suche findet zwei Zeilen, ein feindlicher Name bleibt Text',
    lauf: async (seite, h) => {
      await wissenPull(seite, 'ok', h.BOESE);
      const gut = await univSuche(seite, h, 'Wfuenf');
      await h.warte(350);
      const p = await h.pwned();
      if (!gut) return { ok: false, warum: '#gs-univ-results fehlt' };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (gut.fremd) return { ok: false, warum: gut.fremd + ' fremde Elemente in der Suche' };
      if (gut.text.indexOf('Feuerlilie Wfuenf') < 0 || gut.text.indexOf("Holunder-Sirup Wfuenf (Tom's)") < 0)
        return { ok: false, warum: 'die Suche findet das gepullte Wissen nicht (' + gut.treffer + ' Treffer: ' + gut.text.slice(0, 160) + ')' };
      if (gut.text.indexOf('onerror') < 0) return { ok: false, warum: 'feindlicher Name nicht als Text sichtbar' };
      return { ok: true, info: gut.treffer + ' Treffer · Art und Rezept aus dem Pull gefunden · feindlicher Name als Text, 0 Elemente' };
    },
  },
  {
    name: 'Wissens-Cache · ein Fehler endet nicht als leere Liste: der Cache bleibt, wie er war, und der Pull sagt „nicht geladen"',
    lauf: async (seite, h) => {
      await wissenPull(seite, 'ok', 'gut');
      const stand = await wissenPull(seite, 'fehler', '');
      const nach = await univSuche(seite, h, 'Feuerlilie Wfuenf');
      if (!nach || nach.text.indexOf('Feuerlilie Wfuenf') < 0) return { ok: false, warum: 'nach einem Fehler ist der Cache leer: ' + (nach && nach.text.slice(0, 120)) };
      const sp = stand && stand.species;
      if (!sp || sp.state !== 'nicht_geladen' || !sp.grund) return { ok: false, warum: 'Rueckgabe sagt nicht „nicht geladen" mit Grund: ' + JSON.stringify(stand) };
      const leer = await seite.evaluate(async () => {
        const alt = window.sbFetch;
        window.sbFetch = async function () { return { data: [], error: null }; };
        let r; try { r = await window.gsKnowledgePull(true); } finally { window.sbFetch = alt; }
        const n = (await window.gsKnowledgeGetAll('species')).length;
        return { r, n };
      });
      if (!leer.r || leer.r.species.state !== 'leer' || leer.n !== 0) return { ok: false, warum: 'eine leere Antwort ist kein „leer": ' + JSON.stringify(leer) };
      return { ok: true, info: 'Fehler: Cache unveraendert, species=' + sp.state + ' (' + sp.grund + ') · leere Antwort: state leer, 0 Zeilen' };
    },
  },
  {
    name: 'Wissens-Suche ohne Netz · der Cache antwortet (sbFetch wirft nie — der alte catch lief nie), eine feindliche Id im onclick bleibt Text',
    lauf: async (seite, h) => {
      // Cache mit einer Art fuellen, deren Id einen '-String bricht; danach die
      // ECHTE Suche — das Netz ist im Pruefstand gekappt, sbFetch liefert einen
      // Fehler ohne HTTP-Status, und genau dann muss der Cache antworten.
      await seite.evaluate(async (oc) => {
        const alt = window.sbFetch;
        window.sbFetch = async function (pfad) {
          if (pfad.indexOf('/rest/v1/species') === 0) return { data: [{ id: oc, name: 'Offlinekraut Wfuenf', lat: 'Herba offline', description: 'aus dem Cache' }], error: null };
          return { data: [], error: null };
        };
        try { await window.gsKnowledgePull(true); } finally { window.sbFetch = alt; }
      }, h.OC);
      const r = await seite.evaluate(async () => {
        const el = document.getElementById('wissen-global-results');
        if (!el) return { da: false };
        await window.gsKnowledgeGlobalSearch('Offlinekraut');
        const knoepfe = Array.from(el.querySelectorAll('button'));
        const out = { da: true, text: el.textContent, n: knoepfe.length };
        knoepfe.forEach(function (b) { try { b.click(); } catch (e) {} });
        return out;
      });
      await h.warte(350);
      const p = await h.pwned();
      if (!r.da) return { ok: false, warum: '#wissen-global-results fehlt' };
      if (p !== null) return { ok: false, warum: 'Code lief beim Antippen (__pwned=' + p + ')' };
      if (r.text.indexOf('Offlinekraut Wfuenf') < 0) return { ok: false, warum: 'ohne Netz antwortet der Cache nicht: ' + r.text.slice(0, 140) };
      return { ok: true, info: r.n + ' Treffer aus dem Cache · Antippen mit feindlicher Id: nichts lief' };
    },
  },
  {
    name: 'Gartentagebuch · das Foto eines Cloud-Eintrags erscheint (ein Feldname: photo), eine fremde Adresse nicht',
    lauf: async (seite, h) => {
      await seite.evaluate(([speicher, boese]) => {
        const t = new Date().toISOString();
        localStorage.setItem('gs_garden_diary_cache', JSON.stringify([
          { id: 'w5a', entry_type: 'photo', title: 'Tomaten bluehen', text: '', photo_url: speicher + 'tomate.jpg', created_at: t },
          { id: 'w5b', entry_type: 'note', title: 'Fremd', text: '', photo_url: 'javascript:window.__pwned=1', created_at: t },
          { id: 'w5c', entry_type: 'note', title: 'Bruch', text: '', photo_url: speicher + 'x.jpg" onerror="window.__pwned=1', created_at: t },
        ]));
        localStorage.setItem('gs_tb_filter', 'all'); localStorage.setItem('gs_tb_search', '');
        openGartenTagebuch();
      }, [SPEICHER, h.BOESE]);
      await h.warte(350);
      const p = await h.pwned();
      const r = await seite.evaluate(([sp, fremd]) => {
        const mc = document.getElementById('modal-content');
        const imgs = mc ? Array.from(mc.querySelectorAll('img')) : [];
        const out = {
          da: !!mc, fremd: mc ? mc.querySelectorAll(fremd).length : -1,
          tomate: imgs.filter(i => i.getAttribute('src') === sp + 'tomate.jpg').length,
          js: imgs.filter(i => /^javascript:/i.test(i.getAttribute('src') || '')).length,
          extra: imgs.filter(i => i.hasAttribute('onerror')).length,
        };
        try { closeModal(); } catch (e) {}
        return out;
      }, [SPEICHER, '[onmouseover], b.boese']);
      await seite.evaluate(() => localStorage.removeItem('gs_garden_diary_cache'));
      if (!r.da) return { ok: false, warum: '#modal-content fehlt' };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.tomate !== 1) return { ok: false, warum: 'das Foto erscheint nicht (' + r.tomate + ' Bilder mit der Speicher-Adresse)' };
      if (r.js || r.extra || r.fremd) return { ok: false, warum: 'fremde Adresse/Attribut: ' + JSON.stringify(r) };
      return { ok: true, info: 'Speicher-Foto 1× im Tagebuch · javascript: 0 · Ausbruch aus src 0' };
    },
  },
  {
    name: 'Pflanzen-Tagebuch · Foto nur ueber eine sichere Adresse, Titel als Text (dieselbe Klasse, Geschwister)',
    lauf: async (seite, h) => {
      await seite.evaluate(([speicher, boese]) => {
        const t = new Date().toISOString();
        myPlants.push({ id: 'w5p', name: 'Basilikum', emoji: '🌿', diary: [
          { ts: t, action: 'photo', title: boese, note: null, photo: speicher + 'basilikum.jpg' },
          { ts: new Date(Date.now() - 1000).toISOString(), action: 'note', title: 'x', note: null, photo: 'x" onerror="window.__pwned=1' },
        ] });
        openPlantDiary('w5p');
      }, [SPEICHER, h.BOESE]);
      await h.warte(400);
      const p = await h.pwned();
      const r = await seite.evaluate(([sp, fremd]) => {
        const box = document.getElementById('plant-diary-modal');
        if (!box) return { da: false };
        const imgs = Array.from(box.querySelectorAll('img')).filter(i => (i.getAttribute('alt') || '') === 'Tagebuch-Foto');
        return { da: true, gut: imgs.filter(i => i.getAttribute('src') === sp + 'basilikum.jpg').length, alle: imgs.length, fremd: box.querySelectorAll(fremd).length, onerr: imgs.filter(i => i.hasAttribute('onerror')).length, text: box.textContent.indexOf('onerror="window.__pwned=1">') >= 0 };
      }, [SPEICHER, FREMD]);
      await seite.evaluate(() => {
        myPlants = myPlants.filter(p => p.id !== 'w5p');
        const m = document.getElementById('plant-diary-modal'); if (m) m.remove();
      });
      if (!r.da) return { ok: false, warum: '#plant-diary-modal fehlt' };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.gut !== 1) return { ok: false, warum: 'das Speicher-Foto erscheint nicht: ' + JSON.stringify(r) };
      if (r.onerr || r.fremd || r.alle !== 1) return { ok: false, warum: 'fremde Adresse/Element: ' + JSON.stringify(r) };
      if (!r.text) return { ok: false, warum: 'feindlicher Titel nicht als Text sichtbar' };
      return { ok: true, info: 'Speicher-Foto 1× · Ausbruch aus src: 0 Bilder · feindlicher Titel als Text' };
    },
  },
  {
    name: 'Gartenwetter · keine Funktion, die in einen Kasten schreibt, den es nicht gibt (refreshGardenWeather) — die Gartenkarte klappt weiter auf',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(() => {
        gardens = [{ id: 'w5g', name: 'Balkon W5', location: 'Zuerich', type: 'balkon' }];
        try { renderGarden(); } catch (e) { return { fehler: String(e.message) }; }
        const out = { fn: typeof window.refreshGardenWeather, kasten: !!document.getElementById('gweather-w5g'), karte: !!document.getElementById('gexpand-w5g') };
        try { toggleGardenCard('w5g'); out.auf = document.getElementById('gexpand-w5g').style.display; } catch (e) { out.fehler = String(e.message); }
        return out;
      });
      await h.warte(700);   // renderGarden plant den Wetter-Aufruf nach 500 ms
      if (r.fehler) return { ok: false, warum: 'Gartenkarte wirft: ' + r.fehler };
      if (!r.karte || r.auf !== 'block') return { ok: false, warum: 'Gartenkarte klappt nicht auf: ' + JSON.stringify(r) };
      if (r.fn === 'function' && !r.kasten) return { ok: false, warum: 'refreshGardenWeather existiert und sucht #gweather-<id> — das legt seit v23.81 niemand mehr an' };
      return { ok: true, info: 'kein toter Wetter-Weg · Gartenkarte klappt auf' };
    },
  },
  {
    name: 'Zwischenablage · „kopiert" kommt NACH dem Ergebnis von writeText, ein Nein sagt es (Einladungscode, App teilen, Beitrag teilen, Erfolg teilen)',
    lauf: async (seite, h) => {
      const faelle = [
        { name: 'Einladungscode', ruf: () => { window._gsPendingInviteCopy = 'ABC123'; window.gsCopyInviteCode(); }, soll: 'ABC123' },
        { name: 'App teilen', ruf: () => { gsShareApp(); }, soll: '?ref=share' },
        { name: 'Beitrag teilen', ruf: () => { window.gsSharePost('w5post'); }, soll: '#post-w5post' },
        { name: 'Erfolg teilen', ruf: () => { window.gsAchShare('w5', 'Erster Scan', null); }, soll: 'green-scan.ch' },
      ];
      const befund = [];
      for (const f of faelle) {
        for (const ja of [true, false]) {
          await ablageStellen(seite);
          await seite.evaluate(f.ruf);
          await h.warte(80);
          const r = await ablageLoesen(seite, h, ja);
          await ablageZurueck(seite);
          const geschrieben = r.geschrieben.some(t => t.indexOf(f.soll) >= 0);
          const frueh = r.vorher.filter(m => /kopiert/i.test(m));
          const ok = r.nachher.filter(m => /kopiert/i.test(m) && !/ging nicht/i.test(m));
          const nein = r.nachher.filter(m => /ging nicht/i.test(m));
          if (!geschrieben) befund.push(f.name + ': nichts in die Ablage geschrieben (' + JSON.stringify(r.geschrieben) + ')');
          else if (frueh.length) befund.push(f.name + ': „kopiert" VOR dem Ergebnis (' + frueh[0] + ')');
          else if (ja && (ok.length !== 1 || nein.length)) befund.push(f.name + ' (Ja): ' + JSON.stringify(r.nachher));
          else if (!ja && (ok.length || nein.length !== 1)) befund.push(f.name + ' (Nein): ' + JSON.stringify(r.nachher));
        }
      }
      // Gegenrichtung: ohne Zwischenablage sagt es die App ebenfalls
      const ohne = await seite.evaluate(async () => {
        const m = []; const g = window.gsToast;
        window.gsToast = function (x) { m.push(x); };
        Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
        let r; try { r = await window.gsKopieren('x'); } catch (e) { r = 'wirft: ' + e.message; } finally { window.gsToast = g; }
        return { r, m };
      });
      if (ohne.r !== false || ohne.m.length !== 1) befund.push('ohne Zwischenablage: ' + JSON.stringify(ohne));
      // Keine Stelle schreibt am einen Weg vorbei
      const roh = await seite.evaluate(() => Array.from(document.scripts).map(s => s.textContent).join('\n').split('clipboard.writeText(').length - 1);
      if (roh !== 1) befund.push(roh + ' Aufrufe von clipboard.writeText im Quelltext (erwartet 1: gsKopieren)');
      if (befund.length) return { ok: false, warum: befund.join(' · ') };
      return { ok: true, info: '4 Wege × Ja/Nein: Meldung erst nach dem Ergebnis, Nein in einem Satz · ohne Ablage: false + Satz · 1 writeText im Quelltext' };
    },
  },
];
