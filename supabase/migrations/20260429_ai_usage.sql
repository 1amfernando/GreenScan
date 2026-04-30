-- v23.89: ai_usage Tabelle fuer Edge Function ai-proxy
-- Zweck: pro KI-Call wird ein Eintrag fuer Quota + Telemetrie geschrieben.
-- Inserts gehen ausschliesslich vom Service-Role (Edge Function),
-- Selects nur von den Eigentuemer:innen.

create table if not exists public.ai_usage (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  day         date not null default current_date,
  model       text,
  tokens_in   integer default 0,
  tokens_out  integer default 0,
  created_at  timestamptz not null default now()
);

-- Schneller Lookup fuer "wie viele Calls hat User X heute?"
create index if not exists ai_usage_user_day_idx
  on public.ai_usage (user_id, day);

-- Aufraeumen alter Eintraege (90 Tage). Manuell laufen lassen oder als pg_cron.
-- delete from public.ai_usage where day < current_date - interval '90 days';

-- Row Level Security
alter table public.ai_usage enable row level security;

-- Eigene Calls einsehen (z.B. fuer ein UI "Heute X von Y Calls genutzt")
drop policy if exists "users see own ai_usage" on public.ai_usage;
create policy "users see own ai_usage"
  on public.ai_usage
  for select
  using (auth.uid() = user_id);

-- INSERTS:
-- - service_role bypasst RLS (Edge Function nutzt SUPABASE_SERVICE_ROLE_KEY)
-- - direkter Client-Zugriff blockiert (with check (false))
drop policy if exists "no client inserts" on public.ai_usage;
create policy "no client inserts"
  on public.ai_usage
  for insert
  with check (false);

-- UPDATE/DELETE: niemand. Audit-Trail bleibt unveraendert.
drop policy if exists "no updates" on public.ai_usage;
create policy "no updates" on public.ai_usage for update using (false);

drop policy if exists "no deletes" on public.ai_usage;
create policy "no deletes" on public.ai_usage for delete using (false);
