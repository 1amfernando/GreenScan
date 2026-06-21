-- v30.13: tote Mojibake-Karteileichen aus i18n_translations entfernen (Hygiene).
-- 158 Zeilen / 79 distinct korrupte source_text (z.B. 'â Abo aktiviert', 'LÃ¶schen', 'ð± Pflanze').
-- VERIFIZIERT SICHER (HL#23 observe-before-destructive): der definitive Frontend-vs-DB-Diff
-- (1386 saubere GS_I18N_JS_STRINGS-Werte) zeigt 0 Frontend-Werte mit Mojibake-Markern → kein
-- gerenderter String schlägt je eine dieser Zeilen nach; die sauberen Zwillinge (z.B.
-- '✅ Abo aktiviert') sind voll EN/ES/FR/IT-abgedeckt. source_lang=de + deutsche Texte
-- enthalten nie legitim Ã/â/ð/Â (klassische UTF-8-als-latin1-Korruption).
delete from i18n_translations
where source_lang='de'
  and (source_text like '%Ã%' or source_text like '%â%' or source_text like '%ð%' or source_text like '%Â%');
