-- v29.42c — Schicht 9 (additiv, read-only, KEIN App-v-Bump): Sicherheits-/Missbrauchs-Observability.
--
-- Aggregiert Rate-Limit-Aktivität (rate_limits: bucket/action/count/window_start), Client-Fehler-
-- Trend (client_errors) und sensible Admin-Aktionen (audit_log) zu einem täglichen Sicherheits-
-- Snapshot in system_events. severity=warn bei konservativen, fehlalarm-armen Schwellen:
--   • >50 Client-Fehler in 24h (möglicher Spike/Breakage)
--   • >20 sensible Admin-Aktionen in 24h (Rollen/Tier/Ban/Admin/Delete/Moderation — auffällig)
--   • Rate-Limit-Counter >200 in 24h (möglicher Missbrauch durch einen Actor)
-- Read-only, payment-Tabellen unberührt. Surface via System-Ereignisse + Cron security-scan-daily.
-- Verifiziert: Cron aktiv 04:50 UTC, Privileg-Matrix anon=0 / authenticated nur Admin-Wrapper /
-- service_role=Worker (HL#16). Baseline-Lauf: 0 Anomalien (severity=info).

create or replace function public.fn_security_scan()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_rl_active bigint; v_rl_max bigint; v_rl_top jsonb;
  v_ce_24 bigint; v_ce_7 bigint; v_ce_top jsonb;
  v_audit_24 bigint; v_audit_sensitive_24 bigint;
  v_anom text[] := '{}'; v_sev text := 'info'; v_res jsonb;
begin
  -- Rate-Limit-Aktivität (24h)
  select count(*), coalesce(max(count), 0)
    into v_rl_active, v_rl_max
  from public.rate_limits where window_start > now() - interval '24 hours';

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_rl_top from (
    select action, bucket, count
    from public.rate_limits
    where window_start > now() - interval '24 hours'
    order by count desc limit 3
  ) t;

  -- Client-Fehler (24h / 7d) + Top-Typen
  select count(*) filter (where created_at > now() - interval '24 hours'),
         count(*) filter (where created_at > now() - interval '7 days')
    into v_ce_24, v_ce_7 from public.client_errors;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_ce_top from (
    select err_type, count(*) c from public.client_errors
    where created_at > now() - interval '7 days'
    group by err_type order by c desc limit 3
  ) t;

  -- Audit-Aktivität (24h) + sensible Aktionen (Rollen/Tier/Ban/Admin/Delete/Moderation)
  select count(*) filter (where created_at > now() - interval '24 hours'),
         count(*) filter (where created_at > now() - interval '24 hours'
           and (action ilike '%role%' or action ilike '%tier%' or action ilike '%ban%'
                or action ilike '%admin%' or action ilike '%delete%' or action ilike '%moderat%'))
    into v_audit_24, v_audit_sensitive_24 from public.audit_log;

  -- Anomalie-Schwellen (konservativ, fehlalarm-arm)
  if v_ce_24 > 50 then
    v_anom := array_append(v_anom, v_ce_24 || ' Client-Fehler in 24h (moegl. Spike)');
  end if;
  if v_audit_sensitive_24 > 20 then
    v_anom := array_append(v_anom, v_audit_sensitive_24 || ' sensible Admin-Aktionen in 24h (auffaellig)');
  end if;
  if v_rl_max > 200 then
    v_anom := array_append(v_anom, 'Rate-Limit-Counter bis ' || v_rl_max || ' in 24h (moegl. Missbrauch)');
  end if;
  if coalesce(array_length(v_anom, 1), 0) > 0 then v_sev := 'warn'; end if;

  v_res := jsonb_build_object(
    'scanned_at', now(),
    'rate_limit_windows_24h', v_rl_active,
    'rate_limit_max_count_24h', v_rl_max,
    'rate_limit_top', v_rl_top,
    'client_errors_24h', v_ce_24,
    'client_errors_7d', v_ce_7,
    'client_errors_top_types', v_ce_top,
    'audit_actions_24h', v_audit_24,
    'audit_sensitive_actions_24h', v_audit_sensitive_24,
    'anomalies', to_jsonb(v_anom)
  );
  insert into public.system_events(severity, source, event, detail)
  values (v_sev, 'security', 'scan', v_res);
  return v_res;
end
$function$;

create or replace function public.fn_admin_security_scan()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if not coalesce(public.is_admin_user(), false) then
    raise exception 'admin only';
  end if;
  return public.fn_security_scan();
end
$function$;

-- Grants (HL#13)
revoke all on function public.fn_security_scan() from public, anon, authenticated;
grant execute on function public.fn_security_scan() to service_role;
revoke all on function public.fn_admin_security_scan() from public, anon;
grant execute on function public.fn_admin_security_scan() to authenticated;

-- Cron: täglich 04:50 UTC
select cron.schedule('security-scan-daily', '50 4 * * *', $$ select public.fn_security_scan(); $$);
