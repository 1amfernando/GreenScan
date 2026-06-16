-- v29.42 — Schicht 7: Kostendeckungs-Observability (read-only, additiv)
--
-- Mission (CLAUDE.md): "Kostendeckung im Auge behalten · Cowork analysiert MRR vs Infra-Kosten ·
-- bei 5000 Usern Preisanpassung-Diskussion". Vereint reale AI-Kosten (ai_daily_usage in CHF) mit
-- echter MRR (stripe_subscriptions, NICHT profiles.tier — das enthält comp/admin-Grants, HL#20)
-- zu einem täglichen Snapshot in system_events. severity=warn bei Defizit-Signal (AI-Kosten 30d >
-- MRR, ab >=5 CHF) oder 5000-User-Marker. MRR = aktive Pro-Abos * 7.90 CHF; Lifetime = Einmal-
-- umsatz (separat gezählt). KEINE Schreibvorgänge ausser dem Log.
--
-- Verifiziert: Snapshot läuft (MRR 7.90 aus 1 echtem Stripe-Pro, AI 0.20 CHF/30d, Coverage 40×,
-- 11 User, severity=info), Cron aktiv 04:45 UTC, Privileg-Matrix anon=0 / authenticated nur
-- Admin-Wrapper / service_role=Worker (HL#16). Lehre: profiles zeigt pro:4/lifetime:3, echte
-- Stripe-Abos nur 1 Pro — Snapshot misst echten Umsatz, nicht vergebene Tiers.

create or replace function public.fn_finance_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_ai_7 numeric; v_ai_30 numeric; v_calls_30 bigint;
  v_pro bigint; v_life bigint; v_trial bigint;
  v_total_users bigint;
  v_mrr numeric; v_cov numeric;
  v_anom text[] := '{}'; v_sev text := 'info'; v_res jsonb;
begin
  select coalesce(sum(total_cost_chf), 0) into v_ai_7
    from public.ai_daily_usage where date > current_date - 7;
  select coalesce(sum(total_cost_chf), 0), coalesce(sum(call_count), 0) into v_ai_30, v_calls_30
    from public.ai_daily_usage where date > current_date - 30;

  -- Echte zahlende Abos aus Stripe (nicht profiles.tier, das comp/admin-Grants enthält)
  select count(*) filter (where status in ('active','trialing') and coalesce(is_lifetime,false)=false and tier='pro'),
         count(*) filter (where coalesce(is_lifetime,false) or tier='lifetime'),
         count(*) filter (where status='trialing')
    into v_pro, v_life, v_trial
  from public.stripe_subscriptions;

  select count(*) into v_total_users from public.profiles;

  v_mrr := round(v_pro * 7.90, 2);
  v_cov := case when v_ai_30 > 0 then round(v_mrr / v_ai_30, 1) else null end;

  -- Defizit-Signal: AI-Kosten 30d übersteigen MRR (nur wenn AI-Kosten nennenswert >= 5 CHF)
  if v_ai_30 > greatest(v_mrr, 0) and v_ai_30 >= 5 then
    v_anom := array_append(v_anom, 'AI-Kosten 30d ('||v_ai_30||' CHF) > MRR ('||v_mrr||' CHF) — Kostendeckung pruefen');
  end if;
  -- Mission-Trigger: 5000-User-Marker → Preisanpassung-Diskussion
  if v_total_users >= 5000 then
    v_anom := array_append(v_anom, '5000-User-Marker erreicht ('||v_total_users||') — Preisanpassung-Diskussion (Mission)');
  end if;
  if coalesce(array_length(v_anom,1),0) > 0 then v_sev := 'warn'; end if;

  v_res := jsonb_build_object(
    'snapshot_at', now(),
    'ai_cost_chf_7d', v_ai_7,
    'ai_cost_chf_30d', v_ai_30,
    'ai_calls_30d', v_calls_30,
    'active_pro_subs', v_pro,
    'trialing_subs', v_trial,
    'lifetime_holders', v_life,
    'est_mrr_chf', v_mrr,
    'total_users', v_total_users,
    'coverage_ratio_mrr_over_ai', v_cov,
    'anomalies', to_jsonb(v_anom)
  );
  insert into public.system_events(severity, source, event, detail)
  values (v_sev, 'finance', 'snapshot', v_res);
  return v_res;
end
$function$;

-- Admin-On-Demand-Wrapper (gated)
create or replace function public.fn_admin_finance_snapshot()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if not coalesce(public.is_admin_user(), false) then
    raise exception 'admin only';
  end if;
  return public.fn_finance_snapshot();
end
$function$;

-- Grants (HL#13)
revoke all on function public.fn_finance_snapshot() from public, anon, authenticated;
grant execute on function public.fn_finance_snapshot() to service_role;
revoke all on function public.fn_admin_finance_snapshot() from public, anon;
grant execute on function public.fn_admin_finance_snapshot() to authenticated;

-- Cron: täglich 04:45 UTC
select cron.schedule('finance-snapshot-daily', '45 4 * * *', $$ select public.fn_finance_snapshot(); $$);
