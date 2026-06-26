-- v30.55: Admin-Verifizierung für Arten-Vorschläge (species_proposals) — angewendet 2026-06-26 via MCP.
-- Muster: fn_admin_review_species_image. 20 Vorschläge lagen 7 Wochen ungesehen (kein Admin-Pfad).
-- Jetzt: Queue + 1-Klick-Approve (→ species-Tabelle) + Pending-Counts. Alle is_admin_user()-gated (HL#13/#16).
-- HL#24: KEINE edible/tox aus dem KI-Vorschlag übernehmen (nur Text-Beschreibung/Warnung) — kein falsches „essbar".

alter table public.species add column if not exists source text default 'core';

create or replace function public.fn_admin_species_proposal_queue(p_limit int default 50)
returns table(id uuid, name text, latin text, family text, category text, scan_confidence smallint, data jsonb, created_at timestamptz, user_id uuid)
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if not public.is_admin_user() then raise exception 'admin only'; end if;
  return query
    select p.id, p.name, p.latin, p.family, p.category, p.scan_confidence, p.data, p.created_at, p.user_id
    from public.species_proposals p
    where p.review_status = 'pending'
    order by p.created_at asc
    limit greatest(1, least(coalesce(p_limit,50), 200));
end; $function$;

create or replace function public.fn_admin_review_species_proposal(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare v_uid uuid := (select auth.uid()); v_p public.species_proposals; v_slug text;
begin
  if not public.is_admin_user() then raise exception 'admin only'; end if;
  select * into v_p from public.species_proposals where id = p_id;
  if v_p.id is null then raise exception 'not found'; end if;
  if p_approve then
    v_slug := lower(regexp_replace(coalesce(nullif(trim(v_p.latin),''), v_p.name, p_id::text), '[^a-zA-Z0-9]+', '-', 'g'));
    v_slug := trim(both '-' from v_slug);
    if v_slug = '' or v_slug is null then v_slug := 'sp-' || left(p_id::text, 8); end if;
    insert into public.species (slug, name, lat, fam, cat, emoji, description, habitat, season, uses, warning, lookalike, source, data)
    values (
      v_slug, v_p.name, v_p.latin, v_p.family, v_p.category, '🌿',
      nullif(v_p.data->>'ai_summary',''), nullif(v_p.data->>'ai_habitat',''), nullif(v_p.data->>'ai_season',''),
      nullif(v_p.data->>'ai_uses',''), nullif(v_p.data->>'ai_warning',''), nullif(v_p.data->>'ai_lookalike',''),
      'community', v_p.data
    )
    on conflict (slug) do nothing;
    update public.species_proposals set review_status='approved', reviewed_by=v_uid, reviewed_at=now(), admin_note=p_note where id=p_id;
    insert into public.system_events(severity, source, event, detail)
      values ('info','species_review','approved', jsonb_build_object('proposal',p_id,'slug',v_slug,'name',v_p.name));
    return jsonb_build_object('ok', true, 'approved', true, 'slug', v_slug);
  else
    update public.species_proposals set review_status='rejected', reviewed_by=v_uid, reviewed_at=now(), admin_note=p_note where id=p_id;
    return jsonb_build_object('ok', true, 'approved', false);
  end if;
end; $function$;

create or replace function public.fn_admin_pending_counts()
returns jsonb language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
begin
  if not public.is_admin_user() then raise exception 'admin only'; end if;
  return jsonb_build_object(
    'proposals', (select count(*) from public.species_proposals where review_status='pending'),
    'images',    (select count(*) from public.species_images where review_status='pending')
  );
end; $function$;

revoke execute on function public.fn_admin_species_proposal_queue(int) from public, anon;
revoke execute on function public.fn_admin_review_species_proposal(uuid,boolean,text) from public, anon;
revoke execute on function public.fn_admin_pending_counts() from public, anon;
grant execute on function public.fn_admin_species_proposal_queue(int) to authenticated;
grant execute on function public.fn_admin_review_species_proposal(uuid,boolean,text) to authenticated;
grant execute on function public.fn_admin_pending_counts() to authenticated;
