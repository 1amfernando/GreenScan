#!/usr/bin/env node
/**
 * loeschung_check.js — raeumt „Konto loeschen", was der Dialog verspricht?
 *
 *   node scripts/loeschung_check.js
 *
 * Der Dialog sagt „Alle Scans & Bilder", „Alle Sensor-Daten & Tracks". Die
 * Edge-Function `delete-user` loeschte bis v33.16 eine Liste von Tabellen und
 * das Konto — und KEIN einziges Storage-Objekt (gemessen 10.09.2026: 169
 * Objekte in drei Buckets, alle unter <uid>/). Zwei Tabellen mit user_id ohne
 * Fremdschluessel (ai_usage, species_search_log) standen in keiner Liste. Und
 * wer eine Organisation erstellt hatte, bekam ein HALBES Loeschen: Tabellen
 * und Profil weg, Konto und Login stehen (organizations.created_by ist NOT
 * NULL + RESTRICT).
 *
 * Geprueft wird wie bei ingest_check: die LISTEN und die RECHNUNG liegen in
 * supabase/functions/_shared/loeschung_regeln.mjs (Node-importierbar), die
 * Edge-Function ist der Rand. Dazu eine DATIERTE Momentaufnahme der
 * Live-Datenbank (docs/loeschung-inventar.json: jede Spalte, die auf eine
 * Person zeigt, mit ihrer Loeschregel; jeder Bucket mit seinen Objekten) —
 * nur lesend gemessen, wie docs/backend-inventar.json. Drei Klassen je
 * Spalte: kaskade · explizit · bewusst (mit Grund). Alles andere ist FEHLT.
 *
 * Und die App: sagt sie bei der Sperre den Namen der Organisation, laesst
 * den Knopf wieder frei und loescht lokal nichts?
 *
 * Nicht geprueft, ehrlich benannt: ob Supabase die Objekte wirklich entfernt,
 * ob `list(uid)` bei >1000 Dateien alle Seiten liefert, ob die Kaskaden in
 * der Live-DB greifen. Das braucht die lebende Funktion — und die Momentaufnahme
 * veraltet: der Bericht nennt ihr Datum.
 */
'use strict';
const path = require('path');
const fs = require('fs');
const ROOT = path.resolve(__dirname, '..');

(async () => {
  const R = await import(path.resolve(ROOT, 'supabase', 'functions', '_shared', 'loeschung_regeln.mjs'));
  const inv = JSON.parse(fs.readFileSync(path.resolve(ROOT, 'docs', 'loeschung-inventar.json'), 'utf8'));
  const edge = fs.readFileSync(path.resolve(ROOT, 'supabase', 'functions', 'delete-user', 'index.ts'), 'utf8');
  const migrationen = fs.readdirSync(path.resolve(ROOT, 'supabase', 'migrations')).filter(f => /\.sql$/.test(f))
    .map(f => fs.readFileSync(path.resolve(ROOT, 'supabase', 'migrations', f), 'utf8')).join('\n');

  console.log('\n=== loeschung_check — raeumt „Konto loeschen", was der Dialog verspricht?');
  console.log('  Momentaufnahme: ' + inv.stand + ' · ' + inv.spalten.length + ' Nutzer-Spalten · ' + inv.buckets.length + ' Buckets (nur lesend gemessen)');
  let kaputt = 0;
  const melde = (name, ok, wie) => {
    if (ok) console.log('  ok   ' + name + (wie ? '   [' + wie + ']' : ''));
    else { kaputt++; console.log('  !!   ' + name + '\n         → ' + (wie || 'unbekannt')); }
  };

  // ── 1 · Jede Nutzer-Spalte hat eine Klasse ──────────────────────────────
  const kl = R.klassifiziere(inv);
  const fehlt = kl.filter(x => x.klasse === 'FEHLT');
  const z = { kaskade: 0, explizit: 0, bewusst: 0 };
  kl.forEach(x => { if (z[x.klasse] !== undefined) z[x.klasse]++; });
  melde('Jede Nutzer-Spalte der Momentaufnahme ist kaskade, explizit oder bewusst (mit Grund)',
    !fehlt.length,
    fehlt.length ? fehlt.map(x => x.tabelle + '.' + x.spalte + ' — ' + x.grund).join(' · ')
                 : 'kaskade ' + z.kaskade + ' · explizit ' + z.explizit + ' · bewusst ' + z.bewusst);

  // ── 2 · user_id ohne Kaskade steht EXPLIZIT ────────────────────────────
  const ohneKaskade = inv.spalten.filter(s => s.spalte === 'user_id' && s.fk !== 'c');
  const ohneKaskadeFehlt = ohneKaskade.filter(s => !R.USER_TABLES.includes(s.tabelle) && !R.BEWUSST[s.tabelle + '.' + s.spalte]);
  melde('user_id ohne ON DELETE CASCADE steht in USER_TABLES (oder mit Grund in BEWUSST)',
    !ohneKaskadeFehlt.length,
    ohneKaskadeFehlt.length ? ohneKaskadeFehlt.map(s => s.tabelle + ' (fk ' + s.fk + ')').join(', ')
                            : ohneKaskade.length + ' Spalten: ' + ohneKaskade.map(s => s.tabelle).join(', '));

  // ── 3 · Keine tote Begruendung ─────────────────────────────────────────
  const spaltenSet = new Set(inv.spalten.map(s => s.tabelle + '.' + s.spalte));
  const tot = Object.keys(R.BEWUSST).filter(k => !spaltenSet.has(k));
  melde('Jede Begruendung in BEWUSST zeigt auf eine Spalte der Momentaufnahme',
    !tot.length, tot.length ? tot.join(', ') : Object.keys(R.BEWUSST).length + ' Begruendungen');

  // ── 4 · USER_TABLES: nicht live → per Migration vorbereitet ────────────
  const live = new Set(inv.spalten.map(s => s.tabelle));
  const vorbereitet = t => new RegExp('create\\s+table\\s+(if\\s+not\\s+exists\\s+)?(public\\.)?"?' + t + '"?\\b', 'i').test(migrationen);
  const nichtLive = R.USER_TABLES.filter(t => !live.has(t));
  const unbekannt = nichtLive.filter(t => !vorbereitet(t));
  melde('USER_TABLES nennt nur Tabellen, die es gibt oder die eine Migration im Repo anlegt',
    !unbekannt.length,
    unbekannt.length ? 'weder live noch vorbereitet: ' + unbekannt.join(', ')
                     : (nichtLive.length ? nichtLive.length + ' vorbereitet, nicht angewandt: ' + nichtLive.join(', ') : 'alle live'));

  // ── 5 · Buckets ─────────────────────────────────────────────────────────
  const bucketFehlt = inv.buckets.filter(b => !R.BUCKETS.includes(b.bucket));
  melde('Jeder Bucket der Momentaufnahme steht in BUCKETS',
    !bucketFehlt.length, bucketFehlt.length ? bucketFehlt.map(b => b.bucket + ' (' + b.objekte + ' Objekte)').join(', ')
                                             : inv.buckets.map(b => b.bucket + ' ' + b.objekte).join(' · '));
  const nichtUid = inv.buckets.filter(b => b.mit_uid_praefix !== b.objekte);
  melde('Alle Objekte liegen unter <uid>/ — sonst findet list(uid) sie nicht',
    !nichtUid.length, nichtUid.length ? nichtUid.map(b => b.bucket + ': ' + (b.objekte - b.mit_uid_praefix) + ' ohne Praefix').join(', ') : '');

  // ── 6 · Die Rechnung ───────────────────────────────────────────────────
  const pf = R.speicherPfade('u1', [{ name: 'a.jpg', id: 'x' }, { name: 'ordner', id: null }, { name: '', id: 'y' }, null, { name: 'b.pdf', id: 'z' }]);
  melde('speicherPfade: Dateien mit vollem Pfad, Ordner und Leeres uebersprungen',
    JSON.stringify(pf) === '["u1/a.jpg","u1/b.pdf"]', JSON.stringify(pf));
  melde('speicherPfade ohne uid → nichts (nie den ganzen Bucket)',
    R.speicherPfade('', [{ name: 'a.jpg', id: 'x' }]).length === 0 && R.speicherPfade(null, [{ name: 'a.jpg', id: 'x' }]).length === 0, '');

  // ── 7 · Die Sperre ─────────────────────────────────────────────────────
  const s1 = R.loeschSperre([{ id: 'o1', name: 'Schule Muster' }, { id: 'o2', name: 'Verein Beet' }]);
  const s0 = R.loeschSperre([]), sN = R.loeschSperre(null);
  melde('loeschSperre: Ersteller → 409 org_creator mit Namen; ohne Organisation keine Sperre',
    s1.gesperrt && s1.status === 409 && s1.error === 'org_creator' && s1.organizations.join('|') === 'Schule Muster|Verein Beet' && !s0.gesperrt && !sN.gesperrt,
    JSON.stringify(s1));
  melde('sperreMeldung traegt Praefix und Namen (sbFetch reicht nur message und status weiter)',
    R.sperreMeldung(s1) === R.SPERRE_PRAEFIX + 'Schule Muster, Verein Beet' && R.sperreMeldung(s0) === '',
    R.sperreMeldung(s1));

  // ── 8 · Der Rand: die Edge-Function ────────────────────────────────────
  melde('delete-user importiert die Listen aus dem Modul und hat keine eigene',
    /from\s+"\.\.\/_shared\/loeschung_regeln\.mjs"/.test(edge) && /\bUSER_TABLES\b/.test(edge) && /\bBUCKETS\b/.test(edge)
      && /loeschSperre\(/.test(edge) && /speicherPfade\(/.test(edge) && /sperreMeldung\(/.test(edge) && !/const\s+USER_TABLES\s*=/.test(edge), '');
  const iSperre = edge.indexOf('loeschSperre('), iLoesch = edge.search(/\.delete\(|\.remove\(/);
  melde('delete-user prueft die Sperre VOR dem ersten Loeschschritt und antwortet 409',
    iSperre > 0 && iLoesch > iSperre && /json\(409/.test(edge), 'Sperre @' + iSperre + ' · erstes delete/remove @' + iLoesch);
  melde('delete-user raeumt Storage seitenweise (list + remove) und zaehlt je Bucket',
    /storage\s*\n?\s*\.from\(bucket\)\s*\n?\s*\.list\(targetUid/.test(edge) && /\.remove\(pfade\)/.test(edge) && /"storage:" \+ bucket/.test(edge), '');

  // ── 9 · Die App ────────────────────────────────────────────────────────
  let app = null;
  try {
    const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
    const SEED = require('./_seed.js');
    const br = await chromium.launch();
    const p = await (await br.newContext({ viewport: { width: 412, height: 915 } })).newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message.split('\n')[0]));
    await p.route('**', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
    await p.addInitScript(SEED);
    await p.goto('file://' + path.resolve(ROOT, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await p.waitForTimeout(3500);
    app = await p.evaluate(async () => {
      document.documentElement.classList.remove('gs-preauth');
      window.gsRequire = () => true; window.sbIsLoggedIn = () => true;
      const toasts = [];
      window.showProfileToast = (o) => { toasts.push(typeof o === 'string' ? o : (((o && o.title) || '') + ' ' + ((o && o.body) || ''))); };
      try { localStorage.setItem('gs_sb_uid', '00000000-0000-4000-8000-000000000001'); } catch (_) {}
      const out = {};
      profDeleteAccount();
      const m = document.getElementById('delete-account-modal');
      out.dialog = m ? (m.textContent || '').replace(/\s+/g, ' ') : '';
      let rufe = 0;
      window.sbFetch = async () => { rufe++; return { error: { message: 'org_creator: Schule Muster', status: 409 } }; };
      const inp = document.getElementById('del-confirm'); if (inp) inp.value = 'LÖSCHEN';
      await gsExecuteDeleteAccount();
      out.toast = toasts.slice(-1)[0] || '';
      const btn = document.getElementById('del-btn');
      out.knopfFrei = !!btn && !btn.disabled;
      out.rufe = rufe;
      out.lokalDa = !!localStorage.getItem('gs_sb_uid') && !!localStorage.getItem('ps_myplants');
      if (m) m.remove();
      return out;
    });
    await br.close();
    melde('Dialog verspricht auch die Fotos in der Cloud und den Lina-Verlauf',
      /Cloud/.test(app.dialog) && /Lina/.test(app.dialog), app.dialog.replace(/.*gelöscht:/, '').slice(0, 140));
    // Gegenprobe beim Bau: ohne die Erkennung reichte _gsFehlerText die rohe
    // Meldung „org_creator: Schule Muster" durch — der Name stand da, und der
    // Fall war gruen. Ein SATZ nennt die Organisation und traegt kein Praefix.
    melde('Sperre in der App: ein Satz nennt die Organisation (kein rohes org_creator), Knopf frei, lokal nichts geloescht',
      /Schule Muster/.test(app.toast) && /Organisation/.test(app.toast) && !/org_creator/.test(app.toast) && app.knopfFrei && app.lokalDa && app.rufe === 1,
      app.toast + ' · Knopf frei: ' + app.knopfFrei + ' · lokal da: ' + app.lokalDa + ' · Aufrufe: ' + app.rufe);
    if (errs.length) melde('JS-Fehler waehrend der App-Pruefung', false, errs.slice(0, 2).join(' | '));
  } catch (e) {
    melde('App-Haelfte (Playwright)', false, 'Ausnahme: ' + String(e.message || e).split('\n')[0]);
  }

  console.log('  ---');
  console.log('  Fragen geprueft: ' + (kaputt + (14 - kaputt)) + ' · davon rot: ' + kaputt);
  console.log('  Grenze: geprueft sind Listen, Rechnung, Rand und App — nicht die lebende Funktion.');
  console.log('  Ob Supabase die Objekte wirklich entfernt und die Kaskaden greifen, zeigt nur ein echtes Loeschen.');
  process.exitCode = kaputt ? 1 : 0;
})();
