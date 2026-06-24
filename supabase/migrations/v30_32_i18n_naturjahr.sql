-- #10: 'Mein Naturjahr' Menü-Eintrag hatte keine i18n-Zeile → rendert Deutsch für EN/ES/FR/IT.
-- Pure Daten-Insert (data-i18n liest dynamisch via loadFromDb → kein App-v-Bump). HL27: source_hash via digest.
-- Angewendet 2026-06-24 via MCP, verifiziert (4 Zeilen en/es/fr/it).
insert into public.i18n_translations (source_lang, target_lang, source_text, source_hash, translated_text, model)
select 'de', t.lang, 'Mein Naturjahr', encode(digest('Mein Naturjahr','sha256'),'hex'), t.txt, 'manual-audit2'
from (values
  ('en','My Nature Year'),
  ('es','Mi año en la naturaleza'),
  ('fr','Mon année nature'),
  ('it','Il mio anno nella natura')
) as t(lang, txt)
where not exists (
  select 1 from public.i18n_translations x
  where x.source_lang='de' and x.target_lang=t.lang
    and x.source_hash = encode(digest('Mein Naturjahr','sha256'),'hex')
);
