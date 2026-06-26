-- ============================================================================
-- v30_56_admin_moderation_notify — Admins/Staff bei neuen moderationspflichtigen
-- Inhalten (user_reports / user_submissions / feedback_items) in-app benachrichtigen.
--
-- BEFUND: Es gab KEINEN Trigger/RPC, der bei neuen Meldungen/Einsendungen einen
-- Admin informiert (information_schema.triggers zeigte nur trg_marketplace_updated_at).
-- Folge: Inhalte lagen ungesehen in der Moderations-Queue (fn_admin_reports_list),
-- analog zu den 20 Arten-Vorschlägen, die 7 Wochen niemand sah (→ v30_55b).
--
-- KONVENTION (gespiegelt von v30_55b fn_notify_admins_pending_proposals):
--   * Direkter Upsert in public.notifications — bewusst NICHT public.fn_create_notification.
--     Begründung: fn_create_notification macht dedup-and-skip (60-Min) und kann den
--     Count einer bestehenden Notif NICHT aktualisieren → "X neue Meldungen heute"
--     würde auf dem ersten Tageswert einfrieren. Der `on conflict do update`-Upsert
--     refresht Titel/Count/Timestamp → die Notif bubblet im Glocken-Panel wieder hoch
--     (Client-Frischefilter `ts <= seenServerTs`, gsCollectNotifs ~Z.22054).
--   * notifications.dedup_key ist GLOBAL unique → dedup_key MUSS user-spezifisch sein
--     (sonst Kollision bei mehreren Admins). Schema: admin_mod_<tabelle>_<datum>_<adminId>.
--   * EINE gebündelte Notif pro Admin/Staff pro Tabelle pro Tag statt eine pro Insert
--     → keine Flut (Mission: reine Betriebs-Info, kein Spam, keine Sales-Sprache).
--
-- ICON/FRONTEND: gsCollectNotifs extrahiert das erste Emoji aus dem Title als Icon
--   (~Z.22057). Titel beginnen mit 🚩/📥/💬 ⇒ KEINE Icon-Map-Erweiterung, KEIN
--   Frontend-v-Bump nötig (backend-only Referenz-Migration).
-- LINK: `#settings` wäre ein toter Klick (routet zu switchTab('settings'), aber
--   Settings öffnet via menuNav, Admin-Panel via openAdminPanel()). Daher link=null
--   (Action = nur closeMainMenu) + Hinweis im Body — kein Dead-Control (HL#33/#34).
--
-- SICHERHEIT: Trigger-Fn = SECURITY DEFINER (schreibt notifications für FREMDE
--   User/Admins, muss deren RLS umgehen — wie fn_create_notification) + fixer
--   search_path + REVOKE EXECUTE FROM public/anon/authenticated (Trigger-Mechanismus
--   prüft EXECUTE nicht → Revoke gefahrlos, HL#26). Statement-level Trigger
--   (`for each statement`) → flood-safe bei Bulk-Insert, Count bleibt akkurat (neu
--   eingefügte Rows sind in derselben Transaktion für die Zählung sichtbar).
--
-- HL#14 (Spec-Schema vs DB-Realität): user_reports + feedback_items Schema im Repo
--   bestätigt (status/created_at). user_submissions wurde out-of-repo via MCP angelegt;
--   `created_at` ist NICHT bestätigt → Trigger wird per information_schema-Pre-Flight
--   nur angehängt, wenn die Spalte existiert (sonst RAISE NOTICE, kein Build-and-Fail).
--
-- VERIFIKATION (HL#16, als echter Admin-JWT auszuführen — siehe Block am Dateiende;
--   in dieser Session NICHT ausgeführt, da keine Supabase-MCP/psql-Verbindung verfügbar).
-- Stand 2026-06-26. Anwenden via Supabase-MCP/Dashboard (wie v30_55b).
-- ============================================================================

-- 1) Trigger-Funktion — verzweigt über TG_TABLE_NAME ----------------------------
create or replace function public.fn_notify_admins_new_moderation()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_kind  text;
  v_emoji text;
  v_sg    text;   -- Singular-Nomen
  v_pl    text;   -- Plural-Nomen
  v_n     int := 0;
  v_title text;
  v_body  text;
begin
  -- Quelle → Notif-Metadaten (Emoji voran ⇒ Frontend-Icon ohne Map-Eintrag).
  if tg_table_name = 'user_reports' then
    v_kind := 'admin_report';     v_emoji := '🚩';
    v_sg := 'neue Meldung';       v_pl := 'neue Meldungen';
    select count(*) into v_n from public.user_reports
      where status = 'open' and created_at >= current_date and created_at < current_date + 1;
  elsif tg_table_name = 'user_submissions' then
    v_kind := 'admin_submission'; v_emoji := '📥';
    v_sg := 'neue Einsendung';    v_pl := 'neue Einsendungen';
    select count(*) into v_n from public.user_submissions
      where created_at >= current_date and created_at < current_date + 1;
  elsif tg_table_name = 'feedback_items' then
    v_kind := 'admin_submission'; v_emoji := '💬';
    v_sg := 'neue Rückmeldung';   v_pl := 'neue Rückmeldungen';
    select count(*) into v_n from public.feedback_items
      where created_at >= current_date and created_at < current_date + 1;
  else
    return null;  -- unbekannte Quelle: nichts tun
  end if;

  if v_n < 1 then v_n := 1; end if;  -- Untergrenze (Statement-Trigger feuert auch bei on-conflict-do-nothing)
  v_title := v_emoji || ' ' || v_n || ' '
             || (case when v_n = 1 then v_sg else v_pl end) || ' heute';
  v_body  := 'Zur Moderation im Admin-Panel (Einstellungen ▸ Admin) prüfen.';

  -- Eine sich aktualisierende Notif pro Admin/Staff pro Tabelle pro Tag.
  insert into public.notifications(user_id, kind, title, body, link, dedup_key)
  select pr.id, v_kind, v_title, v_body, null,
         'admin_mod_' || tg_table_name || '_' || current_date::text || '_' || pr.id::text
  from public.profiles pr
  where pr.role in ('admin','staff') or pr.is_admin = true
  on conflict (dedup_key) do update
    set title = excluded.title, body = excluded.body, kind = excluded.kind,
        is_read = false, read_at = null, created_at = now();

  return null;  -- AFTER-Trigger: Rückgabewert wird ignoriert
end;
$function$;

revoke execute on function public.fn_notify_admins_new_moderation() from public, anon, authenticated;

-- 2) AFTER-INSERT-Trigger anhängen — mit Schema-Pre-Flight (HL#14) --------------
do $$
begin
  -- user_reports: Schema im Repo bestätigt (status + created_at) → Pflicht-Quelle.
  if to_regclass('public.user_reports') is not null then
    drop trigger if exists trg_notify_admins_user_reports on public.user_reports;
    create trigger trg_notify_admins_user_reports
      after insert on public.user_reports
      for each statement execute function public.fn_notify_admins_new_moderation();
  else
    raise notice 'user_reports fehlt — Trigger uebersprungen';
  end if;

  -- user_submissions: Tabelle existiert (RLS-Policy "subs insert self"), aber
  -- created_at out-of-repo unbestätigt → nur anhängen wenn die Spalte da ist.
  if to_regclass('public.user_submissions') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'user_submissions'
         and column_name = 'created_at'
     ) then
    drop trigger if exists trg_notify_admins_user_submissions on public.user_submissions;
    create trigger trg_notify_admins_user_submissions
      after insert on public.user_submissions
      for each statement execute function public.fn_notify_admins_new_moderation();
  else
    raise notice 'user_submissions: Tabelle/created_at nicht bestaetigt — Trigger uebersprungen (HL14)';
  end if;

  -- feedback_items: created_at im Repo bestätigt (v_feedback_public) → optional.
  if to_regclass('public.feedback_items') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'feedback_items'
         and column_name = 'created_at'
     ) then
    drop trigger if exists trg_notify_admins_feedback_items on public.feedback_items;
    create trigger trg_notify_admins_feedback_items
      after insert on public.feedback_items
      for each statement execute function public.fn_notify_admins_new_moderation();
  else
    raise notice 'feedback_items: Tabelle/created_at nicht bestaetigt — Trigger uebersprungen';
  end if;
end $$;

-- 3) Post-Condition-Check (nicht-mutierend) ------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.triggers
                 where trigger_name = 'trg_notify_admins_user_reports') then
    raise warning 'trg_notify_admins_user_reports wurde NICHT erstellt — bitte prüfen';
  end if;
end $$;

-- ============================================================================
-- HL#16-VERIFIKATION (als echter Admin-JWT ausführen; nicht Teil der Migration):
--
--   -- a) Voraussetzung: aktueller User ist admin/staff
--   select public.is_admin_user();           -- erwartet: true
--
--   -- b) Test-Insert (als beliebiger authenticated User, via fn_report):
--   select public.fn_report('listing', 'test-ref-VERIFY', 'HL16 Trigger-Test');
--
--   -- c) Erwartung: jeder Admin/Staff hat genau EINE Notif für heute:
--   select user_id, kind, title, dedup_key, is_read
--   from public.notifications
--   where kind in ('admin_report','admin_submission')
--     and dedup_key like 'admin_mod_user_reports_' || current_date::text || '_%';
--   -- → title z.B. "🚩 1 neue Meldung heute", link null.
--
--   -- d) Zweiter Insert (anderer target_ref) refresht denselben dedup_key auf "2 …":
--   select public.fn_report('post', 'test-ref-VERIFY-2', 'HL16 Trigger-Test 2');
--   -- → gleiche eine Notif/Admin, Titel jetzt "🚩 2 neue Meldungen heute".
--
--   -- e) Aufräumen:
--   delete from public.user_reports where target_ref like 'test-ref-VERIFY%';
--   delete from public.notifications
--     where dedup_key like 'admin_mod_user_reports_' || current_date::text || '_%';
-- ============================================================================
