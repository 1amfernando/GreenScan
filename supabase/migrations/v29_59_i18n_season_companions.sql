-- v29.59 — i18n für Mischkultur-Hinweise im Saisonkalender (DE→EN/ES/FR/IT). Idempotent, sha256-Hash.
-- Begleittext zur Frontend-Änderung: Saison-Detail zeigt gute/schlechte Nachbarn aus garden_crop_agronomy.
with src(de, en, es, fr, it) as (
  values
  ('Gute Nachbarn','Good neighbours','Buenos vecinos','Bons voisins','Buoni vicini'),
  ('Meiden','Avoid','Evitar','À éviter','Da evitare'),
  ('Mischkultur: FiBL/Bioterra','Companion planting: FiBL/Bioterra','Cultivo asociado: FiBL/Bioterra','Cultures associées : FiBL/Bioterra','Consociazione: FiBL/Bioterra')
),
unp as (select de, v.lang, v.tr from src, lateral (values ('en',en),('es',es),('fr',fr),('it',it)) as v(lang,tr))
insert into public.i18n_translations (source_lang, target_lang, source_text, source_hash, translated_text, context_note, model, created_at)
select 'de', u.lang, u.de, encode(digest(u.de,'sha256'),'hex'), u.tr, 'v29.59 Saison-Mischkultur', 'manual-curated', now()
from unp u
where not exists (select 1 from public.i18n_translations t where t.source_lang='de' and t.target_lang=u.lang and t.source_text=u.de);
