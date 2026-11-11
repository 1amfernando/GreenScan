// Gruppe k5 — „eigene" Daten sind nicht automatisch harmlos (v33.59).
// Ein Pflanzenname kommt aus der KI, dem Scan-Cache oder Lina; Ids, Anzahl
// und Fotos aus einer Backup-Datei, die jemand anderes gebaut hat, oder aus
// dem Cloud-Blob eines zweiten Geraets; das eigene Profil ist per REST frei
// schreibbar. Jeder Fall rendert die ECHTE Funktion mit einem feindlichen
// Wert und misst die Wirkung (window.__pwned, Elemente im DOM, die Argumente,
// die beim Antippen wirklich ankommen) — und den guten Wert daneben.
'use strict';

// Zaehlt Elemente, die ein feindlicher Wert erzeugt haetten.
const FREMD = 'img[src="x"], img[onerror], [onmouseover], b.boese';

async function messen(h, seite, sel) {
  await h.warte(350);
  const p = await h.pwned();
  const r = await seite.evaluate(([sel, fremd]) => {
    const el = document.querySelector(sel);
    return el ? { da: true, fremd: el.querySelectorAll(fremd).length, text: el.textContent } : { da: false };
  }, [sel, FREMD]);
  return Object.assign({ pwned: p }, r);
}

module.exports = [
  {
    name: 'Gartentagebuch · „Meistgenannte Pflanzen" setzt den Pflanzennamen als Text',
    lauf: async (seite, h) => {
      await seite.evaluate((boese) => {
        const t = new Date().toISOString();
        myPlants = [
          { id: 'k5a', name: boese, emoji: '🌿', diary: [{ ts: t, action: 'water', title: 'x' }, { ts: t, action: 'water', title: 'y' }] },
          { id: 'k5b', name: "Tom's <Bio> Basilikum", emoji: '🌿', diary: [{ ts: t, action: 'water', title: 'x' }] },
        ];
        localStorage.setItem('gs_tb_filter', 'all'); localStorage.setItem('gs_tb_search', '');
        openGartenTagebuch();
      }, h.BOESE);
      const m = await messen(h, seite, '#modal-content');
      await seite.evaluate(() => { try { closeModal(); } catch (e) {} });
      if (!m.da) return { ok: false, warum: '#modal-content fehlt' };
      if (m.pwned !== null) return { ok: false, warum: 'Code lief (__pwned=' + m.pwned + ')' };
      if (m.fremd) return { ok: false, warum: m.fremd + ' fremde Elemente im Tagebuch' };
      if (m.text.indexOf("Tom's <Bio> Basilikum") < 0 || m.text.indexOf('onerror') < 0) return { ok: false, warum: 'Namen nicht als Text sichtbar' };
      return { ok: true, info: 'feindlicher Name als Text, 0 Elemente · „Tom\'s <Bio> Basilikum" unveraendert' };
    },
  },
  {
    name: 'Ernte · Top-Pflanze, „Pflanzen", „Alle": Name als Text, Id im Loesch-Knopf kommt unveraendert an',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ([boese, oc]) => {
        const t = new Date().toISOString();
        localStorage.setItem('gs_ernte_log', JSON.stringify([
          { id: oc, pflanze: boese, emoji: '🍅', menge: 5, unit: 'kg', ts: t },
          { id: 'e_gut', pflanze: "Tom's <Bio>", emoji: '🍅', menge: 1, unit: 'kg', ts: t },
        ]));
        localStorage.setItem('gs_ernte_year', String(new Date().getFullYear()));
        const out = {};
        for (const v of ['overview', 'plants', 'all']) {
          _gsErnteLog = null;
          localStorage.setItem('gs_ernte_view', v);
          openErnteTracking();
          const mc = document.getElementById('modal-content');
          out[v] = { fremd: mc.querySelectorAll('img[src="x"], img[onerror]').length, gut: mc.textContent.indexOf("Tom's <Bio>") >= 0 };
        }
        window.__del = [];
        const alt = window.gsErnteDelete;
        window.gsErnteDelete = function (id) { window.__del.push(id); };
        Array.from(document.querySelectorAll('#modal-content button[onclick*="gsErnteDelete"]')).forEach(b => b.click());
        window.gsErnteDelete = alt;
        out.del = window.__del;
        try { closeModal(); } catch (e) {}
        return out;
      }, [h.BOESE, h.OC]);
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      for (const v of ['overview', 'plants', 'all']) {
        if (r[v].fremd) return { ok: false, warum: 'Ansicht ' + v + ': ' + r[v].fremd + ' fremde Elemente' };
        if (v !== 'overview' && !r[v].gut) return { ok: false, warum: 'Ansicht ' + v + ': guter Name fehlt' };
      }
      if (JSON.stringify(r.del.slice().sort()) !== JSON.stringify([h.OC, 'e_gut'].sort())) return { ok: false, warum: 'Loesch-Knopf liefert: ' + JSON.stringify(r.del) };
      return { ok: true, info: '3 Ansichten ohne fremde Elemente · beide Ids kommen unveraendert in gsErnteDelete an' };
    },
  },
  {
    name: 'Giess-Banner im Garten setzt Pflanzennamen als Text',
    lauf: async (seite, h) => {
      await seite.evaluate((boese) => {
        const alt = Date.now() - 6 * 864e5;
        myPlants = [
          { id: 'k5a', name: boese, tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } },
          { id: 'k5b', name: "Tom's <Bio>", tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } },
          // Gegenprobe Form: hoechstens DREI Namen, und der Schliessen-Knopf bleibt
          // (eine Reparatur hatte `.slice(0,3).join(', ')` in einen Kommentar geschoben).
          { id: 'k5c', name: 'Drei', tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } },
          { id: 'k5d', name: 'VierteZuViel', tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } },
        ];
        gsCheckWaterNeeded();
      }, h.BOESE);
      const m = await messen(h, seite, '#garden-water-banner');
      const form = await seite.evaluate(() => { const b = document.getElementById('garden-water-banner'); return b ? { knopf: !!b.querySelector('button'), html: b.innerHTML.slice(-160) } : null; });
      if (m.pwned !== null) return { ok: false, warum: 'Code lief (__pwned=' + m.pwned + ')' };
      if (m.fremd) return { ok: false, warum: m.fremd + ' fremde Elemente im Banner' };
      if (m.text.indexOf("Tom's <Bio>") < 0 || m.text.indexOf('onerror') < 0) return { ok: false, warum: 'Namen nicht als Text: ' + m.text.slice(0, 120) };
      if (!form || !form.knopf) return { ok: false, warum: 'Schliessen-Knopf fehlt im Banner: ' + (form && form.html) };
      if (m.text.indexOf('VierteZuViel') >= 0) return { ok: false, warum: 'mehr als drei Namen im Banner' };
      return { ok: true, info: '4 Pflanzen giessen — drei Namen als Text, 0 Elemente, Knopf da' };
    },
  },
  {
    name: 'Pflanzenkarte · eine Id mit " bleibt im Attribut, und data-id liefert sie unveraendert',
    lauf: async (seite, h) => {
      const r = await seite.evaluate((boeseId) => {
        const d = document.createElement('div'); document.body.appendChild(d);
        const gut = 'mp_1700000000000';
        const fall = [boeseId, gut].map(id => ({ id, name: 'A', emoji: '🌿', tasks: { water: { active: true, intervalDays: 2, lastDone: Date.now() - 5 * 864e5 } } }));
        d.innerHTML = fall.map(p => gsNewPlantCard(p)).join('');
        const out = {
          fremd: d.querySelectorAll('img[src="x"], img[onerror]').length,
          ids: Array.from(d.querySelectorAll('[data-action="toggle"]')).map(x => x.getAttribute('data-id')),
          pids: Array.from(d.querySelectorAll('[data-action="donetask"]')).map(x => x.getAttribute('data-pid')),
          karten: Array.from(d.querySelectorAll('.plant-card')).map(x => x.id),
        };
        d.remove(); return out;
      }, '"><img src=x onerror="window.__pwned=1">');
      await h.warte(350);
      const p = await h.pwned();
      const boese = '"><img src=x onerror="window.__pwned=1">';
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.fremd) return { ok: false, warum: r.fremd + ' fremde Elemente in der Karte' };
      if (JSON.stringify(r.ids) !== JSON.stringify([boese, 'mp_1700000000000'])) return { ok: false, warum: 'data-id: ' + JSON.stringify(r.ids) };
      if (r.pids.length !== 2 || r.pids[1] !== 'mp_1700000000000' || r.pids[0] !== boese) return { ok: false, warum: 'data-pid: ' + JSON.stringify(r.pids) };
      if (r.karten[1] !== 'mpcard-mp_1700000000000') return { ok: false, warum: 'Karten-id: ' + JSON.stringify(r.karten) };
      return { ok: true, info: '0 fremde Elemente · data-id/data-pid/id liefern beide Ids unveraendert' };
    },
  },
  {
    name: 'Dossier · „Ernte eintragen" uebergibt die Id als TEXT (vorher ein Ausdruck: ReferenceError bzw. Code)',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async () => {
        const ids = ['mp_1700000000000', 'window.__pwned=1', "x');window.__pwned=2;//"];
        myPlants = ids.map(id => ({ id, name: 'A', emoji: '🌿' }));
        const altL = window.sbIsLoggedIn, altF = window.sbFetch, altH = window.openHarvestAddModal;
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async () => ({ data: {} });
        const got = [], fehler = [];
        window.openHarvestAddModal = function (pid) { got.push(pid); };
        for (const id of ids) {
          await gsOpenPlantDossier(id);
          await new Promise(r => setTimeout(r, 60));
          const b = Array.from(document.querySelectorAll('button[onclick*="openHarvestAddModal"]')).pop();
          if (!b) { fehler.push('kein Knopf fuer ' + id); continue; }
          try { new Function(b.getAttribute('onclick')); } catch (e) { fehler.push('parst nicht: ' + id); }
          try { b.click(); } catch (e) { fehler.push(String(e.message)); }
          try { closeModal(); } catch (e) {}
          document.querySelectorAll('.gs-dyn-overlay').forEach(x => x.remove());
        }
        window.sbIsLoggedIn = altL; window.sbFetch = altF; window.openHarvestAddModal = altH;
        return { got, fehler, ids };
      });
      await h.warte(200);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.fehler.length) return { ok: false, warum: r.fehler.join(' · ') };
      if (JSON.stringify(r.got) !== JSON.stringify(r.ids)) return { ok: false, warum: 'angekommen: ' + JSON.stringify(r.got) };
      return { ok: true, info: '3 Ids (normal, Ausdruck, Ausbruch) kommen als Zeichenkette an, 0 ausgefuehrt' };
    },
  },
  {
    name: 'Mitteilungs-Fenster · Aufgaben-Zeile: eine Pflanzen-Id mit \' und &#39; kommt unveraendert in gsNcDoneTask an',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(async ([oc, ocq]) => {
        const alt = Date.now() - 6 * 864e5;
        myPlants = [oc, ocq, 'p_gut'].map(id => ({ id, name: 'A', emoji: '🌿', tasks: { water: { active: true, intervalDays: 2, lastDone: alt } } }));
        window._gsNcTab = 'new';
        const altD = window.gsNcDoneTask, altS = window.gsSnoozeTask;
        const got = [];
        window.gsNcDoneTask = function (el, id, key) { got.push(id + '|' + key); };
        window.gsSnoozeTask = function (id, key) { got.push('s:' + id); };
        gsNcRender();
        Array.from(document.querySelectorAll('#gs-nc-body .gs-nc-check, #gs-nc-body .gs-nc-ghost')).forEach(b => { try { b.click(); } catch (e) {} });
        window.gsNcDoneTask = altD; window.gsSnoozeTask = altS;
        return got;
      }, [h.OC, h.OCQ]);
      await h.warte(450);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      for (const id of [h.OC, h.OCQ, 'p_gut']) {
        if (r.indexOf(id + '|water') < 0) return { ok: false, warum: 'nicht angekommen: ' + id + ' · ' + JSON.stringify(r) };
        if (r.indexOf('s:' + id) < 0) return { ok: false, warum: 'Verschieben nicht angekommen: ' + id };
      }
      return { ok: true, info: '3 Ids (Ausbruch, &#39;-Ausbruch, normal) kommen in Erledigen UND Verschieben unveraendert an' };
    },
  },
  {
    name: 'Backup aus fremder Hand · das Sieb nimmt Ids, Anzahl, Foto und Emoji die feindlichen Zeichen — und der Garten bleibt still',
    lauf: async (seite, h) => {
      const r = await seite.evaluate(([boese, oc]) => {
        const backup = {
          version: 16, exportDate: new Date().toISOString(),
          gardens: [{ id: oc, name: 'Fremder Garten', width: boese, length: '4' }],
          plantings: [{ id: oc, gardenId: oc, name: 'Zucchini', count: boese, date: '2026-05-01' }],
          myPlants: [
            { id: '"><img src=x onerror="window.__pwned=1">', name: "Tom's <Bio>", emoji: boese, photo: 'x" onerror="window.__pwned=1', diary: [{ ts: Date.now(), action: 'water', photo: 'javascript:alert(1)' }] },
            { id: '', name: 'ohne Id', emoji: '🌻', photo: 'https://beispiel.example/a.jpg', water: '2' },
          ],
          geraete: [{ id: oc, name: 'G', garden_id: oc }],
        };
        const e = _gsBackupEinspielen(backup);
        const gesp = JSON.parse(localStorage.getItem('ps_myplants') || '[]');
        renderGarden();
        return { ok: e.ok, g: gardens[0], pl: plantings[0], mp: myPlants, gesp, ger: JSON.parse(localStorage.getItem('gs_geraete') || '[]')[0] };
      }, [h.BOESE, h.OC]);
      await h.warte(300);
      // Die Gartenkarte und die Pflanzung antippen — dort sass die Id im onclick.
      await seite.evaluate(() => {
        document.querySelectorAll('.garden-card-hdr').forEach(b => { try { b.click(); } catch (e) {} });
        document.querySelectorAll('.mp-action-btn').forEach(b => { if (/toggleGardenCard|gsPlanFuerGarten/.test(b.getAttribute('onclick') || '')) try { b.click(); } catch (e) {} });
      });
      await h.warte(400);
      const p = await h.pwned();
      const fremd = await seite.evaluate(() => document.querySelectorAll('img[src="x"]').length);
      await seite.evaluate(() => { try { closeModal(); } catch (e) {} });
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (fremd) return { ok: false, warum: fremd + ' fremde Elemente im Dokument' };
      if (/['"<>()=;\/ ]/.test(String(r.g.id)) || /['"<>()=;\/ ]/.test(String(r.pl.id)) || r.pl.gardenId !== r.g.id) return { ok: false, warum: 'Ids nicht gesaeubert: ' + JSON.stringify([r.g.id, r.pl.id, r.pl.gardenId]) };
      if ('count' in r.pl || 'width' in r.g || r.g.length !== '4') return { ok: false, warum: 'Zahlenfelder: ' + JSON.stringify({ count: r.pl.count, width: r.g.width, length: r.g.length }) };
      const [a, b] = r.mp;
      if (/["<>]/.test(a.id) || 'emoji' in a || 'photo' in a || 'photo' in a.diary[0]) return { ok: false, warum: 'Pflanze nicht gesaeubert: ' + JSON.stringify(a) };
      if (a.name !== "Tom's <Bio>") return { ok: false, warum: 'Name veraendert: ' + a.name };
      if (!/^mp_\d+_\d+$/.test(b.id) || b.emoji !== '🌻' || b.photo !== 'https://beispiel.example/a.jpg' || b.water !== '2') return { ok: false, warum: 'gute Pflanze veraendert: ' + JSON.stringify(b) };
      if (JSON.stringify(r.gesp) !== JSON.stringify(r.mp)) return { ok: false, warum: 'gespeichert ist etwas anderes als im Speicher' };
      if (/['"();=]/.test(r.ger.id)) return { ok: false, warum: 'Geraete-Id roh: ' + r.ger.id };
      return { ok: true, info: 'Ids gesaeubert (Garten ' + r.g.id + '), leere Id → ' + b.id + ', Anzahl/Breite/Foto/Emoji weg, Name und gutes Foto unveraendert · Garten antippen: 0 ausgefuehrt' };
    },
  },
  {
    name: 'Backup der Beispieldaten geht UNVERAENDERT durch das Sieb (Gegenprobe gegen ein Sieb, das zu viel nimmt)',
    lauf: async (seite, h) => {
      await h.frisch();
      const s = h.seite();
      const r = await s.evaluate(() => {
        const d = JSON.parse(JSON.stringify(_gsBackupDaten()));
        const vorher = JSON.stringify([d.gardens, d.plantings, d.myPlants, d.deadPlants, d.geraete, d.geraeteRegeln, d.messwerte]);
        const k = JSON.parse(JSON.stringify(d));
        const nachher = JSON.stringify([_gsSiebListe(k.gardens, 'g_'), _gsSiebListe(k.plantings, 'pl_'), _gsSiebListe(k.myPlants, 'mp_'), _gsSiebListe(k.deadPlants, 'mp_'), _gsSiebListe(k.geraete), _gsSiebListe(k.geraeteRegeln), _gsSiebListe(k.messwerte)]);
        const tb = JSON.parse(localStorage.getItem('gs_gartentagebuch') || '[]');
        return { gleich: vorher === nachher, n: [d.gardens.length, d.plantings.length, d.myPlants.length, d.geraete.length, d.messwerte.length], tb: JSON.stringify(tb) === JSON.stringify(_gsSiebListe(JSON.parse(JSON.stringify(tb)))), vorher: vorher.length, nachher: nachher.length };
      });
      if (!r.gleich) return { ok: false, warum: 'Beispieldaten veraendert (' + r.vorher + ' → ' + r.nachher + ' Zeichen)' };
      if (!r.tb) return { ok: false, warum: 'Gartentagebuch veraendert' };
      if (r.n.some(x => !x)) return { ok: false, warum: 'Beispieldaten leer — der Fall misst nichts: ' + JSON.stringify(r.n) };
      return { ok: true, info: 'Gaerten/Pflanzungen/Pflanzen/Geraete/Messwerte ' + JSON.stringify(r.n) + ' und das Tagebuch: byte-gleich' };
    },
  },
  {
    name: 'Cloud-Pull · der Blob eines anderen Geraets geht durch dasselbe Sieb',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate(async ([boese, oc]) => {
        const t = new Date().toISOString();
        ['plants', 'garden', 'state'].forEach(k => { try { localStorage.removeItem('gs_sync_dirty_at_' + k); } catch (e) {} });
        localStorage.setItem('gs_last_active_uid', localStorage.getItem('gs_sb_uid') || '');
        const altF = window.sbFetch;
        window.sbFetch = async (path) => {
          if (path.indexOf('/user_plants') >= 0) return { data: [{ data: { plants: [{ id: '"><img src=x onerror="window.__pwned=1">', name: 'Cloud-Tomate', count: boese, emoji: boese }, { id: 'p_gut', name: 'Gut', emoji: '🍅' }] }, updated_at: t }] };
          if (path.indexOf('/user_gardens') >= 0) return { data: [{ data: { gardens: [{ id: oc, name: 'Cloud-Garten' }], plantings: [{ id: 'pl1', gardenId: oc, name: 'Z', count: 3 }], plans: [{ id: oc, title: 'P', plan: { bed: { width_m: boese, length_m: 2 } } }] }, updated_at: t }] };
          if (path.indexOf('/user_app_state') >= 0) return { data: [{ data: { geraete: [{ id: oc, name: 'G' }] }, updated_at: t }] };
          return { data: [] };
        };
        try { await gsSyncUserDataOnLogin(); } catch (e) { return { fehler: String(e.message) }; }
        window.sbFetch = altF;
        return {
          mp: JSON.parse(localStorage.getItem('ps_myplants') || '[]'),
          g: JSON.parse(localStorage.getItem('gs_gardens') || '[]'),
          pl: JSON.parse(localStorage.getItem('gs_plantings') || '[]'),
          plans: JSON.parse(localStorage.getItem('gs_garden_plans') || '[]'),
          ger: JSON.parse(localStorage.getItem('gs_geraete') || '[]'),
        };
      }, [h.BOESE, h.OC]);
      if (r.fehler) return { ok: false, warum: 'Ausnahme: ' + r.fehler };
      const cloud = r.mp.find(x => x.name === 'Cloud-Tomate');
      if (!cloud) return { ok: false, warum: 'Pull hat die Pflanzen nicht uebernommen — der Fall misst nichts: ' + JSON.stringify(r.mp.map(x => x.name)) };
      if (/["<>]/.test(cloud.id) || 'count' in cloud || 'emoji' in cloud) return { ok: false, warum: 'Pflanze roh uebernommen: ' + JSON.stringify(cloud) };
      if (!r.mp.find(x => x.id === 'p_gut' && x.emoji === '🍅')) return { ok: false, warum: 'gute Pflanze veraendert' };
      if (!r.g.length || /['();=]/.test(r.g[0].id)) return { ok: false, warum: 'Garten-Id roh: ' + JSON.stringify(r.g) };
      if (r.pl[0].gardenId !== r.g[0].id || r.pl[0].count !== 3) return { ok: false, warum: 'Pflanzung: ' + JSON.stringify(r.pl) };
      if (!r.plans.length || /['();=]/.test(r.plans[0].id) || 'width_m' in r.plans[0].plan.bed || r.plans[0].plan.bed.length_m !== 2) return { ok: false, warum: 'Plan: ' + JSON.stringify(r.plans) };
      if (!r.ger.length || /['();=]/.test(r.ger[0].id)) return { ok: false, warum: 'Geraet: ' + JSON.stringify(r.ger) };
      return { ok: true, info: 'Pflanzen, Gaerten, Pflanzungen, Plaene, Geraete aus der Cloud gesiebt · gute Werte unveraendert' };
    },
  },
  {
    name: 'Garten-Ansichten mit rohen Daten (ohne Sieb) · Karte, Pflanzung, Anzahl: kein Code beim Rendern und beim Antippen, Karte klappt auf',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate(([boese, oc]) => {
        gardens = [{ id: oc, name: 'Roh-Garten' }];
        plantings = [{ id: oc, gardenId: oc, name: 'Zucchini', count: boese, date: '2026-05-01' }];
        renderGarden();
        const hdr = document.querySelector('.garden-card-hdr');
        const ex = document.getElementById('gexpand-' + oc);
        const vorher = ex ? ex.style.display : 'fehlt';
        if (hdr) hdr.click();
        const nachher = ex ? ex.style.display : 'fehlt';
        const altO = window.openPlantingDetail, got = [];
        window.openPlantingDetail = function (id) { got.push(id); };
        document.querySelectorAll('.planting-row').forEach(b => { try { b.click(); } catch (e) {} });
        window.openPlantingDetail = altO;
        return { vorher, nachher, got, hdr: !!hdr };
      }, [h.BOESE, h.OC]);
      await h.warte(350);
      const p = await h.pwned();
      const fremd = await s.evaluate(() => document.querySelectorAll('img[src="x"]').length);
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (fremd) return { ok: false, warum: fremd + ' fremde Elemente' };
      if (!r.hdr || r.vorher === r.nachher) return { ok: false, warum: 'Karte klappt nicht auf: ' + JSON.stringify(r) };
      if (r.got.indexOf(h.OC) < 0) return { ok: false, warum: 'Pflanzung bekam: ' + JSON.stringify(r.got) };
      return { ok: true, info: 'Ausbruchs-Id kommt als Text an (toggle + openPlantingDetail), Anzahl als Zahl' };
    },
  },
  {
    name: 'Gespeicherte Plaene · Plan-Id im onclick und Beetmasse als Text',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate(async ([boese, oc]) => {
        localStorage.setItem('gs_garden_plans', JSON.stringify([{ id: oc, title: 'Plan', created: Date.now(), plan: { bed: { width_m: boese, length_m: 2 }, plants: [] } }]));
        const altL = window.sbIsLoggedIn; window.sbIsLoggedIn = () => false;
        await gsPPopenSavedPlans();
        window.sbIsLoggedIn = altL;
        const m = document.getElementById('modal-saved-plans');
        const got = [];
        const altR = window.gsPPrenamePlan; window.gsPPrenamePlan = function (id) { got.push(id); };
        const b = m && m.querySelector('button[onclick*="gsPPrenamePlan"]');
        if (b) b.click();
        window.gsPPrenamePlan = altR;
        const out = { da: !!m, got, text: m ? m.textContent : '' };
        if (m) m.remove();
        return out;
      }, [h.BOESE, h.OC]);
      await h.warte(350);
      const p = await h.pwned();
      if (!r.da) return { ok: false, warum: 'Fenster ging nicht auf' };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (JSON.stringify(r.got) !== JSON.stringify([h.OC])) return { ok: false, warum: 'Umbenennen bekam: ' + JSON.stringify(r.got) };
      if (r.text.indexOf('onerror') < 0) return { ok: false, warum: 'Beetmass nicht als Text sichtbar' };
      return { ok: true, info: 'Plan-Id unveraendert angekommen, Beetmass als Text' };
    },
  },
  {
    name: 'Foto-Verlauf · ein Foto, das keine Bildadresse ist, faellt weg; ein data:image bleibt',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate(() => {
        myPlants = [{ id: 'k5f', name: 'A', emoji: '🌿', photo: 'x" onerror="window.__pwned=1', added: new Date(Date.now() - 9 * 864e5).toISOString(),
          diary: [{ ts: Date.now(), title: 't', photo: 'data:image/png;base64,iVBORw0KGgo=' },
                  { ts: Date.now() - 864e5, title: 'q', photo: 'gsphoto://7' }] }];   // Platzhalter aus dem Ausgangskorb (v31.06) muss bleiben
        gsOpenPhotoTimeline('k5f');
        const m = document.getElementById('photo-timeline-modal');
        const srcs = [], out = { da: !!m, attrs: 0 };
        const nimm = () => { if (!m) return; Array.from(m.querySelectorAll('img')).forEach(i => srcs.push(i.getAttribute('src'))); out.attrs += m.querySelectorAll('img[onerror]').length; };
        nimm(); gsPhotoTimelineSeek(0); nimm(); gsPhotoTimelineSeek(1); nimm(); gsPhotoTimelineMode('compare'); nimm();   // jedes Foto einmal gezeigt, auch das Profilfoto
        out.srcs = srcs;
        if (m) m.remove();
        return out;
      });
      await h.warte(350);
      const p = await h.pwned();
      if (!r.da) return { ok: false, warum: 'Fenster ging nicht auf' };
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.attrs) return { ok: false, warum: r.attrs + ' Bilder mit onerror' };
      if (!r.srcs.some(x => /^data:image\//.test(x || ''))) return { ok: false, warum: 'gutes Foto fehlt: ' + JSON.stringify(r.srcs) };
      if (!r.srcs.some(x => x === 'gsphoto://7')) return { ok: false, warum: 'Platzhalter gsphoto:// fehlt (Foto im Ausgangskorb waere leer): ' + JSON.stringify(r.srcs) };
      return { ok: true, info: 'Bilder: ' + JSON.stringify(r.srcs.map(x => (x || '').slice(0, 16))) };
    },
  },
  {
    name: 'Universal-Suche · Pflanzenname und Suchtext als Text',
    lauf: async (seite, h) => {
      const s = h.seite();
      await s.evaluate((boese) => {
        myPlants = [{ id: 'k5u', name: 'Tomate ' + boese, emoji: '🍅', lat: 'Solanum' }];
        gsOpenUniversalSearch();
        const i = document.getElementById('gs-univ-input');
        i.value = 'Tomate'; i.dispatchEvent(new Event('input'));
      }, h.BOESE);
      await h.warte(700);
      const m = await messen(h, s, '#gs-univ-results');
      await s.evaluate(() => { try { gsCloseUniversalSearch(); } catch (e) {} });
      if (!m.da) return { ok: false, warum: 'Ergebnisliste fehlt' };
      if (m.pwned !== null) return { ok: false, warum: 'Code lief (__pwned=' + m.pwned + ')' };
      if (m.fremd) return { ok: false, warum: m.fremd + ' fremde Elemente' };
      if (m.text.indexOf('Tomate <img') < 0) return { ok: false, warum: 'Treffer nicht als Text: ' + m.text.slice(0, 120) };
      return { ok: true, info: 'Treffer zeigt den Namen als Text' };
    },
  },
  {
    name: '„Mein Garten in Zahlen" · Kategorie und unbekannte Tagebuch-Aktion als Text',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate((boese) => {
        myPlants = [{ id: 'k5s', name: 'A', cat: boese, diary: [{ ts: Date.now(), action: boese }, { ts: Date.now(), action: 'water' }] }];
        const d = document.createElement('div'); document.body.appendChild(d);
        d.innerHTML = gsRenderGardenStats();
        const out = { fremd: d.querySelectorAll('img[src="x"], img[onerror]').length, text: d.textContent };
        d.remove(); return out;
      }, h.BOESE);
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.fremd) return { ok: false, warum: r.fremd + ' fremde Elemente' };
      if (r.text.indexOf('Gegossen') < 0 || r.text.indexOf('onerror') < 0) return { ok: false, warum: 'Text fehlt: ' + r.text.slice(0, 160) };
      return { ok: true, info: 'Kategorie und Aktion als Text, „💧 Gegossen" unveraendert' };
    },
  },
  {
    name: 'Eigenes Profil · avatar_emoji und stats aus der Profilzeile, E-Mail in der Registrier-Bestaetigung',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate(async (boese) => {
        _sbProfile = { display_name: 'Anna', avatar_emoji: boese, stats: { scans: boese, favs: '7', quiz_correct: 3 }, total_logins: boese };
        const d = document.createElement('div'); document.body.appendChild(d);
        await renderProfileLoggedIn(d);
        const out = { fremd: d.querySelectorAll('img[src="x"], img[onerror]').length, text: d.textContent };
        _sbProfile = { display_name: 'Anna', avatar_emoji: '🌻', stats: { scans: 12 } };
        await renderProfileLoggedIn(d);
        out.gut = d.textContent;
        d.remove();
        _sbProfile = null;
        return out;
      }, h.BOESE);
      await h.warte(350);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.fremd) return { ok: false, warum: r.fremd + ' fremde Elemente' };
      if (r.text.indexOf('7') < 0 || r.gut.indexOf('🌻') < 0 || r.gut.indexOf('12') < 0) return { ok: false, warum: 'guter Wert fehlt' };
      return { ok: true, info: 'feindlicher Avatar → 🌿, feindliche Zahl → 0 · 🌻 und 12 bleiben' };
    },
  },
  {
    name: 'CSV · eine Formel-Zelle bekommt ein \' davor, ein normaler Name bleibt, Zahlen bleiben Zahlen',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate(async () => {
        myPlants = [
          { id: 'k5c', name: '=HYPERLINK("http://x";"y")', lat: '+1+1', fam: '@SUM(A1)', cat: '\tx', notes: '-Blaetter gelb', diary: [] },
          { id: 'k5d', name: 'Tom\'s "Bio" Basilikum', lat: 'Ocimum', notes: 'gut', diary: [] },
        ];
        const altD = window.gsDateiSpeichern; let blob = null;
        window.gsDateiSpeichern = function (b) { blob = b; return Promise.resolve({ state: 'gespeichert' }); };
        await gsExportPlantsCSV();
        const pfl = blob ? await blob.text() : '';
        blob = null;
        const mw = gsExportMesswerteCSV();
        window.gsDateiSpeichern = altD;
        return { pfl, mw: String(mw || '') };
      });
      const z = r.pfl.replace(/^﻿/, '').split('\r\n');
      const soll1 = '"\'=HYPERLINK(""http://x"";""y"")","\'+1+1","\'@SUM(A1)","\'\tx"';
      if (z[1].indexOf(soll1) !== 0) return { ok: false, warum: 'Zeile 1: ' + JSON.stringify(z[1]) };
      if (!/,0,/.test(z[1]) || !/"'-Blaetter gelb"$/.test(z[1])) return { ok: false, warum: 'Zahl oder Notiz falsch: ' + JSON.stringify(z[1]) };
      if (z[2].indexOf('"Tom\'s ""Bio"" Basilikum","Ocimum"') !== 0) return { ok: false, warum: 'Zeile 2 veraendert: ' + JSON.stringify(z[2]) };
      if (!/,52,/.test(r.mw)) return { ok: false, warum: 'Messwert keine nackte Zahl: ' + r.mw.split('\r\n')[1] };
      return { ok: true, info: '4 Formel-Zellen mit \' · „Tom\'s ""Bio""" unveraendert · 0 und 52 als nackte Zahl' };
    },
  },
  {
    name: 'Smart-Home-Dashboard · Schwellwert, Messwert und Alert-Text aus der Cloud als Zahl bzw. Text',
    lauf: async (seite, h) => {
      const s = h.seite();
      const r = await s.evaluate(async (boese) => {
        const t = new Date().toISOString();
        const altL = window.sbIsLoggedIn, altF = window.sbFetch;
        try { localStorage.removeItem('gs_sh_demo'); } catch (e) {}
        window.sbIsLoggedIn = () => true;
        window.sbFetch = async (path) => {
          if (path.indexOf('sensor_devices') >= 0) return { data: [{ id: 'd1', name: 'Beet', kind: 'soil', is_online: true, config: { thresholds: { default: { min: boese, max: '30' } } } }] };
          if (path.indexOf('sensor_readings') >= 0) return { data: [{ ts: t, metric: 'soil', value_num: 22, unit: '%' }, { ts: t, metric: 'soil', value_num: boese, unit: '%' }] };
          if (path.indexOf('sensor_alerts') >= 0) return { data: [{ message: boese, metric: 'soil', direction: 'below', created_at: t }, { message: 'Beet trocken', metric: 'soil', created_at: t }] };
          return { data: [] };
        };
        await gsShOpen();
        const body = document.getElementById('sh-body');
        const out = { fremd1: body.querySelectorAll('img[src="x"], img[onerror]').length, text: body.textContent };
        gsShOpenDetail(0);
        const mn = document.getElementById('sh-thr-min'), mx = document.getElementById('sh-thr-max');
        out.fremd2 = body.querySelectorAll('img[src="x"], img[onerror], [onmouseover]').length;
        out.min = mn ? mn.getAttribute('value') : 'fehlt'; out.max = mx ? mx.getAttribute('value') : 'fehlt';
        try { gsShClose(); } catch (e) {}
        window.sbIsLoggedIn = altL; window.sbFetch = altF;
        return out;
      }, h.BOESE);
      await h.warte(400);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.fremd1 || r.fremd2) return { ok: false, warum: 'fremde Elemente: ' + r.fremd1 + '/' + r.fremd2 };
      if (r.max !== '30' || r.min !== '') return { ok: false, warum: 'Schwellwerte: ' + JSON.stringify([r.min, r.max]) };
      if (r.text.indexOf('Beet trocken') < 0 || r.text.indexOf('22') < 0) return { ok: false, warum: 'guter Wert fehlt: ' + r.text.slice(0, 160) };
      return { ok: true, info: 'Min (Text) → leer, Max „30" bleibt · Alert-Text als Text · Messwert 22' };
    },
  },
  {
    name: 'Mitteilungs-Link · ein &#39; im Link beendet den JS-String im onclick nicht mehr — und ein Link mit & kommt unveraendert an',
    lauf: async (seite, h) => {
      const s = h.seite();
      const boeseLink = 'https://x.example/&#39;);window.__pwned=1;//';
      const gutLink = 'https://example.org/a?b=1&c=2#x';
      const r = await s.evaluate(async ([bl, gl]) => {
        const t = new Date().toISOString();
        window._gsServerNotifs = [
          { id: 'n1', kind: 'k5_test', title: 'Boese', body: '', link: bl, created_at: t, is_read: false },
          { id: 'n2', kind: 'k5_test', title: 'Gut', body: '', link: gl, created_at: t, is_read: false },
        ];
        window._gsNcTab = 'new';
        const altO = window.open, altA = window.gsNotifArchiveOne, offen = [], arch = [];
        window.open = function (u) { offen.push(u); return null; };
        window.gsNotifArchiveOne = function (id) { arch.push(id); };
        gsNcRender();
        const rows = Array.from(document.querySelectorAll('#gs-nc-body .gs-nc-row-body'));
        rows.forEach(b => { try { b.click(); } catch (e) {} });
        await new Promise(r => setTimeout(r, 450));
        window.open = altO; window.gsNotifArchiveOne = altA;
        window._gsServerNotifs = [];
        return { n: rows.length, offen, arch };
      }, [boeseLink, gutLink]);
      await h.warte(200);
      const p = await h.pwned();
      if (p !== null) return { ok: false, warum: 'Code lief (__pwned=' + p + ')' };
      if (r.n < 2) return { ok: false, warum: 'Mitteilungen nicht gerendert (' + r.n + ')' };
      if (r.offen.indexOf(gutLink) < 0) return { ok: false, warum: 'guter Link kam veraendert an: ' + JSON.stringify(r.offen) };
      if (r.offen.indexOf(boeseLink) < 0) return { ok: false, warum: 'feindlicher Link nicht als Text angekommen: ' + JSON.stringify(r.offen) };
      if (r.arch.indexOf('srv_n1') < 0) return { ok: false, warum: 'Archiv-Id: ' + JSON.stringify(r.arch) };
      return { ok: true, info: 'beide Links kommen woertlich in window.open an, 0 ausgefuehrt' };
    },
  },
];
