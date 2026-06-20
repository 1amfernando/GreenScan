-- v30.00 · Baum-Pflanz-Planer: Schema (tree_planting_specs + i18n, Grenzabstand-Regeln, Material-Katalog)
create table if not exists public.tree_planting_specs (
  slug text primary key,
  scientific_name text not null,
  common_name_de text not null,
  common_name_fr text, common_name_it text, common_name_en text, common_name_es text,
  category text not null check (category in ('obstbaum','beerenstrauch','hausbaum','zierbaum','hecke','wildgehoelz','nadelbaum')),
  mature_height_m_min numeric, mature_height_m_max numeric,
  mature_width_m_min numeric, mature_width_m_max numeric,
  growth_rate text check (growth_rate in ('langsam','mittel','schnell')),
  years_to_mature int,
  crown_form text, deciduous_evergreen text check (deciduous_evergreen in ('laubabwerfend','immergruen','halbimmergruen')),
  root_type text check (root_type in ('flachwurzler','herzwurzler','tiefwurzler','pfahlwurzler')),
  root_depth_m numeric, root_spread_factor numeric,
  root_risk text check (root_risk in ('gering','mittel','hoch')),
  light_need text, soil_ph_min numeric, soil_ph_max numeric, soil_types text[],
  water_need text, hardiness_zone text, frost_tolerance_c numeric, wind_tolerance text, altitude_max_m int,
  best_planting_months int[],
  planting_hole_width_factor numeric default 2.0, planting_hole_depth_factor numeric default 1.5,
  needs_stake boolean default false, stake_count int default 0, needs_browse_protection boolean default false,
  min_distance_to_building_m numeric, min_distance_to_neighbor_m numeric, hedge_spacing_m numeric,
  height_class text check (height_class in ('niedrig','mittel','hoch','forst')),
  toxicity text check (toxicity in ('keine','leicht','stark','toedlich')),
  toxic_parts text, allergen_potential text, child_pet_safe boolean,
  needs_pollination_partner boolean default false, pollination_partners text[], self_fertile boolean,
  pruning_window text, care_notes text, common_pests text[], swiss_notes text, source text,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table if not exists public.tree_planting_specs_i18n (
  slug text not null references public.tree_planting_specs(slug) on delete cascade,
  lang text not null,
  care_notes text, swiss_notes text, toxicity_note text, pruning_window text,
  verified boolean default false, created_at timestamptz default now(),
  primary key (slug, lang)
);

create table if not exists public.ch_planting_distance_rules (
  height_class text primary key,
  label_de text not null,
  min_boundary_distance_m numeric not null,
  note text, disclaimer text, source text
);

create table if not exists public.planting_materials (
  item_key text primary key,
  item_de text not null,
  category text not null,
  unit text not null,
  price_chf_min numeric, price_chf_max numeric,
  qty_formula_hint text, notes text
);

-- RLS: öffentliche Referenzdaten (anon+authenticated lesen), Schreibrechte entzogen (HL#13/#19)
alter table public.tree_planting_specs enable row level security;
alter table public.tree_planting_specs_i18n enable row level security;
alter table public.ch_planting_distance_rules enable row level security;
alter table public.planting_materials enable row level security;

do $$ begin
  create policy tps_read on public.tree_planting_specs for select to anon, authenticated using (true);
  create policy tpsi_read on public.tree_planting_specs_i18n for select to anon, authenticated using (true);
  create policy cpdr_read on public.ch_planting_distance_rules for select to anon, authenticated using (true);
  create policy pm_read on public.planting_materials for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;

revoke insert, update, delete on public.tree_planting_specs, public.tree_planting_specs_i18n, public.ch_planting_distance_rules, public.planting_materials from anon, authenticated;
grant select on public.tree_planting_specs, public.tree_planting_specs_i18n, public.ch_planting_distance_rules, public.planting_materials to anon, authenticated;

create index if not exists idx_tps_category on public.tree_planting_specs(category);
create index if not exists idx_tps_toxicity on public.tree_planting_specs(toxicity);
