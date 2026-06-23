-- v30.22: Brand-Logo-Konsistenz — das alte 🌿-Emoji aus dem Community-Titel (social_title)
-- entfernt, da der Titel jetzt das Edelweiss-Bild (icons/icon.svg) als Geschwister-Img zeigt.
-- Frontend-Fallback wurde auf "GreenScan Community" (ohne 🌿) geändert → die i18n-Rows müssen
-- denselben source_text haben, sonst greift loadFromDb nicht (HL29). translated_text: 🌿 gestrippt.
update i18n_translations
set translated_text = ltrim(replace(translated_text, '🌿', '')),
    source_text = 'GreenScan Community',
    source_hash = encode(digest('GreenScan Community','sha256'),'hex')
where source_lang='de' and source_text = '🌿 GreenScan Community';
