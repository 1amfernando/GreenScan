-- v29.53 — Quiz-Jahres-Top-3 → 1 Jahr Pro gratis (Fernando-Produktentscheidung 18.06.2026).
--
-- Grant via comp_tier-Pfad (HL#20): NUR comp_tier='pro' + comp_expires_at=now()+1y setzen — `tier`
-- bleibt UNBERÜHRT → kein Downgrade von lifetime/stripe (v_user_entitlements-Priorität: lifetime >
-- aktive stripe-sub > comp_active > free; comp_active = comp_tier IN(pro,lifetime) AND
-- (comp_expires_at IS NULL OR > now())). SECURITY DEFINER → comp_*-UPDATE läuft als Owner → der
-- HL#18-BEFORE-UPDATE-Guard (INVOKER) lässt sie durch (gleicher Pfad wie fn_admin_set_tier).
-- comp_granted_by ist uuid → System-Grant = NULL (Provenance in system_events.detail.source).
-- Top-3 = quiz_leaderboard nach total_correct (genau wie das Frontend rankt). lifetime-comp wird
-- nicht überschrieben. Verifiziert: comp-pro-Grant → v_user_entitlements.tier='pro' (reversibler Test).

create or replace function public.fn_grant_quiz_top3_pro()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare v_ids uuid[]; v_n int := 0; v_uid uuid;
begin
  select array_agg(user_id) into v_ids from (
    select user_id from public.quiz_leaderboard
    where coalesce(total_correct, 0) > 0
    order by total_correct desc, coalesce(total_attempts, 0) desc, user_id asc
    limit 3
  ) t;
  if v_ids is null then
    insert into public.system_events(severity, source, event, detail)
    values ('info', 'quiz_reward', 'top3_grant', jsonb_build_object('granted', 0, 'reason', 'no_eligible_players'));
    return jsonb_build_object('ok', true, 'granted', 0);
  end if;
  foreach v_uid in array v_ids loop
    update public.profiles
       set comp_tier = 'pro',
           comp_expires_at = now() + interval '1 year',
           comp_granted_by = null,            -- System-Grant (uuid-Spalte; Provenance in system_events)
           comp_granted_at = now()
     where id = v_uid and coalesce(comp_tier, '') <> 'lifetime';
    if found then v_n := v_n + 1; end if;
  end loop;
  insert into public.system_events(severity, source, event, detail)
  values (case when v_n > 0 then 'warn' else 'info' end, 'quiz_reward', 'top3_grant',
          jsonb_build_object('granted', v_n, 'user_ids', to_jsonb(v_ids), 'source', 'quiz_top3_yearend',
                             'expires', (now() + interval '1 year')));
  return jsonb_build_object('ok', true, 'granted', v_n, 'user_ids', to_jsonb(v_ids));
end
$function$;

-- Admin-On-Demand-Wrapper (manueller Trigger/Test durch Admin)
create or replace function public.fn_admin_grant_quiz_top3()
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_catalog'
as $function$
begin
  if not coalesce(public.is_admin_user(), false) then raise exception 'admin only'; end if;
  return public.fn_grant_quiz_top3_pro();
end $function$;

revoke all on function public.fn_grant_quiz_top3_pro() from public, anon, authenticated;
grant execute on function public.fn_grant_quiz_top3_pro() to service_role;
revoke all on function public.fn_admin_grant_quiz_top3() from public, anon;
grant execute on function public.fn_admin_grant_quiz_top3() to authenticated;

-- Cron: 31. Dezember 23:00 UTC (vor dem Jahres-Reset der Rangliste)
select cron.schedule('quiz-top3-yearend', '0 23 31 12 *', $$ select public.fn_grant_quiz_top3_pro(); $$);
