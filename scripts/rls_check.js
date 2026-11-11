#!/usr/bin/env node
// rls_check.js — haelt die Datenbank, was die App ueber sie annimmt? (Rechte, Policies, RPCs)
//
//   node scripts/rls_check.js              # alle Fall-Dateien
//   node scripts/rls_check.js quiz         # nur Dateien, deren Name passt
//
// Anlass: die Sicherheitspruefung vom 10.11.2026. Die Live-Datenbank wurde nur
// LESEND vermessen (pg_policies, pg_proc mit ACL und Quelltext, Trigger,
// Buckets). Was dabei auffiel, laesst sich von hier aus nicht an der lebenden
// Datenbank zeigen — aber NACHSPIELEN: jeder Fall baut in einem lokalen
// Wegwerf-Postgres genau den Ausschnitt nach, um den es geht (Tabelle mit den
// Spalten, die Policy bzw. Funktion im WORTLAUT des Live-Stands, mit Datum),
// zeigt den Angriff (er MUSS vor der Migration gelingen — sonst misst der Fall
// nichts), spielt die Migration aus supabase/migrations/ ein — ZWEIMAL
// (Idempotenz) —, und zeigt danach: der Angriff scheitert, der erlaubte Weg der
// App geht weiter. Dieselbe Bauform wie quiz_check (v32.65), naht_check
// „Freundschaft" (v33.52) und admin_check „Spur" (v33.51).
//
// Bauform: Faelle als Module in scripts/rls/*.js, je Themengruppe EINE Datei:
//
//   module.exports = [ { name: '…', lauf: async (h) => ({ ok, info | warum }) }, … ]
//
// Hilfen in `h`:
//   const d = h.neu('quiz')          frische Datenbank mit Grundgeruest (siehe GRUND unten):
//                                    Rollen anon/authenticated/service_role, Schema auth mit
//                                    auth.users, auth.uid(), auth.role(), auth.jwt(), auth.email()
//   d.sql(text)                      als Eigentuemer (postgres); wirft bei Fehler
//   d.versuch(text)                  wie sql, wirft nicht: { ok, out, err }
//   d.als(uid, text, opts)           als angemeldeter Nutzer <uid> (Rolle authenticated, JWT-Claims
//                                    gesetzt; opts.rolle 'anon' | 'service_role', opts.email):
//                                    { ok, out, err } — out ist die Ausgabe von psql -A -t
//   d.migration('datei.sql')         spielt supabase/migrations/<datei> ein: { ok, err }
//   d.weg()                          Datenbank loeschen (im finally des Falls)
//   h.U1, h.U2, h.U3, h.ADMIN        feste uuids fuer Nutzer
//
// Ohne erreichbares Postgres: „nicht pruefbar" (Exit 2), nie gruen.
// Start: bash scripts/_pg_local.sh start   (CI: Service postgres:16, GS_PG_URL)
//
// Grenze: nachgespielt ist ein AUSSCHNITT des Live-Stands vom genannten Datum.
// Ob die Migration auf der lebenden Datenbank dasselbe tut, zeigt erst das
// Anwenden — und das gehoert Fernando (docs/FUER-FERNANDO.md).
'use strict';
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const MIG = path.join(REPO, 'supabase', 'migrations');
const DIR = path.join(__dirname, 'rls');
const PG_URL = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
const filter = process.argv.slice(2);
const dateien = fs.existsSync(DIR)
  ? fs.readdirSync(DIR).filter(f => /\.js$/.test(f) && !/^_/.test(f)).sort()
      .filter(f => !filter.length || filter.some(w => f.indexOf(w) >= 0))
  : [];

function url(db) { return PG_URL.replace(/\/[^\/?]*(\?.*)?$/, '/' + db + '$1'); }
function psql(db, text) {
  const r = spawnSync('psql', [url(db), '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-F', '\t', '-f', '-'], { encoding: 'utf8', input: text, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, out: String(r.stdout || '').trim(), err: String(r.stderr || '').trim() };
}
function pgDa() { const r = psql('postgres', 'select 1;'); return r.ok && r.out === '1'; }

// Das Grundgeruest ahmt nach, was Supabase mitbringt — so wenig wie moeglich,
// aber genug, dass Policies und SECURITY-DEFINER-Funktionen im Wortlaut laufen.
const GRUND = `
do $$ begin
  begin create role anon nologin; exception when duplicate_object then null; end;
  begin create role authenticated nologin; exception when duplicate_object then null; end;
  begin create role service_role nologin bypassrls; exception when duplicate_object then null; end;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, created_at timestamptz default now(), raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.jwt() returns jsonb language sql stable as $f$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $f$;
create or replace function auth.uid() returns uuid language sql stable as $f$ select nullif(auth.jwt() ->> 'sub', '')::uuid $f$;
create or replace function auth.role() returns text language sql stable as $f$ select coalesce(auth.jwt() ->> 'role', 'anon') $f$;
create or replace function auth.email() returns text language sql stable as $f$ select auth.jwt() ->> 'email' $f$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
-- Vorgabe-Rechte wie live (pg_default_acl, gelesen 10.11.2026): neue Tabellen bekommen
-- alle Rechte fuer anon/authenticated/service_role — der Schutz ist RLS.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

let zaehler = 0;
const offeneDbs = new Set();
function neu(name) {
  const db = ('gs_rls_' + String(name).replace(/[^a-z0-9_]/gi, '_') + '_' + process.pid + '_' + (++zaehler)).toLowerCase();
  let r = psql('postgres', 'drop database if exists ' + db + ' with (force); create database ' + db + ';');
  if (!r.ok) throw new Error('Datenbank ' + db + ' nicht angelegt: ' + r.err.split('\n')[0]);
  offeneDbs.add(db);
  r = psql(db, GRUND);
  if (!r.ok) throw new Error('Grundgeruest: ' + r.err.split('\n')[0]);
  const d = {
    name: db,
    versuch: (text) => psql(db, text),
    sql: (text) => { const x = psql(db, text); if (!x.ok) throw new Error('SQL: ' + x.err.split('\n').slice(0, 2).join(' | ')); return x.out; },
    als: (uid, text, opts) => {
      opts = opts || {};
      const rolle = opts.rolle || (uid ? 'authenticated' : 'anon');
      const claims = JSON.stringify({ sub: uid || '', role: rolle, email: opts.email || (uid ? 'u-' + String(uid).slice(0, 8) + '@example.invalid' : '') });
      return psql(db, "begin;\nselect set_config('request.jwt.claims', '" + claims.replace(/'/g, "''") + "', true) \\g /dev/null\nset local role " + rolle + ";\n" + text + "\n;\ncommit;");
    },
    migration: (datei) => {
      const p = path.join(MIG, datei);
      if (!fs.existsSync(p)) return { ok: false, err: 'Migration fehlt: ' + datei };
      const x = psql(db, fs.readFileSync(p, 'utf8'));
      return { ok: x.ok, err: x.err };
    },
    weg: () => { psql('postgres', 'drop database if exists ' + db + ' with (force);'); offeneDbs.delete(db); },
  };
  return d;
}

const h = {
  repo: REPO, neu,
  U1: '11111111-1111-4111-8111-111111111111', U2: '22222222-2222-4222-8222-222222222222',
  U3: '33333333-3333-4333-8333-333333333333', ADMIN: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  migrationText: (datei) => fs.readFileSync(path.join(MIG, datei), 'utf8'),
  gibtMigration: (datei) => fs.existsSync(path.join(MIG, datei)),
};

(async () => {
  console.log('\n=== rls_check — haelt die Datenbank, was die App ueber sie annimmt?');
  if (!dateien.length) { console.log('  keine Fall-Dateien in scripts/rls/' + (filter.length ? ' fuer ' + filter.join(',') : '')); process.exitCode = filter.length ? 1 : 0; return; }
  if (!pgDa()) {
    console.log('  nicht pruefbar: kein lokales Postgres erreichbar (' + PG_URL.replace(/\/\/[^@]*@/, '//…@') + ').');
    console.log('  Start: bash scripts/_pg_local.sh start   — ohne Postgres wird NICHTS nachgespielt, also auch nichts gruen.');
    process.exitCode = 2; return;
  }
  let n = 0, kaputt = 0;
  for (const dn of dateien) {
    let faelle;
    try { faelle = require(path.join(DIR, dn)); }
    catch (e) { kaputt++; n++; console.log('  !!   ' + dn + ' laesst sich nicht laden\n         → ' + String(e.message).split('\n')[0]); continue; }
    if (!Array.isArray(faelle)) { kaputt++; n++; console.log('  !!   ' + dn + ' exportiert keine Liste'); continue; }
    console.log('  — ' + dn + ' (' + faelle.length + ')');
    for (const f of faelle) {
      n++;
      let r;
      try { r = await f.lauf(h); } catch (e) { r = { ok: false, warum: 'Ausnahme: ' + String(e && e.message || e).split('\n')[0] }; }
      if (r && r.ok) console.log('  ok   ' + f.name + (r.info ? '   [' + r.info + ']' : ''));
      else { kaputt++; console.log('  !!   ' + f.name + '\n         → ' + ((r && r.warum) || 'unbekannt')); }
    }
  }
  for (const db of Array.from(offeneDbs)) psql('postgres', 'drop database if exists ' + db + ' with (force);');
  console.log('  ---');
  console.log('  Faelle geprueft: ' + n + ' · davon kaputt: ' + kaputt + ' · Dateien: ' + dateien.length);
  console.log('  Grenze: nachgespielt ist ein Ausschnitt des Live-Stands (Datum je Fall) in einem lokalen');
  console.log('  Postgres. Ob die Migration live dasselbe tut, zeigt erst das Anwenden (FUER-FERNANDO).');
  process.exitCode = kaputt ? 1 : 0;
})();
