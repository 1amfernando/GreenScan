-- v30.24 Security Hardening (2026-06-24)
-- Automated audit findings: 2 confirmed exploitable issues fixed.

-- Fix 1: toggle_post_like — add auth.uid() enforcement so users cannot like/unlike as others.
-- Previously p_user_id was accepted without verification; any authenticated user could pass
-- any UUID to manipulate another user's social actions.
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id uuid, p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_existing uuid; v_liked boolean; v_count integer;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'unauthorized: p_user_id must match authenticated user';
  END IF;
  SELECT id INTO v_existing FROM public.post_likes WHERE post_id = p_post_id AND user_id = p_user_id;
  IF v_existing IS NOT NULL THEN
    DELETE FROM public.post_likes WHERE id = v_existing; v_liked := false;
  ELSE
    INSERT INTO public.post_likes (post_id, user_id) VALUES (p_post_id, p_user_id); v_liked := true;
  END IF;
  UPDATE public.social_posts SET likes = GREATEST(0, (SELECT COUNT(*) FROM public.post_likes WHERE post_id = p_post_id))
    WHERE id = p_post_id RETURNING likes INTO v_count;
  RETURN jsonb_build_object('liked', v_liked, 'likes', v_count);
END;
$function$;

-- Fix 2: fn_create_notification — restrict to service_role only.
-- Authenticated frontend users were able to push notifications to arbitrary user_ids.
-- This function is only ever called server-side (pg_cron, Edge Functions, admin SQL).
REVOKE EXECUTE ON FUNCTION public.fn_create_notification(uuid, text, text, text, text, text) FROM authenticated;
