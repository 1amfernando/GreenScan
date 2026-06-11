-- ============ v29.12 Admin Nutzer-Detailansicht ============
-- Admin-Erweiterung #2 (von 4): alles über einen Nutzer an einem Ort (Profil + Abo-Status +
-- Aktivitäts-Zähler). SECURITY DEFINER + is_admin_user()-Gate. Read-only (Aktionen laufen
-- weiter über fn_admin_set_tier / fn_assign_role). Als Admin-JWT verifiziert:
-- non-admin→forbidden, profile+6 counts+email vorhanden, unbekannte uid→user_not_found.
CREATE OR REPLACE FUNCTION public.fn_admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v jsonb;
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(t) FROM (
       SELECT id, email, display_name, avatar_emoji, tier, role, xp, level, login_streak, longest_streak,
              scan_count, last_scan_at, created_at, last_login, quiz_elo, battles_won, battles_lost,
              is_admin, is_expert, profile_visibility, region
       FROM profiles WHERE id = p_user_id) t),
    'subscription', (SELECT to_jsonb(s) FROM (
       SELECT status, tier, current_period_end, cancel_at_period_end, trial_end, canceled_at, price_id, is_lifetime
       FROM stripe_subscriptions WHERE user_id = p_user_id ORDER BY current_period_end DESC NULLS LAST LIMIT 1) s),
    'counts', jsonb_build_object(
       'finds',     (SELECT count(*) FROM map_user_finds      WHERE user_id = p_user_id),
       'posts',     (SELECT count(*) FROM social_posts        WHERE user_id = p_user_id),
       'listings',  (SELECT count(*) FROM marketplace_listings WHERE user_id = p_user_id),
       'harvests',  (SELECT count(*) FROM garden_harvests     WHERE user_id = p_user_id),
       'followers', (SELECT count(*) FROM user_follows        WHERE followed_id = p_user_id),
       'following', (SELECT count(*) FROM user_follows        WHERE follower_id = p_user_id)
    )
  ) INTO v;
  IF v->'profile' IS NULL OR v->'profile' = 'null'::jsonb THEN RETURN jsonb_build_object('error','user_not_found'); END IF;
  RETURN v;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_user_detail(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_user_detail(uuid) TO authenticated;
