-- ============ v29.13 Admin Gutschein-Verwaltung + server-sichere Einlösung ============
-- Admin-Erweiterung #3 (von 4) + schliesst v29.09-Security-Follow-up: Einlösung serverseitig
-- gekapselt (Code-Liste nie an Client, vouchers-SELECT ist admin-only), Erstellung admin-gated.
-- reward jsonb {tier:'pro'|'lifetime'}. Voller Lebenszyklus als echter JWT verifiziert.
-- WICHTIG: trg_voucher_count (AFTER INSERT auf voucher_redemptions) zählt used_count bereits hoch
-- → fn_redeem_voucher macht KEINEN eigenen used_count-UPDATE (sonst Doppelzählung +2).

-- Server-sichere Einlösung (authenticated): validiert + (Trigger zählt) + wendet Tier-Reward an, atomar.
CREATE OR REPLACE FUNCTION public.fn_redeem_voucher(p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE u uuid := (SELECT auth.uid()); v public.vouchers%ROWTYPE; v_tier text;
BEGIN
  IF u IS NULL THEN RETURN jsonb_build_object('error','not_authenticated'); END IF;
  IF coalesce(trim(p_code),'') = '' THEN RETURN jsonb_build_object('error','no_code'); END IF;
  SELECT * INTO v FROM vouchers WHERE lower(code) = lower(trim(p_code)) FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  IF NOT v.is_active THEN RETURN jsonb_build_object('error','inactive'); END IF;
  IF v.valid_until IS NOT NULL AND v.valid_until < now() THEN RETURN jsonb_build_object('error','expired'); END IF;
  IF v.max_uses IS NOT NULL AND v.used_count >= v.max_uses THEN RETURN jsonb_build_object('error','exhausted'); END IF;
  IF EXISTS(SELECT 1 FROM voucher_redemptions WHERE voucher_code = v.code AND user_id = u) THEN
    RETURN jsonb_build_object('error','already_redeemed'); END IF;
  INSERT INTO voucher_redemptions(voucher_code, user_id) VALUES (v.code, u);  -- trg_voucher_count zählt used_count
  v_tier := v.reward->>'tier';
  IF v_tier IN ('pro','lifetime') THEN
    UPDATE profiles SET tier = v_tier WHERE id = u;
  END IF;
  INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
  VALUES (u, 'voucher_redeem', 'voucher', v.code, jsonb_build_object('reward', v.reward));
  RETURN jsonb_build_object('ok', true, 'reward', v.reward, 'tier', v_tier);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_redeem_voucher(text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_redeem_voucher(text) TO authenticated;

-- Admin: Gutschein erstellen
CREATE OR REPLACE FUNCTION public.fn_admin_create_voucher(p_code text, p_reward_tier text, p_max_uses int DEFAULT NULL, p_valid_days int DEFAULT NULL, p_description text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c text := upper(trim(coalesce(p_code,'')));
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  IF c = '' THEN RETURN jsonb_build_object('error','no_code'); END IF;
  IF p_reward_tier NOT IN ('pro','lifetime') THEN RETURN jsonb_build_object('error','invalid_reward'); END IF;
  IF EXISTS(SELECT 1 FROM vouchers WHERE code = c) THEN RETURN jsonb_build_object('error','code_exists'); END IF;
  INSERT INTO vouchers(code, description, is_active, valid_until, max_uses, reward)
  VALUES (c, nullif(trim(coalesce(p_description,'')),''), true,
          CASE WHEN p_valid_days IS NOT NULL AND p_valid_days > 0 THEN now() + (p_valid_days || ' days')::interval ELSE NULL END,
          CASE WHEN p_max_uses IS NOT NULL AND p_max_uses > 0 THEN p_max_uses ELSE NULL END,
          jsonb_build_object('tier', p_reward_tier));
  INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'voucher_create', 'voucher', c, jsonb_build_object('reward_tier',p_reward_tier,'max_uses',p_max_uses,'valid_days',p_valid_days));
  RETURN jsonb_build_object('ok', true, 'code', c);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_create_voucher(text,text,int,int,text) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_create_voucher(text,text,int,int,text) TO authenticated;

-- Admin: Gutschein-Liste mit Nutzung
CREATE OR REPLACE FUNCTION public.fn_admin_vouchers_list()
RETURNS TABLE(code text, description text, is_active boolean, valid_until timestamptz, max_uses int, used_count int, reward jsonb, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT is_admin_user() THEN RETURN; END IF;
  RETURN QUERY SELECT v.code, v.description, v.is_active, v.valid_until, v.max_uses, v.used_count, v.reward, v.created_at
    FROM vouchers v ORDER BY v.created_at DESC LIMIT 100;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_vouchers_list() FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_vouchers_list() TO authenticated;

-- Admin: aktivieren/deaktivieren
CREATE OR REPLACE FUNCTION public.fn_admin_voucher_toggle(p_code text, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE c text := upper(trim(coalesce(p_code,'')));
BEGIN
  IF NOT is_admin_user() THEN RETURN jsonb_build_object('error','forbidden'); END IF;
  UPDATE vouchers SET is_active = p_active WHERE code = c;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','not_found'); END IF;
  INSERT INTO audit_log(actor_id, action, target_type, target_id, diff)
  VALUES ((SELECT auth.uid()), 'voucher_toggle', 'voucher', c, jsonb_build_object('is_active', p_active));
  RETURN jsonb_build_object('ok', true);
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_voucher_toggle(text,boolean) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.fn_admin_voucher_toggle(text,boolean) TO authenticated;
