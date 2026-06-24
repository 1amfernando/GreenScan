-- ai_usage: server-seitiges Tages-Quota-/Tracking-Tabelle für den ai-proxy (Anthropic-Kosten-Bremse).
-- Angewendet 2026-06-25 via MCP. Der Proxy zählt mit User-Client (RLS select-own) + inserted via service-role.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  day date not null default current_date,
  model text,
  tokens_in int default 0,
  tokens_out int default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_usage_user_day on public.ai_usage(user_id, day);
alter table public.ai_usage enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_usage' and policyname='ai_usage_select_own') then
    create policy ai_usage_select_own on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
  end if;
end $$;
-- KEINE INSERT/UPDATE/DELETE-Policy: Usage-Rows nur via service-role (Proxy) → kein Fälschen, keine Self-Escalation (HL#18).
