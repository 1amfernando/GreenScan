// Gruppe q4 der Sicherheitspruefung vom 10.11.2026: Konto, Speicher, Push-Abos, Geraete, Startangebot.
// Migration: supabase/migrations/20261110_sicherheit_konto_speicher.sql (+ Korrektur in der noch nicht
// angewandten 20260903_oekosystem_v1_geraete.sql). Jeder Fall: Angriff VORHER gelingt · Migration zweimal ·
// Angriff scheitert (mit Angabe: Fehler oder 0 Zeilen) · der Weg der App/des Webhooks geht weiter ·
// wo billig eine Gegenprobe (entscheidende Zeile weggelassen → der Angriff gelingt wieder).
'use strict';
const { execFileSync } = require('child_process');

const MIG = '20261110_sicherheit_konto_speicher.sql';

// Ausschnitt des Live-Stands, live gelesen 10.11.2026 (pg_policies, pg_proc, pg_trigger) — im
// Wortlaut, mit zwei Abweichungen: die zwei privaten Adressen in launch_offer_usage_select stehen
// hier als Platzhalter, und profiles.email ist text statt citext.
function grund(h) {
  return `
create table public.app_settings (key text primary key, value text, description text, updated_at timestamptz default now(), updated_by uuid);

create table public.profiles (
  id uuid primary key, email text, display_name text, avatar_emoji text default '🌿', bio text,
  xp int4 default 0, level int4 default 1, login_streak int4 default 0, longest_streak int4 default 0,
  total_logins int4 default 0, stats jsonb default '{}'::jsonb, tier text default 'free', is_expert bool default false,
  is_admin bool default false, created_at timestamptz default now(), updated_at timestamptz default now(),
  role text default 'user', role_assigned_at timestamptz default now(), role_assigned_by uuid, role_note text,
  is_lifetime bool default false, quiz_elo int4 not null default 1200, battles_won int4 not null default 0,
  battles_lost int4 not null default 0, battles_tied int4 not null default 0,
  comp_tier text, comp_expires_at timestamptz, comp_granted_by uuid, comp_granted_at timestamptz);
alter table public.profiles enable row level security;

CREATE OR REPLACE FUNCTION public.is_admin_user()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or
    ((select auth.jwt() ->> 'email') = any (
      string_to_array(coalesce((select value from app_settings where key='admin_emails'), ''), ',')
    ))
  , false);
$function$;
revoke all on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_user_role(_uid uuid DEFAULT NULL::uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT role FROM public.profiles WHERE id = COALESCE(_uid, auth.uid()) LIMIT 1;
$function$;
revoke all on function public.fn_user_role(uuid) from public, anon;
grant execute on function public.fn_user_role(uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_is_role(_role text, _uid uuid DEFAULT NULL::uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN _uid IS NOT NULL
     AND _uid IS DISTINCT FROM (SELECT auth.uid())
     AND NOT EXISTS (
           SELECT 1 FROM public.profiles me
           WHERE me.id = (SELECT auth.uid()) AND me.role IN ('admin','staff')
         )
    THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = COALESCE(_uid, (SELECT auth.uid())) AND role = _role
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_role_at_least(_required text, _uid uuid DEFAULT NULL::uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT CASE
    WHEN _uid IS NOT NULL
     AND _uid IS DISTINCT FROM (SELECT auth.uid())
     AND NOT EXISTS (
           SELECT 1 FROM public.profiles me
           WHERE me.id = (SELECT auth.uid()) AND me.role IN ('admin','staff')
         )
    THEN false
    WHEN _required = 'admin'  THEN public.fn_user_role(_uid) = 'admin'
    WHEN _required = 'staff'  THEN public.fn_user_role(_uid) IN ('admin','staff')
    WHEN _required = 'expert' THEN public.fn_user_role(_uid) IN ('admin','staff','expert')
    WHEN _required = 'user'   THEN public.fn_user_role(_uid) IN ('admin','staff','expert','user')
    ELSE false
  END;
$function$;

create policy profiles_insert_self on public.profiles for insert with check ((select auth.uid()) = id);
create policy profiles_select_own on public.profiles for select using ((id = (select auth.uid())) or fn_is_role('admin'::text));
create policy profiles_update on public.profiles for update using (fn_is_role('admin'::text) or ((select auth.uid()) = id));

CREATE OR REPLACE FUNCTION public.fn_profiles_guard_protected()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user IN ('authenticated','anon') AND NOT coalesce(is_admin_user(), false) THEN
    IF NEW.tier             IS DISTINCT FROM OLD.tier
       OR NEW.is_admin      IS DISTINCT FROM OLD.is_admin
       OR NEW.role          IS DISTINCT FROM OLD.role
       OR NEW.is_expert     IS DISTINCT FROM OLD.is_expert
       OR NEW.is_lifetime   IS DISTINCT FROM OLD.is_lifetime
       OR NEW.comp_tier        IS DISTINCT FROM OLD.comp_tier
       OR NEW.comp_expires_at  IS DISTINCT FROM OLD.comp_expires_at
       OR NEW.comp_granted_by  IS DISTINCT FROM OLD.comp_granted_by
       OR NEW.role_assigned_by IS DISTINCT FROM OLD.role_assigned_by
       OR NEW.role_assigned_at IS DISTINCT FROM OLD.role_assigned_at
       OR NEW.quiz_elo      IS DISTINCT FROM OLD.quiz_elo
       OR NEW.battles_won   IS DISTINCT FROM OLD.battles_won
       OR NEW.battles_lost  IS DISTINCT FROM OLD.battles_lost
       OR NEW.battles_tied  IS DISTINCT FROM OLD.battles_tied
       OR NEW.level         IS DISTINCT FROM OLD.level
       OR NEW.xp            IS DISTINCT FROM OLD.xp
    THEN RAISE EXCEPTION 'protected_column_change_denied' USING ERRCODE='insufficient_privilege'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;
CREATE TRIGGER trg_profiles_guard_protected BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION fn_profiles_guard_protected();

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  insert into public.profiles (id, email, display_name, avatar_emoji)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
          '🌿')
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email);
  return new;
end;
$function$;
revoke all on function public.fn_handle_new_user() from public, anon, authenticated;
CREATE TRIGGER trg_on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION fn_handle_new_user();

insert into auth.users (id, email) values
  ('${h.U1}', 'u1@example.invalid'), ('${h.U2}', 'u2@example.invalid'),
  ('${h.U3}', 'u3@example.invalid'), ('${h.ADMIN}', 'admin@example.invalid');
update public.profiles set is_admin = true, role = 'admin' where id = '${h.ADMIN}';

-- Startangebot
create table public.launch_offer_usage (user_id uuid primary key references auth.users(id) on delete cascade, subscription_id text, claimed_at timestamptz default now());
alter table public.launch_offer_usage enable row level security;
create policy launch_offer_insert_own on public.launch_offer_usage for insert with check (((select auth.uid()) = user_id));
create policy launch_offer_usage_select on public.launch_offer_usage for select using ((((select auth.uid()) = user_id) or (((select auth.jwt()) ->> 'email'::text) = any (array['<adresse1>@example.invalid'::text, '<adresse2>@example.invalid'::text]))));
CREATE OR REPLACE FUNCTION public.launch_offer_available()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_used boolean; v_count int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('available', true, 'logged_in', false); END IF;
  SELECT EXISTS(SELECT 1 FROM public.launch_offer_usage WHERE user_id = auth.uid()) INTO v_used;
  SELECT count(*) INTO v_count FROM public.launch_offer_usage;
  RETURN jsonb_build_object('available', (v_count < 100) AND NOT v_used, 'logged_in', true, 'claimed', v_count);
END; $function$;

-- besitzerlose Zeilen
create table public.user_scans (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, species_name text, species_latin text, category text, confidence int2, toxicity int2, edible bool, thumb text, context jsonb default '{}'::jsonb, created_at timestamptz default now());
alter table public.user_scans enable row level security;
create policy user_scans_delete_own on public.user_scans for delete using (((select auth.uid()) = user_id));
create policy user_scans_insert_own on public.user_scans for insert with check ((((select auth.uid()) = user_id) or (user_id is null)));
create policy user_scans_select_own on public.user_scans for select using (((select auth.uid()) = user_id));
create table public.user_species (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, name text not null, latin text, data jsonb not null default '{}'::jsonb, scan_confidence int2, created_at timestamptz default now());
alter table public.user_species enable row level security;
create policy user_species_insert_auth on public.user_species for insert with check ((((select auth.uid()) = user_id) or (user_id is null)));
create policy user_species_select_own on public.user_species for select to authenticated using (((select auth.uid()) = user_id));
create table public.scan_corrections (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete cascade, ai_name text, ai_latin text, ai_confidence int2, user_name text not null, user_latin text, note text, context jsonb default '{}'::jsonb, reported_at timestamptz default now());
alter table public.scan_corrections enable row level security;
create policy scan_corrections_insert_authenticated_own on public.scan_corrections for insert to authenticated with check (((user_id is null) or (user_id = (select auth.uid()))));
create policy scan_corrections_admin_read on public.scan_corrections for select using ((exists ( select 1 from profiles p where ((p.id = ( select auth.uid() as uid)) and (p.is_admin = true)))));
create table public.species_proposals (id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id) on delete set null, name text not null, latin text, family text, category text, data jsonb not null default '{}'::jsonb, scan_confidence int2, review_status text default 'pending', created_at timestamptz default now());
alter table public.species_proposals enable row level security;
create policy species_proposals_insert_authenticated_own on public.species_proposals for insert to authenticated with check (((user_id is null) or (user_id = (select auth.uid()))));
create policy species_proposals_admin on public.species_proposals for select using ((exists ( select 1 from profiles p where ((p.id = ( select auth.uid() as uid)) and (p.is_admin = true)))));

-- Abstimmungen
create table public.feedback_items (id uuid primary key default gen_random_uuid(), user_id uuid, kind text not null, content text not null, votes_up int4 default 0, votes_down int4 default 0, created_at timestamptz default now());
alter table public.feedback_items enable row level security;
create policy feedback_items_insert_validated on public.feedback_items for insert with check (((( select auth.uid() as uid) is null) and (user_id is null)) or ((( select auth.uid() as uid) is not null) and ((user_id is null) or (user_id = ( select auth.uid() as uid)))));
create policy feedback_items_select_own_or_staff on public.feedback_items for select using ((((select auth.uid()) = user_id) or fn_role_at_least('staff'::text)));
create policy feedback_items_update_admin on public.feedback_items for update using (fn_role_at_least('staff'::text));
create table public.feedback_votes (id uuid primary key default gen_random_uuid(), item_id uuid not null references public.feedback_items(id) on delete cascade, voter_key text not null, dir text not null check (dir = any (array['up','down'])), created_at timestamptz default now(), unique (item_id, voter_key));
alter table public.feedback_votes enable row level security;
create policy feedback_votes_delete_own on public.feedback_votes for delete using (((voter_key = (select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and ((select auth.uid() as uid) is null))));
create policy feedback_votes_insert_own on public.feedback_votes for insert with check (((voter_key = (select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and ((select auth.uid() as uid) is null))));
create policy feedback_votes_select_all on public.feedback_votes for select using (true);
create policy feedback_votes_update_own on public.feedback_votes for update using (((voter_key = (select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and ((select auth.uid() as uid) is null)))) with check (((voter_key = (select (auth.uid())::text as uid)) or ((voter_key ~~ 'anon:%'::text) and ((select auth.uid() as uid) is null))));
CREATE OR REPLACE FUNCTION public.fn_update_feedback_votes()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_item uuid := COALESCE(NEW.item_id, OLD.item_id);
BEGIN
  UPDATE public.feedback_items SET
    votes_up = (SELECT COUNT(*) FROM public.feedback_votes WHERE item_id = v_item AND dir = 'up'),
    votes_down = (SELECT COUNT(*) FROM public.feedback_votes WHERE item_id = v_item AND dir = 'down')
  WHERE id = v_item;
  RETURN COALESCE(NEW, OLD);
END;
$function$;
CREATE TRIGGER trg_feedback_votes_aggregate AFTER INSERT OR DELETE OR UPDATE ON public.feedback_votes FOR EACH ROW EXECUTE FUNCTION fn_update_feedback_votes();
insert into public.feedback_items (id, kind, content) values ('f0000000-0000-4000-8000-000000000001', 'idee', 'Eine Idee');

-- Push-Abos (20260429_push_subscriptions.sql + Live-Policies)
create table public.push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, endpoint text not null, p256dh text, auth_secret text, user_agent text, created_at timestamptz default now(), updated_at timestamptz default now(), notify_frost bool default true, unique (user_id, endpoint));
alter table public.push_subscriptions enable row level security;
create policy push_subs_delete_own on public.push_subscriptions for delete using (((select auth.uid()) = user_id));
create policy push_subs_insert_own on public.push_subscriptions for insert with check (((select auth.uid()) = user_id));
create policy push_subs_select_own on public.push_subscriptions for select using (((select auth.uid()) = user_id));
create policy push_subs_update_own on public.push_subscriptions for update to authenticated using ((user_id = (select auth.uid()))) with check ((user_id = (select auth.uid())));
`;
}

function mitGrund(h, name) { const d = h.neu(name); d.sql(grund(h)); return d; }
function zweimal(d) {
  const a = d.migration(MIG); if (!a.ok) throw new Error('Migration (1): ' + a.err.split('\n')[0]);
  const b = d.migration(MIG); if (!b.ok) throw new Error('Migration (2, Idempotenz): ' + b.err.split('\n')[0]);
}
// Migration mit weggelassenen Zeilen (Gegenprobe). Jede Zeile muss es GENAU einmal geben —
// sonst haette die Gegenprobe still nichts weggelassen.
function ohne(h, zeilen) {
  let t = h.migrationText(MIG);
  for (const z of zeilen) {
    const n = t.split(z).length - 1;
    if (n !== 1) throw new Error('Gegenprobe: Zeile ' + JSON.stringify(z.slice(0, 60)) + ' kommt ' + n + '× vor');
    t = t.replace(z, '');
  }
  return t;
}
const kurz = (r) => (r.err || r.out || '').split('\n')[0].slice(0, 120);

module.exports = [
  {
    name: 'Startangebot · ein Konto traegt sich ohne Kauf in den Zaehler ein; ohne Anmeldung ist es immer „verfuegbar" — danach nur service_role, Deckel auch ohne Anmeldung',
    lauf: async (h) => {
      const d = mitGrund(h, 'q4_launch');
      try {
        // 99 echte Kaeufe (Webhook, service_role) — der 100. Platz ist frei.
        d.sql(`insert into auth.users (id) select gen_random_uuid() from generate_series(1, 99);
               insert into public.launch_offer_usage (user_id) select id from auth.users where email is null;`);
        const vorher = d.als(h.U1, `insert into public.launch_offer_usage (user_id) values ('${h.U1}') returning 'eingetragen';`);
        if (!vorher.ok || vorher.out !== 'eingetragen') return { ok: false, warum: 'Angriff gelingt VOR der Migration nicht — der Fall misst nichts: ' + kurz(vorher) };
        const svcVorher = d.als(null, `select launch_offer_available()->>'available';`, { rolle: 'service_role' });
        if (svcVorher.out !== 'true') return { ok: false, warum: 'vorher: ohne Anmeldung nicht „true" bei 100 Plaetzen: ' + kurz(svcVorher) };
        d.sql(`delete from public.launch_offer_usage where user_id = '${h.U1}';`);
        zweimal(d);
        const nachher = d.als(h.U1, `insert into public.launch_offer_usage (user_id) values ('${h.U1}');`);
        if (nachher.ok) return { ok: false, warum: 'nach der Migration traegt sich das Konto weiter selbst ein' };
        const upd = d.als(h.U1, `delete from public.launch_offer_usage;`);
        if (upd.ok) return { ok: false, warum: 'DELETE durch ein Konto geht weiter' };
        // erlaubter Weg: der Webhook (service_role) zaehlt — wie stripe-webhook upsert(onConflict user_id)
        // Die Rolle service_role ist im lokalen Cluster ohne BYPASSRLS angelegt (geteilt mit anderen
        // Pruefstaenden) — live umgeht sie RLS. Gemessen wird darum: das Tabellenrecht bleibt, und der
        // Schreibweg des Webhooks (upsert onConflict user_id) laeuft als Eigentuemer.
        const recht = d.sql(`select has_table_privilege('service_role', 'public.launch_offer_usage', 'INSERT')::text || has_table_privilege('service_role', 'public.launch_offer_usage', 'UPDATE')::text || has_table_privilege('service_role', 'public.launch_offer_usage', 'DELETE')::text;`);
        if (recht !== 'truetruetrue') return { ok: false, warum: 'service_role hat die Tabellenrechte verloren: ' + recht };
        const hook = d.versuch(`insert into public.launch_offer_usage (user_id, subscription_id) values ('${h.U2}', 'cs_test') on conflict (user_id) do update set subscription_id = excluded.subscription_id returning 'ok';`);
        if (!hook.ok || hook.out !== 'ok') return { ok: false, warum: 'Webhook kann nicht mehr zaehlen: ' + kurz(hook) };
        const svc = d.als(null, `select launch_offer_available()->>'available';`, { rolle: 'service_role' });
        const u2 = d.als(h.U2, `select launch_offer_available()->>'available', (select count(*) from public.launch_offer_usage);`);
        const adm = d.als(h.ADMIN, `select count(*) from public.launch_offer_usage;`);
        const anon = d.als(null, `select count(*) from public.launch_offer_usage;`);
        if (svc.out !== 'false') return { ok: false, warum: 'bei 100 von 100 sagt die Funktion ohne Anmeldung ' + kurz(svc) };
        if (u2.out !== 'false\t1') return { ok: false, warum: 'Kaeufer sieht nicht genau seine Zeile / nicht „vergeben": ' + kurz(u2) };
        if (adm.out !== '100') return { ok: false, warum: 'Admin sieht nicht alle Zeilen: ' + kurz(adm) };
        if (anon.ok) return { ok: false, warum: 'anon liest die Tabelle' };
        const literal = /@/.test(h.migrationText(MIG).split('launch_offer_usage_select')[1].split(';')[0]);
        if (literal) return { ok: false, warum: 'die neue SELECT-Policy enthaelt eine Adresse' };
        // Gegenprobe: ohne DROP der Policy und ohne REVOKE ist der Angriff wieder da
        const g = h.neu('q4_launch_g');
        try {
          g.sql(grund(h));
          g.sql(ohne(h, ['DROP POLICY IF EXISTS launch_offer_insert_own ON public.launch_offer_usage;',
            'REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.launch_offer_usage FROM anon, authenticated;']));
          const wieder = g.als(h.U1, `insert into public.launch_offer_usage (user_id) values ('${h.U1}') returning 1;`);
          if (!wieder.ok) return { ok: false, warum: 'Gegenprobe misst nichts: ohne die zwei Zeilen scheitert der Angriff trotzdem (' + kurz(wieder) + ')' };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher: Selbsteintrag ja, ohne Anmeldung „true" bei 100/100 · nachher: INSERT/DELETE als Konto = Fehler (permission denied), anon liest = Fehler · Webhook zaehlt · ohne Anmeldung „false" bei 100/100 · Kaeufer 1 Zeile, Admin 100 · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'profiles · eine NEU angelegte Profilzeile macht sich selbst zum Admin — danach Vorgaben beim Anlegen; Registrierung, Upsert der App und der UPDATE-Waechter bleiben',
    lauf: async (h) => {
      const d = mitGrund(h, 'q4_profil');
      try {
        // Die halb gescheiterte Kontoloeschung: Profil weg, Konto noch angemeldet (delete-user Schritt 3 vor 4).
        d.sql(`delete from public.profiles where id = '${h.U3}';`);
        const angriff = `insert into public.profiles (id, display_name, is_admin, role, tier, xp, level, is_lifetime, comp_tier) values ('${h.U3}', 'x', true, 'admin', 'pro', 99999, 50, true, 'pro');
                         select is_admin_user()::text || '|' || (select role || '|' || tier || '|' || xp from public.profiles where id = '${h.U3}');`;
        const vorher = d.als(h.U3, angriff);
        if (!vorher.ok || vorher.out !== 'true|admin|pro|99999') return { ok: false, warum: 'Angriff gelingt VOR der Migration nicht — der Fall misst nichts: ' + kurz(vorher) };
        d.sql(`delete from public.profiles where id = '${h.U3}';`);
        zweimal(d);
        const nachher = d.als(h.U3, angriff);
        if (!nachher.ok || nachher.out !== 'false|user|free|0') return { ok: false, warum: 'nach der Migration: ' + kurz(nachher) + ' (erwartet: Zeile angelegt mit Vorgaben false|user|free|0)' };
        // erlaubte Wege
        d.sql(`insert into auth.users (id, email, raw_user_meta_data) values ('44444444-4444-4444-8444-444444444444', 'neu@example.invalid', '{"display_name":"Neu"}');`);
        const reg = d.sql(`select display_name || '|' || role || '|' || avatar_emoji from public.profiles where id = '44444444-4444-4444-8444-444444444444';`);
        if (reg !== 'Neu|user|🌿') return { ok: false, warum: 'Registrierung (fn_handle_new_user) legt kein Profil mehr an: ' + reg };
        // sbSaveProfile: POST mit resolution=merge-duplicates auf die VORHANDENE Zeile
        const ups = d.als(h.U1, `insert into public.profiles (id, display_name, login_streak, updated_at) values ('${h.U1}', 'Anna', 3, now())
                                 on conflict (id) do update set display_name = excluded.display_name, login_streak = excluded.login_streak, updated_at = excluded.updated_at
                                 returning display_name || '|' || login_streak;`);
        if (!ups.ok || ups.out !== 'Anna|3') return { ok: false, warum: 'Upsert der App (sbSaveProfile) geht nicht mehr: ' + kurz(ups) };
        const upsAdmin = d.als(h.U1, `insert into public.profiles (id, is_admin) values ('${h.U1}', true) on conflict (id) do update set is_admin = excluded.is_admin;`);
        if (upsAdmin.ok) return { ok: false, warum: 'Upsert mit is_admin=true auf die vorhandene Zeile geht durch' };
        const comp = d.als(h.U1, `update public.profiles set comp_granted_at = now() where id = '${h.U1}';`);
        if (comp.ok) return { ok: false, warum: 'comp_granted_at laesst sich selbst setzen' };
        const adm = d.als(h.ADMIN, `update public.profiles set role = 'expert', is_expert = true where id = '${h.U2}' returning role;`);
        if (!adm.ok || adm.out !== 'expert') return { ok: false, warum: 'Admin kann Rollen nicht mehr setzen: ' + kurz(adm) };
        // Gegenprobe: Trigger nur BEFORE UPDATE → Angriff wieder da
        const g = h.neu('q4_profil_g');
        try {
          g.sql(grund(h)); g.sql(`delete from public.profiles where id = '${h.U3}';`);
          g.sql(h.migrationText(MIG).replace('BEFORE INSERT OR UPDATE ON public.profiles', 'BEFORE UPDATE ON public.profiles'));
          const wieder = g.als(h.U3, angriff);
          if (wieder.out !== 'true|admin|pro|99999') return { ok: false, warum: 'Gegenprobe misst nichts: ' + kurz(wieder) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher: is_admin_user()=true per INSERT · nachher: Zeile mit Vorgaben (user/free/0), kein Fehler · Registrierung, Upsert der App, Admin-Rollenvergabe gehen · Upsert/UPDATE auf Schutzspalten = Fehler · Gegenprobe (nur BEFORE UPDATE) rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'besitzerlose Zeilen · anon und Konten legen Zeilen ohne user_id an, anon loescht fremde Stimmen — danach nur eigene Zeilen, Stimmen nur angemeldet',
    lauf: async (h) => {
      const d = mitGrund(h, 'q4_besitz');
      try {
        const FI = 'f0000000-0000-4000-8000-000000000001';
        const angriffe = {
          anon_scan: [null, `insert into public.user_scans (user_id, species_name) values (null, 'Spam');`],
          anon_art: [null, `insert into public.user_species (user_id, name) values (null, 'Spam');`],
          konto_korr: [h.U1, `insert into public.scan_corrections (user_id, user_name) values (null, 'Spam');`],
          konto_vorschlag: [h.U1, `insert into public.species_proposals (user_id, name) values (null, 'Spam');`],
          anon_stimme: [null, `insert into public.feedback_votes (item_id, voter_key, dir) values ('${FI}', 'anon:' || md5(random()::text), 'up');`],
        };
        d.sql(`insert into public.feedback_votes (item_id, voter_key, dir) values ('${FI}', 'anon:opfer', 'up');`);
        const loeschen = `with x as (delete from public.feedback_votes where voter_key = 'anon:opfer' returning 1) select count(*) from x;`;
        for (const [k, [uid, q]] of Object.entries(angriffe)) {
          const r = d.als(uid, q);
          if (!r.ok) return { ok: false, warum: 'Angriff ' + k + ' gelingt VOR der Migration nicht: ' + kurz(r) };
        }
        const lv = d.als(null, loeschen);
        if (lv.out !== '1') return { ok: false, warum: 'vorher: anon loescht die fremde Stimme nicht: ' + kurz(lv) };
        d.sql(`insert into public.feedback_votes (item_id, voter_key, dir) values ('${FI}', 'anon:opfer', 'up');`);
        zweimal(d);
        for (const [k, [uid, q]] of Object.entries(angriffe)) {
          const r = d.als(uid, q);
          if (r.ok) return { ok: false, warum: 'nach der Migration geht ' + k + ' weiter' };
        }
        const ln = d.als(null, loeschen);
        if (!ln.ok || ln.out !== '0') return { ok: false, warum: 'nachher: anon loescht weiter (' + kurz(ln) + ')' };
        // erlaubter Weg der App (gsScanPersistToCloud, Bestaetigen, Korrektur, Vorschlag, Stimme)
        const app = d.als(h.U1, `insert into public.user_scans (user_id, species_name) values ('${h.U1}', 'Baerlauch');
          insert into public.user_species (user_id, name) values ('${h.U1}', 'Baerlauch');
          insert into public.scan_corrections (user_id, user_name) values ('${h.U1}', 'Baerlauch');
          insert into public.species_proposals (user_id, name) values ('${h.U1}', 'Neue Art');
          insert into public.feedback_votes (item_id, voter_key, dir) values ('${FI}', '${h.U1}', 'up');
          insert into public.feedback_votes (item_id, voter_key, dir) values ('${FI}', '${h.U2}', 'up');`);
        if (app.ok) return { ok: false, warum: 'Stimme mit FREMDEM voter_key geht durch' };
        const app2 = d.als(h.U1, `insert into public.user_scans (user_id, species_name) values ('${h.U1}', 'Baerlauch');
          insert into public.user_species (user_id, name) values ('${h.U1}', 'Baerlauch');
          insert into public.scan_corrections (user_id, user_name) values ('${h.U1}', 'Baerlauch');
          insert into public.species_proposals (user_id, name) values ('${h.U1}', 'Neue Art');
          insert into public.feedback_votes (item_id, voter_key, dir) values ('${FI}', '${h.U1}', 'up');
          select (select count(*) from public.user_scans where user_id = '${h.U1}');`);
        if (!app2.ok || app2.out !== '1') return { ok: false, warum: 'eigene Zeilen gehen nicht mehr: ' + kurz(app2) };
        const del = d.als(h.U1, `with x as (delete from public.feedback_votes where voter_key = '${h.U1}' returning 1) select count(*) from x;`);
        const delFremd = d.als(h.U2, `with x as (delete from public.feedback_votes where voter_key = 'anon:opfer' returning 1) select count(*) from x;`);
        if (del.out !== '1') return { ok: false, warum: 'eigene Stimme laesst sich nicht zuruecknehmen: ' + kurz(del) };
        if (delFremd.out !== '0') return { ok: false, warum: 'ein Konto loescht eine fremde Stimme: ' + kurz(delFremd) };
        // Gegenprobe: die alte user_scans-Policy behalten → anon schreibt wieder
        const g = h.neu('q4_besitz_g');
        try {
          g.sql(grund(h));
          g.sql(ohne(h, ['DROP POLICY IF EXISTS user_scans_insert_own ON public.user_scans;\nCREATE POLICY user_scans_insert_own ON public.user_scans\n  FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);']));
          const wieder = g.als(null, angriffe.anon_scan[1]);
          if (!wieder.ok) return { ok: false, warum: 'Gegenprobe misst nichts: ' + kurz(wieder) };
        } finally { g.weg(); }
        return { ok: true, info: '5 Angriffe vorher ja, nachher Fehler (RLS-Verletzung) · anon loescht fremde Stimme: vorher 1, nachher 0 Zeilen ohne Fehler · eigene Zeilen in 4 Tabellen + eigene Stimme gehen, fremder voter_key = Fehler · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    // v33.59 (Schlusspruefung c2#1): die UPDATE-Policy fehlte in dieser Fixture — deshalb war der Fall
    // „besitzerlose Zeilen" gruen, waehrend anon jede 'anon:%'-Stimme umschreiben konnte. Mit dem
    // DEFINER-Zaehler aus 20261110_feedback_stimmen_zaehlen.sql wandert das in votes_up/votes_down.
    name: 'Stimmen umschreiben · anon setzt fremde anon-Stimmen auf eine andere Idee und Richtung (Zaehler folgen) — danach nur die eigene Stimme, nur angemeldet; Umstimmen der App (Upsert) geht weiter',
    lauf: async (h) => {
      const A = 'f0000000-0000-4000-8000-000000000001', B = 'f0000000-0000-4000-8000-000000000002';
      const ZAEHLER = '20261110_feedback_stimmen_zaehlen.sql';
      const umschreiben = `with x as (update public.feedback_votes set item_id = '${B}', dir = 'down' where voter_key like 'anon:%' returning 1) select count(*) from x;`;
      const zahl = (d) => d.sql(`select string_agg(votes_up || '/' || votes_down, ' ' order by content) from public.feedback_items;`);
      const aufbau = (name) => {
        const d = mitGrund(h, name);
        d.sql(`insert into public.feedback_items (id, kind, content) values ('${B}', 'idee', 'Zweite Idee');
          insert into public.feedback_votes (item_id, voter_key, dir) values ('${A}', 'anon:aaa', 'up'), ('${A}', 'anon:bbb', 'up'), ('${A}', 'anon:ccc', 'up');`);
        const z = d.migration(ZAEHLER); if (!z.ok) throw new Error('Zaehler-Migration: ' + z.err.split('\n')[0]);
        return d;
      };
      const d = aufbau('q4_stimme_upd');
      try {
        const vor = d.als(null, umschreiben);
        const zVor = zahl(d);
        if (vor.out !== '3' || zVor !== '0/0 0/3') return { ok: false, warum: 'Angriff VOR der Migration gelingt nicht — Fall misst nichts: ' + kurz(vor) + ' Zaehler ' + zVor };
        d.sql(`update public.feedback_votes set item_id = '${A}', dir = 'up';`);
        zweimal(d);
        const nach = d.als(null, umschreiben);
        const fremd = d.als(h.U1, umschreiben);
        if (nach.out !== '0' || fremd.out !== '0') return { ok: false, warum: 'nach der Migration: anon ' + kurz(nach) + ' · Konto auf fremde Stimmen ' + kurz(fremd) };
        if (zahl(d) !== '3/0 0/0') return { ok: false, warum: 'Zaehler nach dem Angriff: ' + zahl(d) };
        // der Weg der App: eigene Stimme per Upsert (merge-duplicates) abgeben und umstimmen
        const STIMME = (dir) => `insert into public.feedback_votes (item_id, voter_key, dir) values ('${A}', '${h.U1}', '${dir}') on conflict (item_id, voter_key) do update set dir = excluded.dir;`;
        const ab = d.als(h.U1, STIMME('up')), um = d.als(h.U1, STIMME('down'));
        if (!ab.ok || !um.ok || zahl(d) !== '3/1 0/0') return { ok: false, warum: 'App-Weg: ' + kurz(ab) + ' / ' + kurz(um) + ' Zaehler ' + zahl(d) };
        const weg = d.als(h.U1, `with x as (update public.feedback_votes set voter_key = 'anon:neu' where voter_key = '${h.U1}' returning 1) select count(*) from x;`);
        if (weg.ok) return { ok: false, warum: 'eigene Stimme laesst sich einem anderen Schluessel zuschreiben: ' + kurz(weg) };
        // Gegenprobe: ohne die neue UPDATE-Policy gelingt das Umschreiben wieder
        const g = aufbau('q4_stimme_upd_g');
        try {
          g.sql(ohne(h, ['DROP POLICY IF EXISTS feedback_votes_update_own ON public.feedback_votes;\nCREATE POLICY feedback_votes_update_own ON public.feedback_votes\n  FOR UPDATE TO authenticated\n  USING (voter_key = (SELECT (auth.uid())::text))\n  WITH CHECK (voter_key = (SELECT (auth.uid())::text));']));
          const wieder = g.als(null, umschreiben);
          if (wieder.out !== '3') return { ok: false, warum: 'Gegenprobe misst nichts: ' + kurz(wieder) };
        } finally { g.weg(); }
        return { ok: true, info: 'vorher anon: 3 fremde Stimmen umgeschrieben, Zaehler A 0/0, B 0/3 · nachher anon und Konto 0 Zeilen, Zaehler 3/0 · eigene Stimme per Upsert ab- und umgestimmt (3/1), eigener Schluessel nicht umschreibbar (RLS) · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Speicher · avatars, species-images, user-uploads ohne Groessen- und Typgrenze — danach Bilder 5 MB bzw. 10 MB mit PDF; andere Buckets unberuehrt; ohne storage-Schema laeuft die Migration auch',
    lauf: async (h) => {
      const d = mitGrund(h, 'q4_buckets');
      try {
        // ohne storage.buckets (die anderen Faelle): DO-Block mit to_regclass — kein Fehler
        zweimal(d);
        // live gelesen 10.11.2026 (storage.buckets, Auszug)
        d.sql(`create schema storage; create table storage.buckets (id text primary key, name text, public bool, file_size_limit bigint, allowed_mime_types text[]);
          insert into storage.buckets values
            ('avatars','avatars',true,null,null), ('species-images','species-images',true,null,null),
            ('user-uploads','user-uploads',false,null,null), ('books-raw','books-raw',false,null,null),
            ('scan-images','scan-images',true,5242880,array['image/jpeg','image/png','image/webp']);`);
        const vorher = d.sql(`select count(*) from storage.buckets where file_size_limit is null and id in ('avatars','species-images','user-uploads');`);
        if (vorher !== '3') return { ok: false, warum: 'Ausgangslage nicht hergestellt: ' + vorher };
        zweimal(d);
        const st = d.sql(`select string_agg(id || '=' || coalesce(file_size_limit::text,'-') || ':' || coalesce(array_to_string(allowed_mime_types, ','),'-'), ' ' order by id) from storage.buckets;`);
        const soll = 'avatars=5242880:image/jpeg,image/png,image/webp books-raw=-:- scan-images=5242880:image/jpeg,image/png,image/webp species-images=5242880:image/jpeg,image/png,image/webp user-uploads=10485760:image/jpeg,image/png,image/webp,application/pdf';
        if (st !== soll) return { ok: false, warum: 'Stand nach der Migration: ' + st };
        // Die App laedt nach species-images mit Content-Type image/jpeg (gsUploadImage: 'image/' + (ext === 'jpg' ? 'jpeg' : ext))
        const app = execFileSync('grep', ['-c', "'image/' + (ext === 'jpg' ? 'jpeg' : ext)", require('path').join(h.repo, 'index.html')], { encoding: 'utf8' }).trim();
        if (app !== '1') return { ok: false, warum: 'gsUploadImage setzt den Typ nicht mehr wie erwartet (' + app + ' Treffer) — Bucket-Liste pruefen' };
        return { ok: true, info: 'vorher 3 Buckets ohne Grenze · nachher Bilder 5 MB (avatars, species-images), user-uploads 10 MB mit PDF · scan-images/books-raw unberuehrt · ohne storage-Schema kein Fehler · App laedt image/jpeg (erlaubt). Grenze: die Durchsetzung macht die Storage-API, nicht Postgres' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Push-Abos · beliebige Adresse als endpoint, beliebig viele Abos — danach nur bekannte Push-Dienste (https, ohne Port/Benutzerteil), hoechstens 10 je Nutzer, das neue gewinnt',
    lauf: async (h) => {
      const d = mitGrund(h, 'q4_push');
      try {
        const boese = ['https://169.254.169.254/latest/meta-data', 'http://fcm.googleapis.com/fcm/send/x', 'https://fcm.googleapis.com:8443/fcm/send/x',
          'https://fcm.googleapis.com@intern.example/x', 'https://fcm.googleapis.com.evil.example/x', 'https://evilnotify.windows.com/x', 'https://push.apple.com/x', 'https://notify.windows.com/x'];
        const gut = ['https://fcm.googleapis.com/fcm/send/abc:APA91b', 'https://updates.push.services.mozilla.com/wpush/v2/gAAAA', 'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA', 'https://web.push.apple.com/QGuQyavXutnMH'];
        const ins = (e) => `insert into public.push_subscriptions (user_id, endpoint) values ('${h.U1}', '${e}');`;
        for (const e of boese) { const r = d.als(h.U1, ins(e)); if (!r.ok) return { ok: false, warum: 'vorher geht ' + e + ' nicht: ' + kurz(r) }; }
        const viele = d.als(h.U1, `insert into public.push_subscriptions (user_id, endpoint, created_at, updated_at) select '${h.U1}', 'https://fcm.googleapis.com/fcm/send/v' || i, now() - (100 - i) * interval '1 hour', now() - (100 - i) * interval '1 hour' from generate_series(1, 15) i; select count(*) from public.push_subscriptions;`);
        if (viele.out !== '23') return { ok: false, warum: 'vorher kein unbegrenztes Anlegen: ' + kurz(viele) };
        d.sql(`delete from public.push_subscriptions;`);
        // ein ALTES Abo mit fremder Adresse bleibt stehen (NOT VALID prueft den Bestand nicht)
        d.sql(`insert into public.push_subscriptions (user_id, endpoint) values ('${h.U2}', 'https://alt.example/push');`);
        zweimal(d);
        for (const e of boese) { const r = d.als(h.U1, ins(e)); if (r.ok) return { ok: false, warum: 'nachher geht weiter: ' + e }; }
        for (const e of gut) { const r = d.als(h.U1, ins(e)); if (!r.ok) return { ok: false, warum: 'echter Push-Dienst abgewiesen: ' + e + ' — ' + kurz(r) }; }
        const bestand = d.sql(`select count(*) from public.push_subscriptions where endpoint = 'https://alt.example/push';`);
        if (bestand !== '1') return { ok: false, warum: 'Bestand wurde angefasst' };
        // Deckel: 15 weitere (zeitlich gestaffelt) → 10 bleiben, darunter das neueste
        for (let i = 1; i <= 15; i++) {
          const r = d.als(h.U1, `insert into public.push_subscriptions (user_id, endpoint, created_at, updated_at) values ('${h.U1}', 'https://fcm.googleapis.com/fcm/send/n${i}', now() + interval '${i} minutes', now() + interval '${i} minutes');`);
          if (!r.ok) return { ok: false, warum: 'Abo Nr. ' + i + ' abgewiesen (das neue soll gewinnen): ' + kurz(r) };
        }
        const z = d.sql(`select count(*) || '|' || bool_or(endpoint like '%/n15') || '|' || bool_or(endpoint like '%/n6') || '|' || bool_or(endpoint like '%/n5') from public.push_subscriptions where user_id = '${h.U1}';`);
        if (z !== '10|true|true|false') return { ok: false, warum: 'Deckel: ' + z + ' (erwartet 10 Abos, n6…n15)' };
        // Upsert eines vorhandenen Abos (App: merge-duplicates) loescht nichts
        const ups = d.als(h.U1, `insert into public.push_subscriptions (user_id, endpoint, notify_frost) values ('${h.U1}', 'https://fcm.googleapis.com/fcm/send/n6', false) on conflict (user_id, endpoint) do update set notify_frost = excluded.notify_frost; select count(*) from public.push_subscriptions where user_id = '${h.U1}';`);
        if (ups.out !== '10') return { ok: false, warum: 'Upsert eines vorhandenen Abos: ' + kurz(ups) };
        // Ein fremder Versuch (user_id = U2) wird abgewiesen und loescht dabei nichts beim Opfer
        d.sql(`insert into public.push_subscriptions (user_id, endpoint, created_at) select '${h.U2}', 'https://fcm.googleapis.com/fcm/send/o' || i, now() - i * interval '1 minute' from generate_series(1, 9) i;`);
        const fremd = d.als(h.U1, `insert into public.push_subscriptions (user_id, endpoint) values ('${h.U2}', 'https://fcm.googleapis.com/fcm/send/fremd');`);
        const opfer = d.sql(`select count(*) from public.push_subscriptions where user_id = '${h.U2}';`);
        if (fremd.ok || opfer !== '10') return { ok: false, warum: 'fremde user_id: ok=' + fremd.ok + ', Abos des Opfers ' + opfer };
        // Gegenprobe: ohne den CHECK geht die Adresse wieder durch
        const g = h.neu('q4_push_g');
        try {
          g.sql(grund(h));
          const t = h.migrationText(MIG);
          const a = t.indexOf('    ALTER TABLE public.push_subscriptions ADD CONSTRAINT'); const b = t.indexOf('NOT VALID;', a) + 'NOT VALID;'.length;
          if (a < 0 || b < a) return { ok: false, warum: 'Gegenprobe: CHECK-Zeile nicht gefunden' };
          g.sql(t.slice(0, a) + t.slice(b));
          const wieder = g.als(h.U1, ins(boese[0]));
          if (!wieder.ok) return { ok: false, warum: 'Gegenprobe misst nichts: ' + kurz(wieder) };
        } finally { g.weg(); }
        return { ok: true, info: '8 boese Adressen vorher ja, nachher Fehler (CHECK) · 4 echte Dienste gehen · Bestand unberuehrt (NOT VALID) · 25 Abos → 10, das neueste bleibt · Upsert loescht nichts · fremde user_id: Fehler, Opfer behaelt 10 · Gegenprobe rot' };
      } finally { d.weg(); }
    },
  },
  {
    name: 'Geraete (20260903, nicht angewandt) · Regel und Befehl an ein FREMDES Geraet — danach muss das Geraet dem Aufrufer gehoeren; eigenes Geraet geht weiter',
    lauf: async (h) => {
      const DATEI = '20260903_oekosystem_v1_geraete.sql';
      // Die ALTE Fassung (bis v33.56) wird aus der neuen zurueckgebaut: die zwei Policies im
      // damaligen Wortlaut. Jede Ersetzung muss GENAU einmal treffen, sonst misst der Fall nichts.
      let alt = h.migrationText(DATEI);
      for (const [tab, pol] of [['device_rules', 'own_rules_all'], ['device_commands', 'own_commands_all']]) {
        const re = new RegExp('create policy "' + pol + '" on public\\.' + tab + '[\\s\\S]*?;\\n');
        if ((alt.match(new RegExp(re.source, 'g')) || []).length !== 1) return { ok: false, warum: 'Policy ' + pol + ' nicht genau einmal gefunden' };
        alt = alt.replace(re, 'create policy "' + pol + '" on public.' + tab + '\n  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);\n');
      }
      const D1 = 'd1000000-0000-4000-8000-000000000001', D2 = 'd2000000-0000-4000-8000-000000000002';
      const vorbereiten = (d) => d.sql(`insert into auth.users (id) values ('${h.U1}'), ('${h.U2}');
        create or replace function public.fn_is_role(_role text, _uid uuid default null) returns boolean language sql stable as $f$ select false $f$;`);
      const geraete = `insert into public.devices (id, user_id, name, kind) values ('${D1}', '${h.U1}', 'Mein Sensor', 'manual'), ('${D2}', '${h.U2}', 'Fremder Sensor', 'manual');`;
      const angriff = `insert into public.device_rules (user_id, device_id, op, threshold, metric) values ('${h.U1}', '${D2}', 'below', 1, null);
                       insert into public.device_commands (user_id, device_id, command) values ('${h.U1}', '${D2}', 'ventil_auf');`;
      const eigen = `insert into public.device_rules (user_id, device_id, op, threshold, metric) values ('${h.U1}', '${D1}', 'below', 1, null);
                     insert into public.device_commands (user_id, device_id, command) values ('${h.U1}', '${D1}', 'messen');
                     select (select count(*) from public.device_rules) || '|' || (select count(*) from public.device_commands);`;
      const a = h.neu('q4_geraet_alt');
      const n = h.neu('q4_geraet_neu');
      try {
        vorbereiten(a); a.sql(alt);
        const devCols = a.sql(`select string_agg(column_name, ',') from information_schema.columns where table_schema='public' and table_name='devices' and is_nullable='NO' and column_default is null;`);
        if (devCols !== 'id,user_id,name,kind' && devCols !== 'user_id,name,kind' && !/user_id/.test(devCols)) return { ok: false, warum: 'devices-Pflichtspalten unerwartet: ' + devCols };
        const ga = a.versuch(geraete); if (!ga.ok) return { ok: false, warum: 'Fixture devices: ' + kurz(ga) };
        const vorher = a.als(h.U1, angriff);
        if (!vorher.ok) return { ok: false, warum: 'Angriff gelingt mit der ALTEN Fassung nicht — der Fall misst nichts: ' + kurz(vorher) };
        vorbereiten(n);
        const m1 = n.migration(DATEI), m2 = n.migration(DATEI);
        if (!m1.ok || !m2.ok) return { ok: false, warum: 'neue Fassung laesst sich nicht (zweimal) einspielen: ' + (m1.err || m2.err).split('\n')[0] };
        n.sql(geraete);
        const r1 = n.als(h.U1, `insert into public.device_rules (user_id, device_id, op, threshold, metric) values ('${h.U1}', '${D2}', 'below', 1, null);`);
        const r2 = n.als(h.U1, `insert into public.device_commands (user_id, device_id, command) values ('${h.U1}', '${D2}', 'ventil_auf');`);
        if (r1.ok || r2.ok) return { ok: false, warum: 'neue Fassung: Regel ok=' + r1.ok + ', Befehl ok=' + r2.ok + ' an fremdes Geraet' };
        const e = n.als(h.U1, eigen);
        if (!e.ok || e.out !== '1|1') return { ok: false, warum: 'eigenes Geraet geht nicht mehr: ' + kurz(e) };
        // umhaengen per UPDATE auf ein fremdes Geraet geht auch nicht
        const um = n.als(h.U1, `update public.device_rules set device_id = '${D2}';`);
        if (um.ok) return { ok: false, warum: 'eigene Regel laesst sich per UPDATE an ein fremdes Geraet haengen' };
        return { ok: true, info: 'alte Fassung: Regel + Befehl an fremdes Geraet gehen · neue Fassung (zweimal eingespielt): beide Fehler (RLS), Umhaengen per UPDATE Fehler · eigenes Geraet: 1 Regel, 1 Befehl' };
      } finally { a.weg(); n.weg(); }
    },
  },
  {
    name: 'fn_is_role / fn_role_at_least bleiben fuer anon — anon erfaehrt nur false, und ein REVOKE machte aus Policies mit roles=public einen Fehler (gemessen, darum nicht gesperrt)',
    lauf: async (h) => {
      const d = mitGrund(h, 'q4_rollen');
      try {
        d.sql(`create table public.social_posts (id serial primary key, user_id uuid, is_archived bool default false, text text);
          alter table public.social_posts enable row level security;
          create policy social_posts_select_all on public.social_posts for select using (((is_archived = false) or ((select auth.uid()) = user_id) or fn_role_at_least('staff'::text)));
          insert into public.social_posts (user_id, text) values ('${h.U1}', 'oeffentlich');`);
        zweimal(d);
        const anon = d.als(null, `select concat_ws('|', coalesce(fn_is_role('admin', '${h.ADMIN}')::text, 'null'), coalesce(fn_is_role('admin')::text, 'null'), coalesce(fn_role_at_least('staff', '${h.ADMIN}')::text, 'null'), coalesce(fn_role_at_least('user')::text, 'null'), (select count(*) from public.social_posts));`);
        if (anon.out !== 'false|false|false|null|1') return { ok: false, warum: 'anon: ' + kurz(anon) + ' ' + anon.err };
        const recht = d.sql(`select has_function_privilege('anon', 'public.fn_role_at_least(text, uuid)', 'execute')::text;`);
        if (recht !== 'true') return { ok: false, warum: 'die Migration hat das Recht veraendert: ' + recht };
        d.sql(`revoke execute on function public.fn_role_at_least(text, uuid) from public, anon;`);
        const nach = d.als(null, `select count(*) from public.social_posts;`);
        if (nach.ok) return { ok: false, warum: 'nach REVOKE liest anon weiter ohne Fehler — dann waere der Entzug moeglich: ' + kurz(nach) };
        return { ok: true, info: 'anon: fn_is_role/fn_role_at_least (auch mit fremder Admin-uuid) = false bzw. null (kein Profil), 1 oeffentlicher Beitrag lesbar · nach REVOKE: „' + kurz(nach) + '"' };
      } finally { d.weg(); }
    },
  },
];
