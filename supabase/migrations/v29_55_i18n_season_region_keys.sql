-- v29.55 — i18n-Seeding für die neuen Saisonkalender-Strings (regional + "warum jetzt" + eigener Anbau).
-- DE-Quelle in GS_I18N_JS_STRINGS (index.html) registriert; hier EN/ES/FR/IT. Idempotent (NOT EXISTS),
-- source_hash = sha256(source_text) hex (pgcrypto digest), matchend zum bestehenden i18n_translations-Schema.
-- Angewandt 18.06.2026: 23 neue Zeilen je Sprache (der generische Key 'in' existierte bereits → idempotent
-- übersprungen). Backend-only Anteil von v29.55 (Frontend-v-Bump erfolgt in index.html/sw.js/_headers).
with src(de, en, es, fr, it) as (
  values
  ('Letzte Aussaat-Chance','Last chance to sow','Última oportunidad de sembrar','Dernière chance de semer','Ultima occasione per seminare'),
  ('Aussaat-Fenster beginnt','Sowing window opens','Comienza la ventana de siembra','La fenêtre de semis s''ouvre','Si apre la finestra di semina'),
  ('Letzte Pflanz-Chance','Last chance to plant','Última oportunidad de plantar','Dernière chance de planter','Ultima occasione per piantare'),
  ('Pflanzzeit beginnt','Planting time begins','Comienza la época de plantación','La période de plantation commence','Inizia il periodo di piantagione'),
  ('Erste Ernte','First harvest','Primera cosecha','Première récolte','Primo raccolto'),
  ('Letzte Ernte — bald vorbei','Last harvest — almost over','Última cosecha — casi termina','Dernière récolte — bientôt fini','Ultimo raccolto — quasi finito'),
  ('Volle Erntezeit','Peak harvest time','Plena temporada de cosecha','Pleine saison de récolte','Piena stagione di raccolta'),
  ('Sammelzeit beginnt','Foraging season begins','Comienza la temporada de recolección','La saison de cueillette commence','Inizia la stagione di raccolta'),
  ('Letzte Sammeltage','Last foraging days','Últimos días de recolección','Derniers jours de cueillette','Ultimi giorni di raccolta'),
  ('dein Anbau','you grow this','tú lo cultivas','vous le cultivez','lo coltivi'),
  ('Lokale Saison-Tipps','Local seasonal tips','Consejos de temporada locales','Conseils de saison locaux','Consigli stagionali locali'),
  ('Wähle deine Schweizer Region — dann zeigt der Kalender Frostdaten, Wachstumssaison und was genau bei dir gerade dran ist.','Choose your Swiss region — then the calendar shows frost dates, growing season and exactly what to do where you are.','Elige tu región suiza: el calendario mostrará las fechas de heladas, la temporada de cultivo y qué hacer exactamente en tu zona.','Choisis ta région suisse — le calendrier affiche alors les dates de gel, la saison de croissance et ce qu''il faut faire chez toi.','Scegli la tua regione svizzera: il calendario mostrerà le date delle gelate, la stagione di crescita e cosa fare esattamente da te.'),
  ('Region wählen','Choose region','Elegir región','Choisir la région','Scegli regione'),
  ('wechseln','change','cambiar','changer','cambia'),
  ('Letzter Frost','Last frost','Última helada','Dernière gelée','Ultima gelata'),
  ('Tage Saison','days of season','días de temporada','jours de saison','giorni di stagione'),
  ('Gut hier','Good here','Bueno aquí','Adapté ici','Adatto qui'),
  ('Schwierig','Difficult','Difícil','Difficile','Difficile'),
  ('Quelle','Source','Fuente','Source','Fonte'),
  ('Letzter Frost meist um','Last frost usually around','Última helada normalmente hacia','Dernière gelée généralement vers','Ultima gelata di solito intorno a'),
  ('Frostempfindliches (Tomaten, Bohnen, Basilikum) noch drinnen vorziehen.','Start frost-sensitive plants (tomatoes, beans, basil) indoors for now.','Cultiva por ahora en interior las plantas sensibles a las heladas (tomates, judías, albahaca).','Démarre encore à l''intérieur les plantes sensibles au gel (tomates, haricots, basilic).','Per ora avvia in casa le piante sensibili al gelo (pomodori, fagioli, basilico).'),
  ('Frostgrenze um','Frost limit around','Límite de heladas hacia','Limite de gel vers','Limite del gelo intorno a'),
  ('Eisheilige abwarten, dann darf Wärmeliebendes raus.','Wait for the Ice Saints, then heat-lovers can go outside.','Espera a los Santos de Hielo; luego las plantas que aman el calor pueden salir.','Attends les Saints de Glace, puis les plantes thermophiles peuvent sortir.','Aspetta i Santi di Ghiaccio, poi le piante che amano il caldo possono uscire.')
),
unp as (
  select de, v.lang, v.tr
  from src, lateral (values ('en', en),('es', es),('fr', fr),('it', it)) as v(lang, tr)
)
insert into public.i18n_translations (source_lang, target_lang, source_text, source_hash, translated_text, context_note, model, created_at)
select 'de', u.lang, u.de, encode(digest(u.de,'sha256'),'hex'), u.tr, 'v29.55 Saisonkalender regional', 'manual-curated', now()
from unp u
where not exists (
  select 1 from public.i18n_translations t
  where t.source_lang = 'de' and t.target_lang = u.lang and t.source_text = u.de
);
