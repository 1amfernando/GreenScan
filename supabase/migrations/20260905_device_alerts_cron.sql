-- ═══════════════════════════════════════════════════════════════════════════
-- Ökosystem V1 · Cron `device-alerts` (docs/OEKOSYSTEM-V1.md §3.4, §11 Idee 16)
--
-- BEWUSST NICHT ANGEWANDT (DDL ist Fernandos Handgriff). Idempotent.
-- Setzt 20260903_oekosystem_v1_geraete.sql voraus; 20260905_device_daily.sql
-- ist unabhängig davon.
--
-- Der Fund (04.09.2026): `fn_devices_mark_lost()` war definiert und von
-- KEINEM Cron aufgerufen — „Stille ist ein Alarm" (§9 Regel 4) stand nur im
-- Entwurf. Und ein Gerät, das nachts länger schläft, wäre mit dem festen
-- `3 × interval_s` jede Nacht „verloren" gewesen: jetzt zählt
-- `capabilities.expected_by`, das der Empfänger bei jedem Kontakt aus
-- `next_contact_s` schreibt (docs/GERAETE-VERTRAG.md §5).
--
-- Was der Cron alle 15 Minuten tut (Stufe 1, nur für echte Geräte):
--   1. verstummte Geräte auf `lost` setzen — und EINMAL je Tag melden
--      (`notifications`, Art `sensor_alert`, Ziel: Messwerte öffnen);
--   2. verletzte Regeln mit Aktion `notify` melden — je Regel höchstens alle
--      `cooldown_minutes` (`last_fired_at`), je Tag ein `dedup_key`;
--      `for_minutes` gilt: der Zustand muss so lange bestehen, sonst
--      „nicht prüfbar", keine Meldung.
--   Was er NICHT tut: `task:water` und `calendar` — die rechnet der Client
--   (gsSensorAufgabenAbgleich, v32.53) aus denselben Daten; die Server-Sicht
--   v_plant_tasks_due kennt das Vorziehen seit 20260904_plant_tasks_due_vorgezogen.sql.
--   Der Push selbst kommt über daily-push-checker (liest `notifications`),
--   gebremst durch `push_subscriptions.notify_sensor` — kein zweiter Push-Kanal.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Schalter je Abonnement (Muster notify_frost) — nur, wenn die Live-Tabelle da ist ──
do $$
begin
  if to_regclass('public.push_subscriptions') is not null then
    execute 'alter table public.push_subscriptions add column if not exists notify_sensor boolean not null default true';
  end if;
end $$;

-- ── 2 · Verstummt: expected_by zuerst, sonst 3 × interval_s ──────────────────
-- Rückgabetyp wechselt von integer auf setof uuid (der Cron braucht die Ids
-- für die Meldung) — Postgres erlaubt das nicht per replace, also erst weg.
drop function if exists public.fn_devices_mark_lost();
create or replace function public.fn_devices_mark_lost()
  returns setof uuid language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.devices d
     set status = 'lost', updated_at = now()
   where d.status = 'active'
     and d.kind not in ('manual','weather')
     and d.last_seen_at is not null
     and (
       (d.capabilities->>'expected_by') is not null
         and (d.capabilities->>'expected_by')::timestamptz < now()
       or
       (d.capabilities->>'expected_by') is null
         and (d.capabilities->>'interval_s') is not null
         and d.last_seen_at < now() - make_interval(secs => 3 * (d.capabilities->>'interval_s')::numeric)
     )
  returning d.id;
end;
$$;
revoke execute on function public.fn_devices_mark_lost() from public, anon, authenticated;

-- ── 3 · Der Cron-Rumpf ─────────────────────────────────────────────────────
create or replace function public.fn_device_alerts()
  returns jsonb language plpgsql security definer set search_path = public as $$
declare
  n_lost integer := 0;
  n_rules integer := 0;
  heute text := to_char(now() at time zone 'Europe/Zurich', 'YYYY-MM-DD');
  d record;
  r record;
  letzter record;
  verletzt boolean;
  seit timestamptz;
begin
  -- 1 · verstummte Geräte: markieren und EINMAL je Tag melden
  for d in
    select dev.id, dev.user_id, dev.name
      from public.fn_devices_mark_lost() lost(id)
      join public.devices dev on dev.id = lost.id
  loop
    insert into public.notifications (user_id, kind, title, body, dedup_key, link, created_at)
    values (d.user_id, 'sensor_alert', '📶 ' || d.name || ' meldet sich nicht',
            'Seit mehr als drei Meldeintervallen kein Wert — Batterie, WLAN oder Standort prüfen. Stille ist kein „alles in Ordnung".',
            'device_lost:' || d.id || ':' || heute, '/?screen=garden#geraet-' || d.id, now())
    on conflict (dedup_key) do nothing;
    n_lost := n_lost + 1;
  end loop;

  -- 2 · verletzte notify-Regeln: letzter plausibler Wert, for_minutes, cooldown, ein dedup_key je Tag
  for r in
    select rl.*, dev.name as geraet_name, dev.user_id as owner, c.unit, c.label_de
      from public.device_rules rl
      join public.devices dev on dev.id = rl.device_id
      left join public.metric_catalog c on c.key = rl.metric
     where rl.enabled
       and rl.action = 'notify'
       and rl.op in ('below','above')
       and rl.metric is not null
       and dev.status = 'active'
       and (rl.last_fired_at is null or rl.last_fired_at < now() - make_interval(mins => rl.cooldown_minutes))
  loop
    select value, ts into letzter
      from public.device_readings
     where device_id = r.device_id and metric = r.metric and quality = 2
     order by ts desc limit 1;
    if not found then continue; end if;                            -- nicht prüfbar: keine Meldung
    verletzt := case when r.op = 'below' then letzter.value < r.threshold else letzter.value > r.threshold end;
    if not verletzt then continue; end if;
    if r.for_minutes > 0 then
      -- seit wann ununterbrochen verletzt? (erster Wert nach dem letzten erfüllten)
      select max(ts) into seit from public.device_readings
       where device_id = r.device_id and metric = r.metric and quality = 2
         and (case when r.op = 'below' then value >= r.threshold else value <= r.threshold end);
      if seit is not null and letzter.ts - seit < make_interval(mins => r.for_minutes) then continue; end if;
      if seit is null then
        select min(ts) into seit from public.device_readings where device_id = r.device_id and metric = r.metric and quality = 2;
        if letzter.ts - seit < make_interval(mins => r.for_minutes) then continue; end if;
      end if;
    end if;
    insert into public.notifications (user_id, kind, title, body, dedup_key, link, created_at)
    values (r.owner, 'sensor_alert',
            '📶 ' || r.geraet_name || ': ' || coalesce(r.label_de, r.metric) || ' ' || case when r.op = 'below' then 'unter' else 'über' end || ' ' || r.threshold || coalesce(' ' || r.unit, ''),
            'Zuletzt ' || letzter.value || coalesce(' ' || r.unit, '') || ' um ' || to_char(letzter.ts at time zone 'Europe/Zurich', 'HH24:MI') || ' — Schwelle ' || r.threshold || '.',
            'rule:' || r.id || ':' || heute, '/?screen=garden#geraet-' || r.device_id, now())
    on conflict (dedup_key) do nothing;
    update public.device_rules set last_fired_at = now(), updated_at = now() where id = r.id;
    n_rules := n_rules + 1;
  end loop;

  return jsonb_build_object('lost', n_lost, 'rules', n_rules, 'at', now());
end;
$$;
revoke execute on function public.fn_device_alerts() from public, anon, authenticated;

-- ── 4 · Cron alle 15 Minuten ────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('device-alerts') where exists (select 1 from cron.job where jobname = 'device-alerts');
    perform cron.schedule('device-alerts', '*/15 * * * *', $cron$select public.fn_device_alerts();$cron$);
  end if;
end $$;

comment on function public.fn_device_alerts() is
  'Cron device-alerts (alle 15 Min): verstummte Geräte → lost + Meldung je Tag; verletzte notify-Regeln → Meldung mit cooldown und for_minutes. task:water/calendar rechnet der Client. docs/OEKOSYSTEM-V1.md §3.4, §11 Idee 16.';
