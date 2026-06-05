-- ============================================================================
-- v28_23_plant_dossier — Spiegel der LIVE-Migration.
-- Schritt 1 des intelligenten Ordner-/Verdrahtungs-Systems: Auto-Dossier pro Pflanze.
-- fn_plant_dossier sammelt serverseitig ALLE pflanzen-bezogenen Inhalte (Ernten/Diagnosen/
-- Foto-Diffs/Scans) zu EINER Pflanze — verknüpft per plant_local_id (direkt) sonst per
-- species_lat/species_name (fuzzy). SECURITY DEFINER + own-only (auth.uid intern) + REVOKE/GRANT.
-- Transaktional verifiziert (A: harvest+diag direkt + fuzzy-species-Match; B: 0 — RLS-isoliert).
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pdh_user_plant    ON public.plant_doctor_history(user_id, plant_local_id);
CREATE INDEX IF NOT EXISTS idx_pdh_user_species  ON public.plant_doctor_history(user_id, species_lat);
CREATE INDEX IF NOT EXISTS idx_ppd_user_plant    ON public.plant_photo_diffs(user_id, plant_id);
CREATE INDEX IF NOT EXISTS idx_scan_user_species ON public.scan_events(user_id, species_id);

CREATE OR REPLACE FUNCTION public.fn_plant_dossier(
  p_plant_local_id text DEFAULT NULL,
  p_species_lat    text DEFAULT NULL,
  p_species_name   text DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  WITH me AS (SELECT (SELECT auth.uid()) AS uid)
  SELECT jsonb_build_object(
    'harvests', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',h.id,'ts',h.ts,'menge',h.menge,'unit',h.unit,'species',h.species_name) ORDER BY h.ts DESC)
      FROM public.garden_harvests h, me
      WHERE h.user_id = me.uid
        AND ( (p_plant_local_id IS NOT NULL AND h.plant_local_id = p_plant_local_id)
           OR (h.plant_local_id IS NULL AND ( (p_species_lat IS NOT NULL AND h.species_lat = p_species_lat)
                                              OR (p_species_name IS NOT NULL AND h.species_name ILIKE p_species_name) )) )
    ), '[]'::jsonb),
    'diagnoses', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',d.id,'created_at',d.created_at,'status',d.status,'species',d.species_name,'followup_due_at',d.followup_due_at,'symptoms',d.symptoms) ORDER BY d.created_at DESC)
      FROM public.plant_doctor_history d, me
      WHERE d.user_id = me.uid
        AND ( (p_plant_local_id IS NOT NULL AND d.plant_local_id = p_plant_local_id)
           OR (p_species_lat IS NOT NULL AND d.species_lat = p_species_lat)
           OR (p_species_name IS NOT NULL AND d.species_name ILIKE p_species_name) )
    ), '[]'::jsonb),
    'photo_diffs', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id',pd.id,'created_at',pd.created_at,'days_between',pd.days_between) ORDER BY pd.created_at DESC)
      FROM public.plant_photo_diffs pd, me
      WHERE pd.user_id = me.uid AND p_plant_local_id IS NOT NULL AND pd.plant_id = p_plant_local_id
    ), '[]'::jsonb),
    'scan_count', COALESCE((
      SELECT count(*) FROM public.scan_events s, me
      WHERE s.user_id = me.uid AND ( (p_species_lat IS NOT NULL AND s.species_id = p_species_lat)
                                   OR (p_species_name IS NOT NULL AND s.species_id = p_species_name) )
    ), 0)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.fn_plant_dossier(text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_plant_dossier(text,text,text) TO authenticated;
