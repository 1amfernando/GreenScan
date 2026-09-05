-- ═══════════════════════════════════════════════════════════════════════════
-- Ökosystem V1 · Tagesaggregat als TABELLE (docs/OEKOSYSTEM-V1.md §11 Idee 17)
--
-- BEWUSST NICHT ANGEWANDT (DDL ist Fernandos Handgriff). Idempotent.
-- Setzt 20260903_oekosystem_v1_geraete.sql voraus.
--
-- Der Fund (04.09.2026): `v_device_daily` ist eine VIEW über `device_readings`,
-- und `fn_device_readings_prune` löscht die Rohwerte nach 400 Tagen — das
-- Aggregat verschwand mit. §2.3 versprach „Tagesaggregate unbegrenzt"; das
-- Schema hielt es nicht. Diese Tabelle hält es: der Cron füllt sie, BEVOR der
-- Prune läuft, und sie wird nie geleert. Je Tag stehen n und quality_min
-- dabei — ein Mittel aus 2 Werten ist nicht eines aus 48.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.device_daily (
  device_id    uuid not null references public.devices(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric       text not null references public.metric_catalog(key),
  tag          date not null,                       -- Kalendertag Europe/Zurich
  value        numeric not null,                    -- nach metric_catalog.aggregation (avg/sum/min/max/last)
  min_value    numeric,
  max_value    numeric,
  n            integer not null,
  quality_min  smallint not null,
  computed_at  timestamptz not null default now(),
  primary key (device_id, metric, tag)
);

create index if not exists idx_device_daily_user_tag on public.device_daily(user_id, tag);

alter table public.device_daily enable row level security;
drop policy if exists "own_device_daily_select" on public.device_daily;
create policy "own_device_daily_select" on public.device_daily for select using (auth.uid() = user_id);
-- Kein insert/update/delete für Clients: die Tabelle wird vom Cron geschrieben.
revoke insert, update, delete on public.device_daily from anon, authenticated;

comment on table public.device_daily is
  'Tagesaggregat je Gerät und Messgrösse — dauerhaft (Rohwerte gehen nach 400 Tagen). n und quality_min sagen, wie viel dahintersteht. docs/OEKOSYSTEM-V1.md §11 Idee 17.';

-- ── Aggregieren: alle Tage, die Rohwerte haben; idempotent (zweimal = gleiche Zeile) ──
create or replace function public.fn_device_daily_aggregate(p_seit date default null)
  returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  insert into public.device_daily (device_id, user_id, metric, tag, value, min_value, max_value, n, quality_min, computed_at)
  select r.device_id, r.user_id, r.metric,
         (r.ts at time zone 'Europe/Zurich')::date as tag,
         case c.aggregation
           when 'sum'  then sum(r.value)
           when 'min'  then min(r.value)
           when 'max'  then max(r.value)
           when 'last' then (array_agg(r.value order by r.ts desc))[1]
           else avg(r.value)
         end,
         min(r.value), max(r.value), count(*), min(r.quality), now()
    from public.device_readings r
    join public.metric_catalog c on c.key = r.metric
   where r.quality >= 1                                             -- Gerätefehler (0) zählen nicht ins Aggregat
     and (p_seit is null or (r.ts at time zone 'Europe/Zurich')::date >= p_seit)
   group by r.device_id, r.user_id, r.metric, tag, c.aggregation
  on conflict (device_id, metric, tag) do update
     set value = excluded.value, min_value = excluded.min_value, max_value = excluded.max_value,
         n = excluded.n, quality_min = excluded.quality_min, computed_at = now();
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.fn_device_daily_aggregate(date) from public, anon, authenticated;

-- ── Cron: täglich 03:05 die letzten 3 Tage nachrechnen (Nachlieferungen!),
--    und VOR dem wöchentlichen Prune (Montag 03:23) alles seit 401 Tagen.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('device-daily-aggregate') where exists (select 1 from cron.job where jobname = 'device-daily-aggregate');
    perform cron.schedule('device-daily-aggregate', '5 3 * * *',
      $cron$select public.fn_device_daily_aggregate((now() at time zone 'Europe/Zurich')::date - 3);$cron$);
    perform cron.unschedule('device-daily-before-prune') where exists (select 1 from cron.job where jobname = 'device-daily-before-prune');
    perform cron.schedule('device-daily-before-prune', '3 3 * * 1',
      $cron$select public.fn_device_daily_aggregate((now() at time zone 'Europe/Zurich')::date - 401);$cron$);
  end if;
end $$;

-- Die alte View bleibt (Leser im Client dürfen sie weiter nutzen), ist aber
-- ab jetzt nur noch die Sicht auf die ROHWERTE — die Geschichte steht hier.
comment on view public.v_device_daily is
  'Tagesaggregat der noch vorhandenen ROHWERTE (400 Tage). Die dauerhafte Geschichte steht in device_daily (Cron, vor dem Prune).';
