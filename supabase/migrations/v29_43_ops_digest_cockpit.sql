-- v29.43 — Schicht 10: Ops-Cockpit-Digest (read-only, admin-gated)
--
-- Bündelt die Hintergrund-Schichten (Daten-Integrität · Kostendeckung · Sicherheit · Cron-Health)
-- zu EINER konsolidierten Admin-Übersicht. Liest die JÜNGSTEN Snapshots aus system_events
-- (KEIN Re-Run der Scans → kein Log-Spam, schnell) + Cron-Health-Summary + 24h-Severity-Counts.
-- Overall-Status: error wenn error-Events oder Cron-Fehler in 24h, sonst warn bei warn-Events, sonst ok.
--
-- Verifiziert (Admin-JWT): overall=ok, cron_active=22, warn/err 24h=0, integrity=108 Objekte,
-- finance MRR=7.90, security client_errors_7d=1. Privilegien: anon=NO, authenticated=YES (intern
-- via is_admin_user() gated, non-admin/postgres-ohne-JWT → 'admin only'). HL#13/#16.

create or replace function public.fn_admin_ops_digest()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'cron', 'pg_catalog'
as $function$
declare
  v_integrity jsonb; v_finance jsonb; v_security jsonb;
  v_cron_total int; v_cron_fail24 int;
  v_warn_events int; v_err_events int;
  v_overall text;
begin
  if not coalesce(public.is_admin_user(), false) then
    raise exception 'admin only';
  end if;

  select detail || jsonb_build_object('_at', created_at, '_sev', severity) into v_integrity
  from public.system_events where source='data_integrity' order by created_at desc limit 1;
  select detail || jsonb_build_object('_at', created_at, '_sev', severity) into v_finance
  from public.system_events where source='finance' order by created_at desc limit 1;
  select detail || jsonb_build_object('_at', created_at, '_sev', severity) into v_security
  from public.system_events where source='security' order by created_at desc limit 1;

  select count(*) into v_cron_total from cron.job where active;
  select count(distinct d.jobid) into v_cron_fail24
    from cron.job_run_details d
    where d.start_time > now() - interval '24 hours'
      and d.status is distinct from 'succeeded' and d.status is distinct from 'running';

  select count(*) filter (where severity='warn'), count(*) filter (where severity='error')
    into v_warn_events, v_err_events
  from public.system_events where created_at > now() - interval '24 hours';

  v_overall := case
    when coalesce(v_err_events,0) > 0 or coalesce(v_cron_fail24,0) > 0 then 'error'
    when coalesce(v_warn_events,0) > 0 then 'warn'
    else 'ok' end;

  return jsonb_build_object(
    'generated_at', now(),
    'overall', v_overall,
    'cron_active', v_cron_total,
    'cron_failed_24h', coalesce(v_cron_fail24,0),
    'events_warn_24h', coalesce(v_warn_events,0),
    'events_error_24h', coalesce(v_err_events,0),
    'integrity', v_integrity,
    'finance', v_finance,
    'security', v_security
  );
end
$function$;

revoke all on function public.fn_admin_ops_digest() from public, anon;
grant execute on function public.fn_admin_ops_digest() to authenticated;
