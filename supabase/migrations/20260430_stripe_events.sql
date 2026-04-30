-- v24.12: stripe_events — Audit-Log fuer eingehende Stripe-Webhooks.
-- Zweck: jeder vom Stripe-Server signierte Event landet hier roh als
-- jsonb (additiv, kollisionsfrei zu existierenden subscription/customer-
-- Tabellen die der Owner bereits hat).
--
-- Vorteil:
-- - Replay/Debug moeglich (was hat Stripe wann geschickt?)
-- - Idempotenz garantiert (Stripe liefert event.id einmalig)
-- - Decouplung: Edge Fn schreibt nur hier, der Owner kann separat
--   eine View/Trigger bauen, die abgeleitete Tabellen pflegt.

create table if not exists public.stripe_events (
  id              text primary key,         -- Stripe event.id, z.B. evt_1Abc...
  type            text not null,            -- 'checkout.session.completed', ...
  payload         jsonb not null,           -- ganzer event raw
  user_id         uuid references auth.users(id) on delete set null,
  customer_id     text,                     -- Stripe customer (cus_...)
  subscription_id text,                     -- Stripe subscription (sub_...)
  processed_at    timestamptz,              -- gesetzt wenn Edge Fn fertig
  error_msg       text,                     -- nur bei Verarbeitungs-Fehler
  created_at      timestamptz not null default now()
);

create index if not exists stripe_events_type_idx     on public.stripe_events (type);
create index if not exists stripe_events_user_idx     on public.stripe_events (user_id);
create index if not exists stripe_events_customer_idx on public.stripe_events (customer_id);
create index if not exists stripe_events_created_idx  on public.stripe_events (created_at desc);

alter table public.stripe_events enable row level security;

-- User darf nur seine eigenen Events sehen (z.B. fuer "Letzte Rechnung"-View)
drop policy if exists "users see own stripe events" on public.stripe_events;
create policy "users see own stripe events" on public.stripe_events
  for select using (auth.uid() = user_id);

-- Inserts/Updates/Deletes ausschliesslich service_role (Edge Function)
drop policy if exists "no client writes" on public.stripe_events;
create policy "no client writes" on public.stripe_events
  for insert with check (false);
drop policy if exists "no client updates" on public.stripe_events;
create policy "no client updates" on public.stripe_events
  for update using (false);
drop policy if exists "no client deletes" on public.stripe_events;
create policy "no client deletes" on public.stripe_events
  for delete using (false);
