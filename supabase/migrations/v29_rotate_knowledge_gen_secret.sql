-- ============ Secret-Rotation: knowledge-bulk-gen ADMIN_SECRET aus dem public Repo entfernen ============
-- (Backend-only, kein App-v-Bump.) HL#19 — der hardcodierte `ADMIN_SECRET=a217d1a3…` war in 4 Edge-Fn-
-- Sources UND hier in fn_knowledge_growth_daily() hardcodiert, alle nach github.com/1amfernando/GreenScan
-- (public) gespiegelt → öffentlich lesbar → das einzige Gate von knowledge-bulk-gen (Anthropic-Cost)
-- kompromittiert. Fernando-Entscheidung 11.06.2026: „Anthropic-Pfad jetzt rotieren".
--
-- Fix: Neuer Secret wird in app_settings.knowledge_gen_secret abgelegt (NICHT im Repo — key nicht im
-- SELECT-Whitelist → nur admin/service-role lesbar, anon/normale User nie). Die Cron-Funktion liest ihn
-- zur Laufzeit; die Edge-Fn knowledge-bulk-gen (v13) vergleicht den X-Admin-Secret-Header dagegen.
-- Verifiziert: alter öffentlicher Secret → 403, neuer Secret → Gate passiert, kein Secret → 403.
--
-- WICHTIG: Diese Migration enthält den Secret-WERT NICHT. Er wurde einmalig per
--   INSERT INTO app_settings(key,value) VALUES('knowledge_gen_secret', <gen_random_uuid x2 hex>)
--   ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
-- gesetzt und ist nur in der DB. Bei erneuter Rotation einfach diesen einen Row updaten.

CREATE OR REPLACE FUNCTION public.fn_knowledge_growth_daily()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  topics text[] := ARRAY[
    'recipes','remedies','folk_lore','garden_techniques',
    'did_you_know_facts','seasonal_tips','daily_quizzes',
    'plant_diseases','pollinators','garden_tasks_catalog',
    'plant_companion_matrix','achievements',
    'swiss_climate_zones','garden_problems',
    'harvest_preservation','seed_starting_calendar',
    'seasonal_highlights','plant_pests',
    'compost_recipes','propagation_methods',
    'soil_amendments','pest_companion_plants','medicinal_plants_register',
    'fertilization_schedules','seed_saving_methods','garden_layouts',
    'mushroom_register','traditional_garden_wisdom',
    'water_features','mushroom_recipes','garden_birds_register',
    'alpine_garden_plants','forest_garden_design',
    'indoor_houseplants','urban_balcony_design'
  ];
  topic_today text;
  day_index int;
  v_secret text;
BEGIN
  day_index := (EXTRACT(DOY FROM CURRENT_DATE)::int - 1) % cardinality(topics);
  topic_today := topics[day_index + 1];
  -- HL#19: Secret aus app_settings statt hardcoded (war im public Repo lesbar).
  SELECT value INTO v_secret FROM app_settings WHERE key = 'knowledge_gen_secret';

  PERFORM net.http_post(
    url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/knowledge-bulk-gen',
    body := jsonb_build_object('topic', topic_today, 'count', 12),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Secret', v_secret
    ),
    timeout_milliseconds := 50000
  );

  INSERT INTO audit_log (actor_id, action, target_type, target_id, diff)
  VALUES (NULL, 'knowledge_growth_daily', 'edge_function', topic_today,
          jsonb_build_object('topic', topic_today, 'triggered_at', now()));
END;
$function$;
