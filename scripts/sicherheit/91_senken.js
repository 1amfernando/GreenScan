// Gruppe w2 (v33.59): Nachzuegler-Senken — Arten aus KI/Scan in der Laufzeit-DB,
// Artdetail, Scan-Pruefwerk, KI-Felder, Tagebuch, Wissens-Tabellen, Marktplatz-Emoji.
// Jeder Fall ruft die ECHTE Funktion mit einem feindlichen Wert und misst die
// WIRKUNG (window.__pwned, gerenderte <img src=x>, Klick auf den Knopf) — und
// prueft in derselben Fahrt, dass der gutartige Wert weiter dasteht.
'use strict';

const IMG = 'img[src="x"]';

module.exports = [
  {
    name: 'w2 · gsSaveConfirmedScan: ein KI-Name mit Auszeichnung kommt nicht in DB/gs_confirmed_species; ein guter Name kommt mit gesaeuberten Feldern, tox als Zahl, _unverified — Liste, Suche und Detail fuehren nichts aus',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B }) => {
        const vorher = DB.length;
        try { localStorage.removeItem('gs_confirmed_species'); } catch (_) {}
        window.sbFetch = async () => ({ data: [{ id: 1 }], error: null });
        gsSaveConfirmedScan({ name: 'Bosname ' + B, latin: 'Xx yy', confidence: 99 });
        gsSaveConfirmedScan({ name: "Zz Scanprobe d'Or", latin: 'Scanus ' + B, confidence: 99 });   // Latein boese → verworfen
        gsSaveConfirmedScan({ name: "Zz Scankraut d'Or", latin: 'Scanus probus', family: 'Probaceae', category: '<b>x</b>',
          description: 'Beschr ' + B, season: 'Mai ' + B, habitat: 'Wald ' + B, toxicity: B, edible: 'ja', confidence: 99 });
        const neu = DB.slice(vorher);
        const gesp = JSON.parse(localStorage.getItem('gs_confirmed_species') || '[]');
        const gut = neu.find(s => /Scankraut/.test(s.name)) || {};
        const felder = Object.keys(gut).filter(k => /[<>]/.test(String(gut[k])));
        window._gsSearchIdx = null;
        doSearch('scankraut'); await new Promise(res => setTimeout(res, 450));
        const l = document.getElementById('results-list');
        const listeNamen = l ? Array.from(l.querySelectorAll('.sp-name')).map(n => n.textContent) : [];
        const listeImgs = l ? l.querySelectorAll('img[src="x"]').length : -1;
        if (gut.id) { openDetail(gut.id); await new Promise(res => setTimeout(res, 400)); }
        const mc = document.getElementById('modal-content');
        const detImgs = mc ? mc.querySelectorAll('img[src="x"]').length : -1;
        const detName = mc ? (mc.textContent || '').indexOf("Zz Scankraut d'Or") >= 0 : false;
        try { closeModal('detail-modal'); } catch (_) {}
        doSearch(''); await new Promise(res => setTimeout(res, 200));
        DB.splice(vorher, DB.length - vorher); window._gsSearchIdx = null;
        return { namen: neu.map(s => s.name), gespeichert: gesp.map(s => s.name), felder, tox: gut.tox, edible: gut.edible, unv: gut._unverified, cat: gut.cat,
          listeNamen, listeImgs, detImgs, detName };
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify(r) };
      if (r.namen.length !== 1 || r.namen[0] !== "Zz Scankraut d'Or") return { ok: false, warum: 'DB-Eintraege: ' + JSON.stringify(r.namen) };
      if (r.gespeichert.some(n => /[<>]/.test(n)) || r.gespeichert.length !== 1) return { ok: false, warum: 'gs_confirmed_species: ' + JSON.stringify(r.gespeichert) };
      if (r.felder.length) return { ok: false, warum: 'Felder mit < >: ' + r.felder.join(', ') };
      if (r.tox !== null || r.edible !== false || r.unv !== true || r.cat !== 'wildpflanze') return { ok: false, warum: 'Typen: ' + JSON.stringify({ tox: r.tox, edible: r.edible, unv: r.unv, cat: r.cat }) };
      if (r.listeImgs || r.listeNamen.indexOf("Zz Scankraut d'Or") < 0) return { ok: false, warum: 'Liste: ' + JSON.stringify({ n: r.listeNamen, i: r.listeImgs }) };
      if (r.detImgs || !r.detName) return { ok: false, warum: 'Detail: ' + JSON.stringify({ i: r.detImgs, n: r.detName }) };
      return { ok: true, info: '2 von 3 verworfen (Tag in Name/Latein) · 0 Felder mit <> · tox null, edible false, _unverified · Liste und Detail zeigen "Zz Scankraut d\'Or"' };
    },
  },
  {
    name: 'w2 · gsAutoEnrichNewSpecies: das KI-Profil geht durch dieselbe Regel (Felder-Allowlist, emoji aus der Kategorie, tox 0–5, _unverified) — Menuesuche und Detail fuehren nichts aus',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B }) => {
        const vorher = DB.length;
        try { localStorage.removeItem('gs_user_species_db'); } catch (_) {}
        window.getApiConfig = () => ({ key: 'k', source: 'own' });
        window.sbFetch = async () => ({ data: [], error: null });
        let antwort = null;
        window.callAI = async () => JSON.stringify(antwort);
        antwort = { name: 'Boese ' + B, lat: 'Aa bb', cat: 'pilz' };
        await gsAutoEnrichNewSpecies({ name: 'Zz Ki Boese', confidence: 90 });
        antwort = { name: 'Zz Kiprobe', lat: 'Kius probus', fam: 'Kiaceae', cat: 'pilz', emoji: B, desc: 'Text ' + B, season: 'Mai', tox: '9',
          edible: true, lightMin: '<b>', onclick: 'window.__pwned=9', __proto__x: 1, bookRef: B };
        await gsAutoEnrichNewSpecies({ name: 'Zz Kiprobe', confidence: 90 });
        const neu = DB.slice(vorher);
        const gut = neu.find(s => s.name === 'Zz Kiprobe') || {};
        // Menuesuche
        const res = document.getElementById('menu-search-results');
        searchMenu('kiprobe'); await new Promise(x => setTimeout(x, 100));
        const menuImgs = res ? res.querySelectorAll('img[src="x"]').length : -1;
        const menuText = res ? (res.textContent || '').indexOf('Zz Kiprobe') >= 0 : false;
        searchMenu('');
        if (gut.id) { openDetail(gut.id); await new Promise(x => setTimeout(x, 400)); }
        const mc = document.getElementById('modal-content');
        const detImgs = mc ? mc.querySelectorAll('img[src="x"]').length : -1;
        try { closeModal('detail-modal'); } catch (_) {}
        DB.splice(vorher, DB.length - vorher); window._gsSearchIdx = null;
        return { namen: neu.map(s => s.name), emoji: gut.emoji, tox: gut.tox, unv: gut._unverified, onclick: 'onclick' in gut, bookRef: 'bookRef' in gut,
          lightMin: gut.lightMin, felder: Object.keys(gut).filter(k => /[<>]/.test(String(gut[k]))), menuImgs, menuText, detImgs };
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify(r) };
      if (r.namen.length !== 1 || r.namen[0] !== 'Zz Kiprobe') return { ok: false, warum: 'DB-Eintraege: ' + JSON.stringify(r.namen) };
      if (r.emoji !== '🍄') return { ok: false, warum: 'emoji nicht aus der Kategorie: ' + r.emoji };
      if (r.tox !== 5 || r.unv !== true) return { ok: false, warum: 'tox/_unverified: ' + JSON.stringify({ tox: r.tox, unv: r.unv }) };
      if (r.onclick || r.bookRef || r.lightMin !== undefined) return { ok: false, warum: 'unbekannte/falsch typisierte Felder uebernommen: ' + JSON.stringify(r) };
      if (r.felder.length) return { ok: false, warum: 'Felder mit < >: ' + r.felder.join(', ') };
      if (r.menuImgs || !r.menuText || r.detImgs) return { ok: false, warum: 'Anzeige: ' + JSON.stringify(r) };
      return { ok: true, info: 'Name mit Tag verworfen · emoji 🍄 aus der Kategorie · tox "9"→5 · onclick/bookRef verworfen · Menuesuche zeigt "Zz Kiprobe"' };
    },
  },
  {
    name: 'w2 · Artdetail als Senke (Eintrag an jeder Quelle vorbei): „Aehnliche Arten" (Name, Latein, Id), Giftstufe und Buch-Referenz bleiben Text; Klick auf die aehnliche Art oeffnet sie',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B, OC }) => {
        const vorher = DB.length;
        DB.push({ id: 'ZZ_A1', name: 'Zz Hauptart', lat: 'Zzus hauptus', fam: 'Zzfamilia', cat: 'kraut', season: 'Mai', tox: B, bookRef: 'S. 12 ' + B, desc: 'd' });
        DB.push({ id: 'ZZ_A2' + OC, name: 'Zz Nachbar ' + B, lat: 'Zzus ' + B, fam: 'Zzfamilia', cat: 'kraut', season: 'Mai', desc: 'd' });
        DB.push({ id: 'ZZ_A3', name: "Zz Nachbar d'Or", lat: 'Zzus gut', fam: 'Zzfamilia', cat: 'kraut', season: 'Mai', desc: 'd' });
        openDetail('ZZ_A1'); await new Promise(x => setTimeout(x, 400));
        const mc = document.getElementById('modal-content');
        const imgs = mc ? mc.querySelectorAll('img[src="x"]').length : -1;
        const txt = mc ? mc.textContent : '';
        const nachbarn = mc ? Array.from(mc.querySelectorAll('[onclick*="openDetail"]')).filter(e => /Zz Nachbar/.test(e.textContent)) : [];
        let geoeffnet = null;
        const gut = nachbarn.find(e => /d'Or/.test(e.textContent));
        const boes = nachbarn.find(e => !/d'Or/.test(e.textContent));
        const echt = window.openDetail;
        window.openDetail = (id) => { geoeffnet = (geoeffnet || []).concat([id]); };
        try { if (boes) boes.click(); if (gut) gut.click(); await new Promise(x => setTimeout(x, 250)); } finally { window.openDetail = echt; }
        try { closeModal('detail-modal'); } catch (_) {}
        DB.splice(vorher, DB.length - vorher); window._gsSearchIdx = null;
        return { imgs, nachbarn: nachbarn.length, buch: /S\. 12/.test(txt), nachbarText: /Zz Nachbar d'Or/.test(txt), boeseSichtbar: txt.indexOf('Zz Nachbar <img') >= 0, geoeffnet };
      }, { B: h.BOESE, OC: h.OC });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify(r) };
      if (r.imgs) return { ok: false, warum: r.imgs + ' <img src=x> im Detail' };
      if (r.nachbarn !== 2 || !r.nachbarText || !r.boeseSichtbar) return { ok: false, warum: 'Aehnliche Arten nicht als Text: ' + JSON.stringify(r) };
      if (!r.buch) return { ok: false, warum: 'Buch-Referenz fehlt' };
      if (!r.geoeffnet || r.geoeffnet.indexOf('ZZ_A3') < 0 || r.geoeffnet.indexOf('ZZ_A2' + h.OC) < 0) return { ok: false, warum: 'Klick kam nicht mit der Id an: ' + JSON.stringify(r.geoeffnet) };
      return { ok: true, info: 'Detail ohne <img> · zwei aehnliche Arten als Text · Ids (auch mit \') kommen unveraendert in openDetail an' };
    },
  },
  {
    // Gegenpruefung: die Aktionsknoepfe des Artdetails (Garten, Sammlung, Foto, Korrektur, Favorit)
    // und Bluetenfarbe/Hoehe — dieselbe Senke, vom ersten Fall nicht beruehrt.
    name: 'w2 · Artdetail Aktionsknoepfe und Oekologie: Id mit \' &#39; " kommt in Garten/Sammlung/Foto/Korrektur/Favorit unveraendert an, Farbe und Hoehe bleiben Text',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B, OC }) => {
        const vorher = DB.length;
        const ID = 'ZZ_B1' + OC + '&#39;);window.__pwned=2;//"';
        DB.push({ id: ID, name: 'Zz Knopfart', lat: 'Zzus knopf', fam: 'Zzfamilia', cat: 'kraut', season: 'Mai', color: 'Gelb ' + B, alt: '500 m ' + B, desc: 'd' });
        openDetail(ID); await new Promise(x => setTimeout(x, 400));
        const mc = document.getElementById('modal-content');
        const imgs = mc ? mc.querySelectorAll('img[src="x"]').length : -1;
        const txt = mc ? mc.textContent : '';
        const namen = ['gsAddSpeciesToGarden', 'gsAddSpeciesToCollection', 'gsContributeSpeciesPhoto', 'gsKorrekturOeffnen', 'toggleFav'];
        const echt = {}; const an = {};
        namen.forEach(n => { echt[n] = window[n]; window[n] = (a) => { an[n] = a; }; });
        const fehler = [];
        try {
          namen.forEach(n => {
            const el = mc && Array.from(mc.querySelectorAll('[onclick]')).find(e => e.getAttribute('onclick').indexOf(n + '(') >= 0);
            if (!el) { fehler.push(n + ' fehlt'); return; }
            try { el.click(); } catch (e) { fehler.push(n + ': ' + e.message); }
          });
          await new Promise(x => setTimeout(x, 150));
        } finally { namen.forEach(n => { window[n] = echt[n]; }); }
        try { closeModal('detail-modal'); } catch (_) {}
        if (mc) mc.innerHTML = '';   // Rueckstand eines roten Laufs verfaelscht sonst spaetere Faelle
        DB.splice(vorher, DB.length - vorher); window._gsSearchIdx = null;
        return { imgs, ID, an, fehler, farbe: txt.indexOf('Gelb <img') >= 0, hoehe: txt.indexOf('500 m <img') >= 0 };
      }, { B: h.BOESE, OC: h.OC });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify(r) };
      if (r.imgs) return { ok: false, warum: r.imgs + ' <img src=x> im Detail' };
      if (!r.farbe || !r.hoehe) return { ok: false, warum: 'Farbe/Hoehe nicht als Text: ' + JSON.stringify(r) };
      const falsch = Object.keys(r.an).filter(n => r.an[n] !== r.ID);
      if (r.fehler.length || falsch.length || Object.keys(r.an).length !== 5) return { ok: false, warum: 'Id kam nicht unveraendert an: ' + JSON.stringify({ fehler: r.fehler, an: r.an }) };
      return { ok: true, info: '0 <img> · Farbe und Hoehe als Text · fuenf Knoepfe liefern die Id mit \' &#39; " unveraendert' };
    },
  },
  {
    name: 'w2 · Namensvorschlaege (_gsRenderSugList): Emoji eines Online-Treffers ist Text bzw. Rueckfall, ein echtes Emoji bleibt',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(({ B }) => {
        const d = document.createElement('div'); document.body.appendChild(d);
        _gsRenderSugList([{ name: 'Zz Online', lat: 'X y', emoji: B, _remote: true }, { name: 'Zz Gut', emoji: '🌻' }], 'zz', d);
        const out = { imgs: d.querySelectorAll('img[src="x"]').length, gut: d.textContent.indexOf('🌻') >= 0, name: d.textContent.indexOf('Zz Online') >= 0 };
        d.remove(); return out;
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null || r.imgs) return { ok: false, warum: 'Code/Bild: ' + JSON.stringify({ p, r }) };
      if (!r.gut || !r.name) return { ok: false, warum: 'gutartiges Emoji/Name fehlt: ' + JSON.stringify(r) };
      return { ok: true, info: '0 <img> · 🌻 und Name stehen da' };
    },
  },
  {
    name: 'w2 · Scan-Chat: ein Emoji aus dem Scan-Ergebnis (KI) wird nicht als HTML gesetzt; ein echtes Emoji bleibt',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(({ B }) => {
        let log = document.getElementById('scan-chat-log'); let neu = false;
        if (!log) { log = document.createElement('div'); log.id = 'scan-chat-log'; document.body.appendChild(log); neu = true; }
        log.innerHTML = '';
        _lastScanResult = { name: 'X', emoji: B };
        addScanChatMsg('assistant', 'Hallo');
        const imgs = log.querySelectorAll('img[src="x"]').length;
        _lastScanResult = { name: 'X', emoji: '🍄' };
        addScanChatMsg('assistant', 'Zwei');
        const gut = log.textContent.indexOf('🍄') >= 0;
        log.innerHTML = ''; if (neu) log.remove();
        _lastScanResult = null;
        return { imgs, gut };
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null || r.imgs) return { ok: false, warum: 'Code/Bild: ' + JSON.stringify({ p, r }) };
      if (!r.gut) return { ok: false, warum: 'echtes Emoji fehlt' };
      return { ok: true, info: '0 <img> · 🍄 steht da' };
    },
  },
  {
    name: 'w2 · Pflanzendoktor (runDiagnosis): problems[].confidence und urgency aus der KI nur als Zahl bzw. bekannter Wert — 85 % und „SOFORT" bleiben',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B }) => {
        let res = document.getElementById('diag-result'); let neu = false;
        if (!res) { res = document.createElement('div'); res.id = 'diag-result'; document.body.appendChild(res); neu = true; }
        try { diagImageData = null; } catch (_) {}
        const echt = window.callAI;
        let antwort;
        window.callAI = async () => JSON.stringify(antwort);
        antwort = { severity: 'mild', diagnosis: 'D', problems: [{ name: 'P', cause: 'C', confidence: B }], treatment: 't', urgency: B };
        await runDiagnosis();
        const imgs1 = res.querySelectorAll('img[src="x"]').length;
        antwort = { severity: 'mild', diagnosis: 'D', problems: [{ name: 'P', cause: 'C', confidence: 85 }], treatment: 't', urgency: 'sofort' };
        await runDiagnosis();
        const t = res.textContent;
        window.callAI = echt;
        const out = { imgs1, prozent: /85% sicher/.test(t), sofort: /SOFORT/.test(t) };
        if (neu) res.remove();
        return out;
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null || r.imgs1) return { ok: false, warum: 'Code/Bild: ' + JSON.stringify({ p, r }) };
      if (!r.prozent || !r.sofort) return { ok: false, warum: 'gutartige Werte fehlen: ' + JSON.stringify(r) };
      return { ok: true, info: '0 <img> · „85% sicher" und „SOFORT" stehen da' };
    },
  },
  {
    name: 'w2 · Eigene Daten: Doktor-Auswahl, Pflanzen-Tagebuch (Titel, Foto, Titelbild, Loesch-Knopf), Tagebuch-Formular und Faellig-Karten — kein Code, Namen mit Apostroph stehen da',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B, OC }) => {
        const alt = Date.now() - 9 * 864e5;
        myPlants = [
          { id: 'w2a' + OC, name: 'Zz ' + B, nick: 'N ' + B, lat: 'Lat ' + B, emoji: '🌿', photo: 'https://x.example/a.jpg") ;}</style><img src=x onerror="window.__pwned=5">',
            diary: [{ ts: new Date().toISOString(), action: 'note', title: 'T ' + B, photo: 'x" onerror="window.__pwned=6' }],
            tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } },
          { id: 'w2b', name: "Tom's Basilikum", lat: 'Ocimum basilicum', emoji: '🌿', diary: [], tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } },
        ];
        window.myPlants = myPlants;
        const out = {};
        // Doktor-Auswahl
        try { openDiagnosisCamera(); } catch (e) { out.diagErr = String(e); }
        await new Promise(x => setTimeout(x, 200));
        const sel = document.getElementById('diag-plant-sel');
        out.selOpts = sel ? Array.from(sel.options).map(o => o.text) : null;
        out.selVal = sel ? Array.from(sel.options).map(o => o.value) : null;
        try { closeModal('modal-diagnosis'); } catch (_) {}
        // Tagebuch
        openPlantDiary('w2a' + OC);
        await new Promise(x => setTimeout(x, 200));
        const m = document.getElementById('plant-diary-modal');
        out.dImgs = m ? m.querySelectorAll('img[src="x"]').length : -1;
        out.dTitel = m ? m.textContent.indexOf('T <img') >= 0 : false;
        let geloescht = null;
        const echt = window.gsDeleteDiaryEntry;
        window.gsDeleteDiaryEntry = (pid) => { geloescht = pid; };
        const btn = m && Array.from(m.querySelectorAll('button')).find(b => /gsDeleteDiaryEntry/.test(b.getAttribute('onclick') || ''));
        try { if (btn) btn.click(); } finally { window.gsDeleteDiaryEntry = echt; }
        out.geloescht = geloescht;
        if (m) m.remove();
        // Tagebuch-Formular (Ernte)
        let box = document.getElementById('diary-conditional-fields'); let neuBox = false;
        if (!box) { box = document.createElement('div'); box.id = 'diary-conditional-fields'; document.body.appendChild(box); neuBox = true; }
        window._gsDiaryState = window._gsDiaryState || {}; window._gsDiaryState.type = 'harvest';
        gsDiaryRenderConditional();
        out.fImgs = box.querySelectorAll('img[src="x"]').length;
        out.fOpts = Array.from(box.querySelectorAll('option')).map(o => o.text);
        if (neuBox) box.remove(); else box.innerHTML = '';
        return out;
      }, { B: h.BOESE, OC: h.OC });
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify(r) };
      if (r.dImgs) return { ok: false, warum: 'Tagebuch: ' + r.dImgs + ' <img src=x>' };
      if (!r.dTitel) return { ok: false, warum: 'Tagebuch-Titel nicht als Text' };
      if (r.geloescht !== 'w2a' + h.OC) return { ok: false, warum: 'Loesch-Knopf: Id kam nicht unveraendert an: ' + JSON.stringify(r.geloescht) };
      if (r.selOpts && (r.selOpts.join('|').indexOf("Tom's Basilikum") < 0 || r.selOpts.join('|').indexOf('Zz <img') < 0)) return { ok: false, warum: 'Doktor-Auswahl: ' + JSON.stringify(r.selOpts) };
      if (r.fImgs || !r.fOpts.some(t => /Tom's Basilikum \(Ocimum basilicum\)/.test(t)) || !r.fOpts.some(t => /Lat <img/.test(t))) return { ok: false, warum: 'Formular: ' + JSON.stringify(r) };
      return { ok: true, info: 'Tagebuch ohne <img>, Titel als Text, Loesch-Id mit \' kommt an · Doktor-Auswahl ' + (r.selOpts ? r.selOpts.length + ' Optionen als Text' : 'nicht geoeffnet') + ' · Formular-Optionen als Text' };
    },
  },
  {
    name: 'w2 · Faellig-Karten (Pflanzen-Tab): Pflanzen-Id mit \' und &#39; im Erledigt-/Verschieben-Knopf kommt unveraendert an',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ OC, OCQ }) => {
        const alt = Date.now() - 9 * 864e5;
        myPlants = [OC, OCQ].map(id => ({ id, name: 'A', emoji: '🌿', tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } }));
        window.myPlants = myPlants;
        try { switchTab('plants'); } catch (_) {}
        try { renderMyPlants(); } catch (e) { return { err: String(e) }; }
        await new Promise(x => setTimeout(x, 500));
        const knoepfe = Array.from(document.querySelectorAll('[onclick*="gsSnoozeTask"],[onclick*="gsDueCardDone"]'));
        const an = [];
        const e1 = window.gsSnoozeTask, e2 = window.gsDueCardDone;
        window.gsSnoozeTask = (id) => an.push(id); window.gsDueCardDone = (_, id) => an.push(id);
        try { knoepfe.forEach(k => { try { k.click(); } catch (_) {} }); } finally { window.gsSnoozeTask = e1; window.gsDueCardDone = e2; }
        return { n: knoepfe.length, an };
      }, { OC: h.OC, OCQ: h.OCQ });
      await h.warte(300);
      const p = await h.pwned();
      if (r.err) return { ok: false, warum: 'renderMyPlants: ' + r.err };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (!r.n) return { ok: false, warum: 'keine Faellig-Karten gerendert — der Fall misst nichts' };
      // Garten-Pflanzungen aus _seed.js (plant_seed_*) stehen ebenfalls in der Liste — gezaehlt werden unsere zwei
      const unsere = r.an.filter(id => /^x/.test(String(id)));
      if (unsere.some(id => id !== h.OC && id !== h.OCQ) || unsere.indexOf(h.OC) < 0 || unsere.indexOf(h.OCQ) < 0) return { ok: false, warum: 'Id veraendert: ' + JSON.stringify(r.an) };
      return { ok: true, info: r.n + ' Knoepfe, Ids unveraendert' };
    },
  },
  {
    name: 'w2 · Pilz-Scan VAPKO-Box: ein javascript:-Link wird kein Anker, ein https-Link schon (noopener)',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(() => {
        const ed = s => escHtml(s);
        const d = document.createElement('div'); document.body.appendChild(d);
        d.innerHTML = gsMushroomVapkoBox({ vapko_required: true, vapko_link: 'javascript:window.__pwned=4', vapko_phone: '044 "1"' }, ed);
        const boeseA = Array.from(d.querySelectorAll('a')).filter(a => /^javascript:/i.test(a.getAttribute('href') || '')).length;
        d.innerHTML = gsMushroomVapkoBox({ vapko_required: true, vapko_link: 'https://vapko.ch/kontrollstellen' }, ed);
        const gut = d.querySelector('a[href="https://vapko.ch/kontrollstellen"]');
        const out = { boeseA, gut: !!gut, rel: gut ? gut.getAttribute('rel') : '' };
        d.remove(); return out;
      });
      if (r.boeseA) return { ok: false, warum: 'javascript:-Anker gerendert' };
      if (!r.gut || !/noopener/.test(r.rel)) return { ok: false, warum: 'https-Link fehlt: ' + JSON.stringify(r) };
      return { ok: true, info: 'javascript: → kein Anker · https bleibt mit rel=' + r.rel };
    },
  },
  {
    name: 'w2 · Wissens-Tabellen (gsRenderWissenWave9) und Wissenssuche (_gsKnResultCard): Kategorie/slug/source_id mit \' und &#39; kommen unveraendert im Handler an',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ OC, OCQ }) => {
        const out = { karte: [], fehler: [] };
        // _gsKnResultCard: Knopf rendern und klicken
        const d = document.createElement('div'); document.body.appendChild(d);
        window.sbIsLoggedIn = () => true;
        d.innerHTML = window._gsKnResultCard({ source_type: 'recipes', source_id: OC, title: 'T' }) + window._gsKnResultCard({ source_type: 'recipes', source_id: OCQ, title: 'U' });
        const e1 = window.gsKnTrackView, e2 = window.gsKnBmToggle;
        window.gsKnTrackView = (st, sid) => out.karte.push(sid);
        window.gsKnBmToggle = (st, sid) => out.karte.push('bm:' + sid);
        try {
          d.querySelectorAll('[onclick*="gsKnBmToggle"]').forEach(s => { try { s.click(); } catch (e) { out.fehler.push(String(e)); } });
          d.querySelectorAll('button').forEach(b => { try { new Function(b.getAttribute('onclick').split('document.getElementById')[0])(); } catch (e) { out.fehler.push(String(e)); } });
        } finally { window.gsKnTrackView = e1; window.gsKnBmToggle = e2; d.remove(); }
        return out;
      }, { OC: h.OC, OCQ: h.OCQ });
      // Wave9: per Quelltext-Bauform — die Funktion braucht Server-Tabellen; gemessen wird der erzeugte Knopf
      const w = await seite.evaluate(async ({ OC, OCQ }) => {
        const out = { an: [], n: 0 };
        const echt = window.sbFetch;
        window._gsWave9Cache = {};
        window.sbFetch = async () => ({ data: [{ id: 'r1', slug: OC, name_de: 'A', difficulty: OCQ }, { id: 'r2', slug: OCQ, name_de: 'B', difficulty: "Gärtner's" }], error: null });
        let host = document.getElementById('wissen-content'); let neu = false;
        if (!host) { host = document.createElement('div'); host.id = 'wissen-content'; document.body.appendChild(host); neu = true; }
        const e1 = window.gsWave9Filter, e2 = window.gsWave9OpenDetail;
        try { await gsRenderWissenWave9('kompost'); } catch (e) { out.err = String(e); }
        await new Promise(x => setTimeout(x, 300));
        const hosts = document.querySelectorAll('[onclick*="gsWave9Filter"],[onclick*="gsWave9OpenDetail"]');
        window.gsWave9Filter = (s, c) => out.an.push(c); window.gsWave9OpenDetail = (s, id) => out.an.push(id);
        try { hosts.forEach(k => { out.n++; try { k.click(); } catch (_) {} }); } finally { window.gsWave9Filter = e1; window.gsWave9OpenDetail = e2; window.sbFetch = echt; window._gsWave9Cache = {}; if (neu) host.remove(); else host.innerHTML = ''; }
        return out;
      }, { OC: h.OC, OCQ: h.OCQ });
      await h.warte(200);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify({ r, w }) };
      const erwart = [h.OC, h.OCQ];
      if (r.fehler.length) return { ok: false, warum: 'Knopf parst nicht: ' + r.fehler[0] };
      if (!erwart.every(x => r.karte.indexOf(x) >= 0 && r.karte.indexOf('bm:' + x) >= 0)) return { ok: false, warum: 'Wissenssuche: Id veraendert: ' + JSON.stringify(r.karte) };
      if (w.n && w.an.some(x => [h.OC, h.OCQ, '', "Gärtner's", 'r1', 'r2'].indexOf(x) < 0)) return { ok: false, warum: 'Wave9: Wert veraendert: ' + JSON.stringify(w.an) };
      return { ok: true, info: 'Wissenssuche: 4 Handler mit unveraenderter Id · Wave9: ' + (w.n ? w.n + ' Knoepfe geklickt, Werte unveraendert' : 'nicht gerendert (' + (w.err || 'keine Sektion') + ')') };
    },
  },
  {
    name: 'w2 · Marktplatz Gebot-Fenster und „Meine Kaeufe": Inserat-Emoji aus fremder Hand ist Text bzw. Rueckfall',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B }) => {
        const out = {};
        const l = { id: 'l_w2', title: "Gärtner's Setzlinge", emoji: B, currentBid: 1, startBid: 1, bidStep: 1, bidCount: 0, endTime: Date.now() + 864e5, isAuction: true, seller: 's' };
        marketListings = [l];
        let info = document.getElementById('bid-listing-info'); let neu = false;
        if (!info) { info = document.createElement('div'); info.id = 'bid-listing-info'; document.body.appendChild(info); neu = true; }
        try { placeBid('l_w2'); } catch (e) { out.err = String(e); }
        await new Promise(x => setTimeout(x, 200));
        out.imgs = document.querySelectorAll('#bid-listing-info img[src="x"]').length;
        out.titel = (document.getElementById('bid-listing-info') || {}).textContent || '';
        try { closeModal('modal-bid'); } catch (_) {}
        if (neu) info.remove();
        return out;
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null || r.imgs) return { ok: false, warum: 'Code/Bild: ' + JSON.stringify({ p, r }) };
      if (r.err) return { ok: false, warum: 'placeBid: ' + r.err };
      if (r.titel.indexOf("Gärtner's Setzlinge") < 0) return { ok: false, warum: 'Titel fehlt: ' + r.titel };
      return { ok: true, info: '0 <img> · Titel steht da' };
    },
  },
  {
    name: 'w2 · Scan-Pruefwerk: Saison, Farbe, Buch-Referenz und Name eines DB-Eintrags (an jeder Quelle vorbei) stehen als Text in den Zeilen — <b> der Farb-Regel bleibt, scan_check-Woerter bleiben',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B }) => {
        const vorher = DB.length;
        DB.push({ id: 'ZZ_PW', name: 'Zz Pruefkraut', lat: 'Zzus pruefus', cat: 'kraut', season: 'Juni ' + B, color: 'Weiss ' + B, bookRef: 'B ' + B, tox: 4, edible: false, desc: 'd' });
        showScanResult({ name: 'Zz Pruefkraut', latin: 'Zzus pruefus', confidence: 80, toxicity: 1, toxic: false, edible: true, alternatives: [] });
        await new Promise(x => setTimeout(x, 600));
        const sr = document.getElementById('scan-result');
        const out = { imgs: sr ? sr.querySelectorAll('img[src="x"]').length : -1, txt: sr ? sr.textContent : '' };
        const pw = _gsScanPruefwerk({ name: 'Zz Pruefkraut', latin: 'Zzus pruefus', confidence: 80, toxicity: 1, edible: true, alternatives: [] });
        out.regeln = pw.regeln.map(x => x.text);
        try { if (typeof closeScanResult === 'function') closeScanResult(); } catch (_) {}
        DB.splice(vorher, DB.length - vorher); window._gsSearchIdx = null;
        return out;
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null || r.imgs) return { ok: false, warum: 'Code/Bild: ' + JSON.stringify({ p, imgs: r.imgs }) };
      const alle = r.regeln.join(' | ');
      if (/<img/.test(alle)) return { ok: false, warum: 'Regeltext traegt rohes <img: ' + alle.slice(0, 300) };
      if (!/Zz Pruefkraut/.test(alle) || !/&lt;img/.test(alle)) return { ok: false, warum: 'Regeln nennen Wert nicht als Text: ' + alle.slice(0, 300) };
      return { ok: true, info: '0 <img> · ' + r.regeln.length + ' Regeln, Werte als &lt;…&gt;' };
    },
  },
  {
    name: 'w2 · Planer-Pruefwerk (gsPPrenderPlan): Zahlen der Regeln (spacing, braucht, hat, passt, Wasser) als Text; ein db_id, das nicht in DB steht, wird kein Link',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ({ B }) => {
        const host = document.createElement('div'); document.body.appendChild(host);
        const plan = { summary: 's', bed: { width_m: 4, length_m: 3 }, plants: [{ name: 'Kohl', w_m: 1, h_m: 1, x_m: 0, y_m: 0, count: 2, db_id: 'GIBTS_NICHT' }],
          _dichte: { eng: [{ name: 'Kohl', count: 2, spacing: B, braucht: B, hat: B, passt: B }], ok: 0 },
          _wasser: { bedarf: B, zusatz: null, flaeche: B, prognose: null, gemessen: null } };
        let html = '';
        try { html = gsPPrenderPlan(plan, {}); } catch (e) { return { err: String(e) }; }
        host.innerHTML = typeof html === 'string' ? html : '';
        if (!host.innerHTML) { const pp = document.getElementById('pp-result') || document.getElementById('modal-planner-pro'); if (pp) host.innerHTML = pp.innerHTML; }
        await new Promise(x => setTimeout(x, 300));
        const out = { imgs: document.querySelectorAll('img[src="x"]').length, links: host.querySelectorAll('[onclick*="GIBTS_NICHT"]').length, len: host.innerHTML.length, kohl: /Kohl/.test(host.textContent) };
        host.remove();
        return out;
      }, { B: h.BOESE });
      await h.warte(350);
      const p = await h.pwned();
      if (r.err) return { ok: false, warum: 'gsPPrenderPlan wirft: ' + r.err };
      if (p !== null || r.imgs) return { ok: false, warum: 'Code/Bild: ' + JSON.stringify({ p, r }) };
      if (r.links) return { ok: false, warum: 'db_id ohne DB-Eintrag wurde ein Link' };
      if (!r.kohl) return { ok: false, warum: 'Plan nicht gerendert: ' + JSON.stringify(r) };
      return { ok: true, info: '0 <img> · kein Link fuer ein unbekanntes db_id · Plan gerendert (' + r.len + ' Zeichen)' };
    },
  },
];
