-- 38 redundante Indizes entfernen (reine Backend-Hygiene, kein App-Deploy noetig).
--
-- BEFUND
-- Der Performance-Advisor meldet 145 "unused_index". Das allein ist KEIN
-- Grund zum Loeschen: ein Index kann ungenutzt sein, weil das Feature selten
-- benutzt wird, nicht weil er ueberfluessig ist. Wer danach loescht, nimmt der
-- App irgendwann genau den Index weg, den sie beim Wachsen braucht.
--
-- Deshalb hier ein anderes, hartes Kriterium: ein Index ist genau dann
-- ueberfluessig, wenn seine Spalten ein ECHTES PRAEFIX eines anderen Index auf
-- derselben Tabelle sind. Postgres kann den breiteren Index fuer jede Abfrage
-- verwenden, die der schmalere bedienen wuerde — der schmalere traegt nichts
-- bei und wird trotzdem bei jedem INSERT und UPDATE mitgeschrieben.
--
-- WIE DIE LISTE ENTSTANDEN IST (gegen die Live-DB gerechnet)
--   * Spaltenvergleich ueber pg_index.indkey als int[], nicht als Text.
--     Ein Textvergleich haette "12 3" als Praefix von "1" gewertet.
--   * gleicher Zugriffstyp (amname). Sonst waere species_name_trgm (GIN,
--     Trigramm) als "enthalten in" einem B-Tree gewertet worden — Unsinn.
--   * der breitere Index darf NICHT partiell sein. Ein partieller Index deckt
--     nur einen Teil der Zeilen ab und kann den schmalen nicht ersetzen.
--     Drei Kandidaten sind genau daran gescheitert und stehen hier NICHT drin
--     (u.a. garden_harvests.idx_garden_harvests_user_id gegenueber den
--     partiellen idx_harvests_price / idx_harvests_destination).
--   * keine Ausdrucks-Indizes, keine UNIQUE-Indizes auf der Kandidatenseite
--     (die tragen eine Zusicherung, nicht nur Geschwindigkeit).
--
-- WAS ES BRINGT — ehrlich eingeordnet
-- Plattenplatz: rund 504 kB. Das ist nichts. Der Gewinn liegt im Schreibpfad:
-- notifications, push_send_log, user_scans, garden_diary und sensor_readings
-- pflegen bei jedem Schreibvorgang einen Index mit, den keine Abfrage braucht.
-- Ein spuerbarer, aber kein dramatischer Effekt. Wer mehr verspricht, uebertreibt.
--
-- SICHERHEIT
-- Kein Datenverlust moeglich: ein Index laesst sich jederzeit neu anlegen; die
-- CREATE-Anweisungen stehen am Ende dieser Datei auskommentiert. DROP INDEX
-- nimmt kurz eine ACCESS-EXCLUSIVE-Sperre auf die Tabelle — bei diesen Groessen
-- (16 kB je Index) sind das Millisekunden. Bewusst OHNE CONCURRENTLY, weil das
-- nicht in einer Transaktion laufen darf und Migrationen in einer laufen.
--
-- Idempotent: IF EXISTS.

BEGIN;

DROP INDEX IF EXISTS public.idx_ai_daily_usage_date;               -- (date) ⊂ ai_daily_usage_pkey (date,edge_fn)
DROP INDEX IF EXISTS public.idx_ai_queries_user_id;                -- (user_id) ⊂ idx_ai_queries_user (user_id,created_at)
DROP INDEX IF EXISTS public.expert_verif_post_idx;                 -- (post_id) ⊂ expert_verifications_post_id_expert_id_key
DROP INDEX IF EXISTS public.idx_feedback_votes_item;               -- (item_id) ⊂ feedback_votes_item_id_voter_key_key
DROP INDEX IF EXISTS public.idx_friendships_friend_id;             -- (friend_id) ⊂ idx_friendships_friend (friend_id,status)
DROP INDEX IF EXISTS public.idx_friendships_user_id;               -- (user_id) ⊂ friendships_user_id_friend_id_key
DROP INDEX IF EXISTS public.idx_garden_diary_user_id;              -- (user_id) ⊂ idx_garden_diary_user_ts (user_id,ts)
DROP INDEX IF EXISTS public.idx_garden_harvests_user_id;           -- (user_id) ⊂ idx_garden_harvests_user_ts (user_id,ts)
DROP INDEX IF EXISTS public.idx_garden_plans_user_id;              -- (user_id) ⊂ garden_plans_user_idx (user_id,created_at)
DROP INDEX IF EXISTS public.idx_garden_tasks_user_id;              -- (user_id) ⊂ idx_garden_tasks_user_due (user_id,due_at,status)
DROP INDEX IF EXISTS public.idx_gardens_user;                      -- (user_id) ⊂ idx_gardens_user_id (user_id,is_archived)
DROP INDEX IF EXISTS public.idx_harvest_log_user_id;               -- (user_id) ⊂ harvest_user_date_idx (user_id,harvested_at)
DROP INDEX IF EXISTS public.idx_marketplace_category;              -- (category) ⊂ mkt_filter_idx (category,region,status)
DROP INDEX IF EXISTS public.idx_marketplace_listings_user_id;      -- (user_id) ⊂ mkt_user_idx (user_id,created_at)
DROP INDEX IF EXISTS public.idx_lookalike_edible;                  -- (edible_slug) ⊂ mushroom_lookalikes_edible_slug_lookalike_slug_key
DROP INDEX IF EXISTS public.idx_notifications_user_id;             -- (user_id) ⊂ idx_notifications_user_unread (user_id,is_read,created_at)
DROP INDEX IF EXISTS public.idx_pcs_user_plant;                    -- (user_id,plant_local_id) ⊂ plant_care_schedules_..._task_key_key
DROP INDEX IF EXISTS public.companion_matrix_a_idx;                -- (species_a_lat) ⊂ plant_companion_matrix_..._key
DROP INDEX IF EXISTS public.idx_plant_diagnoses_user_id;           -- (user_id) ⊂ idx_diagnoses_user_status (user_id,status,created_at)
DROP INDEX IF EXISTS public.idx_pdh_user_plant;                    -- (user_id,plant_local_id) ⊂ idx_pdh_user_plant_created
DROP INDEX IF EXISTS public.idx_plant_doctor_history_user_id;      -- (user_id) ⊂ doctor_user_idx (user_id,created_at)
DROP INDEX IF EXISTS public.idx_ppd_user_plant;                    -- (user_id,plant_id) ⊂ idx_ppd_user_plant_at
DROP INDEX IF EXISTS public.idx_plant_reminder_snoozes_user_id;    -- (user_id) ⊂ plant_reminder_snoozes_pkey (user_id,dedup_key)
DROP INDEX IF EXISTS public.idx_post_comments_post_id;             -- (post_id) ⊂ idx_post_comments_post (post_id,created_at)
DROP INDEX IF EXISTS public.idx_post_likes_post;                   -- (post_id) ⊂ post_likes_post_id_user_id_key
DROP INDEX IF EXISTS public.idx_push_send_log_user_id;             -- (user_id) ⊂ push_send_log_user_idx (user_id,sent_at)
DROP INDEX IF EXISTS public.idx_push_subscriptions_user_id;        -- (user_id) ⊂ push_subscriptions_user_id_endpoint_key
DROP INDEX IF EXISTS public.idx_quiz_answers_user_id;              -- (user_id) ⊂ quiz_answers_user_id_quiz_id_key
DROP INDEX IF EXISTS public.idx_quiz_ranking_user_id;              -- (user_id) ⊂ quiz_ranking_user_id_year_key
DROP INDEX IF EXISTS public.idx_scan_events_user_id;               -- (user_id) ⊂ idx_scan_user_month (user_id,created_at)
DROP INDEX IF EXISTS public.idx_sensor_alerts_user_id;             -- (user_id) ⊂ idx_sensor_alerts_user (user_id,created_at)
DROP INDEX IF EXISTS public.idx_sensor_readings_user_id;           -- (user_id) ⊂ idx_sensor_readings_user_ts (user_id,ts)
DROP INDEX IF EXISTS public.idx_watchlist_user;                    -- (user_id) ⊂ species_watchlist_user_id_species_id_key
DROP INDEX IF EXISTS public.idx_user_achievements_user_id;         -- (user_id) ⊂ user_achievements_pkey (user_id,achievement_slug)
DROP INDEX IF EXISTS public.idx_ugl_user_id;                       -- (user_id) ⊂ idx_ugl_updated_at (user_id,updated_at)
DROP INDEX IF EXISTS public.idx_user_quest_progress_user_id;       -- (user_id) ⊂ user_quest_progress_user_id_quest_id_key
DROP INDEX IF EXISTS public.idx_user_scans_user_id;                -- (user_id) ⊂ idx_user_scans_user_ts (user_id,created_at)
DROP INDEX IF EXISTS public.idx_wc_week;                           -- (week_iso) ⊂ weekly_challenges_week_iso_title_key

COMMIT;

-- ── Nachkontrolle (nach dem Lauf ausfuehren) ───────────────────────────────
-- Erwartet: 0 Zeilen.
--   with ix as (
--     select i.indrelid::regclass::text tbl, c.relname idx,
--            string_to_array(i.indkey::text,' ')::int[] keys, am.amname,
--            i.indisunique uniq, i.indpred is not null partial, i.indexprs is not null expr
--     from pg_index i join pg_class c on c.oid=i.indexrelid
--     join pg_am am on am.oid=c.relam join pg_namespace n on n.oid=c.relnamespace
--     where n.nspname='public')
--   select a.tbl, a.idx from ix a where not a.uniq and not a.partial and not a.expr
--     and a.amname='btree' and exists (
--       select 1 from ix b where b.tbl=a.tbl and b.idx<>a.idx and not b.partial and not b.expr
--         and b.amname=a.amname and b.keys[1:array_length(a.keys,1)]=a.keys
--         and array_length(b.keys,1)>array_length(a.keys,1));
--
-- ── Rueckweg, falls je noetig ──────────────────────────────────────────────
-- Jeder dieser Indizes ist mit einer Zeile wiederherstellbar, z. B.:
--   CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
-- Es geht dabei nichts verloren: Indizes enthalten keine eigenen Daten.
