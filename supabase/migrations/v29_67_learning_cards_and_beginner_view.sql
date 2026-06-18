-- v29.67 Lernfreundliche Schicht: Natur-/Pilz-Lernkarten + Anfänger-Ampel
-- Remote via Supabase-MCP appliziert als:
--   v29_67_nature_learning_cards     (Tabelle + RLS, unten gespiegelt)
--   v29_67_mushroom_beginner_view    (View, unten gespiegelt)
--   v29_67_learning_cards_seed       (7 Lektionen — Inhalt in Remote-Migration-History + live DB)
-- Die 7 Lektionen wurden per Research-+adversarial-Verify-Workflow erzeugt (geerdet an
-- VAPKO/SwissFungi/Tox Info Suisse, Essbarkeits-/Sicherheitsaussagen NIE LLM-geraten,
-- konservativ gehärtet) und sind idempotent (on conflict (slug) do update) geseedet.

-- ── Lernkarten-Tabelle ──
create table if not exists public.nature_learning_cards (
  slug text primary key,
  category text not null default 'pilze_basics',
  title text not null,
  icon text,
  level text not null default 'anfaenger',
  body text not null,
  key_points text[] default '{}'::text[],
  safety_caveat text,
  sources text[] default '{}'::text[],
  sort_order int not null default 100,
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_nature_learning_cat on public.nature_learning_cards(category, sort_order);
alter table public.nature_learning_cards enable row level security;
drop policy if exists nature_learning_read on public.nature_learning_cards;
create policy nature_learning_read on public.nature_learning_cards for select to anon, authenticated using (true);

-- ── Anfänger-Ampel-View (deterministisch aus mushroom_register.edibility + schlimmster
--    Verwechslergefahr in mushroom_lookalikes; KEIN LLM; sichere Fehlerrichtung:
--    toedlich-verwechselbare Speisepilze sind NIE 'anfaenger') ──
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
  m.slug,
  m.common_name_de,
  m.edibility,
  coalesce(w.risk_rank, 0) as confusion_rank,
  (coalesce(w.risk_rank, 0) >= 4) as has_deadly_lookalike,
  case
    when m.edibility in ('giftig','toedlich') then 'gefahr'
    when m.edibility = 'ungeniessbar' then 'ungeniessbar'
    when m.edibility = 'bedingt_essbar' and coalesce(w.risk_rank,0) >= 4 then 'gefahr'
    when m.edibility = 'bedingt_essbar' then 'fortgeschritten'
    when m.edibility in ('speisepilz','speisepilz_jung') and coalesce(w.risk_rank,0) >= 3 then 'fortgeschritten'
    when m.edibility in ('speisepilz','speisepilz_jung') then 'anfaenger'
    else 'unbekannt'
  end as beginner_level
from public.mushroom_register m
left join worst w on w.edible_slug = m.slug;

grant select on public.v_mushroom_beginner to anon, authenticated;

-- Die 7 Lernkarten (slugs: roehrlinge_vs_lamellen, sporenabdruck, die_toedlichen,
-- guter_einstieg, anfaengerfehler, sammel_etikette_naturschutz, vapko_prinzip)
-- werden über die Remote-Migration v29_67_learning_cards_seed in nature_learning_cards
-- geschrieben (idempotent, on conflict (slug) do update). Inhalt = adversarial geprüfte,
-- gehärtete Fassung mit Quellen je Karte; Notfall Tox Info Suisse 145 in jeder Karte.
