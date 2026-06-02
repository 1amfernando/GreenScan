-- ============================================================================
-- v27_03_user_prefs_save — Atomare Settings-Bulk-Save-RPC mit jsonb-DEEP-MERGE
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- Hard-Lesson #14: Spec-Tabelle 'user_prefs' existiert NICHT → echte Tabelle ist
--   public.user_preferences (structured cols language/region/altitude_m/
--   reminders_enabled/push_enabled/email_enabled/digest_freq + units jsonb + prefs jsonb).
--   KEINE neuen text-Spalten (units ist bereits jsonb) — prefs-jsonb ist Catch-all.
-- Problem: REST-Upsert mit merge-duplicates ERSETZT prefs-jsonb komplett → Cross-Device-
--   Teil-Edits clobbern sich. Diese RPC DEEP-MERGEt (prefs || patch).
-- Hard-Lesson #13: REVOKE PUBLIC,anon + GRANT authenticated.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.fn_user_prefs_save(p_patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_uid uuid := (SELECT auth.uid());
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error','not_authed'); END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN RETURN jsonb_build_object('error','bad_patch'); END IF;

  INSERT INTO public.user_preferences AS up (
    user_id, language, region, altitude_m, reminders_enabled, push_enabled,
    email_enabled, digest_freq, units, prefs, updated_at
  ) VALUES (
    v_uid,
    p_patch->>'language',
    p_patch->>'region',
    NULLIF(p_patch->>'altitude_m','')::int,
    (p_patch->>'reminders_enabled')::boolean,
    (p_patch->>'push_enabled')::boolean,
    (p_patch->>'email_enabled')::boolean,
    p_patch->>'digest_freq',
    CASE WHEN jsonb_typeof(p_patch->'units')='object' THEN p_patch->'units' ELSE NULL END,
    CASE WHEN jsonb_typeof(p_patch->'prefs')='object' THEN p_patch->'prefs' ELSE '{}'::jsonb END,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    language          = COALESCE(EXCLUDED.language, up.language),
    region            = COALESCE(EXCLUDED.region, up.region),
    altitude_m        = COALESCE(EXCLUDED.altitude_m, up.altitude_m),
    reminders_enabled = COALESCE(EXCLUDED.reminders_enabled, up.reminders_enabled),
    push_enabled      = COALESCE(EXCLUDED.push_enabled, up.push_enabled),
    email_enabled     = COALESCE(EXCLUDED.email_enabled, up.email_enabled),
    digest_freq       = COALESCE(EXCLUDED.digest_freq, up.digest_freq),
    units             = COALESCE(EXCLUDED.units, up.units),
    prefs             = COALESCE(up.prefs, '{}'::jsonb) || COALESCE(EXCLUDED.prefs, '{}'::jsonb),  -- DEEP-MERGE
    updated_at        = now();

  RETURN jsonb_build_object('saved', true, 'updated_at', now());
END $$;
REVOKE ALL ON FUNCTION public.fn_user_prefs_save(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_user_prefs_save(jsonb) TO authenticated;
