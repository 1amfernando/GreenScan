-- v26.76 — legacy_* Tabellen DROP (CASCADE)
--
-- ⚠️ KORREKTUR eines gefährlichen Audit-Findings: BACKEND_FRONTEND_MAP nannte
-- die legacy_*-Tabellen "safe drops". Tatsächlich sind sie FK-PARENTS von ~12
-- aktiven Tabellen. Der DROP ist NUR sicher, weil ALLE FK-Child-Tabellen 0 Rows
-- haben — verifiziert vor diesem Migrationslauf. Der DROP behebt sogar latente
-- kaputte FKs: einige Child-FKs zeigten auf den FALSCHEN legacy-Parent und
-- hätten echte User-Inserts blockiert.
--
-- Reihenfolge: ZUERST delete-user Edge-Function auf v4 redeployen (entfernt den
-- legacy_profiles-Delete-Block), DANN diese Migration.
--
-- Sanity vor DROP:
--   SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname LIKE 'legacy_%';
--   → alle Replacement-Tabellen tragen die Daten, alle 12 FK-Children = 0 Rows.

DROP TABLE IF EXISTS public.legacy_user_scans        CASCADE;
DROP TABLE IF EXISTS public.legacy_species           CASCADE;
DROP TABLE IF EXISTS public.legacy_did_you_know_facts CASCADE;
DROP TABLE IF EXISTS public.legacy_daily_quizzes     CASCADE;
DROP TABLE IF EXISTS public.legacy_profiles          CASCADE;
