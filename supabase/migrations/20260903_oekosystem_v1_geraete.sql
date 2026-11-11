-- ═══════════════════════════════════════════════════════════════════════════
-- v32.45 · Ökosystem V1, Stufe 0 — Geräte, Messwerte, Regeln, Befehle
-- Entwurf: docs/OEKOSYSTEM-V1.md (03.09.2026)
--
-- BEWUSST NICHT ANGEWANDT. DDL auf der Produktivdatenbank ist Fernandos
-- Handgriff (STATUS.md §2, CLAUDE.md §7.1 „backend_check"). Idempotent —
-- laesst sich beliebig oft einspielen.
--
-- Die eine Regel: ein Geraet ist ein Datensatz, kein Sonderfall. Eine neue
-- Sensorart ist eine Zeile in metric_catalog, ein neues Geraet eine Zeile in
-- devices. Kein Code muss dafuer angefasst werden.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Katalog der Messgroessen — oeffentlich lesbar, Admin schreibt ──────
create table if not exists public.metric_catalog (
  key          text primary key,
  unit         text not null,
  min_valid    numeric,
  max_valid    numeric,
  label_de     text not null,
  label_fr     text,
  label_it     text,
  label_en     text,
  icon         text,
  aggregation  text not null default 'avg'
                 check (aggregation in ('avg','sum','last','min','max')),
  decimals     smallint not null default 0,
  sort         smallint not null default 100,
  created_at   timestamptz not null default now()
);

alter table public.metric_catalog enable row level security;

drop policy if exists "metric_catalog_public_select" on public.metric_catalog;
create policy "metric_catalog_public_select" on public.metric_catalog
  for select using (true);

-- Schreiben nur Admins — ueber fn_is_role('admin'), dieselbe Pruefung wie in
-- den 16 RLS-Policies seit v30.95 (20260831_rollen_leak_fix_v30_95.sql).
-- Nicht profiles.is_admin: zwei Quellen fuer dieselbe Frage sind ein Fehler,
-- der auf sein Datum wartet (CLAUDE.md §7.1, einstellungen_check).
drop policy if exists "metric_catalog_admin_write" on public.metric_catalog;
create policy "metric_catalog_admin_write" on public.metric_catalog
  for all using (public.fn_is_role('admin')) with check (public.fn_is_role('admin'));

-- Startbestand: Messgroessen, keine Botanik. Einheit und Gueltigkeitsbereich
-- sind physikalisch. `on conflict do nothing` — ein Admin darf Labels aendern,
-- ohne dass die Migration sie beim naechsten Lauf zuruecksetzt.
insert into public.metric_catalog (key, unit, min_valid, max_valid, label_de, label_fr, label_it, label_en, icon, aggregation, decimals, sort) values
  ('soil_moisture', '%',     0,    100,  'Bodenfeuchte',      'Humidité du sol',      'Umidità del suolo',      'Soil moisture',   '💧', 'avg',  0, 10),
  ('soil_temp',     '°C',   -20,   60,   'Bodentemperatur',   'Température du sol',   'Temperatura del suolo',  'Soil temperature','🌡️', 'avg',  1, 20),
  ('air_temp',      '°C',   -40,   60,   'Lufttemperatur',    'Température de l''air','Temperatura dell''aria', 'Air temperature', '🌡️', 'avg',  1, 30),
  ('air_humidity',  '%',     0,    100,  'Luftfeuchte',       'Humidité de l''air',   'Umidità dell''aria',     'Air humidity',    '💨', 'avg',  0, 40),
  ('light',         'lux',   0,    200000,'Licht',            'Lumière',              'Luce',                   'Light',           '☀️', 'avg',  0, 50),
  ('rain',          'mm',    0,    500,  'Niederschlag',      'Précipitations',       'Precipitazioni',         'Rain',            '🌧️', 'sum',  1, 60),
  ('water_level',   '%',     0,    100,  'Wasserstand',       'Niveau d''eau',        'Livello dell''acqua',    'Water level',     '🪣', 'last', 0, 70),
  ('tank_temp',     '°C',   -10,   60,   'Tanktemperatur',    'Température du réservoir','Temperatura del serbatoio','Tank temperature','🌡️','avg', 1, 80),
  ('ec',            'mS/cm', 0,    20,   'Leitfähigkeit',     'Conductivité',         'Conducibilità',          'Conductivity',    '⚡', 'avg',  2, 90),
  ('ph',            'pH',    0,    14,   'pH-Wert',           'pH',                   'pH',                     'pH',              '🧪', 'avg',  1, 100),
  ('battery',       '%',     0,    100,  'Batterie',          'Batterie',             'Batteria',               'Battery',         '🔋', 'last', 0, 900)
on conflict (key) do nothing;

-- ── 2 · Geraete-Register — own-only ───────────────────────────────────────
create table if not exists public.devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            text not null default 'manual',      -- 'manual' | 'weather' | 'gs_<modell>' | 'third_party'
  name            text not null,
  garden_id       text,                                -- Referenz in die App-Daten (user_gardens-Blob), bewusst lose
  plant_id        text,
  bed_id          text,
  capabilities    jsonb not null default '{"metrics":[],"interval_s":null,"commands":[]}'::jsonb,
  firmware        text,
  schema_version  smallint not null default 1,
  status          text not null default 'active'
                    check (status in ('active','paused','lost')),
  last_seen_at    timestamptz,
  paired_at       timestamptz,
  token_hash      text,                                -- sha256 des Geraete-Tokens; Klartext nie gespeichert
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_devices_user on public.devices(user_id);
create unique index if not exists idx_devices_token_hash on public.devices(token_hash) where token_hash is not null;

alter table public.devices enable row level security;

drop policy if exists "own_devices_select" on public.devices;
create policy "own_devices_select" on public.devices for select using (auth.uid() = user_id);
drop policy if exists "own_devices_insert" on public.devices;
create policy "own_devices_insert" on public.devices for insert with check (auth.uid() = user_id);
drop policy if exists "own_devices_update" on public.devices;
create policy "own_devices_update" on public.devices for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own_devices_delete" on public.devices;
create policy "own_devices_delete" on public.devices for delete using (auth.uid() = user_id);

-- token_hash darf der Client NICHT lesen — auch nicht den eigenen. Spaltenrechte
-- statt Policy: PostgREST liefert die Spalte dann gar nicht erst aus.
revoke select (token_hash) on public.devices from anon, authenticated;

create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists trg_devices_touch on public.devices;
create trigger trg_devices_touch before update on public.devices
  for each row execute function public.touch_updated_at();

-- ── 3 · Messwerte — own-only, nur anhaengen ───────────────────────────────
create table if not exists public.device_readings (
  device_id    uuid not null references public.devices(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  metric       text not null references public.metric_catalog(key),
  ts           timestamptz not null,                    -- Zeit des GERAETS
  received_at  timestamptz not null default now(),      -- Zeit des SERVERS
  value        numeric not null,
  quality      smallint not null default 2
                 check (quality in (0,1,2)),            -- 0 Fehler · 1 ausserhalb Bereich · 2 plausibel
  raw          jsonb,
  primary key (device_id, metric, ts)                   -- Idempotenz: Funkloch-Wiederholung erzeugt keine Dubletten
);

create index if not exists idx_device_readings_user_ts on public.device_readings(user_id, ts desc);
create index if not exists idx_device_readings_device_metric_ts on public.device_readings(device_id, metric, ts desc);

alter table public.device_readings enable row level security;

drop policy if exists "own_readings_select" on public.device_readings;
create policy "own_readings_select" on public.device_readings for select using (auth.uid() = user_id);
-- Einfuegen durch die Person selbst (kind = 'manual') — und nur fuer ein eigenes Geraet.
drop policy if exists "own_readings_insert" on public.device_readings;
create policy "own_readings_insert" on public.device_readings for insert
  with check (auth.uid() = user_id
              and exists (select 1 from public.devices d where d.id = device_id and d.user_id = auth.uid()));
-- Kein UPDATE, kein DELETE fuer Clients: Messwerte werden nur angehaengt.
-- Loeschung nur ueber die Kontoloeschung (on delete cascade).

-- Qualitaet aus dem Katalog setzen, wenn der Absender sie nicht setzt:
-- ausserhalb min/max → 1. Nie verwerfen.
create or replace function public.fn_device_reading_quality()
  returns trigger language plpgsql as $$
declare mn numeric; mx numeric;
begin
  if new.quality = 2 then
    select min_valid, max_valid into mn, mx from public.metric_catalog where key = new.metric;
    if (mn is not null and new.value < mn) or (mx is not null and new.value > mx) then
      new.quality := 1;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_device_readings_quality on public.device_readings;
create trigger trg_device_readings_quality before insert on public.device_readings
  for each row execute function public.fn_device_reading_quality();

-- last_seen_at mitziehen — ein Geraet gilt als gesehen, wenn ein Wert ankam.
create or replace function public.fn_device_touch_seen()
  returns trigger language plpgsql as $$
begin
  update public.devices
     set last_seen_at = greatest(coalesce(last_seen_at, 'epoch'::timestamptz), new.received_at),
         paired_at    = coalesce(paired_at, new.received_at),
         status       = case when status = 'lost' then 'active' else status end
   where id = new.device_id;
  return new;
end;
$$;
drop trigger if exists trg_device_readings_seen on public.device_readings;
create trigger trg_device_readings_seen after insert on public.device_readings
  for each row execute function public.fn_device_touch_seen();

-- ── 4 · Regeln — own-only ─────────────────────────────────────────────────
create table if not exists public.device_rules (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  device_id        uuid not null references public.devices(id) on delete cascade,
  metric           text references public.metric_catalog(key),   -- null bei op = 'stale'
  op               text not null check (op in ('below','above','stale','expr')),
  threshold        numeric,
  for_minutes      integer not null default 0,
  action           text not null default 'notify'
                     check (action in ('notify','task:water','calendar')),
  cooldown_minutes integer not null default 720,
  expr             jsonb,                                         -- Stufe 3
  enabled          boolean not null default true,
  last_fired_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_device_rules_user on public.device_rules(user_id);

alter table public.device_rules enable row level security;
drop policy if exists "own_rules_all" on public.device_rules;
create policy "own_rules_all" on public.device_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists trg_device_rules_touch on public.device_rules;
create trigger trg_device_rules_touch before update on public.device_rules
  for each row execute function public.touch_updated_at();

-- ── 5 · Befehle an Aktoren — own-only (Stufe 3, Schema jetzt) ─────────────
create table if not exists public.device_commands (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  device_id   uuid not null references public.devices(id) on delete cascade,
  command     text not null,
  params      jsonb not null default '{}'::jsonb,
  status      text not null default 'pending'
                check (status in ('pending','sent','acked','failed')),
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  acked_at    timestamptz,
  attempts    smallint not null default 0
);

create index if not exists idx_device_commands_device_status on public.device_commands(device_id, status);

alter table public.device_commands enable row level security;
drop policy if exists "own_commands_all" on public.device_commands;
create policy "own_commands_all" on public.device_commands
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 6 · Sichten fuer das Dashboard ────────────────────────────────────────
-- Letzter Wert je Geraet und Groesse — eine Zeile je Kachel-Eintrag.
create or replace view public.v_device_latest as
  select distinct on (r.device_id, r.metric)
         r.device_id, r.user_id, r.metric, r.ts, r.value, r.quality
    from public.device_readings r
   order by r.device_id, r.metric, r.ts desc;

-- Tagesaggregat nach der Regel des Katalogs — 30 Tage × 5 Groessen = 150 Zeilen
-- statt 7'200 Rohwerte. Sicherheitsfilter auf auth.uid(), weil Views RLS der
-- Basistabelle nur mit security_invoker erben.
create or replace view public.v_device_daily with (security_invoker = true) as
  select r.device_id, r.user_id, r.metric,
         (r.ts at time zone 'Europe/Zurich')::date as tag,
         case c.aggregation
           when 'sum'  then sum(r.value)
           when 'min'  then min(r.value)
           when 'max'  then max(r.value)
           when 'last' then (array_agg(r.value order by r.ts desc))[1]
           else avg(r.value)
         end as value,
         count(*)             as n,
         min(r.quality)       as quality_min
    from public.device_readings r
    join public.metric_catalog c on c.key = r.metric
   group by r.device_id, r.user_id, r.metric, tag, c.aggregation;

alter view public.v_device_latest set (security_invoker = true);

-- ── 7 · Aufbewahrung — Rohwerte 400 Tage (docs/OEKOSYSTEM-V1.md §2.3) ──────
create or replace function public.fn_device_readings_prune()
  returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.device_readings where ts < now() - interval '400 days';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.fn_device_readings_prune() from public, anon, authenticated;

-- Cron nur, wenn pg_cron da ist (wie in v30_16d). Wochentlich, nachts.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('device-readings-prune') where exists (select 1 from cron.job where jobname = 'device-readings-prune');
    perform cron.schedule('device-readings-prune', '23 3 * * 1', $cron$select public.fn_device_readings_prune();$cron$);
  end if;
end $$;

-- ── 8 · Stille ist ein Alarm: Geraete ohne Signal markieren ───────────────
-- Laeuft mit dem Alarm-Cron der Stufe 1; die Funktion existiert schon jetzt,
-- damit das Dashboard `lost` anzeigen kann, sobald jemand sie aufruft.
create or replace function public.fn_devices_mark_lost()
  returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.devices d
     set status = 'lost'
   where d.status = 'active'
     and d.kind not in ('manual','weather')
     and d.last_seen_at is not null
     and (d.capabilities->>'interval_s') is not null
     and d.last_seen_at < now() - make_interval(secs => 3 * (d.capabilities->>'interval_s')::numeric);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.fn_devices_mark_lost() from public, anon, authenticated;

comment on table public.devices is 'Ökosystem V1 (docs/OEKOSYSTEM-V1.md). Ein Gerät ist ein Datensatz, kein Sonderfall.';
comment on table public.device_readings is 'Nur anhängen. quality: 0 Fehler · 1 ausserhalb Bereich · 2 plausibel. Nie verwerfen.';
comment on table public.metric_catalog is 'Was gemessen werden KANN. Eine neue Sensorart ist eine Zeile hier.';
