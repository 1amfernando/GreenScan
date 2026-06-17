-- v29.56 — Login-Überarbeitung Backend-Teil.
--
-- (A) BUG-FIX: zwei redundante AFTER-INSERT-Trigger auf auth.users (on_auth_user_created→
-- handle_new_user OHNE email + trg_on_auth_user_created→fn_handle_new_user MIT email). Trigger
-- feuern alphabetisch → der email-lose ('on_...') gewinnt das INSERT, der email-Trigger läuft ins
-- ON CONFLICT DO NOTHING → profiles.email blieb bei Neu-Usern NULL (6/11 betroffen, alle seit dem
-- zweiten Trigger ~Ende April 2026). Fix: redundanten Trigger + Funktion droppen, den email-
-- setzenden als einzige Quelle robust machen (ON CONFLICT DO UPDATE backfillt email falls je NULL),
-- + bestehende NULLs aus auth.users nachfüllen. Verifiziert: 1 Trigger, 0 NULL-emails, alte Fn weg.

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  insert into public.profiles (id, email, display_name, avatar_emoji)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)),
          '🌿')
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email);
  return new;
end;
$function$;

update public.profiles p
   set email = u.email
  from auth.users u
 where u.id = p.id and p.email is null and u.email is not null;

-- (B) DB-AUSBAU: kuratierte Login-Highlights (rotierende „was kann die App"-Karten auf #onb-start).
-- Öffentlicher Marketing-Inhalt VOR dem Login → anon-lesbar (nur active=true). Verifiziert: anon
-- liest 6 Zeilen. Frontend rendert über key (i18n) + emoji/sort_order aus der DB → editierbar ohne Deploy.
create table if not exists public.onboarding_highlights (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  emoji       text not null,
  title       text not null,
  subtitle    text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.onboarding_highlights enable row level security;

drop policy if exists onboarding_highlights_public_read on public.onboarding_highlights;
create policy onboarding_highlights_public_read on public.onboarding_highlights
  for select to anon, authenticated using (active = true);

insert into public.onboarding_highlights (key, emoji, title, subtitle) values
  ('onb_hl_identify', '🔍', '4342 Schweizer Arten', 'Pflanzen, Pilze, Bäume & Kräuter per Foto bestimmen'),
  ('onb_hl_mushroom', '🍄', 'Pilze sicher bestimmen', 'Mit VAPKO-Verzeichnis & Verwechsler-Warnungen'),
  ('onb_hl_garden',   '🌱', 'Deinen Garten planen', 'KI-Gartenplaner, Saisonkalender & Pflege-Erinnerungen'),
  ('onb_hl_journal',  '📓', 'Sammlung & Tagebuch', 'Funde speichern, Fortschritt sehen, Level sammeln'),
  ('onb_hl_weather',  '☀️', 'Wetter & Saison für deine Region', 'Lokale Tipps, Frostwarnungen & Bauernregeln'),
  ('onb_hl_community', '🤝', 'Naturfreunde-Community', 'Tausche dich aus, teile Funde, lerne gemeinsam')
on conflict (key) do nothing;

update public.onboarding_highlights set sort_order = case key
  when 'onb_hl_identify' then 1 when 'onb_hl_mushroom' then 2 when 'onb_hl_garden' then 3
  when 'onb_hl_journal' then 4 when 'onb_hl_weather' then 5 when 'onb_hl_community' then 6 else sort_order end;
