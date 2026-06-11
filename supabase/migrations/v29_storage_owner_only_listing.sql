-- ============ Storage-Härtung: Cross-User-Listing der per-User-privaten Buckets schließen ============
-- (Backend-only, kein App-v-Bump.) Aus der „stärke es noch mehr"-Runde.
--
-- BEFUND: scan-images (public=true, 40 echte Objekte in <uid>/-Ordnern) UND garden-photos hatten eine
-- SELECT-Policy `USING (bucket_id = 'X')` für die public-Rolle → ANON konnte das Listing-API aufrufen und
-- ALLE Nutzer-Scans enumerieren; da der Bucket public=true ist, danach jedes Objekt per CDN-URL laden
-- (= voller Cross-User-Scrape privater Pflanzen-Scans). 8× Advisor `public_bucket_allows_listing`.
--
-- WARUM der Fix nichts bricht: Die App lädt/rendert Bilder ausschließlich über die PUBLIC-CDN-URL
-- (`/storage/v1/object/public/<bucket>/<path>`, siehe gsUploadPhotoToBucket) — dieser Pfad UMGEHT RLS,
-- weil der Bucket public=true ist. Die SELECT-Policy steuert nur das authentifizierte Listing/Signing.
-- Pfade sind `<uid>/<crypto.randomUUID()>.jpg` (128-bit, unrate­bar) → ohne Listing kein praktischer Zugriff.
-- Fix = SELECT-Policy auf OWNER beschränken: jeder listet nur seinen eigenen <uid>/-Ordner.
--
-- VERIFIZIERT als echte JWTs: anon=0 (vorher 40), User-ohne-Scans=0, User-mit-31-Scans sieht 31 eigene /
-- 0 fremde, Owner sieht seine 7. Bild-Anzeige via public-URL unverändert funktionsfähig.
--
-- Andere public-read-Buckets bleiben bewusst offen (öffentlicher Content): avatars, marketplace-photos,
-- post-images, recipe-photos, species-images, map-find-photos. garden-diary-photos / user-plant-photos
-- haben gar keine List-Policy (public-GET ja, Listing nein) = bereits ideal.

DROP POLICY IF EXISTS "scan-images public read"   ON storage.objects;
DROP POLICY IF EXISTS "garden-photos public read" ON storage.objects;

CREATE POLICY "scan_images_owner_read"   ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'scan-images'   AND (storage.foldername(name))[1] = (auth.uid())::text);
CREATE POLICY "garden_photos_owner_read" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'garden-photos' AND (storage.foldername(name))[1] = (auth.uid())::text);
