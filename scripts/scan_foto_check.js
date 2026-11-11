#!/usr/bin/env node
/**
 * scan_foto_check.js — zeigt die App ein privates Foto nur ueber eine signierte Adresse?
 *
 * Anlass (11.11.2026): der Bucket `scan-images` war oeffentlich — 99 Fotos, jedes ohne
 * Anmeldung abrufbar, wer die Adresse kannte. Fernando: „privat stellen". Gespeichert ist
 * die oeffentliche Adresse an vielen Orten (user_scans.thumb, species_proposals,
 * Scan-Verlauf, myPlants, Backups). Die App macht daraus erst BEIM ANZEIGEN eine
 * signierte Adresse — ein Tor am Dokument (`_gsPrivatTorElement`, MutationObserver),
 * fuer <img src> UND style="…url(…)".
 *
 * Gestellt: der Supabase-Ursprung (page.route). /storage/v1/object/sign/<bucket>
 * antwortet wie Supabase ([{path, signedURL}]); eine signierte Adresse liefert ein
 * kleines PNG. Gezaehlt wird, was der BROWSER wirklich anfragt — nicht, was der Code
 * vorhat (CLAUDE.md §3.6, v33.54: die Wirkung messen, nicht den Text).
 *
 * Fragen (jede mit Gegenrichtung):
 *   S1  <img> mit Scan-Foto → signierte Adresse; das Original steht in data-gs-privat
 *   S2  fuenf Fotos in einem Rutsch → EINE Anfrage an /sign (Stapel)
 *   S3  echter Renderer: Pflanzen-Tagebuch (Hero als CSS-Hintergrund) → signiert
 *   S4  echter Renderer: Scan-Verlauf (thumb) → signiert
 *   S5  andere Buckets, fremder Host, Pfad mit „..“ → unberuehrt, keine /sign-Anfrage
 *   S6  /sign lehnt ab → das Original bleibt (Rueckfall), und kein Sturm (eine Anfrage)
 *   S7  abgemeldet → keine /sign-Anfrage, das Original bleibt
 *   S8  _gsPhotoToB64 holt die Bytes ueber die signierte Adresse, nie die oeffentliche
 *   P1–P5  SQL-Haelfte: 20261111_scan_images_privat.sql zweimal in ein lokales Postgres mit den
 *          Live-Regeln — Eigentuemer · Admin · fremdes Konto · anonym, Gegenprobe ohne Admin-Regel.
 *          Ohne Postgres: „nicht pruefbar" (Exit 2), nie gruen.
 *   S9  nach dem Signieren fragt der Browser die oeffentliche Adresse dieses Fotos nicht
 *       mehr an (hoechstens einmal, bevor das Tor greift)
 *
 * Gegenprobe:  GS_GEGENPROBE=1 node scripts/scan_foto_check.js  → leert GS_PRIVAT_BUCKETS;
 * S1–S4, S8 muessen rot werden.
 *
 *   node scripts/scan_foto_check.js
 */
const path = require('path');
const { chromium } = require(process.env.GS_PW || '/opt/node22/lib/node_modules/playwright');
const SEED = require('./_seed.js');

const WURZEL = path.join(__dirname, '..');
const SB = 'https://vowbiueikwrauuceilhc.supabase.co';
const UID = '11111111-2222-3333-4444-555555555555';
const PUB = (b, p) => SB + '/storage/v1/object/public/' + b + '/' + p;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const GEGENPROBE = process.env.GS_GEGENPROBE === '1';
const nichtPruefbar = [];

// Die Leseregeln, wie sie LIVE stehen (pg_policies, gelesen 11.11.2026), plus ein
// Bucket-Stand wie live (public = true) — dann die Migration zweimal.
//   P1  vorher: der Bucket ist oeffentlich (der Ausgangszustand stimmt)
//   P2  die Migration laesst sich zweimal einspielen
//   P3  danach: privat; der Eigentuemer liest sein Foto, ein fremdes nicht
//   P4  ein Admin liest fremde Fotos (Arten-Vorschlaege); ein Nicht-Admin nicht
//   P5  anonym: nichts
//   Gegenprobe: ohne die Admin-Regel sieht der Admin das fremde Foto NICHT (P4 rot)
function sqlHaelfte() {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const url = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
  const psql = (db, text) => execFileSync('psql', [url.replace(/\/[^\/]*$/, '/' + db), '-v', 'ON_ERROR_STOP=1', '-qAt', '-c', text], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try { psql('postgres', 'select 1'); } catch (e) { return { nichtPruefbar: 'SQL-Haelfte: kein lokales Postgres unter ' + url + ' (bash scripts/_pg_local.sh start)' }; }
  const mig = fs.readFileSync(path.join(WURZEL, 'supabase/migrations/20261111_scan_images_privat.sql'), 'utf8');
  const db = 'gs_scanfoto_' + process.pid;
  const faelle = [];
  const grundlage = `
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    end $$;
    create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('pf.uid', true), '')::uuid $$;
    create function public.is_admin_user() returns boolean language sql stable as $$ select coalesce(current_setting('pf.admin', true), '') = 'ja' $$;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
    create table storage.buckets (id text primary key, public boolean default false);
    create table storage.objects (id bigserial primary key, bucket_id text, name text, owner uuid);
    alter table storage.objects enable row level security;
    grant usage on schema storage, auth to authenticated, anon;
    grant select on storage.objects, storage.buckets to authenticated, anon;
    grant execute on function auth.uid(), public.is_admin_user(), storage.foldername(text) to authenticated, anon;
    -- live, im Wortlaut (pg_policies 11.11.2026)
    create policy scan_images_owner_read on storage.objects for select to public
      using ((bucket_id = 'scan-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text));
    insert into storage.buckets values ('scan-images', true), ('post-images', true);
    insert into storage.objects (bucket_id, name, owner) values
      ('scan-images', 'aaaaaaaa-0000-0000-0000-000000000001/eigen.jpg', 'aaaaaaaa-0000-0000-0000-000000000001'),
      ('scan-images', 'bbbbbbbb-0000-0000-0000-000000000002/fremd.jpg', 'bbbbbbbb-0000-0000-0000-000000000002');`;
  const als = (uid, admin, rolle) => `begin; set local role ${rolle || 'authenticated'}; set local pf.uid = '${uid || ''}'; set local pf.admin = '${admin ? 'ja' : 'nein'}';
    select coalesce(string_agg(split_part(name, '/', 2), ',' order by name), '-') from storage.objects where bucket_id = 'scan-images'; commit;`;
  const lauf = (mitAdminRegel) => {
    psql('postgres', 'drop database if exists ' + db);
    psql('postgres', 'create database ' + db);
    try {
      psql(db, grundlage);
      const vorher = psql(db, "select public from storage.buckets where id='scan-images'");
      const m = mitAdminRegel ? mig : mig.replace(/create policy scan_images_admin_read[\s\S]*?;\n/, '');
      let zweimal = true;
      try { psql(db, m); psql(db, m); } catch (e) { zweimal = String(e.stderr || e.message).split('\n')[0]; }
      const r = {
        vorher, zweimal,
        nachher: psql(db, "select public from storage.buckets where id='scan-images'"),
        anderer: psql(db, "select public from storage.buckets where id='post-images'"),
        eigen: psql(db, als('aaaaaaaa-0000-0000-0000-000000000001', false)).split('\n').filter(Boolean).pop(),
        admin: psql(db, als('cccccccc-0000-0000-0000-000000000003', true)).split('\n').filter(Boolean).pop(),
        fremd: psql(db, als('cccccccc-0000-0000-0000-000000000003', false)).split('\n').filter(Boolean).pop(),
        anon: psql(db, als('', false, 'anon')).split('\n').filter(Boolean).pop(),
      };
      return r;
    } finally { try { psql('postgres', 'drop database if exists ' + db); } catch (e) {} }
  };
  let r, g;
  try { r = lauf(true); g = lauf(false); }
  catch (e) { return { faelle: [{ name: 'P · SQL-Haelfte laeuft', ok: false, detail: String(e.stderr || e.message).split('\n')[0] }] }; }
  faelle.push({ name: 'P1 · vorher (wie live): scan-images ist oeffentlich', ok: r.vorher === 't', detail: 'public=' + r.vorher });
  faelle.push({ name: 'P2 · die Migration laesst sich zweimal einspielen', ok: r.zweimal === true, detail: String(r.zweimal) });
  faelle.push({ name: 'P3 · danach privat; der Eigentuemer liest sein Foto und kein fremdes; andere Buckets bleiben, wie sie sind', ok: r.nachher === 'f' && r.eigen === 'eigen.jpg' && r.anderer === 't', detail: 'public=' + r.nachher + ' · Eigentuemer sieht ' + r.eigen + ' · post-images public=' + r.anderer });
  faelle.push({ name: 'P4 · ein Admin liest fremde Fotos (Arten-Vorschlaege), ein Nicht-Admin nicht — Gegenprobe ohne die Admin-Regel: der Admin sieht nichts', ok: r.admin === 'eigen.jpg,fremd.jpg' && r.fremd === '-' && g.admin === '-', detail: 'Admin ' + r.admin + ' · Nicht-Admin ' + r.fremd + ' · Gegenprobe Admin ' + g.admin });
  faelle.push({ name: 'P5 · anonym: nichts', ok: r.anon === '-', detail: 'anon ' + r.anon });
  return { faelle };
}

// Eine Frist, die Versuche zaehlt statt der Seite zu vertrauen (CLAUDE.md §7.1, v32.61):
// ein Tor, das sich selbst wieder ausloest (Rueckfall → Tor → Rueckfall), legt die Seite
// lahm, und page.evaluate kommt nie zurueck. Dann sagt der Pruefstand WO, statt zu haengen.
let schritt = 'Aufbau';
setTimeout(() => {
  console.log('  ROT  Zeitgrenze (150 s) · haengt bei: ' + schritt + ' — laeuft das Tor im Kreis?');
  process.exit(1);
}, 150000).unref();

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  const page = await ctx.newPage();
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message.split('\n')[0]));

  const netz = { sign: [], oeffentlich: [], signiert: [] };
  let signModus = 'ok';
  await page.route('**', async (r) => {
    const u = r.request().url();
    if (u.startsWith('file:')) return r.continue();
    if (u.startsWith(SB + '/storage/v1/object/sign/')) {
      const bucket = decodeURIComponent(u.slice((SB + '/storage/v1/object/sign/').length).split('?')[0]);
      if (r.request().method() === 'POST') {
        let body = {};
        try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
        netz.sign.push({ bucket, paths: body.paths || [], expiresIn: body.expiresIn });
        if (signModus === 'fehler') return r.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ statusCode: '400', error: 'nope', message: 'nope' }) });
        const antwort = (body.paths || []).map(p => ({ path: p, error: null, signedURL: '/object/sign/' + bucket + '/' + p + '?token=t.' + Buffer.from(p).toString('base64url') }));
        return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(antwort) });
      }
      netz.signiert.push(u);
      return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    if (u.startsWith(SB + '/storage/v1/object/public/')) {
      netz.oeffentlich.push(u);
      return r.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    }
    return r.abort();
  });
  await page.addInitScript(SEED);
  await page.addInitScript((uid) => { try { localStorage.setItem('gs_sb_uid', uid); } catch (e) {} }, UID);
  await page.goto('file://' + path.join(WURZEL, 'index.html'), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForTimeout(3500);

  const ergebnisse = [];
  const pruefe = (name, ok, detail) => { ergebnisse.push({ name, ok: !!ok, detail }); if (process.env.GS_DEBUG) console.log('  … ' + name.slice(0, 4) + ' ' + !!ok); };
  const leeren = () => { netz.sign.length = 0; netz.oeffentlich.length = 0; netz.signiert.length = 0; };

  const grund = await page.evaluate((g) => {
    if (typeof GS_PRIVAT_BUCKETS === 'undefined' || typeof gsPrivatBildUrl !== 'function') return 'Tor fehlt (GS_PRIVAT_BUCKETS / gsPrivatBildUrl)';
    if (g) GS_PRIVAT_BUCKETS.length = 0;
    try { window.sbIsLoggedIn = function () { return true; }; } catch (e) {}
    return '';
  }, GEGENPROBE);
  if (grund) { console.log('  ROT  Aufbau · ' + grund); await b.close(); process.exit(1); }

  // ── S1 + S9 ──
  schritt = 'S1';
  leeren();
  const s1 = await page.evaluate(async (a) => {
    const d = document.createElement('div'); d.id = 'pf-s1';
    d.innerHTML = '<img id="pf-s1-img" src="' + a.url + '" alt="">';
    document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 400));
    const img = document.getElementById('pf-s1-img');
    return { src: img.getAttribute('src'), orig: img.getAttribute('data-gs-privat'), geladen: img.complete && img.naturalWidth > 0 };
  }, { url: PUB('scan-images', UID + '/1790672426726_a.jpg') });
  pruefe('S1 · ein Scan-Foto wird mit signierter Adresse angezeigt, das Original steht in data-gs-privat',
    s1.src.startsWith(SB + '/storage/v1/object/sign/scan-images/' + UID + '/1790672426726_a.jpg?token=') && s1.orig === PUB('scan-images', UID + '/1790672426726_a.jpg') && s1.geladen,
    'src=' + s1.src.slice(0, 90) + ' · geladen=' + s1.geladen);
  pruefe('S9 · nach dem Signieren holt der Browser die oeffentliche Adresse dieses Fotos nicht mehr (hoechstens einmal vor dem Tor)',
    netz.oeffentlich.filter(u => u.includes('1790672426726_a')).length <= 1 && netz.signiert.some(u => u.includes('1790672426726_a')),
    'oeffentlich ' + netz.oeffentlich.length + ' · signiert ' + netz.signiert.length);

  // ── S2 Stapel ──
  schritt = 'S2';
  leeren();
  const s2 = await page.evaluate(async (a) => {
    const d = document.createElement('div');
    d.innerHTML = a.urls.map((u, i) => '<img class="pf-s2" src="' + u + '">').join('');
    document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 400));
    return Array.from(document.querySelectorAll('.pf-s2')).map(i => i.getAttribute('src'));
  }, { urls: [1, 2, 3, 4, 5].map(i => PUB('scan-images', UID + '/stapel_' + i + '.jpg')) });
  pruefe('S2 · fuenf Fotos in einem Rutsch → genau EINE Anfrage an /sign mit fuenf Pfaden',
    netz.sign.length === 1 && netz.sign[0].paths.length === 5 && s2.every(s => s.includes('/object/sign/scan-images/')),
    netz.sign.length + ' Anfrage(n) · ' + (netz.sign[0] ? netz.sign[0].paths.length : 0) + ' Pfade · signiert ' + s2.filter(s => s.includes('/sign/')).length + '/5');

  // ── S3 Pflanzen-Tagebuch (Hero als CSS-Hintergrund) ──
  schritt = 'S3';
  leeren();
  const s3 = await page.evaluate(async (a) => {
    if (typeof openPlantDiary !== 'function' || typeof myPlants === 'undefined') return { fehlt: true };
    myPlants.push({ id: 'pf_pflanze', name: 'Pruefstand-Tomate', emoji: '🍅', photo: a.url, diary: [], tasks: {} });
    openPlantDiary('pf_pflanze');
    await new Promise(r => setTimeout(r, 500));
    const m = document.getElementById('plant-diary-modal') || document.body;
    const el = m.querySelector('[data-gs-privat-stil]');
    const stile = Array.from(m.querySelectorAll('[style*="storage/v1/object"]')).map(e => e.getAttribute('style'));
    return { stil: el ? el.getAttribute('style') : '', stile };
  }, { url: PUB('scan-images', UID + '/held.jpg') });
  pruefe('S3 · echter Renderer: der Hero im Pflanzen-Tagebuch (CSS-Hintergrund) zeigt die signierte Adresse',
    !s3.fehlt && s3.stil.includes('/object/sign/scan-images/' + UID + '/held.jpg?token=') && !s3.stile.some(s => s.includes('/object/public/scan-images/')),
    s3.fehlt ? 'openPlantDiary/myPlants fehlt' : (s3.stil.slice(0, 120) || 'kein Element mit data-gs-privat-stil'));
  await page.evaluate(() => { const m = document.getElementById('plant-diary-modal'); if (m) m.remove(); });

  // ── S4 Scan-Verlauf ──
  schritt = 'S4';
  leeren();
  const s4 = await page.evaluate(async (a) => {
    if (typeof openScanHistoryFull !== 'function') return { fehlt: true };
    const h = JSON.parse(localStorage.getItem('gs_scan_history') || '[]');
    h.unshift({ name: 'Pruefstand-Bärlauch', latin: 'Allium ursinum', ts: Date.now(), confidence: 90, thumb: a.url, photoUrl: a.url });
    localStorage.setItem('gs_scan_history', JSON.stringify(h));
    openScanHistoryFull();
    await new Promise(r => setTimeout(r, 700));
    const imgs = Array.from(document.querySelectorAll('img[data-gs-privat]')).filter(i => i.getAttribute('data-gs-privat') === a.url);
    const rest = Array.from(document.querySelectorAll('img')).filter(i => (i.getAttribute('src') || '') === a.url).length;
    return { n: imgs.length, signiert: imgs.filter(i => (i.getAttribute('src') || '').includes('/object/sign/')).length, rest };
  }, { url: PUB('scan-images', UID + '/verlauf.jpg') });
  pruefe('S4 · echter Renderer: der Scan-Verlauf zeigt das Foto mit signierter Adresse',
    !s4.fehlt && s4.n >= 1 && s4.signiert === s4.n && s4.rest === 0,
    s4.fehlt ? 'openScanHistoryFull fehlt' : (s4.n + ' Bild(er), signiert ' + s4.signiert + ', mit oeffentlicher Adresse ' + s4.rest));
  await page.evaluate(() => { try { closeScanHistoryFull(); } catch (e) {} });

  // ── S5 unberuehrt ──
  schritt = 'S5';
  leeren();
  const fremde = [
    PUB('post-images', UID + '/beitrag.jpg'),
    'https://example.org/storage/v1/object/public/scan-images/' + UID + '/x.jpg',
    PUB('scan-images', UID + '/../andere/x.jpg'),
    PUB('scan-images', UID + '/%2e%2e/andere/x.jpg'),
  ];
  const s5 = await page.evaluate(async (a) => {
    const d = document.createElement('div');
    d.innerHTML = a.map(u => '<img class="pf-s5" src="' + u + '">').join('');
    document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 400));
    return Array.from(document.querySelectorAll('.pf-s5')).map(i => ({ src: i.getAttribute('src'), markiert: i.hasAttribute('data-gs-privat') }));
  }, fremde);
  pruefe('S5 · anderer Bucket, fremder Host und Pfad mit „..“ bleiben unberuehrt — keine /sign-Anfrage',
    netz.sign.length === 0 && s5.every((x, i) => x.src === fremde[i] && !x.markiert),
    netz.sign.length + ' /sign · ' + s5.filter(x => x.markiert).length + ' markiert');

  // ── S6 Ablehnung ──
  schritt = 'S6';
  leeren(); signModus = 'fehler';
  const s6 = await page.evaluate(async (a) => {
    const d = document.createElement('div');
    d.innerHTML = '<img class="pf-s6" src="' + a + '">';
    document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 400));
    const d2 = document.createElement('div');
    d2.innerHTML = '<img class="pf-s6" src="' + a + '">';
    document.body.appendChild(d2);
    await new Promise(r => setTimeout(r, 400));
    return Array.from(document.querySelectorAll('.pf-s6')).map(i => i.getAttribute('src'));
  }, PUB('scan-images', UID + '/abgelehnt.jpg'));
  pruefe('S6 · lehnt /sign ab, bleibt das Original stehen — und ein zweites Bild loest keine zweite Anfrage aus',
    s6.length === 2 && s6.every(s => s === PUB('scan-images', UID + '/abgelehnt.jpg')) && netz.sign.length === 1,
    netz.sign.length + ' /sign · ' + s6.map(s => s.split('/').pop()).join(', '));
  signModus = 'ok';

  // ── S7 abgemeldet ──
  schritt = 'S7';
  leeren();
  const s7 = await page.evaluate(async (a) => {
    const vorher = window.sbIsLoggedIn;
    window.sbIsLoggedIn = function () { return false; };
    const d = document.createElement('div');
    d.innerHTML = '<img id="pf-s7" src="' + a + '">';
    document.body.appendChild(d);
    await new Promise(r => setTimeout(r, 400));
    window.sbIsLoggedIn = vorher;
    return document.getElementById('pf-s7').getAttribute('src');
  }, PUB('scan-images', UID + '/abgemeldet.jpg'));
  pruefe('S7 · abgemeldet: keine /sign-Anfrage, das Original bleibt',
    netz.sign.length === 0 && s7 === PUB('scan-images', UID + '/abgemeldet.jpg'),
    netz.sign.length + ' /sign · ' + s7.split('/').pop());

  // ── S8 Bytes per fetch ──
  schritt = 'S8';
  leeren();
  const s8 = await page.evaluate(async (a) => {
    if (typeof _gsPhotoToB64 !== 'function') return { fehlt: true };
    const r = await _gsPhotoToB64(a);
    return { ok: !!(r && r.b64) };
  }, PUB('scan-images', UID + '/bytes.jpg'));
  pruefe('S8 · _gsPhotoToB64 holt die Bytes ueber die signierte Adresse, nie die oeffentliche',
    !s8.fehlt && s8.ok && netz.signiert.some(u => u.includes('/bytes.jpg?token=')) && !netz.oeffentlich.some(u => u.includes('/bytes.jpg')),
    s8.fehlt ? '_gsPhotoToB64 fehlt' : ('signiert ' + netz.signiert.length + ' · oeffentlich ' + netz.oeffentlich.length));

  await b.close();

  // ── SQL-Haelfte: die Migration WIRKLICH anwenden (CLAUDE.md §7.1, v33.41) ──
  schritt = 'SQL';
  const sql = sqlHaelfte();
  if (sql.nichtPruefbar) nichtPruefbar.push(sql.nichtPruefbar);
  else sql.faelle.forEach(f => pruefe(f.name, f.ok, f.detail));

  let rot = 0;
  for (const e of ergebnisse) { if (!e.ok) rot++; console.log('  ' + (e.ok ? 'ok  ' : 'ROT ') + ' ' + e.name + '   [' + e.detail + ']'); }
  if (fehler.length) console.log('  JS-Fehler der Seite: ' + fehler.length + ' (erster: ' + fehler[0] + ')');
  console.log('  ---');
  console.log('  Fragen geprueft: ' + ergebnisse.length + ' · davon rot: ' + rot + (GEGENPROBE ? '   (GEGENPROBE: GS_PRIVAT_BUCKETS geleert)' : ''));
  console.log('  Grenze: der Supabase-Ursprung ist gestellt — ob die Live-Leseregel (scan_images_owner_read, scan_images_admin_read) das Signieren erlaubt, misst die Migration beim Anwenden.');
  nichtPruefbar.forEach(n => console.log('  n.p. ' + n));
  process.exit(rot ? 1 : (nichtPruefbar.length ? 2 : 0));
})().catch(e => { console.error('  ROT  Abbruch: ' + (e && e.stack || e)); process.exit(1); });
