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
  'gs_dead_plants': '[{"id":"t1"}]',
  'gs_seed_inventory': '[{"id":"s1"}]',
  'gs_garden_plans': '[{"id":"pl1"}]',
  'gs_garden_plan_current': '{"id":"pl1"}',
  'gs_gardens': '[{"id":"g1","name":"Hof"}]',
  'gs_plantings': '[{"id":"pf1"}]',
  'gs_gpx_tracks': '[{"id":"tr1"}]',
  'gs_chat_history': '[{"q":"hallo"}]',
  'gs_doctor_history': '[{"q":"blatt"}]',
  'gs_ki_analyses': '[{"a":1}]',
  'gs_dq_archive': '[{"d":"2026-01-01"}]',
  'gs_dq_stats': '{"n":5}',
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
  console.log('  Fragen geprueft: 7 · davon rot: ' + kaputt);
  console.log('  JS-Fehler waehrend der Pruefung: ' + (fehler.length ? fehler.slice(0, 3).join(' | ') : 'keine'));
  process.exitCode = (kaputt || fehler.length) ? 1 : 0;
})();
