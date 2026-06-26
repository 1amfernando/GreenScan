-- v30.58: fn_admin_review_species_proposal brach bei Approve mit "Aktion fehlgeschlagen", weil die
-- species-Tabelle NEBEN unique(slug) auch unique(lower(lat)) hat. Viele Vorschläge existieren bereits
-- in der species-Tabelle (der Scanner prüft den statischen window.DB-Blob, NICHT die species-Tabelle —
-- die beiden sind entkoppelt) → der lat-Constraint feuerte, und ON CONFLICT (slug) deckte ihn NICHT ab
-- → unhandled unique_violation → die ganze Funktion errorte → Frontend zeigte "Aktion fehlgeschlagen".
-- FIX: ON CONFLICT DO NOTHING (ohne Target → fängt JEDE Unique-Verletzung: slug UND lower(lat)) +
-- Rückgabe `inserted` (neu aufgenommen vs. war schon da) für ehrliches Frontend-Feedback (HL#33).
-- Angewendet 2026-06-26 via MCP, in Rollback-TX gegen einen echten Vorschlag verifiziert.
create or replace function public.fn_admin_review_species_proposal(p_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql security definer set search_path to 'public', 'pg_temp' as $function$
declare v_uid uuid := (select auth.uid()); v_p public.species_proposals; v_slug text; v_ins int;
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
    on conflict do nothing;
    get diagnostics v_ins = row_count;
    update public.species_proposals set review_status='approved', reviewed_by=v_uid, reviewed_at=now(), admin_note=p_note where id=p_id;
    insert into public.system_events(severity, source, event, detail)
      values ('info','species_review', case when v_ins>0 then 'approved' else 'approved_dup' end,
              jsonb_build_object('proposal',p_id,'slug',v_slug,'name',v_p.name,'inserted',v_ins>0));
    return jsonb_build_object('ok', true, 'approved', true, 'inserted', v_ins>0, 'slug', v_slug);
  else
    update public.species_proposals set review_status='rejected', reviewed_by=v_uid, reviewed_at=now(), admin_note=p_note where id=p_id;
    return jsonb_build_object('ok', true, 'approved', false);
  end if;
end; $function$;
