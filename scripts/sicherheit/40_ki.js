// Gruppe k4 — KI-Ausgaben: Pflanzendoktor, Garten-Scan, Planer, gespeicherte
// Plaene, selbstgebautes onclick-Escaping (JSON.stringify(x).replace(/"/g,'&quot;')).
// Jeder Fall ruft die ECHTE Funktion mit einem feindlichen Wert (die KI ist
// gestellt, die Anzeige nicht) und misst window.__pwned bzw. das DOM —
// und daneben den gutartigen Wert, der weiter dastehen muss.
'use strict';

// Kleiner Rahmen: Fall in der Seite ausfuehren, warten, __pwned lesen.
async function messen(seite, h, fn, arg) {
  const r = await seite.evaluate(fn, arg);
  await h.warte(400);
  const p = await h.pwned();
  return { r: r || {}, p };
}
function urteil(m, pruef) {
  if (m.p !== null) return { ok: false, warum: 'Code lief (__pwned=' + m.p + ') · ' + JSON.stringify(m.r).slice(0, 300) };
  const w = pruef(m.r);
  return w ? { ok: false, warum: w + ' · ' + JSON.stringify(m.r).slice(0, 300) } : { ok: true, info: m.r.info || '' };
}

const BOESE = '<img src=x onerror="window.__pwned=1">';
const QUOT = 'Mehltau&quot;+(window.__pwned=1)+&quot;';   // bricht JSON.stringify(x).replace(/"/g,'&quot;')

module.exports = [
  {
    name: 'Pflanzendoktor · KI-Antwort mit <img onerror>: Text in der Anzeige UND in gs_doctor_history, **fett** und Zeilen bleiben',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (boese) => {
      localStorage.removeItem('gs_doctor_history');
      gsOpenPlantDoctor();
      window.callVisionAI = async () => '**Diagnose:** Echter Mehltau\nZeile 2 ' + boese;
      const f = new File([new Uint8Array([255, 216, 255, 217])], 'b.jpg', { type: 'image/jpeg' });
      await gsDoctorRun(f);
      for (let i = 0; i < 40; i++) { const o = document.getElementById('gs-doctor-out'); if (o && !/Analysiere/.test(o.textContent)) break; await new Promise(r => setTimeout(r, 50)); }
      const out = document.getElementById('gs-doctor-out');
      const roh = localStorage.getItem('gs_doctor_history') || '';
      return { img: out.querySelectorAll('img').length, strong: out.querySelectorAll('strong').length, br: out.querySelectorAll('br').length,
               text: out.textContent.indexOf('<img src=x') >= 0, speicherImg: /<img/i.test(roh) && /"html"/.test(roh), info: 'Antwort und Historie: 0 Bilder · <strong> und <br> bleiben' };
    }, BOESE), r => (r.img ? 'ein <img> entstand' : !r.strong || !r.br ? 'Auszeichnung verloren' : !r.text ? 'der Wert steht nicht als Text da' : r.speicherImg ? 'die Historie speichert HTML' : '')),
  },
  {
    name: 'Pflanzendoktor · Historie: Altbestand mit rohem HTML (aus Cloud/Snapshot) wird beim Oeffnen gesaeubert, <b> bleibt, neuer Text-Eintrag ebenso',
    lauf: async (seite, h) => urteil(await messen(seite, h, (boese) => {
      localStorage.setItem('gs_doctor_history', JSON.stringify([
        { date: '2026-11-01', summary: 'alt', html: '<b>Alt fett</b> ' + boese + '<svg onload="window.__pwned=2"></svg><a href="javascript:window.__pwned=3">x</a>', ts: 1 },
        { date: '2026-11-02', summary: 'neu', text: '**Neu** ' + boese, ts: 2 },
      ]));
      gsOpenPlantDoctor();
      const b = document.getElementById('gs-nl-body');
      b.querySelectorAll('details').forEach(d => { d.open = true; });
      const a = b.querySelector('details a');
      return { img: b.querySelectorAll('details img, details svg').length, bAlt: !!Array.from(b.querySelectorAll('details b')).find(x => x.textContent === 'Alt fett'),
               neuStrong: !!Array.from(b.querySelectorAll('details strong')).find(x => x.textContent === 'Neu'), neuText: b.textContent.indexOf('<img src=x') >= 0,
               js: a ? (a.getAttribute('href') || '') : '', info: 'Altbestand ohne aktives Element, Text-Eintrag escaped' };
    }, BOESE), r => (r.img ? 'aktives Element in der Historie' : /javascript/i.test(r.js) ? 'javascript:-Link blieb' : !r.bAlt ? '<b> im Altbestand verloren' : !r.neuStrong || !r.neuText ? 'neuer Eintrag falsch gerendert' : '')),
  },
  {
    name: 'Pflanzendoktor (Edge) · Diagnosename mit &quot; im onclick „Zu Lina wechseln" — kommt unveraendert an, kein Code; history_id mit Apostroph ebenso',
    lauf: async (seite, h) => urteil(await messen(seite, h, (a) => {
      let box = document.getElementById('doctor-result');
      if (!box) { box = document.createElement('div'); box.id = 'doctor-result'; document.body.appendChild(box); }
      const got = [];
      window.gsDoctorToLina = function (n, p) { got.push([n, p]); };
      window.gsDoctorFollowup = function (id, st) { got.push([id, st]); };
      const namen = [a.quot, "Echter Mehltau (Erysiphe) — Gärtner's Rat"];
      const out = namen.map(n => {
        gsRenderDoctorResult({ diagnosis: { hypotheses: [{ name: n, confidence: 0.7, reason: 'r' }] }, treatment_plan: {}, history_id: a.oc }, null);
        Array.from(box.querySelectorAll('button')).forEach(b => { try { b.click(); } catch (e) {} });
        return got.splice(0);
      });
      box.innerHTML = '';
      return { out, info: '2 Namen unveraendert in gsDoctorToLina · history_id unveraendert in gsDoctorFollowup' };
    }, { quot: QUOT, oc: "x');window.__pwned=1;//" }), r => {
      const ok0 = r.out[0].some(x => x[0] === QUOT), ok1 = r.out[1].some(x => x[0] === "Echter Mehltau (Erysiphe) — Gärtner's Rat");
      const hid = r.out[0].some(x => x[0] === "x');window.__pwned=1;//" && x[1] === 'helpful');
      return !ok0 || !ok1 ? 'Name kam nicht unveraendert an' : !hid ? 'history_id kam nicht unveraendert an' : '';
    }),
  },
  {
    name: 'KI-Garten-Scan · Pflanzen-Detail, Kopfzeile und Chat-Leiste: jedes Textfeld der Analyse bleibt Text; gutartiger Name steht da',
    lauf: async (seite, h) => urteil(await messen(seite, h, (boese) => {
      let mc = document.getElementById('modal-content');
      const pl = { name: "Tomate 'Ochsenherz' " + boese, lat: boese, category: boese, qty: boese, position: { x: boese, y: 1, row: boese }, spacing_cm: boese,
                   sow_date: boese, harvest_date: boese, yield_kg_estimate: boese, companion_plants: [boese, 'Basilikum'], incompatible_plants: [boese], care_intensity: boese, reason: boese };
      window._gsGardenScan = { analysis: { recommended_plants: [pl], site_analysis: { size_m2: boese, shape: boese, light: { level: boese } }, warnings: [] },
                               plan_id: '12345678-aaaa', last_change_summary: boese, iteration_count: boese };
      window.gsLoadCompanionsForPlanPlant = () => {}; window.gsLoadPestsForPlanPlant = () => {};
      gsGardenScanShowPlant(0);
      const detail = mc.innerHTML, imgD = mc.querySelectorAll('img').length, gut = mc.textContent.indexOf("Tomate 'Ochsenherz'") >= 0;
      const d = document.createElement('div'); document.body.appendChild(d);
      d.innerHTML = gsBuildGardenScanResultPreview(window._gsGardenScan.analysis, '12345678-aaaa');
      const imgV = d.querySelectorAll('img').length; d.remove();
      return { imgD, imgV, gut, info: 'Detail 0 Bilder · Vorschau mit Kopfzeile und Chat-Leiste 0 Bilder · Name mit Apostroph steht da' };
    }, BOESE), r => (r.imgD || r.imgV ? 'ein <img> entstand' : !r.gut ? 'gutartiger Name fehlt' : '')),
  },
  {
    name: 'KI-Garten-Scan · Antwort von plan-iterate geht durch _gsSanitizeGardenPlan (Position geklemmt) und die Zusammenfassung bleibt Text',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (boese) => {
      let mc = document.getElementById('modal-content');
      window._gsGardenScan = { analysis: { recommended_plants: [], site_analysis: {}, layout_grid: { width_m: 4, depth_m: 3 } }, plan_id: 'p-1', viewMode: '2d' };
      mc.innerHTML = gsBuildGardenScanResultPreview(window._gsGardenScan.analysis, 'p-1');
      const inp = document.getElementById('garden-scan-chat-input'); if (inp) inp.value = 'mehr Basilikum';
      window.gsIteratePlan = async () => ({ ok: true, iteration_count: 1, iterations_remaining: 4, change_summary: boese,
        analysis: { layout_grid: { width_m: 4, depth_m: 3 }, site_analysis: { size_m2: 12 }, recommended_plants: [{ name: 'Basilikum', qty: 2, position: { x: 999, y: -5 } }] } });
      await gsGardenScanChatSend();
      const p0 = window._gsGardenScan.analysis.recommended_plants[0].position;
      return { x: p0.x, y: p0.y, img: mc.querySelectorAll('img').length, text: mc.textContent.indexOf('<img src=x') >= 0, info: 'x 999 → 4, y -5 → 0 · Zusammenfassung als Text' };
    }, BOESE), r => (r.img ? 'ein <img> entstand' : r.x !== 4 || r.y !== 0 ? 'nicht durch den Sanitizer (x=' + r.x + ', y=' + r.y + ')' : !r.text ? 'Zusammenfassung fehlt als Text' : '')),
  },
  {
    name: 'Alter Garten-Scanner (analyzeGardenWithAI) · KI-Antwort bleibt Text, die •-Aufzaehlung bleibt',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (boese) => {
      const ids = ['gs-analyze-btn', 'gs-result', 'gs-scan-canvas'];
      const tmp = [];
      ids.forEach(id => { if (!document.getElementById(id)) { const e = document.createElement(id === 'gs-scan-canvas' ? 'canvas' : (id === 'gs-analyze-btn' ? 'button' : 'div')); e.id = id; if (id === 'gs-scan-canvas') e.style.display = 'none'; document.body.appendChild(e); tmp.push(e); } });
      const cv = document.getElementById('gs-scan-canvas'); const altDisp = cv.style.display; cv.style.display = 'none';
      window.callAI = async () => '• Tomate\n• Basilikum ' + boese;
      await analyzeGardenWithAI();
      const res = document.getElementById('gs-result');
      const out = { img: res.querySelectorAll('img').length, bullets: (res.innerHTML.match(/font-weight:800">• /g) || []).length, text: res.textContent.indexOf('<img src=x') >= 0, info: '0 Bilder · 2 Aufzaehlungspunkte · Wert als Text' };
      cv.style.display = altDisp; res.innerHTML = ''; tmp.forEach(e => e.remove());
      return out;
    }, BOESE), r => (r.img ? 'ein <img> entstand' : r.bullets !== 2 ? 'Aufzaehlung verloren (' + r.bullets + ')' : !r.text ? 'Wert fehlt als Text' : '')),
  },
  {
    name: 'Planer · Flaechen- und Boden-Foto: description/typeLabel/recommendation bleiben Text, Konfidenz nur als Zahl',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (boese) => {
      const orig = document.createElement.bind(document);
      let inp = null;
      document.createElement = function (t) { const e = orig(t); if (String(t).toLowerCase() === 'input') { inp = e; e.click = () => {}; } return e; };
      window.gsPPfileToB64 = async () => 'AAAA';
      window.gsPPreadExifFocalLength = async () => null;
      window.gsPPanalyzeAreaPhoto = async () => ({ width_m: 4, length_m: 3, description: 'Rasen ' + boese, confidence: '80' + boese });
      window.gsPPanalyzeSoil = async () => ({ typeLabel: 'Lehm ' + boese, description: boese, recommendation: boese });
      const f = new File([new Uint8Array([1])], 'b.jpg', { type: 'image/jpeg' });
      const r = {};
      try {
        gsPPcapturePhoto(); await inp.onchange({ target: { files: [f] } });
        const a = document.getElementById('pp-photo-analysis');
        r.imgA = a ? a.querySelectorAll('img').length : -1; r.textA = a ? a.textContent.indexOf('Rasen <img') >= 0 : false;
        gsPPcaptureSoil(); await inp.onchange({ target: { files: [f] } });
        const s = document.getElementById('pp-soil-analysis');
        r.imgS = s ? s.querySelectorAll('img').length : -1; r.textS = s ? s.textContent.indexOf('Lehm <img') >= 0 : false;
      } finally { document.createElement = orig; }
      r.info = 'Flaeche und Boden: 0 Bilder, Werte als Text';
      return r;
    }, BOESE), r => (r.imgA || r.imgS ? 'ein <img> entstand (Flaeche ' + r.imgA + ', Boden ' + r.imgS + ')' : !r.textA || !r.textS ? 'Wert fehlt als Text' : '')),
  },
  {
    name: 'Planer · gsPPRefine: Antwort der KI mit boesen Zahlfeldern, db_id und _-Feldern — kein Code, die Antwort geht durch Sieb und Pruefwerk',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (a) => {
      const B = a.boese;
      const plan = { summary: 'Testplan', bed: { width_m: 4, length_m: 3 }, plants: [{ name: 'Tomate', w_m: 1, h_m: 1, x_m: 0, y_m: 0, count: 2 }] };
      window._gsPP = window._gsPP || {}; window._gsPP.plan = plan; window._gsPP.data = { width: 4, length: 3 };
      const np = { summary: 'neu', bed: { width_m: 4, length_m: 3 },
        plants: [{ name: "Gärtner's Tomate", w_m: B, h_m: '1', x_m: 0, y_m: 0, count: B, db_id: a.oc, color: "fff;position:fixed;inset:0;x:" , _kein_platz: B }],
        timeline: [{ week: B, action: 'Saat' }], stepByStep: [{ step: B, title: 'Los', duration_min: B }], harvest: { est_kg_total: B, est_value_chf: B },
        _dichte: { eng: [{ name: 'x', count: 1, spacing: B, braucht: B, hat: B, passt: B }] }, _meta: { usedArea: B, bedArea: 1, utilization: 5 } };
      window.callAI = async () => JSON.stringify(np);
      window.gsPlans = window.gsPlans || {}; const altSave = window.gsPlans.save; window.gsPlans.save = async () => ({});
      let res = document.getElementById('pp-plan-result');
      const tmp = !res; if (tmp) { res = document.createElement('div'); res.id = 'pp-plan-result'; document.body.appendChild(res); }
      try { await gsPPRefine('mehr Tomaten'); } finally { window.gsPlans.save = altSave; }
      const p0 = window._gsPP.plan.plants[0];
      const klick = res.querySelector('[onclick*="openDetail"]');
      window.openDetail = function () {}; window.closeModal = window.closeModal || function () {};
      if (klick) { try { klick.click(); } catch (e) {} }
      const out = { img: res.querySelectorAll('img').length, gut: res.textContent.indexOf("Gärtner's Tomate") >= 0, count: p0.count, dbid: p0.db_id || null,
        color: p0.color || null, dichte: JSON.stringify(window._gsPP.plan._dichte || null).indexOf('<img') >= 0, info: 'kein Code · Name mit Apostroph steht da · count/db_id/color/_dichte aus der KI verworfen' };
      if (tmp) res.remove(); else res.innerHTML = '';
      return out;
    }, { boese: BOESE, oc: "zz');window.__pwned=1;//" }), r => (r.img ? 'ein <img> entstand' : !r.gut ? 'gutartiger Name fehlt' : r.dbid && /pwned/.test(r.dbid) ? 'db_id der KI blieb stehen' : r.color && /fixed/.test(r.color) ? 'Farbe der KI blieb' : r.dichte ? '_dichte der KI blieb' : '')),
  },
  {
    name: '„Meine Plaene" · Legacy-Plan mit Apostroph-Id und boesem gespeichertem Plan: Liste klicken fuehrt keinen Code aus, der Plan rendert ohne Bild',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (a) => {
      const B = a.boese;
      localStorage.setItem('gs_garden_plans', JSON.stringify([{ id: a.oc, created: '2026-11-01T10:00:00Z', title: "Opa's Beet", data: { width: 4, length: 3 },
        plan: { summary: 's', bed: { width_m: 4, length_m: 3 }, plants: [{ name: 'Kohl', w_m: B, h_m: 1, x_m: 0, y_m: 0, count: B, db_id: "zz');window.__pwned=7;//" }],
                timeline: [{ week: B }], stepByStep: [{ step: B, duration_min: B, title: 't' }], _meta: { usedArea: B, bedArea: 12 } } }]));
      localStorage.removeItem('gs_plans_v2');
      window.gsPlans && (window.gsPlans.list = window.gsPlans.list);
      await gsPlansOpen();
      const body = document.getElementById('gs-plans-body');
      const titel = body ? body.textContent.indexOf("Opa's Beet") >= 0 : false;
      const ziel = body ? body.querySelector('[onclick*="_gsPlansLoad"]') : null;
      let geladen = null;
      const altLoad = window._gsPlansLoad;
      if (ziel) { try { ziel.click(); } catch (e) {} }
      await new Promise(r => setTimeout(r, 450));
      const res = document.getElementById('pp-plan-result');
      geladen = res ? { img: res.querySelectorAll('img').length, kohl: res.textContent.indexOf('Kohl') >= 0 } : null;
      try { const s = document.getElementById('gs-plans-screen'); if (s) s.style.display = 'none'; closeModal('modal-planner-pro'); } catch (e) {}
      return { titel, ziel: !!ziel, geladen, altLoad: typeof altLoad, info: 'Klick: kein Code · Titel steht da · gespeicherter Plan rendert ohne Bild' };
    }, { boese: BOESE, oc: "1');window.__pwned=1;//" }), r => (!r.ziel ? 'kein Listeneintrag gerendert' : !r.titel ? 'Titel fehlt' : !r.geladen ? 'Plan nicht geladen' : r.geladen.img ? 'gespeicherter Plan rendert ein <img>' : !r.geladen.kohl ? 'Pflanze fehlt' : '')),
  },
  {
    name: 'Gespeicherte Plaene · beide Ladewege (Meine Plaene, gsPPloadSavedPlan) gehen durch Sieb und Pruefwerk: gespeicherte _-Felder und Zahlfelder aus fremder Hand wirken nicht',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (a) => {
      const B = a.boese;
      // gutartige Id — hier misst der Fall den LADEWEG, nicht das onclick
      localStorage.setItem('gs_garden_plans', JSON.stringify([{ id: 'plan_ok_1', created: '2026-11-01T10:00:00Z', title: 'Beet ok', data: { width: 4, length: 3 },
        plan: { summary: 's', bed: { width_m: 4, length_m: 3 }, plants: [{ name: 'Kohl', w_m: 1, h_m: 1, x_m: 0, y_m: 0, count: 2, spacing_cm: B }],
                _dichte: { eng: [{ count: 1, name: 'x', spacing: B, braucht: B, hat: B, passt: B }], ok: 0, ungeprueft: 0 } } }]));
      localStorage.removeItem('gs_plans_v2');
      const lesen = () => {
        const res = document.getElementById('pp-plan-result'), pl = (window._gsPP && window._gsPP.plan) || {};
        const p0 = (pl.plants || [])[0] || {};
        return { img: res ? res.querySelectorAll('img').length : -1, kohl: res ? res.textContent.indexOf('Kohl') >= 0 : false,
                 dichte: JSON.stringify(pl._dichte || null).indexOf('<img') >= 0, spacing: typeof p0.spacing_cm };
      };
      const zu = () => { try { const s = document.getElementById('gs-plans-screen'); if (s) s.style.display = 'none'; closeModal('modal-planner-pro'); } catch (e) {} };
      await gsPlansOpen();
      const body = document.getElementById('gs-plans-body');
      const ziel = body ? body.querySelector('[onclick*="_gsPlansLoad"]') : null;
      if (ziel) { try { ziel.click(); } catch (e) {} }
      await new Promise(r => setTimeout(r, 450));
      const liste = lesen(); zu();
      const res = document.getElementById('pp-plan-result'); if (res) res.innerHTML = '';
      try { gsPPloadSavedPlan('plan_ok_1'); } catch (e) {}
      await new Promise(r => setTimeout(r, 450));
      const direkt = lesen(); zu();
      return { ziel: !!ziel, liste, direkt, info: 'Meine Plaene und gsPPloadSavedPlan: 0 Bilder, _dichte neu gerechnet, spacing_cm keine Zeichenkette' };
    }, { boese: BOESE }), r => {
      if (!r.ziel) return 'kein Listeneintrag gerendert';
      for (const [w, x] of [['Meine Plaene', r.liste], ['gsPPloadSavedPlan', r.direkt]]) {
        if (x.img) return w + ': ein <img> entstand';
        if (x.dichte) return w + ': gespeichertes _dichte blieb stehen';
        if (x.spacing === 'string') return w + ': spacing_cm blieb Zeichenkette (kein Sieb)';
        if (!x.kohl) return w + ': Pflanze fehlt';
      }
      return '';
    }),
  },
  {
    name: 'Planer-PDF · gsPPexportPDF: boese Zahlfelder und KI-Texte landen im Druckfenster und im Rueckfall-Dialog als Text',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (a) => {
      const B = a.boese;
      window._gsPP = window._gsPP || {};
      window._gsPP.plan = { summary: 'S ' + B, bed: { width_m: 4, length_m: 3 }, climateZone: B,
        plants: [{ name: 'Rübe ' + B, w_m: 2, h_m: 2, x_m: 0, y_m: 0, count: B, spacing_cm: B, depth_cm: B, water_l_per_week: B, yield_kg: B }],
        harvest: { est_kg_total: '<script>window.opener&&(window.opener.__pwned=9)<\/script>', est_value_chf: B }, stepByStep: [{ step: 1, title: 't', duration_min: B }],
        timeline: [{ week: B, action: 'a' }], tips: [B], mixedCulture: { score: B }, biodiversity: { score: B } };
      window._gsPP.data = { width: 4, length: 3 };
      let geschrieben = '';
      const altOpen = window.open;
      window.open = function () { return { document: { write: (x) => { geschrieben += x; }, close() {}, open() {} }, focus() {}, print() {}, addEventListener() {}, onload: null, closed: false }; };
      try { await gsPPexportPDF(); } catch (e) {} finally { window.open = altOpen; }
      await new Promise(r => setTimeout(r, 300));
      const doc = new DOMParser().parseFromString(geschrieben || '', 'text/html');
      return { len: geschrieben.length, img: doc.querySelectorAll('img').length, script: Array.from(doc.querySelectorAll('script')).filter(s => /__pwned/.test(s.textContent)).length,
               ruebe: (doc.body ? doc.body.textContent : '').indexOf('Rübe <img') >= 0, info: 'Druckfenster: 0 Bilder, 0 fremde Skripte · Name als Text' };
    }, { boese: BOESE }), r => (!r.len ? 'nichts ins Druckfenster geschrieben' : r.img || r.script ? 'aktives Element im Druckfenster (img ' + r.img + ', script ' + r.script + ')' : !r.ruebe ? 'Name fehlt als Text' : '')),
  },
  {
    name: 'Voice-Modus und Agent-Status · KI-Antwort, Fehlertext und Ertrag aus gs_garden_plan_current bleiben Text',
    lauf: async (seite, h) => urteil(await messen(seite, h, (boese) => {
      const d = document.createElement('div'); document.body.appendChild(d);
      window._gsVoiceState = { status: 'speaking', reply: 'Giess morgens ' + boese };
      d.innerHTML = gsBuildVoiceModalContent();
      const v1 = d.querySelectorAll('img').length, t1 = d.textContent.indexOf('Giess morgens <img') >= 0;
      window._gsVoiceState = { status: 'error', errorMsg: boese };
      d.innerHTML = gsBuildVoiceModalContent();
      const v2 = d.querySelectorAll('img').length; d.remove();
      localStorage.setItem('gs_garden_plan_current', JSON.stringify({ plan: { plants: [], harvest: { est_kg_total: boese } }, created: new Date().toISOString(), refinements: [] }));
      let html = '';
      const alt = window._gsAgentShowModal;
      window._gsAgentShowModal = function (t, x) { html = x; };
      try { gsAgentShowStatus(); } finally { window._gsAgentShowModal = alt; }
      const e = document.createElement('div'); e.innerHTML = html; document.body.appendChild(e);
      const a = e.querySelectorAll('img').length; e.remove();
      localStorage.removeItem('gs_garden_plan_current');
      return { v1, v2, t1, a, info: 'Sprechen/Fehler/Agent: 0 Bilder · Antwort als Text' };
    }, BOESE), r => (r.v1 || r.v2 || r.a ? 'ein <img> entstand (' + [r.v1, r.v2, r.a] + ')' : !r.t1 ? 'Antwort fehlt als Text' : '')),
  },
  {
    name: 'JSON.stringify-Bauform · Galerie „Nach Art": ein Name mit &quot; kommt unveraendert in gsGalOpenSpecies an, kein Code',
    lauf: async (seite, h) => urteil(await messen(seite, h, (q) => {
      const grid = document.createElement('div'); document.body.appendChild(grid);
      const got = []; const alt = window.gsGalOpenSpecies; window.gsGalOpenSpecies = function (n) { got.push(n); };
      const items = [q, "Bärlauch 'wild'"].map((n, i) => ({ name: n, url: 'data:image/png;base64,AAAA', ts: Date.now() - i, latin: '' }));
      try { _gsGalRenderSpeciesView(grid, items.map(x => Object.assign({ img: x.url, src: x.url, image: x.url, timestamp: new Date(x.ts).toISOString() }, x)), (k, f) => f, escHtml); } catch (e) { got.push('FEHLER ' + e.message); }
      Array.from(grid.querySelectorAll('button[onclick*="gsGalOpenSpecies"]')).forEach(b => { try { b.click(); } catch (e) {} });
      window.gsGalOpenSpecies = alt; grid.remove();
      return { got, info: 'beide Namen unveraendert angekommen' };
    }, QUOT), r => (r.got.indexOf(QUOT) < 0 || r.got.indexOf("Bärlauch 'wild'") < 0 ? 'Name kam nicht unveraendert an' : '')),
  },
  {
    name: 'onclick-Ids · Balkon-Vorlagen (gsBalconyWizardSearch): slug mit Apostroph kommt unveraendert an, container_count bleibt Text',
    lauf: async (seite, h) => urteil(await messen(seite, h, async (a) => {
      const got = [];
      const altFetch = window.sbFetch, altOpen = window.gsBalconyTemplateOpen, altCh = window.gsBalconyWizardChanged;
      let box = document.getElementById('gs-balcony-results'); const tmp = !box;
      if (tmp) { box = document.createElement('div'); box.id = 'gs-balcony-results'; document.body.appendChild(box); }
      window._gsGardenScan = { metadata: { balcony_size_m2: 4, balcony_orientation: '' } };
      window.gsBalconyWizardChanged = () => {};
      window.sbFetch = async () => ({ data: [{ slug: a.oc, name_de: "Nonna's Balkon", difficulty: 'einfach', container_count: a.boese, total_cost_chf: 5 },
                                             { slug: 'kraeuter-sued', name_de: 'Kräuter Süd', difficulty: 'mittel', container_count: 3, total_cost_chf: 9 }] });
      window.gsBalconyTemplateOpen = (s) => got.push(s);
      try { await gsBalconyWizardSearch(); } finally { window.sbFetch = altFetch; }
      Array.from(box.querySelectorAll('[onclick*="gsBalconyTemplateOpen"]')).forEach(x => { try { x.click(); } catch (e) {} });
      const out = { got, img: box.querySelectorAll('img').length, titel: box.textContent.indexOf("Nonna's Balkon") >= 0, info: '2 slugs unveraendert · 0 Bilder' };
      window.gsBalconyTemplateOpen = altOpen; window.gsBalconyWizardChanged = altCh;
      if (tmp) box.remove(); else box.innerHTML = '';
      return out;
    }, { oc: "x');window.__pwned=1;//", boese: BOESE }), r => (r.img ? 'ein <img> entstand' : !r.titel ? 'Titel fehlt' : r.got.indexOf("x');window.__pwned=1;//") < 0 || r.got.indexOf('kraeuter-sued') < 0 ? 'slug kam nicht unveraendert an: ' + JSON.stringify(r.got) : '')),
  },
];
