-- v26.32 Garten-Tagebuch v2: Schema-Erweiterung für strukturierte Einträge.
-- Cowork-Auftrag aus CODE_AUFTRAEGE_v26.28_v26.32.md §5.
--
-- Applied 2026-05-23 via Supabase MCP apply_migration.
--
-- Background: v26.21 Pest-Scanner + v26.29 Düngeplan-Coach Inserts erwarteten
-- Spalten (entry_type, species_lat, pest_slug, metadata) die das aktuelle
-- Schema nicht hatte → silent fail. Diese Migration fügt sie additive hinzu
-- (KEIN DROP, KEIN ALTER COLUMN TYPE → safe per CODE_ROUTINE_MASTER §1).

alter table public.garden_diary
  add column if not exists entry_type text default 'general'
    check (entry_type in (
      'general','pest_observation','disease','harvest','sowing',
      'fertilization','pruning','watering','medicinal_harvest',
      'seed_collection','flowering'
    ));

alter table public.garden_diary
  add column if not exists pest_slug text references plant_pests(slug) on delete set null;

alter table public.garden_diary
  add column if not exists species_lat text;

alter table public.garden_diary
  add column if not exists harvest_kg numeric;

alter table public.garden_diary
  add column if not exists metadata jsonb default '{}'::jsonb;

-- Index für Filter nach type (Saison-Stats: type=harvest mit harvest_kg sum)
create index if not exists idx_garden_diary_user_type_ts
  on public.garden_diary(user_id, entry_type, ts desc);

-- Index für pest-Lookup
create index if not exists idx_garden_diary_pest_slug
  on public.garden_diary(pest_slug) where pest_slug is not null;
