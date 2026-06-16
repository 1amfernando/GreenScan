-- v29.40 — Foto-Storage robust: INSERT/UPDATE/DELETE-Policies für Pflanzen- & Tagebuch-Fotos
--
-- Befund (empirisch, v29.40): scan-images lädt korrekt hoch, ABER user-plant-photos und
-- garden-diary-photos hatten KEINE INSERT-Policy → jeder Upload 403 → Frontend fiel auf
-- base64-localStorage zurück (fragil, kein Cross-Device, sprengt Quota). Andere Buckets
-- (scan-images, garden-photos, map-find-photos, marketplace-photos, post-images, avatars)
-- hatten bereits INSERT-Policies.
--
-- Fix: Owner-Folder-Pattern wie bei den anderen Buckets. Pfad ist <uid>/<datei>.jpg, daher
-- (storage.foldername(name))[1] = auth.uid(). SELECT bleibt bewusst OHNE Policy (privates
-- Listing, HL#19) — die Anzeige läuft über public CDN-GET (bucket public:true), nicht über
-- die LIST-API. auth.uid() in (SELECT …) gewrappt (HL#6, auth_rls_initplan).
--
-- JWT-verifiziert: own_folder_upload_ok=true | other_folder_blocked=true.

-- user-plant-photos
create policy "user-plant-photos owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user-plant-photos owner modify"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "user-plant-photos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-plant-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- garden-diary-photos
create policy "garden-diary-photos owner upload"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'garden-diary-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garden-diary-photos owner modify"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'garden-diary-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "garden-diary-photos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'garden-diary-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
