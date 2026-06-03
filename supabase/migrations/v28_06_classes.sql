-- ============================================================================
-- v28_06_classes — Lehrer-Dashboard (FREE): Klassen + Aufgaben + Auto-Progress
-- Spiegel der LIVE angewandten Migrationen (v28_06_classes + v28_06_classes_rpcs).
-- Baut auf v28.01-Orgs. Privacy doppelt wichtig (Schülerdaten/Minderjährige):
--   • RLS rekursionsfrei via SECURITY-DEFINER-Helper (Lesson v28.01, 42P17 vermeiden).
--   • Schüler sehen NUR eigene Submissions; Lehrkraft nur die EIGENEN Org-Klassen.
--   • join_code wird Schülern NIE preisgegeben (nur Lehrkraft via fn_class_list).
-- Verify (transaktional ROLLBACK): Auto-Progress (3 Scans→completed), Privacy
--   (S2 sieht S1-Subs=0, S2/T2-Roster blocked, Fremd-Org-Liste leer) — alle grün.
-- ============================================================================

-- ── Tabellen ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.org_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  join_code text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_classes_org ON public.org_classes(org_id);

CREATE TABLE IF NOT EXISTS public.class_members (
  class_id uuid NOT NULL REFERENCES public.org_classes(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_class_members_user ON public.class_members(user_id);

CREATE TABLE IF NOT EXISTS public.class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.org_classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  task_type text NOT NULL DEFAULT 'manual' CHECK (task_type IN ('scan_count','knowledge_read','quiz_play','achievement','manual')),
  target_count int NOT NULL DEFAULT 1,
  target_ref text,
  due_at timestamptz,
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_class_assignments_class ON public.class_assignments(class_id);

CREATE TABLE IF NOT EXISTS public.class_submissions (
  assignment_id uuid NOT NULL REFERENCES public.class_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  progress int NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assignment_id, user_id)
);

-- ── RLS-Helper (DEFINER, STABLE, anon+auth EXECUTE für Policy-Eval) ────────────
CREATE OR REPLACE FUNCTION public.fn_class_org_role(p_class_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
  SELECT public.fn_org_role(c.org_id) FROM public.org_classes c WHERE c.id = p_class_id;
$$;
GRANT EXECUTE ON FUNCTION public.fn_class_org_role(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_is_class_member(p_class_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.class_members m WHERE m.class_id=p_class_id AND m.user_id=(SELECT auth.uid()));
$$;
GRANT EXECUTE ON FUNCTION public.fn_is_class_member(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.fn_assignment_org_role(p_assignment_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
  SELECT public.fn_class_org_role(a.class_id) FROM public.class_assignments a WHERE a.id=p_assignment_id;
$$;
GRANT EXECUTE ON FUNCTION public.fn_assignment_org_role(uuid) TO anon, authenticated;

-- ── RLS-Policies (nur Reads; Writes ausschliesslich via DEFINER-RPCs) ──────────
ALTER TABLE public.org_classes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS oc_read ON public.org_classes;
CREATE POLICY oc_read ON public.org_classes FOR SELECT TO authenticated
  USING (public.fn_is_org_member(org_id) OR public.fn_is_class_member(id));
GRANT SELECT ON public.org_classes TO authenticated;

ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cm_read ON public.class_members;
CREATE POLICY cm_read ON public.class_members FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.fn_class_org_role(class_id) IN ('owner','admin','teacher'));
GRANT SELECT ON public.class_members TO authenticated;

ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ca_read ON public.class_assignments;
CREATE POLICY ca_read ON public.class_assignments FOR SELECT TO authenticated
  USING (public.fn_class_org_role(class_id) IS NOT NULL OR public.fn_is_class_member(class_id));
GRANT SELECT ON public.class_assignments TO authenticated;

ALTER TABLE public.class_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cs_read ON public.class_submissions;
CREATE POLICY cs_read ON public.class_submissions FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR public.fn_assignment_org_role(assignment_id) IN ('owner','admin','teacher'));
GRANT SELECT ON public.class_submissions TO authenticated;

-- ── RPCs (DEFINER; Hard-Lesson #13: REVOKE PUBLIC,anon + GRANT authenticated) ──
-- fn_class_create / fn_class_join / fn_class_list / fn_class_assignment_create /
-- fn_class_roster / fn_class_submission_mark: siehe Migration v28_06_classes_rpcs (LIVE).
-- fn_class_sync_my_progress (FIX: Tabellen-Aliase ca/cs statt a/s — Loop-Var-Kollision):
CREATE OR REPLACE FUNCTION public.fn_class_sync_my_progress(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); a RECORD; v_prog int; v_done boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF public.fn_is_class_member(p_class_id) IS NOT TRUE
     AND public.fn_class_org_role(p_class_id) NOT IN ('owner','admin','teacher') THEN
    RAISE EXCEPTION 'Kein Zugriff auf diese Klasse.'; END IF;
  FOR a IN SELECT * FROM public.class_assignments WHERE class_id=p_class_id AND is_active LOOP
    v_prog := 0;
    IF a.task_type='scan_count' THEN
      SELECT count(*) INTO v_prog FROM public.scan_events s WHERE s.user_id=v_uid AND s.success AND s.created_at >= a.created_at;
    ELSIF a.task_type='quiz_play' THEN
      SELECT count(*) INTO v_prog FROM public.quiz_battles q WHERE (q.challenger_id=v_uid OR q.opponent_id=v_uid) AND q.created_at >= a.created_at;
    ELSIF a.task_type='knowledge_read' THEN
      SELECT count(*) INTO v_prog FROM public.knowledge_progress k WHERE k.user_id=v_uid AND (a.target_ref IS NULL OR k.source_id=a.target_ref);
    ELSIF a.task_type='achievement' THEN
      SELECT CASE WHEN EXISTS(SELECT 1 FROM public.user_achievements u WHERE u.user_id=v_uid AND u.achievement_slug=a.target_ref) THEN 1 ELSE 0 END INTO v_prog;
    ELSE
      SELECT COALESCE(progress,0) INTO v_prog FROM public.class_submissions WHERE assignment_id=a.id AND user_id=v_uid;
      v_prog := COALESCE(v_prog,0);
    END IF;
    v_done := v_prog >= a.target_count;
    INSERT INTO public.class_submissions(assignment_id,user_id,progress,completed,completed_at,updated_at)
    VALUES (a.id, v_uid, v_prog, v_done, CASE WHEN v_done THEN now() ELSE NULL END, now())
    ON CONFLICT (assignment_id,user_id) DO UPDATE SET
      progress     = GREATEST(public.class_submissions.progress, EXCLUDED.progress),
      completed    = public.class_submissions.completed OR EXCLUDED.completed,
      completed_at = COALESCE(public.class_submissions.completed_at, CASE WHEN EXCLUDED.completed THEN now() ELSE NULL END),
      updated_at   = now();
  END LOOP;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', ca.id, 'title', ca.title, 'description', ca.description, 'task_type', ca.task_type,
      'target_count', ca.target_count, 'due_at', ca.due_at,
      'progress', COALESCE(cs.progress,0), 'completed', COALESCE(cs.completed,false)
    ) ORDER BY ca.created_at DESC)
    FROM public.class_assignments ca
    LEFT JOIN public.class_submissions cs ON cs.assignment_id=ca.id AND cs.user_id=v_uid
    WHERE ca.class_id=p_class_id AND ca.is_active
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.fn_class_sync_my_progress(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_class_sync_my_progress(uuid) TO authenticated;
