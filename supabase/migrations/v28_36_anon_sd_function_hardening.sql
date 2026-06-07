-- ============================================================================
-- v28_36_anon_sd_function_hardening — Self-Audit-Sprint 2026-06-07
--
-- 35 SECURITY DEFINER functions were callable by anon via PostgREST.
-- The frontend guards all calls with sbIsLoggedIn(), but direct REST callers
-- bypass this — e.g., anyone could POST /rest/v1/rpc/fn_get_global_api_key
-- and receive the admin Anthropic API key with zero authentication.
--
-- Two critical findings:
--   fn_get_global_api_key — returns admin API key to anonymous callers
--   gs_abo_webhook       — Stripe webhook handler; anon can forge sub events
--
-- Pattern analogous to v26.51b (admin functions) and v26.94 (knowledge RPCs).
-- Supabase ALTER DEFAULT PRIVILEGES auto-grants EXECUTE to anon on new functions;
-- explicit REVOKE is required to enforce least-privilege.
-- ============================================================================

-- ============================================================
-- TIER 1: Trigger / Cron / Service-Only functions
-- Should never be invoked as direct RPCs by any user.
-- REVOKE anon + authenticated; GRANT service_role explicitly.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.fn_generate_plant_reminders()                                                               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_handle_new_user()                                                                        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                                                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify_friend_request()                                                                  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_snapshot_author_role()                                                                   FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_lifetime_to_profile()                                                               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_species_proposals_updated_at()                                                          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_growth_daily()                                                                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_marketplace_auto_archive()                                                               FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_push_already_sent_today(uuid, text)                                                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gs_abo_webhook(text, text, jsonb)                                                           FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_log_ai_usage(text, integer, integer, numeric)                                            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_quest_track_post()                                                                       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_quest_track_scan()                                                                       FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fn_generate_plant_reminders()                                                                TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_handle_new_user()                                                                         TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user()                                                                            TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_notify_friend_request()                                                                   TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_snapshot_author_role()                                                                    TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_sync_lifetime_to_profile()                                                                TO service_role;
GRANT EXECUTE ON FUNCTION public.set_species_proposals_updated_at()                                                           TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_growth_daily()                                                                  TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_marketplace_auto_archive()                                                                TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_push_already_sent_today(uuid, text)                                                       TO service_role;
GRANT EXECUTE ON FUNCTION public.gs_abo_webhook(text, text, jsonb)                                                            TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_log_ai_usage(text, integer, integer, numeric)                                             TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_quest_track_post()                                                                        TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_quest_track_scan()                                                                        TO service_role;

-- ============================================================
-- TIER 2: User-facing RPCs — REVOKE anon only
-- Authenticated users legitimately call these from the frontend.
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.fn_get_global_api_key()                                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_global_api_status()                                                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_check_not_banned()                                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_check_rate_limit(text, text, integer)                                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_create_notification(uuid, text, text, text, text, text)                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_is_role(text, uuid)                                                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_role_at_least(text, uuid)                                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_user_role(uuid)                                                                          FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_is_org_member(uuid)                                                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_is_class_member(uuid)                                                                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_org_role(uuid)                                                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_assignment_org_role(uuid)                                                                FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_class_org_role(uuid)                                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_marketplace_set_status(uuid, text)                                                       FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_grow(text, integer)                                                            FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_photo_diff_create(text, text, text, timestamp with time zone, timestamp with time zone, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_photo_diff_list(text, integer)                                                           FROM anon;
REVOKE EXECUTE ON FUNCTION public.fn_quest_increment(uuid, text, integer)                                                     FROM anon;
REVOKE EXECUTE ON FUNCTION public.gs_abo_can_use(uuid, text)                                                                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.scans_this_month(uuid)                                                                      FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_post_like(uuid, uuid)                                                                FROM anon;
