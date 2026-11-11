-- v31.36: fn_mkt_increment_views gegen anonyme Aufrufe absichern. NOCH NICHT ANGEWENDET.
--
-- Gefunden am 01.09.2026 beim Durchgehen der 16 anon-ausfuehrbaren
-- SECURITY-DEFINER-Funktionen (Supabase-Security-Advisor). Der Zaehler war die
-- einzige davon, die SCHREIBT und sich dabei nicht absichert:
--
--   UPDATE marketplace_listings SET views = COALESCE(views,0)+1 WHERE id = p_listing_id;
--
-- Der Anon-Key ist oeffentlich (by design, RLS schuetzt die Daten). Damit kann
-- jeder ohne Konto die Aufrufzahl beliebiger Inserate hochzaehlen — in einer
-- Schleife auch als kleine Schreiblast. Kein Datenabfluss, kein Datenverlust;
-- eine irrefuehrende Kennzahl und eine unnoetige offene Schreibstelle.
--
-- Zum Vergleich: fn_quiz_record_answer macht es richtig und beginnt mit
--   v_uid uuid := (SELECT auth.uid());
--   IF v_uid IS NULL THEN RETURN; END IF;
-- Genau dieses Muster kommt hier dazu.
--
-- Bricht nichts: der einzige Aufrufer ist openListingDetail() (index.html
-- ~Z. 37750), erreichbar aus Marktplatz-Liste und Home-Widget. Beide setzen
-- eine Anmeldung voraus — der Gast-Modus wurde in v25.33 abgeschaltet.
-- Ein anonymer Aufruf tut danach schlicht nichts, statt zu schreiben.
--
-- Idempotent (CREATE OR REPLACE). Rueckgaengig: dieselbe Funktion ohne die
-- drei IF-Zeilen neu anlegen.

create or replace function public.fn_mkt_increment_views(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := (select auth.uid());
begin
  -- v31.36: ohne angemeldeten Nutzer nichts tun (vorher: jeder Aufruf schrieb).
  if v_uid is null then return; end if;

  update marketplace_listings
  set views = coalesce(views, 0) + 1
  where id = p_listing_id;
end $function$;

-- Verifikation nach dem Anwenden:
--   select pg_get_functiondef(p.oid)
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname='public' and p.proname='fn_mkt_increment_views';
-- Erwartet: enthaelt "if v_uid is null then return".
