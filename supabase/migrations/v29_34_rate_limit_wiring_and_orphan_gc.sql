-- v29.34 Schicht 4: (A) Rate-Limiting in Beitrags-/Voucher-Pfade verdrahten (fn_check_rate_limit
-- existierte ungenutzt) + (B) Auto-GC verwaister DB-Daten. Additiv; CREATE OR REPLACE erhält Grants.
-- Verifiziert: Voucher 13. Versuch → 'rate_limited'; GC läuft; cleanup-orphans-daily Cron aktiv.

-- (A1) Foto-Beitrag: max 15/Stunde/User (Anti-Spam, zusätzlich zu dedupe + 30-pending-Cap).
CREATE OR REPLACE FUNCTION public.fn_contribute_species_image(
  p_species_id text, p_url text, p_storage_path text DEFAULT NULL, p_confidence smallint DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_species_id IS NULL OR length(btrim(p_species_id)) = 0 THEN RAISE EXCEPTION 'species_id required'; END IF;
  IF p_url IS NULL OR p_url !~ '^https?://' THEN RAISE EXCEPTION 'valid url required'; END IF;
  IF NOT public.fn_check_rate_limit(v_uid::text, 'species_contribute', 15) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF EXISTS (SELECT 1 FROM public.species_images
             WHERE species_id = p_species_id AND contributed_by = v_uid AND review_status = 'pending') THEN
    RAISE EXCEPTION 'already pending for this species';
  END IF;
  IF (SELECT count(*) FROM public.species_images WHERE contributed_by = v_uid AND review_status = 'pending') >= 30 THEN
    RAISE EXCEPTION 'too many pending';
  END IF;
  INSERT INTO public.species_images
    (species_id, url, storage_path, contributed_by, review_status, scan_confidence, is_primary, license, attribution)
  VALUES
    (p_species_id, p_url, p_storage_path, v_uid, 'pending', p_confidence, false, 'user-contributed', 'GreenScan-Community')
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- (A2) Voucher-Einlösung: max 12/Stunde/User → stoppt Code-Enumeration/Brute-Force.
CREATE OR REPLACE FUNCTION public.fn_redeem_voucher(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE u uuid := (SELECT auth.uid()); v public.vouchers%ROWTYPE; v_tier text; v_days text;
BEGIN
  IF u IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF coalesce(trim(p_code),'') = '' THEN RETURN jsonb_build_object('error','no_code'); END IF;
  IF NOT public.fn_check_rate_limit(u::text, 'voucher_redeem', 12) THEN
    RETURN jsonb_build_object('error','rate_limited');
  END IF;
  SELECT * INTO v FROM vouchers WHERE lower(code) = lower(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF NOT v.is_active THEN RETURN jsonb_build_object('error','inactive'); END IF;
  IF v.valid_until IS NOT NULL AND v.valid_until < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  IF v.max_uses IS NOT NULL AND v.used_count >= v.max_uses THEN RETURN jsonb_build_object('error','exhausted'); END IF;
  IF EXISTS(SELECT 1 FROM voucher_redemptions WHERE voucher_code = v.code AND user_id = u) THEN
    RETURN jsonb_build_object('error','already_redeemed'); END IF;
  INSERT INTO voucher_redemptions(voucher_code, user_id) VALUES (v.code, u);
  v_tier := v.reward->>'tier';
  v_days := v.reward->>'duration_days';
  IF v_tier IN ('pro','lifetime') THEN
    UPDATE profiles SET comp_tier=v_tier,
      comp_expires_at = CASE WHEN v_days ~ '^[0-9]+$' THEN now() + (v_days||' days')::interval ELSE NULL END,
      comp_granted_by=NULL, comp_granted_at=now(), tier=v_tier
     WHERE id = u;
  END IF;
  INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
  VALUES (u, 'voucher_redeem', 'voucher', v.code, jsonb_build_object('reward', v.reward, 'via', 'comp'));
  RETURN jsonb_build_object('ok', true, 'reward', v.reward, 'tier', v_tier);
END; $function$;

-- (B) Orphan-GC (DB-only): abgelehnte Foto-Beiträge >14d + abgelehnte species_proposals >30d.
-- Storage-Datei-GC via SQL nicht möglich (Owner hat kein DELETE auf storage.objects → bräuchte
-- Edge-Fn mit Storage-API; deferred). Die rejected-Datei ist ohnehin owner-only gelistet (v29.29)
-- + URL nie publiziert → effektiv unzugänglich.
CREATE OR REPLACE FUNCTION public.fn_cleanup_orphans()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_img int := 0; v_prop int := 0;
BEGIN
  DELETE FROM public.species_images
   WHERE review_status='rejected' AND reviewed_at < now() - interval '14 days';
  GET DIAGNOSTICS v_img = ROW_COUNT;
  DELETE FROM public.species_proposals
   WHERE review_status='rejected' AND coalesce(reviewed_at, created_at) < now() - interval '30 days';
  GET DIAGNOSTICS v_prop = ROW_COUNT;
  RETURN jsonb_build_object('rejected_images_deleted', v_img, 'rejected_proposals_deleted', v_prop);
END $$;
REVOKE EXECUTE ON FUNCTION public.fn_cleanup_orphans() FROM public, anon, authenticated;

SELECT cron.schedule('cleanup-orphans-daily', '25 4 * * *', $$SELECT public.fn_cleanup_orphans();$$);
