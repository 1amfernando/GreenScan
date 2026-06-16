-- v29.41 — Layer 5: Daten-Integritaets- & Orphan-Observability (read-only, additiv)
--
-- Kontext: v29.34 orphan-GC loescht nur DB-Zeilen (rejected species_images/proposals);
-- die Storage-DATEIEN bleiben. Bevor eine loeschende Storage-GC blind auf die Live-DB
-- losgelassen wird (species-images-Bucket ist derzeit LEER -> Deletion nicht testbar),
-- erst eine read-only Beobachtungs-Schicht: zaehlt Storage-Orphans (species-images via
-- storage_path-Mapping verifiziert), rejected-Backlog, Snapshot-Retention + Bucket-Objekt-
-- Counts (Kosten-Sicht). Loggt jeden Lauf nach system_events -> erster echter Writer der
-- v29.31-Observability-Tabelle. KEIN DELETE, payment-Tabellen unberuehrt.
--
-- Verifiziert: Worker laeuft (108 Objekte, 0 Orphans, severity=info), Cron aktiv 04:35 UTC,
-- Privileg-Matrix anon=0 / authenticated nur Admin-Wrapper / service_role=Worker,
-- non-admin JWT -> "admin only" (HL#16).

create or replace function public.fn_data_integrity_scan()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
declare
  v_buckets jsonb;
  v_total_objects bigint;
  v_species_orphan_files bigint;
  v_rejected_si bigint;
  v_rejected_sp bigint;
  v_snap_over_cap bigint;
  v_snap_total bigint;
  v_snap_bytes bigint;
  v_anomalies text[] := '{}';
  v_sev text := 'info';
  v_result jsonb;
begin
  -- Per-Bucket-Objekt-Counts (Kosten-/Wachstums-Observability)
  select coalesce(jsonb_object_agg(bucket_id, cnt), '{}'::jsonb), coalesce(sum(cnt), 0)
    into v_buckets, v_total_objects
  from (select bucket_id, count(*)::bigint cnt from storage.objects group by bucket_id) s;

  -- species-images: Dateien ohne lebende DB-Zeile (Mapping species_images.storage_path = objects.name)
  select count(*) into v_species_orphan_files
  from storage.objects o
  where o.bucket_id = 'species-images'
    and not exists (select 1 from public.species_images si where si.storage_path = o.name);

  -- rejected-aber-noch-vorhanden Backlog (DB-GC-Reichweite)
  select count(*) into v_rejected_si from public.species_images where review_status = 'rejected';
  select count(*) into v_rejected_sp from public.species_proposals where review_status = 'rejected';

  -- Snapshot-Retention-Sanity (Cap 6/User seit v29.28)
  select count(*) filter (where c > 6), coalesce(sum(c), 0)
    into v_snap_over_cap, v_snap_total
  from (select user_id, count(*) c from public.user_state_snapshots group by user_id) t;
  select coalesce(sum(size_bytes), 0) into v_snap_bytes from public.user_state_snapshots;

  if v_species_orphan_files > 0 then
    v_anomalies := array_append(v_anomalies, v_species_orphan_files || ' verwaiste species-images-Dateien');
  end if;
  if v_snap_over_cap > 0 then
    v_anomalies := array_append(v_anomalies, v_snap_over_cap || ' User ueber Snapshot-Cap (6)');
  end if;
  if coalesce(array_length(v_anomalies, 1), 0) > 0 then
    v_sev := 'warn';
  end if;

  v_result := jsonb_build_object(
    'scanned_at', now(),
    'total_storage_objects', v_total_objects,
    'buckets', v_buckets,
    'species_images_orphan_files', v_species_orphan_files,
    'rejected_species_images', v_rejected_si,
    'rejected_species_proposals', v_rejected_sp,
    'snapshots_total', v_snap_total,
    'snapshots_bytes', v_snap_bytes,
    'snapshot_users_over_cap', v_snap_over_cap,
    'anomalies', to_jsonb(v_anomalies)
  );

  insert into public.system_events(severity, source, event, detail)
  values (v_sev, 'data_integrity', 'scan', v_result);

  return v_result;
end
$function$;

-- Admin-On-Demand-Wrapper (gated, fuer Admin-Panel-Button)
create or replace function public.fn_admin_data_integrity()
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $function$
begin
  if not coalesce(public.is_admin_user(), false) then
    raise exception 'admin only';
  end if;
  return public.fn_data_integrity_scan();
end
$function$;

-- Grants (HL#13: Default-PUBLIC entziehen)
revoke all on function public.fn_data_integrity_scan() from public, anon, authenticated;
grant execute on function public.fn_data_integrity_scan() to service_role;
revoke all on function public.fn_admin_data_integrity() from public, anon;
grant execute on function public.fn_admin_data_integrity() to authenticated;

-- Cron: taeglich 04:35 UTC (nach cleanup-orphans-daily 04:25, vor client-errors-gc 04:40)
select cron.schedule('data-integrity-daily', '35 4 * * *', $$ select public.fn_data_integrity_scan(); $$);
