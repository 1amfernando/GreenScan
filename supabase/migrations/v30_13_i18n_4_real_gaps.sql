-- v30.13: die 4 ECHTEN i18n-Lücken (Frontend-Werte ohne volle EN/ES/FR/IT-Abdeckung).
-- Aus dem definitiven Frontend-vs-DB-Diff (1386 GS_I18N_JS_STRINGS-Werte). Hash baut Postgres selbst.
-- Sicherheits-String lrn_emergency_footer: 145 (Tox Info Suisse) bleibt EXAKT erhalten.
insert into i18n_translations (source_lang, target_lang, source_text, source_hash, translated_text, model, created_at)
select 'de', v.lang, v.src, encode(digest(v.src,'sha256'),'hex'), v.tr, 'manual-claude', now()
from (values
  ('en','in','in'),
  ('es','in','en'),
  ('fr','in','en'),
  ('it','in','in'),
  ('en','Lernen','Learn'),
  ('es','Lernen','Aprender'),
  ('fr','Lernen','Apprendre'),
  ('it','Lernen','Impara'),
  ('en','Pilze und Garten — Anfänger-Lektionen','Mushrooms & garden — beginner lessons'),
  ('es','Pilze und Garten — Anfänger-Lektionen','Setas y jardín — lecciones para principiantes'),
  ('fr','Pilze und Garten — Anfänger-Lektionen','Champignons et jardin — leçons pour débutants'),
  ('it','Pilze und Garten — Anfänger-Lektionen','Funghi e orto — lezioni per principianti'),
  ('en','Vergiftungsnotfall: 145 · Tox Info Suisse (24h, gratis)','Poisoning emergency: 145 · Tox Info Suisse (24h, free)'),
  ('es','Vergiftungsnotfall: 145 · Tox Info Suisse (24h, gratis)','Emergencia por intoxicación: 145 · Tox Info Suisse (24h, gratis)'),
  ('fr','Vergiftungsnotfall: 145 · Tox Info Suisse (24h, gratis)','Urgence intoxication : 145 · Tox Info Suisse (24h, gratuit)'),
  ('it','Vergiftungsnotfall: 145 · Tox Info Suisse (24h, gratis)','Emergenza avvelenamento: 145 · Tox Info Suisse (24h, gratis)')
) as v(lang, src, tr)
on conflict (source_lang, target_lang, source_hash) do nothing;
