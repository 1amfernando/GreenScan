// Gruppe q1 — Datenbank-Funktionen, die einem Parameter vertrauen oder zu weit offen sind
// (v33.59, Migration 20261110_sicherheit_funktionen.sql).
//
// Jeder Fall: Live-Ausschnitt (10_funktionen_live.sql, gelesen 10.11.2026, Funktionen im
// Wortlaut mit Live-ACL) → Angriff GELINGT → Migration zweimal → Angriff scheitert →
// erlaubter Weg (Trigger, Cron als postgres, Edge-Function als service_role, die App)
// geht weiter → wo billig eine Gegenprobe: die entscheidende Zeile der Migration
// weggelassen, der Angriff gelingt wieder.
'use strict';
const fs = require('fs');
const path = require('path');

const MIG = '20261110_sicherheit_funktionen.sql';
const LIVE = fs.readFileSync(path.join(__dirname, '10_funktionen_live.sql'), 'utf8');
const VOR = 'https://vowbiueikwrauuceilhc.supabase.co/storage/v1/object/public/species-images/';

function aufbau(h, name) {
  const d = h.neu('q1_' + name);
  d.sql(LIVE);
  d.sql(`insert into auth.users (id) values ('${h.U1}'), ('${h.U2}'), ('${h.U3}'), ('${h.ADMIN}');
         insert into public.profiles (id, display_name, email, is_admin) values
           ('${h.U1}', 'Ueli', 'ueli@example.ch', false), ('${h.U2}', null, 'geheim.name@example.ch', false),
           ('${h.U3}', 'Anna''s Garten', 'anna@example.ch', false), ('${h.ADMIN}', 'Admin', 'admin@example.ch', true);`);
  return d;
}
function zweimal(d) {
  for (let i = 1; i <= 2; i++) {
    const r = d.migration(MIG);
    if (!r.ok) throw new Error('Migration Lauf ' + i + ': ' + r.err.split('\n')[0]);
  }
}
// Gegenprobe: die Migration OHNE eine Zeile; die Zeile muss es geben, sonst prueft die Gegenprobe nichts.
function ohne(h, zeilen) {
  let t = h.migrationText(MIG);
  for (const z of [].concat(zeilen)) {
    const i = t.indexOf(z);
    if (i < 0) throw new Error('Gegenprobe: Zeile nicht in der Migration: ' + z.slice(0, 60));
    t = t.slice(0, i) + t.slice(i + z.length);
  }
  return t;
}
const verweigert = (r) => !r.ok && /permission denied/.test(r.err);

module.exports = [
  {
    name: 'q1 · fn_quest_increment: niemand setzt Quest/XP eines FREMDEN Kontos — der Trigger zaehlt weiter',
    lauf: async (h) => {
      const setup = (d) => d.sql(`insert into public.quests (slug, title, target_metric, target_value, xp_reward, starts_at, ends_at)
        values ('p5', 'Fuenf Beitraege', 'posts_count', 5, 50, now() - interval '1 day', now() + interval '1 day');`);
      // zweimal: der erste Aufruf legt die Zeile an (completed bleibt false), erst der zweite schliesst ab und vergibt XP
      const angriff = (d) => d.als(h.U1, `select public.fn_quest_increment('${h.U2}', 'posts_count', 1000); select public.fn_quest_increment('${h.U2}', 'posts_count', 1000);`);
      const xp = (d) => d.sql(`select xp || '|' || (select count(*) from public.notifications where user_id = '${h.U2}') from public.profiles where id = '${h.U2}';`);
      let d = aufbau(h, 'quest');
      try {
        setup(d);
        const a = angriff(d);
        if (!a.ok || xp(d) !== '50|1') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht (misst nichts): ' + JSON.stringify(a) + ' xp|notif=' + xp(d) };
        d.sql(`update public.profiles set xp = 0 where id = '${h.U2}'; delete from public.user_quest_progress; delete from public.notifications;`);
        zweimal(d);
        const b = angriff(d);
        if (!verweigert(b) || xp(d) !== '0|0') return { ok: false, warum: 'nach der Migration: ' + JSON.stringify(b) + ' xp|notif=' + xp(d) };
        const t = d.als(h.U2, `insert into public.social_posts (user_id, text) values ('${h.U2}', 'hallo');`);
        const fort = d.sql(`select current_value from public.user_quest_progress where user_id = '${h.U2}';`);
        if (!t.ok || fort !== '1') return { ok: false, warum: 'Trigger-Weg bricht: ' + JSON.stringify(t) + ' Fortschritt=' + fort };
        const s = d.als(null, `select public.fn_quest_increment('${h.U2}', 'posts_count', 99);`, { rolle: 'service_role' });
        const fort2 = d.sql(`select current_value from public.user_quest_progress where user_id = '${h.U2}';`);
        if (!s.ok || fort2 !== '5') return { ok: false, warum: 'service_role-Weg / Deckel 10: ' + JSON.stringify(s) + ' Fortschritt=' + fort2 };
      } finally { d.weg(); }
      d = aufbau(h, 'quest_gp');
      try {
        setup(d);
        d.sql(ohne(h, "    'public.fn_quest_increment(uuid,text,integer)',\n"));
        const g = angriff(d);
        if (!g.ok || xp(d) !== '50|1') return { ok: false, warum: 'Gegenprobe ohne REVOKE: Angriff gelingt NICHT — die Zeile misst nichts: ' + JSON.stringify(g) };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: U1 gibt U2 +50 XP und eine Mitteilung · nachher: permission denied, XP 0 · Trigger zaehlt (1) · service_role geht, Schritt auf 10 gedeckelt · Gegenprobe ohne REVOKE: Angriff gelingt' };
    },
  },
  {
    name: 'q1 · fn_check_rate_limit: kein Konto fuellt den Eimer eines anderen — Edge (service_role) und DEFINER-Aufrufer zaehlen weiter',
    lauf: async (h) => {
      const angriff = (d) => d.als(h.U1, `select count(*) filter (where not ok) from (select public.fn_check_rate_limit('${h.U2}', 'user_report', 20) as ok from generate_series(1, 25)) x;`);
      const stand = (d) => d.sql(`select coalesce(sum(count), 0) from public.rate_limits where bucket = '${h.U2}' and action = 'user_report';`);
      let d = aufbau(h, 'rate');
      try {
        const a = angriff(d);
        if (!a.ok || a.out !== '5' || stand(d) !== '25') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify(a) + ' stand=' + stand(d) };
        d.sql(`delete from public.rate_limits;`);
        zweimal(d);
        const b = angriff(d);
        if (!verweigert(b) || stand(d) !== '0') return { ok: false, warum: 'nach der Migration: ' + JSON.stringify(b) + ' stand=' + stand(d) };
        const s = d.als(null, `select public.fn_check_rate_limit('${h.U2}', 'pest_identify', 30);`, { rolle: 'service_role' });
        if (!s.ok || s.out !== 't') return { ok: false, warum: 'service_role-Weg (Edge-Functions) bricht: ' + JSON.stringify(s) };
        const c = d.als(h.U1, `select public.fn_contribute_species_image('PI1', '${VOR}${h.U1}/1731_abc.jpg', null, null::smallint) is not null;`);
        const eimer = d.sql(`select count from public.rate_limits where bucket = '${h.U1}' and action = 'species_contribute';`);
        if (!c.ok || c.out !== 't' || eimer !== '1') return { ok: false, warum: 'DEFINER-Aufrufer (fn_contribute_species_image) bricht: ' + JSON.stringify(c) + ' eimer=' + eimer };
      } finally { d.weg(); }
      d = aufbau(h, 'rate_gp');
      try {
        d.sql(ohne(h, "    'public.fn_check_rate_limit(text,text,integer)',\n"));
        const g = angriff(d);
        if (!g.ok || g.out !== '5') return { ok: false, warum: 'Gegenprobe ohne REVOKE: Angriff gelingt NICHT: ' + JSON.stringify(g) };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: U1 sperrt U2 (25 Buchungen, 5× false) · nachher: permission denied, 0 Buchungen · service_role zaehlt · fn_contribute_species_image zaehlt den EIGENEN Eimer · Gegenprobe gelingt' };
    },
  },
  {
    name: 'q1 · Scan-Cache: kein Konto legt ein Ergebnis fuer andere ab, niemand liest fremde — die Daten bleiben liegen',
    lauf: async (h) => {
      const gift = `{"name":"Steinpilz","confidence":97,"tox":0,"edible":true}`;
      const put = (d) => d.als(h.U1, `select public.fn_scan_cache_put('00000000deadbeef', '${gift}'::jsonb);`);
      const lies = (d, uid) => d.als(uid, `select result_json->>'name' from public.scan_cache where phash = '00000000deadbeef';`);
      let d = aufbau(h, 'cache');
      try {
        const a = put(d), l2 = lies(d, h.U2), la = lies(d, null);
        if (!a.ok || l2.out !== 'Steinpilz' || la.out !== 'Steinpilz') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify({ a, l2, la }) };
        zweimal(d);
        d.sql(`insert into public.scan_cache (phash, result_json) values ('1111111111111111', '{"name":"alt"}');`);
        const b = put(d), m2 = lies(d, h.U2), ma = lies(d, null);
        if (!verweigert(b)) return { ok: false, warum: 'fn_scan_cache_put nach der Migration: ' + JSON.stringify(b) };
        if (m2.ok || ma.ok) return { ok: false, warum: 'scan_cache nach der Migration lesbar: ' + JSON.stringify({ m2, ma }) };
        const bleibt = d.sql(`select count(*) from public.scan_cache;`);
        const s = d.als(null, `select public.fn_scan_cache_put('2222222222222222', '{"name":"srv"}'::jsonb);`, { rolle: 'service_role' });
        if (bleibt !== '2' || !s.ok) return { ok: false, warum: 'Daten/Serverweg: bleibt=' + bleibt + ' ' + JSON.stringify(s) };
      } finally { d.weg(); }
      d = aufbau(h, 'cache_gp');
      try {
        d.sql(`insert into public.scan_cache (phash, result_json) values ('00000000deadbeef', '${gift}'::jsonb);`);
        d.sql(ohne(h, ["    execute 'drop policy if exists scan_cache_read_all on public.scan_cache';\n", "    execute 'revoke all on table public.scan_cache from anon, authenticated';\n"]));
        const g = lies(d, h.U2);
        if (g.out !== 'Steinpilz') return { ok: false, warum: 'Gegenprobe ohne Policy-/Rechte-Zeilen: U2 liest NICHT: ' + JSON.stringify(g) };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: U1 legt „Steinpilz, essbar" ab, U2 und anon lesen es · nachher: Schreiben permission denied, Lesen permission denied (Fehler, kein leeres Ergebnis) · Zeilen bleiben (2) · service_role schreibt · Gegenprobe gelingt' };
    },
  },
  {
    name: 'q1 · fn_knowledge_grow: kein Nutzer loest KI-Anfragen aus, das Geheimnis steht nicht mehr im Rumpf — Server nimmt es aus app_settings',
    lauf: async (h) => {
      let d = aufbau(h, 'grow');
      try {
        d.sql(`insert into public.app_settings values ('knowledge_gen_secret', 'neu-aus-app-settings');`);
        const a = d.als(h.U1, `select public.fn_knowledge_grow('recipes', 1000) is not null;`);
        const vorher = d.sql(`select (body->>'count') || '|' || (headers->>'X-Admin-Secret') from net._aufrufe order by id desc limit 1;`);
        if (!a.ok || vorher !== '1000|<<GEHEIMNIS>>') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify(a) + ' ' + vorher };
        zweimal(d);
        const n0 = d.sql(`select count(*) from net._aufrufe;`);
        const b = d.als(h.U1, `select public.fn_knowledge_grow('recipes', 1000);`);
        const n1 = d.sql(`select count(*) from net._aufrufe;`);
        if (!verweigert(b) || n0 !== n1) return { ok: false, warum: 'nach der Migration: ' + JSON.stringify(b) + ' Aufrufe ' + n0 + '→' + n1 };
        const s = d.als(null, `select public.fn_knowledge_grow('recipes', 1000) is not null;`, { rolle: 'service_role' });
        const c = d.sql(`select public.fn_knowledge_grow('remedies', 3) is not null;`); // wie pg_cron: postgres, ohne Sitzung
        const nachher = d.sql(`select string_agg((body->>'count') || '|' || (headers->>'X-Admin-Secret'), ',' order by id) from net._aufrufe where id > ${n1};`);
        const rumpf = d.sql(`select position('GEHEIMNIS' in pg_get_functiondef('public.fn_knowledge_grow(text,integer)'::regprocedure));`);
        if (!s.ok || c !== 't' || nachher !== '15|neu-aus-app-settings,3|neu-aus-app-settings' || rumpf !== '0') return { ok: false, warum: 'Serverweg: ' + JSON.stringify(s) + ' ' + nachher + ' rumpf=' + rumpf };
      } finally { d.weg(); }
      d = aufbau(h, 'grow_gp');
      try {
        d.sql(`insert into public.app_settings values ('knowledge_gen_secret', 'x');`);
        d.sql(ohne(h, ["    'public.fn_knowledge_grow(text,integer)',\n", "  execute 'revoke all on function public.fn_knowledge_grow(text,integer) from public, anon, authenticated';\n"]));
        const g = d.als(h.U1, `select public.fn_knowledge_grow('recipes', 1);`);
        if (g.ok || !/forbidden/.test(g.err)) return { ok: false, warum: 'Gegenprobe ohne REVOKE: der Riegel im Rumpf greift nicht: ' + JSON.stringify(g) };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: U1 loest count=1000 mit dem Rumpf-Geheimnis aus · nachher: permission denied, 0 Aufrufe · service_role und Cron (postgres) senden mit app_settings, count 15 bzw. 3 · Rumpf ohne Geheimnis · ohne REVOKE haelt der zweite Riegel im Rumpf („forbidden")' };
    },
  },
  {
    name: 'q1 · fn_eng_* ×4, scans_this_month, gs_abo_can_use: keine Auskunft ueber FREMDE — engagement-push-checker (service_role) liest weiter',
    lauf: async (h) => {
      const fragen = [
        `select public.fn_eng_doctor_due('${h.U2}');`,
        `select public.fn_eng_battle_waiting('${h.U2}', 24);`,
        `select public.fn_eng_class_new('${h.U2}', 24);`,
        `select public.fn_eng_class_submissions('${h.U2}', 24);`,
        `select public.scans_this_month('${h.U2}');`,
        `select public.gs_abo_can_use('${h.U2}', 'scan');`,
      ];
      const seed = (d) => d.sql(`insert into public.plant_doctor_history (user_id, status, followup_due_at) values ('${h.U2}', 'open', now() - interval '1 hour');
                                 insert into public.user_scans (user_id) values ('${h.U2}'), ('${h.U2}');
                                 insert into public.quiz_battles (challenger_id, status, resolved_at) values ('${h.U2}', 'resolved', now());`);
      let d = aufbau(h, 'eng');
      try {
        seed(d);
        const vor = fragen.map(q => d.als(h.U1, q));
        if (vor.some(r => !r.ok) || vor[0].out !== 't' || vor[4].out !== '2' || vor[1].out !== '1') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify(vor.map(r => r.out || r.err)) };
        zweimal(d);
        const nach = fragen.map(q => d.als(h.U1, q));
        const offen = nach.filter(r => !verweigert(r));
        if (offen.length) return { ok: false, warum: offen.length + ' von 6 noch fuer authenticated ausfuehrbar: ' + JSON.stringify(offen.map(r => r.out || r.err)) };
        const srv = fragen.slice(0, 4).map(q => d.als(null, q, { rolle: 'service_role' }));
        if (srv.some(r => !r.ok) || srv[0].out !== 't') return { ok: false, warum: 'service_role-Weg bricht: ' + JSON.stringify(srv.map(r => r.out || r.err)) };
      } finally { d.weg(); }
      d = aufbau(h, 'eng_gp');
      try {
        seed(d);
        d.sql(ohne(h, "    'public.fn_eng_doctor_due(uuid)',\n"));
        const g = d.als(h.U1, fragen[0]);
        if (!g.ok || g.out !== 't') return { ok: false, warum: 'Gegenprobe ohne REVOKE: Angriff gelingt NICHT: ' + JSON.stringify(g) };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: U1 erfaehrt Doktor-Termin, Battle, 2 Scans, Abo-Stand von U2 · nachher: 6 von 6 permission denied · service_role liest die vier fn_eng_* · Gegenprobe gelingt' };
    },
  },
  {
    name: 'q1 · fn_log_ai_usage + ai_daily_usage: die App bucht gedeckelt und unter „client…", nur Admins lesen — Edge-Functions buchen wie bisher',
    lauf: async (h) => {
      const angriff = (d) => d.als(h.U1, `select public.fn_log_ai_usage('pest-identify', -5, 2000000000, -5000, null);`);
      const zeile = (d, fn) => d.sql(`select total_tokens_in || '|' || total_tokens_out || '|' || total_cost_chf::numeric(12,4) || '|' || call_count from public.ai_daily_usage where edge_fn = '${fn}';`);
      let d = aufbau(h, 'aiu');
      try {
        const a = angriff(d), l = d.als(h.U1, `select count(*) from public.ai_daily_usage;`);
        if (!a.ok || zeile(d, 'pest-identify') !== '-5|2000000000|-5000.0000|1' || l.out !== '1') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify(a) + ' ' + zeile(d, 'pest-identify') + ' lesen=' + l.out };
        d.sql(`delete from public.ai_daily_usage;`);
        zweimal(d);
        const b = angriff(d);
        // ohne Modell: Sonnet-Tarif geschaetzt (v30.95, seit v33.59 in dieser Fassung) — nie die −5000 des Aufrufers
        if (!b.ok || zeile(d, 'pest-identify') !== '' || zeile(d, 'client:pest-identify') !== '0|64000|0.8448|1') return { ok: false, warum: 'nach der Migration: ' + JSON.stringify(b) + ' server=' + zeile(d, 'pest-identify') + ' client=' + zeile(d, 'client:pest-identify') };
        const app = d.als(h.U1, `select public.fn_log_ai_usage('client_scan', 1000000, 1000, null, 'claude-haiku-4-5');`);
        if (!app.ok || zeile(d, 'client_scan') !== '200000|1000|0.1844|1') return { ok: false, warum: 'App-Weg (_gsLogAiUsage): ' + JSON.stringify(app) + ' ' + zeile(d, 'client_scan') };
        const srv = d.als(null, `select public.fn_log_ai_usage('pest-identify', 10, 20, 0.5, null);`, { rolle: 'service_role' });
        if (!srv.ok || zeile(d, 'pest-identify') !== '10|20|0.5000|1') return { ok: false, warum: 'service_role-Weg: ' + JSON.stringify(srv) + ' ' + zeile(d, 'pest-identify') };
        const lu = d.als(h.U1, `select count(*) from public.ai_daily_usage;`), la = d.als(h.ADMIN, `select count(*) from public.ai_daily_usage;`);
        const vu = d.als(h.U1, `select count(*) from public.v_ai_usage_summary;`), va = d.als(h.ADMIN, `select count(*) from public.v_ai_usage_summary;`);
        if (lu.out !== '0' || vu.out !== '0' || la.out !== '3' || va.out !== '1') return { ok: false, warum: 'Lesen: Nutzer ' + lu.out + '/' + vu.out + ' Admin ' + la.out + '/' + va.out };
        const flut = d.als(h.U2, `do $$ begin for i in 1..605 loop perform public.fn_log_ai_usage('client_callAI', 1, 1, null, 'haiku'); end loop; end $$;`);
        if (!flut.ok || zeile(d, 'client_callAI').split('|')[3] !== '600') return { ok: false, warum: 'Deckel 600 je Stunde: ' + JSON.stringify(flut) + ' ' + zeile(d, 'client_callAI') };
      } finally { d.weg(); }
      d = aufbau(h, 'aiu_gp');
      try {
        d.sql(ohne(h, '    p_cost_chf := null;\n'));
        const g = d.als(h.U1, `select public.fn_log_ai_usage('x', 1, 1, -5000, null);`);
        if (!g.ok || zeile(d, 'client:x').split('|')[2] !== '-5000.0000') return { ok: false, warum: 'Gegenprobe ohne „p_cost_chf := null": negative Kosten kommen NICHT durch: ' + zeile(d, 'client:x') };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: U1 bucht −5000 CHF auf „pest-identify" und liest die Tabelle · nachher: Zeile „client:pest-identify", Kosten geschaetzt aus gedeckelten Tokens 0/64000 (0.8448 statt −5000) · App-Buchung mit Preistabelle · service_role unveraendert · lesen: Nutzer 0, Admin 3 (Sicht 1) · 605 Buchungen → 600 · Gegenprobe gelingt' };
    },
  },
  {
    name: 'q1 · fn_marketplace_search ohne E-Mail-Lokalteil, fn_knowledge_search mit Deckel 100',
    lauf: async (h) => {
      const d = aufbau(h, 'suche');
      try {
        d.sql(`insert into public.marketplace_listings (user_id, title) values ('${h.U2}', 'Tomatensetzlinge'), ('${h.U3}', 'Basilikum');
               insert into public.wissen (source_type, source_id, title, search_text) select 'tip', i::text, 'Tomate ' || i, 'Tomate pflegen ' || i from generate_series(1, 150) i;`);
        const name = () => d.als(null, `select string_agg(seller_name, ',' order by title) from public.fn_marketplace_search('', null, null, null, null, 50);`);
        const viel = () => d.als(null, `select count(*) from public.fn_knowledge_search('Tomate', 100000);`);
        const a = name(), k = viel();
        if (a.out !== "Anna's Garten,geheim.name" || k.out !== '150') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify({ a, k }) };
        zweimal(d);
        const b = name(), m = viel(), w = d.als(null, `select count(*) from public.fn_knowledge_search('Tomate', 5);`);
        if (b.out !== "Anna's Garten,Anonym") return { ok: false, warum: 'Verkaeufername nach der Migration: ' + JSON.stringify(b) };
        if (m.out !== '100' || w.out !== '5') return { ok: false, warum: 'Deckel: ' + JSON.stringify({ m, w }) };
        return { ok: true, info: 'vorher: anon liest „geheim.name" und 150 Treffer bei lim=100000 · nachher: „Anonym", Anzeigename mit Apostroph bleibt · 100 bzw. 5' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'q1 · fn_snapshot_index_usage: nur noch Cron (postgres) und service_role',
    lauf: async (h) => {
      let d = aufbau(h, 'idx');
      try {
        const a = d.als(h.U1, `select public.fn_snapshot_index_usage() > 0;`);
        if (!a.ok || a.out !== 't') return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify(a) };
        zweimal(d);
        const n0 = d.sql(`select count(*) from public.index_usage_snapshots;`);
        const b = d.als(h.U1, `select public.fn_snapshot_index_usage();`);
        const n1 = d.sql(`select count(*) from public.index_usage_snapshots;`);
        if (!verweigert(b) || n0 !== n1) return { ok: false, warum: 'nach der Migration: ' + JSON.stringify(b) };
        const c = d.sql(`select public.fn_snapshot_index_usage() > 0;`);
        const s = d.als(null, `select public.fn_snapshot_index_usage() > 0;`, { rolle: 'service_role' });
        if (c !== 't' || !s.ok || s.out !== 't') return { ok: false, warum: 'Cron/service_role: ' + c + ' ' + JSON.stringify(s) };
      } finally { d.weg(); }
      d = aufbau(h, 'idx_gp');
      try {
        d.sql(ohne(h, ",\n    'public.fn_snapshot_index_usage()'"));
        const g = d.als(h.U1, `select public.fn_snapshot_index_usage() > 0;`);
        if (!g.ok) return { ok: false, warum: 'Gegenprobe ohne REVOKE: Angriff gelingt NICHT: ' + JSON.stringify(g) };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: U1 schreibt Snapshot-Zeilen · nachher: permission denied, 0 neue · Cron als postgres und service_role gehen · Gegenprobe gelingt' };
    },
  },
  {
    name: 'q1 · fn_notify_friend_request: der Name des Absenders kommt ohne Zeilenumbruch/Steuerzeichen und hoechstens 40 Zeichen beim Empfaenger an',
    lauf: async (h) => {
      const boese = "E'Support-Team\\n\\u202E\\u0085\\u061C\\uFEFFWICHTIG: Konto gesperrt, melde dich unter evil.example ' || repeat('x', 300)";
      const titel = (d, uid) => d.sql(`select title from public.notifications where user_id = '${uid}' order by created_at desc limit 1;`);
      const sauber = (t) => !/[\u0000-\u001f\u0080-\u009f\u061c\u202e\ufeff]/.test(t) && t.length <= 40 + ' möchte dir folgen'.length;
      let d = aufbau(h, 'friend');
      try {
        d.sql(`update public.profiles set display_name = ${boese} where id = '${h.U1}';`);
        const a = d.als(h.U1, `insert into public.friendships (user_id, friend_id) values ('${h.U1}', '${h.U2}');`);
        const t0 = titel(d, h.U2);
        if (!a.ok || sauber(t0)) return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify(a) + ' titel=' + JSON.stringify(t0.slice(0, 80)) };
        d.sql(`delete from public.friendships; delete from public.notifications;`);
        zweimal(d);
        const b = d.als(h.U1, `insert into public.friendships (user_id, friend_id) values ('${h.U1}', '${h.U2}');`);
        const t1 = titel(d, h.U2);
        if (!b.ok || !sauber(t1) || t1.indexOf('Support-TeamWICHTIG') !== 0) return { ok: false, warum: 'nach der Migration: ' + JSON.stringify(b) + ' titel=' + JSON.stringify(t1) };
        d.sql(`update public.profiles set display_name = 'Zoë''s 🌿 Garten' where id = '${h.U3}';`);
        const c = d.als(h.U3, `insert into public.friendships (user_id, friend_id) values ('${h.U3}', '${h.U2}');`);
        const t2 = titel(d, h.U2);
        d.sql(`update public.friendships set status = 'accepted' where user_id = '${h.U2}' or friend_id = '${h.U2}';`);
        d.sql(`update public.profiles set display_name = '   ' where id = '${h.U2}';`);
        const t3 = titel(d, h.U1);
        if (!c.ok || t2 !== "Zoë's 🌿 Garten möchte dir folgen" || !/^(Dein Kontakt|Jemand)/.test(t3)) return { ok: false, warum: 'gutartiger Name / Annahme: ' + JSON.stringify({ t2, t3 }) };
      } finally { d.weg(); }
      d = aufbau(h, 'friend_gp');
      try {
        d.sql(`update public.profiles set display_name = ${boese} where id = '${h.U1}';`);
        d.sql(ohne(h, "    _name := NULLIF(left(btrim(regexp_replace(coalesce(_name, ''), '[\\x01-\\x1F\\x7F-\\x9F\\u061C\\u200B-\\u200F\\u2028-\\u202E\\u2060-\\u2069\\uFEFF]', '', 'g')), 40), '');\n"));
        d.als(h.U1, `insert into public.friendships (user_id, friend_id) values ('${h.U1}', '${h.U2}');`);
        if (sauber(titel(d, h.U2))) return { ok: false, warum: 'Gegenprobe ohne Bereinigung: Titel ist trotzdem sauber — die Zeile misst nichts' };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: 200 Zeichen mit \\n, U+202E, U+0085 (C1), U+061C, U+FEFF im Titel des Empfaengers · nachher: ohne alle, ≤ 40 Zeichen Name · „Zoë\'s 🌿 Garten" unveraendert · Gegenprobe gelingt' };
    },
  },
  {
    name: 'q1 · fn_contribute_species_image: nur die eigene Datei im Bucket species-images — wie gsUploadImage sie erzeugt',
    lauf: async (h) => {
      const beitrag = (d, uid, url, sp) => d.als(uid, `select public.fn_contribute_species_image('${sp || 'PI1'}', '${url}', null, 80::smallint) is not null;`);
      const boese = ['https://boese.example/steinpilz.jpg', VOR + h.U2 + '/1731_abc.jpg', VOR + h.U1 + '/../' + h.U2 + '/a.jpg', VOR + h.U1 + '/a.jpg?x=1', VOR + h.U1 + '/a.html', VOR + h.U1 + '/a.svg', 'http://vowbiueikwrauuceilhc.supabase.co/storage/v1/object/public/species-images/' + h.U1 + '/a.jpg'];
      let d = aufbau(h, 'simg');
      try {
        const vor = boese.map((u, i) => beitrag(d, h.U1, u, 'V' + i));
        if (!vor[0].ok || !vor[1].ok) return { ok: false, warum: 'Angriff vor der Migration gelingt nicht: ' + JSON.stringify(vor.slice(0, 2)) };
        d.sql(`delete from public.species_images;`);
        zweimal(d);
        const nach = boese.map((u, i) => beitrag(d, h.U1, u, 'N' + i));
        const durch = nach.filter(r => r.ok || !/valid url required/.test(r.err));
        if (durch.length) return { ok: false, warum: durch.length + ' von ' + boese.length + ' fremden Adressen angenommen: ' + JSON.stringify(nach.map(r => r.ok ? 'ok' : r.err.split('\n')[0])) };
        const g1 = beitrag(d, h.U1, VOR + h.U1 + '/1731234567890_k3x9ab.jpg', 'G1');
        const g2 = beitrag(d, h.U1, VOR + h.U1 + '/k1a2b3c_PI427steinpilz.jpg', 'G2');
        const pfad = d.sql(`select string_agg(storage_path, ',' order by species_id) from public.species_images;`);
        if (!g1.ok || !g2.ok || pfad !== h.U1 + '/1731234567890_k3x9ab.jpg,' + h.U1 + '/k1a2b3c_PI427steinpilz.jpg') return { ok: false, warum: 'gutartiger Weg: ' + JSON.stringify({ g1, g2, pfad }) };
      } finally { d.weg(); }
      d = aufbau(h, 'simg_gp');
      try {
        d.sql(ohne(h, "  IF v_pfad !~ ('^' || v_uid::text || '/[A-Za-z0-9_-]{1,120}\\.(jpe?g|png|webp)$') THEN\n    RAISE EXCEPTION 'valid url required';\n  END IF;\n"));
        const g = beitrag(d, h.U1, VOR + h.U2 + '/1731_abc.jpg');
        if (!g.ok) return { ok: false, warum: 'Gegenprobe ohne Pfadpruefung: fremder Ordner trotzdem abgewiesen: ' + JSON.stringify(g) };
      } finally { d.weg(); }
      return { ok: true, info: 'vorher: fremder Host und fremder Ordner angenommen · nachher: 7 von 7 „valid url required" (Host, fremder Ordner, ../, ?query, http, .html, .svg) · eigene Datei geht, storage_path aus der Adresse · Gegenprobe gelingt' };
    },
  },
];
