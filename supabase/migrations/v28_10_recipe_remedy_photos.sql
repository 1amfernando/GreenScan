-- ============================================================================
-- v28_10_recipe_remedy_photos — B-009: Fotos für admin-kuratierte Rezepte + Heilmittel.
-- Spiegel der LIVE-Migration. recipes/remedies sind public-read + admin_write (181 Rezepte)
-- → Foto-Upload ist ein Admin-Feature, Anzeige für alle. Additiv (Hard-Lesson #14: gegen
-- echtes Schema — kein photo_url existierte; data jsonb separat).
-- (B-007 Marketplace-Token-Fix = Edge-Fn marketplace-publish v4 + Frontend, KEIN Schema-Change.
--  B-008 Avatar-Click = rein Frontend.)
-- ============================================================================
ALTER TABLE public.recipes  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.remedies ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recipe-photos','recipe-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage-Policies: public read · admin write (public.is_admin_user()).
DROP POLICY IF EXISTS recipe_photos_public_read ON storage.objects;
CREATE POLICY recipe_photos_public_read ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'recipe-photos');
DROP POLICY IF EXISTS recipe_photos_admin_write ON storage.objects;
CREATE POLICY recipe_photos_admin_write ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'recipe-photos' AND public.is_admin_user())
  WITH CHECK (bucket_id = 'recipe-photos' AND public.is_admin_user());

-- ─── B-007 (LIVE, hier dokumentiert) ─────────────────────────────────────────
-- Edge-Fn marketplace-publish v4: ROOT-CAUSE „invalid token" = createClient(url,userToken)
--   + getUser() OHNE Token-Arg (suchte nicht-existente Session → user=null → 401).
--   FIX: sbAdmin.auth.getUser(userToken). + Response enthält jetzt `id`.
-- Demo-Listings (Cowork-Test + Permakultur-Bücher/Bärlauch-Pesto/Tomaten-Setzlinge) → archived.
