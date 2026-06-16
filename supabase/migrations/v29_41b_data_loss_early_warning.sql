-- v29.41b — Schicht 6 (additiv, read-only, KEIN App-v-Bump): Datenverlust-Frühwarnung.
--
-- Erweitert fn_data_integrity_scan (v29_41) um Erkennung der Empty-Clobber-/Datenverlust-Klasse
-- (PERS-12, v27.01 — wiederkehrendes #1-Risiko der App): ein User, dessen JÜNGSTER Snapshot
-- drastisch kleiner ist als sein jüngstes Maximum, hat vermutlich Daten verloren.
-- Heuristik (fehlalarm-arm): latest_b < 40% von max_b, max_b >= 1500 B, >=2 Snapshots.
-- Loggt nach system_events (severity=warn bei Treffern); die bestehende Admin-UI (🔍-Button +
-- System-Ereignisse + anomalies-Array) zeigt es ohne Frontend-Änderung.
--
-- CREATE OR REPLACE = idempotent, erhält Grants (verifiziert: anon=0, authenticated nur
-- Admin-Wrapper, service_role=Worker). Baseline-Lauf: snapshot_loss_warnings=0, severity=info.

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
  v_loss_count bigint;
  v_loss_users jsonb;
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

  -- Datenverlust-Frühwarnung: jüngster Snapshot << jüngstes Max (Empty-Clobber-Signatur)
  with per_user as (
    select user_id,
           count(*) as c,
           max(size_bytes) as max_b,
           (array_agg(size_bytes order by taken_at desc))[1] as latest_b
    from public.user_state_snapshots
    group by user_id
  )
  select count(*), coalesce(jsonb_agg(user_id), '[]'::jsonb)
    into v_loss_count, v_loss_users
  from per_user
  where c >= 2 and max_b >= 1500 and latest_b < (0.4 * max_b);

  if v_species_orphan_files > 0 then
    v_anomalies := array_append(v_anomalies, v_species_orphan_files || ' verwaiste species-images-Dateien');
  end if;
  if v_snap_over_cap > 0 then
    v_anomalies := array_append(v_anomalies, v_snap_over_cap || ' User ueber Snapshot-Cap (6)');
  end if;
  if v_loss_count > 0 then
    v_anomalies := array_append(v_anomalies, v_loss_count || ' moegliche Datenverlust-Snapshots (latest < 40% von max)');
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
    'snapshot_loss_warnings', v_loss_count,
    'snapshot_loss_users', v_loss_users,
    'anomalies', to_jsonb(v_anomalies)
  );

  insert into public.system_events(severity, source, event, detail)
  values (v_sev, 'data_integrity', 'scan', v_result);

  return v_result;
end
$function$;
