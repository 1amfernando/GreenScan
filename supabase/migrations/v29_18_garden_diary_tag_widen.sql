-- ============ v29.18 SCHEMA-01: garden_diary_tag_check auf Frontend-Vokabular erweitern ============
-- (Backend-Teil von Block-G-Audit; Frontend bekam den v-Bump.) Full-Stack-Audit-Fund SCHEMA-01 (P1, Datenverlust):
-- Das Frontend schreibt Tagebuch-tags general/pest/disease/harvest/sowing/fertilization/pruning/watering/
-- medicinal/seeds/flowering — die DB-CHECK garden_diary_tag_check erlaubte aber NUR saat/pflanz/duenge/giess/
-- ernt/pflege/beob/sonstig. KEIN einziger FE-Wert war erlaubt → jeder Tagebuch-Eintrag scheiterte silent mit
-- 23514 (check_violation), garden_diary hatte 0 Zeilen seit Anlage (UI lebte nur vom Pflanzen-Blob).
-- Per echtem Admin-JWT verifiziert (INSERT → 23514). Kein RPC/View liest garden_diary.tag (pg_proc-Scan leer)
-- → Widening risikofrei. Legacy-DE-Werte bleiben gültig.
ALTER TABLE public.garden_diary DROP CONSTRAINT IF EXISTS garden_diary_tag_check;
ALTER TABLE public.garden_diary ADD CONSTRAINT garden_diary_tag_check
  CHECK (tag IS NULL OR tag = ANY (ARRAY[
    'general','pest','disease','harvest','sowing','fertilization','pruning','watering','medicinal','seeds','flowering',
    'saat','pflanz','duenge','giess','ernt','pflege','beob','sonstig'
  ]));
