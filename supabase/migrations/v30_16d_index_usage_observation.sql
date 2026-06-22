-- Read-only Beobachtungs-Schicht für unused Indizes (HL#23: erst messen, dann droppen).
-- PostgreSQL 17 → pg_stat_user_indexes.last_idx_scan (Zeitpunkt letzter Nutzung) = direktes Signal.
-- Täglicher Snapshot der Index-Nutzung; nach >=14 Tagen realem Traffic liefert die View
-- v_unused_index_candidates sichere DROP-Kandidaten (0 Scans je + 0 im Fenster, kein PK/unique).
-- Nichts wird hier gedroppt — reine Telemetrie.

create table if not exists public.index_usage_snapshots (
  id bigint generated always as identity primary key,
  captured_at timestamptz not null default now(),
  schemaname text not null,
  tablename text not null,
  indexname text not null,
  idx_scan bigint not null,
  last_idx_scan timestamptz,
  idx_tup_read bigint,
  idx_tup_fetch bigint,
  index_size_bytes bigint,
  is_unique boolean,
  is_primary boolean
);
create index if not exists idx_ius_name_time on public.index_usage_snapshots (indexname, captured_at desc);

alter table public.index_usage_snapshots enable row level security;
drop policy if exists "ius admin read" on public.index_usage_snapshots;
create policy "ius admin read" on public.index_usage_snapshots
  for select to authenticated using (public.is_admin_user());

create or replace function public.fn_snapshot_index_usage()
returns integer
language plpgsql security definer
set search_path = public, pg_catalog
as $func$
declare n integer;
begin
  insert into public.index_usage_snapshots
    (schemaname, tablename, indexname, idx_scan, last_idx_scan, idx_tup_read, idx_tup_fetch, index_size_bytes, is_unique, is_primary)
  select s.schemaname, s.relname, s.indexrelname, s.idx_scan, s.last_idx_scan,
         s.idx_tup_read, s.idx_tup_fetch, pg_relation_size(s.indexrelid),
         i.indisunique, i.indisprimary
  from pg_stat_user_indexes s
  join pg_index i on i.indexrelid = s.indexrelid
  where s.schemaname = 'public';
  get diagnostics n = row_count;
  delete from public.index_usage_snapshots where captured_at < now() - interval '180 days';
  return n;
end;
$func$;
revoke all on function public.fn_snapshot_index_usage() from public, anon;

create or replace view public.v_unused_index_candidates
with (security_invoker = true) as
with latest as (
  select distinct on (indexname) indexname, tablename, idx_scan, last_idx_scan, index_size_bytes, is_unique, is_primary
  from public.index_usage_snapshots order by indexname, captured_at desc
),
firstsnap as (
  select distinct on (indexname) indexname, idx_scan as first_scan
  from public.index_usage_snapshots order by indexname, captured_at asc
),
agg as (
  select indexname, count(*) as snapshots, min(captured_at) as first_seen, max(captured_at) as last_seen
  from public.index_usage_snapshots group by indexname
)
select l.tablename, l.indexname, a.snapshots,
       round(extract(epoch from (a.last_seen - a.first_seen))/86400.0, 1) as days_observed,
       l.idx_scan as total_scans_cumulative,
       greatest(0, l.idx_scan - f.first_scan) as scans_during_observation,
       l.last_idx_scan,
       pg_size_pretty(l.index_size_bytes) as index_size,
       l.is_unique, l.is_primary,
       case
         when l.is_primary or l.is_unique then 'KEEP - enforces constraint'
         when a.snapshots < 2 or (a.last_seen - a.first_seen) < interval '14 days' then 'WAIT - <14 Tage / <2 Snapshots'
         when greatest(0, l.idx_scan - f.first_scan) = 0 and l.idx_scan = 0 then 'DROP CANDIDATE - 0 Scans je + 0 im Fenster'
         when greatest(0, l.idx_scan - f.first_scan) = 0 then 'REVIEW - 0 im Fenster, aber fruehere Scans'
         else 'KEEP - im Fenster genutzt'
       end as recommendation
from latest l
join firstsnap f using (indexname)
join agg a using (indexname)
order by (l.is_primary or l.is_unique), l.index_size_bytes desc nulls last;

-- Baseline-Snapshot sofort
select public.fn_snapshot_index_usage();

-- Täglicher Snapshot 04:17 UTC (idempotent: alten Job vorher entfernen)
select cron.unschedule(jobid) from cron.job where jobname = 'index-usage-daily';
select cron.schedule('index-usage-daily', '17 4 * * *', $cron$select public.fn_snapshot_index_usage();$cron$);
