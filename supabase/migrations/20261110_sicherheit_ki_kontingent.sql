-- v33.59 · Ein KI-Aufruf wird VOR dem Aufruf reserviert — in EINER Anweisung.
--
-- Gemessen am 10.11.2026 (Repo + Live-Momentaufnahme, nur lesend):
--
--   ai-proxy             zaehlt ai_usage, ruft Anthropic (Sekunden), bucht DANACH
--                        (nicht abgewartet) — N parallele Anfragen lesen alle
--                        denselben Stand; ein Fehler beim Zaehlen galt als „0".
--   plan-iterate         keine Bremse ausser iterations.length — eine Spalte, die
--                        der Besitzer per garden_plans_owner_all selbst schreibt.
--   garden-scan-analyze, plant-doctor-diagnose, pest-identify, mushroom-identify
--                        nur fn_check_rate_limit je Stunde, fail-open, kein Plan.
--   fn_quota_consume     rechnet mit auth.uid() — fuer einen bestimmten Nutzer aus
--                        einer Edge-Function (Service-Role) nicht rufbar, und der
--                        CLIENT ruft sie, nach dem Aufruf.
--
-- Deshalb zwei neue Funktionen, NUR fuer service_role. Sie zaehlen in der
-- vorhandenen Tabelle feature_usage (PK user_id, feature, period_type,
-- period_start; RLS: nur eigenes Lesen — ein Nutzer kann seinen Zaehler nicht
-- zuruecksetzen) unter dem Namen 'ki:<function>', getrennt von den
-- Client-Zaehlern ('scan', 'lina', 'doctor', …). Der Tag ist der Schweizer Tag
-- wie in fn_quota_consume.
--
-- Atomar: INSERT … ON CONFLICT DO UPDATE … WHERE used < limit RETURNING sperrt
-- die Zeile; 20 gleichzeitige Reservierungen bei Limit 15 ergeben genau 15
-- Zusagen (scripts/rls/50_ki_kontingent.js). Kein Ergebnis = NEIN.
--
-- Die Limits je Plan rechnet die Edge-Function (supabase/functions/_shared/ki_tor.mjs,
-- KI_GRENZEN) — der Plan kommt aus v_user_entitlements mit dem Token der Person.
--
-- Idempotent (CREATE OR REPLACE, REVOKE/GRANT). NICHT angewandt.
-- Reihenfolge: diese Migration ZUERST, dann die sechs Functions ausliefern —
-- sonst antworten sie fail-closed mit 503 (die RPC fehlt).

create or replace function public.fn_ai_kontingent_reservieren(p_user uuid, p_function text, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_day  date := (now() at time zone 'Europe/Zurich')::date;
  v_used integer;
begin
  if p_user is null or p_limit is null or p_limit < 1
     or p_function is null or p_function !~ '^[a-z0-9-]{1,40}$' then
    return false;
  end if;
  insert into public.feature_usage (user_id, feature, period_type, period_start, used)
    values (p_user, 'ki:' || p_function, 'day', v_day, 1)
  on conflict (user_id, feature, period_type, period_start)
    do update set used = public.feature_usage.used + 1, updated_at = now()
    where public.feature_usage.used < p_limit
  returning used into v_used;
  return v_used is not null;
end $$;

-- Rueckgabe, wenn die KI gar nicht geantwortet hat (Netz, 5xx, 429 des Anbieters).
create or replace function public.fn_ai_kontingent_freigeben(p_user uuid, p_function text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.feature_usage
     set used = greatest(0, used - 1), updated_at = now()
   where user_id = p_user and feature = 'ki:' || p_function and period_type = 'day'
     and period_start = (now() at time zone 'Europe/Zurich')::date;
end $$;

-- Nur der Server: die Vorgabe-Rechte (pg_default_acl) geben neuen Funktionen
-- EXECUTE fuer anon und authenticated — ausdruecklich zuruecknehmen.
revoke all on function public.fn_ai_kontingent_reservieren(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.fn_ai_kontingent_freigeben(uuid, text) from public, anon, authenticated;
grant execute on function public.fn_ai_kontingent_reservieren(uuid, text, integer) to service_role;
grant execute on function public.fn_ai_kontingent_freigeben(uuid, text) to service_role;
