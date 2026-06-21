-- v30.14: Mischkultur-Notiz-Chrome (comp_) — EN/ES/FR/IT. UI-Strings. Hash baut Postgres selbst.
insert into i18n_translations (source_lang, target_lang, source_text, source_hash, translated_text, model, created_at)
select 'de', v.lang, v.src, encode(digest(v.src,'sha256'),'hex'), v.tr, 'manual-claude', now()
from (values
  ('en','Als Notiz übernehmen','Add to note'),
  ('es','Als Notiz übernehmen','Añadir a la nota'),
  ('fr','Als Notiz übernehmen','Ajouter à la note'),
  ('it','Als Notiz übernehmen','Aggiungi alla nota'),
  ('en','Mischkultur in die Notiz übernommen','Companion info added to note'),
  ('es','Mischkultur in die Notiz übernommen','Asociación añadida a la nota'),
  ('fr','Mischkultur in die Notiz übernommen','Association ajoutée à la note'),
  ('it','Mischkultur in die Notiz übernommen','Consociazione aggiunta alla nota'),
  ('en','Schon in der Notiz','Already in the note'),
  ('es','Schon in der Notiz','Ya está en la nota'),
  ('fr','Schon in der Notiz','Déjà dans la note'),
  ('it','Schon in der Notiz','Già nella nota')
) as v(lang, src, tr)
on conflict (source_lang, target_lang, source_hash) do nothing;
