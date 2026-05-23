-- v26.47 AI Daily Usage Tracking (AUFTRAG_CODE_v26.47)
-- Cowork ergänzt Edge-Fn-Logging sobald diese Tabelle live ist.
-- Upsert-Pattern per Edge-Fn-Call:
--   INSERT INTO ai_daily_usage (date, edge_fn, total_tokens_in, total_tokens_out, call_count)
--   VALUES (current_date, 'garden-scan-analyze', <in>, <out>, 1)
--   ON CONFLICT (date, edge_fn) DO UPDATE SET
--     total_tokens_in = ai_daily_usage.total_tokens_in + EXCLUDED.total_tokens_in,
--     total_tokens_out = ai_daily_usage.total_tokens_out + EXCLUDED.total_tokens_out,
--     call_count = ai_daily_usage.call_count + 1,
--     updated_at = now();

create table if not exists public.ai_daily_usage (
  date date not null,
  edge_fn text not null,
  total_tokens_in int default 0,
  total_tokens_out int default 0,
  total_cost_chf numeric(10,4) default 0,
  call_count int default 0,
  updated_at timestamptz default now(),
  primary key (date, edge_fn)
);

comment on table public.ai_daily_usage is 'v26.47: Daily-Aggregat fuer Anthropic-Token-Usage pro Edge-Fn. Wird upsert-incrementiert in jeder erfolgreichen Anthropic-API-Call.';

-- Index fuer fast lookups bei Dashboard-Query
create index if not exists idx_ai_daily_usage_date on public.ai_daily_usage(date desc);

-- RLS: nur admin (service_role) darf schreiben. Read fuer authentifizierte User.
alter table public.ai_daily_usage enable row level security;

-- Policy: jeder authentifizierte User darf lesen (Frontend prueft Admin-Email client-side)
drop policy if exists ai_daily_usage_select on public.ai_daily_usage;
create policy ai_daily_usage_select on public.ai_daily_usage
  for select to authenticated using (true);

-- Service-Role darf alles (Edge-Fns logen via service_role_key)
drop policy if exists ai_daily_usage_service_all on public.ai_daily_usage;
create policy ai_daily_usage_service_all on public.ai_daily_usage
  for all to service_role using (true) with check (true);
