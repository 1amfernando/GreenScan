-- ============================================================================
-- v28_06_classes_rpcs — Lehrer-Dashboard RPCs (Spiegel der LIVE-Migration).
-- Alle DEFINER; Hard-Lesson #13: REVOKE PUBLIC,anon + GRANT authenticated.
-- (fn_class_sync_my_progress liegt in v28_06_classes.sql — korrigierte Fassung.)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_class_create(p_org_id uuid, p_name text, p_description text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_role text; v_code text; v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  v_role := public.fn_org_role(p_org_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin','teacher') THEN
    RAISE EXCEPTION 'Nur Lehrkräfte/Admins können Klassen erstellen.'; END IF;
  IF p_name IS NULL OR length(trim(p_name))=0 THEN RAISE EXCEPTION 'Name fehlt.'; END IF;
  LOOP
    v_code := upper(substring(md5(gen_random_uuid()::text) from 1 for 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.org_classes WHERE join_code=v_code);
  END LOOP;
  INSERT INTO public.org_classes(org_id,name,description,join_code,created_by)
  VALUES (p_org_id, trim(p_name), NULLIF(trim(coalesce(p_description,'')),''), v_code, v_uid)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id, 'join_code', v_code, 'name', trim(p_name));
END $$;
REVOKE ALL ON FUNCTION public.fn_class_create(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_class_create(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_class_join(p_join_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_cls RECORD;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT id, org_id, name, is_active INTO v_cls FROM public.org_classes WHERE join_code = upper(trim(p_join_code));
  IF NOT FOUND OR NOT v_cls.is_active THEN RAISE EXCEPTION 'Ungültiger oder inaktiver Klassen-Code.'; END IF;
  IF public.fn_is_org_member(v_cls.org_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Bitte zuerst der Organisation beitreten (Einladungscode der Lehrkraft).'; END IF;
  INSERT INTO public.class_members(class_id,user_id) VALUES (v_cls.id, v_uid)
  ON CONFLICT (class_id,user_id) DO NOTHING;
  RETURN jsonb_build_object('class_id', v_cls.id, 'name', v_cls.name, 'joined', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_class_join(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_class_join(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_class_list(p_org_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', c.id, 'org_id', c.org_id, 'name', c.name, 'description', c.description,
      'is_teacher', public.fn_org_role(c.org_id) IN ('owner','admin','teacher'),
      'join_code', CASE WHEN public.fn_org_role(c.org_id) IN ('owner','admin','teacher') THEN c.join_code ELSE NULL END,
      'member_count', (SELECT count(*) FROM public.class_members m WHERE m.class_id=c.id),
      'assignment_count', (SELECT count(*) FROM public.class_assignments a WHERE a.class_id=c.id AND a.is_active),
      'created_at', c.created_at
    ) ORDER BY c.created_at DESC)
    FROM public.org_classes c
    WHERE c.is_active AND (p_org_id IS NULL OR c.org_id = p_org_id)
      AND ( public.fn_org_role(c.org_id) IN ('owner','admin','teacher')
            OR EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id=c.id AND m.user_id=v_uid) )
  ), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.fn_class_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_class_list(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_class_assignment_create(p_class_id uuid, p_title text, p_description text,
  p_task_type text, p_target_count int, p_target_ref text, p_due_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_id uuid;
BEGIN
  v_role := public.fn_class_org_role(p_class_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin','teacher') THEN RAISE EXCEPTION 'Nur Lehrkräfte können Aufgaben erstellen.'; END IF;
  IF p_title IS NULL OR length(trim(p_title))=0 THEN RAISE EXCEPTION 'Titel fehlt.'; END IF;
  IF COALESCE(p_task_type,'manual') NOT IN ('scan_count','knowledge_read','quiz_play','achievement','manual') THEN RAISE EXCEPTION 'Ungültiger Aufgaben-Typ.'; END IF;
  INSERT INTO public.class_assignments(class_id,title,description,task_type,target_count,target_ref,due_at,created_by)
  VALUES (p_class_id, trim(p_title), NULLIF(trim(coalesce(p_description,'')),''), COALESCE(p_task_type,'manual'),
          GREATEST(1,COALESCE(p_target_count,1)), NULLIF(trim(coalesce(p_target_ref,'')),''), p_due_at, (SELECT auth.uid()))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.fn_class_assignment_create(uuid,text,text,text,int,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_class_assignment_create(uuid,text,text,text,int,text,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_class_roster(p_class_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path=public,pg_temp AS $$
DECLARE v_role text; v_total int;
BEGIN
  v_role := public.fn_class_org_role(p_class_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin','teacher') THEN RAISE EXCEPTION 'Nur Lehrkräfte sehen die Klassenliste.'; END IF;
  SELECT count(*) INTO v_total FROM public.class_assignments a WHERE a.class_id=p_class_id AND a.is_active;
  RETURN jsonb_build_object(
    'assignment_total', v_total,
    'assignments', COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'title',a.title,'task_type',a.task_type,'target_count',a.target_count,'due_at',a.due_at) ORDER BY a.created_at DESC)
                             FROM public.class_assignments a WHERE a.class_id=p_class_id AND a.is_active), '[]'::jsonb),
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'user_id', m.user_id,
        'name', COALESCE(om.display_name_in_org, 'Schüler:in'),
        'completed', (SELECT count(*) FROM public.class_submissions s JOIN public.class_assignments a ON a.id=s.assignment_id
                       WHERE a.class_id=p_class_id AND a.is_active AND s.user_id=m.user_id AND s.completed),
        'joined_at', m.joined_at
      ) ORDER BY m.joined_at)
      FROM public.class_members m
      LEFT JOIN public.org_members om ON om.org_id=(SELECT org_id FROM public.org_classes WHERE id=p_class_id) AND om.user_id=m.user_id
      WHERE m.class_id=p_class_id
    ), '[]'::jsonb)
  );
END $$;
REVOKE ALL ON FUNCTION public.fn_class_roster(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_class_roster(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_class_submission_mark(p_assignment_id uuid, p_user_id uuid, p_completed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text;
BEGIN
  v_role := public.fn_assignment_org_role(p_assignment_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin','teacher') THEN RAISE EXCEPTION 'Nur Lehrkräfte.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_members m JOIN public.class_assignments a ON a.class_id=m.class_id
                 WHERE a.id=p_assignment_id AND m.user_id=p_user_id) THEN
    RAISE EXCEPTION 'Schüler:in nicht in dieser Klasse.'; END IF;
  INSERT INTO public.class_submissions(assignment_id,user_id,completed,completed_at,updated_at)
  VALUES (p_assignment_id,p_user_id,p_completed, CASE WHEN p_completed THEN now() ELSE NULL END, now())
  ON CONFLICT (assignment_id,user_id) DO UPDATE SET
    completed=EXCLUDED.completed,
    completed_at=CASE WHEN EXCLUDED.completed THEN COALESCE(public.class_submissions.completed_at,now()) ELSE NULL END,
    updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.fn_class_submission_mark(uuid,uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_class_submission_mark(uuid,uuid,boolean) TO authenticated;
