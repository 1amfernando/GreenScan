-- v29.56b — i18n-Seeding für die Login-Highlight-Strings (DE→EN/ES/FR/IT). Idempotent (NOT EXISTS),
-- source_hash = sha256(source_text). Matcht die in GS_I18N_JS_STRINGS registrierten DE-Quelltexte
-- (onb_hl_*_t / onb_hl_*_s). Angewandt 18.06.2026: 12 Zeilen je Sprache.
with src(de, en, es, fr, it) as (
  values
  ('4342 Schweizer Arten','4342 Swiss species','4342 especies suizas','4342 espèces suisses','4342 specie svizzere'),
  ('Pflanzen, Pilze, Bäume & Kräuter per Foto bestimmen','Identify plants, mushrooms, trees & herbs by photo','Identifica plantas, setas, árboles y hierbas por foto','Identifie plantes, champignons, arbres et herbes par photo','Identifica piante, funghi, alberi ed erbe da una foto'),
  ('Pilze sicher bestimmen','Identify mushrooms safely','Identifica setas con seguridad','Identifier les champignons en toute sécurité','Identifica i funghi in sicurezza'),
  ('Mit VAPKO-Verzeichnis & Verwechsler-Warnungen','With VAPKO directory & look-alike warnings','Con directorio VAPKO y avisos de confusión','Avec annuaire VAPKO et alertes de confusion','Con elenco VAPKO e avvisi sui sosia'),
  ('Deinen Garten planen','Plan your garden','Planifica tu jardín','Planifie ton jardin','Pianifica il tuo giardino'),
  ('KI-Gartenplaner, Saisonkalender & Pflege-Erinnerungen','AI garden planner, seasonal calendar & care reminders','Planificador de jardín con IA, calendario de temporada y recordatorios de cuidado','Planificateur de jardin IA, calendrier saisonnier et rappels d''entretien','Pianificatore giardino IA, calendario stagionale e promemoria di cura'),
  ('Sammlung & Tagebuch','Collection & journal','Colección y diario','Collection et journal','Collezione e diario'),
  ('Funde speichern, Fortschritt sehen, Level sammeln','Save finds, track progress, earn levels','Guarda hallazgos, sigue tu progreso, sube de nivel','Enregistre tes trouvailles, suis ta progression, gagne des niveaux','Salva i ritrovamenti, segui i progressi, accumula livelli'),
  ('Wetter & Saison für deine Region','Weather & season for your region','Clima y temporada para tu región','Météo et saison pour ta région','Meteo e stagione per la tua regione'),
  ('Lokale Tipps, Frostwarnungen & Bauernregeln','Local tips, frost warnings & weather lore','Consejos locales, avisos de heladas y refranes del tiempo','Conseils locaux, alertes de gel et dictons météo','Consigli locali, allerte gelo e proverbi meteo'),
  ('Naturfreunde-Community','Nature-lovers community','Comunidad de amantes de la naturaleza','Communauté des amoureux de la nature','Comunità di amanti della natura'),
  ('Tausche dich aus, teile Funde, lerne gemeinsam','Connect, share finds, learn together','Conecta, comparte hallazgos, aprende en comunidad','Échange, partage tes trouvailles, apprends ensemble','Confrontati, condividi i ritrovamenti, impara insieme')
),
unp as (
  select de, v.lang, v.tr
  from src, lateral (values ('en', en),('es', es),('fr', fr),('it', it)) as v(lang, tr)
)
insert into public.i18n_translations (source_lang, target_lang, source_text, source_hash, translated_text, context_note, model, created_at)
select 'de', u.lang, u.de, encode(digest(u.de,'sha256'),'hex'), u.tr, 'v29.56 Login-Highlights', 'manual-curated', now()
from unp u
where not exists (
  select 1 from public.i18n_translations t
  where t.source_lang = 'de' and t.target_lang = u.lang and t.source_text = u.de
);
