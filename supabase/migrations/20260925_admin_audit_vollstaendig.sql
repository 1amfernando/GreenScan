-- v33.51 · Das Admin-Protokoll kennt jede Aktion.
--
-- Gemessen am 25.09.2026 in der Live-DB (nur lesend, pg_proc.prosrc): von den
-- 15 Aktionen in GS_ADM_AKTIONEN schreiben ZEHN eine Zeile nach audit_log
-- (moderate, set_tier, assign_role, flag_set, voucher_create, voucher_toggle,
-- knowledge_save/delete/publish, global_api_key). FUENF nicht:
--
--   fn_admin_review_species_image     → Foto-Beitrag freigeben/ablehnen: KEINE Spur
--   fn_admin_review_species_proposal  → Arten-Vorschlag aufnehmen/ablehnen: nur
--                                        system_events bei „aufnehmen", nichts bei
--                                        „ablehnen" — und system_events ist kein
--                                        Admin-Protokoll (kein actor_id)
--   „Meldung erledigen"               → ein PATCH auf user_reports aus der App,
--                                        gar keine RPC: KEINE Spur
--   fn_admin_data_integrity           → liest nur (BEWUSST ohne Spur)
--   send-push (Broadcast)             → steht in push_send_log, je Empfaenger
--                                        eine Zeile (BEWUSST ohne zweite Spur)
--
-- Eine Moderationsentscheidung ohne Spur ist die schlechteste Sorte Lücke:
-- „Wer hat diesen Vorschlag abgelehnt, und wann?" ist danach nicht mehr zu
-- beantworten. audit_log hat KEINE INSERT-Policy (RLS an, nur SELECT fuer
-- Admins) — geschrieben wird ausschliesslich aus SECURITY-DEFINER-Funktionen.
-- Das ist richtig so: eine Zeile darin ist deshalb eine Aussage des Servers,
-- nicht der App. Genau darum muss die Spur in die FUNKTION, nicht in die App.
--
-- Drei Dinge, alle idempotent (CREATE OR REPLACE, GRANT/REVOKE wiederholbar):
--   1. fn_admin_review_species_image   — Rumpf wie live (pg_get_functiondef
--      25.09.2026) + eine audit_log-Zeile 'species_image_review'
--   2. fn_admin_review_species_proposal — Rumpf wie live + 'species_proposal_review'
--      in BEIDEN Zweigen (aufnehmen UND ablehnen)
--   3. NEU fn_admin_review_report(p_id, p_status, p_note) — ersetzt den nackten
--      PATCH der App: is_admin_user-Tor, Status-Vokabular wie der CHECK der
--      Tabelle, reviewed_by/reviewed_at, 'report_review' nach audit_log.
--      Bis diese Datei angewandt ist, faellt die App auf den PATCH zurueck und
--      SAGT dabei „ohne Protokolleintrag" (GS_ADM_AKTIONEN.report_review.ersatz).
--
-- Die Aktions-Namen sind in der App deklariert (GS_ADM_AKTIONEN[*].spur_ab);
-- scripts/admin_check.js wendet diese Datei in einem lokalen Postgres ZWEIMAL
-- an und prueft, dass genau diese drei Zeilen entstehen — und keine, wenn der
-- Aufrufer kein Admin ist.
--
-- NICHT angewandt. DDL auf der Produktivdatenbank ist Fernandos Klick
-- (CLAUDE.md §7.1: „Nachmessen: ja, jederzeit, nur lesend. Anwenden: nein.").

-- 1 · Foto-Beitrag pruefen — Rumpf wie live, plus Spur
CREATE OR REPLACE FUNCTION public.fn_admin_review_species_image(p_id uuid, p_approve boolean, p_make_primary boolean DEFAULT false, p_note text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_species text; v_uid uuid := (SELECT auth.uid());
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT species_id INTO v_species FROM public.species_images WHERE id = p_id;
  IF v_species IS NULL THEN RAISE EXCEPTION 'not found'; END IF;
  IF p_approve THEN
    IF p_make_primary THEN
      UPDATE public.species_images SET is_primary = false WHERE species_id = v_species AND id <> p_id;
    END IF;
    UPDATE public.species_images
      SET review_status = 'approved',
          is_primary = COALESCE(p_make_primary, is_primary),
          admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
      WHERE id = p_id;
  ELSE
    UPDATE public.species_images
      SET review_status = 'rejected', admin_note = p_note, reviewed_by = v_uid, reviewed_at = now()
      WHERE id = p_id;
  END IF;
  -- v33.51: die Spur. Vorher war ein freigegebenes oder abgelehntes Foto im
  -- Admin-Protokoll unsichtbar.
  INSERT INTO public.audit_log(actor_id, action, target_type, target_id, diff)
    VALUES (v_uid, 'species_image_review', 'species_image', p_id::text,
            jsonb_build_object('approve', p_approve, 'make_primary', coalesce(p_make_primary, false),
                               'species', v_species, 'note', p_note));
END; $function$;

-- 2 · Arten-Vorschlag pruefen — Rumpf wie live, plus Spur in beiden Zweigen
CREATE OR REPLACE FUNCTION public.fn_admin_review_species_proposal(p_id uuid, p_approve boolean, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
    -- v33.51: die Spur MIT actor_id — system_events kennt keinen Handelnden.
    insert into public.audit_log(actor_id, action, target_type, target_id, diff)
      values (v_uid, 'species_proposal_review', 'species_proposal', p_id::text,
              jsonb_build_object('approve', true, 'name', v_p.name, 'slug', v_slug, 'inserted', v_ins>0, 'note', p_note));
    return jsonb_build_object('ok', true, 'approved', true, 'inserted', v_ins>0, 'slug', v_slug);
  else
    update public.species_proposals set review_status='rejected', reviewed_by=v_uid, reviewed_at=now(), admin_note=p_note where id=p_id;
    -- v33.51: ein abgelehnter Vorschlag hatte bis hier GAR KEINE Spur — nicht
    -- einmal in system_events.
    insert into public.audit_log(actor_id, action, target_type, target_id, diff)
      values (v_uid, 'species_proposal_review', 'species_proposal', p_id::text,
              jsonb_build_object('approve', false, 'name', v_p.name, 'note', p_note));
    return jsonb_build_object('ok', true, 'approved', false);
  end if;
end; $function$;

-- 3 · Meldung erledigen — NEU als RPC, mit Spur
CREATE OR REPLACE FUNCTION public.fn_admin_review_report(p_id uuid, p_status text, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_uid uuid := (select auth.uid()); v_rows int; v_alt text;
begin
  if not public.is_admin_user() then raise exception 'admin only'; end if;
  -- Dasselbe Vokabular wie der CHECK auf user_reports.status — ein Wert
  -- daneben ist eine Antwort, kein Absturz.
  if p_status is null or p_status not in ('open','reviewed','dismissed','actioned') then
    return jsonb_build_object('ok', false, 'error', 'invalid_status');
  end if;
  select status into v_alt from public.user_reports where id = p_id;
  update public.user_reports
     set status = p_status, admin_note = coalesce(p_note, admin_note),
         reviewed_by = v_uid, reviewed_at = now()
   where id = p_id;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  insert into public.audit_log(actor_id, action, target_type, target_id, diff)
    values (v_uid, 'report_review', 'user_report', p_id::text,
            jsonb_build_object('old', v_alt, 'new', p_status, 'note', p_note));
  return jsonb_build_object('ok', true, 'status', p_status);
end; $function$;

REVOKE ALL ON FUNCTION public.fn_admin_review_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_admin_review_report(uuid, text, text) TO authenticated;

-- Gegenprobe nach dem Anwenden (nur lesend):
--   select proname, position('audit_log' in prosrc) > 0 as spur
--   from pg_proc where proname in ('fn_admin_review_species_image','fn_admin_review_species_proposal','fn_admin_review_report');
-- Erwartet: dreimal `true`. Im Admin-Panel steht danach unter „Letzte
-- Admin-Aktionen": „Spur gesehen", sobald die erste dieser Aktionen laeuft.
