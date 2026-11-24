// k1 — das Scan-Ergebnis und alles, was sein Emoji weitertraegt (v33.59).
// Jeder Fall rendert die ECHTE Funktion mit einem feindlichen Wert und misst
// die WIRKUNG (window.__pwned, entstandene Elemente, gestellte Anfragen) —
// und daneben, dass ein gutartiges Emoji weiter dasteht.
'use strict';

// Rendert in der Seite: legt myPlants fest, ruft die Anzeige, liest Text.
async function pflanzenFall(seite, h, emoji) {
  return seite.evaluate(async (emoji) => {
    const p = { id: 'mp_sich1', name: "Tomate d'Or", nick: '', emoji: emoji, water: 2, sun: 2, notes: '', diary: [], added: new Date().toISOString(),
      tasks: { water: { active: true, intervalDays: 1, lastDone: new Date(Date.now() - 5 * 864e5).toISOString() } } };
    myPlants = [p];
    const out = {};
    const d = document.createElement('div'); document.body.appendChild(d);
    d.innerHTML = gsNewPlantCard(p);
    out.karte = d.textContent.indexOf("Tomate d'Or") >= 0;
    out.karteEmoji = (d.querySelector('.plant-card-emoji') || {}).textContent || '';
    out.kinder = d.querySelectorAll('.plant-card-emoji *').length;
    d.remove();
    // Je Senke einzeln zaehlen: ein Element aus dem Wert (img mit src=x) darf nirgends entstehen.
    const zaehle = () => { const l = document.querySelectorAll('img[src="x"]'); l.forEach(x => x.removeAttribute('src')); return l.length; };
    zaehle();
    try { if (typeof renderMyPlants === 'function') renderMyPlants(); } catch (e) { out.fehler = String(e.message); }
    out.listeDa = !!document.querySelector('.due-card-name');
    out.imgListe = zaehle();
    try { await window.gsOpenPlantDossier('mp_sich1'); } catch (e) {}
    out.dossierDa = document.body.textContent.indexOf('Dossier · alles zu dieser Pflanze') >= 0;
    out.imgDossier = zaehle();
    try { if (typeof gsOpenNotifCenter === 'function') gsOpenNotifCenter('new'); } catch (e) {}
    const nc = document.querySelector('#gs-nc-body .gs-nc-task-name');
    out.glocke = nc ? nc.textContent : null;
    out.imgGlocke = zaehle();
    try { closeModal && closeModal('modal-plant-dossier'); } catch (e) {}
    return out;
  }, emoji);
}

module.exports = [
  {
    name: 'Pflanze · Emoji aus Backup/Cloud (Altbestand) laeuft weder in Karte, Liste, Dossier noch Glocke — ein echtes Emoji steht weiter da',
    lauf: async (seite, h) => {
      const r = await pflanzenFall(seite, h, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') — Emoji roh als HTML' };
      if (r.kinder) return { ok: false, warum: 'im Emoji-Feld ist ein Element entstanden' };
      if (r.imgListe || r.imgDossier || r.imgGlocke) return { ok: false, warum: 'Element aus dem Emoji entstanden · Liste ' + r.imgListe + ' · Dossier ' + r.imgDossier + ' · Glocke ' + r.imgGlocke };
      if (!r.listeDa || !r.dossierDa || r.glocke == null) return { ok: false, warum: 'eine Senke wurde nicht gerendert — Fall misst sie nicht: ' + JSON.stringify(r) };
      const g = await pflanzenFall(seite, h, '🍅');
      await h.warte(100);
      if (g.karteEmoji !== '🍅') return { ok: false, warum: 'gutartiges Emoji fehlt in der Karte: ' + JSON.stringify(g) };
      if (!g.karte) return { ok: false, warum: 'Name mit Apostroph fehlt in der Karte' };
      return { ok: true, info: 'boese → Rueckfall „' + r.karteEmoji + '" · 🍅 bleibt · Glocke: ' + (g.glocke || '—') };
    },
  },
  {
    name: 'Giess-Banner (gsCheckWaterNeeded) · Name und Emoji der faelligen Pflanzen bleiben Text — ein echter Name steht weiter da',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        const t = () => ({ water: { active: true, intervalDays: 1, lastDone: Date.now() - 5 * 864e5 } });
        myPlants = [{ id: 'mp_w1', name: boese, emoji: '🌿', tasks: t() }, { id: 'mp_w2', name: '', nick: '', emoji: boese, tasks: t() },
                    { id: 'mp_w3', name: "Minze d'Été", emoji: '🌱', tasks: t() }];
        gsCheckWaterNeeded();
        const b = document.getElementById('garden-water-banner');
        const out = { da: !!b && b.style.display !== 'none', txt: b ? b.textContent : '', img: b ? b.querySelectorAll('img').length : -1 };
        if (b) b.style.display = 'none';
        return out;
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (!r.da) return { ok: false, warum: 'Banner nicht gezeigt — Fall misst nichts' };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.img) return { ok: false, warum: 'img im Banner entstanden' };
      if (r.txt.indexOf("Minze d'Été") < 0) return { ok: false, warum: 'gutartiger Name fehlt: ' + r.txt.slice(0, 160) };
      return { ok: true, info: 'boese als Text · Minze d\'Été steht da' };
    },
  },
  {
    name: 'Lina · propose_add_plant mit Auszeichnung im emoji speichert den Rueckfall, nicht den Wert (Quelle)',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (boese) => {
        myPlants = [];
        window.gsConfirmModal = async () => true;
        await gsLinaDispatch({ tool: 'propose_add_plant', args: { name: 'Tomate Probe', emoji: boese } });
        await new Promise(r => setTimeout(r, 200));
        const p = myPlants.find(x => x.name === 'Tomate Probe');
        const gut = (await gsLinaDispatch({ tool: 'propose_add_plant', args: { name: 'Gurke Probe', emoji: '🥒' } }), myPlants.find(x => x.name === 'Gurke Probe'));
        return { boese: p ? p.emoji : null, gut: gut ? gut.emoji : null, gespeichert: (localStorage.getItem('ps_myplants') || '').indexOf('onerror') >= 0 };
      }, h.BOESE);
      if (r.boese == null) return { ok: false, warum: 'die Aktion hat keine Pflanze angelegt — Fall misst nichts' };
      if (r.boese !== '🌿' || r.gespeichert) return { ok: false, warum: 'emoji gespeichert als ' + JSON.stringify(r.boese) };
      if (r.gut !== '🥒') return { ok: false, warum: 'gutartiges Emoji ging verloren: ' + r.gut };
      return { ok: true, info: 'boese → 🌿 · 🥒 bleibt' };
    },
  },
  {
    name: 'Sammlung · gsAddToCollection mit boesem Emoji: der Auswahl-Dialog fuehrt nichts aus',
    lauf: async (seite, h) => {
      await seite.evaluate((boese) => {
        window._gsCollReady = () => true;
        window.sbFetch = async () => ({ data: [], error: null });
        gsAddToCollection('plant', 'mp_x', 'Basilikum', boese);
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      const txt = await seite.evaluate(() => { const t = document.body.innerText; try { closeModal('gs-nl-modal'); } catch (e) {} return t.indexOf('Basilikum') >= 0; });
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (!txt) return { ok: false, warum: 'der Dialog ging nicht auf — Fall misst nichts' };
      return { ok: true, info: 'Dialog offen, Emoji als Rueckfall' };
    },
  },
  {
    name: 'Ernte · Emoji UND Pflanzenname aus dem Ernte-Log laufen in Uebersicht, Top-Liste und Alle nicht',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (boese) => {
        const jahr = new Date().getFullYear();
        const log = [{ id: 'e1', ts: jahr + '-06-01T10:00:00Z', pflanze: boese, menge: 2, unit: 'kg', emoji: boese },
                     { id: 'e2', ts: jahr + '-06-02T10:00:00Z', pflanze: 'Zucchini', menge: 1, unit: 'kg', emoji: '🥒' }];
        localStorage.setItem('gs_ernte_log', JSON.stringify(log));
        _gsErnteLog = null;
        const out = [];
        for (const v of ['overview', 'plants', 'all']) {   // die Ansicht heisst 'plants' (VIEWS in openErnteTracking)
          localStorage.setItem('gs_ernte_view', v);
          localStorage.setItem('gs_ernte_year', String(jahr));
          openErnteTracking();
          await new Promise(r => setTimeout(r, 50));
          const mc = document.getElementById('modal-content');
          out.push(v + ':' + (mc && mc.textContent.indexOf('🥒') >= 0 ? 'gurke' : 'ohne') + ':' + (mc ? mc.querySelectorAll('img').length : -1));
        }
        try { closeModal('modal-generic'); } catch (e) {}
        return out;
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + r.join(' ') };
      if (r.some(x => /:-1$/.test(x))) return { ok: false, warum: 'Fenster ging nicht auf: ' + r.join(' ') };
      if (!r.some(x => /gurke/.test(x))) return { ok: false, warum: 'gutartiges Emoji 🥒 fehlt: ' + r.join(' ') };
      if (!/^plants:gurke/.test(r[1]) || !/^all:gurke/.test(r[2])) return { ok: false, warum: 'Ranking oder Alle nicht gerendert — Fall misst sie nicht: ' + r.join(' ') };
      if (r.some(x => !/:0$/.test(x))) return { ok: false, warum: 'img-Element entstanden: ' + r.join(' ') };
      return { ok: true, info: r.join(' · ') };
    },
  },
  {
    name: 'Scan-Verlauf · emoji, category und thumb aus dem Verlauf (auch Altbestand) bleiben Text in Liste und Detail',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (a) => {
        const jetzt = Date.now();
        const hist = [
          { id: 'scan_b1', ts: jetzt, timestamp: new Date(jetzt).toISOString(), name: 'Boeser Eintrag', latin: 'X y', emoji: a.boese, category: a.boese, conf: 80 },
          { id: 'scan_b2', ts: jetzt - 1000, timestamp: new Date(jetzt - 1000).toISOString(), name: 'Bild-Ausbruch', latin: 'X z', emoji: '🍄', category: 'pilz', conf: 80, thumb: 'x" onerror="window.__pwned=7' },
          { id: 'scan_g1', ts: jetzt - 2000, timestamp: new Date(jetzt - 2000).toISOString(), name: 'Baerlauch', latin: 'Allium ursinum', emoji: '🧄', category: 'kraut', conf: 90, thumb: 'data:image/png;base64,iVBORw0KGgo=' },
        ];
        localStorage.setItem(typeof SCAN_HISTORY_KEY !== 'undefined' ? SCAN_HISTORY_KEY : 'gs_scan_history', JSON.stringify(hist));
        openScanHistoryFull();
        await new Promise(r => setTimeout(r, 100));
        const liste = document.getElementById('scan-history-list');
        const out = { liste: liste ? liste.textContent : '', imgs: liste ? Array.from(liste.querySelectorAll('img')).map(i => i.getAttribute('src')) : [] , onerr: liste ? liste.querySelectorAll('img[onerror]').length : -1 };
        for (const u of ['h_0', 'h_1']) { try { gsScanHistoryOpen(u); } catch (e) {} await new Promise(r => setTimeout(r, 60)); const m = document.getElementById('scan-detail-modal'); out['d_' + u] = m ? m.querySelectorAll('img[onerror]').length + ':' + m.textContent.indexOf('<img') : 'weg'; try { closeScanDetail(); } catch (e) {} }
        try { closeScanHistoryFull(); } catch (e) {}
        return out;
      }, { boese: h.BOESE });
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify(r).slice(0, 300) };
      if (r.onerr) return { ok: false, warum: 'img mit onerror in der Liste' };
      if (r.liste.indexOf('Baerlauch') < 0 || r.liste.indexOf('Boeser Eintrag') < 0) return { ok: false, warum: 'Liste nicht gerendert — Fall misst nichts: ' + r.liste.slice(0, 120) };
      if (!r.imgs.some(s => /^data:image\/png/.test(s))) return { ok: false, warum: 'gutartiges Vorschaubild fehlt: ' + JSON.stringify(r.imgs) };
      return { ok: true, info: 'Liste ' + r.imgs.length + ' Bild(er), 0 onerror · Detail ' + r.d_h_0 + ' / ' + r.d_h_1 };
    },
  },
  {
    name: 'Scan-Verlauf · Galerie-Detail (openScanHistoryDetail): Foto, Konfidenz und Ort aus dem Verlauf bleiben Text — ein echter Eintrag steht weiter da',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const jetzt = Date.now();
        const hist = [
          { id: 'scan_d1', ts: jetzt, name: 'Detail Boese', latin: 'X y', emoji: '🍄', conf: '"><img src=x onerror="window.__pwned=3">',
            photo: 'x" onerror="window.__pwned=4', context: { lat: '1"><img src=x onerror="window.__pwned=5">', lon: '2' } },
          { id: 'scan_d2', ts: jetzt - 1, name: 'Detail Gut', latin: 'Allium ursinum', emoji: '🧄', conf: 0.94,
            thumb: 'data:image/png;base64,iVBORw0KGgo=', context: { lat: 47.05, lon: 8.3 } },
        ];
        localStorage.setItem(typeof SCAN_HISTORY_KEY !== 'undefined' ? SCAN_HISTORY_KEY : 'gs_scan_history', JSON.stringify(hist));
        const out = {};
        for (const i of [0, 1]) {
          openScanHistoryDetail(i);
          await new Promise(r => setTimeout(r, 60));
          const m = document.getElementById('scan-detail-modal');
          out['m' + i] = m ? { txt: m.textContent, imgs: Array.from(m.querySelectorAll('img')).map(x => x.getAttribute('src')), osm: Array.from(m.querySelectorAll('a[href*="openstreetmap"]')).map(a => a.getAttribute('href')) } : null;
          if (m) m.style.display = 'none';
        }
        return out;
      });
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · ' + JSON.stringify(r).slice(0, 300) };
      if (!r.m0 || r.m0.txt.indexOf('Detail Boese') < 0) return { ok: false, warum: 'Detail des boesen Eintrags nicht gerendert — Fall misst nichts' };
      if (r.m0.imgs.some(s => s === 'x' || /onerror/.test(s || ''))) return { ok: false, warum: 'img aus dem Wert entstanden: ' + JSON.stringify(r.m0.imgs) };
      if (!r.m1 || r.m1.txt.indexOf('94%') < 0) return { ok: false, warum: 'gutartige Konfidenz 94% fehlt: ' + (r.m1 ? r.m1.txt.slice(0, 160) : '—') };
      if (!r.m1.imgs.some(s => /^data:image\/png/.test(s || ''))) return { ok: false, warum: 'gutartiges Foto fehlt: ' + JSON.stringify(r.m1.imgs) };
      if (!r.m1.osm.length || r.m1.osm[0].indexOf('mlat=47.05') < 0) return { ok: false, warum: 'gutartiger Ort fehlt: ' + JSON.stringify(r.m1.osm) };
      return { ok: true, info: 'boese bleibt Text · 94% + Foto + Karte stehen da' };
    },
  },
  {
    name: 'Scan-Verlauf · gsAddToScanHistory normalisiert Emoji und verwirft ein Vorschaubild ohne erlaubtes Schema (Quelle)',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        localStorage.setItem(typeof SCAN_HISTORY_KEY !== 'undefined' ? SCAN_HISTORY_KEY : 'gs_scan_history', '[]');
        gsAddScanHistory({ id: 'scan_q1', name: 'Q', emoji: boese, thumb: 'javascript:alert(1)' });
        gsAddScanHistory({ id: 'scan_q2', name: 'G', emoji: '🌻', thumb: 'data:image/png;base64,iVBORw0KGgo=' });
        const hist = JSON.parse(localStorage.getItem(typeof SCAN_HISTORY_KEY !== 'undefined' ? SCAN_HISTORY_KEY : 'gs_scan_history'));
        const q1 = hist.find(x => x.id === 'scan_q1'), q2 = hist.find(x => x.id === 'scan_q2');
        return { e1: q1 && q1.emoji, t1: q1 && q1.thumb, e2: q2 && q2.emoji, t2: q2 && q2.thumb };
      }, h.BOESE);
      if (r.e1 !== '🔬' || r.t1) return { ok: false, warum: 'boeser Eintrag gespeichert als ' + JSON.stringify(r) };
      if (r.e2 !== '🌻' || !r.t2) return { ok: false, warum: 'gutartiger Eintrag veraendert: ' + JSON.stringify(r) };
      return { ok: true, info: 'boese → 🔬, Bild verworfen · 🌻 + data:image bleiben' };
    },
  },
  {
    name: 'Mitteilungs-Center · Icon eines neuen Scans (KI-Emoji) und Feld icon einer Server-Mitteilung laufen nicht',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (boese) => {
        myPlants = [];
        localStorage.setItem(typeof SCAN_HISTORY_KEY !== 'undefined' ? SCAN_HISTORY_KEY : 'gs_scan_history',
          JSON.stringify([{ id: 'scan_n1', ts: Date.now(), name: 'Neuer Scan', emoji: boese, conf: 80 }, { id: 'scan_n2', ts: Date.now() - 5, name: 'Guter Scan', emoji: '🌼', conf: 80 }]));
        try { const st = gsGetNotifState(); st.seenScansTs = 0; localStorage.setItem('gs_notif_state', JSON.stringify(st)); } catch (e) {}
        window.gsNotifPull = async () => {};   // sonst ersetzt der Nachzug die gestellte Liste
        try { window._gsServerNotifs = [{ id: 'n1', kind: 'other', title: 'Hallo', body: 'x', icon: boese, created_at: new Date().toISOString() }]; } catch (e) {}
        gsOpenNotifCenter('new');
        await new Promise(r => setTimeout(r, 100));
        const b = document.getElementById('gs-nc-body');
        const out = { txt: b ? b.textContent : '', ikon: b ? Array.from(b.querySelectorAll('.gs-nc-row-icon')).map(x => x.textContent) : [], kinder: b ? b.querySelectorAll('.gs-nc-row-icon *').length : -1 };
        return out;
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ') · Icons ' + JSON.stringify(r.ikon) };
      if (r.txt.indexOf('Neuer Scan') < 0) return { ok: false, warum: 'die Scan-Mitteilung wurde nicht gerendert — Fall misst nichts: ' + r.txt.slice(0, 120) };
      if (r.kinder) return { ok: false, warum: 'Element im Icon entstanden' };
      if (r.txt.indexOf('Hallo') < 0) return { ok: false, warum: 'die Server-Mitteilung wurde nicht gerendert — der icon-Teil misst nichts: ' + r.txt.slice(0, 160) };
      if (r.ikon.indexOf('🌼') < 0) return { ok: false, warum: 'gutartiges Icon 🌼 fehlt: ' + JSON.stringify(r.ikon) };
      return { ok: true, info: 'Icons ' + r.ikon.join(' ') };
    },
  },
  {
    name: 'Scan-Ergebnis · toxicity mit Auszeichnung (Feld der Giftig-Kachel) bleibt Text',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boese) => {
        try { switchTab('scanner'); } catch (e) {}
        showScanResult({ name: 'Probe', latin: 'Probe probe', confidence: 80, toxic: true, toxicity: boese, alternatives: [] });
        const el = document.getElementById('scan-result');
        const t = el ? el.innerHTML : '';
        return { da: t.indexOf('Probe') >= 0, img: el ? el.querySelectorAll('img[onerror]').length : -1 };
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (!r.da) return { ok: false, warum: 'Ergebniskarte nicht gerendert' };
      if (r.img) return { ok: false, warum: 'img mit onerror in der Karte' };
      const g = await seite.evaluate(() => { showScanResult({ name: 'Probe', latin: 'Probe probe', confidence: 80, toxic: true, toxicity: 4, alternatives: [] }); return document.getElementById('scan-result').textContent.indexOf('4/5') >= 0; });
      if (!g) return { ok: false, warum: 'gutartige Giftstufe 4/5 fehlt' };
      return { ok: true, info: 'boese bleibt Text · 4/5 steht da' };
    },
  },
  {
    name: 'Scan-Weg · der geteilte Scan-Cache wird weder gelesen noch beschrieben — ein Eintrag eines anderen Kontos ersetzt nie den KI-Aufruf',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (boese) => {
        const c = document.createElement('canvas'); c.width = 160; c.height = 160;
        const g = c.getContext('2d'); g.fillStyle = '#4a3b2a'; g.fillRect(0, 0, 160, 160);
        g.fillStyle = '#3f9142'; g.beginPath(); g.ellipse(80, 74, 50, 30, -0.5, 0, Math.PI * 2); g.fill();
        const b64 = c.toDataURL('image/jpeg', 0.9).split(',')[1];
        const pfade = [];
        // Der Server ist gestellt: scan_cache haette einen Treffer eines ANDEREN Kontos.
        window.sbFetch = async (pfad) => {
          pfade.push(String(pfad));
          if (/scan_cache/.test(pfad)) return { data: [{ result_json: { name: 'Wiesen-Champignon', latin: 'Agaricus campestris', confidence: 97, edible: true, toxicity: 0, emoji: boese } }], error: null };
          return { data: [], error: null };
        };
        window.sbIsLoggedIn = () => true;
        window.getApiConfig = () => ({ key: 'k' });
        window.stopCamera = () => {};
        window.gsScanPersistToCloud = () => Promise.resolve(true);
        window.gsBuildScanContext = () => ({ month: 'Juli', season: 'Sommer', monthNum: 7, canton: 'UR', ausFoto: true, aufnahme: '2026-07-14' });
        let ki = 0;
        window.callVisionAI = async () => { ki++; return JSON.stringify({ name: 'Bärlauch', latin: 'Allium ursinum', confidence: 88, edible: true, toxic: false, toxicity: 0, alternatives: [], emoji: boese }); };
        try { switchTab('scanner'); } catch (e) {}
        await analyzeImage(b64, 'image/jpeg');
        await new Promise(r => setTimeout(r, 300));
        const karte = (document.getElementById('scan-result') || {}).textContent || '';
        return { ki, cache: pfade.filter(p => /scan_cache/.test(p)), karteKi: karte.indexOf('Bärlauch') >= 0, karteFremd: karte.indexOf('Champignon') >= 0,
          emoji: (window._lastScanResult || {}).emoji, merk: (window._gsLastScanForAdd || {}).emoji };
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.ki !== 1 || r.karteFremd) return { ok: false, warum: 'Bestimmung kam aus dem geteilten Cache: KI-Aufrufe ' + r.ki + ', Karte zeigt ' + (r.karteFremd ? 'Champignon' : '?') };
      if (r.cache.length) return { ok: false, warum: 'scan_cache angefragt: ' + r.cache.join(' | ') };
      if (!r.karteKi) return { ok: false, warum: 'die KI-Bestimmung steht nicht auf der Karte — Scan-Weg kaputt' };
      if (r.merk && /onerror|</.test(r.merk)) return { ok: false, warum: 'KI-Emoji ungeprueft weitergereicht: ' + r.merk };
      return { ok: true, info: 'KI ' + r.ki + '× · 0 Anfragen an scan_cache · Emoji → ' + JSON.stringify(r.merk || r.emoji || '') };
    },
  },
  {
    name: 'Universal-Suche · Pflanzenname und -emoji im Treffer bleiben Text',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async (boese) => {
        myPlants = [{ id: 'mp_u1', name: 'Zz' + boese, nick: '', emoji: boese, tasks: {} }, { id: 'mp_u2', name: 'Zzgut', emoji: '🌵', tasks: {} }];
        window.gsOpenUniversalSearch();
        const i = document.getElementById('gs-univ-input');
        if (!i) return { weg: true };
        i.value = 'Zz'; i.dispatchEvent(new Event('input'));
        await new Promise(r => setTimeout(r, 500));
        const box = document.getElementById('gs-univ-results');
        const out = { txt: box ? box.textContent : '', img: box ? box.querySelectorAll('img').length : -1 };
        try { window.gsCloseUniversalSearch(); } catch (e) {}
        return out;
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (r.weg) return { ok: false, warum: 'Suche ging nicht auf' };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.img) return { ok: false, warum: 'img entstanden' };
      if (r.txt.indexOf('🌵 Zzgut') < 0) return { ok: false, warum: 'gutartiger Treffer fehlt: ' + r.txt.slice(0, 160) };
      return { ok: true, info: 'boeser Treffer als Text · 🌵 Zzgut steht da' };
    },
  },
];
