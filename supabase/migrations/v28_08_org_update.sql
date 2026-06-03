-- ============================================================================
-- v28_08_org_update — Org-Onboarding + Whitelabel (Spiegel der LIVE-Migration).
-- fn_org_update: owner/admin bearbeiten Branding/Info. Server-validiert (Farbe #RRGGBB,
-- URLs http(s)) → kein CSS-/Markup-Injection. Whitelabel-Felder (logo_url/primary_color/
-- bio/website) existieren seit v28.01. Frontend: gsOrgEdit/gsOrgSubmitEdit + primary_color-
-- Akzent in _gsRenderOrgDetail + Onboarding-Next-Steps (gsOrgOnboardingDone).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_org_update(p_org_id uuid, p_name text, p_bio text,
  p_logo_url text, p_website text, p_primary_color text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_role text;
BEGIN
  v_role := public.fn_org_role(p_org_id);
  IF v_role IS NULL OR v_role NOT IN ('owner','admin') THEN
    RAISE EXCEPTION 'Nur Owner/Admin dürfen die Organisation bearbeiten.'; END IF;
  IF p_primary_color IS NOT NULL AND p_primary_color <> '' AND p_primary_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Farbe muss #RRGGBB sein.'; END IF;
  IF p_logo_url IS NOT NULL AND p_logo_url <> '' AND p_logo_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Logo-URL muss mit http(s):// beginnen.'; END IF;
  IF p_website IS NOT NULL AND p_website <> '' AND p_website !~* '^https?://' THEN
    RAISE EXCEPTION 'Website muss mit http(s):// beginnen.'; END IF;
  UPDATE public.organizations SET
    name          = COALESCE(NULLIF(trim(p_name),''), name),
    bio           = NULLIF(trim(coalesce(p_bio,'')),''),
    logo_url      = NULLIF(trim(coalesce(p_logo_url,'')),''),
    website       = NULLIF(trim(coalesce(p_website,'')),''),
    primary_color = NULLIF(trim(coalesce(p_primary_color,'')),''),
    updated_at    = now()
  WHERE id = p_org_id;
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.fn_org_update(uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_org_update(uuid,text,text,text,text,text) TO authenticated;

-- Verify (transaktional ROLLBACK): owner-update ok (name/bio/color/website gesetzt),
--   bad-color blockiert, student blockiert.
