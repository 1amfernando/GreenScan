-- #2: Nutzer-Meldungen (gsReportUser/reportListing) gingen NIRGENDWOHIN — kein Tisch, kein Server-Write,
-- aber ein "Meldung übermittelt, wir prüfen das"-Toast. Sicherheits-Kontroll-Fake. Hier: echte Persistenz + Admin-Queue.
-- Angewendet 2026-06-24 via MCP. Verifiziert als echter JWT: Insert+Dedupe ok, Self-Report blockiert, Admin-Gate greift.

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid(),
  target_type text not null check (target_type in ('user','listing','post','comment')),
  target_ref text not null,
  reason text,
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_ref)
);
alter table public.user_reports enable row level security;

-- INSERT nur eigene Meldungen; SELECT/UPDATE nur Admin (HL#18: UPDATE admin-only, kein own-row → keine Self-Escalation).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_reports' and policyname='user_reports_insert_own') then
    create policy user_reports_insert_own on public.user_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_reports' and policyname='user_reports_select_admin') then
    create policy user_reports_select_admin on public.user_reports for select to authenticated using (public.is_admin_user());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_reports' and policyname='user_reports_update_admin') then
    create policy user_reports_update_admin on public.user_reports for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;
create index if not exists idx_user_reports_status_created on public.user_reports(status, created_at desc);

create or replace function public.fn_report(p_target_type text, p_target_ref text, p_reason text default null)
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp'
as $function$
declare v_uid uuid := (select auth.uid()); v_id uuid;
begin
  if v_uid is null then raise exception 'auth required'; end if;
  if p_target_type is null or p_target_type not in ('user','listing','post','comment') then raise exception 'invalid target_type'; end if;
  if p_target_ref is null or length(btrim(p_target_ref))=0 then raise exception 'target_ref required'; end if;
  if p_target_type='user' and p_target_ref = v_uid::text then raise exception 'cannot report self'; end if;
  if not public.fn_check_rate_limit(v_uid::text, 'user_report', 20) then raise exception 'rate_limited'; end if;
  insert into public.user_reports (reporter_id, target_type, target_ref, reason)
  values (v_uid, p_target_type, p_target_ref, nullif(btrim(coalesce(p_reason,'')),''))
  on conflict (reporter_id, target_type, target_ref) do nothing
  returning id into v_id;
  return jsonb_build_object('ok', true, 'duplicate', v_id is null);
end; $function$;
revoke execute on function public.fn_report(text,text,text) from public, anon;
grant execute on function public.fn_report(text,text,text) to authenticated;

create or replace function public.fn_admin_reports_list(p_limit int default 100)
returns table(id uuid, reporter_id uuid, target_type text, target_ref text, reason text, status text, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public','pg_temp'
as $function$
begin
  if not public.is_admin_user() then raise exception 'admin only'; end if;
  return query select r.id, r.reporter_id, r.target_type, r.target_ref, r.reason, r.status, r.created_at
    from public.user_reports r where r.status='open' order by r.created_at desc limit greatest(1, least(p_limit, 500));
end; $function$;
revoke execute on function public.fn_admin_reports_list(int) from public, anon;
grant execute on function public.fn_admin_reports_list(int) to authenticated;
