-- Fixture fuer scripts/rls/10_funktionen.js — Ausschnitt des LIVE-Stands, gelesen 10.11.2026
-- (nur lesend: live/columns.txt, constraints.txt, policies.txt, functions.sql, triggers.json).
-- Tabellen nur mit den Spalten, die die Funktionen lesen oder schreiben; die Funktionen
-- im WORTLAUT, mit den Rechten aus der Live-ACL. Ein im Rumpf stehendes Geheimnis ist
-- durch '<<GEHEIMNIS>>' ersetzt — es gehoert nicht ins Repo.
create extension if not exists citext;
create extension if not exists pg_trgm;
create schema if not exists extensions;
create schema if not exists net;
create table net._aufrufe (id bigserial primary key, url text, body jsonb, headers jsonb, rolle text default current_user);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb, headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
  returns bigint language sql as $f$ insert into net._aufrufe (url, body, headers) values (url, body, headers) returning id $f$;
grant usage on schema net to anon, authenticated, service_role;

create table public.app_settings (key text primary key, value text);
create table public.profiles (id uuid primary key, display_name text, email citext, avatar_emoji text,
  is_expert boolean default false, tier text default 'free', level int default 1, xp int default 0,
  is_admin boolean default false, abo_status text, abo_trial_end timestamptz, abo_period_end timestamptz);
alter table public.profiles enable row level security;
create policy profiles_select_own on public.profiles for select using ((select auth.uid()) = id);
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid, kind text, title text,
  body text, link text, dedup_key text, created_at timestamptz default now());
alter table public.notifications enable row level security;
create policy notif_own on public.notifications for select using ((select auth.uid()) = user_id);

create table public.quests (id uuid primary key default gen_random_uuid(), slug text not null, title text not null,
  target_metric text not null, target_value int not null default 5, xp_reward int default 50,
  starts_at timestamptz not null default now(), ends_at timestamptz not null, is_active boolean default true);
alter table public.quests enable row level security;
create table public.user_quest_progress (id uuid primary key default gen_random_uuid(), user_id uuid not null,
  quest_id uuid not null references public.quests(id) on delete cascade, current_value int default 0,
  completed boolean default false, completed_at timestamptz, rewarded boolean default false,
  created_at timestamptz default now(), updated_at timestamptz default now(), unique (user_id, quest_id));
alter table public.user_quest_progress enable row level security;
create table public.social_posts (id bigserial primary key, user_id uuid, text text);
alter table public.social_posts enable row level security;
create policy social_posts_insert_auth on public.social_posts for insert with check ((select auth.uid()) = user_id);
create policy social_posts_select_all on public.social_posts for select using (true);
create table public.user_scans (id bigserial primary key, user_id uuid, scanned_at timestamptz default now());
alter table public.user_scans enable row level security;
create policy user_scans_own on public.user_scans for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create table public.rate_limits (id bigserial primary key, bucket text not null, action text not null, count int default 1,
  window_start timestamptz default date_trunc('hour', now()), unique (bucket, action, window_start));
alter table public.rate_limits enable row level security;
create policy rate_limits_admin_only on public.rate_limits for select using (false);

create table public.scan_cache (phash text primary key, result_json jsonb not null, hit_count int not null default 0,
  first_cached_at timestamptz not null default now(), last_hit_at timestamptz not null default now());
alter table public.scan_cache enable row level security;
create policy scan_cache_read_all on public.scan_cache for select to anon, authenticated using (true);

create table public.quiz_battles (id bigserial primary key, challenger_id uuid, status text, resolved_at timestamptz);
create table public.org_classes (id bigserial primary key, org_id bigint);
create table public.org_members (org_id bigint, user_id uuid, role text);
create table public.class_members (class_id bigint, user_id uuid);
create table public.class_assignments (id bigserial primary key, class_id bigint, is_active boolean default true, created_at timestamptz default now(), created_by uuid);
create table public.class_submissions (id bigserial primary key, assignment_id bigint, user_id uuid, completed boolean, updated_at timestamptz default now());
create table public.plant_doctor_history (id bigserial primary key, user_id uuid, status text, followup_due_at timestamptz, followup_result text);
alter table public.quiz_battles enable row level security;
alter table public.plant_doctor_history enable row level security;

create table public.ai_daily_usage (date date not null, edge_fn text not null, total_tokens_in int default 0,
  total_tokens_out int default 0, total_cost_chf numeric default 0, call_count int default 0,
  updated_at timestamptz default now(), primary key (date, edge_fn));
alter table public.ai_daily_usage enable row level security;
create policy ai_daily_usage_select on public.ai_daily_usage for select to authenticated using (true);
create view public.v_ai_usage_summary with (security_invoker = true) as
  select date, sum(total_cost_chf) as cost_chf, sum(call_count) as calls from public.ai_daily_usage group by date;

create table public.marketplace_listings (id uuid primary key default gen_random_uuid(), user_id uuid not null, title text not null,
  description text, category text, price numeric, currency text default 'CHF', region text, photo_url text,
  status text default 'active', views int default 0, created_at timestamptz default now(), updated_at timestamptz default now(),
  contact text, photo_urls text[], price_mode text default 'fix', reports int default 0, organic_certified boolean default false,
  pesticide_free boolean default false, certification_label text, allow_online_payment boolean default false,
  contact_method text default 'chat', sold_at timestamptz, moderation_status text);
alter table public.marketplace_listings enable row level security;

create table public.wissen (source_type text, source_id text, title text, subtitle text, body text, icon text, search_text text);
create view public.v_knowledge_search as select source_type, source_id, title, subtitle, body, icon, search_text from public.wissen;

create table public.index_usage_snapshots (id bigserial primary key, captured_at timestamptz not null default now(),
  schemaname text not null, tablename text not null, indexname text not null, idx_scan bigint not null,
  last_idx_scan timestamptz, idx_tup_read bigint, idx_tup_fetch bigint, index_size_bytes bigint, is_unique boolean, is_primary boolean);
alter table public.index_usage_snapshots enable row level security;

create table public.friendships (id uuid primary key default gen_random_uuid(), user_id uuid not null, friend_id uuid not null,
  status text default 'pending' check (status in ('pending','accepted','blocked')), created_at timestamptz default now(),
  updated_at timestamptz default now(), unique (user_id, friend_id), constraint no_self_friend check (user_id <> friend_id));
alter table public.friendships enable row level security;
create policy friendships_insert on public.friendships for insert with check ((select auth.uid()) = user_id);
create policy friendships_select on public.friendships for select using ((select auth.uid()) in (user_id, friend_id));

create table public.species_images (id uuid primary key default gen_random_uuid(), species_id text not null, url text not null,
  storage_path text, license text, attribution text, source_url text, is_primary boolean not null default false,
  sort_order int not null default 0, created_at timestamptz not null default now(), contributed_by uuid,
  review_status text not null default 'approved' check (review_status in ('pending','approved','rejected')),
  scan_confidence smallint, admin_note text, reviewed_by uuid, reviewed_at timestamptz);
alter table public.species_images enable row level security;
create policy simg_read_approved_or_own on public.species_images for select to anon, authenticated
  using ((review_status = 'approved') or (contributed_by = (select auth.uid())));
-- is_admin_user() | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.is_admin_user()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    exists (select 1 from profiles p where p.id = (select auth.uid()) and p.is_admin = true)
    or
    ((select auth.jwt() ->> 'email') = any (
      string_to_array(coalesce((select value from app_settings where key='admin_emails'), ''), ',')
    ))
  , false);
$function$;

revoke all on function public.is_admin_user() from public, anon, authenticated, service_role;
grant execute on function public.is_admin_user() to authenticated, service_role;

-- fn_create_notification(_user_id uuid, _kind text, _title text, _body text, _link text, _dedup_key text) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_create_notification(_user_id uuid, _kind text, _title text, _body text DEFAULT NULL::text, _link text DEFAULT NULL::text, _dedup_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE _id uuid;
BEGIN
  IF _user_id IS NULL OR _kind IS NULL OR _title IS NULL THEN RETURN NULL; END IF;
  IF _dedup_key IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = _user_id AND dedup_key = _dedup_key
      AND created_at > NOW() - interval '60 minutes'
  ) THEN RETURN NULL; END IF;
  INSERT INTO public.notifications(user_id, kind, title, body, link, dedup_key)
    VALUES (_user_id, _kind, left(_title, 200), left(_body, 500), _link, _dedup_key)
    RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'fn_create_notification failed: %', SQLERRM;
  RETURN NULL;
END; $function$;

revoke all on function public.fn_create_notification(uuid, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.fn_create_notification(uuid, text, text, text, text, text) to service_role;

-- fn_quest_increment(_user_id uuid, _metric text, _delta integer) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quest_increment(_user_id uuid, _metric text, _delta integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE _q record;
BEGIN
  FOR _q IN
    SELECT id, target_value, xp_reward FROM public.quests
    WHERE is_active = true AND target_metric = _metric
      AND NOW() BETWEEN starts_at AND ends_at
  LOOP
    INSERT INTO public.user_quest_progress(user_id, quest_id, current_value)
    VALUES (_user_id, _q.id, _delta)
    ON CONFLICT (user_id, quest_id) DO UPDATE
      SET current_value = LEAST(_q.target_value, public.user_quest_progress.current_value + _delta),
          completed = (LEAST(_q.target_value, public.user_quest_progress.current_value + _delta) >= _q.target_value),
          completed_at = CASE WHEN public.user_quest_progress.current_value + _delta >= _q.target_value
                              AND public.user_quest_progress.completed = false
                              THEN NOW() ELSE public.user_quest_progress.completed_at END;
    -- XP-Reward bei Vollendung (einmalig)
    IF EXISTS (SELECT 1 FROM public.user_quest_progress WHERE user_id=_user_id AND quest_id=_q.id AND completed=true AND rewarded=false) THEN
      UPDATE public.profiles SET xp = COALESCE(xp,0) + _q.xp_reward WHERE id = _user_id;
      UPDATE public.user_quest_progress SET rewarded=true WHERE user_id=_user_id AND quest_id=_q.id;
      PERFORM public.fn_create_notification(_user_id, 'achievement',
        '🏆 Quest abgeschlossen!', '+' || _q.xp_reward || ' XP', NULL, 'quest:' || _q.id::text);
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END; $function$;

revoke all on function public.fn_quest_increment(uuid, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_quest_increment(uuid, text, integer) to authenticated, service_role;

-- fn_quest_track_post() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quest_track_post()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN PERFORM public.fn_quest_increment(NEW.user_id, 'posts_count', 1); END IF;
  RETURN NEW;
END; $function$;

revoke all on function public.fn_quest_track_post() from public, anon, authenticated, service_role;
grant execute on function public.fn_quest_track_post() to service_role;

-- fn_quest_track_scan() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_quest_track_scan()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NEW.user_id IS NOT NULL THEN PERFORM public.fn_quest_increment(NEW.user_id, 'scans_count', 1); END IF;
  RETURN NEW;
END; $function$;

revoke all on function public.fn_quest_track_scan() from public, anon, authenticated, service_role;
grant execute on function public.fn_quest_track_scan() to service_role;

-- fn_check_rate_limit(p_bucket text, p_action text, p_max_per_hour integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_check_rate_limit(p_bucket text, p_action text, p_max_per_hour integer DEFAULT 30)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_count integer; v_window timestamptz := date_trunc('hour', now());
BEGIN
  INSERT INTO public.rate_limits (bucket, action, window_start, count)
    VALUES (p_bucket, p_action, v_window, 1)
    ON CONFLICT (bucket, action, window_start)
    DO UPDATE SET count = public.rate_limits.count + 1
    RETURNING count INTO v_count;
  DELETE FROM public.rate_limits WHERE window_start < now() - interval '2 hours';
  RETURN v_count <= p_max_per_hour;
END;
$function$;

revoke all on function public.fn_check_rate_limit(text, text, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_check_rate_limit(text, text, integer) to authenticated, service_role;

-- fn_scan_cache_put(p_phash text, p_result jsonb) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_scan_cache_put(p_phash text, p_result jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_phash IS NULL OR length(p_phash) NOT BETWEEN 8 AND 32 THEN RETURN; END IF;
  IF p_result IS NULL OR jsonb_typeof(p_result) <> 'object' THEN RETURN; END IF;
  INSERT INTO public.scan_cache (phash, result_json) VALUES (lower(p_phash), p_result)
  ON CONFLICT (phash) DO UPDATE
    SET hit_count = scan_cache.hit_count + 1, last_hit_at = now();
END $function$;

revoke all on function public.fn_scan_cache_put(text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.fn_scan_cache_put(text, jsonb) to authenticated, service_role;

-- fn_knowledge_grow(p_topic text, p_count integer) | secdef=True | config=['search_path=public, extensions, net'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_knowledge_grow(p_topic text, p_count integer DEFAULT 15)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_req_id bigint;
BEGIN
  SELECT net.http_post(
    url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/knowledge-bulk-gen',
    body := jsonb_build_object('topic', p_topic, 'count', p_count),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Secret', '<<GEHEIMNIS>>'
    ),
    timeout_milliseconds := 90000
  ) INTO v_req_id;
  RETURN v_req_id;
END;
$function$;

revoke all on function public.fn_knowledge_grow(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_knowledge_grow(text, integer) to authenticated, service_role;

-- fn_eng_battle_waiting(p_user uuid, p_hours integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_eng_battle_waiting(p_user uuid, p_hours integer DEFAULT 24)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::int FROM public.quiz_battles
  WHERE challenger_id = p_user AND status = 'resolved'
    AND resolved_at IS NOT NULL AND resolved_at > now() - make_interval(hours => p_hours);
$function$;

revoke all on function public.fn_eng_battle_waiting(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_eng_battle_waiting(uuid, integer) to authenticated, service_role;

-- fn_eng_class_new(p_user uuid, p_hours integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_eng_class_new(p_user uuid, p_hours integer DEFAULT 24)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::int FROM public.class_assignments a
  JOIN public.class_members m ON m.class_id = a.class_id
  WHERE m.user_id = p_user AND a.is_active
    AND a.created_at > now() - make_interval(hours => p_hours)
    AND a.created_by <> p_user;
$function$;

revoke all on function public.fn_eng_class_new(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_eng_class_new(uuid, integer) to authenticated, service_role;

-- fn_eng_class_submissions(p_user uuid, p_hours integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_eng_class_submissions(p_user uuid, p_hours integer DEFAULT 24)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT count(*)::int FROM public.class_submissions s
  JOIN public.class_assignments a ON a.id = s.assignment_id
  JOIN public.org_classes c ON c.id = a.class_id
  JOIN public.org_members om ON om.org_id = c.org_id AND om.user_id = p_user
  WHERE om.role IN ('owner','admin','teacher')
    AND s.completed AND s.updated_at > now() - make_interval(hours => p_hours)
    AND s.user_id <> p_user;
$function$;

revoke all on function public.fn_eng_class_submissions(uuid, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_eng_class_submissions(uuid, integer) to authenticated, service_role;

-- fn_eng_doctor_due(p_user uuid) | secdef=True | config=['search_path=public, pg_temp'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_eng_doctor_due(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT EXISTS(SELECT 1 FROM public.plant_doctor_history
    WHERE user_id=p_user AND status='open' AND followup_due_at IS NOT NULL
      AND followup_due_at <= now() AND followup_result IS NULL);
$function$;

revoke all on function public.fn_eng_doctor_due(uuid) from public, anon, authenticated, service_role;
grant execute on function public.fn_eng_doctor_due(uuid) to authenticated, service_role;

-- scans_this_month(u uuid) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.scans_this_month(u uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::int FROM public.user_scans
  WHERE user_id = u AND scanned_at >= date_trunc('month', now());
$function$;

revoke all on function public.scans_this_month(uuid) from public, anon, authenticated, service_role;
grant execute on function public.scans_this_month(uuid) to authenticated, service_role;

-- gs_abo_can_use(p_user_id uuid, feature text) | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.gs_abo_can_use(p_user_id uuid, feature text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  prof RECORD;
  now_ts TIMESTAMPTZ := now();
BEGIN
  SELECT abo_status, abo_trial_end, abo_period_end
  INTO prof FROM profiles WHERE id = p_user_id;

  IF NOT FOUND THEN RETURN true; END IF; -- Noch kein Profil = Trial noch nicht gestartet

  -- Trial läuft
  IF prof.abo_status = 'trial' AND prof.abo_trial_end > now_ts THEN
    RETURN true;
  END IF;

  -- Abo aktiv
  IF prof.abo_status = 'active' AND (prof.abo_period_end IS NULL OR prof.abo_period_end > now_ts) THEN
    RETURN true;
  END IF;

  -- Free Features: immer erlaubt
  IF feature IN ('browse', 'map', 'recipes', 'weather') THEN
    RETURN true;
  END IF;

  -- Pro Features gesperrt
  RETURN false;
END;
$function$;

revoke all on function public.gs_abo_can_use(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.gs_abo_can_use(uuid, text) to authenticated, service_role;

-- fn_log_ai_usage(p_edge_fn text, p_tokens_in integer, p_tokens_out integer, p_cost_chf numeric, p_model text) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_log_ai_usage(p_edge_fn text, p_tokens_in integer, p_tokens_out integer, p_cost_chf numeric DEFAULT NULL::numeric, p_model text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_in numeric; v_out numeric; v_cost numeric;
begin
  if p_cost_chf is not null then
    v_cost := p_cost_chf;
  elsif p_model is not null then
    -- CHF pro 1M Token (≈ Anthropic-Listenpreise × USD→CHF, konservativ aufgerundet)
    if p_model ilike '%haiku%' then v_in := 0.9;  v_out := 4.4;
    elsif p_model ilike '%opus%' then v_in := 13.5; v_out := 67.5;
    else v_in := 2.7; v_out := 13.2; -- sonnet / unbekannt → konservativ
    end if;
    v_cost := (coalesce(p_tokens_in,0)::numeric / 1000000.0 * v_in)
            + (coalesce(p_tokens_out,0)::numeric / 1000000.0 * v_out);
  else
    v_cost := 0;
  end if;
  insert into ai_daily_usage (date, edge_fn, total_tokens_in, total_tokens_out, total_cost_chf, call_count, updated_at)
  values (current_date, p_edge_fn, coalesce(p_tokens_in,0), coalesce(p_tokens_out,0), v_cost, 1, now())
  on conflict (date, edge_fn) do update set
    total_tokens_in  = ai_daily_usage.total_tokens_in  + excluded.total_tokens_in,
    total_tokens_out = ai_daily_usage.total_tokens_out + excluded.total_tokens_out,
    total_cost_chf   = ai_daily_usage.total_cost_chf   + v_cost,
    call_count       = ai_daily_usage.call_count + 1,
    updated_at       = now();
end;
$function$;

revoke all on function public.fn_log_ai_usage(text, integer, integer, numeric, text) from public, anon, authenticated, service_role;
grant execute on function public.fn_log_ai_usage(text, integer, integer, numeric, text) to authenticated, service_role;

-- fn_marketplace_search(p_query text, p_category text, p_region text, p_price_min numeric, p_price_max numeric, p_limit integer) | secdef=True | config=['search_path=public, pg_temp'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_marketplace_search(p_query text DEFAULT ''::text, p_category text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_price_min numeric DEFAULT NULL::numeric, p_price_max numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, title text, description text, category text, price numeric, currency text, region text, contact text, photo_url text, photo_urls text[], price_mode text, status text, views integer, reports integer, created_at timestamp with time zone, updated_at timestamp with time zone, sold_at timestamp with time zone, organic_certified boolean, pesticide_free boolean, certification_label text, allow_online_payment boolean, contact_method text, seller_name text, seller_avatar text, seller_is_expert boolean, seller_is_premium boolean, seller_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_q text := nullif(btrim(coalesce(p_query,'')), '');
        v_ts tsquery;
BEGIN
  IF v_q IS NOT NULL AND length(v_q) >= 2 THEN
    BEGIN v_ts := websearch_to_tsquery('german', v_q); EXCEPTION WHEN others THEN v_ts := NULL; END;
  END IF;
  RETURN QUERY
  SELECT m.id, m.user_id, m.title, m.description, m.category, m.price, m.currency,
         m.region, m.contact, m.photo_url, m.photo_urls, m.price_mode, m.status,
         m.views, m.reports, m.created_at, m.updated_at, m.sold_at,
         m.organic_certified, m.pesticide_free, m.certification_label,
         m.allow_online_payment, m.contact_method,
         COALESCE(p.display_name, split_part(p.email,'@'::citext,1), 'Anonym') AS seller_name,
         p.avatar_emoji AS seller_avatar,
         p.is_expert AS seller_is_expert,
         COALESCE(p.tier = ANY (ARRAY['plus','pro','plus_lifetime']), false) AS seller_is_premium,
         COALESCE(p.level, 1) AS seller_level
    FROM public.marketplace_listings m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.status = 'active'
     AND coalesce(m.moderation_status,'') <> 'hidden'
     AND (p_category IS NULL OR m.category = p_category)
     AND (p_region   IS NULL OR m.region   = p_region)
     AND (p_price_min IS NULL OR m.price >= p_price_min)
     AND (p_price_max IS NULL OR m.price <= p_price_max)
     AND (v_ts IS NULL OR to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')) @@ v_ts)
   ORDER BY
     CASE WHEN v_ts IS NOT NULL
          THEN ts_rank(to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')), v_ts)
          ELSE 0 END DESC,
     m.created_at DESC
   LIMIT GREATEST(1, LEAST(coalesce(p_limit,50), 100));
END;
$function$;

revoke all on function public.fn_marketplace_search(text, text, text, numeric, numeric, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_marketplace_search(text, text, text, numeric, numeric, integer) to public, anon, authenticated, service_role;

-- fn_knowledge_search(q text, lim integer) | secdef=True | config=['search_path=public, pg_catalog'] | acl={=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_knowledge_search(q text, lim integer DEFAULT 30)
 RETURNS TABLE(source_type text, source_id text, title text, subtitle text, body text, icon text, similarity real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT 
    v.source_type, v.source_id, v.title, v.subtitle, 
    SUBSTRING(v.body FROM 1 FOR 300) AS body,
    v.icon,
    GREATEST(
      similarity(coalesce(v.title, ''), q) * 2.0,  -- Title doppelt gewichtet
      similarity(coalesce(v.search_text, ''), q)
    )::real AS similarity
  FROM public.v_knowledge_search v
  WHERE coalesce(v.search_text, '') ILIKE '%' || q || '%'
     OR similarity(coalesce(v.title, ''), q) > 0.2
     OR similarity(coalesce(v.search_text, ''), q) > 0.15
  ORDER BY similarity DESC
  LIMIT lim;
$function$;

revoke all on function public.fn_knowledge_search(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.fn_knowledge_search(text, integer) to public, anon, authenticated, service_role;

-- fn_snapshot_index_usage() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_snapshot_index_usage()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
declare n integer;
begin
  insert into public.index_usage_snapshots
    (schemaname, tablename, indexname, idx_scan, last_idx_scan, idx_tup_read, idx_tup_fetch, index_size_bytes, is_unique, is_primary)
  select s.schemaname, s.relname, s.indexrelname, s.idx_scan, s.last_idx_scan,
         s.idx_tup_read, s.idx_tup_fetch, pg_relation_size(s.indexrelid),
         i.indisunique, i.indisprimary
  from pg_stat_user_indexes s
  join pg_index i on i.indexrelid = s.indexrelid
  where s.schemaname = 'public';
  get diagnostics n = row_count;
  delete from public.index_usage_snapshots where captured_at < now() - interval '180 days';
  return n;
end;
$function$;

revoke all on function public.fn_snapshot_index_usage() from public, anon, authenticated, service_role;
grant execute on function public.fn_snapshot_index_usage() to authenticated, service_role;

-- fn_notify_friend_request() | secdef=True | config=['search_path=public, pg_catalog'] | acl={postgres=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_notify_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE _name text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT display_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.fn_create_notification(
      NEW.friend_id, 'friend',
      (COALESCE(_name, 'Jemand') || ' möchte dir folgen'),
      'Tippe um zu antworten', '/?screen=profile#friends',
      'friend-req:' || NEW.user_id::text
    );
  ELSIF NEW.status = 'accepted' AND (OLD.status = 'pending' OR OLD.status IS NULL) THEN
    SELECT display_name INTO _name FROM public.profiles WHERE id = NEW.friend_id;
    PERFORM public.fn_create_notification(
      NEW.user_id, 'friend',
      (COALESCE(_name, 'Dein Kontakt') || ' hat deine Anfrage angenommen 🎉'),
      NULL, '/?screen=profile#friends',
      'friend-acc:' || NEW.friend_id::text
    );
  END IF;
  RETURN NEW;
END; $function$;

revoke all on function public.fn_notify_friend_request() from public, anon, authenticated, service_role;
grant execute on function public.fn_notify_friend_request() to service_role;

-- fn_contribute_species_image(p_species_id text, p_url text, p_storage_path text, p_confidence smallint) | secdef=True | config=['search_path=public'] | acl={postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}
CREATE OR REPLACE FUNCTION public.fn_contribute_species_image(p_species_id text, p_url text, p_storage_path text DEFAULT NULL::text, p_confidence smallint DEFAULT NULL::smallint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_species_id IS NULL OR length(btrim(p_species_id)) = 0 THEN RAISE EXCEPTION 'species_id required'; END IF;
  IF p_url IS NULL OR p_url !~ '^https?://' THEN RAISE EXCEPTION 'valid url required'; END IF;
  IF NOT public.fn_check_rate_limit(v_uid::text, 'species_contribute', 15) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF EXISTS (SELECT 1 FROM public.species_images
             WHERE species_id = p_species_id AND contributed_by = v_uid AND review_status = 'pending') THEN
    RAISE EXCEPTION 'already pending for this species';
  END IF;
  IF (SELECT count(*) FROM public.species_images WHERE contributed_by = v_uid AND review_status = 'pending') >= 30 THEN
    RAISE EXCEPTION 'too many pending';
  END IF;
  INSERT INTO public.species_images
    (species_id, url, storage_path, contributed_by, review_status, scan_confidence, is_primary, license, attribution)
  VALUES
    (p_species_id, p_url, p_storage_path, v_uid, 'pending', p_confidence, false, 'user-contributed', 'GreenScan-Community')
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;

revoke all on function public.fn_contribute_species_image(text, text, text, smallint) from public, anon, authenticated, service_role;
grant execute on function public.fn_contribute_species_image(text, text, text, smallint) to authenticated, service_role;

-- Trigger wie live (triggers.json, gelesen 10.11.2026)
create trigger trg_quest_track_post after insert on public.social_posts for each row execute function fn_quest_track_post();
create trigger trg_quest_track_scan after insert on public.user_scans for each row execute function fn_quest_track_scan();
create trigger trg_friendship_notify after insert or update of status on public.friendships for each row execute function fn_notify_friend_request();
create policy "ius admin read" on public.index_usage_snapshots for select to authenticated using (is_admin_user());
