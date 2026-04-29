-- v23.91: brain_memory — geraeteuebergreifender Lern-Speicher fuer gsBrain
-- Zweck: jede Session schreibt Events (scan_added, garden_plant_added,
-- quiz_answered, home_open, ...) hier rein. Wenn der User das Geraet
-- wechselt, wird die Memory beim Login aus der Cloud gepullt und mit
-- der lokalen LRU-200 gemergt. So bleibt der "Schleimpilz" ueber
-- alle Devices hinweg ein einziger Organismus.

create table if not exists public.brain_memory (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  ts          timestamptz not null default now(),
  event       text not null,
  data        jsonb default '{}'::jsonb,
  client      text,                  -- optional: 'web', 'pwa-android', ...
  created_at  timestamptz not null default now()
);

-- Schneller Lookup fuer "letzte 200 Events des Users"
create index if not exists brain_memory_user_ts_idx
  on public.brain_memory (user_id, ts desc);

-- Optional: Aufraeumen >180 Tage (manuell oder via pg_cron)
-- delete from public.brain_memory where ts < now() - interval '180 days';

alter table public.brain_memory enable row level security;

-- Eigene Memory einsehen
drop policy if exists "users see own brain_memory" on public.brain_memory;
create policy "users see own brain_memory"
  on public.brain_memory
  for select
  using (auth.uid() = user_id);

-- Eigene Events anlegen
drop policy if exists "users insert own brain_memory" on public.brain_memory;
create policy "users insert own brain_memory"
  on public.brain_memory
  for insert
  with check (auth.uid() = user_id);

-- Eigene Memory loeschen (z.B. fuer GDPR/revDSG-Recht-auf-Loeschung)
drop policy if exists "users delete own brain_memory" on public.brain_memory;
create policy "users delete own brain_memory"
  on public.brain_memory
  for delete
  using (auth.uid() = user_id);

-- UPDATE bewusst NICHT erlaubt: Memory ist ein append-only Event-Log.
