// KI-Kontingent: wird VOR dem Aufruf atomar reserviert — und nur der Server darf reservieren
// (Sicherheitspruefung 10.11.2026, v33.59; Migration 20261110_sicherheit_ki_kontingent.sql).
//
// Nachgespielt: feature_usage im Wortlaut des Live-Stands (columns/constraints/policies,
// gelesen 10.11.2026: PK user_id·feature·period_type·period_start, RLS nur fu_own_read).
// Reproduktion: die alte Bauform des ai-proxy („zaehlen, dann rufen, dann buchen") als
// Funktion mit einer Pause an der Stelle des KI-Aufrufs — 20 parallele Anfragen bei Limit 15
// kommen ALLE durch. Danach die Migration (zweimal) und dieselben 20 parallel: genau 15.
'use strict';
const { spawn } = require('child_process');

const PG_URL = process.env.GS_PG_URL || 'postgresql://postgres@127.0.0.1:54329/postgres';
function url(db) { return PG_URL.replace(/\/[^\/?]*(\?.*)?$/, '/' + db + '$1'); }
const MIG = '20261110_sicherheit_ki_kontingent.sql';

// N psql-Prozesse GLEICHZEITIG, je als service_role (wie die Edge-Function)
function parallel(db, n, sql) {
  const claims = JSON.stringify({ sub: '', role: 'service_role' });
  const text = "begin;\nselect set_config('request.jwt.claims', '" + claims + "', true) \\g /dev/null\nset local role service_role;\n" + sql + "\n;\ncommit;";
  return Promise.all(Array.from({ length: n }, () => new Promise((res) => {
    const p = spawn('psql', [url(db), '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-A', '-t', '-f', '-']);
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; }); p.stderr.on('data', d => { err += d; });
    p.on('close', (code) => res({ ok: code === 0, out: out.trim(), err: err.trim() }));
    p.stdin.end(text);
  })));
}

const GERUEST = (h) => `
insert into auth.users (id, email) values ('${h.U1}', 'a@example.invalid'), ('${h.U2}', 'b@example.invalid');
create table public.feature_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null,
  period_type text not null default 'day',
  period_start date not null,
  used int4 not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, feature, period_type, period_start));
alter table public.feature_usage enable row level security;
create policy fu_own_read on public.feature_usage for select to authenticated using ((select auth.uid()) = user_id);
-- die alte Bauform (ai-proxy bis v33.56): zaehlen, „KI rufen" (Pause), danach buchen
create table public.ai_usage (id bigserial primary key, user_id uuid not null, day date not null default current_date);
create function public.alt_zaehlen_rufen_buchen(p_user uuid, p_limit int) returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  select count(*) into n from public.ai_usage where user_id = p_user and day = current_date;
  if n >= p_limit then return false; end if;
  perform pg_sleep(0.3);
  insert into public.ai_usage (user_id) values (p_user);
  return true;
end $$;
`;

module.exports = [
  {
    name: 'KI-Kontingent · alte Bauform laesst 20 von 20 parallelen Anfragen bei Limit 15 durch; nach der Migration genau 15 — anon und angemeldete Nutzer duerfen nicht reservieren, nicht zuruecksetzen',
    lauf: async (h) => {
      if (!h.gibtMigration(MIG)) return { ok: false, warum: 'Migration fehlt: ' + MIG };
      const d = h.neu('ki_kontingent');
      try {
        d.sql(GERUEST(h));
        // Reproduktion: die alte Regel MUSS ueberlaufen, sonst misst der Rest nichts
        const alt = await parallel(d.name, 20, `select public.alt_zaehlen_rufen_buchen('${h.U1}', 15);`);
        const altJa = alt.filter(r => r.ok && r.out === 't').length;
        if (altJa <= 15) return { ok: false, warum: 'Reproduktion: alte Bauform liess nur ' + altJa + ' durch — der Fall misst nichts' };

        for (let i = 0; i < 2; i++) { const m = d.migration(MIG); if (!m.ok) return { ok: false, warum: 'Migration (' + (i + 1) + '. Lauf): ' + m.err.split('\n')[0] }; }

        const neu = await parallel(d.name, 20, `select public.fn_ai_kontingent_reservieren('${h.U1}', 'ai-proxy', 15);`);
        const fehler = neu.filter(r => !r.ok);
        if (fehler.length) return { ok: false, warum: 'Aufruf scheitert: ' + fehler[0].err.split('\n')[0] };
        const ja = neu.filter(r => r.out === 't').length, nein = neu.filter(r => r.out === 'f').length;
        if (ja !== 15 || nein !== 5) return { ok: false, warum: 'parallel: ' + ja + ' Zusagen, ' + nein + ' Absagen (erwartet 15/5)' };
        const stand = d.sql(`select used from public.feature_usage where user_id = '${h.U1}' and feature = 'ki:ai-proxy';`);
        if (stand !== '15') return { ok: false, warum: 'Zaehler steht auf ' + stand };

        // getrennt je Function und je Nutzer
        const andere = d.als(null, `select public.fn_ai_kontingent_reservieren('${h.U1}', 'plan-iterate', 15), public.fn_ai_kontingent_reservieren('${h.U2}', 'ai-proxy', 15);`, { rolle: 'service_role' });
        if (andere.out !== 't\tt') return { ok: false, warum: 'andere Function/anderer Nutzer: ' + (andere.out || andere.err) };

        // Freigeben: einen Platz zurueck, nie unter 0
        const frei = d.als(null, `select public.fn_ai_kontingent_freigeben('${h.U1}', 'ai-proxy'); select public.fn_ai_kontingent_reservieren('${h.U1}', 'ai-proxy', 15), public.fn_ai_kontingent_reservieren('${h.U1}', 'ai-proxy', 15);`, { rolle: 'service_role' });
        if (!frei.ok || !/t\tf$/.test(frei.out)) return { ok: false, warum: 'Freigeben: ' + (frei.out || frei.err) };

        // unsinnige Eingaben → NEIN
        const unsinn = d.als(null, `select public.fn_ai_kontingent_reservieren('${h.U2}', 'x', 0), public.fn_ai_kontingent_reservieren('${h.U2}', 'a''b', 5), public.fn_ai_kontingent_reservieren(null, 'ai-proxy', 5);`, { rolle: 'service_role' });
        if (unsinn.out !== 'f\tf\tf') return { ok: false, warum: 'unsinnige Eingaben: ' + (unsinn.out || unsinn.err) };

        // nur der Server: anon und authenticated duerfen weder reservieren noch freigeben
        const anon = d.als(null, `select public.fn_ai_kontingent_reservieren('${h.U1}', 'ai-proxy', 99999);`);
        const selbst = d.als(h.U1, `select public.fn_ai_kontingent_reservieren('${h.U1}', 'ai-proxy', 99999);`);
        const freiSelbst = d.als(h.U1, `select public.fn_ai_kontingent_freigeben('${h.U1}', 'ai-proxy');`);
        for (const [was, r] of [['anon reserviert', anon], ['Nutzer reserviert', selbst], ['Nutzer gibt frei', freiSelbst]]) {
          if (r.ok || !/permission denied/.test(r.err)) return { ok: false, warum: was + ': ' + (r.out || r.err) };
        }
        // und der eigene Zaehler laesst sich nicht zuruecksetzen (RLS: nur Lesen)
        const reset = d.als(h.U1, `with u as (update public.feature_usage set used = 0 where user_id = '${h.U1}' returning 1) select count(*) from u;`);
        const weg = d.als(h.U1, `with u as (delete from public.feature_usage where user_id = '${h.U1}' returning 1) select count(*) from u;`);
        const liest = d.als(h.U1, `select used from public.feature_usage where feature = 'ki:ai-proxy';`);
        if (reset.out !== '0' || weg.out !== '0' || liest.out !== '15') return { ok: false, warum: 'Zuruecksetzen: ' + JSON.stringify({ reset: reset.out || reset.err, weg: weg.out || weg.err, liest: liest.out }) };
        return { ok: true, info: 'alt: ' + altJa + '/20 durch · neu: 15/20 · je Function und Nutzer getrennt · Freigeben gibt EINEN Platz · Unsinn → NEIN · anon/Nutzer: permission denied · Zaehler nicht ruecksetzbar · Migration zweimal' };
      } finally { d.weg(); }
    },
  },
];
