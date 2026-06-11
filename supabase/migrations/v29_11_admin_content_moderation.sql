-- ============ v29.11 Admin Content-Moderation ============
-- Admin-Erweiterung #1 (von 4): Community-Posts + Marktplatz-Inserate + Kommentare als Admin
-- verstecken/wiederherstellen/löschen. SECURITY DEFINER + is_admin_user()-Gate + audit_log
-- (Muster aus fn_admin_set_tier). Unsichtbar für normale Nutzer. Als Admin-JWT verifiziert:
-- non-admin→forbidden, Feed nur Admin, hide/unhide/delete korrekt, comment=nur delete.

CREATE OR REPLACE FUNCTION public.fn_admin_moderate(p_type text, p_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_type   NOT IN ('post','listing','comment') THEN RETURN jsonb_build_object('error','invalid_type'); END IF;
  IF p_action NOT IN ('hide','unhide','delete')   THEN RETURN jsonb_build_object('error','invalid_action'); END IF;

  IF p_type = 'post' THEN
    IF p_action = 'delete' THEN
      DELETE FROM post_comments WHERE post_id = p_id;   -- Kinder zuerst (FK-sicher)
      DELETE FROM social_posts  WHERE id = p_id;
    ELSE
      UPDATE social_posts SET is_archived = (p_action = 'hide') WHERE id = p_id;
    END IF;

  ELSIF p_type = 'listing' THEN
    IF p_action = 'delete' THEN
      DELETE FROM marketplace_listings WHERE id = p_id;
    ELSE
      UPDATE marketplace_listings SET status = CASE WHEN p_action = 'hide' THEN 'archived' ELSE 'active' END WHERE id = p_id;
    END IF;

  ELSIF p_type = 'comment' THEN
    IF p_action <> 'delete' THEN RETURN jsonb_build_object('error','comment_only_delete'); END IF;
    DELETE FROM post_comments WHERE id = p_id;
  END IF;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'admin_moderate', p_type, p_id::text, jsonb_build_object('action', p_action));
  RETURN jsonb_build_object('ok', true, 'type', p_type, 'id', p_id, 'action', p_action);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_moderate(text, uuid, text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_moderate(text, uuid, text) TO authenticated;

-- Vereinheitlichter Moderations-Feed (zeigt auch versteckte/archivierte Inhalte → Admin kann wiederherstellen)
CREATE OR REPLACE FUNCTION public.fn_admin_moderation_feed(p_limit int DEFAULT 40)
RETURNS TABLE(kind text, id uuid, post_id uuid, author text, snippet text, status text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN; END IF;
  RETURN QUERY
    SELECT * FROM (
      SELECT 'post'::text, p.id, p.id, coalesce(p.author_name,'?'),
             left(coalesce(p.content,''),120), CASE WHEN p.is_archived THEN 'hidden' ELSE 'active' END, p.created_at
        FROM social_posts p
      UNION ALL
      SELECT 'listing', l.id, NULL::uuid, coalesce(pr.display_name, '?'),
             left(coalesce(l.title,''),120), l.status, l.created_at
        FROM marketplace_listings l LEFT JOIN profiles pr ON pr.id = l.user_id
      UNION ALL
      SELECT 'comment', c.id, c.post_id, coalesce(c.author_name,'?'),
             left(coalesce(c.content,''),120), 'comment', c.created_at
        FROM post_comments c
    ) q
    ORDER BY q.created_at DESC
    LIMIT greatest(1, least(p_limit, 100));
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.fn_admin_moderation_feed(int) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_moderation_feed(int) TO authenticated;
