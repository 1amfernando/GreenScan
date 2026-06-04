-- ============================================================================
-- v28_11_push_pause — B-011 „Stille Tage" / Urlaubs-Pause (Spiegel zweier LIVE-Migrationen).
-- Pausiert ALLE Pushes vorübergehend, OHNE riskanten Edge-Fn-Redeploy.
-- (B-010 Feedback&Hilfe-Polish = rein Frontend: FAQ-Suche/Kategorien + Feedback-Diagnose-Context.)
-- ============================================================================

-- 1) Additive Spalte
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS pause_until timestamptz;

-- 2) Enforcement über das bestehende Dedup-Gate: daily-push-checker + weather-alert-checker
--    rufen fn_push_already_sent_today VOR jedem Push. Bei aktiver Pause → true (= skip ALLE Kategorien).
CREATE OR REPLACE FUNCTION public.fn_push_already_sent_today(p_user uuid, p_category text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select
    exists (select 1 from public.push_subscriptions s
            where s.user_id = p_user and s.pause_until is not null and s.pause_until > now())
    or exists (select 1 from public.push_send_log
               where user_id = p_user and category = p_category and result = 'sent'
                 and sent_at::date = current_date);
$$;

-- Verify (transaktional ROLLBACK): aktive Pause → frost+plant_tasks beide true (skip);
--   abgelaufene Pause → false (Pushes wieder aktiv).
-- Frontend: gsPushPause(days) (0=aktiv) via gsSavePushSettings(pauseUntil) → PATCH pause_until;
--   Settings „🔕 Stille Tage" (3/7/14 Tage + Aktiv) + Status in gsPushSettingsRefresh.
