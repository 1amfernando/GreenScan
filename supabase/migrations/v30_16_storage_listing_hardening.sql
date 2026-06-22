-- Storage-Härtung (HL#19): anon-Listing auf 2 PUBLIC-Buckets schliessen.
-- 19-Agenten-Workflow (read-only Analyse + adversariale 3-Linsen-Verifikation):
--   marketplace-photos, post-images = SICHER (0/3 break-votes) → owner-only SELECT.
--   avatars = übersprungen (spekulativer break-vote, by-design public, low-sensitivity).
--   recipe-photos = übersprungen (ECHTER Brecher: Fotos liegen unter {recipe_id}/, nicht
--     {uid}/, + Admin-Kuratierung via is_admin_user() — owner-by-uid würde brechen).
-- Wirkung: SELECT (LIST/GET via authentifiziertem /object/-API) wird owner-only;
--   die öffentliche Anzeige via public-CDN-Pfad /storage/v1/object/public/{bucket}/{path}
--   bleibt UNBERÜHRT (umgeht storage.objects-RLS). Global verifiziert: 100% der
--   Bildanzeige läuft über public-URLs, kein Cross-User-.list(). Ordner-Konvention {uid}/
--   bestätigt durch die bestehenden INSERT/DELETE-Policies beider Buckets.

-- ---------- marketplace-photos ----------
DROP POLICY IF EXISTS "marketplace_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "marketplace-photos owner list" ON storage.objects;
CREATE POLICY "marketplace-photos owner list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'marketplace-photos'
    AND (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------- post-images ----------
DROP POLICY IF EXISTS "post-images public read" ON storage.objects;
DROP POLICY IF EXISTS "post-images owner list" ON storage.objects;
CREATE POLICY "post-images owner list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-images'
    AND (storage.foldername(name))[1] = (select auth.uid())::text);
