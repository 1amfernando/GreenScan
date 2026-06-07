-- ============================================================================
-- v28_36b_public_grant_revoke — Self-Audit-Sprint 2026-06-07 (Part 2)
--
-- v28_36 revoked anon/authenticated but the functions still had GRANT TO PUBLIC,
-- which overrides those revokes (anon inherits from PUBLIC).
-- This migration REVOKEs from PUBLIC, then re-GRANTs authenticated for the
-- Tier-2 (user-facing) RPCs that the frontend legitimately calls when logged in.
-- ============================================================================

-- ============================================================
-- TIER 1 functions: REVOKE PUBLIC → service_role only (granted in v28_36)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.fn_generate_plant_reminders()                                                               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_handle_new_user()                                                                        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                                                                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_notify_friend_request()                                                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_snapshot_author_role()                                                                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_sync_lifetime_to_profile()                                                               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_species_proposals_updated_at()                                                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_growth_daily()                                                                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_marketplace_auto_archive()                                                               FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gs_abo_webhook(text, text, jsonb)                                                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_quest_track_post()                                                                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_quest_track_scan()                                                                       FROM PUBLIC;

-- ============================================================
-- TIER 2 functions: REVOKE PUBLIC → re-GRANT authenticated explicitly
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.fn_get_global_api_key()                                                                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_global_api_status()                                                                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_check_not_banned()                                                                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_check_rate_limit(text, text, integer)                                                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_create_notification(uuid, text, text, text, text, text)                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_is_role(text, uuid)                                                                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_role_at_least(text, uuid)                                                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_user_role(uuid)                                                                          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_is_org_member(uuid)                                                                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_is_class_member(uuid)                                                                    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_org_role(uuid)                                                                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_assignment_org_role(uuid)                                                                FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_class_org_role(uuid)                                                                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_marketplace_set_status(uuid, text)                                                       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_knowledge_grow(text, integer)                                                            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_photo_diff_create(text, text, text, timestamp with time zone, timestamp with time zone, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_photo_diff_list(text, integer)                                                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_quest_increment(uuid, text, integer)                                                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gs_abo_can_use(uuid, text)                                                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.scans_this_month(uuid)                                                                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.toggle_post_like(uuid, uuid)                                                                FROM PUBLIC;

-- Re-grant authenticated for Tier 2 (user-facing RPCs the frontend calls)
GRANT EXECUTE ON FUNCTION public.fn_get_global_api_key()                                                                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_global_api_status()                                                                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_not_banned()                                                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_check_rate_limit(text, text, integer)                                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_create_notification(uuid, text, text, text, text, text)                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_role(text, uuid)                                                                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_role_at_least(text, uuid)                                                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_user_role(uuid)                                                                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_org_member(uuid)                                                                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_is_class_member(uuid)                                                                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_org_role(uuid)                                                                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assignment_org_role(uuid)                                                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_class_org_role(uuid)                                                                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_marketplace_set_status(uuid, text)                                                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_knowledge_grow(text, integer)                                                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_photo_diff_create(text, text, text, timestamp with time zone, timestamp with time zone, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_photo_diff_list(text, integer)                                                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_quest_increment(uuid, text, integer)                                                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.gs_abo_can_use(uuid, text)                                                                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.scans_this_month(uuid)                                                                       TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_post_like(uuid, uuid)                                                                 TO authenticated;
