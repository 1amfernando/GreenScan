// Reihenfolge: eine AELTERE, noch nicht angewandte Migration darf eine v33.59-Reparatur nicht still
// rueckgaengig machen (v33.59, Schlusspruefung c1#1).
//
// Anlass: 20260831_kosten_und_cron_wachhund_v30_95.sql (live NICHT angewandt — fn_log_ai_usage hat
// live kein v_guessed) ersetzt fn_log_ai_usage per CREATE OR REPLACE. Nach
// 20261110_sicherheit_funktionen.sql eingespielt, stand wieder der Rumpf ohne Sperre fuer
// Nutzer-Sitzungen: negative Kosten, fremder Server-Name, keine Token-Deckel, kein Rate-Limit.
// Hausregel wie 20260907 ↔ 20261110_sicherheit_quiz_punkte (Marke „v33.59 tagesgebunden"): die neue
// Fassung traegt eine Marke, die alte Datei laesst eine markierte Funktion stehen — und die neue
// Fassung enthaelt, was die alte wollte (Schaetzung bei fehlendem p_model), damit es EINE Fassung ist.
//
// Gesucht (Klasse): jede aeltere Migration, die eine Funktion/Policy/Sicht/Trigger der sechs
// 20261110-Dateien ebenfalls anlegt und live nicht so steht. Gefunden: 20260831_kosten (hier) und
// 20260907_quiz_antwort_formate (fn_grant_quiz_top3_pro mit Waechter, fn_quiz_option_correct
// wortgleich — beide Reihenfolgen in 20_quiz.js, Endstand je Funktion verglichen). Alle anderen
// (v26_* … v30_*) stehen live so, wie sie sind (Rumpf-Vergleich gegen pg_get_functiondef) — ein
// erneutes Einspielen ist keine offene Migration.
'use strict';
const fs = require('fs');
const path = require('path');

const ALT = '20260831_kosten_und_cron_wachhund_v30_95.sql';
const NEU = '20261110_sicherheit_funktionen.sql';
const LIVE = fs.readFileSync(path.join(__dirname, '10_funktionen_live.sql'), 'utf8');

function aufbau(h, name) {
  const d = h.neu('reihe_' + name);
  d.sql(LIVE);
  d.sql(`create table if not exists public.system_events (id bigserial primary key, severity text, source text, event text, detail jsonb, created_at timestamptz default now());
         insert into auth.users (id) values ('${h.U1}'), ('${h.ADMIN}');
         insert into public.profiles (id, display_name, email, is_admin) values ('${h.U1}', 'Ueli', 'ueli@example.ch', false), ('${h.ADMIN}', 'Admin', 'admin@example.ch', true);`);
  return d;
}
const fn = (d) => d.sql(`select md5(prosrc) || '|' || array_to_string(proconfig, ',') || '|' || prosecdef::text from pg_proc where proname = 'fn_log_ai_usage'`);
const marke = (d) => d.sql(`select (prosrc like '%v33.59 ai_usage_sperre%')::text from pg_proc where proname = 'fn_log_ai_usage'`);
const zeilen = (d) => d.sql(`select coalesce(string_agg(edge_fn || '=' || total_cost_chf::numeric(12,4), ' ' order by edge_fn), '') from public.ai_daily_usage`);
const angriff = (d, h) => d.als(h.U1, `select public.fn_log_ai_usage('pest-identify', 5, 5, -5000, null);`);

module.exports = [
  {
    name: 'Reihenfolge · 20260831 (alt, nicht angewandt) nach 20261110 eingespielt machte die Sperre in fn_log_ai_usage rueckgaengig — danach in BEIDEN Reihenfolgen derselbe Rumpf, die App bucht nur unter „client…", ohne negative Kosten; die alte Schaetzung bei fehlendem Modell lebt in der neuen Fassung',
    lauf: async (h) => {
      const stand = {};
      for (const folge of [[ALT, NEU], [NEU, ALT]]) {
        const d = aufbau(h, folge[0].slice(0, 8));
        try {
          for (const f of folge.concat(folge[1])) {   // die zweite Datei zweimal (Idempotenz)
            const m = d.migration(f);
            if (!m.ok) return { ok: false, warum: f + ': ' + m.err.split('\n').find(z => /ERROR/.test(z)) };
          }
          const a = angriff(d, h);
          stand[folge[0].slice(0, 8) + '→' + folge[1].slice(0, 8)] = { fn: fn(d), marke: marke(d), zeilen: zeilen(d), a };
          // Server-Weg ohne Modell: 2× 1 Mio. Token geschaetzt (Sonnet-Tarif 2.70) statt 0 — und EINE Spur je Tag
          const srv = d.als(null, `select public.fn_log_ai_usage('knowledge-bulk-gen', 1000000, 0, null, null); select public.fn_log_ai_usage('knowledge-bulk-gen', 1000000, 0, null, null);`, { rolle: 'service_role' });
          const s = d.sql(`select total_cost_chf::numeric(12,4) || '|' || call_count || '|' || (select count(*) from public.system_events where event = 'model_missing' and detail->>'edge_fn' = 'knowledge-bulk-gen') from public.ai_daily_usage where edge_fn = 'knowledge-bulk-gen'`);
          stand[folge[0].slice(0, 8) + '→' + folge[1].slice(0, 8)].srv = srv.ok ? s : 'Fehler: ' + srv.err.split('\n')[0];
        } finally { d.weg(); }
      }
      const [a, b] = Object.values(stand);
      const sperreHaelt = (x) => x.a.ok && x.zeilen === 'client:pest-identify=0.0001' && x.marke === 'true';
      const bericht = Object.entries(stand).map(([k, x]) => k + ': ' + x.zeilen + ' marke=' + x.marke + ' srv=' + x.srv).join(' · ');
      if (!sperreHaelt(a) || !sperreHaelt(b)) return { ok: false, warum: 'die Sperre haelt nicht in jeder Reihenfolge: ' + bericht };
      if (a.fn !== b.fn) return { ok: false, warum: 'zwei Fassungen je nach Reihenfolge: ' + a.fn + ' gegen ' + b.fn };
      if (a.srv !== '5.4000|2|1' || b.srv !== '5.4000|2|1') return { ok: false, warum: 'Schaetzung ohne Modell (v30.95) fehlt: ' + bericht };
      // Gegenprobe: die alte Datei OHNE ihren Waechter nach der neuen → die Sperre ist wieder weg
      const g = aufbau(h, 'gp');
      try {
        if (!g.migration(NEU).ok) return { ok: false, warum: 'Gegenprobe: ' + NEU };
        let t = h.migrationText(ALT);
        const w = "                AND p.prosrc LIKE '%v33.59 ai_usage_sperre%') THEN";
        if (t.indexOf(w) < 0) return { ok: false, warum: 'Gegenprobe: Waechter-Zeile nicht in ' + ALT };
        t = t.replace(w, "                AND false) THEN");
        const x = g.versuch(t);
        if (!x.ok) return { ok: false, warum: 'Gegenprobe-Migration: ' + x.err.split('\n')[0] };
        angriff(g, h);
        const z = zeilen(g);
        if (z.indexOf('pest-identify=-5000') < 0) return { ok: false, warum: 'Gegenprobe ohne Waechter bleibt gruen: ' + z };
      } finally { g.weg(); }
      return { ok: true, info: bericht + ' · Rumpf in beiden Reihenfolgen gleich · Gegenprobe ohne Waechter: pest-identify=-5000' };
    },
  },
];
