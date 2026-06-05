-- ============================================================================
-- v28_24_collections — Spiegel der LIVE-Migration.
-- Schritt 2 des intelligenten Ordner-Systems: Smart-Sammlungen (eigene Ordner für beliebige
-- Inhalte). 2 Tabellen + owner-only RLS (single FOR-ALL-Policy) + View mit item_count.
-- REST+RLS statt RPCs. Transaktional verifiziert (A: Sammlung+Item, item_count=1; B: 0 — isoliert).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  emoji text DEFAULT '📁',
  color text,
  sort_order int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_collections_user ON public.user_collections(user_id, sort_order);
ALTER TABLE public.user_collections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_collections_owner_all ON public.user_collections;
CREATE POLICY user_collections_owner_all ON public.user_collections FOR ALL TO public
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE TABLE IF NOT EXISTS public.user_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.user_collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('plant','species','find','listing','recipe','scan')),
  item_ref text NOT NULL,
  label text,
  emoji text,
  added_at timestamptz DEFAULT now(),
  UNIQUE (collection_id, item_type, item_ref)
);
CREATE INDEX IF NOT EXISTS idx_uci_collection ON public.user_collection_items(collection_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_uci_user_item ON public.user_collection_items(user_id, item_type, item_ref);
ALTER TABLE public.user_collection_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uci_owner_all ON public.user_collection_items;
CREATE POLICY uci_owner_all ON public.user_collection_items FOR ALL TO public
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));

CREATE OR REPLACE VIEW public.v_user_collections WITH (security_invoker = on) AS
SELECT c.id, c.user_id, c.name, c.emoji, c.color, c.sort_order, c.created_at, c.updated_at,
  (SELECT count(*) FROM public.user_collection_items ci WHERE ci.collection_id = c.id) AS item_count
FROM public.user_collections c;
