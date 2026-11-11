-- ══════════════════════════════════════════════════════════════════════════
-- v30.95 · Zwei Stellen, die grün melden und trotzdem nichts bewirken
-- ══════════════════════════════════════════════════════════════════════════
--
-- TEIL A · fn_log_ai_usage buchte systematisch CHF 0.00
--
--   `if p_cost_chf is not null … elsif p_model is not null … else v_cost := 0`
--   Beide Parameter haben DEFAULT NULL, das Weglassen ist also legal und läuft
--   still in den else-Zweig. Alle fünf Edge-Functions übergaben nur
--   p_edge_fn/p_tokens_in/p_tokens_out — knowledge-bulk-gen hat so 111 echte
--   Calls mit 471'430 Output-Token über 101 Tage mit 0.0000 CHF gebucht.
--   fn_finance_snapshot rechnet v_cov := v_mrr / v_ai_30 und meldete dadurch
--   eine um Faktor ~7,5 zu optimistische Deckung (95.9 statt ~12.7).
--
--   Der Code-Teil (p_model durchreichen) steckt in v30.95 in allen fünf
--   Funktionen. Hier kommt der Gürtel zum Hosenträger: der else-Zweig bucht
--   nicht mehr 0, sondern konservativ zum Sonnet-Tarif und hinterlässt eine
--   Spur in system_events. Ein vergessener Parameter fällt damit auf, statt
--   die Kostenrechnung still zu schönen.
--   (Bewusst KEINE Nachbuchung der Vergangenheit — geschätzte Zahlen in einer
--    Ist-Kostentabelle wären schlimmer als die Lücke.)
--
-- TEIL B · Die Cron-Überwachung ist blind für alle HTTP-Jobs
--
--   fn_monitor_health filtert ausschliesslich
--     FROM cron.job_run_details WHERE status IS DISTINCT FROM 'succeeded'
--   net.http_post ist aber fire-and-forget: der Aufruf kehrt sofort zurück,
--   der Cron-Lauf gilt IMMER als 'succeeded' — unabhängig von Timeout, 403
--   oder 500. Beweis am lebenden Objekt (2026-08-31): knowledge-growth-daily
--   lief 21 ms und meldete 'succeeded', während net._http_response id=1806
--   zeitgleich 'Timeout of 50000 ms reached' verzeichnete.
--
--   Niemand im Projekt liest net._http_response. Und die Blindheit ist total:
--   fn_admin_ops_digest (v_cron_fail24) und fn_admin_cron_health hängen an
--   derselben Quelle — alle drei Monitoring-Oberflächen zeigen dieselbe
--   falsche grüne Ampel.
--
--   Betroffen: daily-push-morning, daily-push-evening, weather-alert-3h,
--   key-health-daily, engagement-push-3h und der net.http_post in
--   fn_knowledge_growth_daily.
--
--   Ehrlichkeit zur Beweislage: im erhaltenen Fenster ist KEIN echter
--   HTTP-Ausfall nachweisbar (der Timeout oben war ein pg_net-Client-Timeout
--   bei erfolgreicher Arbeit — forest_garden_design bekam an dem Tag 11 neue
--   Zeilen um 03:31:17). Das Risiko ist strukturell und zukünftig, nicht akut:
--   wenn morgen ein Secret rotiert oder ein Deploy bricht, laufen alle Jobs
--   weiter grün und niemand erfährt es.
--
--   Fix: zweiter Scan über net._http_response im selben 75-Minuten-Fenster,
--   PLUS ein Staleness-Check. Letzterer fängt die einzige Fehlerklasse ab, die
--   durch beide Netze fällt: ein Job, der gar nicht mehr startet, erzeugt auch
--   keine Fehlzeile.
--   pg_net räumt seine Antworten nach ~6 h ab (aktuell 6 Zeilen über ein
--   4-Stunden-Fenster) — der Wächter läuft stündlich, das reicht.
--
-- Idempotent: nur CREATE OR REPLACE.
-- ══════════════════════════════════════════════════════════════════════════

-- Alles-oder-nichts: ein Syntaxfehler darf nicht die Haelfte der Datei anwenden.
BEGIN;

-- ── TEIL A ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_log_ai_usage(
  p_edge_fn text, p_tokens_in integer, p_tokens_out integer,
  p_cost_chf numeric DEFAULT NULL::numeric, p_model text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_in numeric; v_out numeric; v_cost numeric; v_guessed boolean := false;
begin
  if p_cost_chf is not null then
    v_cost := p_cost_chf;
  else
    -- CHF pro 1M Token (≈ Anthropic-Listenpreise × USD→CHF, konservativ aufgerundet)
    if p_model is null then
      -- v30.95: frueher `v_cost := 0`. Ein vergessener Parameter hat damit die
      -- Kostenrechnung still auf null gezogen. Jetzt: konservativ schaetzen und
      -- sichtbar machen — lieber zu hoch gebucht als unsichtbar zu niedrig.
      v_in := 2.7; v_out := 13.2; v_guessed := true;
    elsif p_model ilike '%haiku%' then v_in := 0.9;  v_out := 4.4;
    elsif p_model ilike '%opus%'  then v_in := 13.5; v_out := 67.5;
    else v_in := 2.7; v_out := 13.2; -- sonnet / unbekannt → konservativ
    end if;
    v_cost := (coalesce(p_tokens_in,0)::numeric / 1000000.0 * v_in)
            + (coalesce(p_tokens_out,0)::numeric / 1000000.0 * v_out);
  end if;

  insert into ai_daily_usage (date, edge_fn, total_tokens_in, total_tokens_out, total_cost_chf, call_count, updated_at)
  values (current_date, p_edge_fn, coalesce(p_tokens_in,0), coalesce(p_tokens_out,0), v_cost, 1, now())
  on conflict (date, edge_fn) do update set
    total_tokens_in  = ai_daily_usage.total_tokens_in  + excluded.total_tokens_in,
    total_tokens_out = ai_daily_usage.total_tokens_out + excluded.total_tokens_out,
    total_cost_chf   = ai_daily_usage.total_cost_chf   + v_cost,
    call_count       = ai_daily_usage.call_count + 1,
    updated_at       = now();

  -- Einmal pro Tag und Funktion melden, dass geschaetzt werden musste.
  if v_guessed then
    begin
      insert into public.system_events(severity, source, event, detail)
      select 'warn', 'ai_usage', 'model_missing',
             jsonb_build_object('edge_fn', p_edge_fn, 'hint', 'p_model fehlt -> Kosten geschaetzt (Sonnet-Tarif)')
      where not exists (
        select 1 from public.system_events
        where source='ai_usage' and event='model_missing'
          and detail->>'edge_fn' = p_edge_fn
          and created_at::date = current_date
      );
    exception when others then null;  -- Protokollieren darf nie stoeren
    end;
  end if;
end;
$function$;

COMMENT ON FUNCTION public.fn_log_ai_usage(text,integer,integer,numeric,text) IS
  'v30.95: fehlendes p_model bucht nicht mehr 0.00 CHF, sondern konservativ zum Sonnet-Tarif und meldet einmal taeglich nach system_events.';

-- ── TEIL B ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_monitor_health()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron', 'pg_catalog'
AS $function$
DECLARE _r record; _n integer := 0;
BEGIN
  -- (1) unveraendert: echte Cron-Fehlschlaege
  FOR _r IN
    SELECT j.jobname, d.status, d.return_message, d.start_time
      FROM cron.job_run_details d
      JOIN cron.job j ON j.jobid = d.jobid
     WHERE d.start_time > now() - interval '75 minutes'
       AND d.status IS DISTINCT FROM 'succeeded'
       AND d.status IS DISTINCT FROM 'running'
  LOOP
    INSERT INTO public.system_events(severity, source, event, detail)
    VALUES ('error', 'cron_monitor', 'job_failed',
            jsonb_build_object('job', _r.jobname, 'status', _r.status,
                               'message', left(coalesce(_r.return_message,''), 500),
                               'at', _r.start_time));
    _n := _n + 1;
  END LOOP;

  -- (2) v30.95 NEU: HTTP-Ergebnisse. net.http_post ist fire-and-forget — der
  -- Cron meldet 'succeeded', egal was der Server antwortet. Ohne diesen Scan
  -- ist jeder der 5 HTTP-Jobs unbeobachtet.
  BEGIN
    FOR _r IN
      SELECT r.id, r.status_code, r.error_msg, r.created
        FROM net._http_response r
       WHERE r.created > now() - interval '75 minutes'
         AND (r.status_code IS NULL OR r.status_code >= 400)
    LOOP
      INSERT INTO public.system_events(severity, source, event, detail)
      SELECT 'error', 'cron_monitor', 'http_job_failed',
             jsonb_build_object('response_id', _r.id, 'status_code', _r.status_code,
                                'error', left(coalesce(_r.error_msg,''), 500),
                                'at', _r.created)
      -- ueber die response-id deduplizieren: der Waechter laeuft stuendlich,
      -- das 75-Minuten-Fenster ueberlappt also bewusst.
      WHERE NOT EXISTS (
        SELECT 1 FROM public.system_events e
         WHERE e.source='cron_monitor' AND e.event='http_job_failed'
           AND (e.detail->>'response_id')::bigint = _r.id
      );
      _n := _n + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    -- net._http_response ist pg_net-intern; faellt die Extension weg, darf der
    -- Waechter nicht mit ihr sterben.
    RAISE WARNING 'fn_monitor_health http-scan: %', SQLERRM;
  END;

  -- (3) v30.95 NEU: Staleness. Die einzige Fehlerklasse, die durch (1) UND (2)
  -- faellt: ein Job, der gar nicht mehr startet, erzeugt keine Fehlzeile.
  BEGIN
    FOR _r IN
      SELECT j.jobname, max(d.start_time) AS letzter
        FROM cron.job j
        LEFT JOIN cron.job_run_details d ON d.jobid = j.jobid
       WHERE j.active
       GROUP BY j.jobname
      HAVING max(d.start_time) IS NULL
          OR max(d.start_time) < now() - interval '49 hours'   -- 2× taeglich als Obergrenze
    LOOP
      INSERT INTO public.system_events(severity, source, event, detail)
      SELECT 'error', 'cron_monitor', 'job_stale',
             jsonb_build_object('job', _r.jobname, 'last_run', _r.letzter)
      WHERE NOT EXISTS (   -- hoechstens einmal taeglich je Job melden
        SELECT 1 FROM public.system_events e
         WHERE e.source='cron_monitor' AND e.event='job_stale'
           AND e.detail->>'job' = _r.jobname
           AND e.created_at::date = current_date
      );
      _n := _n + 1;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'fn_monitor_health stale-scan: %', SQLERRM;
  END;

  RETURN _n;
END; $function$;

COMMENT ON FUNCTION public.fn_monitor_health() IS
  'v30.95: prueft zusaetzlich net._http_response (net.http_post ist fire-and-forget, der Cron meldet immer succeeded) und meldet Jobs, die seit ueber 49 h nicht mehr gelaufen sind.';

COMMIT;
