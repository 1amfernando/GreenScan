-- v23.96: push_subscriptions — Web-Push-Endpunkte pro User pro Geraet
-- Zweck: Nutzer abonniert Push, der Browser liefert eine endpoint+keys-
-- Subscription. Wir speichern sie hier und schicken via web-push aus
-- Edge Functions tägliche Smart-Notifications.

create table if not exists public.push_subscriptions (
  id          bigserial primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,           -- ECDH-Key des Browsers
  auth        text not null,           -- Auth-Secret des Browsers
  ua          text,                    -- User-Agent (debug)
  client      text,                    -- 'pwa-android' / 'pwa-ios' / 'web'
  -- Smart-Tipp Settings:
  enabled        boolean not null default true,
  send_hour      smallint not null default 7,   -- lokale Stunde (0-23)
  locale         text not null default 'de-CH',
  last_sent_at   timestamptz,
  last_error_at  timestamptz,
  failure_count  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subs_user_idx on public.push_subscriptions(user_id);
create index if not exists push_subs_send_idx on public.push_subscriptions(enabled, send_hour);

-- Trigger fuer updated_at
create or replace function public._set_push_updated_at()
  returns trigger as $$
begin new.updated_at := now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_push_subs_updated on public.push_subscriptions;
create trigger trg_push_subs_updated
  before update on public.push_subscriptions
  for each row execute function public._set_push_updated_at();

alter table public.push_subscriptions enable row level security;

-- Eigene Subscriptions verwalten
drop policy if exists "users see own push" on public.push_subscriptions;
create policy "users see own push" on public.push_subscriptions
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own push" on public.push_subscriptions;
create policy "users insert own push" on public.push_subscriptions
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own push" on public.push_subscriptions;
create policy "users update own push" on public.push_subscriptions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete own push" on public.push_subscriptions;
create policy "users delete own push" on public.push_subscriptions
  for delete using (auth.uid() = user_id);

-- Service-Role bypassed RLS automatisch (für daily-push Edge Function).
