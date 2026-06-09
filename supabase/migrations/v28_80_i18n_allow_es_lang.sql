-- v28.80 FIX: i18n_translations CHECK-Constraints erlaubten nur (de,fr,it,en,gsw) — 'es'
-- (Spanisch, seit v26.65 aktive App-Sprache) FEHLTE → jeder es-Insert scheiterte silent
-- → es-Tabelle blieb leer → Spanisch-User sahen ueberall Deutsch.
-- Fix: 'es' zu beiden CHECKs hinzufuegen ('gsw' harmlos belassen → kein Drop-Risiko bei Alt-Zeilen).
-- (Danach wurde i18n_translations fuer EN+ES mit allen 1163 aktuellen DE-Strings geseedet
--  via i18n-translate-Edge-Fn / Haiku 4.5 — siehe v28.80 Release-Notes.)
ALTER TABLE public.i18n_translations DROP CONSTRAINT IF EXISTS i18n_translations_target_lang_check;
ALTER TABLE public.i18n_translations ADD CONSTRAINT i18n_translations_target_lang_check
  CHECK (target_lang = ANY (ARRAY['de','fr','it','en','es','gsw']));
ALTER TABLE public.i18n_translations DROP CONSTRAINT IF EXISTS i18n_translations_source_lang_check;
ALTER TABLE public.i18n_translations ADD CONSTRAINT i18n_translations_source_lang_check
  CHECK (source_lang = ANY (ARRAY['de','fr','it','en','es','gsw']));
