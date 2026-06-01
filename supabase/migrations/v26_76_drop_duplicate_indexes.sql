-- v26.76 — Duplicate-Index/Constraint-Bereinigung (Advisor: duplicate_index)
-- Jeweils das redundante Objekt droppen, das funktional identische behalten.

-- ai_daily_usage: UNIQUE(date,edgefn) doppelt zur Primary Key
DROP INDEX IF EXISTS public.ai_daily_usage_date_edgefn_uniq;

-- marketplace_messages: _listing dupliziert _listing_time (breiter, behalten)
DROP INDEX IF EXISTS public.idx_marketplace_messages_listing;

-- quiz_ranking: UNIQUE(user,year) doppelt zum _user_id_year_key
ALTER TABLE public.quiz_ranking DROP CONSTRAINT IF EXISTS quiz_ranking_user_year_uniq;
