#!/usr/bin/env node
/**
 * save_check.js — kommt an, was gespeichert wird?
 *
 * Fernando: „Prüfe das Speichern und alles andere im Hintergrund."
 *
 * Die vier bestehenden Pruefstaende messen, wie die App AUSSIEHT, ob ein
 * Tipp ankommt, ob jemand ein Eingabefeld liest und ob die gelesenen Daten
 * existieren. Keiner von ihnen faehrt einen Speicherweg zu Ende. Genau dort
 * lagen aber die teuersten Fehler dieses Meilensteins:
 *
 *   v31.72  Gartenmasse wurden nie geschrieben (Leser da, Schreiber fehlte)
 *   v31.65  gsTwinSave meldete Erfolg, obwohl nichts geschrieben wurde
 *   v31.76  gsPPsavePlan ebenso — der Rettungsweg lag in totem Code
 *
 * Dieser Pruefstand faehrt jeden eingetragenen Weg WIRKLICH: Formular
 * fuellen → Speicherfunktion aufrufen → aus dem localStorage zurueklesen →
 * vergleichen. Was zurueckkommt, muss das sein, was hineingegangen ist.
 *
 * ZWEI DINGE, DIE MAN WISSEN MUSS:
 *
 * 1. `gsRequire('…')` sperrt mehrere Speicherwege ohne echte Anmeldung ab.
 *    Der Pseudo-Token aus _seed.js reicht nicht. Der Pruefstand ueberbrueckt
 *    die Sperre bewusst — sonst misst er eine Funktion, die gar nicht lief.
 *    (Genau das ist mir in v31.82 eine halbe Stunde lang passiert.)
 *
 * 2. Gemeldet wird nur, was hier EINGETRAGEN ist. Ein Speicherweg, der in
 *    der Liste fehlt, faellt nicht auf. Die Liste ist die Pruefung.
 *
 *   node scripts/save_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

// Jeder Eintrag: Name · was vorher gilt · was gespeichert wird · was danach
// im Speicher stehen MUSS. Die Funktionen laufen IM Browser.
const WEGE = [
  {
    name: 'Garten (Name, Masse, Art, Licht, Boden)',
    lauf: () => {
      const setz = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      window.editingGardenId = null;
      setz('gard-name', 'Prüfgarten'); setz('gard-loc', 'Testort');
      setz('gard-width', '4'); setz('gard-length', '7');
      setz('gard-kind', 'gewaechshaus'); setz('gard-light', 'full_sun'); setz('gard-soil', 'sand');
      saveGarden();
      const g = (JSON.parse(localStorage.getItem('gs_gardens') || '[]') || []).filter(x => x.name === 'Prüfgarten').pop();
      if (!g) return { ok: false, warum: 'kein Garten mit diesem Namen im Speicher' };
      const soll = { width: 4, length: 7, kind: 'gewaechshaus', light: 'full_sun', soil: 'sand', location: 'Testort' };
      const fehlt = Object.keys(soll).filter(k => String(g[k]) !== String(soll[k]));
      return fehlt.length ? { ok: false, warum: 'nicht gespeichert: ' + fehlt.map(k => k + ' (=' + g[k] + ', erwartet ' + soll[k] + ')').join(', ') } : { ok: true };
    },
  },
  {
    name: 'Pflanzung (Garten, Name, Sorte, Datum, Anzahl, Notiz)',
    lauf: () => {
      const g = (JSON.parse(localStorage.getItem('gs_gardens') || '[]') || [])[0];
      if (!g) return { ok: false, warum: 'kein Garten vorhanden' };
      const setz = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      const sel = document.getElementById('plant-garden-sel');
      if (sel) { sel.innerHTML = '<option value="' + g.id + '">x</option>'; sel.value = g.id; }
      setz('plant-name', 'Prüf-Tomate'); setz('plant-variety', 'Ochsenherz');
      setz('plant-date', '2026-05-20'); setz('plant-count', '7'); setz('plant-notes', 'Notiz-Text');
      savePlanting();
      const p = (JSON.parse(localStorage.getItem('gs_plantings') || '[]') || []).filter(x => x.name === 'Prüf-Tomate').pop();
      if (!p) return { ok: false, warum: 'keine Pflanzung mit diesem Namen im Speicher' };
      const soll = { variety: 'Ochsenherz', date: '2026-05-20', count: 7, notes: 'Notiz-Text', gardenId: g.id };
      const fehlt = Object.keys(soll).filter(k => String(p[k]) !== String(soll[k]));
      return fehlt.length ? { ok: false, warum: 'nicht gespeichert: ' + fehlt.join(', ') } : { ok: true };
    },
  },
  {
    name: 'Saatgut (Name, Menge, Ablaufdatum)',
    lauf: () => {
      const setz = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      if (typeof gsOpenSeedInventory === 'function') gsOpenSeedInventory();
      setz('gs-s-name', 'Prüf-Radieschen'); setz('gs-s-qty', '5 g'); setz('gs-s-exp', '2027-04-01');
      if (typeof gsSeedAdd !== 'function') return { ok: false, warum: 'gsSeedAdd fehlt' };
      gsSeedAdd();
      const s = (JSON.parse(localStorage.getItem('gs_seed_inventory') || '[]') || []).filter(x => x.name === 'Prüf-Radieschen').pop();
      if (!s) return { ok: false, warum: 'nicht im Speicher' };
      const fehlt = ['qty', 'expires'].filter(k => String(s[k]) !== String({ qty: '5 g', expires: '2027-04-01' }[k]));
      return fehlt.length ? { ok: false, warum: 'nicht gespeichert: ' + fehlt.join(', ') } : { ok: true };
    },
  },
  {
    name: 'Einstellung (savePref → gs_prefs)',
    lauf: () => {
      if (typeof savePref !== 'function') return { ok: false, warum: 'savePref fehlt' };
      savePref('pruefstandWert', 'abc123');
      const p = JSON.parse(localStorage.getItem('gs_prefs') || '{}') || {};
      return (p.pruefstandWert === 'abc123') ? { ok: true } : { ok: false, warum: 'gs_prefs enthaelt den Wert nicht' };
    },
  },
  {
    name: 'Garten-Zwilling (gsTwinSave → gs_garden_twin)',
    lauf: () => {
      if (typeof gsTwinSave !== 'function') return { ok: false, warum: 'gsTwinSave fehlt' };
      const t = { ts: Date.now(), bed: { width_m: 3, length_m: 4 },
                  plants: [{ name: 'Prüfpflanze', x_m: 1, y_m: 1, w_m: .5, h_m: .5 }], beds: [], zones: [] };
      const r = gsTwinSave(t);
      if (r === false) return { ok: false, warum: 'gsTwinSave meldet false' };
      const g = JSON.parse(localStorage.getItem('gs_garden_twin') || 'null');
      if (!g || !g.plants || !g.plants.length) return { ok: false, warum: 'nichts im Speicher' };
      return (g.plants[0].name === 'Prüfpflanze') ? { ok: true } : { ok: false, warum: 'Pflanzenname weg' };
    },
  },
  {
    name: 'Plan (gsPPsavePlan → gs_garden_plans)',
    lauf: async () => {
      if (typeof gsPPsavePlan !== 'function') return { ok: false, warum: 'gsPPsavePlan fehlt' };
      window.sbIsLoggedIn = function () { return false; };
      window._gsPP = window._gsPP || {};
      _gsPP.plan = { summary: 'Prüfplan-Zusammenfassung', bed: { width_m: 2, length_m: 2 }, plants: [{ name: 'Prüfart', count: 1 }] };
      _gsPP.data = { area: 4 };
      await gsPPsavePlan();
      const l = JSON.parse(localStorage.getItem('gs_garden_plans') || '[]') || [];
      const p = l.filter(x => x.plan && x.plan.summary === 'Prüfplan-Zusammenfassung').pop();
      return p ? { ok: true } : { ok: false, warum: 'Plan nicht im Speicher' };
    },
  },
  {
    name: 'Aufgaben-Fortschritt (_gsPPumgesetztSetz → gs_plan_umgesetzt)',
    lauf: () => {
      if (typeof _gsPPumgesetztSetz !== 'function') return { ok: false, warum: '_gsPPumgesetztSetz fehlt' };
      const r = _gsPPumgesetztSetz('plan_pruef', 2, true);
      if (r === false) return { ok: false, warum: 'meldet false' };
      const a = JSON.parse(localStorage.getItem('gs_plan_umgesetzt') || '{}') || {};
      return (a.plan_pruef && a.plan_pruef['2']) ? { ok: true } : { ok: false, warum: 'nicht im Speicher' };
    },
  },
];

// ── v31.95: Wege, die auf den SERVER schreiben ───────────────────────────
//
// Die Liste oben prueft den localStorage. Sie haette drei Funktionen nie
// gefunden, die genau deshalb kaputt waren: `gsSubmitExpertApplication`,
// `gsAdminSetExpertLevel` und `gsAdminBanUser` schrieben ordentlich — nur
// eben lokal — und meldeten dann „✅ eingereicht" / „✅ vergeben".
//
// Geprueft wird deshalb hier nicht der Speicher, sondern die AUSSAGE: was
// ruft die Funktion auf, und was meldet sie, wenn der Server NEIN sagt.
// `sbFetch` wird dafuer gestellt; ein Netz gibt es im Pruefstand nicht.
//
// Der wichtigste Fall ist der dritte je Weg: eine LEERE Antwort. PostgREST
// liefert bei einer von RLS abgewiesenen Zeile 0 Datensaetze und KEINEN
// Fehler — wer nur auf `error` prueft, meldet dann Erfolg fuer nichts.
const SERVER_WEGE = [
  {
    // v32.63: Regel eines gekoppelten Geraets auf den Server — 0 Zeilen sind keine Regel dort,
    // und die App sagt es (und meldet solange selbst).
    name: 'Regel hochladen (_gsRegelHochladen → device_rules)',
    lauf: async () => {
      const erg = { rufe: [], meldungen: [] };
      const echtToast = window.gsToast, echtGet = window.gsStore && gsStore.get, echtLogin = window.sbIsLoggedIn, echtFetch = window.sbFetch;
      window.gsToast = m => erg.meldungen.push(String(m));
      window.gsStore = window.gsStore || {}; gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet(k, d) : d));
      window.sbIsLoggedIn = () => true;
      if (typeof _gsRegelHochladen !== 'function') return { ok: false, warum: '_gsRegelHochladen fehlt' };
      const g = gsGeraetAnlegen({ kind: 'gs_sensor', name: 'Prüfstand Regel' });
      if (!g) return { ok: false, warum: 'Gerät nicht angelegt' };
      try {
        window.sbFetch = async (path, opts) => ({ data: [{ id: JSON.parse(opts.body).id }], error: null });
        const k = await gsGeraetKoppeln(g.id); if (!k.ok) return { ok: false, warum: 'Koppeln: ' + JSON.stringify(k) };
        _gsMwTokenFertig(g.id);
        window.sbFetch = async () => ({ data: [], error: null });
        const r = gsRegelAnlegen({ geraet_id: g.id, metric: 'soil_moisture', op: 'below', threshold: 30 });
        await new Promise(res => setTimeout(res, 40));
        // Fall 1: Server lehnt ab → nur in der App, gesagt
        erg.meldungen.length = 0;
        window.sbFetch = async (path) => { erg.rufe.push(path); return { data: null, error: { message: 'permission denied' } }; };
        let a = await _gsRegelHochladen(r);
        if (!erg.rufe.some(p => /device_rules$/.test(p))) return { ok: false, warum: 'ruft device_rules gar nicht auf' };
        if (a.ok || gsRegeln().find(x => x.id === r.id).cloud_ok !== false || !erg.meldungen.some(m => /nur in der App/.test(m))) return { ok: false, warum: 'Ablehnung: ' + JSON.stringify({ a, meldungen: erg.meldungen }) };
        // Fall 2: Server antwortet LEER (RLS still) → ebenso
        erg.meldungen.length = 0;
        window.sbFetch = async () => ({ data: [], error: null });
        a = await _gsRegelHochladen(r);
        if (a.ok || gsRegeln().find(x => x.id === r.id).cloud_ok !== false || !erg.meldungen.some(m => /nur in der App/.test(m))) return { ok: false, warum: '0 Zeilen gelten als Regel auf dem Server: ' + JSON.stringify(a) };
        // Fall 3: Server bestaetigt → cloud_ok, still
        erg.meldungen.length = 0;
        window.sbFetch = async (path, opts) => ({ data: [{ id: JSON.parse(opts.body).id }], error: null });
        a = await _gsRegelHochladen(r);
        if (!a.ok || gsRegeln().find(x => x.id === r.id).cloud_ok !== true || erg.meldungen.length) return { ok: false, warum: 'Bestätigung: ' + JSON.stringify({ a, meldungen: erg.meldungen }) };
        return { ok: true, info: 'Ablehnung → nur in der App, gesagt · 0 Zeilen → ebenso · Bestätigung → cloud_ok, still' };
      } finally { gsGeraetLoeschen(g.id); window.gsToast = echtToast; if (echtGet) gsStore.get = echtGet; window.sbIsLoggedIn = echtLogin; window.sbFetch = echtFetch; }
    },
  },
  {
    // v32.62: Koppeln — der Server legt die Geraetezeile an (upsert). 0 Zeilen
    // (RLS still) sind keine Kopplung; das Token darf nie in den Speicher.
    name: 'Gerät koppeln (gsGeraetKoppeln → devices)',
    lauf: async () => {
      const erg = { rufe: [], meldungen: [] };
      const echtToast = window.gsToast, echtGet = window.gsStore && gsStore.get, echtLogin = window.sbIsLoggedIn, echtFetch = window.sbFetch;
      window.gsToast = m => erg.meldungen.push(String(m));
      window.gsStore = window.gsStore || {}; gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : (echtGet ? echtGet(k, d) : d));
      window.sbIsLoggedIn = () => true;
      if (typeof gsGeraetKoppeln !== 'function') return { ok: false, warum: 'gsGeraetKoppeln fehlt' };
      const g = gsGeraetAnlegen({ kind: 'gs_sensor', name: 'Prüfstand Sensor' });
      if (!g) return { ok: false, warum: 'Gerät nicht angelegt' };
      try {
        // Fall 1: Server lehnt ab → nicht gekoppelt, gesagt
        window.sbFetch = async (path) => { erg.rufe.push(path); return { data: null, error: { message: 'permission denied' } }; };
        let r = await gsGeraetKoppeln(g.id);
        if (!erg.rufe.some(p => /\/devices$/.test(p))) return { ok: false, warum: 'ruft devices gar nicht auf' };
        if (r.ok || gsGeraete().find(x => x.id === g.id).cloud_id) return { ok: false, warum: 'Ablehnung gilt als Kopplung' };
        if (!erg.meldungen.some(m => /Nicht gekoppelt/.test(m))) return { ok: false, warum: 'Ablehnung ohne Wort: ' + JSON.stringify(erg.meldungen) };
        // Fall 2: Server antwortet LEER (RLS still) → ebenso
        erg.meldungen.length = 0;
        window.sbFetch = async () => ({ data: [], error: null });
        r = await gsGeraetKoppeln(g.id);
        if (r.ok || gsGeraete().find(x => x.id === g.id).cloud_id || !erg.meldungen.some(m => /Nicht gekoppelt/.test(m))) return { ok: false, warum: '0 Zeilen gelten als Kopplung: ' + JSON.stringify(r) };
        // Fall 3: Server bestaetigt → gekoppelt, Token in der Antwort, nicht im Speicher
        erg.meldungen.length = 0;
        window.sbFetch = async (path, opts) => ({ data: [{ id: JSON.parse(opts.body).id }], error: null });
        r = await gsGeraetKoppeln(g.id);
        const gl = gsGeraete().find(x => x.id === g.id);
        if (!r.ok || !r.token || !gl.cloud_id) return { ok: false, warum: 'Bestätigung: ' + JSON.stringify(r) };
        if (erg.meldungen.some(m => /Nicht gekoppelt/.test(m))) return { ok: false, warum: 'Absage trotz Bestätigung' };
        if (JSON.stringify(localStorage).indexOf(r.token) >= 0) return { ok: false, warum: 'das Token liegt im Speicher' };
        return { ok: true, info: 'Ablehnung → nicht gekoppelt, gesagt · 0 Zeilen → nicht gekoppelt · Bestätigung → gekoppelt, Token nur in der Antwort' };
      } finally { gsGeraetLoeschen(g.id); window.gsToast = echtToast; if (echtGet) gsStore.get = echtGet; window.sbIsLoggedIn = echtLogin; window.sbFetch = echtFetch; }
    },
  },
  {
    // v32.27: Der teuerste Fund dieser Ecke. Die Korrektur ging fire-and-forget
    // hinaus, danach kam BEDINGUNGSLOS „🙏 Danke für die Korrektur!". Wurde sie
    // abgewiesen, lag sie in einer Liste, die niemand sendet — und die
    // Offline-Warteschlange versprach „wird beim nächsten Login synchronisiert",
    // obwohl es keinen Flush gab und ihre Sätze eine Spalte trugen, die es in
    // `scan_corrections` nicht gibt.
    name: 'Arten-Korrektur (gsSubmitScanMistake → scan_corrections)',
    lauf: async () => {
      const erg = { rufe: [], meldungen: [] };
      window.showProfileToast = m => erg.meldungen.push(typeof m === 'string' ? m : (m && ((m.title || '') + ' ' + (m.body || ''))));
      window.closeModal = () => {};
      window.gsStore = window.gsStore || {};
      gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : d);
      window.sbIsLoggedIn = () => true;
      if (typeof gsSubmitScanMistake !== 'function') return { ok: false, warum: 'gsSubmitScanMistake fehlt' };

      // Das Formular stellen, das die Funktion liest.
      window._lastScanResult = { name: 'Bärlauch', latin: 'Allium ursinum', confidence: 71, _ctx: { q: 1 } };
      const feld = (id, v) => {
        let e = document.getElementById(id);
        if (!e) { e = document.createElement('input'); e.id = id; document.body.appendChild(e); }
        e.value = v;
      };
      const fuellen = () => { feld('scan-fix-name', 'Maiglöckchen'); feld('scan-fix-latin', 'Convallaria majalis'); feld('scan-fix-note', 'Blatt riecht nicht nach Lauch'); };

      // Fall 1: Server lehnt ab → KEIN Dank, und der Satz wartet.
      localStorage.removeItem('gs_scan_corrections_queue');
      erg.meldungen.length = 0;
      window.sbFetch = async (path) => { erg.rufe.push(path); return { data: null, error: { message: 'permission denied' } }; };
      fuellen(); await gsSubmitScanMistake();
      if (!erg.rufe.some(p => /scan_corrections/.test(p))) return { ok: false, warum: 'ruft scan_corrections gar nicht auf' };
      if (erg.meldungen.some(m => /Danke für die Korrektur/i.test(m || ''))) return { ok: false, warum: 'dankt, obwohl der Server ablehnt' };
      let q = JSON.parse(localStorage.getItem('gs_scan_corrections_queue') || '[]');
      if (q.length !== 1) return { ok: false, warum: 'die abgelehnte Korrektur wartet nirgends (' + q.length + ')' };
      if (!('user_name' in q[0]) || 'correct_name' in q[0]) return { ok: false, warum: 'die Warteschlange trägt Spalten, die es in scan_corrections nicht gibt' };

      // Fall 2: LEERE Antwort ohne Fehler (der RLS-Fall) → ebenfalls kein Dank.
      erg.meldungen.length = 0;
      window.sbFetch = async () => ({ data: [], error: null });
      fuellen(); await gsSubmitScanMistake();
      if (erg.meldungen.some(m => /Danke für die Korrektur/i.test(m || ''))) return { ok: false, warum: 'wertet eine LEERE Antwort als Erfolg' };

      // Fall 3: echte Antwort → Dank, und nichts Neues in der Warteschlange.
      erg.meldungen.length = 0;
      const vorher = JSON.parse(localStorage.getItem('gs_scan_corrections_queue') || '[]').length;
      window.sbFetch = async () => ({ data: [{ id: 'sc-1' }], error: null });
      fuellen(); await gsSubmitScanMistake();
      if (!erg.meldungen.some(m => /Danke für die Korrektur/i.test(m || ''))) return { ok: false, warum: 'meldet den Erfolg nicht' };
      if (JSON.parse(localStorage.getItem('gs_scan_corrections_queue') || '[]').length !== vorher) return { ok: false, warum: 'reiht auch bei Erfolg ein' };

      // Fall 4: der Flush, den es nie gab. Was ankommt, verschwindet; was
      // abgelehnt wird, BLEIBT — sonst wäre die Korrektur endgültig weg.
      if (typeof gsFlushKorrekturen !== 'function') return { ok: false, warum: 'gsFlushKorrekturen fehlt — die Warteschlange wird nie gesendet' };
      window.sbFetch = async () => ({ data: null, error: { message: 'nein' } });
      const offen = JSON.parse(localStorage.getItem('gs_scan_corrections_queue') || '[]').length;
      await gsFlushKorrekturen();
      if (JSON.parse(localStorage.getItem('gs_scan_corrections_queue') || '[]').length !== offen) return { ok: false, warum: 'der Flush verwirft, was der Server ablehnt' };
      window.sbFetch = async () => ({ data: [{ id: 'sc-2' }], error: null });
      const raus = await gsFlushKorrekturen();
      if (raus !== offen) return { ok: false, warum: 'der Flush übermittelt nicht alles (' + raus + ' von ' + offen + ')' };
      if (JSON.parse(localStorage.getItem('gs_scan_corrections_queue') || '[]').length !== 0) return { ok: false, warum: 'der Flush räumt das Übermittelte nicht weg' };
      return { ok: true, info: 'Ablehnung, leere Antwort, Erfolg und Flush jeweils richtig' };
    },
  },
  {
    name: 'Experten-Antrag (gsSubmitExpertApplication → feedback_items)',
    lauf: async () => {
      const setz = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      const erg = { rufe: [], meldungen: [] };
      window.showProfileToast = m => erg.meldungen.push(typeof m === 'string' ? m : (m && (m.title + ' ' + (m.body || ''))));
      window.closeModal = () => {};
      window.gsStore = window.gsStore || {};
      gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : d);
      if (typeof gsOpenExpertApplication !== 'function') return { ok: false, warum: 'Formular-Funktion fehlt' };
      window._sbProfile = { id: 'x' };
      gsOpenExpertApplication();
      setz('exp-bio', 'Botaniker seit fünfzehn Jahren, Schwerpunkt Alpenflora und Pilzkunde.');
      setz('exp-dips', 'Dipl. Biologe Uni Zürich 2010');

      // Fall 1: der Server lehnt ab → KEIN Erfolg, KEIN lokaler Beleg.
      localStorage.removeItem('gs_expert_application');
      window.sbFetch = async (path, opts) => { erg.rufe.push(path); return { data: null, error: { message: 'permission denied' } }; };
      await gsSubmitExpertApplication();
      if (!erg.rufe.some(p => /feedback_items/.test(p))) return { ok: false, warum: 'ruft feedback_items gar nicht auf' };
      if (erg.meldungen.some(m => /übermittelt$|✅ Antrag übermittelt/.test(m || ''))) return { ok: false, warum: 'meldet Erfolg, obwohl der Server ablehnt' };
      if (localStorage.getItem('gs_expert_application')) return { ok: false, warum: 'legt einen Beleg an, obwohl nichts übermittelt wurde' };

      // Fall 2: leere Antwort ohne Fehler → ebenfalls KEIN Erfolg.
      erg.meldungen.length = 0;
      window.sbFetch = async () => ({ data: [], error: null });
      await gsSubmitExpertApplication();
      if (localStorage.getItem('gs_expert_application')) return { ok: false, warum: 'wertet eine LEERE Antwort als Erfolg' };

      // Fall 3: echte Antwort → Beleg und Erfolgsmeldung.
      erg.meldungen.length = 0;
      window.sbFetch = async () => ({ data: [{ id: 'fb-1' }], error: null });
      await gsSubmitExpertApplication();
      const beleg = JSON.parse(localStorage.getItem('gs_expert_application') || 'null');
      if (!beleg || beleg.status !== 'submitted') return { ok: false, warum: 'kein Beleg nach erfolgreicher Übermittlung' };
      if (!erg.meldungen.some(m => /übermittelt/i.test(m || ''))) return { ok: false, warum: 'meldet den Erfolg nicht' };
      return { ok: true, info: 'Ablehnung, leere Antwort und Erfolg jeweils richtig' };
    },
  },
  {
    name: 'Rolle vergeben (gsAdminSetExpertLevel → RPC fn_assign_role)',
    lauf: async () => {
      const erg = { rufe: [], meldungen: [] };
      window.showProfileToast = m => erg.meldungen.push(typeof m === 'string' ? m : (m && (m.title + ' ' + (m.body || ''))));
      window.closeModal = () => {};
      window.gsConfirmModal = async () => true;
      window.gsIsAdmin = () => true;
      window.gsStore = window.gsStore || {};
      gsStore.get = (k, d) => (k === 'gs_sb_token' ? 'tok' : (k === 'gs_sb_uid' ? 'admin-uid' : (k === 'gs_admin_log' ? null : d)));
      gsStore.set = () => {};
      const sel = document.createElement('select'); sel.id = 'admin-expert-select';
      sel.innerHTML = '<option value="expert">x</option>'; sel.value = 'expert';
      const ta = document.createElement('textarea'); ta.id = 'admin-expert-reason'; ta.value = 'Dipl. Botanikerin';
      document.body.appendChild(sel); document.body.appendChild(ta);

      // Fall 1: die RPC lehnt ab (so meldet sie „Only admins can assign roles").
      window.sbFetch = async (path, opts) => {
        erg.rufe.push((opts && opts.method || 'GET') + ' ' + path);
        if (/rpc\/fn_assign_role/.test(path)) return { data: null, error: { message: 'Only admins can assign roles' } };
        return { data: [{ id: 'u1', role: 'user' }], error: null };
      };
      await gsAdminSetExpertLevel('a@b.ch');
      if (!erg.rufe.some(r => /rpc\/fn_assign_role/.test(r)))
        return { ok: false, warum: 'geht nicht über fn_assign_role — ein direkter PATCH umgeht Audit-Log, Benachrichtigung und die Letzter-Admin-Sperre' };
      if (erg.meldungen.some(m => /^✅/.test(m || ''))) return { ok: false, warum: 'meldet Erfolg, obwohl die RPC ablehnt' };

      // Fall 2: die RPC bestaetigt.
      erg.meldungen.length = 0; erg.rufe.length = 0;
      window.sbFetch = async (path, opts) => {
        erg.rufe.push((opts && opts.method || 'GET') + ' ' + path);
        if (/rpc\/fn_assign_role/.test(path)) {
          const b = JSON.parse(opts.body || '{}');
          if (b._user_id !== 'u1') return { data: null, error: { message: 'falsche id: ' + b._user_id } };
          if (b._role !== 'expert') return { data: null, error: { message: 'falsche Rolle: ' + b._role } };
          return { data: { ok: true, new_role: 'expert' }, error: null };
        }
        return { data: [{ id: 'u1', role: 'user' }], error: null };
      };
      await gsAdminSetExpertLevel('a@b.ch');
      if (!erg.meldungen.some(m => /^✅/.test(m || ''))) return { ok: false, warum: 'meldet keinen Erfolg: ' + erg.meldungen.join(' | ') };
      sel.remove(); ta.remove();
      return { ok: true, info: 'Ablehnung gemeldet, Erfolg über die RPC' };
    },
  },
  {
    name: 'Arten-Korrektur (gsKorrekturSenden → feedback_items)',
    lauf: async () => {
      const erg = { rufe: [], meldungen: [] };
      window.showProfileToast = m => erg.meldungen.push(typeof m === 'string' ? m : (m && (m.title + ' ' + (m.body || ''))));
      window.closeModal = () => {};
      window.gsStore = window.gsStore || {};
      gsStore.get = (k, d) => (k === 'gs_sb_uid' ? '00000000-0000-0000-0000-000000000001' : d);
      const art = (window.DB || []).filter(x => x && x.lat === 'Allium ursinum')[0];
      if (!art) return { ok: false, warum: 'Testart nicht in der Artenliste' };

      if (typeof gsKorrekturOeffnen !== 'function') return { ok: false, warum: 'gsKorrekturOeffnen fehlt' };
      gsKorrekturOeffnen(art.id);
      const feld = document.getElementById('korr-feld');
      const txt = document.getElementById('korr-text');
      const q = document.getElementById('korr-quelle');
      if (!feld || !txt || !q) return { ok: false, warum: 'das Formular hat sich nicht aufgebaut' };

      // Zu kurzer Text → gar kein Serveraufruf.
      txt.value = 'zu kurz';
      window.sbFetch = async p => { erg.rufe.push(p); return { data: [{ id: 'x' }], error: null }; };
      await gsKorrekturSenden(art.id);
      if (erg.rufe.length) return { ok: false, warum: 'schickt einen 7-Zeichen-Text an den Server' };

      txt.value = 'Die Blütezeit ist Mai bis Juli, nicht April bis Juni.';
      feld.value = 'saison';
      q.value = 'nicht-mal-eine-adresse';
      await gsKorrekturSenden(art.id);
      if (erg.rufe.length) return { ok: false, warum: 'nimmt eine Quelle an, die keine Adresse ist' };

      q.value = 'https://www.infoflora.ch/de/flora/allium-ursinum.html';
      // Fall 1: leere Antwort ohne Fehler → KEIN Erfolg.
      erg.meldungen.length = 0;
      window.sbFetch = async p => { erg.rufe.push(p); return { data: [], error: null }; };
      await gsKorrekturSenden(art.id);
      if (!erg.rufe.some(p => /feedback_items/.test(p))) return { ok: false, warum: 'ruft feedback_items nicht auf' };
      if (erg.meldungen.some(m => /^✅|Danke/.test(m || ''))) return { ok: false, warum: 'wertet eine LEERE Antwort als Erfolg' };

      // Fall 2: echte Antwort → Erfolg, und der context trägt Art + Beleg.
      erg.meldungen.length = 0;
      let gesendet = null;
      window.sbFetch = async (p, o) => { gesendet = JSON.parse(o.body || '{}'); return { data: [{ id: 'fb-9' }], error: null }; };
      await gsKorrekturSenden(art.id);
      if (!erg.meldungen.some(m => /Danke/.test(m || ''))) return { ok: false, warum: 'meldet keinen Erfolg: ' + erg.meldungen.join(' | ') };
      if (!gesendet || gesendet.kind !== 'species_correction') return { ok: false, warum: 'falsche Art: ' + (gesendet && gesendet.kind) };
      const c = gesendet.context || {};
      if (c.species_id !== art.id) return { ok: false, warum: 'die Art fehlt im context' };
      if (c.feld !== 'saison') return { ok: false, warum: 'der Bereich fehlt: ' + c.feld };
      if (!/infoflora/.test(c.quelle || '')) return { ok: false, warum: 'der Beleg fehlt' };
      return { ok: true, info: 'kurz→still, krumme Quelle→still, leer→kein Erfolg, echt→' + c.species_name + '/' + c.feld };
    },
  },
  {
    name: 'Arten-Korrektur ist in der Feedback-Liste erkennbar',
    lauf: () => {
      const fb = {
        id: 'f1', type: 'species_correction', title: 'x', body: 'Blütezeit stimmt nicht',
        context: { species_name: 'Bärlauch', species_lat: 'Allium ursinum', feld: 'saison',
                   quelle: 'https://www.infoflora.ch/x', ungeprueft: true },
        votes: { up: 0, down: 0 }, date: '2026-09-02', ts: Date.now(), ki_status: 'pending',
      };
      // `feedbackItems` ist mit `let` deklariert und liegt damit NICHT auf
      // `window` — ein `window.feedbackItems = …` erreicht die Funktion nicht.
      // Blosse Zuweisung greift auf die äussere Bindung durch.
      feedbackItems = [fb];
      const el = document.getElementById('feedback-list');
      if (!el) return { ok: false, warum: 'keine Feedback-Liste im Dokument' };
      window._gsFbFilterType = 'all';
      renderFeedback();
      const t = el.textContent || '';
      if (!/Arten-Korrektur/.test(t)) return { ok: false, warum: 'wird nicht als Arten-Korrektur bezeichnet' };
      if (!/Bärlauch/.test(t)) return { ok: false, warum: 'die Art steht nicht da — die Meldung wäre wertlos' };
      if (!/infoflora/.test(t)) return { ok: false, warum: 'der Beleg steht nicht da' };
      if (!/ungeprüft/.test(t)) return { ok: false, warum: 'dass der Eintrag ungeprüft ist, steht nicht da' };
      return { ok: true, info: 'Art, Bereich, Beleg und Ungeprüft-Hinweis sichtbar' };
    },
  },
  {
    name: 'Keine KI-Bewertung für Korrekturen und Bewerbungen',
    lauf: async () => {
      if (typeof _gsFeedbackTriageOne !== 'function') return { ok: false, warum: 'Triage-Funktion fehlt' };
      let gefragt = 0;
      window.callAI = async () => { gefragt++; return '{"status":"rejected","priority":1,"effort":"low","category":"andere","rationale":"x","action":""}'; };
      const mach = t => _gsFeedbackTriageOne({ type: t, title: 'x', body: 'Die Blütezeit ist Mai bis Juli, nicht April bis Juni.' });

      const korr = await mach('species_correction');
      if (korr) return { ok: false, warum: 'bewertet eine Arten-Korrektur wie einen Produkt-Vorschlag' };
      const bew = await mach('expert_application');
      if (bew) return { ok: false, warum: 'bewertet eine Bewerbung wie einen Produkt-Vorschlag' };
      if (gefragt) return { ok: false, warum: 'fragt die KI trotzdem (' + gefragt + '×) — kostet Kontingent für nichts' };

      // Gegenprobe: eine echte Idee wird weiterhin bewertet.
      const idee = await mach('idea');
      if (!idee) return { ok: false, warum: 'bewertet auch eine normale Idee nicht mehr' };
      if (gefragt !== 1) return { ok: false, warum: 'die KI wurde ' + gefragt + '× gefragt statt einmal' };
      return { ok: true, info: 'Korrektur und Bewerbung übersprungen, Idee bewertet' };
    },
  },
  {
    name: 'Experten-Haken liest die Rolle, nicht die tote Spalte',
    lauf: async () => {
      if (typeof gsIsVerifiedExpert !== 'function') return { ok: false, warum: 'Funktion fehlt' };
      window.gsIsAdmin = () => false;
      if (gsIsVerifiedExpert({ role: 'user' })) return { ok: false, warum: 'gibt jedem Nutzer den grünen Haken' };
      if (!gsIsVerifiedExpert({ role: 'expert' })) return { ok: false, warum: 'ein Experte bekommt keinen Haken — genau der Fehler bis v31.94' };
      if (!gsIsVerifiedExpert({ role: 'admin' })) return { ok: false, warum: 'ein Admin bekommt keinen Haken' };
      const info = gsGetExpertInfo({ role: 'expert' });
      if (!info || !/Experte/.test(info.label || '')) return { ok: false, warum: 'falsche Bezeichnung: ' + (info && info.label) };
      return { ok: true, info: 'user=nein, expert=ja (' + info.label + '), admin=ja' };
    },
  },
];

(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 412, height: 915 } });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
  await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await p.addInitScript(SEED);
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await p.waitForTimeout(4000);
  await p.evaluate(() => {
    document.documentElement.classList.remove('gs-preauth');
    const o = document.getElementById('gs-onboarding');
    if (o) o.style.setProperty('display', 'none', 'important');
    // Die Anmelde-Sperre bewusst ueberbruecken — siehe Kopfkommentar.
    window.gsRequire = function () { return true; };
    // Toasts still stellen, sie stoeren die Messung nicht, aber die Ausgabe.
    window.gsToast = function () {}; window.showProfileToast = function () {};
  });

  console.log('\n=== save_check — kommt an, was gespeichert wird?');
  let kaputt = 0;
  for (const w of WEGE) {
    let r;
    try {
      r = await p.evaluate(new Function('return (' + w.lauf.toString() + ')()'));
    } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + w.name);
    else { kaputt++; console.log('  !!   ' + w.name + '  →  ' + ((r && r.warum) || 'unbekannt')); }
  }
  console.log('  --- Server-Wege (gestelltes sbFetch, geprueft wird die AUSSAGE)');
  for (const w of SERVER_WEGE) {
    let r;
    try {
      r = await p.evaluate(new Function('return (' + w.lauf.toString() + ')()'));
    } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + e.message.split('\n')[0] }; }
    if (r && r.ok) console.log('  ok   ' + w.name + (r.info ? '   [' + r.info + ']' : ''));
    else { kaputt++; console.log('  !!   ' + w.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
  }

  console.log('  ---');
  console.log('  Speicherwege geprueft: ' + (WEGE.length + SERVER_WEGE.length) + ' · davon kaputt: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (errs.length ? errs.length + ' (' + errs.slice(0, 2).join(' | ') + ')' : 'keine'));
  await br.close();
  process.exitCode = kaputt ? 1 : 0;
})();
