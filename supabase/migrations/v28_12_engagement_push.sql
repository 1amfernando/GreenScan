-- ============================================================================
-- v28_12_engagement_push — Push-Vervollständigung (Spiegel der LIVE-Migrationen).
-- 3 deferred Pushes aktiviert (alle FREE, Opt-out pro Kategorie):
--   Klassen (neue Aufgabe/Einreichungen), Doktor-Follow-up (7d), Battle (Gegner geantwortet).
-- Architektur: SEPARATE Edge-Fn engagement-push-checker (daily-push-checker bleibt unberührt).
-- Respektiert Quiet-Hours + v28.11-„Stille Tage" automatisch (via fn_push_already_sent_today).
-- ============================================================================

-- 1) Opt-out-Flags (additiv, default an)
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS notify_classes boolean NOT NULL DEFAULT true;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS notify_doctor  boolean NOT NULL DEFAULT true;
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS notify_battle  boolean NOT NULL DEFAULT true;

-- 2) Detektions-RPCs (DEFINER, REVOKE PUBLIC,anon + GRANT authenticated)
CREATE OR REPLACE FUNCTION public.fn_eng_doctor_due(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.plant_doctor_history
    WHERE user_id=p_user AND status='open' AND followup_due_at IS NOT NULL
      AND followup_due_at <= now() AND followup_result IS NULL);
$$;
REVOKE ALL ON FUNCTION public.fn_eng_doctor_due(uuid) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.fn_eng_doctor_due(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_eng_class_new(p_user uuid, p_hours int DEFAULT 24)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT count(*)::int FROM public.class_assignments a
  JOIN public.class_members m ON m.class_id = a.class_id
  WHERE m.user_id = p_user AND a.is_active
    AND a.created_at > now() - make_interval(hours => p_hours) AND a.created_by <> p_user;
$$;
REVOKE ALL ON FUNCTION public.fn_eng_class_new(uuid,int) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.fn_eng_class_new(uuid,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_eng_class_submissions(p_user uuid, p_hours int DEFAULT 24)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT count(*)::int FROM public.class_submissions s
  JOIN public.class_assignments a ON a.id = s.assignment_id
  JOIN public.org_classes c ON c.id = a.class_id
  JOIN public.org_members om ON om.org_id = c.org_id AND om.user_id = p_user
  WHERE om.role IN ('owner','admin','teacher')
    AND s.completed AND s.updated_at > now() - make_interval(hours => p_hours) AND s.user_id <> p_user;
$$;
REVOKE ALL ON FUNCTION public.fn_eng_class_submissions(uuid,int) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.fn_eng_class_submissions(uuid,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_eng_battle_waiting(p_user uuid, p_hours int DEFAULT 24)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT count(*)::int FROM public.quiz_battles
  WHERE challenger_id = p_user AND status = 'resolved'
    AND resolved_at IS NOT NULL AND resolved_at > now() - make_interval(hours => p_hours);
$$;
REVOKE ALL ON FUNCTION public.fn_eng_battle_waiting(uuid,int) FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION public.fn_eng_battle_waiting(uuid,int) TO authenticated;

-- 3) Edge-Fn engagement-push-checker v1 (LIVE, verify_jwt=false, x-cron-secret) — bewusst NICHT als
--    TS-Spiegel (Transkriptions-Risiko). + Cron engagement-push-3h ('0 7,10,13,16,19 * * *', jobid 16).
-- Verify: Detektions-RPCs transaktional positiv (Schüler/ Lehrer/ Rollen-Trennung). Dry-Run HTTP 200.
