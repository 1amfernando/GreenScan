-- ============================================================================
-- v28_58_collections_system_key — Spiegel der LIVE-Migration (Block C).
-- Auto-Vacuum-System-Sammlungen: system_key markiert automatisch verwaltete
-- Sammlungen (NULL = manuelle User-Sammlung). Der Frontend-Vacuum
-- (gsCollectionsAutoVacuum) fasst NUR Sammlungen mit system_key IS NOT NULL an
-- — manuelle Sammlungen werden NIE angefasst (Daten-Sicherheit).
-- Partial-Unique-Index: pro User max. 1 System-Sammlung je system_key.
-- View v_user_collections um system_key erweitert (security_invoker, owner-only via RLS).
-- Verifiziert: col_exists=1, idx_exists=1, view_has_key=1.
-- ============================================================================
ALTER TABLE public.user_collections ADD COLUMN IF NOT EXISTS system_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_collections_system
  ON public.user_collections(user_id, system_key) WHERE system_key IS NOT NULL;

CREATE OR REPLACE VIEW public.v_user_collections WITH (security_invoker = on) AS
SELECT c.id, c.user_id, c.name, c.emoji, c.color, c.sort_order, c.created_at, c.updated_at,
  (SELECT count(*) FROM public.user_collection_items ci WHERE ci.collection_id = c.id) AS item_count,
  c.system_key
FROM public.user_collections c;
