#!/usr/bin/env node
/**
 * sync_check.js — kommt zurück, was hochgeladen wird?
 *
 * Die App schiebt drei Blobs in die Cloud: `user_plants`, `user_gardens`,
 * `user_app_state`. Sie werden aus 47 localStorage-Schlüsseln gebaut. Der
 * Rückweg ist eine ANDERE Liste, von Hand gepflegt — und ob beide
 * deckungsgleich sind, hat nie jemand nachgezählt.
 *
 * Erster Lauf (v32.23): 46 von 47 Feldern kamen zurück. `gs_reminder_prefs`
 * nicht — es stand seit v24.26 im Blob und in keiner Zeile des Rückwegs. Der
 * Server-Cron liest `reminder_prefs.disabled[plantId]`, die Abschaltung war
 * also serverseitig wirksam und gerätelokal. Gerät B kannte sie nicht, schickte
 * sein leeres `{}` hoch — und die abgeschalteten Erinnerungen gingen dem Nutzer
 * wieder an. Er hatte sie ausgeschaltet; sie kamen zurück.
 *
 * WIE ER ARBEITET: er stellt `sbFetch`. Ein Push landet in einer Attrappe der
 * Cloud, ein Pull holt ihn von dort. Dazwischen wird der localStorage geleert.
 * Was danach fehlt, hat die Rundreise nicht überlebt.
 *
 * ZWEI DINGE, DIE MAN WISSEN MUSS:
 *
 * 1. `flushNow()` ist NICHT der Weg. Das ist der Beacon-Pfad (`sync = true`)
 *    und geht mit rohem `fetch` an `sbFetch` vorbei — die Attrappe sieht
 *    nichts, und der Prüfstand meldet fröhlich „0 Tabellen gepusht". Der
 *    echte Weg im Betrieb ist `markDirty(scope)` → `flushDebounced`.
 *
 * 2. Die Probewerte müssen ECHT aussehen. Mit `gs_streak = '{"n":7}'` meldete
 *    der erste Lauf vier Fehler, die keine waren: `_gsStreakApplyCloud` macht
 *    `parseInt` daraus, bekommt NaN und steigt aus — richtigerweise. Mit einem
 *    Tag von vorgestern setzt die Lückenprüfung den Streak zurück — ebenfalls
 *    richtig. **Falsche Beispieldaten erfinden Befunde**, genau wie sie in
 *    v31.98 welche verdeckt haben.
 *
 * GRENZE: geprüft wird der Weg localStorage → Blob → localStorage. Ob die
 * Cloud den Blob wirklich annimmt (RLS, Spaltentypen), sagt nur ein echter
 * Server. Dafür ist `save_check` mit seinen SERVER_WEGEN zuständig.
 *
 *   node scripts/sync_check.js
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const WURZEL = path.join(__dirname, '..');
const QUELLE = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');

// ── Welche Schlüssel liest jeder der drei Blob-Bauer? ────────────────────
// Aus dem QUELLTEXT gelesen, nicht hier gepflegt: wer dem Blob ein Feld
// hinzufügt, ist damit automatisch geprüft — und muss unten einen Probewert
// eintragen, sonst meldet Frage 5 ihn als ungeprüft.
function blobKeys(fn) {
  const i = QUELLE.indexOf('function ' + fn + '(');
  if (i < 0) return [];
  const j = QUELLE.indexOf('\n  }\n', i);
  const body = QUELLE.slice(i, j < 0 ? i + 4000 : j);
  return Array.from(new Set(
    [...body.matchAll(/(?:getItem|gsStore\.get)\(\s*['"]([A-Za-z0-9_.:-]+)['"]/g)].map(m => m[1])
  ));
}
const BLOB_KEYS = Array.from(new Set(
  ['_buildPlantsBlob', '_buildGardenBlob', '_buildStateBlob'].flatMap(blobKeys)
));

// Probewerte. `__HEUTE__` wird im Browser durch den Tagesschlüssel der App
// ersetzt; `__NUR_DA__` heisst: der Wert wird beim Zurückschreiben neu
// berechnet (Signaturen), geprüft wird nur, dass er wieder da ist.
const PROBEN = {
  'ps_myplants': '[{"id":"p1","name":"Tomate"}]',
  'gs_gartentagebuch': '[{"id":"d1","text":"Notiz"}]',
  'gs_kal_filter': '{"aus":["messung"],"garten":null}',
  'gs_dead_plants': '[{"id":"t1"}]',
  'gs_seed_inventory': '[{"id":"s1"}]',
  'gs_garden_plans': '[{"id":"pl1"}]',
  'gs_garden_plan_current': '{"id":"pl1"}',
  'gs_gardens': '[{"id":"g1","name":"Hof"}]',
  'gs_geloescht': '{"ps_myplants":{"mp_alt":9999999999999}}',   // v33.65: Loeschmarken reisen im state-Blob (Zeit in der Zukunft: das 90-Tage-Fenster raeumt sie nicht weg)
  // v33.59: die Pflanzung in ihrer HEUTIGEN Form — mit `tasks`. Seit der Pull
  // auch den Arbeitsspeicher auffrischt, ruestet `_gsPflanzungenNachruesten`
  // eine Pflanzung OHNE Aufgaben beim ersten Lesen nach (v32.47) und speichert
  // sie; der Probewert kaeme dann zu Recht veraendert zurueck. Dasselbe geschah
  // vorher beim naechsten Start — nur sah es dieser Pruefstand nicht.
  'gs_plantings': '[{"id":"pf1","tasks":{}}]',
  'gs_gpx_tracks': '[{"id":"tr1"}]',
  'gs_doctor_history': '[{"q":"blatt"}]',
  'gs_ki_analyses': '[{"a":1}]',
  'gs_dq_archive': '[{"d":"2026-01-01"}]',
  'gs_dq_stats': '{"n":5}',
  // v33.28: der Lernstand der Lernkarten. Eine ECHTE Karte, damit der
  // Rueckweg nicht bloss ein leeres Objekt durchreicht — genau das war der
  // Fund beim Bau: der Hinweg (_gsBuildStateBlob) kannte das Feld nicht.
  'gs_dq_training': '{"v":1,"karten":{"urtica dioica|2":{"b":3,"faellig":"2099-01-01","r":2,"f":1}},"tag":"2026-09-12","heute":1,"xpHeute":2}',
  'gs_quiz_streak': '{"n":3}',
  'gs_recipe_favs': '["r1"]',
  'gs_recent_searches': '["baerlauch"]',
  'gs_wissen_read': '{"k1":true}',
  'ps_favs': '["f1"]',
  'ps_votes': '{"v1":1}',
  'gs_confirmed_species': '["cs1"]',
  'gs_achievements': '["a1"]',
  'gs_reminder_prefs': '{"disabled":{"p1":true}}',
  'gs_sae_merkliste': '["m1"]',
  // Streak: Zahl und HEUTIGER Tag — sonst greift die Lückenprüfung, zu Recht.
  'gs_streak': '7',
  'gs_last_active_day_iso': '__HEUTE__',
  'gs_streak_sig': '__NUR_DA__',
  'gs_streak_stamp': '__NUR_DA__',
  'gs_login_streak': '9',
  'gs_last_login': '__HEUTE__',
  'gs_bl_month': '5', 'gs_bl_tab': 'bienen', 'gs_bl_bee': '1',
  'gs_tb_filter': 'alles', 'gs_tb_search': 'tomate', 'gs_tb_cat_selected': 'gemuese',
  'gs_ernte_unit': 'kg', 'gs_ernte_view': 'liste', 'gs_ernte_year': '2026',
  'gs_region': 'ZH', 'gs_push_settings': '{"tipps":true}',
  'gs_user_location': '{"lat":47.1,"lon":8.1}',
  'gs_sae_search': 'karotte', 'gs_sae_cat': 'wurzel',
  'gs_dark': '1', 'gs_theme_color': '#2e7d32', 'gs_lang': 'fr',
};

let kaputt = 0;
const melde = (frage, ok, wie) => {
  if (!ok) kaputt++;
  console.log('  ' + (ok ? 'ok  ' : '!!  ') + ' ' + frage + (ok ? '   [' + wie + ']' : ''));
  if (!ok) console.log('         → ' + wie);
};

(async () => {
  console.log('=== sync_check — kommt zurück, was hochgeladen wird?');
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 412, height: 915 } })).newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message.split('\n')[0]));
  await page.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await page.addInitScript(SEED);
  await page.goto('file://' + path.join(WURZEL, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  const r = await page.evaluate(async (arg) => {
    localStorage.setItem('gs_sb_uid', 'nutzer-A');
    window.gsRequire = () => true;
    window.sbIsLoggedIn = () => true;
    const HEUTE = (typeof _gsDayKey === 'function') ? _gsDayKey() : new Date().toISOString().slice(0, 10);
    const P = {};
    Object.keys(arg.proben).forEach(k => { P[k] = arg.proben[k] === '__HEUTE__' ? HEUTE : arg.proben[k]; });

    // ── Cloud-Attrappe ───────────────────────────────────────────────────
    const cloud = {};
    let fehlerAntwort = false;
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {};
      const m = (opts.method || 'GET').toUpperCase();
      const tab = (pfad.match(TAB) || [])[1];
      if (tab && (m === 'POST' || m === 'PATCH')) {
        if (fehlerAntwort) return { data: null, error: { message: 'abgelehnt', status: 401 }, status: 401 };
        try { cloud[tab] = JSON.parse(opts.body).data; } catch (_) {}
        return { data: [{}], error: null, status: 200 };
      }
      if (tab && m === 'GET') {
        return cloud[tab]
          ? { data: [{ data: cloud[tab], updated_at: new Date().toISOString() }], error: null, status: 200 }
          : { data: [], error: null, status: 200 };
      }
      return { data: [], error: null, status: 200 };
    };

    const setzen = () => Object.keys(P).forEach(k => localStorage.setItem(k, P[k]));
    const leeren = () => {
      Object.keys(P).forEach(k => localStorage.removeItem(k));
      ['gs_sync_dirty', 'gs_sync_queue'].forEach(k => localStorage.removeItem(k));
      ['plants', 'garden', 'state'].forEach(sc => {
        localStorage.removeItem('gs_sync_dirty_at_' + sc);
        localStorage.removeItem('gs_sync_synced_at_' + sc);
      });
    };
    const schieben = async () => {
      window._gsInitialSyncDone = true;      // sonst haelt der Boot-Race-Guard
      ['plants', 'garden', 'state'].forEach(sc => gsCloudSync.markDirty(sc));
      await new Promise(r2 => setTimeout(r2, 1500));   // flushDebounced: 500 ms
    };
    const holen = async () => {
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await new Promise(r2 => setTimeout(r2, 800));
    };

    // ── 1 · Die Rundreise ────────────────────────────────────────────────
    setzen();
    await schieben();
    const tabellen = Object.keys(cloud);
    leeren();
    await holen();
    const fehlt = [], anders = [];
    Object.keys(P).forEach(k => {
      const v = localStorage.getItem(k);
      if (v == null) fehlt.push(k);
      else if (P[k] !== '__NUR_DA__' && v !== P[k]) anders.push(k + ' (=' + String(v).slice(0, 30) + ')');
    });

    // ── 2 · Gegenprobe: ein Feld, das der Rückweg nicht kennt ────────────
    // Ein Feld im Blob UMBENENNEN. Der Pull findet es nicht mehr, der
    // Schlüssel darf also nicht zurückkommen — und der Prüfstand MUSS das
    // melden. Ohne diesen Fall wäre Frage 1 auch dann grün, wenn sie
    // gar nichts mehr vergliche.
    let gegen = null;
    try {
      const st = cloud['user_app_state'];
      const merk = st.recipe_favs;
      delete st.recipe_favs; st.recipe_favs_UMBENANNT = merk;
      leeren();
      await holen();
      gegen = { weg: localStorage.getItem('gs_recipe_favs') == null };
      st.recipe_favs = merk; delete st.recipe_favs_UMBENANNT;
    } catch (e) { gegen = { weg: false, fehler: String(e) }; }

    // ── 3 · Leere Cloud überschreibt keinen gefüllten lokalen Stand ──────
    // Einmal für eine Liste, einmal für ein Objekt. Und die Gegenprobe:
    // eine GEFÜLLTE Cloud MUSS überschreiben, sonst prüfte der Fall nur,
    // dass der Pull gar nichts tut.
    leeren();
    localStorage.setItem('ps_favs', '["lokal1","lokal2"]');
    localStorage.setItem('ps_votes', '{"lokal":1}');
    const stLeer = cloud['user_app_state'];
    const merkF = stLeer.favs, merkV = stLeer.votes;
    stLeer.favs = []; stLeer.votes = {};
    await holen();
    const schutz = {
      liste: localStorage.getItem('ps_favs'),
      objekt: localStorage.getItem('ps_votes'),
    };
    stLeer.favs = ['cloud1']; stLeer.votes = { cloud: 2 };
    localStorage.removeItem('gs_sync_dirty_at_state');
    localStorage.removeItem('gs_sync_dirty');
    await holen();
    schutz.nachVoll = localStorage.getItem('ps_favs');
    stLeer.favs = merkF; stLeer.votes = merkV;

    // ── 4 · Ein Pull darf nichts als ungesendet markieren ────────────────
    // Sonst schiebt der nächste Flush die soeben geholten Daten wieder hoch —
    // ein Kreisel, der bei jedem Tick Bandbreite kostet und bei jedem Rennen
    // zwischen zwei Geräten Daten verlieren kann.
    leeren(); setzen();
    await schieben();
    leeren();
    await holen();
    const dirtyNachPull = localStorage.getItem('gs_sync_dirty') || '';

    // ── 5 · Sagt der Server NEIN, bleibt es schmutzig ────────────────────
    // Die Klasse aus v30.99: `_markSuccess()` lief bedingungslos, ein Push in
    // einen 401 galt als erledigt — und der Stand war weg.
    leeren(); setzen();
    localStorage.removeItem('gs_sync_dirty');
    fehlerAntwort = true;
    await schieben();
    const dirtyNachFehler = localStorage.getItem('gs_sync_dirty') || '';
    fehlerAntwort = false;

    return {
      tabellen, fehlt, anders, gegen, schutz,
      dirtyNachPull, dirtyNachFehler,
      keys: Object.keys(P).length,
    };
  }, { proben: PROBEN });

  // ── v33.46: Ein Sync, der KLEMMT ───────────────────────────────────────
  // Gemessen an v33.45: ein unvollstaendiger Sync landete in `console.warn`
  // und sonst nirgends. Die Statuszeile in den Einstellungen kannte keinen
  // Unterschied zwischen „seit einer Minute" und „seit drei Tagen".
  // Der Zustand wird HERGESTELLT, nicht vorgefunden: gsCloudSync.status wird
  // gestellt, damit die Rechnung gegen bekannte Zahlen laeuft.
  const k = await page.evaluate(async () => {
    const echt = window.gsCloudSync && window.gsCloudSync.status;
    const stell = (o) => { window.gsCloudSync.status = () => o; };
    const raus = {};
    try {
      if (typeof window.gsSyncStand !== 'function') return { fehlt: 'gsSyncStand' };
      // a) nichts offen → ok
      stell({ ok: true, dirty: [], pendingOps: 0, lastPush: '1', lastPushAgeSec: 60, canPush: true, online: true });
      raus.leer = gsSyncStand().zustand;
      // b) offen, aber jung → unterwegs (NICHT klemmt)
      stell({ ok: false, dirty: ['state'], pendingOps: 1, lastPush: '1', lastPushAgeSec: 3600, canPush: true, online: true });
      raus.jung = gsSyncStand().zustand;
      // c) offen und ALT → klemmt
      stell({ ok: false, dirty: ['state', 'plants'], pendingOps: 1, lastPush: '1', lastPushAgeSec: 3600 * 50, canPush: true, online: true });
      const st = gsSyncStand();
      raus.alt = st.zustand; raus.offen = st.offen; raus.stunden = st.stunden; raus.grund = st.grund || '';
      // d) OFFLINE und alt → kein Alarm. Die Warteschlange ist genau dafuer da.
      stell({ ok: false, dirty: ['state'], pendingOps: 0, lastPush: '1', lastPushAgeSec: 3600 * 50, canPush: false, online: false });
      const off = gsSyncStand();
      raus.offline = off.zustand; raus.offlineGrund = off.grund || '';
      // e) Auf dem BILDSCHIRM: die Zeile erscheint nur im Fall „klemmt".
      const zeile = (zustand) => {
        stell(zustand);
        try { localStorage.removeItem('gs_sync_klemmt_tag'); } catch (_) {}
        const el = document.getElementById('home-dayplan');
        if (el) el.innerHTML = '';
        try { if (typeof gsRenderDayPlan === 'function') gsRenderDayPlan(); } catch (_) {}
        const b2 = el ? el.querySelector('.gs-dp-sync') : null;
        return b2 ? (b2.textContent || '').replace(/\s+/g, ' ').trim() : '';
      };
      raus.zeileKlemmt = zeile({ ok: false, dirty: ['state', 'plants'], pendingOps: 1, lastPush: '1', lastPushAgeSec: 3600 * 50, canPush: true, online: true });
      raus.zeileJung   = zeile({ ok: false, dirty: ['state'], pendingOps: 0, lastPush: '1', lastPushAgeSec: 3600, canPush: true, online: true });
      raus.zeileOk     = zeile({ ok: true, dirty: [], pendingOps: 0, lastPush: '1', lastPushAgeSec: 60, canPush: true, online: true });
      // f) Das Ereignis: einmal je Tag, und nur die zwei erlaubten Zahlen.
      const gesendet = [];
      window.gsTrackEvent = (ev, props) => gesendet.push({ ev, props });
      try { localStorage.removeItem('gs_sync_klemmt_tag'); } catch (_) {}
      stell({ ok: false, dirty: ['state', 'plants'], pendingOps: 1, lastPush: '1', lastPushAgeSec: 3600 * 50, canPush: true, online: true });
      const el2 = document.getElementById('home-dayplan');
      for (let i = 0; i < 3; i++) { if (el2) el2.innerHTML = ''; try { gsRenderDayPlan(); } catch (_) {} }
      raus.ereignisse = gesendet.filter(x => x.ev === 'sync_stuck').length;
      raus.felder = gesendet.length ? Object.keys(gesendet[0].props || {}).sort().join(',') : '';
      raus.imVokabular = !!(window.GS_EVENTS && GS_EVENTS.sync_stuck);
      return raus;
    } finally { if (echt) window.gsCloudSync.status = echt; }
  });

  if (k.fehlt) {
    melde('Ein Sync, der klemmt, wird als solcher erkannt', false,
      k.fehlt + ' fehlt — ein unvollständiger Sync landet dann nur in console.warn');
    melde('Die Zeile steht auf dem Bildschirm, aber nur wenn es klemmt', false, k.fehlt + ' fehlt');
    melde('Das Ereignis kommt einmal je Tag und trägt nur Zahlen', false, k.fehlt + ' fehlt');
  } else {
    const rOk = k.leer === 'ok' && k.jung === 'unterwegs' && k.alt === 'klemmt'
      && k.offline === 'nicht_bekannt' && !!k.offlineGrund;
    melde('Ein Sync, der klemmt, wird als solcher erkannt — und Offline ist kein Alarm', rOk,
      rOk ? 'leer → ok · 1 h offen → unterwegs · 50 h offen → klemmt (' + k.offen + ' offen, ' + k.stunden + ' h) · offline → nicht_bekannt mit Grund'
        : 'leer=' + k.leer + ' jung=' + k.jung + ' alt=' + k.alt + ' offline=' + k.offline + ' (Grund: ' + (k.offlineGrund || '—') + ')');

    const zOk = !!k.zeileKlemmt && !k.zeileJung && !k.zeileOk;
    melde('Die Zeile steht auf dem Bildschirm, aber nur wenn es klemmt', zOk,
      zOk ? '„' + k.zeileKlemmt.slice(0, 70) + '“ · jung und ok: keine Zeile'
        : 'klemmt=„' + (k.zeileKlemmt || '(nichts)') + '“ jung=„' + (k.zeileJung || '(nichts)') + '“ ok=„' + (k.zeileOk || '(nichts)') + '“');

    const eOk = k.ereignisse === 1 && k.felder === 'offen,stunden' && k.imVokabular;
    melde('Das Ereignis kommt einmal je Tag und trägt nur Zahlen', eOk,
      eOk ? 'dreimal gerendert → 1 Ereignis, Felder: ' + k.felder + ', im Vokabular'
        : k.ereignisse + ' Ereignis(se) bei drei Renderings, Felder: „' + k.felder + '“, im Vokabular: ' + k.imVokabular);
  }

  // ── v33.59 · Der Pull frischt auch den ARBEITSSPEICHER auf ──────────────
  // (Fall uebernommen vom Zweig ccr-dce5a17c-2xzhvi, Austausch-Runde parallel-b3;
  // die Reparatur dort setzte die UNGESIEBTE Liste — hier geht sie durch
  // _gsListeEinspielen: Sieb, Speicher UND Variable.)
  // Gemessen (Audit „robust", bestaetigt): der Login-Pull schrieb Gaerten und
  // Pflanzungen NUR in den Geraetespeicher. Die Variablen `gardens` und
  // `plantings` blieben, wie sie beim Parsen der Seite waren — auf einem
  // frischen Geraet leer. Am Ende des Pulls steht `renderGarden()`, dessen
  // erste Zeile `initDefaultGarden()` ist: leere Liste → „Mein Garten" anlegen
  // → `saveGardenData()` schreibt DIESE Liste ueber das gerade Geholte und
  // merkt sie zum Hochladen vor. Fuer Pflanzen frischte der Pull laengst auf
  // (`myPlants = pd.plants`), fuer Gaerten nie.
  const g = await page.evaluate(async () => {
    const raus = {};
    const HEUTE = (typeof _gsDayKey === 'function') ? _gsDayKey() : new Date().toISOString().slice(0, 10);
    const G = [{ id: 'g-a', name: 'Hochbeet Süd', kind: 'hochbeet' }, { id: 'g-b', name: 'Balkon West', kind: 'balkon' }];
    const AUFG = { water: { active: true, intervalDays: 3, lastDone: new Date().toISOString() } };   // heutige Form — sonst ruestet die App nach und speichert (v32.47)
    const PL = [{ id: 'pl-a', gardenId: 'g-a', name: 'Tomate', date: HEUTE, tasks: AUFG }, { id: 'pl-b', gardenId: 'g-b', name: 'Basilikum', date: HEUTE, tasks: AUFG }];
    const echt = window.sbFetch;
    const hoch = [];
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      if (/\/rest\/v1\/user_gardens/.test(pfad) && m === 'GET') return { data: [{ data: { gardens: G, plantings: PL }, updated_at: new Date().toISOString() }], error: null, status: 200 };
      if (/\/rest\/v1\/user_gardens/.test(pfad)) { try { hoch.push(JSON.parse(opts.body).data); } catch (_) {} return { data: [{}], error: null, status: 200 }; }
      return { data: [], error: null, status: 200 };
    };
    const lies = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
    // Der Push direkt nach dem Pull geht ueber `flushNow()` — den Beacon-Weg mit
    // ROHEM fetch, an sbFetch vorbei (CLAUDE.md §7.1, sync_check). Also auch den abhoeren.
    const echtFetch = window.fetch, exp0 = localStorage.getItem('gs_sb_expires');
    window.fetch = async function (url, opts) {
      if (/\/rest\/v1\/user_gardens/.test(String(url)) && opts && opts.body) { try { hoch.push(JSON.parse(opts.body).data); } catch (_) {} return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echtFetch.apply(this, arguments);
    };
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));   // sonst ueberspringt der Beacon-Weg den Push (Token „abgelaufen")
    try {
      // Geraet B: frisch angemeldet. Lokal gibt es weder Gaerten noch Ungesendetes.
      ['gs_gardens', 'gs_plantings', 'gs_sync_dirty', 'gs_sync_dirty_at_garden', 'gs_sync_synced_at_garden'].forEach(k => localStorage.removeItem(k));
      gardens = []; plantings = [];
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await new Promise(r => setTimeout(r, 1800));   // renderGarden + ein moeglicher Flush (500 ms entprellt)
      raus.speicher = lies('gs_gardens').map(x => x.name);
      raus.arbeit = gardens.map(x => x.name);
      raus.pflSpeicher = lies('gs_plantings').length;
      raus.pflArbeit = plantings.length;
      raus.hoch = hoch.map(d => ((d && d.gardens) || []).map(x => x.name).join('+') + ' / ' + (((d && d.plantings) || []).length) + ' Pfl.');
      raus.vorgemerkt = localStorage.getItem('gs_sync_dirty_at_garden') ? 'ja' : 'nein';
      // Gegenrichtung: UNGESENDETE lokale Aenderungen gewinnen weiter (v24.23) —
      // sonst waere ein Pull, der immer ueberschreibt, ebenfalls gruen.
      hoch.length = 0;
      gardens = [{ id: 'g-lokal', name: 'Nur hier' }]; plantings = [];
      saveGardenData();                                  // merkt 'garden' als ungesendet vor
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await new Promise(r => setTimeout(r, 300));
      raus.lokalBleibt = gardens.map(x => x.name);
    } catch (e) { raus.fehler = String(e && e.message); }
    finally { window.sbFetch = echt; window.fetch = echtFetch; if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0); }
    return raus;
  });
  {
    const soll = 'Hochbeet Süd,Balkon West';
    const ok = !g.fehler && g.speicher.join(',') === soll && g.arbeit.join(',') === soll && g.pflSpeicher === 2 && g.pflArbeit === 2
      && !g.hoch.some(h => /Mein Garten/.test(h)) && g.vorgemerkt === 'nein' && g.lokalBleibt.join(',') === 'Nur hier';
    melde('Der Pull frischt Gärten und Pflanzungen auch im ARBEITSSPEICHER auf — ein frisch angemeldetes Gerät überschreibt sie nicht mit „Mein Garten"', ok,
      ok ? '2 Gärten und 2 Pflanzungen im Speicher UND im Arbeitsspeicher · nichts mit „Mein Garten" hochgeschoben · ungesendete lokale Änderung bleibt (' + g.lokalBleibt.join(',') + ')'
        : (g.fehler ? 'Ausnahme: ' + g.fehler
          : 'Cloud hatte „' + soll + '" + 2 Pflanzungen → Speicher: „' + g.speicher.join(',') + '" (' + g.pflSpeicher + ' Pfl.) · Arbeitsspeicher: „' + g.arbeit.join(',') + '" (' + g.pflArbeit + ' Pfl.)'
            + (g.hoch.length ? ' · HOCHGESCHOBEN: ' + g.hoch.join(' | ') : '') + ' · zum Hochladen vorgemerkt: ' + g.vorgemerkt + ' · lokal ungesendet danach: „' + (g.lokalBleibt || []).join(',') + '"'));
  }

  // ── v33.65 · Zwei Geräte, EIN Konto (Auftrag P-F, Hypothese H1) ──────────
  // Fernando: „Zum Teil sieht man neu eingetragene Pflanzen oder Informationen nicht.
  // Allgemein werden viele Informationen wieder gelöscht." Gemessen wird der Login-Abgleich
  // (gsSyncUserDataOnLogin) mit ZWEI Ständen im selben Konto: der Speicher wird zwischen
  // „Gerät A" und „Gerät B" umgeschaltet, der Server ist eine gestellte Cloud. Bis v33.64
  // arbeitete der Abgleich mit GANZEN Listen: ungesendet lokal → die ganze lokale Liste
  // gewinnt und überschreibt die Cloud (was ein anderes Gerät dort hinzugefügt hat, ist weg);
  // sauber → die ganze Cloud-Liste ersetzt die lokale. Jetzt: je Eintrag, mit Löschmarken.
  const z = await page.evaluate(async () => {
    const raus = {};
    const echtFetch = window.sbFetch, echtLogged = window.sbIsLoggedIn;
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const cloud = {};
    let online = true;
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      const tab = (pfad.match(TAB) || [])[1];
      if (tab && (m === 'POST' || m === 'PATCH')) {
        try { cloud[tab] = { data: JSON.parse(opts.body).data, updated_at: new Date().toISOString() }; } catch (_) {}
        return { data: [{}], error: null, status: 200 };
      }
      if (tab && m === 'GET') return cloud[tab] ? { data: [cloud[tab]], error: null, status: 200 } : { data: [], error: null, status: 200 };
      return { data: [], error: null, status: 200 };
    };
    window.sbIsLoggedIn = () => online;
    // Der Push direkt nach dem Abgleich geht ueber flushNow() — den Beacon-Weg mit ROHEM fetch (sync_check, Kopf).
    const echtRaw = window.fetch, exp0 = localStorage.getItem('gs_sb_expires');
    window.fetch = async function (url, opts) {
      const tab = (String(url).match(TAB) || [])[1];
      if (tab && opts && opts.body) { try { cloud[tab] = { data: JSON.parse(opts.body).data, updated_at: new Date().toISOString() }; } catch (_) {} return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echtRaw.apply(this, arguments);
    };
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    const snap = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
    const lade = (o) => {
      window._gsSyncPullInProgress = true;
      try {
        localStorage.clear();
        Object.keys(o).forEach(k => localStorage.setItem(k, o[k]));
      } finally { window._gsSyncPullInProgress = false; }
      ['gs_sync_dirty', 'gs_sync_dirty_at_plants', 'gs_sync_dirty_at_garden', 'gs_sync_dirty_at_state', 'gs_sync_synced_at_plants', 'gs_sync_synced_at_garden'].forEach(k => { if (k in o) localStorage.setItem(k, o[k]); else localStorage.removeItem(k); });
      const rd = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
      myPlants = rd('ps_myplants'); gardens = rd('gs_gardens'); plantings = rd('gs_plantings');
    };
    const ids = (a) => (a || []).map(x => x.id).sort().join(',');
    const lies = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
    const tasks = (t) => ({ water: { active: true, intervalDays: 3, lastDone: t } });
    const T0 = '2026-11-01T08:00:00.000Z';
    const login = async () => { online = true; window._gsInitialSyncDone = false; await gsSyncUserDataOnLogin(); await warte(1500); };
    const sichern = async () => { window._gsInitialSyncDone = true; await warte(1500); };   // Flush (500 ms entprellt)
    try {
      localStorage.setItem('gs_sb_uid', 'nutzer-A'); localStorage.setItem('gs_last_active_uid', 'nutzer-A');
      window.gsRequire = () => true;
      // ══ H1a · Pflanzen: A trägt X ein, B (alter Stand, ungesendet durch Abhaken) meldet sich an ══
      lade({ gs_sb_uid: 'nutzer-A', gs_last_active_uid: 'nutzer-A', gs_sb_token: localStorage.getItem('gs_sb_token') || '' });
      window._gsInitialSyncDone = true;
      myPlants = [{ id: 'mp_P1', name: 'Tomate', tasks: tasks(T0) }, { id: 'mp_Q1', name: 'Minze', tasks: tasks(T0) }];
      savePlantsToStorage(); await sichern();
      const a1 = snap();                                         // Stand nach dem ersten Hochladen — beide Geräte kennen ihn
      const gerB = Object.assign({}, a1);
      await warte(40);
      myPlants.push({ id: 'mp_X', name: 'Neue Basilikum', tasks: tasks(T0) });   // Gerät A: NEU eingetragen
      savePlantsToStorage(); await sichern();
      const a2 = snap();
      raus.h1a_cloudNachA = ids((cloud.user_plants.data || {}).plants);
      lade(gerB);                                                // Gerät B: alter Stand
      await warte(40);
      online = false;                                            // … unterwegs ohne Netz: abhaken
      myPlants.find(p => p.id === 'mp_P1').tasks.water.lastDone = '2026-11-18T07:00:00.000Z';
      savePlantsToStorage(); await warte(800);
      raus.h1a_bDirty = !!localStorage.getItem('gs_sync_dirty_at_plants');
      await login();
      raus.h1a_bIds = ids(lies('ps_myplants'));
      raus.h1a_bVar = ids(myPlants);
      raus.h1a_bAbgehakt = (lies('ps_myplants').find(p => p.id === 'mp_P1') || { tasks: { water: {} } }).tasks.water.lastDone;
      raus.h1a_cloudIds = ids((cloud.user_plants.data || {}).plants);
      raus.h1a_cloudAbgehakt = (((cloud.user_plants.data || {}).plants || []).find(p => p.id === 'mp_P1') || { tasks: { water: {} } }).tasks.water.lastDone;

      // ══ H1b · sauberes Gerät, Cloud hat mehr: bekommt alles (Wächter gegen „lokal gewinnt immer") ══
      lade(a1);
      await login();
      raus.h1b_ids = ids(lies('ps_myplants'));
      raus.h1b_dirty = localStorage.getItem('gs_sync_dirty') || '';

      // ══ H1c · Gärten und Pflanzungen: dieselbe Rechnung ══
      for (const k of Object.keys(cloud)) delete cloud[k];
      lade({ gs_sb_uid: 'nutzer-A', gs_last_active_uid: 'nutzer-A' });
      window._gsInitialSyncDone = true;
      gardens = [{ id: 'g_1', name: 'Hochbeet' }];
      plantings = [{ id: 'pl_1', gardenId: 'g_1', name: 'Karotte', date: '2026-10-01', tasks: tasks(T0) }];
      saveGardenData(); await sichern();
      const g1 = snap();
      await warte(40);
      plantings.push({ id: 'pl_2', gardenId: 'g_1', name: 'Neue Zucchini', date: '2026-11-18', tasks: tasks(T0) });
      gardens.push({ id: 'g_2', name: 'Balkon' });
      saveGardenData(); await sichern();
      lade(g1); await warte(40);
      online = false;
      plantings.find(p => p.id === 'pl_1').tasks.water.lastDone = '2026-11-18T07:00:00.000Z';
      saveGardenData(); await warte(800);
      await login();
      raus.h1c_pfl = ids(lies('gs_plantings')); raus.h1c_gaerten = ids(lies('gs_gardens'));
      raus.h1c_cloudPfl = ids((cloud.user_gardens.data || {}).plantings); raus.h1c_cloudGaerten = ids((cloud.user_gardens.data || {}).gardens);
      raus.h1c_abgehakt = (lies('gs_plantings').find(p => p.id === 'pl_1') || { tasks: { water: {} } }).tasks.water.lastDone;

      // ══ H1d · LÖSCHEN darf nicht wiederauferstehen ══
      for (const k of Object.keys(cloud)) delete cloud[k];
      lade({ gs_sb_uid: 'nutzer-A', gs_last_active_uid: 'nutzer-A' });
      window._gsInitialSyncDone = true;
      myPlants = [{ id: 'mp_P1', name: 'Tomate', tasks: tasks(T0) }, { id: 'mp_X', name: 'Basilikum', tasks: tasks(T0) }];
      plantings = [{ id: 'pl_1', gardenId: 'g_1', name: 'Karotte', date: '2026-10-01', tasks: tasks(T0) }, { id: 'pl_2', gardenId: 'g_1', name: 'Zucchini', date: '2026-10-01', tasks: tasks(T0) }];
      gardens = [{ id: 'g_1', name: 'Hochbeet' }];
      savePlantsToStorage(); saveGardenData(); await sichern();
      const d1 = snap();
      await warte(40);
      lade(d1);                                                   // Gerät B: ändert P1 und pl_1 (ohne Netz), VOR dem Löschen auf A
      online = false;
      myPlants.find(p => p.id === 'mp_P1').tasks.water.lastDone = '2026-11-18T06:00:00.000Z';
      plantings.find(p => p.id === 'pl_1').tasks.water.lastDone = '2026-11-18T06:00:00.000Z';
      myPlants.find(p => p.id === 'mp_X').name = 'Basilikum (B)';
      savePlantsToStorage(); saveGardenData(); await warte(800);
      const dB = snap();
      await warte(60);
      lade(d1); online = true; window._gsInitialSyncDone = true;  // Gerät A: LÖSCHT P1 und pl_1 — danach
      myPlants = myPlants.filter(p => p.id !== 'mp_P1'); plantings = plantings.filter(p => p.id !== 'pl_1');
      savePlantsToStorage(); saveGardenData(); await sichern();
      raus.h1d_cloudNachA = ids((cloud.user_plants.data || {}).plants) + ' | ' + ids((cloud.user_gardens.data || {}).plantings);
      raus.h1d_marken = localStorage.getItem('gs_geloescht') ? 'ja' : 'nein';
      lade(dB); await login();
      raus.h1d_bPfl = ids(lies('ps_myplants')); raus.h1d_bPlant = ids(lies('gs_plantings'));
      raus.h1d_cloudPfl = ids((cloud.user_plants.data || {}).plants); raus.h1d_cloudPlant = ids((cloud.user_gardens.data || {}).plantings);
      raus.h1d_bName = (lies('ps_myplants').find(p => p.id === 'mp_X') || {}).name;
      // ══ H6 · eine Änderung WÄHREND eines laufenden Pushes geht nicht verloren ══
      // (Bestandsaufnahme „Sofort sichern": `_flush` schrieb am Ende `_setDirty(stillDirty)` — den Stand
      // vom BEGINN. Was in den Sekunden des Pushes vorgemerkt wurde, war danach „sauber".)
      for (const k of Object.keys(cloud)) delete cloud[k];
      lade({ gs_sb_uid: 'nutzer-A', gs_last_active_uid: 'nutzer-A' });
      online = true; window._gsInitialSyncDone = true;
      const schnell = window.sbFetch;
      window.sbFetch = async function (pfad, opts) {
        if (/user_plants/.test(pfad) && opts && (opts.method || '').toUpperCase() === 'POST') await warte(500);   // ein langsames Netz
        return schnell.apply(this, arguments);
      };
      myPlants = [{ id: 'mp_A', name: 'Erste', tasks: tasks(T0) }];
      savePlantsToStorage();
      await warte(800);                                                // Push laeuft (ab 500 ms, dauert 500 ms)
      myPlants.push({ id: 'mp_B', name: 'Zweite, waehrend des Pushes', tasks: tasks(T0) });
      savePlantsToStorage();
      await warte(4000);
      window.sbFetch = schnell;
      raus.h6_cloud = ids((cloud.user_plants.data || {}).plants);
      raus.h6_dirty = localStorage.getItem('gs_sync_dirty') || '';
      // ══ H7 · Beim Schliessen gehen ALLE Blobs hinaus, auch wenn ein Push noch laeuft ══
      for (const k of Object.keys(cloud)) delete cloud[k];
      const gestartet = [];
      const rawStub = window.fetch;
      window.fetch = async function (url, opts) {
        const tab = (String(url).match(TAB) || [])[1];
        if (tab && opts && opts.body) { gestartet.push(tab); await warte(250); cloud[tab] = { data: JSON.parse(opts.body).data, updated_at: new Date().toISOString() }; return new Response('[{}]', { status: 200 }); }
        return rawStub.apply(this, arguments);
      };
      localStorage.setItem('gs_sb_token', 'x.y.z');
      myPlants = [{ id: 'mp_A', name: 'Erste', tasks: tasks(T0) }]; gardens = [{ id: 'g_1', name: 'Beet' }];
      savePlantsToStorage(); saveGardenData();
      gsCloudSync.markDirty('state');
      gsCloudSync.flushNow();                                         // wie pagehide: nicht abwarten
      await warte(60);
      raus.h7_gestartet = gestartet.slice().sort().join(',');         // alle drei SOFORT unterwegs?
      await warte(900);
      window.fetch = rawStub;
      raus.h7_cloud = Object.keys(cloud).sort().join(',');
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally { window.sbFetch = echtFetch; window.sbIsLoggedIn = echtLogged; window.fetch = echtRaw; if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0); }
    return raus;
  });
  {
    const mk = (frage, ok, gut, schlecht) => melde(frage, ok && !z.fehler, ok && !z.fehler ? gut : (z.fehler ? 'Ausnahme: ' + z.fehler : schlecht));
    mk('H1a · Gerät A trägt eine Pflanze ein, Gerät B (alter Stand, ungesendet) meldet sich an → die neue Pflanze steht auf B UND in der Cloud, Bs Abhaken auch',
      z.h1a_bDirty && z.h1a_bIds === 'mp_P1,mp_Q1,mp_X' && z.h1a_cloudIds === 'mp_P1,mp_Q1,mp_X' && /^2026-11-18/.test(z.h1a_bAbgehakt || '') && /^2026-11-18/.test(z.h1a_cloudAbgehakt || ''),
      'B: ' + z.h1a_bIds + ' · Cloud: ' + z.h1a_cloudIds + ' · Abhaken auf beiden',
      'B ungesendet=' + z.h1a_bDirty + ' · Cloud nach A: ' + z.h1a_cloudNachA + ' · B danach: ' + z.h1a_bIds + ' (Arbeitsspeicher ' + z.h1a_bVar + ') · Cloud danach: ' + z.h1a_cloudIds + ' · Abhaken B/Cloud: ' + z.h1a_bAbgehakt + ' / ' + z.h1a_cloudAbgehakt);
    mk('H1b · ein sauberes Gerät bekommt, was die Cloud mehr hat — und markiert dabei nichts als ungesendet',
      z.h1b_ids === 'mp_P1,mp_Q1,mp_X' && !/plants/.test(z.h1b_dirty || ''),
      'B: ' + z.h1b_ids + ' · nichts ungesendet',
      'B: ' + z.h1b_ids + ' · gs_sync_dirty = ' + z.h1b_dirty);
    mk('H1c · Gärten und Pflanzungen: neue Pflanzung und neuer Garten von A überleben Bs ungesendetes Abhaken',
      z.h1c_pfl === 'pl_1,pl_2' && z.h1c_gaerten === 'g_1,g_2' && z.h1c_cloudPfl === 'pl_1,pl_2' && z.h1c_cloudGaerten === 'g_1,g_2' && /^2026-11-18/.test(z.h1c_abgehakt || ''),
      'B und Cloud: Pflanzungen ' + z.h1c_pfl + ' · Gärten ' + z.h1c_gaerten + ' · Abhaken bleibt',
      'B: Pflanzungen ' + z.h1c_pfl + ', Gärten ' + z.h1c_gaerten + ' · Cloud: ' + z.h1c_cloudPfl + ', ' + z.h1c_cloudGaerten + ' · Abhaken: ' + z.h1c_abgehakt);
    mk('H6 · eine Änderung, die während eines laufenden Pushes vorgemerkt wird, geht nicht verloren',
      z.h6_cloud === 'mp_A,mp_B',
      'beide Pflanzen in der Cloud · nichts mehr ungesendet',
      'Cloud: ' + z.h6_cloud + ' (die zweite fehlt) · ungesendet danach: „' + (z.h6_dirty || '(nichts)') + '“ — der Stand galt als gesichert');
    mk('H7 · beim Schliessen der App (Sofort-Flush) gehen alle drei Blobs GLEICHZEITIG hinaus — nicht nacheinander',
      z.h7_gestartet === 'user_app_state,user_gardens,user_plants' && z.h7_cloud === 'user_app_state,user_gardens,user_plants',
      'drei Anfragen binnen 60 ms unterwegs · alle drei angekommen',
      'nach 60 ms unterwegs: „' + z.h7_gestartet + '“ · angekommen: „' + z.h7_cloud + '“ — der zweite und dritte Blob warten auf eine Antwort, die nach dem Verbergen der App nie kommt');
    mk('H1d · auf A gelöscht → kommt auf B (das die Pflanze noch änderte) nicht wieder, weder lokal noch in der Cloud — und Bs andere Änderung bleibt',
      z.h1d_marken === 'ja' && z.h1d_bPfl === 'mp_X' && z.h1d_bPlant === 'pl_2' && z.h1d_cloudPfl === 'mp_X' && z.h1d_cloudPlant === 'pl_2' && z.h1d_bName === 'Basilikum (B)',
      'Löschmarken auf A · B: ' + z.h1d_bPfl + ' / ' + z.h1d_bPlant + ' · Cloud: ' + z.h1d_cloudPfl + ' / ' + z.h1d_cloudPlant + ' · Bs Umbenennung bleibt',
      'Löschmarken: ' + z.h1d_marken + ' · Cloud nach A: ' + z.h1d_cloudNachA + ' · B danach: ' + z.h1d_bPfl + ' / ' + z.h1d_bPlant + ' · Cloud danach: ' + z.h1d_cloudPfl + ' / ' + z.h1d_cloudPlant + ' · Name: ' + z.h1d_bName);
  }

  // ── Gegenpruefung blob (19.11.2026) · H8: Plan speichern, waehrend der Garten-Blob NICHT LESBAR ist ──
  // gsPPsavePlan schreibt seit der Reparatur nur noch ueber einen GELESENEN Blob — und merkt den Plan bei
  // einem Lesefehler vor (markDirty('garden')). Der Fall der Reparatur stellte markDirty durch einen Zaehler
  // und sah deshalb nur die Funktion, nicht den ABGLEICH dahinter: der schob 500 ms spaeter den LOKALEN
  // Garten-Blob hoch — auf einem frisch angemeldeten Geraet, dessen Start-Abgleich am selben Blob gescheitert
  // war, ein Blob ohne die Gaerten, Pflanzungen, Plaene, current und Tracks der Cloud. Und der naechste
  // erfolgreiche Abgleich behielt bei „ungesendet" die GANZE lokale Planliste (und current, Tracks), der Push
  // danach ersetzte die der Cloud. Gemessen wird hier der ganze Weg mit dem ECHTEN gsCloudSync und dem
  // ECHTEN Login-Abgleich gegen eine gestellte Cloud: was steht am Ende in der Cloud und auf dem Geraet?
  const h8 = await page.evaluate(async () => {
    const raus = {};
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const echt = { fetch: window.sbFetch, login: window.sbIsLoggedIn, raw: window.fetch, toast: window.showProfileToast, agent: window.gsAgentScheduleNotifications };
    const exp0 = localStorage.getItem('gs_sb_expires'), tok0 = localStorage.getItem('gs_sb_token');
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    const cloud = {};
    let gartenLesbar = false;   // das Netz wackelt: das LESEN des Garten-Blobs scheitert (503), Schreiben ginge
    const nimm = (tab, body) => { try { cloud[tab] = { data: JSON.parse(body).data, updated_at: new Date().toISOString() }; } catch (_) {} };
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      const tab = (String(pfad).match(TAB) || [])[1];
      if (tab && (m === 'POST' || m === 'PATCH')) { nimm(tab, opts.body); return { data: [{}], error: null, status: 200 }; }
      if (tab && m === 'GET') {
        if (tab === 'user_gardens' && !gartenLesbar) return { data: null, error: { message: 'Service Unavailable', status: 503 }, status: 503 };
        return cloud[tab] ? { data: [cloud[tab]], error: null, status: 200 } : { data: [], error: null, status: 200 };
      }
      return { data: [], error: null, status: 200 };
    };
    window.fetch = async function (url, opts) {   // der Sofort-Flush nach dem Abgleich geht ueber rohes fetch (keepalive)
      const tab = (String(url).match(TAB) || [])[1];
      if (tab && opts && opts.body) { nimm(tab, opts.body); return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echt.raw.apply(this, arguments);
    };
    window.sbIsLoggedIn = () => true;
    window.showProfileToast = () => {};
    window.gsAgentScheduleNotifications = async () => {};
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    if (!tok0) localStorage.setItem('gs_sb_token', 'x.y.z');
    const lies = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
    const ids = (a) => (a || []).map(x => x && x.id).sort().join(',');
    // „Mein Garten" (gard_default) legt die Garten-Ansicht an, wenn die Liste leer ist — auch am Ende eines
    // GESCHEITERTEN Abgleichs. Nach dem naechsten Abgleich steht er zusaetzlich da; das ist kein Verlust und
    // wird unten nur genannt (blick → extra), gezaehlt wird ohne ihn.
    const ohneStd = (a) => (a || []).filter(x => !(x && x.id === 'gard_default'));
    const plaene = (a) => (a || []).map(p => p && (p.id === 'plan-alt' ? 'alt' : (p.plan && p.plan.summary === 'Neuer Plan H8' ? 'neu' : '?'))).sort().join(',');
    const blick = (d) => { d = d || {}; return { gaerten: ids(ohneStd(d.gardens)), pflanzungen: ids(d.plantings), plaene: plaene(d.plans), current: !!(d.current && d.current.plan), tracks: (d.gpx_tracks || []).length }; };
    try {
      // Die Cloud: ein Konto mit Garten, Pflanzung, einem Plan von einem anderen Geraet, dem offenen Plan und einem Track.
      cloud.user_gardens = { data: {
        gardens: [{ id: 'g_c', name: 'Hochbeet (Cloud)' }],
        plantings: [{ id: 'pl_c', gardenId: 'g_c', name: 'Karotte', date: '2026-10-01' }],
        plans: [{ id: 'plan-alt', created: '2026-05-01T00:00:00.000Z', title: 'Plan vom anderen Geraet', plan: { summary: 'alt', plants: [] } }],
        current: { plan: { summary: 'offen' } },
        gpx_tracks: [{ ts: 1767225600000, end: 1767229200000, points: [] }],
      }, updated_at: '2026-11-01T08:00:00.000Z' };
      raus.vorher = blick(cloud.user_gardens.data);
      // Dieses Geraet: frisch angemeldet (der Garten-Speicher ist geraeumt), der Start-Abgleich scheitert am Garten-Blob.
      ['gs_gardens', 'gs_plantings', 'gs_garden_plans', 'gs_garden_plan_current', 'gs_gpx_tracks', 'gs_sync_dirty', 'gs_sync_dirty_at_garden', 'gs_sync_synced_at_garden'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('gs_sb_uid', 'nutzer-H8'); localStorage.setItem('gs_last_active_uid', 'nutzer-H8');
      gardens = []; plantings = [];
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      raus.startOk = !!window._gsInitialSyncDone;
      // Die Person speichert einen Plan — das Lesen des Blobs scheitert wieder.
      window._gsPP = window._gsPP || {};
      _gsPP.plan = { summary: 'Neuer Plan H8', bed: { width_m: 2, length_m: 2 }, plants: [{ name: 'Pruefart', count: 1 }] }; _gsPP.data = { area: 4 };
      await gsPPsavePlan();
      await warte(1500);                     // ein entprellter Abgleich (500 ms) haette jetzt geschoben
      raus.s1 = blick(cloud.user_gardens.data);
      raus.s1_std = ((cloud.user_gardens.data || {}).gardens || []).some(x => x && x.id === 'gard_default');
      raus.s1_lokal = plaene(lies('gs_garden_plans'));
      // Das Netz ist wieder da: der naechste Abgleich (Pull, danach Push).
      gartenLesbar = true;
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await warte(1500);
      raus.s2 = blick(cloud.user_gardens.data);
      raus.s2_std = ((cloud.user_gardens.data || {}).gardens || []).some(x => x && x.id === 'gard_default');
      raus.s2_lokal = { plaene: plaene(lies('gs_garden_plans')), gaerten: ids(ohneStd(lies('gs_gardens'))), current: !!(JSON.parse(localStorage.getItem('gs_garden_plan_current') || 'null') || {}).plan, tracks: lies('gs_gpx_tracks').length };
      raus.s2_ungesendet = localStorage.getItem('gs_sync_dirty_at_garden') ? 'ja' : 'nein';
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally {
      window.sbFetch = echt.fetch; window.sbIsLoggedIn = echt.login; window.fetch = echt.raw; window.showProfileToast = echt.toast; window.gsAgentScheduleNotifications = echt.agent;
      if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0);
      if (tok0 == null) localStorage.removeItem('gs_sb_token');
    }
    return raus;
  });
  {
    const S = (o) => JSON.stringify(o);
    const voll = { gaerten: 'g_c', pflanzungen: 'pl_c', plaene: 'alt', current: true, tracks: 1 };
    const ende = { gaerten: 'g_c', pflanzungen: 'pl_c', plaene: 'alt,neu', current: true, tracks: 1 };
    const ok1 = !h8.fehler && h8.startOk === false && S(h8.s1) === S(voll) && !h8.s1_std && h8.s1_lokal === 'neu';
    const ok2 = ok1 && S(h8.s2) === S(ende) && h8.s2_lokal.plaene === 'alt,neu' && h8.s2_lokal.gaerten === 'g_c' && h8.s2_lokal.current && h8.s2_lokal.tracks === 1 && h8.s2_ungesendet === 'nein';
    melde('H8 · Plan gespeichert, waehrend der Garten-Blob nicht lesbar war (frisches Geraet, Start-Abgleich gescheitert) → die Cloud behaelt Gaerten, Pflanzungen, Plaene, current und Tracks — vor UND nach dem naechsten Abgleich, und der neue Plan kommt dazu',
      ok2,
      ok2 ? 'nach dem Lesefehler: Cloud unveraendert, Plan lokal · nach dem Abgleich: Cloud und Geraet ' + S(h8.s2) + (h8.s2_std ? ' (dazu „Mein Garten“ aus dem gescheiterten Start — kein Verlust)' : '')
      : h8.fehler ? 'Ausnahme: ' + h8.fehler
        : (!ok1 ? 'Start-Abgleich ok=' + h8.startOk + ' · Cloud 1,5 s nach dem Speichern: ' + S(h8.s1) + (h8.s1_std ? ' + „Mein Garten“' : '') + ' (vorher ' + S(h8.vorher) + ') · Plan lokal: „' + h8.s1_lokal + '“ — der Abgleich hat einen Blob hochgeschoben, der die Cloud nie gelesen hat'
          : 'nach dem naechsten Abgleich — Cloud: ' + S(h8.s2) + ' (erwartet ' + S(ende) + ') · Geraet: ' + S(h8.s2_lokal) + ' · ungesendet: ' + h8.s2_ungesendet));
  }

  // ── H9 · die Sperre gilt JE BLOB, in beide Richtungen ──
  // Der Pflanzen-Blob ist nicht lesbar, der Garten-Blob schon: eine neue Pflanze darf die Pflanzen der Cloud
  // nicht ersetzen (bis v33.68 ging ein GEFUELLTER Blob vor jedem Lesen hoch — nur ein leerer wartete), ein
  // neuer Garten geht trotzdem hoch (sonst waere die Sperre „nie schieben, solange irgendetwas klemmt").
  const h9 = await page.evaluate(async () => {
    const raus = {};
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const echt = { fetch: window.sbFetch, login: window.sbIsLoggedIn, raw: window.fetch };
    const exp0 = localStorage.getItem('gs_sb_expires'), tok0 = localStorage.getItem('gs_sb_token');
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    const cloud = {};
    let pflanzenLesbar = false;
    const nimm = (tab, body) => { try { cloud[tab] = { data: JSON.parse(body).data, updated_at: new Date().toISOString() }; } catch (_) {} };
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      const tab = (String(pfad).match(TAB) || [])[1];
      if (tab && (m === 'POST' || m === 'PATCH')) { nimm(tab, opts.body); return { data: [{}], error: null, status: 200 }; }
      if (tab && m === 'GET') {
        if (tab === 'user_plants' && !pflanzenLesbar) return { data: null, error: { message: 'Failed to fetch', status: 0 }, status: 0 };
        return cloud[tab] ? { data: [cloud[tab]], error: null, status: 200 } : { data: [], error: null, status: 200 };
      }
      return { data: [], error: null, status: 200 };
    };
    window.fetch = async function (url, opts) {
      const tab = (String(url).match(TAB) || [])[1];
      if (tab && opts && opts.body) { nimm(tab, opts.body); return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echt.raw.apply(this, arguments);
    };
    window.sbIsLoggedIn = () => true;
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    if (!tok0) localStorage.setItem('gs_sb_token', 'x.y.z');
    const ids = (a) => (a || []).filter(x => !(x && x.id === 'gard_default')).map(x => x && x.id).sort().join(',');
    try {
      cloud.user_plants = { data: { plants: [{ id: 'mp_c', name: 'Tomate (Cloud)' }], diary: [{ id: 'tb_c', ts: '2026-10-01T08:00:00.000Z', text: 'Cloud-Eintrag' }] }, updated_at: '2026-11-01T08:00:00.000Z' };
      cloud.user_gardens = { data: { gardens: [{ id: 'g_c', name: 'Hochbeet (Cloud)' }], plantings: [], plans: [] }, updated_at: '2026-11-01T08:00:00.000Z' };
      ['ps_myplants', 'gs_gartentagebuch', 'gs_gardens', 'gs_plantings', 'gs_garden_plans', 'gs_sync_dirty', 'gs_sync_dirty_at_plants', 'gs_sync_dirty_at_garden', 'gs_sync_synced_at_plants', 'gs_sync_synced_at_garden'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('gs_sb_uid', 'nutzer-H9'); localStorage.setItem('gs_last_active_uid', 'nutzer-H9');
      myPlants = []; gardens = []; plantings = [];
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();                      // Pflanzen-Blob: Netzfehler · Garten-Blob: gelesen
      raus.startOk = !!window._gsInitialSyncDone;
      myPlants.push({ id: 'mp_neu', name: 'Neue Minze' }); savePlantsToStorage();
      gardens.push({ id: 'g_neu', name: 'Balkon (neu)' }); saveGardenData();
      await warte(1500);
      raus.s1 = { pflanzen: ids(cloud.user_plants.data.plants), tagebuch: (cloud.user_plants.data.diary || []).length, gaerten: ids(cloud.user_gardens.data.gardens),
                  pflWartet: localStorage.getItem('gs_sync_dirty_at_plants') ? 'ja' : 'nein' };
      pflanzenLesbar = true;
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await warte(1500);
      raus.s2 = { pflanzen: ids(cloud.user_plants.data.plants), lokal: ids(JSON.parse(localStorage.getItem('ps_myplants') || '[]')) };
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally {
      window.sbFetch = echt.fetch; window.sbIsLoggedIn = echt.login; window.fetch = echt.raw;
      if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0);
      if (tok0 == null) localStorage.removeItem('gs_sb_token');
    }
    return raus;
  });
  {
    const S = (o) => JSON.stringify(o);
    const ok = !h9.fehler && h9.startOk === false
      && h9.s1 && h9.s1.pflanzen === 'mp_c' && h9.s1.tagebuch === 1 && h9.s1.pflWartet === 'ja' && h9.s1.gaerten === 'g_c,g_neu'
      && h9.s2 && h9.s2.pflanzen === 'mp_c,mp_neu' && h9.s2.lokal === 'mp_c,mp_neu';
    melde('H9 · die Sperre gilt je Blob: der nicht gelesene Pflanzen-Blob wartet (die Cloud behaelt Pflanzen und Tagebuch), der gelesene Garten-Blob geht hoch — und nach dem naechsten Abgleich kommt die neue Pflanze dazu',
      ok,
      ok ? 'vor dem Lesen: Cloud-Pflanzen ' + h9.s1.pflanzen + ', Tagebuch ' + h9.s1.tagebuch + ', Gaerten ' + h9.s1.gaerten + ' · danach: ' + h9.s2.pflanzen
        : (h9.fehler ? 'Ausnahme: ' + h9.fehler : 'Start ok=' + h9.startOk + ' · 1,5 s nach dem Eintragen: ' + S(h9.s1) + ' (erwartet Pflanzen „mp_c“, Tagebuch 1, wartet „ja“, Gaerten „g_c,g_neu“) · nach dem Abgleich: ' + S(h9.s2)));
  }

  // ── Schlusspruefung blob (24.11.2026) · H10: offline geloescht bleibt geloescht ──
  // Seit H8 fuehrt der Abgleich Plaene und Tracks bei ungesendetem Stand JE EINTRAG zusammen. Ohne
  // Loeschmarke kaeme ein offline geloeschter Plan (und Track) damit aus der Cloud zurueck und ginge wieder
  // hoch — vor H8 gewann die ganze lokale Liste, das Loeschen hielt. Gemessen wird der ganze Weg mit den
  // ECHTEN Loesch-Funktionen: Geraet war abgeglichen, loescht ohne Empfang, ein anderes Geraet legt
  // inzwischen einen Plan und einen Track an, dann kommt das Netz zurueck.
  const h10 = await page.evaluate(async () => {
    const raus = {};
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const echt = { fetch: window.sbFetch, login: window.sbIsLoggedIn, raw: window.fetch, toast: window.showProfileToast, frage: window.gsConfirmModal, liste: window.gsTrackOpenList, plaene: window.gsPPopenSavedPlans, agent: window.gsAgentScheduleNotifications };
    const exp0 = localStorage.getItem('gs_sb_expires'), tok0 = localStorage.getItem('gs_sb_token');
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    const cloud = {};
    let netz = false;
    const nimm = (tab, body) => { try { cloud[tab] = { data: JSON.parse(body).data, updated_at: new Date().toISOString() }; } catch (_) {} };
    const aus = { data: null, error: { message: 'Failed to fetch', status: 0 }, status: 0 };
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      if (!netz) return aus;
      const tab = (String(pfad).match(TAB) || [])[1];
      if (tab && (m === 'POST' || m === 'PATCH')) { nimm(tab, opts.body); return { data: [{}], error: null, status: 200 }; }
      if (tab && m === 'GET') return cloud[tab] ? { data: [cloud[tab]], error: null, status: 200 } : { data: [], error: null, status: 200 };
      return { data: [], error: null, status: 200 };
    };
    window.fetch = async function (url, opts) {
      const tab = (String(url).match(TAB) || [])[1];
      if (tab && opts && opts.body) { if (!netz) throw new TypeError('Failed to fetch'); nimm(tab, opts.body); return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echt.raw.apply(this, arguments);
    };
    window.sbIsLoggedIn = () => true;
    window.showProfileToast = (x) => { raus.toast = (x && x.title) || String(x); };
    window.gsConfirmModal = async () => true;
    window.gsTrackOpenList = () => {};
    window.gsPPopenSavedPlans = () => {};
    window.gsAgentScheduleNotifications = async () => {};
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    if (!tok0) localStorage.setItem('gs_sb_token', 'x.y.z');
    const lies = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
    const ids = (a) => (a || []).map(x => x && x.id).sort().join(',');
    const tss = (a) => (a || []).map(x => x && x.ts).sort().join(',');
    const P = (id, tag) => ({ id: id, created: '2026-0' + tag + '-01T00:00:00.000Z', title: id, plan: { summary: id, plants: [] } });
    try {
      const stand = { gardens: [{ id: 'g_c', name: 'Hochbeet' }], plantings: [], plans: [P('plan-a', 5), P('plan-b', 6)], current: null,
                      gpx_tracks: [{ ts: 1767225600000, end: 1767229200000, points: [] }, { ts: 1767312000000, end: 1767315600000, points: [] }] };
      cloud.user_gardens = { data: JSON.parse(JSON.stringify(stand)), updated_at: '2026-11-01T08:00:00.000Z' };
      // Dieses Geraet: derselbe Stand, abgeglichen (nichts ungesendet).
      ['gs_sync_dirty', 'gs_sync_dirty_at_garden', 'gs_sync_dirty_at_state', 'gs_garden_plan_current', 'gs_geloescht'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('gs_sb_uid', 'nutzer-H10'); localStorage.setItem('gs_last_active_uid', 'nutzer-H10');
      localStorage.setItem('gs_gardens', JSON.stringify(stand.gardens)); localStorage.setItem('gs_plantings', '[]');
      localStorage.setItem('gs_garden_plans', JSON.stringify(stand.plans)); localStorage.setItem('gs_gpx_tracks', JSON.stringify(stand.gpx_tracks));
      localStorage.setItem('gs_sync_synced_at_garden', '2026-11-01T08:00:00.000Z'); localStorage.setItem('gs_sync_synced_at_state', '2026-11-01T08:00:00.000Z');
      gardens = stand.gardens.slice(); plantings = [];
      window._gsBlobGelesen = {}; window._gsInitialSyncDone = false;
      // Ohne Empfang: einen Plan und einen Track loeschen — mit den Funktionen, die die Knoepfe rufen.
      netz = false;
      await gsPPdeletePlan('plan-a');
      await gsTrackDelete(0);
      await warte(900);
      raus.l1 = { plaene: ids(lies('gs_garden_plans')), tracks: lies('gs_gpx_tracks').length, wartet: localStorage.getItem('gs_sync_dirty_at_garden') ? 'ja' : 'nein' };
      raus.c1 = { plaene: ids(cloud.user_gardens.data.plans), tracks: (cloud.user_gardens.data.gpx_tracks || []).length };
      // Inzwischen legt ein ANDERES Geraet einen Plan und einen Track an.
      cloud.user_gardens.data.plans.push(P('plan-c', 7));
      cloud.user_gardens.data.gpx_tracks.push({ ts: 1767398400000, end: 1767402000000, points: [] });
      cloud.user_gardens.updated_at = '2026-11-20T08:00:00.000Z';
      // Das Netz ist wieder da.
      netz = true;
      await gsSyncUserDataOnLogin();
      await warte(1500);
      raus.l2 = { plaene: ids(lies('gs_garden_plans')), tracks: tss(lies('gs_gpx_tracks')) };
      raus.c2 = { plaene: ids(cloud.user_gardens.data.plans), tracks: tss(cloud.user_gardens.data.gpx_tracks) };
      raus.marken = Object.keys((((cloud.user_app_state || {}).data || {}).geloescht || {})).sort().join(',');
      raus.wartet2 = localStorage.getItem('gs_sync_dirty_at_garden') ? 'ja' : 'nein';
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally {
      window.sbFetch = echt.fetch; window.sbIsLoggedIn = echt.login; window.fetch = echt.raw; window.showProfileToast = echt.toast;
      window.gsConfirmModal = echt.frage; window.gsTrackOpenList = echt.liste; window.gsPPopenSavedPlans = echt.plaene; window.gsAgentScheduleNotifications = echt.agent;
      if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0);
      if (tok0 == null) localStorage.removeItem('gs_sb_token');
    }
    return raus;
  });
  {
    const S = (o) => JSON.stringify(o);
    const T = '1767312000000,1767398400000';
    const ok1 = !h10.fehler && h10.l1 && h10.l1.plaene === 'plan-b' && h10.l1.tracks === 1 && h10.l1.wartet === 'ja' && h10.c1.plaene === 'plan-a,plan-b' && h10.c1.tracks === 2;
    const ok2 = ok1 && h10.l2.plaene === 'plan-b,plan-c' && h10.l2.tracks === T && h10.c2.plaene === 'plan-b,plan-c' && h10.c2.tracks === T
      && h10.marken.indexOf('gs_garden_plans') >= 0 && h10.marken.indexOf('gs_gpx_tracks') >= 0 && h10.wartet2 === 'nein';
    melde('H10 · offline geloescht bleibt geloescht: ein ohne Empfang geloeschter Plan und Track kommt beim naechsten Abgleich NICHT aus der Cloud zurueck, geht dort mit weg — und der Plan und der Track eines anderen Geraets kommen dazu',
      ok2,
      ok2 ? 'ohne Empfang: lokal ' + S(h10.l1) + ', Cloud noch ' + S(h10.c1) + ' · nach dem Abgleich: Geraet und Cloud ' + S(h10.c2) + ' · Loeschmarken im state-Blob: ' + h10.marken
        : h10.fehler ? 'Ausnahme: ' + h10.fehler
          : (!ok1 ? 'ohne Empfang — lokal: ' + S(h10.l1) + ' (erwartet plan-b, 1 Track, wartet ja) · Cloud: ' + S(h10.c1)
            : 'nach dem Abgleich — Geraet: ' + S(h10.l2) + ' · Cloud: ' + S(h10.c2) + ' (erwartet plan-b,plan-c und Tracks ' + T + ') · Marken: „' + h10.marken + '“ · wartet: ' + h10.wartet2));
  }

  // ── H11 · ein UNGESENDETER state auf einem Geraet, das nie abgeglichen hat, wird gemischt ──
  // Die Sperre „erst lesen" (H9) haelt den state-Blob zurueck, bis er gelesen ist. Beim Lesen wurde ein
  // ungesendeter Stand aber uebersprungen (lokal gewinnt ganz) und danach hochgeschoben: der EINE neue
  // Favorit eines frischen Geraets ersetzte die zwanzig der Cloud — nur eben nach dem Lesen. Zwei Richtungen:
  // (a) nie abgeglichen → zusammenfuehren; (b) schon abgeglichen → der lokale Stand bleibt eine Entscheidung
  // (ein entfernter Favorit kommt nicht zurueck).
  const h11 = await page.evaluate(async () => {
    const raus = {};
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const echt = { fetch: window.sbFetch, login: window.sbIsLoggedIn, raw: window.fetch, agent: window.gsAgentScheduleNotifications };
    const exp0 = localStorage.getItem('gs_sb_expires'), tok0 = localStorage.getItem('gs_sb_token');
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    const cloud = {};
    let stateLesbar = false;
    const nimm = (tab, body) => { try { cloud[tab] = { data: JSON.parse(body).data, updated_at: new Date().toISOString() }; } catch (_) {} };
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      const tab = (String(pfad).match(TAB) || [])[1];
      if (tab && (m === 'POST' || m === 'PATCH')) { nimm(tab, opts.body); return { data: [{}], error: null, status: 200 }; }
      if (tab && m === 'GET') {
        if (tab === 'user_app_state' && !stateLesbar) return { data: null, error: { message: 'Service Unavailable', status: 503 }, status: 503 };
        return cloud[tab] ? { data: [cloud[tab]], error: null, status: 200 } : { data: [], error: null, status: 200 };
      }
      return { data: [], error: null, status: 200 };
    };
    window.fetch = async function (url, opts) {
      const tab = (String(url).match(TAB) || [])[1];
      if (tab && opts && opts.body) { nimm(tab, opts.body); return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echt.raw.apply(this, arguments);
    };
    window.sbIsLoggedIn = () => true;
    window.gsAgentScheduleNotifications = async () => {};
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    if (!tok0) localStorage.setItem('gs_sb_token', 'x.y.z');
    const zwanzig = []; for (let i = 1; i <= 20; i++) zwanzig.push('cloud-' + i);
    const lies = (k, v) => { try { return JSON.parse(localStorage.getItem(k) || v); } catch (_) { return JSON.parse(v); } };
    const STATE = ['ps_favs', 'ps_votes', 'gs_recipe_favs', 'gs_achievements', 'gs_reminder_prefs', 'gs_sync_dirty', 'gs_sync_dirty_at_state', 'gs_sync_synced_at_state'];
    const cloudStand = () => ({ data: { favs: zwanzig.slice(), votes: { 'idee-1': 1, 'idee-2': -1 }, recipe_favs: ['r1', 'r2'], reminder_prefs: { disabled: { p9: true } } }, updated_at: '2026-11-01T08:00:00.000Z' });
    try {
      // (a) frisches Geraet: der Start-Abgleich scheitert am state-Blob, dann EIN neuer Favorit und eine Stimme.
      cloud.user_app_state = cloudStand();
      STATE.forEach(k => localStorage.removeItem(k));
      localStorage.setItem('gs_sb_uid', 'nutzer-H11'); localStorage.setItem('gs_last_active_uid', 'nutzer-H11');
      favs = []; myVotes = {};
      window._gsBlobGelesen = {}; window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      raus.a_start = !!window._gsInitialSyncDone;
      favs = ['lokal-neu']; localStorage.setItem('ps_favs', JSON.stringify(favs));
      localStorage.setItem('ps_votes', JSON.stringify({ 'idee-2': 1, 'idee-3': 1 }));
      gsCloudSync.markDirty('state');
      await warte(1500);
      raus.a_c1 = (cloud.user_app_state.data.favs || []).length;         // vor dem Lesen: die Cloud unveraendert
      stateLesbar = true;
      window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await warte(1500);
      const cf = cloud.user_app_state.data.favs || [], lf = lies('ps_favs', '[]');
      raus.a_cloud = { zahl: cf.length, neu: cf.indexOf('lokal-neu') >= 0, alle20: zwanzig.every(x => cf.indexOf(x) >= 0) };
      raus.a_lokal = { zahl: lf.length, neu: lf.indexOf('lokal-neu') >= 0, spiegel: (typeof favs !== 'undefined' && Array.isArray(favs)) ? favs.length : -1 };
      raus.a_votes = JSON.stringify(cloud.user_app_state.data.votes || {});       // lokal gewinnt bei idee-2, idee-1 kommt dazu, idee-3 bleibt
      raus.a_rezepte = (cloud.user_app_state.data.recipe_favs || []).length;      // lokal nichts → der Cloud-Stand
      raus.a_erinnerung = JSON.stringify(cloud.user_app_state.data.reminder_prefs || {});
      raus.a_wartet = localStorage.getItem('gs_sync_dirty_at_state') ? 'ja' : 'nein';
      // (b) ein Geraet, das abgeglichen WAR: es entfernt einen Favoriten ohne Empfang — der kommt nicht zurueck.
      cloud.user_app_state = cloudStand();
      STATE.forEach(k => localStorage.removeItem(k));
      const neunzehn = zwanzig.slice(1);
      favs = neunzehn.slice(); localStorage.setItem('ps_favs', JSON.stringify(favs));
      localStorage.setItem('gs_sync_synced_at_state', '2026-11-01T08:00:00.000Z');
      gsCloudSync.markDirty('state');
      window._gsBlobGelesen = {}; window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await warte(1500);
      const cb = cloud.user_app_state.data.favs || [];
      raus.b_cloud = { zahl: cb.length, entfernt_zurueck: cb.indexOf('cloud-1') >= 0 };
      raus.b_lokal = lies('ps_favs', '[]').length;
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally {
      window.sbFetch = echt.fetch; window.sbIsLoggedIn = echt.login; window.fetch = echt.raw; window.gsAgentScheduleNotifications = echt.agent;
      if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0);
      if (tok0 == null) localStorage.removeItem('gs_sb_token');
    }
    return raus;
  });
  {
    const S = (o) => JSON.stringify(o);
    const okA = !h11.fehler && h11.a_start === false && h11.a_c1 === 20
      && h11.a_cloud && h11.a_cloud.zahl === 21 && h11.a_cloud.neu && h11.a_cloud.alle20
      && h11.a_lokal.zahl === 21 && h11.a_lokal.neu && h11.a_lokal.spiegel === 21
      && h11.a_votes === S({ 'idee-2': 1, 'idee-3': 1, 'idee-1': 1 }) && h11.a_rezepte === 2
      && h11.a_erinnerung === S({ disabled: { p9: true } }) && h11.a_wartet === 'nein';
    const okB = okA && h11.b_cloud && h11.b_cloud.zahl === 19 && !h11.b_cloud.entfernt_zurueck && h11.b_lokal === 19;
    melde('H11 · state wird gemischt, wenn das Geraet ihn nie abgeglichen hat: der eine neue Favorit eines frischen Geraets kommt zu den zwanzig der Cloud (21, auch im Arbeitsspeicher), Stimmen und Erinnerungen bleiben — und auf einem abgeglichenen Geraet kommt ein entfernter Favorit NICHT zurueck',
      okB,
      okB ? 'frisch: Cloud ' + h11.a_cloud.zahl + ' Favoriten (vor dem Lesen 20, unberuehrt), Stimmen ' + h11.a_votes + ' · abgeglichen: Cloud ' + h11.b_cloud.zahl + ', der entfernte bleibt weg'
        : h11.fehler ? 'Ausnahme: ' + h11.fehler
          : (!okA ? 'frisches Geraet — Start ok=' + h11.a_start + ' · Cloud vor dem Lesen: ' + h11.a_c1 + ' · danach Cloud: ' + S(h11.a_cloud) + ' · Geraet: ' + S(h11.a_lokal) + ' · Stimmen: ' + h11.a_votes + ' · Rezepte: ' + h11.a_rezepte + ' · Erinnerung: ' + h11.a_erinnerung + ' · wartet: ' + h11.a_wartet + ' (erwartet 21 Favoriten mit allen zwanzig der Cloud)'
            : 'abgeglichenes Geraet — Cloud: ' + S(h11.b_cloud) + ' · lokal: ' + h11.b_lokal + ' (erwartet 19, der entfernte Favorit bleibt weg)'));
  }

  // ── H12 · ein UNGELESENES Profil ist kein Cloud-Stand ──
  // Start ohne Empfang: sbLoadProfile legt ein Ersatzprofil mit xp 0 an (`_ungelesen`). gsXpBootSync nahm die
  // 0 als Cloud-Stand, hielt die ganze lokale XP fuer „offline verdient" und buchte sie per fn_add_xp noch
  // einmal — die Rangliste zeigte danach das Doppelte. Und das Profil blieb die ganze Sitzung ungelesen.
  const h12Lauf = (plus) => page.evaluate(async (PLUS) => {
    const raus = { rpc: [] };
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const echt = { fetch: window.sbFetch, login: window.sbIsLoggedIn, raw: window.fetch, agent: window.gsAgentScheduleNotifications, streak: window.checkAndUpdateStreak };
    const exp0 = localStorage.getItem('gs_sb_expires'), tok0 = localStorage.getItem('gs_sb_token');
    let netz = false;
    const profil = { id: 'nutzer-H12', display_name: 'Pruefperson', xp: 1200, level: 5, login_streak: 3 };
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase(); const p = String(pfad);
      if (!netz) return { data: null, error: { message: 'Failed to fetch', status: 0 }, status: 0 };
      if (/\/rpc\/fn_add_xp/.test(p)) { let n = null; try { const bd = JSON.parse(opts.body || '{}'); n = bd.p_amount != null ? bd.p_amount : (bd.amount != null ? bd.amount : bd); } catch (_) {} raus.rpc.push(n); profil.xp += (Number(n) || 0); return { data: [{ xp: profil.xp, level: profil.level }], error: null, status: 200 }; }
      if (/\/rest\/v1\/profiles/.test(p) && m === 'GET') return { data: [profil], error: null, status: 200 };
      return { data: [], error: null, status: 200 };
    };
    window.fetch = async function (url, opts) {
      if (/\/rpc\/fn_add_xp/.test(String(url))) { raus.rpc.push('roh'); return new Response('1200', { status: 200 }); }
      if (/\/rest\/v1\/(user_plants|user_gardens|user_app_state)/.test(String(url)) && opts && opts.body) return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } });
      return echt.raw.apply(this, arguments);
    };
    window.sbIsLoggedIn = () => true;
    window.gsAgentScheduleNotifications = async () => {};
    window.checkAndUpdateStreak = async () => {};
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    if (!tok0) localStorage.setItem('gs_sb_token', 'x.y.z');
    const xp0 = localStorage.getItem('gs_xp');
    try {
      localStorage.setItem('gs_sb_uid', 'nutzer-H12'); localStorage.setItem('gs_last_active_uid', 'nutzer-H12');
      ['gs_sync_dirty', 'gs_sync_dirty_at_state', 'gs_sync_dirty_at_garden', 'gs_sync_dirty_at_plants'].forEach(k => localStorage.removeItem(k));
      gsStore.set('gs_xp', '1200');
      window._gsXpPending = 0; _sbProfile = null;
      // Start ohne Empfang.
      netz = false;
      const p1 = await sbLoadProfile();
      raus.ungelesen = !!(p1 && p1._ungelesen);
      await gsXpBootSync();
      raus.vorgemerkt = window._gsXpPending || 0;
      // Scheibe 1: im Offline-Fenster 10 XP verdient — der Flush scheitert und legt die 10 in den Puffer
      // zurueck; die lokale XP enthaelt sie schon. Nach dem Nachlesen darf GENAU 10 gebucht werden.
      const altToast = window.showProfileToast; window.showProfileToast = () => {};
      try { gsAddXP(10, ''); await gsXpCloudFlush(); } finally { window.showProfileToast = altToast; }
      raus.puffer = window._gsXpPending || 0;
      // Inzwischen verdient ein ZWEITES Geraet PLUS XP (die Cloud steigt, dieses Geraet weiss es nicht).
      profil.xp += PLUS;
      // Der Empfang kommt zurueck: der naechste Abgleich holt das Profil nach.
      netz = true;
      window._gsBlobGelesen = {}; window._gsInitialSyncDone = false;
      await gsSyncUserDataOnLogin();
      await warte(1200);
      if (window._gsXpPending) { await gsXpCloudFlush(); await warte(100); }   // ein noch offener Rest geht mit dem naechsten Flush
      raus.gelesen = !!(_sbProfile && !_sbProfile._ungelesen);
      raus.cloudXp = profil.xp;
      raus.vorgemerkt2 = window._gsXpPending || 0;
      raus.lokal = gsGetXP();
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally {
      window.sbFetch = echt.fetch; window.sbIsLoggedIn = echt.login; window.fetch = echt.raw; window.gsAgentScheduleNotifications = echt.agent; window.checkAndUpdateStreak = echt.streak;
      window._gsXpPending = 0; _sbProfile = null;
      if (xp0 == null) localStorage.removeItem('gs_xp'); else localStorage.setItem('gs_xp', xp0);
      if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0);
      if (tok0 == null) localStorage.removeItem('gs_sb_token');
    }
    return raus;
  }, plus);
  {
    // Drei Lagen: allein (0) · das andere Geraet verdient WENIGER als dieses offline (+5: Cloud liegt zwischen
    // altem Stand und lokal — `Puffer = lokal − Cloud` buchte hier nur 5 und verlor 5) · es verdient MEHR (+50).
    // Erwartet ist immer: alles Verdiente steht in der Cloud, genau einmal — 1200 + PLUS + 10.
    const lagen = [];
    for (const plus of [0, 5, 50]) { const r12 = await h12Lauf(plus); r12.plus = plus; lagen.push(r12); }
    const gut = (x) => !x.fehler && x.ungelesen === true && x.vorgemerkt === 0 && x.puffer === 10 && x.gelesen === true && x.vorgemerkt2 === 0
      && x.rpc.reduce((a, n) => a + (Number(n) || 0), 0) === 10 && x.cloudXp === 1210 + x.plus && x.lokal === 1210 + x.plus;
    const ok = lagen.every(gut);
    const zeile = (x) => '+' + x.plus + ': gebucht ' + JSON.stringify(x.rpc) + ', Cloud ' + x.cloudXp + ', lokal ' + x.lokal + (x.fehler ? ' AUSNAHME ' + x.fehler : '');
    melde('H12 · ein ungelesenes Profil ist kein Cloud-Stand: nach einem Start ohne Empfang wird die lokale XP NICHT noch einmal gebucht, der naechste gelungene Abgleich liest das Profil nach — und 10 XP aus dem Offline-Fenster kommen genau einmal an, auch wenn ein zweites Geraet die Cloud inzwischen um 5 oder 50 erhoeht hat',
      ok,
      ok ? lagen.map(zeile).join(' · ')
        : 'erwartet je Lage: gebucht Summe 10, Cloud = lokal = 1210 + PLUS — gemessen ' + lagen.map(x => zeile(x) + ' [ungelesen=' + x.ungelesen + ', vorgemerkt ' + x.vorgemerkt + ', Puffer ' + x.puffer + ', gelesen=' + x.gelesen + ', Rest ' + x.vorgemerkt2 + ']').join(' · '));
  }

  // ── SPEICHER-V2 Scheibe 1 · H13: ein aufgezeichneter Track bleibt ──
  // _gsTrackSaveTrack schrieb gs_gpx_tracks, ohne den Garten-Bereich vorzumerken. Der naechste Abgleich
  // hielt die Cloud deshalb fuer massgeblich und ersetzte die Track-Liste durch ihre — die eben
  // aufgezeichnete Wanderung war weg, sobald das Konto schon eine Zeile in user_gardens hatte.
  const h13 = await page.evaluate(async () => {
    const raus = {};
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const echt = { fetch: window.sbFetch, login: window.sbIsLoggedIn, raw: window.fetch, toast: window.showProfileToast, agent: window.gsAgentScheduleNotifications };
    const exp0 = localStorage.getItem('gs_sb_expires'), tok0 = localStorage.getItem('gs_sb_token');
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    const cloud = {};
    const nimm = (tab, body) => { try { cloud[tab] = { data: JSON.parse(body).data, updated_at: new Date().toISOString() }; } catch (_) {} };
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      const tab = (String(pfad).match(TAB) || [])[1];
      if (tab && (m === 'POST' || m === 'PATCH')) { nimm(tab, opts.body); return { data: [{}], error: null, status: 200 }; }
      if (tab && m === 'GET') return cloud[tab] ? { data: [cloud[tab]], error: null, status: 200 } : { data: [], error: null, status: 200 };
      return { data: [], error: null, status: 200 };
    };
    window.fetch = async function (url, opts) {
      const tab = (String(url).match(TAB) || [])[1];
      if (tab && opts && opts.body) { nimm(tab, opts.body); return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echt.raw.apply(this, arguments);
    };
    window.sbIsLoggedIn = () => true;
    window.showProfileToast = () => {};
    window.gsAgentScheduleNotifications = async () => {};
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    if (!tok0) localStorage.setItem('gs_sb_token', 'x.y.z');
    const lies = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
    const tss = (a) => (a || []).map(x => x && x.ts).sort().join(',');
    try {
      const alt = { ts: 1767225600000, end: 1767229200000, points: [] };
      const stand = { gardens: [{ id: 'g_c', name: 'Hochbeet' }], plantings: [], plans: [], current: null, gpx_tracks: [alt] };
      cloud.user_gardens = { data: JSON.parse(JSON.stringify(stand)), updated_at: '2026-11-01T08:00:00.000Z' };
      ['gs_sync_dirty', 'gs_sync_dirty_at_garden', 'gs_sync_dirty_at_state', 'gs_garden_plan_current', 'gs_geloescht', 'gs_garden_plans'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('gs_sb_uid', 'nutzer-H13'); localStorage.setItem('gs_last_active_uid', 'nutzer-H13');
      localStorage.setItem('gs_gardens', JSON.stringify(stand.gardens)); localStorage.setItem('gs_plantings', '[]');
      localStorage.setItem('gs_gpx_tracks', JSON.stringify(stand.gpx_tracks));
      localStorage.setItem('gs_sync_synced_at_garden', '2026-11-01T08:00:00.000Z'); localStorage.setItem('gs_sync_synced_at_state', '2026-11-01T08:00:00.000Z');
      gardens = stand.gardens.slice(); plantings = [];
      window._gsBlobGelesen = {}; window._gsInitialSyncDone = false;
      // Eine Wanderung, gespeichert ueber die EINE Stelle, durch die jeder fertige Track geht.
      const T0 = 1767484800000;
      const punkte = []; for (let i = 0; i < 6; i++) punkte.push({ ll: [47.37 + i * 0.001, 8.54 + i * 0.001], alt: 400 + i, t: T0 + i * 60000 });
      raus.idx = _gsTrackSaveTrack({ ts: T0, end: T0 + 300000, points: punkte });
      raus.l1 = tss(lies('gs_gpx_tracks'));
      raus.vorgemerkt = localStorage.getItem('gs_sync_dirty_at_garden') ? 'ja' : 'nein';
      // Der naechste Abgleich (alle 2 Minuten und bei jedem Fokus).
      await gsSyncUserDataOnLogin();
      await warte(1500);
      raus.l2 = tss(lies('gs_gpx_tracks'));
      raus.c2 = tss((cloud.user_gardens.data || {}).gpx_tracks);
      raus.neu = String(T0);
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally {
      window.sbFetch = echt.fetch; window.sbIsLoggedIn = echt.login; window.fetch = echt.raw; window.showProfileToast = echt.toast; window.gsAgentScheduleNotifications = echt.agent;
      if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0);
      if (tok0 == null) localStorage.removeItem('gs_sb_token');
    }
    return raus;
  });
  {
    const beide = '1767225600000,1767484800000';
    const ok = !h13.fehler && h13.idx >= 0 && h13.l1 === beide && h13.l2 === beide && h13.c2 === beide;
    melde('H13 · ein aufgezeichneter Track bleibt: nach dem Speichern ueber _gsTrackSaveTrack steht er nach dem naechsten Abgleich noch auf dem Geraet UND in der Cloud (vorher ersetzte die Cloud-Liste die lokale)',
      ok,
      ok ? 'gespeichert, vorgemerkt: ' + h13.vorgemerkt + ' · nach dem Abgleich: Geraet und Cloud je 2 Tracks'
        : h13.fehler ? 'Ausnahme: ' + h13.fehler
          : 'Index ' + h13.idx + ' · nach dem Speichern lokal: ' + h13.l1 + ' · vorgemerkt: ' + h13.vorgemerkt + ' · nach dem Abgleich lokal: „' + h13.l2 + '“ · Cloud: „' + h13.c2 + '“ (erwartet beide: ' + beide + ')');
  }

  // ── SPEICHER-V2 Scheibe 1 · H14: Loeschmarken, zweite Runde (Lese-Pruefung des Koordinators an v33.69) ──
  // (a) im SAUBEREN Zweig uebernahm der Abgleich die Plan- und Track-Liste der Cloud ohne Blick auf die Marken;
  // (b) eine Marke eines anderen Geraets entfernte nie einen LOKALEN Track (er ging mit dem naechsten Push zurueck);
  // (d) ein gp_-Plan bekam die Marke vor dem Server-DELETE — scheiterte es, war er 90 Tage ausgeblendet;
  // (e) Wiederherstellen nahm keine Marke zurueck · Track-Loeschen ging nach Stelle · Objekte wurden flach gemischt.
  const h14 = await page.evaluate(async () => {
    const raus = {};
    const warte = (ms) => new Promise(r2 => setTimeout(r2, ms));
    const echt = { fetch: window.sbFetch, login: window.sbIsLoggedIn, raw: window.fetch, toast: window.showProfileToast, frage: window.gsConfirmModal, liste: window.gsTrackOpenList, plaene: window.gsPPopenSavedPlans, agent: window.gsAgentScheduleNotifications };
    const exp0 = localStorage.getItem('gs_sb_expires'), tok0 = localStorage.getItem('gs_sb_token');
    const TAB = /\/rest\/v1\/(user_plants|user_gardens|user_app_state)/;
    let cloud = {}, loeschenGeht = true;
    const nimm = (tab, body) => { try { cloud[tab] = { data: JSON.parse(body).data, updated_at: new Date().toISOString() }; } catch (_) {} };
    window.sbFetch = async function (pfad, opts) {
      opts = opts || {}; const m = (opts.method || 'GET').toUpperCase();
      const tab = (String(pfad).match(TAB) || [])[1];
      if (m === 'DELETE') return loeschenGeht ? { data: [{}], error: null, status: 200 } : { data: null, error: { message: 'Service Unavailable', status: 503 }, status: 503 };
      if (tab && (m === 'POST' || m === 'PATCH')) { nimm(tab, opts.body); return { data: [{}], error: null, status: 200 }; }
      if (tab && m === 'GET') return cloud[tab] ? { data: [cloud[tab]], error: null, status: 200 } : { data: [], error: null, status: 200 };
      return { data: [], error: null, status: 200 };
    };
    window.fetch = async function (url, opts) {
      const tab = (String(url).match(TAB) || [])[1];
      if (tab && opts && opts.body) { nimm(tab, opts.body); return new Response('[{}]', { status: 200, headers: { 'Content-Type': 'application/json' } }); }
      return echt.raw.apply(this, arguments);
    };
    window.sbIsLoggedIn = () => true;
    window.showProfileToast = () => {};
    window.gsConfirmModal = async () => true;
    window.gsTrackOpenList = () => {};
    window.gsPPopenSavedPlans = () => {};
    window.gsAgentScheduleNotifications = async () => {};
    localStorage.setItem('gs_sb_expires', String(Date.now() + 3600e3));
    if (!tok0) localStorage.setItem('gs_sb_token', 'x.y.z');
    const lies = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
    const ids = (a) => (a || []).map(x => x && x.id).sort().join(',');
    const tss = (a) => (a || []).map(x => x && x.ts).sort().join(',');
    const P = (id, tag) => ({ id: id, created: '2026-0' + tag + '-01T00:00:00.000Z', title: id, plan: { summary: id, plants: [] } });
    const T1 = 1767225600000, T2 = 1767312000000, T3 = 1767398400000;
    const TR = (ts) => ({ ts: ts, end: ts + 3600000, points: [] });
    const stelle = (lokal, wolke, marken, schmutzig) => {
      ['gs_sync_dirty', 'gs_sync_dirty_at_garden', 'gs_sync_dirty_at_state', 'gs_sync_dirty_at_plants', 'gs_garden_plan_current', 'gs_geloescht'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('gs_sb_uid', 'nutzer-H14'); localStorage.setItem('gs_last_active_uid', 'nutzer-H14');
      localStorage.setItem('gs_gardens', JSON.stringify([{ id: 'g_c', name: 'Hochbeet' }])); localStorage.setItem('gs_plantings', '[]');
      localStorage.setItem('gs_garden_plans', JSON.stringify(lokal.plans)); localStorage.setItem('gs_gpx_tracks', JSON.stringify(lokal.tracks));
      localStorage.setItem('gs_sync_synced_at_garden', '2026-11-01T08:00:00.000Z'); localStorage.setItem('gs_sync_synced_at_state', '2026-11-01T08:00:00.000Z');
      if (marken.lokal) localStorage.setItem('gs_geloescht', JSON.stringify(marken.lokal));
      gardens = [{ id: 'g_c', name: 'Hochbeet' }]; plantings = [];
      cloud = { user_gardens: { data: { gardens: [{ id: 'g_c', name: 'Hochbeet' }], plantings: [], plans: wolke.plans, current: null, gpx_tracks: wolke.tracks }, updated_at: '2026-11-20T08:00:00.000Z' } };
      if (marken.wolke) cloud.user_app_state = { data: { geloescht: marken.wolke }, updated_at: '2026-11-20T08:00:00.000Z' };
      window._gsBlobGelesen = {}; window._gsInitialSyncDone = false;
      if (schmutzig) gsCloudSync.markDirty('garden');
    };
    try {
      const jetzt = Date.now();
      const M = { gs_garden_plans: { 'plan-a': jetzt }, gs_gpx_tracks: {} }; M.gs_gpx_tracks[String(T1)] = jetzt;
      // (a) SAUBER: nichts ungesendet, die Marken liegen auf diesem Geraet, die Cloud traegt Plan und Track noch.
      stelle({ plans: [P('plan-b', 6)], tracks: [TR(T2)] }, { plans: [P('plan-a', 5), P('plan-b', 6)], tracks: [TR(T1), TR(T2)] }, { lokal: M }, false);
      await gsSyncUserDataOnLogin(); await warte(1500);
      raus.a = { lokal: ids(lies('gs_garden_plans')) + ' | ' + tss(lies('gs_gpx_tracks')), cloud: ids(cloud.user_gardens.data.plans) + ' | ' + tss(cloud.user_gardens.data.gpx_tracks) };
      // (b) UNGESENDET auf einem Geraet, das Plan und Track noch HAT; die Marken kommen aus der Cloud (anderes Geraet hat geloescht).
      stelle({ plans: [P('plan-a', 5), P('plan-b', 6), P('plan-lokal', 7)], tracks: [TR(T1), TR(T2), TR(T3)] }, { plans: [P('plan-b', 6)], tracks: [TR(T2)] }, { wolke: M }, true);
      await gsSyncUserDataOnLogin(); await warte(1500);
      raus.b = { lokal: ids(lies('gs_garden_plans')) + ' | ' + tss(lies('gs_gpx_tracks')), cloud: ids(cloud.user_gardens.data.plans) + ' | ' + tss(cloud.user_gardens.data.gpx_tracks) };
      // (d) gp_-Plan: das Server-DELETE scheitert — keine Marke (er muss sichtbar bleiben, damit man es erneut versuchen kann).
      stelle({ plans: [], tracks: [] }, { plans: [], tracks: [] }, {}, false);
      loeschenGeht = false;
      await gsPPdeletePlan('gp_11111111-1111-4111-8111-111111111111');
      loeschenGeht = true;
      raus.d = Object.keys((JSON.parse(localStorage.getItem('gs_geloescht') || '{}').gs_garden_plans) || {}).join(',');
      // (e3) Wiederherstellen nimmt die Marke zurueck.
      stelle({ plans: [], tracks: [] }, { plans: [], tracks: [] }, { lokal: M }, false);
      _gsRestoreKey('gs_garden_plans', [P('plan-a', 5)]); _gsRestoreKey('gs_gpx_tracks', [TR(T1)]);
      const g3 = JSON.parse(localStorage.getItem('gs_geloescht') || '{}');
      raus.e3 = { marken: Object.keys(g3.gs_garden_plans || {}).length + Object.keys(g3.gs_gpx_tracks || {}).length, plaene: ids(lies('gs_garden_plans')), tracks: tss(lies('gs_gpx_tracks')) };
      // (e4) Track loeschen: waehrend die Rueckfrage offen ist, ersetzt ein Abgleich die Liste (ein Track kommt VORN dazu).
      stelle({ plans: [], tracks: [TR(T2), TR(T3)] }, { plans: [], tracks: [] }, {}, false);
      window.gsConfirmModal = async () => { localStorage.setItem('gs_gpx_tracks', JSON.stringify([TR(T1), TR(T2), TR(T3)])); return true; };
      await gsTrackDelete(0);   // gemeint: T2 (Stelle 0 VOR der Rueckfrage)
      window.gsConfirmModal = async () => true;
      raus.e4 = tss(lies('gs_gpx_tracks'));
      // (e2) Objekte eine Ebene tiefer mischen.
      localStorage.setItem('gs_reminder_prefs', JSON.stringify({ disabled: { p1: true }, lokal: 1 }));
      raus.e2 = JSON.stringify(_gsStateMischen('gs_reminder_prefs', { disabled: { p9: true, p1: false }, neu: 2 }));
      localStorage.removeItem('gs_reminder_prefs');
      raus.T = [T1, T2, T3];
    } catch (e) { raus.fehler = String(e && e.stack || e).split('\n').slice(0, 3).join(' | '); }
    finally {
      window.sbFetch = echt.fetch; window.sbIsLoggedIn = echt.login; window.fetch = echt.raw; window.showProfileToast = echt.toast;
      window.gsConfirmModal = echt.frage; window.gsTrackOpenList = echt.liste; window.gsPPopenSavedPlans = echt.plaene; window.gsAgentScheduleNotifications = echt.agent;
      ['gs_geloescht', 'gs_sync_dirty', 'gs_sync_dirty_at_garden', 'gs_sync_dirty_at_state'].forEach(k => localStorage.removeItem(k));
      if (exp0 == null) localStorage.removeItem('gs_sb_expires'); else localStorage.setItem('gs_sb_expires', exp0);
      if (tok0 == null) localStorage.removeItem('gs_sb_token');
    }
    return raus;
  });
  {
    const S = (o) => JSON.stringify(o);
    const [T1, T2, T3] = h14.T || [0, 0, 0];
    const f = [];
    if (h14.fehler) f.push('Ausnahme: ' + h14.fehler);
    else {
      const a = 'plan-b | ' + T2;
      if (!h14.a || h14.a.lokal !== a || h14.a.cloud !== a) f.push('(a) sauberer Zweig: erwartet Geraet und Cloud „' + a + '“, gemessen ' + S(h14.a));
      const bSoll = 'plan-b,plan-lokal | ' + T2 + ',' + T3;
      if (!h14.b || h14.b.lokal !== bSoll || h14.b.cloud !== bSoll) f.push('(b) Marke eines anderen Geraets gegen lokale Eintraege: erwartet „' + bSoll + '“, gemessen ' + S(h14.b));
      if (h14.d !== '') f.push('(d) gp_-Plan: nach gescheitertem Server-DELETE steht eine Loeschmarke (' + h14.d + ') — der Plan waere 90 Tage ausgeblendet');
      if (!h14.e3 || h14.e3.marken !== 0 || h14.e3.plaene !== 'plan-a' || h14.e3.tracks !== String(T1)) f.push('(e3) Wiederherstellen: erwartet 0 Marken, plan-a und Track da — gemessen ' + S(h14.e3));
      if (h14.e4 !== T1 + ',' + T3) f.push('(e4) Track loeschen nach der Rueckfrage: erwartet „' + T1 + ',' + T3 + '“ (der gemeinte ' + T2 + ' ist weg), gemessen „' + h14.e4 + '“');
      if (h14.e2 !== S({ disabled: { p1: true, p9: true }, lokal: 1, neu: 2 })) f.push('(e2) verschachtelt mischen: gemessen ' + h14.e2);
    }
    melde('H14 · Loeschmarken gelten ueberall: im sauberen Zweig (Plan und Track kommen nicht aus der Cloud zurueck, die Cloud wird nachgezogen), gegen LOKALE Eintraege (was ein anderes Geraet loeschte, geht auch hier), nicht fuer gp_-Plaene, nicht nach einer Wiederherstellung — und ein Track wird nach seinem Beginn geloescht, nicht nach seiner Stelle',
      f.length === 0,
      f.length === 0 ? 'sauber: ' + S(h14.a) + ' · fremde Marke: ' + S(h14.b) + ' · gp_: keine Marke · Wiederherstellung nimmt die Marke zurueck · Track nach ts · Objekte tief gemischt'
        : f.join(' · '));
  }

  await b.close();

  // ── Bericht ────────────────────────────────────────────────────────────
  // ── SPEICHER-V2 Scheibe 1 · die Gegenrichtung: kein Rueckweg ohne Hinweg ──
  // BLOB_KEYS liest die Schluessel aus den drei Blob-BAUERN (Hinweg) — ein Schluessel, der nur im
  // RUECKWEG (stateMap) steht, fiel deshalb nie auf: gs_geraete und gs_geraete_regeln kommen seit v32.48
  // aus der Cloud zurueck, wurden aber nie hochgeladen, und zwei Dokumente behaupteten, sie reisten.
  // Gelesen wird die stateMap aus dem Quelltext; was bewusst (noch) nicht reist, steht mit Grund hier.
  {
    const OHNE_HINWEG = {
      gs_geraete: 'reist noch nicht: als ganze Liste im state-Blob wuerde ein Geraet die Geraete des anderen ersetzen (jedes legt z. B. sein eigenes Wetter-Geraet an) — braucht die Regel je Eintrag aus SPEICHER-V2 Scheibe 4',
      gs_geraete_regeln: 'wie gs_geraete — Regeln gehoeren zu Geraeten und reisen mit ihnen',
    };
    const i0 = QUELLE.indexOf('var stateMap = {');
    const i1 = i0 < 0 ? -1 : QUELLE.indexOf('// Wichtig: temporär den setItem-Patch umgehen', i0);
    const stueck = (i0 >= 0 && i1 > i0) ? QUELLE.slice(i0, i1) : '';
    // Gelesen wird OHNE Zeilenanker: die stateMap schreibt mehrere Schluessel in eine Zeile ('ps_favs': …,
    // 'ps_votes': …) — mit Anker am Zeilenanfang sah der Fall nur den ersten je Zeile (26 von 32, Gegenpruefung).
    const ohneKommentar = (x) => x.split('\n').filter(z => !/^\s*\/\//.test(z)).join('\n');
    const lies = (x) => { x = ohneKommentar(x); return Array.from(new Set(
      [...x.matchAll(/'((?:gs|ps)_[A-Za-z0-9_]+)'\s*:/g)].map(m => m[1])
        .concat([...x.matchAll(/stateMap\['([A-Za-z0-9_]+)'\]\s*=/g)].map(m => m[1])))); };
    const pruefe = (keys) => { const o = keys.filter(k => BLOB_KEYS.indexOf(k) < 0); return { ohne: o, unerklaert: o.filter(k => !Object.prototype.hasOwnProperty.call(OHNE_HINWEG, k)) }; };
    const rueck = lies(stueck);
    const { ohne, unerklaert } = pruefe(rueck);
    const ueberholt = Object.keys(OHNE_HINWEG).filter(k => ohne.indexOf(k) < 0);
    // Gegenprobe DURCH den Parser: ein erfundener Schluessel, mitten in eine bestehende Zeile der stateMap
    // gesetzt, MUSS als „kommt zurueck, wird nie hochgeladen" auffallen.
    const mitErfundenem = stueck.replace("'ps_favs': sd.favs,", "'ps_favs': sd.favs, 'gs_erfunden_nur_rueckweg': sd.x,");
    const probe = mitErfundenem !== stueck && pruefe(lies(mitErfundenem)).unerklaert.join() === 'gs_erfunden_nur_rueckweg';
    const ok = rueck.length >= 30 && unerklaert.length === 0 && ueberholt.length === 0 && probe;
    melde('Kein Rueckweg ohne Hinweg: jeder Schluessel, den der Abgleich aus dem state-Blob zurueckschreibt, wird auch hochgeladen — oder steht mit Grund als „reist noch nicht" da',
      ok,
      ok ? rueck.length + ' Schluessel im Rueckweg · ' + ohne.length + ' ohne Hinweg, beide mit Grund (' + ohne.join(', ') + ')'
        : rueck.length < 30 ? 'die stateMap wurde im Quelltext nicht (ganz) gefunden (' + rueck.length + ' Schluessel, erwartet mindestens 30) — der Fall misst nichts'
          : unerklaert.length ? 'kommt zurueck, wird aber nie hochgeladen: ' + unerklaert.join(', ')
            : ueberholt.length ? 'als „reist noch nicht" gefuehrt, hat aber inzwischen einen Hinweg — Eintrag streichen: ' + ueberholt.join(', ')
              : 'die Gegenprobe (erfundener Schluessel) fiel nicht auf');
  }

  const dreiTabellen = r.tabellen.length === 3;
  melde('Alle drei Blobs gehen überhaupt hinaus', dreiTabellen,
    dreiTabellen ? r.tabellen.join(' · ')
      : 'nur ' + (r.tabellen.join(', ') || 'gar nichts') + ' — dann prüft der Rest nichts');

  const rund = dreiTabellen && r.fehlt.length === 0 && r.anders.length === 0;
  melde('Jedes Feld der drei Blobs kommt nach dem Pull zurück', rund,
    rund ? r.keys + ' Schlüssel, alle unverändert zurück'
      : (r.fehlt.length ? 'kommt NICHT zurück: ' + r.fehlt.join(', ') : '')
        + (r.anders.length ? (r.fehlt.length ? ' · ' : '') + 'verändert zurück: ' + r.anders.join(', ') : ''));

  const gOk = !!(r.gegen && r.gegen.weg);
  melde('Gegenprobe: ein Feld, das der Rückweg nicht kennt, wird gemeldet', gOk,
    gOk ? 'Feld umbenannt → gs_recipe_favs kam nicht zurück, wie es muss'
      : 'das umbenannte Feld kam trotzdem zurück — dann misst Frage 2 nicht, was sie behauptet'
        + (r.gegen && r.gegen.fehler ? ' (' + r.gegen.fehler + ')' : ''));

  const sL = r.schutz.liste === '["lokal1","lokal2"]';
  const sO = r.schutz.objekt === '{"lokal":1}';
  const sV = r.schutz.nachVoll && r.schutz.nachVoll.indexOf('cloud1') >= 0;
  const sOk = sL && sO && sV;
  melde('Ein leerer Cloud-Wert löscht keine gefüllte lokale Liste — und kein Objekt', sOk,
    sOk ? 'leere Liste und leeres Objekt abgewehrt; gefüllte Cloud überschreibt trotzdem'
      : (!sL ? 'die leere Cloud-LISTE hat den lokalen Stand gelöscht (' + r.schutz.liste + ') ' : '')
        + (!sO ? 'das leere Cloud-OBJEKT hat den lokalen Stand gelöscht (' + r.schutz.objekt + ') ' : '')
        + (!sV ? 'eine GEFÜLLTE Cloud überschreibt nicht (' + r.schutz.nachVoll + ') — dann prüft der Fall nur, dass der Pull nichts tut' : ''));

  const dOk = !/plants|garden|state/.test(r.dirtyNachPull);
  melde('Ein Pull markiert nichts als ungesendet', dOk,
    dOk ? 'gs_sync_dirty nach dem Pull leer'
      : 'gs_sync_dirty = ' + r.dirtyNachPull + ' — der nächste Flush schiebt die gerade geholten Daten wieder hoch');

  const fOk = /plants/.test(r.dirtyNachFehler) && /garden/.test(r.dirtyNachFehler) && /state/.test(r.dirtyNachFehler);
  melde('Sagt der Server NEIN, bleibt der Stand als ungesendet markiert', fOk,
    fOk ? 'nach drei abgelehnten Pushes: ' + r.dirtyNachFehler
      : 'gs_sync_dirty = ' + (r.dirtyNachFehler || '(leer)') + ' — ein abgelehnter Push gilt als erledigt, der Stand ist weg');

  const ohneProbe = BLOB_KEYS.filter(k => !(k in PROBEN));
  melde('Jeder Schlüssel der drei Blob-Bauer hat hier einen Probewert', ohneProbe.length === 0,
    ohneProbe.length === 0 ? BLOB_KEYS.length + ' Schlüssel aus dem Quelltext, alle geprüft'
      : 'ungeprüft, weil kein Probewert eingetragen: ' + ohneProbe.join(', '));

  console.log('  ---');
  console.log('  Fragen geprueft: 25 · davon rot: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (fehler.length ? fehler.slice(0, 3).join(' | ') : 'keine'));
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();
