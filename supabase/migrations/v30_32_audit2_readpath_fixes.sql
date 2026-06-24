-- Audit-Welle 2 — read-path Korrekturen (3 Fixes, alle SELECT-/View-seitig, kein Datenverlust-Risiko).
-- Angewendet 2026-06-24 via MCP. Preview-/SQL-verifiziert (Owner sieht archiviert=1, Nicht-Owner=0).

-- #1 v_marketplace_listings: archivierte/eigene Inserate für den OWNER sichtbar machen.
-- Vorher: WHERE status IN (active,reserved,sold) OR NULL → Besitzer verlor archivierte Inserate komplett
-- aus seiner eigenen Sicht (kein Re-Aktivieren/Editieren/Löschen nach Reload). security_invoker=on +
-- RLS marketplace_select_active erlaubt own-rows → die eigene Zeile ist NUR für den Owner sichtbar.
CREATE OR REPLACE VIEW public.v_marketplace_listings
WITH (security_invoker=on) AS
 SELECT m.id, m.user_id, m.title, m.description, m.category, m.price, m.currency, m.region,
    m.contact, m.photo_url, m.photo_urls, m.price_mode, m.status, m.views, m.reports, m.data,
    m.created_at, m.updated_at,
    COALESCE(p.display_name, split_part(p.email, '@'::citext, 1), 'Anonym'::text) AS seller_name,
    p.avatar_emoji AS seller_avatar,
    p.is_expert AS seller_is_expert,
    COALESCE(p.tier = ANY (ARRAY['plus'::text, 'pro'::text, 'plus_lifetime'::text]), false) AS seller_is_premium,
    COALESCE(p.level, 1) AS seller_level,
    m.sold_at
   FROM marketplace_listings m
     LEFT JOIN profiles p ON p.id = m.user_id
  WHERE (m.status = ANY (ARRAY['active'::text, 'reserved'::text, 'sold'::text]))
     OR m.status IS NULL
     OR m.user_id = (SELECT auth.uid());

-- #9 fn_user_search: bio nur für öffentliche Profile (followers_only/private → NULL), konsistent mit fn_profile_view.
CREATE OR REPLACE FUNCTION public.fn_user_search(p_q text, p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, display_name text, bio text, avatar_url text, avatar_emoji text, region text, follower_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p.id, p.display_name,
    CASE WHEN p.profile_visibility = 'public' THEN p.bio ELSE NULL END AS bio,
    p.avatar_url, p.avatar_emoji, p.region,
    (SELECT count(*)::int FROM public.user_follows WHERE followed_id = p.id) AS follower_count
  FROM public.profiles p
  WHERE p.profile_visibility <> 'private'
    AND coalesce(p.display_name,'') <> ''
    AND length(coalesce(p_q,'')) >= 2
    AND lower(p.display_name) ILIKE '%' || lower(p_q) || '%'
    AND p.id <> (SELECT auth.uid())
    AND NOT EXISTS(SELECT 1 FROM public.user_blocks ub
                   WHERE (ub.blocker_id = p.id AND ub.blocked_id = (SELECT auth.uid()))
                      OR (ub.blocker_id = (SELECT auth.uid()) AND ub.blocked_id = p.id))
  ORDER BY follower_count DESC, p.display_name ASC
  LIMIT GREATEST(1, LEAST(p_limit, 50));
$function$;

-- #7 launch_offer_available: globalen 100-User-Cap WIRKLICH erzwingen (vorher nur per-User-Dedup).
CREATE OR REPLACE FUNCTION public.launch_offer_available()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_used boolean; v_count int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('available', true, 'logged_in', false); END IF;
  SELECT EXISTS(SELECT 1 FROM public.launch_offer_usage WHERE user_id = auth.uid()) INTO v_used;
  SELECT count(*) INTO v_count FROM public.launch_offer_usage;
  RETURN jsonb_build_object('available', (v_count < 100) AND NOT v_used, 'logged_in', true, 'claimed', v_count);
END; $function$;
