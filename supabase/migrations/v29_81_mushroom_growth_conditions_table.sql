-- v29.81 · Pro-Pilz Wachstums-/Foraging-Wissen für den Saison-Pilz-Screen (additiv, read-only).
-- Wachstums-/Witterungs-Hinweise (NICHT sicherheitskritisch wie Essbarkeit) — recherchiert + faktengeprüft.
create table if not exists public.mushroom_growth_conditions (
  slug text primary key references public.mushroom_register(slug) on delete cascade,
  best_after text, soil_conditions text, microhabitat text,
  foraging_difficulty text, foraging_tips text, source text,
  verified boolean not null default false, created_at timestamptz not null default now()
);
alter table public.mushroom_growth_conditions enable row level security;
drop policy if exists "mushroom_growth_conditions_read" on public.mushroom_growth_conditions;
create policy "mushroom_growth_conditions_read" on public.mushroom_growth_conditions for select to anon, authenticated using (true);
revoke insert, update, delete on public.mushroom_growth_conditions from anon, authenticated, public;
