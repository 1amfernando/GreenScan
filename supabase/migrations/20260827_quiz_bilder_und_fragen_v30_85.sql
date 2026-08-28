-- v30.85: Tages-Quiz — Bildfragen + deutlich mehr Fragen.
-- User-Wunsch: „Tägliches Quiz soll mehr Fragen erhalten. Cool wäre auch
-- Fragen mit Bildern, so dass es spannender ist und mehr Spass macht."
--
-- Ausgangslage (live gemessen): 203 aktive Fragen, 23 Kategorien, KEINE
-- Bildunterstützung im Schema. fn_get_daily_quiz vermeidet Wiederholungen
-- 730 Tage lang — bei 203 Fragen ist der Vorrat also nach gut einem halben
-- Jahr erschöpft und fällt auf Wiederholungen zurück.
--
-- Diese Migration: Bild-Spalten + erweiterte RPC + 42 neue Fragen
-- (davon 12 Bildfragen). Alles idempotent.

-- ═══════════════════════════════════════════════════════════════════
-- 1 · SCHEMA: Bild-Spalten
-- ═══════════════════════════════════════════════════════════════════
ALTER TABLE public.daily_quizzes ADD COLUMN IF NOT EXISTS image_url    text;
ALTER TABLE public.daily_quizzes ADD COLUMN IF NOT EXISTS image_credit text;
ALTER TABLE public.daily_quizzes ADD COLUMN IF NOT EXISTS image_alt    text;

COMMENT ON COLUMN public.daily_quizzes.image_url IS
  'Optionales Foto zur Frage. Das Frontend filtert die URL durch _gsSafeUrl (nur https/data:image) und faellt bei Ladefehler still auf das Emoji zurueck.';

-- HINWEIS zur Wiederholbarkeit: Ein UNIQUE INDEX auf `question` waere elegant,
-- ist hier aber NICHT moeglich — die Tabelle enthaelt bereits 2 doppelte
-- Fragetexte (live geprueft). Ein Index-Anlegen wuerde fehlschlagen, und
-- Loeschen der Duplikate ist heikel, weil daily_quiz_history und quiz_answers
-- auf die IDs verweisen. Diese Migration fasst deshalb KEINE Bestandsdaten an:
-- der INSERT unten filtert selbst per NOT EXISTS und ist damit wiederholbar.
-- Aufraeumen der 2 Alt-Duplikate ist als separate Aufgabe notiert (STATUS.md).

-- ═══════════════════════════════════════════════════════════════════
-- 2 · RPC erweitern (Rueckgabe-Signatur muss die Bild-Spalten mitliefern)
-- ═══════════════════════════════════════════════════════════════════
-- Die Rueckgabe-Signatur aendert sich → DROP ist zwingend. Danach die
-- Rechte neu setzen: fn_get_daily_quiz ist bewusst auch fuer anon
-- ausfuehrbar (Quiz laeuft ohne Login).
DROP FUNCTION IF EXISTS public.fn_get_daily_quiz();

CREATE FUNCTION public.fn_get_daily_quiz()
RETURNS TABLE(id uuid, question text, options jsonb, category text, xp_reward integer,
              image_url text, image_credit text, image_alt text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  today_key date := current_date;
  picked_id uuid;
BEGIN
  SELECT h.question_id INTO picked_id FROM public.daily_quiz_history h WHERE h.day_key = today_key;
  IF picked_id IS NOT NULL THEN
    RETURN QUERY SELECT q.id, q.question, q.options, q.category, q.xp_reward,
                        q.image_url, q.image_credit, q.image_alt
      FROM public.daily_quizzes q WHERE q.id = picked_id AND q.is_active = true;
    RETURN;
  END IF;
  SELECT q.id INTO picked_id FROM public.daily_quizzes q
  WHERE q.is_active = true
    AND NOT EXISTS (SELECT 1 FROM public.daily_quiz_history h
      WHERE h.question_id = q.id AND h.day_key > today_key - INTERVAL '730 days')
  ORDER BY md5(today_key::text || q.id::text) LIMIT 1;
  IF picked_id IS NULL THEN
    SELECT q.id INTO picked_id FROM public.daily_quizzes q
    WHERE q.is_active = true ORDER BY md5(today_key::text || q.id::text) LIMIT 1;
  END IF;
  IF picked_id IS NOT NULL THEN
    INSERT INTO public.daily_quiz_history (day_key, question_id) VALUES (today_key, picked_id)
    ON CONFLICT (day_key) DO NOTHING;
    RETURN QUERY SELECT q.id, q.question, q.options, q.category, q.xp_reward,
                        q.image_url, q.image_credit, q.image_alt
      FROM public.daily_quizzes q WHERE q.id = picked_id;
  END IF;
END $function$;

GRANT EXECUTE ON FUNCTION public.fn_get_daily_quiz() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 3 · NEUE FRAGEN (42 — davon 12 mit Bild)
-- ═══════════════════════════════════════════════════════════════════
-- Bilder von Wikimedia Commons (freie Lizenzen, stabile Direkt-URLs).
-- Das Frontend faellt bei Ladefehler still auf das Emoji zurueck, ein
-- toter Link macht also nie eine Frage unbrauchbar.

INSERT INTO public.daily_quizzes (question, options, category, xp_reward, is_active, image_url, image_credit, image_alt)
SELECT v.question, v.options, v.category, v.xp_reward, v.is_active, v.image_url, v.image_credit, v.image_alt
FROM (VALUES

-- ── BILDFRAGEN ──────────────────────────────────────────────────
('Welcher tödlich giftige Pilz ist hier abgebildet?',
 '[{"label":"Grüner Knollenblätterpilz","is_correct":true,"explanation":"Amanita phalloides — verantwortlich für die meisten tödlichen Pilzvergiftungen in Europa. Merkmale: weisse Lamellen, Ring am Stiel, Knolle in einer Scheide."},
   {"label":"Champignon","is_correct":false,"explanation":"Champignons haben rosa bis braune Lamellen und keine Scheide an der Stielbasis."},
   {"label":"Parasol","is_correct":false,"explanation":"Der Parasol ist deutlich grösser und hat einen genatterten Stiel."},
   {"label":"Perlpilz","is_correct":false,"explanation":"Der Perlpilz rötet an Verletzungsstellen und hat keine Scheide."}]'::jsonb,
 'mushroom_safety', 20, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5b/Amanita_phalloides_1.JPG/640px-Amanita_phalloides_1.JPG',
 'Wikimedia Commons', 'Ein weisslich-grüner Pilz mit Ring und Knolle'),

('Welche Pflanze ist auf dem Bild zu sehen?',
 '[{"label":"Bärlauch","is_correct":true,"explanation":"Allium ursinum. Sicheres Merkmal: Beim Zerreiben riecht das Blatt deutlich nach Knoblauch."},
   {"label":"Maiglöckchen","is_correct":false,"explanation":"Maiglöckchen sind giftig — ihre Blätter sind steifer und geruchlos."},
   {"label":"Herbstzeitlose","is_correct":false,"explanation":"Stark giftig, Blätter ohne Stiel direkt aus dem Boden."},
   {"label":"Waldmeister","is_correct":false,"explanation":"Waldmeister hat quirlständige, schmale Blätter."}]'::jsonb,
 'species_id', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Allium_ursinum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-166.jpg/640px-Allium_ursinum_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-166.jpg',
 'Wikimedia Commons', 'Pflanze mit breiten Blättern und weissen Blüten'),

('Welcher Baum trägt diese charakteristischen Blätter?',
 '[{"label":"Stiel-Eiche","is_correct":true,"explanation":"Quercus robur — buchtig gelappte Blätter mit sehr kurzem Stiel, die Eichel dagegen langgestielt."},
   {"label":"Bergahorn","is_correct":false,"explanation":"Ahornblätter sind handförmig gelappt mit spitzen Zipfeln."},
   {"label":"Rotbuche","is_correct":false,"explanation":"Buchenblätter sind eiförmig, ganzrandig und leicht gewellt."},
   {"label":"Esche","is_correct":false,"explanation":"Die Esche hat gefiederte Blätter mit vielen Teilblättchen."}]'::jsonb,
 'tree_id', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Quercus_robur_leaf.jpg/640px-Quercus_robur_leaf.jpg',
 'Wikimedia Commons', 'Gelapptes Laubblatt'),

('Welches Insekt ist hier zu sehen — und was frisst seine Larve?',
 '[{"label":"Marienkäfer — Blattläuse","is_correct":true,"explanation":"Eine einzige Larve frisst bis zu 400 Blattläuse. Die grau-orangen Larven sind noch nützlicher als die Käfer."},
   {"label":"Kartoffelkäfer — Kartoffelblätter","is_correct":false,"explanation":"Der Kartoffelkäfer ist gelb mit schwarzen Längsstreifen."},
   {"label":"Maikäfer — Wurzeln","is_correct":false,"explanation":"Maikäfer sind deutlich grösser und braun."},
   {"label":"Weichkäfer — Nektar","is_correct":false,"explanation":"Weichkäfer sind länglich und weich."}]'::jsonb,
 'garden_helpers', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/64/Coccinella_magnifica01.jpg/640px-Coccinella_magnifica01.jpg',
 'Wikimedia Commons', 'Roter Käfer mit schwarzen Punkten'),

('Diese Alpenblume steht in der Schweiz unter Schutz. Welche ist es?',
 '[{"label":"Edelweiss","is_correct":true,"explanation":"Leontopodium alpinum. Die weisse Behaarung ist ein natürlicher UV-Schutz. Pflücken ist vielerorts verboten."},
   {"label":"Alpenrose","is_correct":false,"explanation":"Die Alpenrose blüht kräftig rosa-rot in dichten Büschen."},
   {"label":"Enzian","is_correct":false,"explanation":"Enziane sind meist leuchtend blau."},
   {"label":"Silberdistel","is_correct":false,"explanation":"Die Silberdistel hat einen deutlich stacheligen Blattkranz."}]'::jsonb,
 'alpine', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Leontopodium_alpinum_02.jpg/640px-Leontopodium_alpinum_02.jpg',
 'Wikimedia Commons', 'Weisse, filzig behaarte Sternblüte'),

('Welcher essbare Pilz ist hier abgebildet?',
 '[{"label":"Pfifferling","is_correct":true,"explanation":"Cantharellus cibarius — dottergelb, mit gabeligen Leisten statt echten Lamellen, riecht fruchtig nach Aprikose."},
   {"label":"Falscher Pfifferling","is_correct":false,"explanation":"Der Falsche Pfifferling hat echte, feine Lamellen und ist orangener."},
   {"label":"Fliegenpilz","is_correct":false,"explanation":"Der Fliegenpilz ist rot mit weissen Flocken."},
   {"label":"Hallimasch","is_correct":false,"explanation":"Hallimasch wächst büschelig an Holz."}]'::jsonb,
 'mushroom_id', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Cantharellus_cibarius_-_Lindsey_1a.jpg/640px-Cantharellus_cibarius_-_Lindsey_1a.jpg',
 'Wikimedia Commons', 'Gelber trichterförmiger Pilz'),

('Welcher Vogel ist das — und warum ist er im Garten so wertvoll?',
 '[{"label":"Kohlmeise — sie füttert ihre Jungen mit Raupen","is_correct":true,"explanation":"Ein Meisenpaar braucht für eine Brut rund 10 000 Raupen. Nistkästen sind daher gelebter Pflanzenschutz."},
   {"label":"Spatz — er frisst Körner","is_correct":false,"explanation":"Spatzen sind bräunlich und weniger kontrastreich gezeichnet."},
   {"label":"Rotkehlchen — es frisst Schnecken","is_correct":false,"explanation":"Das Rotkehlchen hat eine orangerote Brust."},
   {"label":"Buchfink — er verbreitet Samen","is_correct":false,"explanation":"Der Buchfink hat eine blaugraue Kappe."}]'::jsonb,
 'birds', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/Parus_major_Luc_Viatour.jpg/640px-Parus_major_Luc_Viatour.jpg',
 'Wikimedia Commons', 'Gelb-schwarzer Singvogel'),

('Diese Pflanze wächst fast überall — wie heisst sie und wozu taugt sie?',
 '[{"label":"Brennnessel — Dünger und Gemüse","is_correct":true,"explanation":"Als Jauche einer der stickstoffreichsten Gratis-Dünger; gekocht ein eisenreiches Gemüse. Zudem Raupenfutter für viele Schmetterlinge."},
   {"label":"Giersch — nur Unkraut","is_correct":false,"explanation":"Giersch hat dreizählige Blätter und ist ebenfalls essbar."},
   {"label":"Melde — Zierpflanze","is_correct":false,"explanation":"Melde hat mehlig bestäubte Blätter."},
   {"label":"Beifuss — Giftpflanze","is_correct":false,"explanation":"Beifuss ist ein Gewürzkraut mit fein gefiederten Blättern."}]'::jsonb,
 'wild_herbs', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Urtica_dioica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-281.jpg/640px-Urtica_dioica_-_K%C3%B6hler%E2%80%93s_Medizinal-Pflanzen-281.jpg',
 'Wikimedia Commons', 'Pflanze mit gezähnten, gegenständigen Blättern'),

('Welches Tier ist das — und wie hilfst du ihm im Garten am meisten?',
 '[{"label":"Igel — mit einem Loch im Zaun","is_correct":true,"explanation":"Ein Igel läuft nachts bis zu zwei Kilometer. Ein 13 × 13 cm grosses Loch verbindet Gärten zu einem Lebensraum. Milch ist dagegen schädlich."},
   {"label":"Igel — mit einer Schale Milch","is_correct":false,"explanation":"Milch verursacht bei Igeln schweren Durchfall — niemals geben."},
   {"label":"Maulwurf — mit lockerer Erde","is_correct":false,"explanation":"Der Maulwurf ist fast blind und hat Grabschaufeln statt Stacheln."},
   {"label":"Spitzmaus — mit Körnern","is_correct":false,"explanation":"Spitzmäuse sind winzig und haben eine lange Nase."}]'::jsonb,
 'garden_helpers', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Igel.JPG/640px-Igel.JPG',
 'Wikimedia Commons', 'Kleines Säugetier mit Stacheln'),

('Welcher Baum hat diese auffällige Rinde?',
 '[{"label":"Birke","is_correct":true,"explanation":"Betula pendula — die weisse, sich papierartig ablösende Rinde ist unverwechselbar. Birken sind Pionierbäume auf offenen Flächen."},
   {"label":"Buche","is_correct":false,"explanation":"Die Buche hat eine glatte, silbergraue Rinde."},
   {"label":"Kiefer","is_correct":false,"explanation":"Die Kiefer hat im oberen Stammbereich eine orangerote, schuppige Rinde."},
   {"label":"Platane","is_correct":false,"explanation":"Die Platane blättert in unregelmässigen Flecken ab."}]'::jsonb,
 'tree_id', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Birch_bark_2.jpg/640px-Birch_bark_2.jpg',
 'Wikimedia Commons', 'Weisse, quergestreifte Baumrinde'),

('Welche Heilpflanze ist hier zu sehen?',
 '[{"label":"Echte Kamille","is_correct":true,"explanation":"Matricaria chamomilla. Erkennungsmerkmal: Der Blütenboden ist hohl und kegelförmig — bei der geruchlosen Hundskamille nicht."},
   {"label":"Gänseblümchen","is_correct":false,"explanation":"Das Gänseblümchen hat eine grundständige Blattrosette und einzelne Blüten."},
   {"label":"Schafgarbe","is_correct":false,"explanation":"Die Schafgarbe trägt viele kleine Blüten in einer Doldenrispe."},
   {"label":"Margerite","is_correct":false,"explanation":"Die Margerite ist deutlich grösser und nicht aromatisch."}]'::jsonb,
 'medicinal', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Matricaria_February_2008-1.jpg/640px-Matricaria_February_2008-1.jpg',
 'Wikimedia Commons', 'Kleine weisse Blüten mit gelber Mitte'),

('Was zeigt dieses Bild — und was sagt es über den Boden aus?',
 '[{"label":"Regenwurm — ein Zeichen für gesunden Boden","is_correct":true,"explanation":"Regenwürmer sind ein anerkannter Bioindikator. Sie setzen täglich etwa ihr Körpergewicht an Erde um und verbessern Durchlüftung und Wasserführung."},
   {"label":"Drahtwurm — ein Zeichen für Schädlingsbefall","is_correct":false,"explanation":"Drahtwürmer sind hart, gelbbraun und gegliedert."},
   {"label":"Engerling — ein Zeichen für Trockenheit","is_correct":false,"explanation":"Engerlinge sind dicke, weisse Käferlarven mit Beinen."},
   {"label":"Nematode — ein Zeichen für kranke Wurzeln","is_correct":false,"explanation":"Nematoden sind mikroskopisch klein."}]'::jsonb,
 'soil', 15, true,
 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Regenwurm1.jpg/640px-Regenwurm1.jpg',
 'Wikimedia Commons', 'Regenwurm auf Erde'),

-- ── TEXTFRAGEN ──────────────────────────────────────────────────
('Warum sollte man morgens statt abends giessen?',
 '[{"label":"Blätter trocknen ab und Schnecken werden nicht angelockt","is_correct":true,"explanation":"Feuchte Nachtbeete ziehen Schnecken an, und nasse Blätter über Nacht fördern Pilzkrankheiten."},
   {"label":"Das Wasser ist morgens nährstoffreicher","is_correct":false,"explanation":"Die Tageszeit ändert nichts an der Wasserqualität."},
   {"label":"Pflanzen trinken nur morgens","is_correct":false,"explanation":"Pflanzen nehmen rund um die Uhr Wasser auf."},
   {"label":"Abends verdunstet mehr Wasser","is_correct":false,"explanation":"Umgekehrt — tagsüber verdunstet deutlich mehr."}]'::jsonb,
 'garden_care', 10, true, NULL, NULL, NULL),

('Was bedeutet „Frostgare" im Garten?',
 '[{"label":"Frost sprengt schwere Böden auf und macht sie krümelig","is_correct":true,"explanation":"Gefrierendes Bodenwasser dehnt sich aus und bricht Tonaggregate auf — deshalb schwere Böden im Herbst grob liegen lassen."},
   {"label":"Pflanzen werden durch Frost süsser","is_correct":false,"explanation":"Das stimmt zwar für Rosenkohl, ist aber nicht die Frostgare."},
   {"label":"Der Boden wird durch Frost steril","is_correct":false,"explanation":"Bodenleben überdauert Frost weitgehend."},
   {"label":"Frost bindet Stickstoff im Boden","is_correct":false,"explanation":"Stickstoff wird von Bakterien und Leguminosen gebunden."}]'::jsonb,
 'soil', 15, true, NULL, NULL, NULL),

('Welche Pflanzen binden Stickstoff aus der Luft?',
 '[{"label":"Schmetterlingsblütler wie Klee, Bohnen und Lupinen","is_correct":true,"explanation":"Sie leben in Symbiose mit Knöllchenbakterien. Deshalb sind sie ideale Gründüngung und Vorfrucht."},
   {"label":"Alle Blattgemüse","is_correct":false,"explanation":"Blattgemüse zehrt Stickstoff eher auf."},
   {"label":"Nadelbäume","is_correct":false,"explanation":"Nadelbäume binden keinen Luftstickstoff."},
   {"label":"Kartoffeln","is_correct":false,"explanation":"Die Kartoffel ist ein Starkzehrer."}]'::jsonb,
 'garden_care', 15, true, NULL, NULL, NULL),

('Warum werden Igeln keine Milch geben?',
 '[{"label":"Sie vertragen keinen Milchzucker und bekommen Durchfall","is_correct":true,"explanation":"Igel sind laktoseintolerant. Richtig ist Katzennassfutter und vor allem eine Schale Wasser."},
   {"label":"Milch lockt Füchse an","is_correct":false,"explanation":"Das ist nicht der Hauptgrund."},
   {"label":"Igel mögen keine Milch","is_correct":false,"explanation":"Sie trinken sie sogar gerne — und werden davon krank."},
   {"label":"Milch verdirbt zu schnell","is_correct":false,"explanation":"Das Problem ist die Unverträglichkeit selbst."}]'::jsonb,
 'garden_helpers', 15, true, NULL, NULL, NULL),

('Was ist eine Mykorrhiza?',
 '[{"label":"Eine Partnerschaft zwischen Pflanzenwurzel und Pilz","is_correct":true,"explanation":"Der Pilz liefert Wasser und Phosphor, die Pflanze zahlt mit Zucker. Über 90 Prozent aller Landpflanzen leben so."},
   {"label":"Eine Pilzkrankheit an Wurzeln","is_correct":false,"explanation":"Mykorrhiza ist nützlich, keine Krankheit."},
   {"label":"Ein Bodenmineral","is_correct":false,"explanation":"Es ist eine Lebensgemeinschaft."},
   {"label":"Eine Vermehrungsform von Moosen","is_correct":false,"explanation":"Moose vermehren sich über Sporen."}]'::jsonb,
 'ecology', 15, true, NULL, NULL, NULL),

('Woran erkennst du Bärlauch sicher?',
 '[{"label":"Am deutlichen Knoblauchgeruch beim Zerreiben des Blattes","is_correct":true,"explanation":"Der Geruchstest ist entscheidend — Maiglöckchen und Herbstzeitlose riechen nicht und sind stark giftig. Vorsicht: Nach mehreren Blättern riechen die Finger immer nach Knoblauch."},
   {"label":"An den weissen Blüten","is_correct":false,"explanation":"Zur Blütezeit ist die Erntezeit weitgehend vorbei — Verwechslungen passieren vorher."},
   {"label":"Am glänzenden Blatt","is_correct":false,"explanation":"Maiglöckchenblätter glänzen ebenfalls."},
   {"label":"Am Standort im Wald","is_correct":false,"explanation":"Alle drei Arten wachsen im Wald."}]'::jsonb,
 'edible_toxic', 20, true, NULL, NULL, NULL),

('Welche Nummer ist der Schweizer Notruf bei Vergiftungen?',
 '[{"label":"145","is_correct":true,"explanation":"Tox Info Suisse, rund um die Uhr erreichbar. Bei Verdacht auf Pilz- oder Pflanzenvergiftung sofort anrufen."},
   {"label":"144","is_correct":false,"explanation":"144 ist die allgemeine Sanitätsnotrufnummer."},
   {"label":"117","is_correct":false,"explanation":"117 ist die Polizei."},
   {"label":"118","is_correct":false,"explanation":"118 ist die Feuerwehr."}]'::jsonb,
 'safety', 20, true, NULL, NULL, NULL),

('Was verrät die Brennnessel über den Boden, auf dem sie wächst?',
 '[{"label":"Er ist stickstoffreich","is_correct":true,"explanation":"Die Brennnessel ist eine klassische Stickstoff-Zeigerpflanze (Ellenberg). Schachtelhalm zeigt dagegen Staunässe an."},
   {"label":"Er ist sehr sauer","is_correct":false,"explanation":"Saure Böden zeigt eher der Hederich an."},
   {"label":"Er ist ausgelaugt","is_correct":false,"explanation":"Genau das Gegenteil ist der Fall."},
   {"label":"Er ist sandig und trocken","is_correct":false,"explanation":"Brennnesseln mögen frische, nährstoffreiche Böden."}]'::jsonb,
 'soil', 15, true, NULL, NULL, NULL),

('Warum ist Efeu im Herbst so wertvoll für Insekten?',
 '[{"label":"Er blüht von September bis November, wenn sonst kaum etwas blüht","is_correct":true,"explanation":"Efeu ist die letzte grosse Nektarquelle vor dem Winter — für Bienen, Wespen und Schwebfliegen entscheidend."},
   {"label":"Er bietet Nistmaterial","is_correct":false,"explanation":"Der Wert liegt in der späten Blüte."},
   {"label":"Seine Blätter sind Raupenfutter","is_correct":false,"explanation":"Efeublätter werden kaum gefressen."},
   {"label":"Er speichert Wärme","is_correct":false,"explanation":"Das ist nicht der Hauptnutzen."}]'::jsonb,
 'ecology', 15, true, NULL, NULL, NULL),

('Wie hoch wird ein gut geschichteter Komposthaufen im Inneren?',
 '[{"label":"60 bis 70 Grad","is_correct":true,"explanation":"Diese Hitze entsteht durch Mikroorganismen und tötet Unkrautsamen sowie Krankheitserreger ab."},
   {"label":"Etwa 25 Grad","is_correct":false,"explanation":"Das reicht nicht für die Hygienisierung."},
   {"label":"Über 100 Grad","is_correct":false,"explanation":"So heiss wird ein Komposthaufen nicht."},
   {"label":"Er bleibt auf Aussentemperatur","is_correct":false,"explanation":"Ein funktionierender Kompost erwärmt sich deutlich."}]'::jsonb,
 'garden_care', 15, true, NULL, NULL, NULL),

('Was ist „Frosttrocknis" und wen trifft sie?',
 '[{"label":"Immergrüne verdursten, weil der gefrorene Boden kein Wasser liefert","is_correct":true,"explanation":"Buchs, Rhododendron und Kübelpflanzen verdunsten auch im Winter. An frostfreien Tagen giessen."},
   {"label":"Wurzeln platzen durch Eisbildung","is_correct":false,"explanation":"Das wäre Frostschaden, nicht Frosttrocknis."},
   {"label":"Der Boden trocknet durch Wind aus","is_correct":false,"explanation":"Das Problem liegt bei der Pflanze, nicht am Boden allein."},
   {"label":"Laubbäume verlieren zu früh ihre Blätter","is_correct":false,"explanation":"Laubbäume sind im Winter ohnehin kahl."}]'::jsonb,
 'garden_care', 15, true, NULL, NULL, NULL),

('Wie viele Wildbienenarten leben in der Schweiz — und wie viele bilden Völker?',
 '[{"label":"Rund 600 Arten, über 90 Prozent leben einzeln","is_correct":true,"explanation":"Die meisten Wildbienen sind Einzelgänger ohne Volk und ohne Honig. Viele nisten im Boden — offene Erdstellen helfen mehr als gekaufte Insektenhotels."},
   {"label":"Rund 50 Arten, alle bilden Völker","is_correct":false,"explanation":"Die Artenzahl ist weit höher."},
   {"label":"Rund 600 Arten, alle bilden Völker","is_correct":false,"explanation":"Nur wenige Arten sind staatenbildend."},
   {"label":"Nur die Honigbiene","is_correct":false,"explanation":"Die Honigbiene ist nur eine von vielen Arten."}]'::jsonb,
 'ecology', 15, true, NULL, NULL, NULL),

('Warum schmeckt Rosenkohl nach Frost milder?',
 '[{"label":"Er wandelt Stärke in Zucker um, um seine Zellen zu schützen","is_correct":true,"explanation":"Zucker senkt den Gefrierpunkt in den Zellen — ein biologisches Frostschutzmittel, das nebenbei den Geschmack verbessert."},
   {"label":"Frost tötet Bitterstoffe ab","is_correct":false,"explanation":"Die Bitterstoffe werden nicht zerstört, sondern durch Zucker überdeckt."},
   {"label":"Die Zellwände werden weicher","is_correct":false,"explanation":"Das erklärt die Süsse nicht."},
   {"label":"Er nimmt Feuchtigkeit auf","is_correct":false,"explanation":"Das hat keinen Einfluss auf den Geschmack."}]'::jsonb,
 'garden_care', 15, true, NULL, NULL, NULL),

('Was ist die wichtigste Regel beim Pilzesammeln in der Schweiz?',
 '[{"label":"Im Zweifel zur amtlichen Pilzkontrolle (VAPKO)","is_correct":true,"explanation":"Die Pilzkontrolle ist vielerorts gratis. Kein Buch und keine App ersetzt sie — auch GreenScan liefert nur eine Einschätzung, keine Freigabe."},
   {"label":"Alle Röhrlinge sind essbar","is_correct":false,"explanation":"Auch unter den Röhrlingen gibt es giftige Arten."},
   {"label":"Pilze mit Ring sind immer giftig","is_correct":false,"explanation":"Viele Speisepilze haben einen Ring."},
   {"label":"Was Tiere fressen, ist auch für Menschen essbar","is_correct":false,"explanation":"Gefährlicher Irrglaube — Schnecken fressen selbst Knollenblätterpilze."}]'::jsonb,
 'safety', 20, true, NULL, NULL, NULL),

('Warum ist ein nackter Boden ein Problem?',
 '[{"label":"Er verliert Struktur, Feuchtigkeit und Bodenleben","is_correct":true,"explanation":"Offener Boden verschlämmt bei Regen, erodiert und baut Humus ab. Mulch oder Begrünung schützt."},
   {"label":"Er sieht unordentlich aus","is_correct":false,"explanation":"Das ist reine Optik."},
   {"label":"Er wird zu nährstoffreich","is_correct":false,"explanation":"Nährstoffe werden eher ausgewaschen."},
   {"label":"Er zieht Vögel an","is_correct":false,"explanation":"Das wäre kein Nachteil."}]'::jsonb,
 'soil', 15, true, NULL, NULL, NULL),

('Wann pflanzt man Gehölze am besten?',
 '[{"label":"Im Herbst, weil die Wurzeln im warmen Boden weiterwachsen","is_correct":true,"explanation":"Herbstpflanzung schlägt die Frühjahrspflanzung: Die Pflanze ist im Frühling etabliert und übersteht Trockenheit besser."},
   {"label":"Im Hochsommer","is_correct":false,"explanation":"Hitze und Trockenheit sind der schlechteste Zeitpunkt."},
   {"label":"Bei Frost","is_correct":false,"explanation":"In gefrorenen Boden kann man nicht pflanzen."},
   {"label":"Es spielt keine Rolle","is_correct":false,"explanation":"Der Zeitpunkt beeinflusst den Anwachserfolg deutlich."}]'::jsonb,
 'garden_care', 15, true, NULL, NULL, NULL),

('Was passiert beim Laubfall im Baum, bevor das Blatt abfällt?',
 '[{"label":"Der Baum zieht Stickstoff und Phosphor zurück","is_correct":true,"explanation":"Erst danach bildet er eine Trennschicht am Blattstiel. Herbstlaub ist also bereits ausgeräumte Restsubstanz — deshalb verrottet es langsam."},
   {"label":"Er pumpt Zucker ins Blatt","is_correct":false,"explanation":"Umgekehrt — Nährstoffe wandern in den Stamm."},
   {"label":"Das Blatt stirbt einfach ab","is_correct":false,"explanation":"Der Laubfall ist ein aktiv gesteuerter Vorgang."},
   {"label":"Er lagert Wasser ein","is_correct":false,"explanation":"Wasser wird eher entzogen."}]'::jsonb,
 'trees', 15, true, NULL, NULL, NULL),

('Warum melken Ameisen Blattläuse?',
 '[{"label":"Wegen des Honigtaus — dafür schützen sie die Läuse","is_correct":true,"explanation":"Wer Blattläuse loswerden will, muss oft zuerst die Ameisenstrasse unterbrechen, sonst vertreiben die Ameisen die Marienkäfer."},
   {"label":"Sie fressen die Blattläuse","is_correct":false,"explanation":"Sie schützen sie im Gegenteil."},
   {"label":"Sie nutzen sie als Nistmaterial","is_correct":false,"explanation":"Blattläuse sind Nahrungsquelle, kein Baumaterial."},
   {"label":"Zufall ohne Nutzen","is_correct":false,"explanation":"Es ist eine echte Symbiose."}]'::jsonb,
 'garden_helpers', 15, true, NULL, NULL, NULL),

('Wie viel Wasser verdunstet eine ausgewachsene Buche an einem Sommertag?',
 '[{"label":"Bis zu 400 Liter","is_correct":true,"explanation":"Die Verdunstungskühlung entspricht der Leistung mehrerer Klimageräte — Stadtbäume senken die Umgebungstemperatur messbar."},
   {"label":"Etwa 5 Liter","is_correct":false,"explanation":"Deutlich zu wenig für einen grossen Baum."},
   {"label":"Rund 50 Liter","is_correct":false,"explanation":"Auch das ist noch zu niedrig."},
   {"label":"Über 5000 Liter","is_correct":false,"explanation":"So viel ist es nicht."}]'::jsonb,
 'trees', 15, true, NULL, NULL, NULL),

('Welche Farbe können Bienen NICHT sehen?',
 '[{"label":"Rot","is_correct":true,"explanation":"Bienen sehen Ultraviolett, aber kein Rot — rote Blüten wirken auf sie schwarz. Viele Blüten tragen UV-Muster als Landebahn."},
   {"label":"Blau","is_correct":false,"explanation":"Blau sehen Bienen besonders gut."},
   {"label":"Gelb","is_correct":false,"explanation":"Gelb ist für Bienen gut sichtbar."},
   {"label":"Violett","is_correct":false,"explanation":"Violett ist eine ihrer Lieblingsfarben."}]'::jsonb,
 'ecology', 15, true, NULL, NULL, NULL),

('Was ist beim Winterschnitt von Obstbäumen zu beachten?',
 '[{"label":"Nur bei frostfreiem Wetter über etwa minus 5 Grad schneiden","is_correct":true,"explanation":"Bei strengem Frost ist das Holz spröde und Wunden heilen schlecht. Kernobst verträgt Winterschnitt gut, Steinobst besser im Sommer."},
   {"label":"Je kälter, desto besser","is_correct":false,"explanation":"Genau umgekehrt."},
   {"label":"Nur bei Vollmond","is_correct":false,"explanation":"Für einen Mondeinfluss gibt es keine belastbaren Belege."},
   {"label":"Immer nach dem Austrieb","is_correct":false,"explanation":"Dann ist die Saftruhe vorbei."}]'::jsonb,
 'garden_care', 15, true, NULL, NULL, NULL),

('Warum sollte man Laub im Beet liegen lassen?',
 '[{"label":"Es schützt vor Frost und bietet Tieren Überwinterungsraum","is_correct":true,"explanation":"Igel, Laufkäfer und Schmetterlingspuppen überwintern darin. Nur auf dem Rasen sollte Laub weg, sonst erstickt er."},
   {"label":"Es düngt sofort","is_correct":false,"explanation":"Laub verrottet langsam, weil es kohlenstoffreich ist."},
   {"label":"Es vertreibt Schnecken","is_correct":false,"explanation":"Schnecken mögen feuchte Laubschichten sogar."},
   {"label":"Es hält den Boden trocken","is_correct":false,"explanation":"Laub hält Feuchtigkeit eher zurück."}]'::jsonb,
 'garden_care', 15, true, NULL, NULL, NULL),

('Was macht die Pfahlwurzel des Löwenzahns nützlich?',
 '[{"label":"Sie durchbricht Verdichtungen und holt Mineralien aus der Tiefe","is_correct":true,"explanation":"Bis zu einem Meter lang. Löwenzahn ist damit ein natürlicher Bodenlockerer — und komplett essbar."},
   {"label":"Sie speichert Wasser für Nachbarpflanzen","is_correct":false,"explanation":"Sie versorgt vor allem sich selbst."},
   {"label":"Sie bindet Stickstoff","is_correct":false,"explanation":"Das können nur Schmetterlingsblütler."},
   {"label":"Sie ist giftig für Schädlinge","is_correct":false,"explanation":"Die Wurzel ist ungiftig und essbar."}]'::jsonb,
 'wild_herbs', 15, true, NULL, NULL, NULL),

('Wie überstehen Nadelbäume Temperaturen unter minus 40 Grad?',
 '[{"label":"Sie lagern Zucker und Eiweisse als Frostschutzmittel ein","is_correct":true,"explanation":"Diese Stoffe senken den Gefrierpunkt in den Zellen. Zusätzlich entziehen sie den Zellen im Herbst gezielt Wasser."},
   {"label":"Sie heizen sich selbst auf","is_correct":false,"explanation":"Pflanzen erzeugen keine nennenswerte Eigenwärme."},
   {"label":"Ihre Nadeln sind hohl","is_correct":false,"explanation":"Nadeln sind nicht hohl."},
   {"label":"Sie stellen den Stoffwechsel komplett ein","is_correct":false,"explanation":"Ein Restbetrieb läuft weiter."}]'::jsonb,
 'trees', 15, true, NULL, NULL, NULL),

('Was bewirkt Mulchen im Sommer am meisten?',
 '[{"label":"Es hält Feuchtigkeit im Boden und unterdrückt Beikraut","is_correct":true,"explanation":"Eine Mulchschicht reduziert die Verdunstung deutlich und schützt das Bodenleben vor Hitze."},
   {"label":"Es erwärmt den Boden","is_correct":false,"explanation":"Mulch hält den Boden eher kühler."},
   {"label":"Es vertreibt Vögel","is_correct":false,"explanation":"Damit hat Mulch nichts zu tun."},
   {"label":"Es ersetzt jede Düngung","is_correct":false,"explanation":"Mulch liefert Nährstoffe nur langsam."}]'::jsonb,
 'garden_care', 10, true, NULL, NULL, NULL),

('Welcher Teil der Eibe ist NICHT giftig?',
 '[{"label":"Der rote Fruchtmantel","is_correct":true,"explanation":"Nur das fleischige Rot ist ungiftig — der Samen darin ist wieder stark giftig. Vögel fressen die Frucht und scheiden den Samen unverdaut aus."},
   {"label":"Die Nadeln","is_correct":false,"explanation":"Die Nadeln sind stark giftig."},
   {"label":"Die Rinde","is_correct":false,"explanation":"Auch die Rinde ist giftig."},
   {"label":"Alles ist ungiftig","is_correct":false,"explanation":"Die Eibe ist eine der giftigsten heimischen Pflanzen."}]'::jsonb,
 'edible_toxic', 20, true, NULL, NULL, NULL),

('Was ist Petrichor?',
 '[{"label":"Der Duft, wenn Regen auf trockenen Boden trifft","is_correct":true,"explanation":"Verursacht durch Geosmin, ein Stoffwechselprodukt von Bodenbakterien. Menschen nehmen es noch in winzigsten Mengen wahr."},
   {"label":"Ein Bodenmineral","is_correct":false,"explanation":"Es ist ein Geruch, kein Mineral."},
   {"label":"Eine Pilzkrankheit","is_correct":false,"explanation":"Petrichor ist kein Krankheitsbild."},
   {"label":"Eine Wolkenform","is_correct":false,"explanation":"Wolkenformen heissen anders."}]'::jsonb,
 'ecology', 10, true, NULL, NULL, NULL),

('Warum wachsen Alpenpflanzen so langsam?',
 '[{"label":"Kurze Vegetationszeit und extreme Bedingungen","is_correct":true,"explanation":"Ein Polster des Stengellosen Leimkrauts kann über 100 Jahre alt sein. Ein Tritt neben den Weg zerstört Jahrzehnte Wachstum."},
   {"label":"Sie haben zu wenig Licht","is_correct":false,"explanation":"Im Gebirge ist die Strahlung besonders intensiv."},
   {"label":"Der Boden ist zu nass","is_correct":false,"explanation":"Alpine Böden sind meist gut durchlässig."},
   {"label":"Sie werden zu stark beweidet","is_correct":false,"explanation":"Das ist nicht der Hauptgrund."}]'::jsonb,
 'alpine', 15, true, NULL, NULL, NULL),

('Was ist der grösste bekannte Organismus der Erde?',
 '[{"label":"Ein Hallimasch-Pilzgeflecht","is_correct":true,"explanation":"In Oregon durchzieht ein Geflecht rund 9 Quadratkilometer Waldboden. Auch Schweizer Wälder beherbergen Geflechte von mehreren Hektaren."},
   {"label":"Der Blauwal","is_correct":false,"explanation":"Der Blauwal ist das grösste Tier, aber nicht der grösste Organismus."},
   {"label":"Ein Mammutbaum","is_correct":false,"explanation":"Mammutbäume sind die massereichsten Einzelbäume, aber kleiner in der Fläche."},
   {"label":"Ein Korallenriff","is_correct":false,"explanation":"Ein Riff besteht aus vielen Einzelorganismen."}]'::jsonb,
 'ecology', 15, true, NULL, NULL, NULL),

('Wie erkennt man die Echte Kamille von der geruchlosen Hundskamille?',
 '[{"label":"Der Blütenboden ist hohl und kegelförmig","is_correct":true,"explanation":"Einfach längs durchschneiden: hohl = Echte Kamille. Zusätzlich der typische aromatische Duft."},
   {"label":"An der Blütenfarbe","is_correct":false,"explanation":"Beide sind weiss mit gelber Mitte."},
   {"label":"An der Wuchshöhe","is_correct":false,"explanation":"Die Höhe überschneidet sich stark."},
   {"label":"An der Blattform","is_correct":false,"explanation":"Beide haben fein gefiederte Blätter."}]'::jsonb,
 'medicinal', 15, true, NULL, NULL, NULL),

('Warum brauchen Vögel im Winter offenes Wasser dringender als Futter?',
 '[{"label":"Bei durchgefrorener Landschaft ist Trinkwasser der Engpass","is_correct":true,"explanation":"Eine eisfreie Tränke hilft mehr als zusätzliches Futter — Vögel brauchen Wasser auch zum Gefiederpflegen."},
   {"label":"Sie fressen im Winter nichts","is_correct":false,"explanation":"Sie fressen sogar besonders viel."},
   {"label":"Wasser wärmt sie","is_correct":false,"explanation":"Kaltes Wasser wärmt nicht."},
   {"label":"Sie brauchen kein Futter","is_correct":false,"explanation":"Futter ist wichtig, Wasser aber oft knapper."}]'::jsonb,
 'birds', 15, true, NULL, NULL, NULL)

) AS v(question, options, category, xp_reward, is_active, image_url, image_credit, image_alt)
WHERE NOT EXISTS (
  SELECT 1 FROM public.daily_quizzes q WHERE q.question = v.question
);
