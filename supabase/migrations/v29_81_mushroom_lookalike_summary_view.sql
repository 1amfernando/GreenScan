-- v29.81 · Verwechsler-Summary pro Pilz (inline-Gefahr-Badges im Saison-Pilz-Screen).
-- Read-only, aus dem safety-verifizierten mushroom_lookalikes abgeleitet (bidirektional).
create or replace view public.v_mushroom_lookalike_summary
with (security_invoker = true) as
with pairs as (
  select edible_slug as slug, confusion_risk from public.mushroom_lookalikes
  union all
  select lookalike_slug as slug, confusion_risk from public.mushroom_lookalikes
)
select
  slug,
  count(*) as total_lookalikes,
  count(*) filter (where confusion_risk = 'sehr_hoch_lebensgefahr') as deadly_count,
  count(*) filter (where confusion_risk = 'hoch') as high_count,
  count(*) filter (where confusion_risk = 'mittel') as mid_count,
  bool_or(confusion_risk = 'sehr_hoch_lebensgefahr') as has_deadly_lookalike,
  (array_agg(confusion_risk order by case confusion_risk
     when 'sehr_hoch_lebensgefahr' then 4 when 'hoch' then 3 when 'mittel' then 2 when 'gering' then 1 else 0 end desc))[1] as worst_risk
from pairs group by slug;
grant select on public.v_mushroom_lookalike_summary to anon, authenticated;
