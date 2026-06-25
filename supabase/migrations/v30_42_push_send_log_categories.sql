-- v30.42: Fix push_send_log CHECK constraints
-- The category constraint was missing all categories added after the initial schema:
-- heat, storm (weather-alert-checker), trial_end_* (daily-push-checker),
-- doctor_followup, class_new, class_submissions, battle_reply (engagement-push-checker).
-- These missing categories caused daily DB errors and broken push dedup for those types.

ALTER TABLE public.push_send_log
  DROP CONSTRAINT push_send_log_category_check;

ALTER TABLE public.push_send_log
  ADD CONSTRAINT push_send_log_category_check
    CHECK (category = ANY (ARRAY[
      'frost'::text, 'water'::text, 'seasonal'::text, 'quiz_streak'::text, 'test'::text,
      'heat'::text, 'storm'::text,
      'trial_end_72h'::text, 'trial_end_24h'::text, 'trial_end_1h'::text,
      'doctor_followup'::text, 'class_new'::text, 'class_submissions'::text, 'battle_reply'::text
    ]));
