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
      // v33.71: die Cloud-Liste traegt auch Unrat (`null`, eine Zeichenkette, eine Liste) —
      // was von dort kommt, ist fremde Eingabe und geht gesiebt in Speicher UND Variable.
      if (/\/rest\/v1\/user_gardens/.test(pfad) && m === 'GET') return { data: [{ data: { gardens: G.concat([null, 'kaputt', ['x']]), plantings: PL.concat([null, 7]) }, updated_at: new Date().toISOString() }], error: null, status: 200 };
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
      const objekt = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
      raus.speicher = lies('gs_gardens').map(x => objekt(x) ? x.name : '<' + JSON.stringify(x) + '>');
      raus.arbeit = gardens.map(x => objekt(x) ? x.name : '<' + JSON.stringify(x) + '>');
      raus.pflSpeicher = lies('gs_plantings').length;
      raus.pflArbeit = plantings.length;
      raus.unrat = lies('gs_plantings').concat(plantings).filter(x => !objekt(x)).length;
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
    const ok = !g.fehler && g.speicher.join(',') === soll && g.arbeit.join(',') === soll && g.pflSpeicher === 2 && g.pflArbeit === 2 && g.unrat === 0
      && !g.hoch.some(h => /Mein Garten/.test(h)) && g.vorgemerkt === 'nein' && g.lokalBleibt.join(',') === 'Nur hier';
    melde('Der Pull frischt Gärten und Pflanzungen auch im ARBEITSSPEICHER auf — ein frisch angemeldetes Gerät überschreibt sie nicht mit „Mein Garten"', ok,
      ok ? '2 Gärten und 2 Pflanzungen im Speicher UND im Arbeitsspeicher (Unrat aus der Cloud gesiebt: 3 + 2) · nichts mit „Mein Garten" hochgeschoben · ungesendete lokale Änderung bleibt (' + g.lokalBleibt.join(',') + ')'
        : (g.fehler ? 'Ausnahme: ' + g.fehler
          : 'Cloud hatte „' + soll + '" + 2 Pflanzungen (dazu 3 + 2 Eintraege Unrat) → Speicher: „' + g.speicher.join(',') + '" (' + g.pflSpeicher + ' Pfl.) · Arbeitsspeicher: „' + g.arbeit.join(',') + '" (' + g.pflArbeit + ' Pfl.) · Unrat bei den Pflanzungen: ' + g.unrat
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

  await b.close();

  // ── Bericht ────────────────────────────────────────────────────────────
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
  console.log('  Fragen geprueft: 19 · davon rot: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (fehler.length ? fehler.slice(0, 3).join(' | ') : 'keine'));
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();
