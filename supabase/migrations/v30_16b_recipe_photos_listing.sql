-- Storage-Härtung (HL#19) Teil 2: recipe-photos anon-Listing schliessen — admin-aware.
-- Der 19-Agenten-Workflow hatte recipe-photos vom owner-BY-FOLDER-Fix ausgeschlossen,
-- weil die Fotos unter {recipe_id}/ liegen (nicht {uid}/) + Admins fremde Rezepte
-- kuratieren. Lösung: owner-BY-COLUMN (storage.objects.owner = Uploader-uid) ODER Admin.
-- Admin-SELECT ist ohnehin schon durch die bestehende ALL-Policy recipe_photos_admin_write
-- (is_admin_user()) gedeckt; diese SELECT-Policy ergänzt den Uploader-Selbstzugriff und
-- entfernt das anon-offene Listing. Bucket bleibt public=true → öffentliche Anzeige via
-- public-CDN-Pfad unberührt. (Bucket aktuell leer: 0 Objekte → null Migrations-Risiko.)
DROP POLICY IF EXISTS "recipe_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "recipe-photos owner or admin list" ON storage.objects;
CREATE POLICY "recipe-photos owner or admin list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'recipe-photos'
    AND (owner = (select auth.uid()) OR is_admin_user()));
