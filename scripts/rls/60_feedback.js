// Feedback-Stimmen: zaehlt der Server eine Stimme, die kein Staff abgibt?
// (Nebenbefund der Sicherheitspruefung 10.11.2026, v33.59; Migration 20261110_feedback_stimmen_zaehlen.sql)
//
// Nachgespielt im Wortlaut des Live-Stands (gelesen 10.11.2026): feedback_items und
// feedback_votes mit ihren Spalten, die Policies beider Tabellen, der Trigger
// trg_feedback_votes_aggregate und fn_update_feedback_votes als SECURITY INVOKER.
// fn_role_at_least ist auf das Noetige verkuerzt (Rolle aus profiles.role).
// Reproduktion: eine Stimme eines normalen Nutzers laesst votes_up auf 0 — sonst misst
// der Fall nichts. Danach die Migration zweimal, dieselbe Stimme zaehlt; Gegenprobe:
// die alte Funktion zurueck → die naechste Stimme zaehlt wieder nicht.
'use strict';
const MIG = '20261110_feedback_stimmen_zaehlen.sql';

const ALT_FN = `
CREATE OR REPLACE FUNCTION public.fn_update_feedback_votes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_item uuid := COALESCE(NEW.item_id, OLD.item_id);
BEGIN
  UPDATE public.feedback_items SET
    votes_up = (SELECT COUNT(*) FROM public.feedback_votes WHERE item_id = v_item AND dir = 'up'),
    votes_down = (SELECT COUNT(*) FROM public.feedback_votes WHERE item_id = v_item AND dir = 'down')
  WHERE id = v_item;
  RETURN COALESCE(NEW, OLD);
END;
$function$;`;

const GERUEST = (h) => `
insert into auth.users (id, email) values ('${h.U1}', 'a@example.invalid'), ('${h.U2}', 'b@example.invalid'), ('${h.U3}', 'c@example.invalid'), ('${h.ADMIN}', 's@example.invalid');
create table public.profiles (id uuid primary key, role text default 'user');
insert into public.profiles (id, role) values ('${h.U1}', 'user'), ('${h.U2}', 'user'), ('${h.U3}', 'user'), ('${h.ADMIN}', 'staff');
create function public.fn_role_at_least(_required text, _uid uuid default null) returns boolean
  language sql stable security definer set search_path = public, pg_catalog as $f$
  select coalesce((select role in ('admin','staff') from public.profiles where id = coalesce(_uid, (select auth.uid()))), false) $f$;
create table public.feedback_items (
  id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null,
  kind text not null, content text not null, app_version text, context jsonb default '{}'::jsonb,
  ki_status text default 'pending', ki_priority int2 default 0, ki_rationale text default '', ki_action text default '',
  votes_up int4 default 0, votes_down int4 default 0, done_by text, done_at timestamptz, done_version text,
  created_at timestamptz default now());
create table public.feedback_votes (
  id uuid primary key default gen_random_uuid(), item_id uuid not null references public.feedback_items(id) on delete cascade,
  voter_key text not null, dir text not null check (dir = any (array['up','down'])), created_at timestamptz default now(),
  unique (item_id, voter_key));
alter table public.feedback_items enable row level security;
alter table public.feedback_votes enable row level security;
create policy feedback_items_insert_validated on public.feedback_items for insert with check (((( select auth.uid() as uid) is null) and (user_id is null)) or ((( select auth.uid() as uid) is not null) and ((user_id is null) or (user_id = ( select auth.uid() as uid)))));
create policy feedback_items_select_own_or_staff on public.feedback_items for select using (((( select auth.uid() as uid) = user_id) or fn_role_at_least('staff'::text)));
create policy feedback_items_update_admin on public.feedback_items for update using (fn_role_at_least('staff'::text));
create policy feedback_votes_delete_own on public.feedback_votes for delete using (((voter_key = ( select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and (( select auth.uid() as uid) is null))));
create policy feedback_votes_insert_own on public.feedback_votes for insert with check (((voter_key = ( select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and (( select auth.uid() as uid) is null))));
create policy feedback_votes_select_all on public.feedback_votes for select using (true);
create policy feedback_votes_update_own on public.feedback_votes for update using (((voter_key = ( select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and (( select auth.uid() as uid) is null)))) with check (((voter_key = ( select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and (( select auth.uid() as uid) is null))));
${ALT_FN}
create trigger trg_feedback_votes_aggregate after insert or delete or update on public.feedback_votes for each row execute function fn_update_feedback_votes();
insert into public.feedback_items (id, user_id, kind, content) values
  ('f0000000-0000-4000-8000-000000000001', '${h.U1}', 'idea', 'Dunkelmodus fuer die Karte'),
  ('f0000000-0000-4000-8000-000000000002', '${h.U1}', 'bug', 'Zweite Idee');
`;
const I1 = 'f0000000-0000-4000-8000-000000000001';
const I2 = 'f0000000-0000-4000-8000-000000000002';

// Die App stimmt per Upsert ab (Prefer: resolution=merge-duplicates) und nimmt per DELETE zurueck.
const STIMME = (uid, item, dir) => `insert into public.feedback_votes (item_id, voter_key, dir) values ('${item}', '${uid}', '${dir}') on conflict (item_id, voter_key) do update set dir = excluded.dir;`;
const ZAHL = (item) => `select votes_up || '/' || votes_down from public.feedback_items where id = '${item}';`;

module.exports = [
  {
    name: 'Feedback · eine Stimme eines normalen Nutzers erhoeht den Zaehler (vorher: 0, still); Umstimmen, Zuruecknehmen, Bestand nachgezaehlt — Gegenprobe mit der alten Funktion',
    lauf: async (h) => {
      if (!h.gibtMigration(MIG)) return { ok: false, warum: 'Migration fehlt: ' + MIG };
      const d = h.neu('feedback');
      try {
        d.sql(GERUEST(h));
        // Reproduktion: zwei Stimmen gehen durch, der Zaehler bleibt 0/0 — ohne Fehler
        const a = d.als(h.U2, STIMME(h.U2, I1, 'up'));
        const b = d.als(h.U3, STIMME(h.U3, I1, 'up'));
        if (!a.ok || !b.ok) return { ok: false, warum: 'Stimme scheitert schon vorher: ' + (a.err || b.err) };
        const vorher = d.sql(ZAHL(I1));
        if (vorher !== '0/0') return { ok: false, warum: 'Reproduktion: vor der Migration steht ' + vorher + ' — der Fall misst nichts' };
        // Staff-Stimme zaehlt schon vorher (so faellt es niemandem auf, der selbst Staff ist)
        d.als(h.ADMIN, STIMME(h.ADMIN, I2, 'down'));
        const staffVorher = d.sql(ZAHL(I2));

        for (let i = 0; i < 2; i++) { const m = d.migration(MIG); if (!m.ok) return { ok: false, warum: 'Migration (' + (i + 1) + '. Lauf): ' + m.err.split('\n')[0] }; }
        const bestand = d.sql(ZAHL(I1));
        if (bestand !== '2/0') return { ok: false, warum: 'Bestand nicht nachgezaehlt: ' + bestand + ' (erwartet 2/0)' };

        const c = d.als(h.U1, STIMME(h.U1, I1, 'down'));
        const nach1 = d.sql(ZAHL(I1));
        const um = d.als(h.U2, STIMME(h.U2, I1, 'down'));
        const nach2 = d.sql(ZAHL(I1));
        const weg = d.als(h.U3, `delete from public.feedback_votes where item_id = '${I1}' and voter_key = '${h.U3}';`);
        const nach3 = d.sql(ZAHL(I1));
        if (!c.ok || !um.ok || !weg.ok) return { ok: false, warum: 'Stimme nach der Migration scheitert: ' + (c.err || um.err || weg.err) };
        if (nach1 !== '2/1' || nach2 !== '1/2' || nach3 !== '0/2') return { ok: false, warum: 'Zaehler: ' + [nach1, nach2, nach3].join(' → ') + ' (erwartet 2/1 → 1/2 → 0/2)' };

        // Die Zaehler kann ein Nutzer weiterhin nicht selbst setzen
        const selbst = d.als(h.U1, `with u as (update public.feedback_items set votes_up = 999 where id = '${I1}' returning 1) select count(*) from u;`);
        if (selbst.out !== '0') return { ok: false, warum: 'Nutzer setzt votes_up selbst: ' + (selbst.out || selbst.err) };
        // Direkt rufen kann die Trigger-Funktion niemand
        const recht = d.sql(`select has_function_privilege('authenticated', 'public.fn_update_feedback_votes()', 'execute')::text || '/' || has_function_privilege('anon', 'public.fn_update_feedback_votes()', 'execute')::text;`);
        if (recht !== 'false/false') return { ok: false, warum: 'EXECUTE fuer authenticated/anon: ' + recht };
        const secdef = d.sql(`select prosecdef::text || '|' || array_to_string(proconfig, ',') from pg_proc where proname = 'fn_update_feedback_votes';`);
        if (secdef !== 'true|search_path=public, pg_temp') return { ok: false, warum: 'Funktion: ' + secdef };

        // Gegenprobe: die alte Funktion zurueck → die naechste Stimme zaehlt wieder nicht
        d.sql(ALT_FN);
        d.als(h.U3, STIMME(h.U3, I1, 'up'));
        const gegen = d.sql(ZAHL(I1));
        if (gegen !== '0/2') return { ok: false, warum: 'Gegenprobe misst nichts: mit der alten Funktion steht ' + gegen };
        const m3 = d.migration(MIG);
        const wieder = d.sql(ZAHL(I1));
        if (!m3.ok || wieder !== '1/2') return { ok: false, warum: 'Reparatur erneut: ' + (m3.err || wieder) };

        return { ok: true, info: 'vorher 2 Stimmen → 0/0 (Staff: ' + staffVorher + ') · Migration 2× · Bestand 2/0 · 2/1 → 1/2 → 0/2 · selbst setzen: 0 Zeilen · EXECUTE entzogen · Gegenprobe 0/2, erneut 1/2' };
      } finally { d.weg(); }
    },
  },
];
