-- v26.6 Marketplace-Connect (Stripe Connect Express Onboarding)
-- Schema: marketplace_sellers — 1 Eintrag pro User, gekoppelt an Stripe-Account.
-- Cowork deployed via mcp__supabase__apply_migration ODER execute_sql.

create table if not exists public.marketplace_sellers (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id  text unique,
  status             text not null default 'pending'
                       check (status in ('pending','active','restricted','disabled')),
  charges_enabled    boolean default false,
  payouts_enabled    boolean default false,
  details_submitted  boolean default false,
  requirements       jsonb default '{}'::jsonb,
  country            text default 'CH',
  default_currency   text default 'chf',
  business_type      text,        -- individual | company
  display_name       text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

alter table public.marketplace_sellers enable row level security;

-- RLS: User darf nur eigenen Eintrag lesen/schreiben.
drop policy if exists "own_marketplace_seller_select" on public.marketplace_sellers;
create policy "own_marketplace_seller_select" on public.marketplace_sellers
  for select using (auth.uid() = user_id);

drop policy if exists "own_marketplace_seller_insert" on public.marketplace_sellers;
create policy "own_marketplace_seller_insert" on public.marketplace_sellers
  for insert with check (auth.uid() = user_id);

drop policy if exists "own_marketplace_seller_update" on public.marketplace_sellers;
create policy "own_marketplace_seller_update" on public.marketplace_sellers
  for update using (auth.uid() = user_id);

-- Service-Role-Pfad: stripe-webhook darf alle Eintraege via account.updated patchen.
-- Wird per service_role-Bypass abgewickelt, kein Policy noetig.

-- Index fuer Webhook-Lookups by stripe_account_id
create index if not exists idx_marketplace_sellers_stripe
  on public.marketplace_sellers(stripe_account_id);

-- View fuer Frontend: joined mit profiles (display_name + email).
create or replace view public.v_my_marketplace_seller as
  select s.*, p.display_name as profile_name, p.email
  from marketplace_sellers s
  left join profiles p on p.id = s.user_id
  where s.user_id = auth.uid();

-- Updated-At Trigger (idempotent)
create or replace function public.touch_updated_at()
  returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_marketplace_sellers_touch on public.marketplace_sellers;
create trigger trg_marketplace_sellers_touch
  before update on public.marketplace_sellers
  for each row execute function public.touch_updated_at();
