-- ============ v29.14 Admin Wissens-DB-Editor (Admin-Ausbau 4/4) ============
-- Wissens-Inhalte anlegen/editieren/freigeben/löschen. Generisch über SERVER-SEITIGE Tabellen-
-- Whitelist + Spalten-Config (Tabellenname NIE roh vom Client; format/%I-Quoting). Alle DEFINER +
-- is_admin_user()-Gate + audit_log, REVOKE anon. category optional (leer→NULL, CHECK-konform),
-- CHECK-Verletzung → freundlicher Fehler 'invalid_category'. Als Admin/Non-Admin-JWT verifiziert.
-- Editierbar: remedies/recipes (Text=description) · folk_lore/garden_techniques/did_you_know_facts
-- (Text=body) · Publish-Spalte is_active für did_you_know_facts, sonst is_published.

CREATE OR REPLACE FUNCTION public.fn_admin_knowledge_list(p_table text, p_limit int DEFAULT 50)
RETURNS TABLE(id text, title text, snippet text, category text, published boolean, ts timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_textcol text; v_pubcol text; v_ordercol text; v_lim int := greatest(1, least(coalesce(p_limit,50), 200));
BEGIN
  IF NOT is_admin_user() THEN RETURN; END IF;
  IF p_table NOT IN ('remedies','recipes','folk_lore','garden_techniques','did_you_know_facts') THEN RETURN; END IF;
  v_textcol  := CASE WHEN p_table IN ('remedies','recipes') THEN 'description' ELSE 'body' END;
  v_pubcol   := CASE WHEN p_table = 'did_you_know_facts' THEN 'is_active' ELSE 'is_published' END;
  v_ordercol := CASE WHEN p_table = 'did_you_know_facts' THEN 'created_at' ELSE 'updated_at' END;
  RETURN QUERY EXECUTE format(
    'SELECT id::text, coalesce(title,'''')::text, left(coalesce(%I::text,''''),4000)::text, coalesce(category,'''')::text, coalesce(%I,false), %I FROM public.%I ORDER BY %I DESC NULLS LAST LIMIT %s',
    v_textcol, v_pubcol, v_ordercol, p_table, v_ordercol, v_lim);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_knowledge_list(text,int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_knowledge_list(text,int) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_knowledge_save(p_table text, p_id text, p_title text, p_text text, p_category text, p_published boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_textcol text; v_pubcol text; v_hasupd boolean; v_newid text; v_rows int; v_cat text;
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_table NOT IN ('remedies','recipes','folk_lore','garden_techniques','did_you_know_facts') THEN RETURN jsonb_build_object('error','invalid_table'); END IF;
  IF coalesce(trim(p_title),'') = '' THEN RETURN jsonb_build_object('error','no_title'); END IF;
  v_textcol := CASE WHEN p_table IN ('remedies','recipes') THEN 'description' ELSE 'body' END;
  v_pubcol  := CASE WHEN p_table = 'did_you_know_facts' THEN 'is_active' ELSE 'is_published' END;
  v_hasupd  := (p_table <> 'did_you_know_facts');
  v_cat     := nullif(trim(coalesce(p_category,'')),'');
  BEGIN
    IF coalesce(trim(p_id),'') = '' THEN
      EXECUTE format('INSERT INTO public.%I (title, %I, category, %I) VALUES (%L,%L,%L,%L) RETURNING id::text',
        p_table, v_textcol, v_pubcol, p_title, coalesce(p_text,''), v_cat, coalesce(p_published,false)) INTO v_newid;
      INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
      VALUES ((SELECT auth.uid()), 'knowledge_create', p_table, v_newid, jsonb_build_object('title',p_title,'published',coalesce(p_published,false)));
      RETURN jsonb_build_object('ok', true, 'id', v_newid, 'created', true);
    ELSE
      EXECUTE format('UPDATE public.%I SET title=%L, %I=%L, category=%L, %I=%L %s WHERE id::text=%L',
        p_table, p_title, v_textcol, coalesce(p_text,''), v_cat, v_pubcol, coalesce(p_published,false),
        CASE WHEN v_hasupd THEN ', updated_at=now()' ELSE '' END, p_id);
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      IF v_rows = 0 THEN RETURN jsonb_build_object('error','not_found'); END IF;
      INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
      VALUES ((SELECT auth.uid()), 'knowledge_update', p_table, p_id, jsonb_build_object('title',p_title,'published',coalesce(p_published,false)));
      RETURN jsonb_build_object('ok', true, 'id', p_id);
    END IF;
  EXCEPTION
    WHEN check_violation THEN RETURN jsonb_build_object('error','invalid_category');
    WHEN not_null_violation THEN RETURN jsonb_build_object('error','missing_required');
  END;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_knowledge_save(text,text,text,text,text,boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_knowledge_save(text,text,text,text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_knowledge_set_published(p_table text, p_id text, p_published boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pubcol text; v_hasupd boolean; v_rows int;
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_table NOT IN ('remedies','recipes','folk_lore','garden_techniques','did_you_know_facts') THEN RETURN jsonb_build_object('error','invalid_table'); END IF;
  v_pubcol := CASE WHEN p_table = 'did_you_know_facts' THEN 'is_active' ELSE 'is_published' END;
  v_hasupd := (p_table <> 'did_you_know_facts');
  EXECUTE format('UPDATE public.%I SET %I=%L %s WHERE id::text=%L',
    p_table, v_pubcol, coalesce(p_published,false), CASE WHEN v_hasupd THEN ', updated_at=now()' ELSE '' END, p_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('error','not_found'); END IF;
  INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'knowledge_publish', p_table, p_id, jsonb_build_object('published', coalesce(p_published,false)));
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_knowledge_set_published(text,text,boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_knowledge_set_published(text,text,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_admin_knowledge_delete(p_table text, p_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_rows int;
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_table NOT IN ('remedies','recipes','folk_lore','garden_techniques','did_you_know_facts') THEN RETURN jsonb_build_object('error','invalid_table'); END IF;
  IF coalesce(trim(p_id),'') = '' THEN RETURN jsonb_build_object('error','no_id'); END IF;
  EXECUTE format('DELETE FROM public.%I WHERE id::text=%L', p_table, p_id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN jsonb_build_object('error','not_found'); END IF;
  INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'knowledge_delete', p_table, p_id, '{}'::jsonb);
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_knowledge_delete(text,text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_knowledge_delete(text,text) TO authenticated;
