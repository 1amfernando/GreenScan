-- ============ v29.17 Marktplatz-Moderation: moderation_status orthogonal zum User-Lifecycle ============
-- (Backend-Teil; Frontend bekam den v-Bump.) MOD-P3-1: user-archivierte/verkaufte Inserate erschienen im
-- Moderations-Feed als „versteckt", und Admin-„Einblenden" hätte sie republisht (status='archived' war
-- doppeldeutig: User-Lifecycle UND Admin-Hide).
--
-- FIX: marketplace_listings.moderation_status (NULL | 'hidden') getrennt vom Lifecycle-status.
-- Admin-Hide = moderation_status='hidden' (status unberührt). Sichtbarkeit schliesst 'hidden' aus in
-- RLS (public-Zweig) UND fn_marketplace_search (SECURITY DEFINER umgeht RLS → explizit) → Admin-Hide ist
-- öffentlich + suchunsichtbar und vom Nutzer NICHT durch Re-Aktivieren umgehbar; Owner sieht eigenes weiter.
-- Als echter JWT 8/8 verifiziert.

ALTER TABLE public.marketplace_listings ADD COLUMN IF NOT EXISTS moderation_status text;
ALTER TABLE public.marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_moderation_status_chk;
ALTER TABLE public.marketplace_listings ADD CONSTRAINT marketplace_moderation_status_chk
  CHECK (moderation_status IS NULL OR moderation_status = 'hidden');

DROP POLICY IF EXISTS marketplace_select_active ON public.marketplace_listings;
CREATE POLICY marketplace_select_active ON public.marketplace_listings FOR SELECT TO public
USING (
  ((status = ANY (ARRAY['active','reserved'])) AND coalesce(moderation_status,'') <> 'hidden')
  OR ((SELECT auth.uid()) = user_id)
);

CREATE OR REPLACE FUNCTION public.fn_marketplace_search(p_query text DEFAULT ''::text, p_category text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_price_min numeric DEFAULT NULL::numeric, p_price_max numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, title text, description text, category text, price numeric, currency text, region text, contact text, photo_url text, photo_urls text[], price_mode text, status text, views integer, reports integer, created_at timestamp with time zone, updated_at timestamp with time zone, sold_at timestamp with time zone, organic_certified boolean, pesticide_free boolean, certification_label text, allow_online_payment boolean, contact_method text, seller_name text, seller_avatar text, seller_is_expert boolean, seller_is_premium boolean, seller_level integer)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_q text := nullif(btrim(coalesce(p_query,'')), '');
        v_ts tsquery;
BEGIN
  IF v_q IS NOT NULL AND length(v_q) >= 2 THEN
    BEGIN v_ts := websearch_to_tsquery('german', v_q); EXCEPTION WHEN others THEN v_ts := NULL; END;
  END IF;
  RETURN QUERY
  SELECT m.id, m.user_id, m.title, m.description, m.category, m.price, m.currency,
         m.region, m.contact, m.photo_url, m.photo_urls, m.price_mode, m.status,
         m.views, m.reports, m.created_at, m.updated_at, m.sold_at,
         m.organic_certified, m.pesticide_free, m.certification_label,
         m.allow_online_payment, m.contact_method,
         COALESCE(p.display_name, split_part(p.email,'@'::citext,1), 'Anonym') AS seller_name,
         p.avatar_emoji AS seller_avatar,
         p.is_expert AS seller_is_expert,
         COALESCE(p.tier = ANY (ARRAY['plus','pro','plus_lifetime']), false) AS seller_is_premium,
         COALESCE(p.level, 1) AS seller_level
    FROM public.marketplace_listings m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.status = 'active'
     AND coalesce(m.moderation_status,'') <> 'hidden'
     AND (p_category IS NULL OR m.category = p_category)
     AND (p_region   IS NULL OR m.region   = p_region)
     AND (p_price_min IS NULL OR m.price >= p_price_min)
     AND (p_price_max IS NULL OR m.price <= p_price_max)
     AND (v_ts IS NULL OR to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')) @@ v_ts)
   ORDER BY
     CASE WHEN v_ts IS NOT NULL
          THEN ts_rank(to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')), v_ts)
          ELSE 0 END DESC,
     m.created_at DESC
   LIMIT GREATEST(1, LEAST(coalesce(p_limit,50), 100));
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_admin_moderate(p_type text, p_id uuid, p_action text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF p_type   NOT IN ('post','listing','comment') THEN RETURN jsonb_build_object('error','invalid_type'); END IF;
  IF p_action NOT IN ('hide','unhide','delete')   THEN RETURN jsonb_build_object('error','invalid_action'); END IF;

  IF p_type = 'post' THEN
    IF p_action = 'delete' THEN
      DELETE FROM post_comments WHERE post_id = p_id;
      DELETE FROM social_posts  WHERE id = p_id;
    ELSE
      UPDATE social_posts SET is_archived = (p_action = 'hide') WHERE id = p_id;
    END IF;

  ELSIF p_type = 'listing' THEN
    IF p_action = 'delete' THEN
      DELETE FROM marketplace_listings WHERE id = p_id;
    ELSE
      -- nur Moderations-Flag, User-Lifecycle-status unberührt (kein Republish von User-Archiv)
      UPDATE marketplace_listings SET moderation_status = CASE WHEN p_action = 'hide' THEN 'hidden' ELSE NULL END WHERE id = p_id;
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

CREATE OR REPLACE FUNCTION public.fn_admin_moderation_feed(p_limit integer DEFAULT 40)
 RETURNS TABLE(kind text, id uuid, post_id uuid, author text, snippet text, status text, created_at timestamp with time zone)
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
             left(coalesce(l.title,''),120),
             CASE WHEN l.moderation_status = 'hidden' THEN 'hidden' ELSE coalesce(l.status,'active') END,
             l.created_at
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
