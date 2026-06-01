-- v26.71 Karten-Fund-Speicher (Master-Auftrag #10)
-- User markiert Fund auf Karte (Pilz, Pflanze, Baum, Kraut, sonstiges) mit Standort,
-- Zeit, Bild, Notiz. Optional Community-share.

CREATE TABLE IF NOT EXISTS public.map_user_finds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  species_id text,
  species_name text NOT NULL,
  category text CHECK (category IN ('pilz','pflanze','baum','kraut','sonstiges')),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  accuracy_m integer,
  altitude_m integer,
  found_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (char_length(note) <= 1000),
  photo_url text,
  weather_condition text,
  edible_confirmed boolean,
  quantity_estimate text CHECK (quantity_estimate IN ('einzeln','mehrere','massenhaft') OR quantity_estimate IS NULL),
  is_private boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_user_finds_user_time
  ON public.map_user_finds (user_id, found_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_user_finds_geo
  ON public.map_user_finds (lat, lng);
CREATE INDEX IF NOT EXISTS idx_map_user_finds_species
  ON public.map_user_finds (species_name);
CREATE INDEX IF NOT EXISTS idx_map_user_finds_category
  ON public.map_user_finds (category, found_at DESC);
CREATE INDEX IF NOT EXISTS idx_map_user_finds_community
  ON public.map_user_finds (found_at DESC) WHERE is_private = false;

ALTER TABLE public.map_user_finds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own finds" ON public.map_user_finds;
CREATE POLICY "users see own finds" ON public.map_user_finds
  FOR SELECT USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "community sees public finds" ON public.map_user_finds;
CREATE POLICY "community sees public finds" ON public.map_user_finds
  FOR SELECT USING (is_private = false);

DROP POLICY IF EXISTS "users insert own finds" ON public.map_user_finds;
CREATE POLICY "users insert own finds" ON public.map_user_finds
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users update own finds" ON public.map_user_finds;
CREATE POLICY "users update own finds" ON public.map_user_finds
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "users delete own finds" ON public.map_user_finds;
CREATE POLICY "users delete own finds" ON public.map_user_finds
  FOR DELETE USING (user_id = (SELECT auth.uid()));

COMMENT ON TABLE public.map_user_finds IS
  'v26.71: User-Funde auf der Karte mit Standort+Zeit+Notiz+Bild. is_private=true (default) → nur User selbst sieht. is_private=false → Community-Heatmap.';

-- Storage-Bucket für Fund-Fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('map-find-photos', 'map-find-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage-Policies (Folder-Pattern uid/file — User darf nur eigenen Folder schreiben)
DROP POLICY IF EXISTS "users upload own find photos" ON storage.objects;
CREATE POLICY "users upload own find photos" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'map-find-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "users update own find photos" ON storage.objects;
CREATE POLICY "users update own find photos" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'map-find-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "users delete own find photos" ON storage.objects;
CREATE POLICY "users delete own find photos" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'map-find-photos'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "anyone reads map-find-photos" ON storage.objects;
CREATE POLICY "anyone reads map-find-photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'map-find-photos');
