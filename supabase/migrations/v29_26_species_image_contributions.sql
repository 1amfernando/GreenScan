-- v29.26 Block A: User-Foto-Beiträge zu Arten-Bildern (Opt-in + Moderation).
-- (Fernando-Feature 1+2: Scan-Bilder bauen die Arten-DB auf + werden Profilbild bei Match.)
-- species_images existierte (admin-kuratiert, 0 Zeilen). Erweiterung um Community-
-- Beitrag mit Moderations-Gate. Detail-View zeigt nur approved; Beitrag via RPC → pending.
-- Entscheidung Fernando 15.06.2026: Opt-in + Moderation (privacy-konform, revDSG).
-- Verifiziert als echter JWT (HL#16): contribute→pending versteckt→admin-approve→sichtbar;
-- non-admin admin-queue → "admin only"-Exception.

ALTER TABLE public.species_images
  ADD COLUMN IF NOT EXISTS contributed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'approved'
    CHECK (review_status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS scan_confidence smallint,
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_species_images_species_status
  ON public.species_images (species_id, review_status, is_primary DESC, sort_order);
CREATE INDEX IF NOT EXISTS idx_species_images_pending
  ON public.species_images (created_at) WHERE review_status = 'pending';

-- Öffentliche Lese-Policy einschränken: nur approved (vorher qual=true → pending wäre geleakt).
DROP POLICY IF EXISTS "simg read" ON public.species_images;
CREATE POLICY "simg read approved" ON public.species_images
  FOR SELECT TO anon, authenticated
  USING (review_status = 'approved');
-- Beitragende dürfen den Status ihres eigenen (auch pending) Beitrags sehen.
CREATE POLICY "simg read own" ON public.species_images
  FOR SELECT TO authenticated
  USING (contributed_by = (SELECT auth.uid()));

-- Storage: authenticated dürfen in species-images Bucket in ihren eigenen uid-Ordner schreiben (Beiträge).
DROP POLICY IF EXISTS "species-images user upload" ON storage.objects;
CREATE POLICY "species-images user upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'species-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- ── RPCs ─────────────────────────────────────────────────────────────
-- Detail-View: approved Bilder einer Art (auch für Gäste).
CREATE OR REPLACE FUNCTION public.fn_species_images(p_species_id text)
RETURNS TABLE(id uuid, url text, attribution text, license text, is_primary boolean, sort_order int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id, url, attribution, license, is_primary, sort_order
  FROM public.species_images
  WHERE species_id = p_species_id AND review_status = 'approved'
  ORDER BY is_primary DESC, sort_order ASC, created_at ASC
  LIMIT 12;
$$;
REVOKE EXECUTE ON FUNCTION public.fn_species_images(text) FROM public;
GRANT EXECUTE ON FUNCTION public.fn_species_images(text) TO anon, authenticated;

-- Beitrag: User reicht Foto (URL aus species-images Bucket) zu einer Art ein → pending.
CREATE OR REPLACE FUNCTION public.fn_contribute_species_image(
  p_species_id text, p_url text, p_storage_path text DEFAULT NULL, p_confidence smallint DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_species_id IS NULL OR length(btrim(p_species_id)) = 0 THEN RAISE EXCEPTION 'species_id required'; END IF;
  IF p_url IS NULL OR p_url !~ '^https?://' THEN RAISE EXCEPTION 'valid url required'; END IF;
  -- Dedupe: max 1 offener Beitrag pro User pro Art.
  IF EXISTS (SELECT 1 FROM public.species_images
             WHERE species_id = p_species_id AND contributed_by = v_uid AND review_status = 'pending') THEN
    RAISE EXCEPTION 'already pending for this species';
  END IF;
  -- Spam-Schutz: max 30 offene Beiträge gesamt pro User.
  IF (SELECT count(*) FROM public.species_images WHERE contributed_by = v_uid AND review_status = 'pending') >= 30 THEN
    RAISE EXCEPTION 'too many pending';
  END IF;
  INSERT INTO public.species_images
    (species_id, url, storage_path, contributed_by, review_status, scan_confidence, is_primary, license, attribution)
  VALUES
    (p_species_id, p_url, p_storage_path, v_uid, 'pending', p_confidence, false, 'user-contributed', 'GreenScan-Community')
  RETURNING id INTO v_id;
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fn_contribute_species_image(text,text,text,smallint) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_contribute_species_image(text,text,text,smallint) TO authenticated;

-- Admin: Queue offener Beiträge.
CREATE OR REPLACE FUNCTION public.fn_admin_species_image_queue(p_limit int DEFAULT 50)
RETURNS TABLE(id uuid, species_id text, url text, contributed_by uuid, scan_confidence smallint, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'admin only'; END IF;
  RETURN QUERY
    SELECT si.id, si.species_id, si.url, si.contributed_by, si.scan_confidence, si.created_at
    FROM public.species_images si
    WHERE si.review_status = 'pending'
    ORDER BY si.created_at ASC
    LIMIT greatest(1, least(p_limit, 200));
END; $$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_species_image_queue(int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_species_image_queue(int) TO authenticated;

-- Admin: Beitrag freigeben/ablehnen (+ optional als Hauptbild setzen).
CREATE OR REPLACE FUNCTION public.fn_admin_review_species_image(
  p_id uuid, p_approve boolean, p_make_primary boolean DEFAULT false, p_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_species text; v_uid uuid := (SELECT auth.uid());
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT species_id INTO v_species FROM public.species_images WHERE id = p_id;
  IF v_species IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF p_approve THEN
    IF p_make_primary THEN
      UPDATE public.species_images SET is_primary = false WHERE species_id = v_species AND id <> p_id;
    END IF;
    UPDATE public.species_images
      SET review_status = 'approved',
          is_primary = COALESCE(p_make_primary, is_primary),
          admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
      WHERE id = p_id;
  ELSE
    UPDATE public.species_images
      SET review_status = 'rejected', admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
      WHERE id = p_id;
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.fn_admin_review_species_image(uuid,boolean,boolean,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_review_species_image(uuid,boolean,boolean,text) TO authenticated;
