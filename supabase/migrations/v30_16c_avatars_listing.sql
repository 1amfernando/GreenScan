-- Storage-Härtung (HL#19) Teil 3: avatars anon-Listing schliessen → 4/4 komplett.
-- Der Workflow hatte avatars zunächst übersprungen (1 spekulativer break-vote: das
-- Feld avatar_url könnte per LIST-API geladen werden). Nachprüfung im Code: _gsAvatarHtml
-- liest p.avatar_url, ABER die Spalte avatar_url existiert in profiles gar NICHT (real:
-- avatar_emoji — siehe v27.02-Changelog-Notizen). Avatare werden als EMOJI gerendert; es
-- gibt KEINEN Upload-Code für den avatars-Bucket und KEINE Anzeige daraus. Der Bucket ist
-- effektiv ungenutzt → Härtung zero-risk. Ordner-Konvention {uid}/ (bestätigt durch die
-- bestehende avatars-owner-update/insert-Policy). Bucket bleibt public.
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
DROP POLICY IF EXISTS "avatars owner list" ON storage.objects;
CREATE POLICY "avatars owner list"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = (select auth.uid())::text);
