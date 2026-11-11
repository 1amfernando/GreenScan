-- 20261111_scan_images_privat.sql — Scan-Fotos nur noch fuer ihr Konto (und Admins)
--
-- ANLASS (Fernando, 11.11.2026: „privat stellen"). Der Bucket `scan-images` war
-- oeffentlich (storage.buckets.public = true): live 99 Objekte, alle unter <uid>/,
-- Scan-Fotos UND Pflanzen-Profilfotos. Wer eine Adresse kannte, sah das Foto ohne
-- Anmeldung. Die Leseregel fuer den Eigentuemer (`scan_images_owner_read`) gibt es
-- seit v29 — sie galt nur nicht, weil ein oeffentlicher Bucket an RLS vorbei liefert.
--
-- WAS SIE TUT:
--   1. eine Leseregel fuer Admins (die Arten-Vorschlaege in species_proposals tragen
--      19 Fotos fremder Konten, die das Admin-Panel zeigt)
--   2. den Bucket auf privat
--
-- VORAUSSETZUNG — ERST NACH der App mit dem Tor `_gsPrivatTorElement` (v33.6x) anwenden.
-- Die App macht aus jeder gespeicherten oeffentlichen Adresse beim Anzeigen eine
-- signierte (POST /storage/v1/object/sign/scan-images); sie laeuft vor UND nach dieser
-- Migration. Eine aeltere App zeigt danach statt des Fotos ihr Ersatzbild, bis sie
-- sich aktualisiert (seit v33.25 ohne Klick). Gespeicherte Adressen bleiben, wie sie
-- sind — keine Datenmigration.
--
-- Idempotent. Zurueck: `update storage.buckets set public = true where id = 'scan-images';`
-- (die Admin-Regel darf bleiben).
--
-- Pruefstand: scripts/scan_foto_check.js (SQL-Haelfte P1–P5, lokales Postgres) — die
-- Regel zweimal eingespielt, Eigentuemer · Admin · fremdes Konto · anonym, Gegenprobe.
--
-- Beim Anwenden pruefen:
--   select public from storage.buckets where id = 'scan-images';            → false
--   select policyname from pg_policies where schemaname = 'storage'
--     and tablename = 'objects' and policyname like 'scan_images_%';        → owner_read, admin_read
--   danach ein Scan in der App: das Foto steht da, seine Adresse enthaelt /object/sign/.

drop policy if exists scan_images_admin_read on storage.objects;
create policy scan_images_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'scan-images' and public.is_admin_user());

update storage.buckets set public = false where id = 'scan-images' and public is distinct from false;
