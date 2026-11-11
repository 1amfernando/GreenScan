// Momentaufnahme der LIVE-Datenbank fuer die Attrappe _zahlung_supabase.mjs (v33.59).
// Gelesen 10.11.2026, nur lesend (information_schema.columns, pg_constraint contype='f').
// Nur die Relationen, die supabase/functions/** mit .from('…') anspricht, und die
// Fremdschluessel zwischen public-Tabellen, an denen eine davon haengt. Anlass: die
// Einbettung stripe_products(tier) war im Pruefstand gruen, weil die Attrappe JEDE
// Einbettung beantwortete — live gibt es den Fremdschluessel nicht (PGRST200, d1 #1).
// Wer eine Tabelle/Spalte per Migration anlegt, die eine Function schon liest, traegt
// sie NICHT hier ein: hier steht, was live IST. Nicht live: brain_memory, device_commands, device_readings, devices, metric_catalog
export const STAND = '2026-11-10';
export const SPALTEN = {
  "ai_usage": ["id", "user_id", "day", "model", "tokens_in", "tokens_out", "created_at"],
  "app_settings": ["key", "value", "description", "updated_at", "updated_by"],
  "app_status": ["key", "status", "message", "last_check_at"],
  "audit_log": ["id", "actor_id", "action", "target_type", "target_id", "diff", "ip_hash", "created_at"],
  "climate_scenarios_ch": ["region", "scenario", "avg_temp_delta_c", "avg_precip_delta_pct", "frost_days_delta", "summary", "updated_at"],
  "daily_quizzes": ["id", "day_key", "question", "options", "category", "xp_reward", "is_active", "created_at"],
  "expert_verifications": ["id", "post_id", "expert_id", "status", "verification_text", "fee_paid_chf", "fee_paid_at", "stripe_payment_intent_id", "created_at", "updated_at"],
  "garden_birds_register": ["id", "slug", "common_name_de", "common_name_fr", "common_name_it", "scientific_name", "family", "size_cm", "weight_g", "status_in_ch", "food_preferences", "nesting_location", "preferred_plants", "birdhouse_type", "feeder_seeds", "active_months", "song_description", "best_observation_time", "red_list_status", "attracting_tips", "threats", "fun_fact", "source", "created_at", "updated_at"],
  "garden_plans": ["id", "user_id", "garden_id", "title", "scan_input", "ai_analysis", "layout_svg", "layout_3d_data", "status", "iterations", "starred", "created_at", "updated_at", "planning_horizon_years", "climate_scenario", "constraints", "plan_version", "yearly_outputs", "what_if_runs", "plan_type", "summary"],
  "garden_tasks_catalog": ["id", "slug", "task_type", "title", "description", "month_start", "month_end", "applies_to", "difficulty", "duration_min", "tools_needed", "weather_constraints", "emoji", "importance", "data", "created_at"],
  "i18n_translations": ["id", "source_lang", "target_lang", "source_text", "source_hash", "translated_text", "context_note", "model", "tokens_in", "tokens_out", "created_at"],
  "launch_offer_usage": ["user_id", "subscription_id", "claimed_at"],
  "marketplace_listings": ["id", "user_id", "title", "description", "category", "price", "currency", "region", "photo_url", "status", "views", "data", "created_at", "updated_at", "contact", "photo_urls", "price_mode", "reports", "organic_certified", "pesticide_free", "certification_label", "allow_online_payment", "contact_method", "contact_email", "contact_phone", "sold_at", "moderation_status"],
  "marketplace_sellers": ["user_id", "stripe_account_id", "status", "charges_enabled", "payouts_enabled", "details_submitted", "requirements", "country", "default_currency", "business_type", "display_name", "created_at", "updated_at"],
  "mushroom_lookalikes": ["id", "edible_slug", "lookalike_slug", "confusion_risk", "key_differences", "visual_differences", "smell_differences", "habitat_differences", "spore_print_differences", "pro_tip", "source", "created_at", "updated_at"],
  "mushroom_register": ["id", "slug", "common_name_de", "common_name_fr", "common_name_it", "scientific_name", "family", "edibility", "vapko_klasse", "habitat", "symbiosis_partners", "cap_diameter_cm_min", "cap_diameter_cm_max", "cap_color", "cap_surface", "gills_or_pores", "gill_color", "spore_color", "stem_color", "stem_height_cm", "flesh_color", "smell", "taste", "identifying_features", "toxic_compounds", "symptoms_if_toxic", "emergency_action", "cooking_preparation", "conservation_methods", "swiss_distribution", "season_months", "altitude_m_min", "altitude_m_max", "protected_status", "cultural_notes", "source", "created_at", "updated_at"],
  "mushroom_seasonal_patches": ["id", "slug", "region_canton_codes", "altitude_m_min", "altitude_m_max", "forest_type", "typical_mushrooms", "best_months", "weather_trigger", "difficulty_to_find", "notes", "vapko_kontrollstelle", "vapko_phone", "vapko_link", "source", "created_at", "updated_at"],
  "notifications": ["id", "user_id", "kind", "title", "body", "link", "dedup_key", "is_read", "read_at", "created_at"],
  "organizations": ["id", "slug", "name", "org_type", "country", "bio", "logo_url", "website", "primary_color", "created_by", "subscription_tier", "max_members", "is_active", "created_at", "updated_at"],
  "plant_companion_matrix": ["id", "species_a_lat", "species_b_lat", "relationship", "reason", "effect_on_a", "effect_on_b", "source", "confidence", "created_at"],
  "plant_diseases": ["id", "slug", "name", "scientific_name", "category", "severity", "symptoms_de", "symptoms_visual", "affected_parts", "affected_species_lat", "treatment_organic", "treatment_chemical", "prevention", "spread_method", "optimal_conditions", "emoji", "warning", "data", "created_at", "updated_at"],
  "plant_doctor_history": ["id", "user_id", "garden_id", "plant_local_id", "species_lat", "photo_url", "symptoms", "user_note", "ai_diagnosis", "treatment_plan", "user_followup", "followup_at", "model", "tokens_in", "tokens_out", "created_at", "species_name", "status", "followup_due_at", "followup_result", "updated_at"],
  "plant_pests": ["id", "slug", "common_name_de", "common_name_fr", "common_name_it", "scientific_name", "category", "size_mm", "body_color", "affected_parts", "symptoms", "identification_tips", "damage_severity", "active_season", "host_plants", "natural_enemies", "treatment_organic", "treatment_chemical", "prevention", "image_url", "source", "created_at", "updated_at"],
  "pollinators": ["id", "slug", "name", "scientific_name", "category", "emoji", "description", "habitat", "active_months", "preferred_flowers", "preferred_colors", "conservation_status", "ecological_value", "swiss_native", "data", "created_at", "updated_at"],
  "profiles": ["id", "email", "display_name", "avatar_emoji", "bio", "xp", "level", "login_streak", "longest_streak", "total_logins", "last_login", "stats", "milestones", "tier", "is_expert", "is_admin", "created_at", "updated_at", "role", "role_assigned_at", "role_assigned_by", "role_note", "scan_count", "last_scan_at", "is_lifetime", "showcase_achievements", "opt_in_achievement_feed", "quiz_elo", "battles_won", "battles_lost", "battles_tied", "avatar_url", "profile_visibility", "show_finds_public", "show_plants_count", "show_achievements", "show_marketplace", "opt_in_feed", "region", "bio_emoji", "comp_tier", "comp_expires_at", "comp_granted_by", "comp_granted_at"],
  "push_send_log": ["id", "user_id", "category", "title", "body", "payload_meta", "result", "http_status", "error_msg", "sent_at"],
  "push_subscriptions": ["id", "user_id", "endpoint", "p256dh", "auth_secret", "user_agent", "created_at", "gps_lat", "gps_lng", "notify_frost", "notify_water", "notify_seasonal", "notify_quiz_streak", "quiet_start_hour", "quiet_end_hour", "last_push_sent_at", "push_failure_count", "updated_at", "notify_heat", "notify_storm", "alert_lead_hours", "pause_until", "notify_classes", "notify_doctor", "notify_battle"],
  "regional_garden_calendars": ["id", "slug", "region_name", "canton_codes", "climate_zone", "altitude_m_min", "altitude_m_max", "last_frost_avg", "first_frost_avg", "growing_season_days", "rainfall_mm_year", "january_tasks", "february_tasks", "march_tasks", "april_tasks", "may_tasks", "june_tasks", "july_tasks", "august_tasks", "september_tasks", "october_tasks", "november_tasks", "december_tasks", "best_vegetables", "challenging_plants", "notes", "source", "created_at", "updated_at"],
  "social_posts": ["id", "user_id", "author_name", "author_avatar", "content", "category", "plant_name", "photo_url", "likes", "comments_count", "is_featured", "is_archived", "created_at", "role"],
  "stripe_prices": ["id", "product_id", "lookup_key", "currency", "unit_amount", "recurring", "active", "metadata", "updated_at"],
  "stripe_products": ["id", "name", "description", "active", "tier", "metadata", "created_at", "updated_at"],
  "stripe_subscriptions": ["id", "user_id", "customer_id", "status", "price_id", "current_period_end", "cancel_at_period_end", "metadata", "created_at", "updated_at", "is_lifetime", "tier", "trial_end", "canceled_at", "ended_at", "current_period_start", "stripe_customer_id"],
  "stripe_webhook_events": ["id", "type", "payload", "processed", "error", "created_at", "processed_at"],
  "system_events": ["id", "severity", "source", "event", "detail", "created_at"],
  "v_mushroom_safety": ["slug", "common_name_de", "scientific_name", "edibility", "vapko_klasse", "safety_advice", "safety_color"],
  "v_plant_tasks_due": ["user_id", "plant_id", "plant_name", "emoji", "task_key", "interval_days", "last_done", "next_due_at", "is_due_now", "task_label"],
  "v_user_entitlements": ["user_id", "tier", "scans_per_month", "ai_herbalist", "offline_mode", "recipes_export", "community_post", "unlimited_plants", "is_admin", "is_lifetime", "role"],
  "weather_alerts": ["id", "user_id", "alert_type", "severity", "title", "body", "min_temp_c", "max_temp_c", "metric", "valid_from", "valid_until", "location_lat", "location_lng", "pushed", "acknowledged", "dismissed", "created_at"],
  "weather_forecast_cache": ["grid_key", "lat", "lng", "payload", "fetched_at"],
};
// [tabelle, spalte(n), zieltabelle, zielspalte(n)]
export const BEZIEHUNGEN = [
  ["daily_quiz_history", "question_id", "daily_quizzes", "id"],
  ["expert_verifications", "post_id", "social_posts", "id"],
  ["garden_diary", "pest_slug", "plant_pests", "slug"],
  ["marketplace_messages", "listing_id", "marketplace_listings", "id"],
  ["mushroom_growth_conditions", "slug", "mushroom_register", "slug"],
  ["mushroom_lookalikes", "edible_slug", "mushroom_register", "slug"],
  ["mushroom_lookalikes", "lookalike_slug", "mushroom_register", "slug"],
  ["mushroom_lookalikes_i18n", "edible_slug, lookalike_slug", "mushroom_lookalikes", "edible_slug, lookalike_slug"],
  ["mushroom_register_i18n", "slug", "mushroom_register", "slug"],
  ["org_classes", "org_id", "organizations", "id"],
  ["org_invites", "org_id", "organizations", "id"],
  ["org_members", "org_id", "organizations", "id"],
  ["plant_treatment_steps", "diagnosis_id", "plant_doctor_history", "id"],
  ["post_comments", "post_id", "social_posts", "id"],
  ["post_likes", "post_id", "social_posts", "id"],
  ["quiz_answers", "quiz_id", "daily_quizzes", "id"],
  ["stripe_subscriptions", "price_id", "stripe_prices", "id"],
];
// Tabellen mit einem BEFORE-UPDATE-Trigger, der NEW.updated_at = now() setzt
// (fn_touch_updated_at / touch_updated_at / set_updated_at, live/triggers.json):
// ein Wert, den die Function fuer updated_at schickt, kommt bei einem UPDATE nie an.
export const UPDATED_AT_TRIGGER = ['app_settings', 'garden_birds_register', 'garden_plans', 'marketplace_listings', 'marketplace_sellers', 'mushroom_lookalikes', 'mushroom_register', 'mushroom_seasonal_patches', 'plant_pests', 'profiles', 'regional_garden_calendars', 'stripe_prices', 'stripe_products', 'stripe_subscriptions'];
