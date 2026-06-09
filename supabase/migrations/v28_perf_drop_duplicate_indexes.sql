-- v28 Perf (deferred-by-design Sprint, 2026-06-10): 8 exakte Duplikat-Indizes droppen.
-- Jeweils bleibt der UNIQUE/PK-Constraint-Index erhalten; der redundante Plain-Index
-- (gleiche Spalte, gleicher btree) wird entfernt -> 0 Query-Plan-Verlust, weniger
-- Write-Overhead + Storage. DROP INDEX errort von selbst, falls je ein Constraint-Index
-- erwischt wuerde (Self-Protect). Backend-only, kein App-Bump.
-- Verifiziert via pg_index-Duplikat-Query (gleiche indrelid + gleiche Spalten-Def).
DROP INDEX IF EXISTS public.ar_models_species_idx;            -- dup zu ar_models_species_lat_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_ocr_job_page;                 -- dup zu book_ocr_pages_job_id_page_number_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_launch_offer_user;            -- dup zu launch_offer_usage_pkey (PK)
DROP INDEX IF EXISTS public.idx_marketplace_sellers_stripe;   -- dup zu marketplace_sellers_stripe_account_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_profiles_email;               -- dup zu profiles_email_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_sensor_devices_token;         -- dup zu sensor_devices_device_token_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_user_gardens_user_id;         -- dup zu user_gardens_user_id_key (UNIQUE)
DROP INDEX IF EXISTS public.idx_user_plants_user_id;          -- dup zu user_plants_user_id_key (UNIQUE)
