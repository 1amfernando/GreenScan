-- ============================================================================
-- v28_26_plant_dossier_fix — Spiegel der LIVE-Migration (Re-Audit-Fix).
-- scan_count aus fn_plant_dossier ENTFERNT. Re-Audit ergab: scan_events.species_id =
-- Arten-DB-ID (Frontend loggt String(s.id)), NICHT lat/name → mein v28.23-Match
-- (species_id = species_lat/name) hätte nie korrekt gezählt; zudem tragen gespeicherte Pflanzen
-- keine verlässliche Arten-ID und Scans sind Arterkennungs-Events (gehören konzeptionell nicht
-- zu EINER gespeicherten Pflanze). Dossier behält die sicher per plant_local_id verknüpften
-- Inhalte (Ernten/Diagnosen/Foto-Diffs). Signatur unverändert (text,text,text).
-- Verifiziert: keys=[diagnoses,harvests,photo_diffs], has_scan_count=false, harvests_n=1.
-- ============================================================================
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
    ), '[]'::jsonb)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.fn_plant_dossier(text,text,text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.fn_plant_dossier(text,text,text) TO authenticated;
