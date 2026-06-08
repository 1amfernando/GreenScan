-- ============================================================================
-- v28_66_collection_items_allow_plan — Block F.3: item_type 'plan' erlauben (LIVE-Spiegel).
-- Voraussetzung für die System-Sammlung „Garten-Pläne" (sys_plans): die Auto-Vacuum-
-- Engine trägt Pläne als user_collection_items mit item_type='plan' ein.
-- Vorher erlaubte die CHECK nur plant/species/find/listing/recipe/scan → INSERT 400.
-- Sichere Verbreiterung — kein Bestand verletzt die neue Constraint.
-- ============================================================================
ALTER TABLE public.user_collection_items DROP CONSTRAINT IF EXISTS user_collection_items_item_type_check;
ALTER TABLE public.user_collection_items ADD CONSTRAINT user_collection_items_item_type_check
  CHECK (item_type = ANY (ARRAY['plant'::text,'species'::text,'find'::text,'listing'::text,'recipe'::text,'scan'::text,'plan'::text]));
