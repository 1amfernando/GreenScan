-- v30.55: Autonome Admin-Benachrichtigung bei wartenden Arten-Vorschlägen — angewendet 2026-06-26 via MCP.
-- Täglich (kein Spam — Mission), per-User-dedup_key + Upsert: immer EINE aktuelle Notif pro Admin.
-- Hintergrund: 20 Vorschläge lagen 7 Wochen ungesehen, weil niemand benachrichtigt wurde.
-- notifications.dedup_key ist GLOBAL unique → Key muss user-spezifisch sein (sonst Kollision bei 2 Admins).

create or replace function public.fn_notify_admins_pending_proposals()
returns int language plpgsql security definer set search_path to 'public','pg_temp' as $function$
declare v_n int; v_made int := 0;
begin
  select count(*) into v_n from public.species_proposals where review_status='pending';
  if v_n < 1 then
    delete from public.notifications where kind='admin_proposals' and is_read=false;
    return 0;
  end if;
  insert into public.notifications(user_id, kind, title, body, link, dedup_key)
  select p.id, 'admin_proposals',
         '🧬 ' || v_n || (case when v_n=1 then ' Arten-Vorschlag wartet' else ' Arten-Vorschläge warten' end) || ' auf Prüfung',
         'Gescannte Arten möchten in die Datenbank aufgenommen werden. Im Admin-Panel mit einem Klick prüfen & freigeben.',
         null, 'admin_pending_proposals_' || p.id::text
  from public.profiles p
  where p.is_admin = true or p.role = 'admin'
  on conflict (dedup_key) do update
    set title = excluded.title, body = excluded.body, kind = excluded.kind,
        is_read = false, read_at = null, created_at = now();
  get diagnostics v_made = row_count;
  return v_made;
end; $function$;

revoke execute on function public.fn_notify_admins_pending_proposals() from public, anon, authenticated;

select cron.schedule('proposals-notify-daily', '5 6 * * *', $$select public.fn_notify_admins_pending_proposals();$$);

-- Sofort einmal seeden, damit wartende Vorschläge JETZT in der Glocke erscheinen.
select public.fn_notify_admins_pending_proposals() as seeded;
