-- v29.68 Review-Fixes (adversariale Review v29.64-67) + Garten-Lern-Curriculum
-- Remote via Supabase-MCP appliziert als: v29_68_mushroom_beginner_hymeno_safe,
-- v29_68_revoke_writes_reference_tables, v29_68_garden_learning_cards.

-- ── P0-SICHERHEITS-FIX: Anfänger-Ampel hymenophor-basiert konservativ ──
-- Vorher stufte die View lamellige Speisepilze mit REALEM tödlichem Doppelgänger als
-- 'anfaenger' ein, weil das mushroom_lookalikes-Paar fehlte (Champignon→Knollenblätterpilz,
-- Nelkenschwindling/Mönchskopf→Trichterling, Zigeunerpilz→Cortinarius). Da die Lookalike-
-- Abdeckung unvollständig ist, hängt 'anfaenger' jetzt NICHT mehr vom Fehlen eines Eintrags ab,
-- sondern vom eindeutigen Hymenophor ohne tödlichen Doppelgänger: Röhren/Poren (kein tödlicher
-- CH-Röhrling) + kursgeprüfte distinktive Typen (Leisten/Stacheln/Glucke/Judasohr). Lamellen
-- → Amanita/Clitocybe/Inocybe/Cortinarius-Risiko; Morchel-Waben → Frühjahrslorchel (tödlich);
-- Bovist-Gleba → Knollenblätterpilz-Ei. Alle → mind. fortgeschritten. Sichere Fehlerrichtung.
create or replace view public.v_mushroom_beginner
with (security_invoker = true) as
with worst as (
  select edible_slug,
    max(case confusion_risk
      when 'sehr_hoch_lebensgefahr' then 4
      when 'hoch' then 3
      when 'mittel' then 2
      when 'gering' then 1 else 0 end) as risk_rank
  from public.mushroom_lookalikes
  group by edible_slug
)
select
  m.slug, m.common_name_de, m.edibility,
  coalesce(w.risk_rank, 0) as confusion_rank,
  (coalesce(w.risk_rank, 0) >= 4) as has_deadly_lookalike,
  case
    when m.edibility in ('giftig','toedlich') then 'gefahr'
    when m.edibility = 'ungeniessbar' then 'ungeniessbar'
    when m.edibility = 'bedingt_essbar' and coalesce(w.risk_rank,0) >= 4 then 'gefahr'
    when m.edibility = 'bedingt_essbar' then 'fortgeschritten'
    when m.edibility in ('speisepilz','speisepilz_jung') and coalesce(w.risk_rank,0) >= 3 then 'fortgeschritten'
    when m.edibility in ('speisepilz','speisepilz_jung') and (
      case
        when m.gills_or_pores is null then false
        when lower(m.gills_or_pores) ~ '(leisten|stacheln|stoppel|krause lappen|verzweigte|aderige)' then true
        when lower(m.gills_or_pores) ~ '(alveolen|wabig|grubige|runzelige|gleba)' then false
        when lower(m.gills_or_pores) ~ '(röhren|roehren|poren)' then true
        else false
      end
    ) then 'anfaenger'
    when m.edibility in ('speisepilz','speisepilz_jung') then 'fortgeschritten'
    else 'unbekannt'
  end as beginner_level
from public.mushroom_register m
left join worst w on w.edible_slug = m.slug;
grant select on public.v_mushroom_beginner to anon, authenticated;

-- ── F3-Härtung (HL#13/#19): Write-Grants auf read-only Referenztabellen entziehen ──
revoke insert, update, delete, truncate, references, trigger
  on public.mushroom_register, public.mushroom_lookalikes, public.nature_learning_cards,
     public.ch_regions, public.ch_municipalities, public.ch_cantons
  from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.mushroom_register, public.mushroom_lookalikes, public.nature_learning_cards,
     public.ch_regions, public.ch_municipalities, public.ch_cantons
  from public;

-- ── Garten-Lern-Curriculum: tip-Spalte + 9 Lektionen (category='garten_basics') ──
alter table public.nature_learning_cards add column if not exists tip text;
-- Die 9 Garten-Lektionen (slugs garten_standort_licht, garten_boden_verstehen,
-- garten_mischkultur_basics, garten_fruchtfolge, garten_aussaat_timing, garten_giessen,
-- garten_kompost, garten_natuerlicher_pflanzenschutz, garten_biodiversitaet) werden über die
-- Remote-Migration v29_68_garden_learning_cards (idempotent, on conflict (slug) do update)
-- geschrieben — recherchiert+faktengeprüft an FiBL/Bioterra/Agroscope/ProSpecieRara/BAFU,
-- mission-konform (torffrei, keine Chemie, Biodiversität).
