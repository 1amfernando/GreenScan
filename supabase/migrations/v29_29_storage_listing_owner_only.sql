-- v29.29 (Audit-P2 + HL#19): public Buckets erlaubten anon-LISTING → fremde/un-moderierte
-- Dateien enumerierbar. species-images (NEU, inkl. pending Foto-Beiträge) + map-find-photos
-- (User-Fundorte, potenziell standort-sensibel) auf owner-only Listing einschränken.
-- WICHTIG: Bucket bleibt public → direkter CDN-GET einer bekannten URL (Anzeige approved Bilder
-- / geteilter Funde) funktioniert weiter; nur das LIST-/Enumerate-API wird owner-scoped.
-- (avatars/marketplace-photos/post-images/recipe-photos bleiben public-list — by-design
--  öffentlich browsbarer Community-Content. garden-photos/scan-images sind bereits owner-only;
--  garden-diary-photos/plant-3d-models/user-plant-photos haben gar keine SELECT-Policy = dicht.)
-- Red-Team-verifiziert: anon-Listing vorher = fremde Dateien sichtbar, nachher = 0.

-- species-images: anon/all-listing → owner-only
DROP POLICY IF EXISTS "species-images public read" ON storage.objects;
CREATE POLICY "species-images owner list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'species-images' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

-- map-find-photos: anon/all-listing → owner-only
DROP POLICY IF EXISTS "anyone reads map-find-photos" ON storage.objects;
CREATE POLICY "map-find-photos owner list" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'map-find-photos' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
