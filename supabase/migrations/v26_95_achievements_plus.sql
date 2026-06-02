-- v26.95 — Achievements: Bump-Engine + Overview + Community-Feed + Showcase/Share
-- Mirror der LIVE-applizierten Migration v26_95_achievements_plus (20260602162802).
--
-- ARCHITEKTUR-REALITAET (Hard-Lesson #8): Spec (AUFTRAG_CODE_v26.95) lag grossteils
-- daneben. Reales Schema:
--   * achievements_catalog (30 seeded rows) ist FLACH: condition->>'type' = Metric,
--     condition->>'value' = Schwelle, rarity = Tier-Leiter. KEINE tier_thresholds-
--     Spalte noetig — Multi-Tier ist bereits via Metric-Familien + rarity modelliert.
--   * user_achievements + achievement_progress existieren, waren aber LEER →
--     System war faktisch tot. Diese Migration belebt es additiv per Bump-Engine.
--   * profiles hat display_name / avatar_emoji (NICHT full_name/avatar_url) und
--     KEIN opt_in_feed → hier additiv ergaenzt.
--
-- KEIN Tabellen-Rebuild, rein additiv (Spalten + Index + 4 RPCs + share_template-Seed).

-- ── 1) profiles: Showcase + Feed-Opt-In ─────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS showcase_achievements   text[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS opt_in_achievement_feed boolean DEFAULT true;

-- ── 2) achievements_catalog: generische Share-Vorlage ───────────────────────
ALTER TABLE public.achievements_catalog
  ADD COLUMN IF NOT EXISTS share_template text;

-- ── 3) Index fuer Feed (neueste Unlocks zuerst) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_ach_unlocked
  ON public.user_achievements (unlocked_at DESC);

-- ── 4) RPC: Bump-Engine — Metric hochzaehlen / setzen, Tier(s) freischalten ──
-- p_set=false → INC (v_prev + value); p_set=true → SET (value). Loopt alle aktiven
-- Catalog-Eintraege der Metric-Familie, upserted achievement_progress, schaltet bei
-- Schwelle user_achievements frei (idempotent), vergibt XP, behandelt Capstone
-- master_gardener (all_achievements) separat. Returns {metric,total,xp_gain,unlocked}.
CREATE OR REPLACE FUNCTION public.fn_achievements_bump(p_metric text, p_value bigint DEFAULT 1, p_set boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  v_prev      bigint;
  v_total     bigint;
  v_unlocked  jsonb := '[]'::jsonb;
  v_xp_gain   integer := 0;
  rec         record;
  v_threshold bigint;
  v_active_total int;
  v_user_have   int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','not_authed'); END IF;
  IF p_metric IS NULL OR length(p_metric) = 0 OR p_metric = 'all_achievements' THEN
    RETURN jsonb_build_object('error','bad_metric');
  END IF;

  -- bisheriger Stand dieser Metric (alle Slugs der Familie tragen denselben current_value)
  SELECT COALESCE(max(ap.current_value), 0) INTO v_prev
  FROM public.achievement_progress ap
  JOIN public.achievements_catalog c ON c.slug = ap.achievement_slug
  WHERE ap.user_id = v_uid AND c.condition->>'type' = p_metric;

  v_total := CASE WHEN p_set THEN GREATEST(p_value, 0) ELSE v_prev + GREATEST(p_value, 0) END;

  -- pro Achievement dieser Metric: Progress upserten + ggf. Tier freischalten
  FOR rec IN
    SELECT c.slug, c.title, c.icon, c.rarity, c.xp_reward,
           COALESCE((c.condition->>'value')::bigint, 1) AS threshold
    FROM public.achievements_catalog c
    WHERE c.is_active = true AND c.condition->>'type' = p_metric
  LOOP
    v_threshold := rec.threshold;
    INSERT INTO public.achievement_progress (user_id, achievement_slug, current_value, target_value, last_updated,
                                             unlocked_at)
    VALUES (v_uid, rec.slug, v_total, v_threshold, now(),
            CASE WHEN v_total >= v_threshold THEN now() ELSE NULL END)
    ON CONFLICT (user_id, achievement_slug) DO UPDATE
      SET current_value = v_total,
          target_value  = v_threshold,
          last_updated  = now(),
          unlocked_at   = COALESCE(public.achievement_progress.unlocked_at,
                                   CASE WHEN v_total >= v_threshold THEN now() ELSE NULL END);

    IF v_total >= v_threshold THEN
      INSERT INTO public.user_achievements (user_id, achievement_slug, unlocked_at, metadata)
      VALUES (v_uid, rec.slug, now(), jsonb_build_object('via','bump','metric',p_metric))
      ON CONFLICT (user_id, achievement_slug) DO NOTHING;
      IF FOUND THEN
        v_xp_gain  := v_xp_gain + COALESCE(rec.xp_reward, 0);
        v_unlocked := v_unlocked || jsonb_build_object(
          'slug', rec.slug, 'title', rec.title, 'icon', rec.icon,
          'rarity', rec.rarity, 'xp', COALESCE(rec.xp_reward,0));
      END IF;
    END IF;
  END LOOP;

  -- Capstone „master_gardener" (all_achievements): wenn ALLE übrigen aktiven Achievements erreicht
  IF jsonb_array_length(v_unlocked) > 0 THEN
    SELECT count(*) INTO v_active_total
      FROM public.achievements_catalog
     WHERE is_active = true AND slug <> 'master_gardener';
    SELECT count(*) INTO v_user_have
      FROM public.user_achievements ua
      JOIN public.achievements_catalog c ON c.slug = ua.achievement_slug
     WHERE ua.user_id = v_uid AND c.is_active = true AND ua.achievement_slug <> 'master_gardener';

    INSERT INTO public.achievement_progress (user_id, achievement_slug, current_value, target_value, last_updated, unlocked_at)
    VALUES (v_uid, 'master_gardener', v_user_have, GREATEST(v_active_total,1), now(),
            CASE WHEN v_user_have >= v_active_total THEN now() ELSE NULL END)
    ON CONFLICT (user_id, achievement_slug) DO UPDATE
      SET current_value = v_user_have, target_value = GREATEST(v_active_total,1), last_updated = now(),
          unlocked_at = COALESCE(public.achievement_progress.unlocked_at,
                                 CASE WHEN v_user_have >= v_active_total THEN now() ELSE NULL END);

    IF v_user_have >= v_active_total THEN
      INSERT INTO public.user_achievements (user_id, achievement_slug, unlocked_at, metadata)
      VALUES (v_uid, 'master_gardener', now(), jsonb_build_object('via','capstone'))
      ON CONFLICT (user_id, achievement_slug) DO NOTHING;
      IF FOUND THEN
        SELECT v_xp_gain + COALESCE(xp_reward,0) INTO v_xp_gain
          FROM public.achievements_catalog WHERE slug = 'master_gardener';
        v_unlocked := v_unlocked || (
          SELECT jsonb_build_object('slug','master_gardener','title',title,'icon',icon,'rarity',rarity,'xp',COALESCE(xp_reward,0))
          FROM public.achievements_catalog WHERE slug = 'master_gardener');
      END IF;
    END IF;
  END IF;

  -- XP gutschreiben (nur bei neuen Unlocks)
  IF v_xp_gain > 0 THEN
    UPDATE public.profiles SET xp = COALESCE(xp,0) + v_xp_gain, updated_at = now() WHERE id = v_uid;
  END IF;

  RETURN jsonb_build_object('metric', p_metric, 'total', v_total, 'xp_gain', v_xp_gain, 'unlocked', v_unlocked);
END $function$;

-- ── 5) RPC: Overview — alle aktiven Achievements + eigener Fortschritt ───────
-- INVOKER (kein DEFINER noetig: own-only via (SELECT auth.uid()) in JOINs).
CREATE OR REPLACE FUNCTION public.fn_achievements_overview()
 RETURNS TABLE(slug text, category text, title text, description text, icon text, rarity text, metric text, threshold bigint, current_value bigint, unlocked boolean, unlocked_at timestamp with time zone, xp_reward integer, share_template text)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT
    c.slug, c.category, c.title, c.description, c.icon, c.rarity,
    c.condition->>'type'                              AS metric,
    COALESCE((c.condition->>'value')::bigint, 1)      AS threshold,
    COALESCE(ap.current_value, 0)::bigint             AS current_value,
    (ua.achievement_slug IS NOT NULL)                 AS unlocked,
    ua.unlocked_at,
    c.xp_reward,
    c.share_template
  FROM public.achievements_catalog c
  LEFT JOIN public.achievement_progress ap
    ON ap.achievement_slug = c.slug AND ap.user_id = (SELECT auth.uid())
  LEFT JOIN public.user_achievements ua
    ON ua.achievement_slug = c.slug AND ua.user_id = (SELECT auth.uid())
  WHERE c.is_active = true
  ORDER BY c.category, c.sort_order, c.slug;
$function$;

-- ── 6) RPC: Community-Feed — fremde Unlocks (7 Tage, uncommon+, opt-in) ──────
-- DEFINER: own-only-RLS auf user_achievements wuerde sonst einen Invoker-Feed
-- blockieren. Filter: opt_in_achievement_feed, rarity<>'common', LIMIT 1..100.
-- anon REVOKED (konservativer als Spec; konsistent mit Quiz-Leaderboard-Praxis).
CREATE OR REPLACE FUNCTION public.fn_achievements_feed(p_limit integer DEFAULT 30)
 RETURNS TABLE(user_id uuid, display_name text, avatar_emoji text, slug text, title text, icon text, rarity text, unlocked_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    ua.user_id,
    COALESCE(p.display_name, 'Anonym'),
    COALESCE(p.avatar_emoji, '🌿'),
    ua.achievement_slug, c.title, c.icon, c.rarity, ua.unlocked_at
  FROM public.user_achievements ua
  JOIN public.achievements_catalog c ON c.slug = ua.achievement_slug
  LEFT JOIN public.profiles p ON p.id = ua.user_id
  WHERE ua.unlocked_at > now() - interval '7 days'
    AND COALESCE(p.opt_in_achievement_feed, true) = true
    AND c.rarity <> 'common'
  ORDER BY ua.unlocked_at DESC
  LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;

-- ── 7) RPC: Showcase setzen — max 5 tatsaechlich freigeschaltete Slugs ───────
CREATE OR REPLACE FUNCTION public.fn_achievements_showcase_set(p_slugs text[])
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   uuid := (SELECT auth.uid());
  v_valid text[];
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  -- nur tatsächlich freigeschaltete Slugs, max 5, Reihenfolge erhalten
  SELECT array_agg(s ORDER BY ord) INTO v_valid
  FROM (
    SELECT s, ord FROM unnest(COALESCE(p_slugs, '{}')) WITH ORDINALITY AS t(s, ord)
    WHERE EXISTS (SELECT 1 FROM public.user_achievements ua WHERE ua.user_id = v_uid AND ua.achievement_slug = t.s)
    LIMIT 5
  ) q;
  UPDATE public.profiles
     SET showcase_achievements = COALESCE(v_valid, '{}'), updated_at = now()
   WHERE id = v_uid;
  RETURN true;
END $function$;

-- ── 8) Grants: anon raus, authenticated rein ────────────────────────────────
REVOKE ALL ON FUNCTION public.fn_achievements_bump(text, bigint, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_achievements_overview()                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_achievements_feed(integer)               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_achievements_showcase_set(text[])        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_achievements_bump(text, bigint, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_achievements_overview()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_achievements_feed(integer)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_achievements_showcase_set(text[])        TO authenticated;

-- ── 9) Generische Share-Vorlagen seeden (nur wo NULL) ───────────────────────
UPDATE public.achievements_catalog
   SET share_template = 'Ich habe „'||title||'" auf GreenScan freigeschaltet! 🌿'
 WHERE share_template IS NULL;
