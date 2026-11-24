-- 20261110_sicherheit_funktionen.sql — v33.59: Datenbank-Funktionen, die einem Parameter
-- vertrauen oder zu weit offen sind (Sicherheitspruefung, Gruppe q1).
--
-- GEMESSEN am 10.11.2026, LIVE, nur lesend (pg_proc mit ACL und Quelltext, pg_policies,
-- cron.job, pg_trigger). Alle hier genannten Funktionen sind SECURITY DEFINER.
--
--   * fn_quest_increment(_user_id, …) — fuer authenticated ausfuehrbar, kein Bezug auf
--     auth.uid(): jeder konnte Quest-Fortschritt, XP und Mitteilungen FREMDER Konten setzen.
--     Einzige Aufrufer: die Trigger fn_quest_track_post / fn_quest_track_scan (laufen als
--     Eigentuemer postgres und brauchen kein GRANT).
--   * fn_check_rate_limit(p_bucket, …) — fuer authenticated ausfuehrbar, Eimer frei
--     waehlbar: jeder konnte einen anderen fuer eine Stunde von KI-Diagnose, Gutschein,
--     Melden und Bildbeitrag aussperren. Aufrufer: vier Edge-Functions mit service_role,
--     fn_report / fn_redeem_voucher / fn_contribute_species_image (DEFINER, Eigentuemer
--     postgres). Die App ruft sie nicht.
--   * fn_scan_cache_put + Policy scan_cache_read_all — ein globaler Scan-Cache, den jedes
--     Konto befuellen und jeder (auch anon) lesen konnte: ein untergeschobenes Ergebnis
--     (Art, Giftstufe) landete bei anderen als Scan-Ergebnis ohne KI-Aufruf. Die App liest
--     und schreibt ihn ab v33.59 nicht mehr.
--   * fn_knowledge_grow — fuer authenticated ausfuehrbar, ohne Admin-Pruefung, mit dem
--     frueher geleakten X-Admin-Secret im KLARTEXT im Rumpf; loest ausgehende Anfragen an
--     knowledge-bulk-gen aus. Kein Aufrufer (App 0, Edge 0, Cron nur fn_knowledge_growth_daily).
--   * fn_eng_battle_waiting / _class_new / _class_submissions / _doctor_due,
--     scans_this_month, gs_abo_can_use — Leser mit fremder Nutzer-Id, fuer authenticated
--     frei. Einziger Aufrufer der fn_eng_*: engagement-push-checker (service_role);
--     scans_this_month und gs_abo_can_use haben keinen Aufrufer.
--   * fn_log_ai_usage — nahm beliebige (auch negative) Kosten und Funktionsnamen an;
--     ai_daily_usage war fuer jeden Angemeldeten lesbar (Policy USING true).
--   * fn_marketplace_search — gab anon den E-Mail-Lokalteil eines Verkaeufers ohne
--     Anzeigenamen; fn_knowledge_search — LIMIT ohne Deckel.
--   * fn_snapshot_index_usage — Cron-Wartung, fuer authenticated frei (jeder Aufruf
--     schreibt eine Zeile je Index).
--   * fn_notify_friend_request — der frei waehlbare display_name ging ungedeckelt, mit
--     Zeilenumbruechen und Steuerzeichen, als Titel in die Mitteilung eines Fremden.
--   * fn_contribute_species_image — nahm jede http(s)-Adresse an; ein freigegebenes
--     Arten-Bild konnte auf einem fremden Server liegen.
--
-- WAS DIESE DATEI AENDERT (Signaturen bleiben alle gleich):
--   1. EXECUTE nur noch fuer service_role: fn_quest_increment, fn_check_rate_limit,
--      fn_scan_cache_put, fn_knowledge_grow, fn_eng_* (4), scans_this_month,
--      gs_abo_can_use, fn_snapshot_index_usage. Aufrufe aus anderen DEFINER-Funktionen,
--      aus Triggern und aus pg_cron laufen als postgres und gehen weiter.
--   2. fn_quest_increment klemmt _delta auf 0..10.
--   3. scan_cache: Lese-Policy weg, Tabellenrechte fuer anon/authenticated weg. Die
--      Daten bleiben liegen (fn_cleanup_scan_cache raeumt nach 30 Tagen).
--   4. fn_knowledge_grow: das Geheimnis kommt aus app_settings.knowledge_gen_secret
--      (wie fn_knowledge_growth_daily), count 1..15, Thema auf 64 Zeichen; Aufruf nur
--      ohne Nutzer-Sitzung oder als service_role.
--   5. fn_log_ai_usage: fuer Aufrufer mit Nutzer-Sitzung (die App, _gsLogAiUsage)
--      zaehlt p_cost_chf nicht, der Name wird bereinigt und beginnt mit „client",
--      Tokens 0..200'000 / 0..64'000, hoechstens 600 Buchungen je Nutzer und Stunde.
--      service_role (Edge-Functions) unveraendert. ai_daily_usage lesen nur Admins.
--      Ohne p_model wird (wie in der nicht angewandten 20260831_kosten_und_cron_
--      wachhund_v30_95.sql) zum Sonnet-Tarif geschaetzt und einmal taeglich nach
--      system_events gemeldet; die Marke „v33.59 ai_usage_sperre" laesst 20260831 die
--      Funktion stehen — EINE Fassung, egal in welcher Reihenfolge (rls/70_reihenfolge.js).
--   6. fn_marketplace_search: Verkaeufer ohne Anzeigenamen heisst „Anonym" — fuer alle.
--      fn_knowledge_search: LIMIT 1..100.
--   7. fn_notify_friend_request: Name ohne Steuer-/Richtungszeichen, hoechstens 40 Zeichen.
--   8. fn_contribute_species_image: nur Adressen im eigenen Ordner des Buckets
--      species-images (…/storage/v1/object/public/species-images/<auth.uid()>/<datei>);
--      storage_path wird aus der Adresse gebildet.
--
-- WAS DIE APP MERKT: nichts, solange sie die Wege nimmt, die sie heute nimmt. Neue
-- KI-Kostenzeilen aus der App heissen „client:<label>" statt „<label>", wenn das Label
-- nicht schon mit „client" anfaengt. Ein Marktplatz-Verkaeufer ohne Anzeigenamen heisst
-- „Anonym" statt nach dem Anfang seiner E-Mail-Adresse.
--
-- NICHT ANGEWANDT — das macht Fernando (docs/FUER-FERNANDO.md). Idempotent; nachgespielt
-- in scripts/rls/10_funktionen.js (lokales Postgres, zweimal eingespielt, mit Gegenproben).

-- ── 1. Nur noch service_role ────────────────────────────────────────────────
do $$
declare s text;
begin
  foreach s in array array[
    'public.fn_quest_increment(uuid,text,integer)',
    'public.fn_check_rate_limit(text,text,integer)',
    'public.fn_scan_cache_put(text,jsonb)',
    'public.fn_knowledge_grow(text,integer)',
    'public.fn_eng_battle_waiting(uuid,integer)',
    'public.fn_eng_class_new(uuid,integer)',
    'public.fn_eng_class_submissions(uuid,integer)',
    'public.fn_eng_doctor_due(uuid)',
    'public.scans_this_month(uuid)',
    'public.gs_abo_can_use(uuid,text)',
    'public.fn_snapshot_index_usage()'
  ] loop
    if to_regprocedure(s) is not null then
      execute format('revoke all on function %s from public, anon, authenticated', s);
      execute format('grant execute on function %s to service_role', s);
    end if;
  end loop;
end $$;

-- ── 2. fn_quest_increment: _delta geklemmt (Rumpf sonst wie live) ───────────
CREATE OR REPLACE FUNCTION public.fn_quest_increment(_user_id uuid, _metric text, _delta integer DEFAULT 1)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE _q record;
BEGIN
  -- v33.59: nur noch Trigger/Server rufen; ein Schritt ist hoechstens 10.
  _delta := GREATEST(0, LEAST(COALESCE(_delta, 0), 10));
  FOR _q IN
    SELECT id, target_value, xp_reward FROM public.quests
    WHERE is_active = true AND target_metric = _metric
      AND NOW() BETWEEN starts_at AND ends_at
  LOOP
    INSERT INTO public.user_quest_progress(user_id, quest_id, current_value)
    VALUES (_user_id, _q.id, _delta)
    ON CONFLICT (user_id, quest_id) DO UPDATE
      SET current_value = LEAST(_q.target_value, public.user_quest_progress.current_value + _delta),
          completed = (LEAST(_q.target_value, public.user_quest_progress.current_value + _delta) >= _q.target_value),
          completed_at = CASE WHEN public.user_quest_progress.current_value + _delta >= _q.target_value
                              AND public.user_quest_progress.completed = false
                              THEN NOW() ELSE public.user_quest_progress.completed_at END;
    -- XP-Reward bei Vollendung (einmalig)
    IF EXISTS (SELECT 1 FROM public.user_quest_progress WHERE user_id=_user_id AND quest_id=_q.id AND completed=true AND rewarded=false) THEN
      UPDATE public.profiles SET xp = COALESCE(xp,0) + _q.xp_reward WHERE id = _user_id;
      UPDATE public.user_quest_progress SET rewarded=true WHERE user_id=_user_id AND quest_id=_q.id;
      PERFORM public.fn_create_notification(_user_id, 'achievement',
        '🏆 Quest abgeschlossen!', '+' || _q.xp_reward || ' XP', NULL, 'quest:' || _q.id::text);
    END IF;
  END LOOP;
EXCEPTION WHEN OTHERS THEN NULL;
END; $function$;

-- ── 3. Scan-Cache: kein Lesen, kein Schreiben fuer Nutzer ───────────────────
do $$
begin
  if to_regclass('public.scan_cache') is not null then
    execute 'drop policy if exists scan_cache_read_all on public.scan_cache';
    execute 'alter table public.scan_cache enable row level security';
    execute 'revoke all on table public.scan_cache from anon, authenticated';
  end if;
end $$;

-- ── 4. fn_knowledge_grow: Geheimnis aus app_settings, nur Server ────────────
CREATE OR REPLACE FUNCTION public.fn_knowledge_grow(p_topic text, p_count integer DEFAULT 15)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  v_req_id bigint;
  v_secret text;
BEGIN
  -- v33.59: kein Geheimnis im Rumpf (das alte war geleakt); nur Cron/service_role.
  IF auth.uid() IS NOT NULL AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT value INTO v_secret FROM public.app_settings WHERE key = 'knowledge_gen_secret';
  IF coalesce(v_secret, '') = '' THEN RAISE EXCEPTION 'knowledge_gen_secret fehlt'; END IF;
  SELECT net.http_post(
    url := 'https://vowbiueikwrauuceilhc.supabase.co/functions/v1/knowledge-bulk-gen',
    body := jsonb_build_object('topic', left(coalesce(p_topic, ''), 64),
                               'count', GREATEST(1, LEAST(coalesce(p_count, 15), 15))),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Admin-Secret', v_secret
    ),
    timeout_milliseconds := 90000
  ) INTO v_req_id;
  RETURN v_req_id;
END;
$function$;
do $$ begin
  execute 'revoke all on function public.fn_knowledge_grow(text,integer) from public, anon, authenticated';
  execute 'grant execute on function public.fn_knowledge_grow(text,integer) to service_role';
end $$;

-- ── 5. fn_log_ai_usage: App-Buchungen gedeckelt, Server unveraendert ────────
CREATE OR REPLACE FUNCTION public.fn_log_ai_usage(p_edge_fn text, p_tokens_in integer, p_tokens_out integer, p_cost_chf numeric DEFAULT NULL::numeric, p_model text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_in numeric; v_out numeric; v_cost numeric; v_guessed boolean := false;
        v_fn text := p_edge_fn; v_tin integer := coalesce(p_tokens_in, 0); v_tout integer := coalesce(p_tokens_out, 0);
begin
  -- v33.59 ai_usage_sperre: diese Marke laesst 20260831_kosten_und_cron_wachhund_v30_95.sql
  -- die Funktion stehen (sonst machte die aeltere Datei, danach angewandt, die Sperre
  -- rueckgaengig). Ihre Schaetzung bei fehlendem p_model steht deshalb HIER mit.
  -- v33.59: wer mit Nutzer-Sitzung bucht (die App), setzt keine Kosten und keinen
  -- Server-Namen; die Kosten rechnet die Preistabelle aus gedeckelten Tokens.
  if auth.uid() is not null and coalesce(auth.role(), '') <> 'service_role' then
    p_cost_chf := null;
    v_fn := left(regexp_replace(coalesce(p_edge_fn, ''), '[^A-Za-z0-9_.:-]', '', 'g'), 40);
    if v_fn = '' then v_fn := 'client_ai'; end if;
    if v_fn !~ '^client' then v_fn := 'client:' || v_fn; end if;
    v_tin := least(greatest(v_tin, 0), 200000);
    v_tout := least(greatest(v_tout, 0), 64000);
    if not public.fn_check_rate_limit(auth.uid()::text, 'ai_usage_log', 600) then return; end if;
  end if;
  if p_cost_chf is not null then
    v_cost := p_cost_chf;
  else
    -- CHF pro 1M Token (≈ Anthropic-Listenpreise × USD→CHF, konservativ aufgerundet)
    if p_model is null then
      -- v30.95: frueher `v_cost := 0` — ein vergessener Parameter zog die Kostenrechnung
      -- still auf null. Konservativ schaetzen (Sonnet-Tarif) und sichtbar machen.
      v_in := 2.7; v_out := 13.2; v_guessed := true;
    elsif p_model ilike '%haiku%' then v_in := 0.9;  v_out := 4.4;
    elsif p_model ilike '%opus%' then v_in := 13.5; v_out := 67.5;
    else v_in := 2.7; v_out := 13.2; -- sonnet / unbekannt → konservativ
    end if;
    v_cost := (v_tin::numeric / 1000000.0 * v_in)
            + (v_tout::numeric / 1000000.0 * v_out);
  end if;
  insert into public.ai_daily_usage (date, edge_fn, total_tokens_in, total_tokens_out, total_cost_chf, call_count, updated_at)
  values (current_date, v_fn, v_tin, v_tout, v_cost, 1, now())
  on conflict (date, edge_fn) do update set
    total_tokens_in  = ai_daily_usage.total_tokens_in  + excluded.total_tokens_in,
    total_tokens_out = ai_daily_usage.total_tokens_out + excluded.total_tokens_out,
    total_cost_chf   = ai_daily_usage.total_cost_chf   + v_cost,
    call_count       = ai_daily_usage.call_count + 1,
    updated_at       = now();
  -- v30.95: einmal je Tag und Funktion melden, dass geschaetzt werden musste.
  if v_guessed then
    begin
      insert into public.system_events(severity, source, event, detail)
      select 'warn', 'ai_usage', 'model_missing',
             jsonb_build_object('edge_fn', v_fn, 'hint', 'p_model fehlt -> Kosten geschaetzt (Sonnet-Tarif)')
      where not exists (
        select 1 from public.system_events
        where source = 'ai_usage' and event = 'model_missing'
          and detail->>'edge_fn' = v_fn
          and created_at::date = current_date
      );
    exception when others then null;  -- Protokollieren darf nie stoeren
    end;
  end if;
end;
$function$;
COMMENT ON FUNCTION public.fn_log_ai_usage(text,integer,integer,numeric,text) IS
  'v33.59 ai_usage_sperre: App-Buchungen (Nutzer-Sitzung) unter client…, ohne eigene Kosten, Tokens gedeckelt, 600/h. v30.95: fehlendes p_model bucht konservativ zum Sonnet-Tarif und meldet einmal taeglich nach system_events.';
do $$ begin
  execute 'revoke all on function public.fn_log_ai_usage(text,integer,integer,numeric,text) from public, anon';
  execute 'grant execute on function public.fn_log_ai_usage(text,integer,integer,numeric,text) to authenticated, service_role';
end $$;

do $$
begin
  if to_regclass('public.ai_daily_usage') is not null then
    execute 'drop policy if exists ai_daily_usage_select on public.ai_daily_usage';
    execute 'create policy ai_daily_usage_select on public.ai_daily_usage for select to authenticated using ((select public.is_admin_user()))';
  end if;
end $$;

-- ── 6. Suchen: kein E-Mail-Lokalteil, LIMIT gedeckelt ───────────────────────
CREATE OR REPLACE FUNCTION public.fn_marketplace_search(p_query text DEFAULT ''::text, p_category text DEFAULT NULL::text, p_region text DEFAULT NULL::text, p_price_min numeric DEFAULT NULL::numeric, p_price_max numeric DEFAULT NULL::numeric, p_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, user_id uuid, title text, description text, category text, price numeric, currency text, region text, contact text, photo_url text, photo_urls text[], price_mode text, status text, views integer, reports integer, created_at timestamp with time zone, updated_at timestamp with time zone, sold_at timestamp with time zone, organic_certified boolean, pesticide_free boolean, certification_label text, allow_online_payment boolean, contact_method text, seller_name text, seller_avatar text, seller_is_expert boolean, seller_is_premium boolean, seller_level integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_q text := nullif(btrim(coalesce(p_query,'')), '');
        v_ts tsquery;
BEGIN
  IF v_q IS NOT NULL AND length(v_q) >= 2 THEN
    BEGIN v_ts := websearch_to_tsquery('german', v_q); EXCEPTION WHEN others THEN v_ts := NULL; END;
  END IF;
  RETURN QUERY
  SELECT m.id, m.user_id, m.title, m.description, m.category, m.price, m.currency,
         m.region, m.contact, m.photo_url, m.photo_urls, m.price_mode, m.status,
         m.views, m.reports, m.created_at, m.updated_at, m.sold_at,
         m.organic_certified, m.pesticide_free, m.certification_label,
         m.allow_online_payment, m.contact_method,
         -- v33.59: nie der Anfang der E-Mail-Adresse (profiles ist sonst privat).
         COALESCE(NULLIF(btrim(p.display_name), ''), 'Anonym') AS seller_name,
         p.avatar_emoji AS seller_avatar,
         p.is_expert AS seller_is_expert,
         COALESCE(p.tier = ANY (ARRAY['plus','pro','plus_lifetime']), false) AS seller_is_premium,
         COALESCE(p.level, 1) AS seller_level
    FROM public.marketplace_listings m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.status = 'active'
     AND coalesce(m.moderation_status,'') <> 'hidden'
     AND (p_category IS NULL OR m.category = p_category)
     AND (p_region   IS NULL OR m.region   = p_region)
     AND (p_price_min IS NULL OR m.price >= p_price_min)
     AND (p_price_max IS NULL OR m.price <= p_price_max)
     AND (v_ts IS NULL OR to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')) @@ v_ts)
   ORDER BY
     CASE WHEN v_ts IS NOT NULL
          THEN ts_rank(to_tsvector('german', coalesce(m.title,'')||' '||coalesce(m.description,'')), v_ts)
          ELSE 0 END DESC,
     m.created_at DESC
   LIMIT GREATEST(1, LEAST(coalesce(p_limit,50), 100));
END;
$function$;

CREATE OR REPLACE FUNCTION public.fn_knowledge_search(q text, lim integer DEFAULT 30)
 RETURNS TABLE(source_type text, source_id text, title text, subtitle text, body text, icon text, similarity real)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  SELECT
    v.source_type, v.source_id, v.title, v.subtitle,
    SUBSTRING(v.body FROM 1 FOR 300) AS body,
    v.icon,
    GREATEST(
      similarity(coalesce(v.title, ''), q) * 2.0,  -- Title doppelt gewichtet
      similarity(coalesce(v.search_text, ''), q)
    )::real AS similarity
  FROM public.v_knowledge_search v
  WHERE coalesce(v.search_text, '') ILIKE '%' || q || '%'
     OR similarity(coalesce(v.title, ''), q) > 0.2
     OR similarity(coalesce(v.search_text, ''), q) > 0.15
  ORDER BY similarity DESC
  LIMIT GREATEST(1, LEAST(coalesce(lim, 30), 100));  -- v33.59: Deckel wie fn_knowledge_search2
$function$;

-- ── 7. Freundschafts-Mitteilung: Name bereinigt und gedeckelt ───────────────
CREATE OR REPLACE FUNCTION public.fn_notify_friend_request()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE _name text;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT display_name INTO _name FROM public.profiles WHERE id = NEW.user_id;
    -- v33.59: der Name ist frei waehlbar und landet beim EMPFAENGER — ohne Steuer- und
    -- Richtungszeichen (auch C1 wie U+0085, U+061C, U+2060-2064, U+FEFF), hoechstens 40 Zeichen.
    _name := NULLIF(left(btrim(regexp_replace(coalesce(_name, ''), '[\x01-\x1F\x7F-\x9F\u061C\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]', '', 'g')), 40), '');
    PERFORM public.fn_create_notification(
      NEW.friend_id, 'friend',
      (COALESCE(_name, 'Jemand') || ' möchte dir folgen'),
      'Tippe um zu antworten', '/?screen=profile#friends',
      'friend-req:' || NEW.user_id::text
    );
  ELSIF NEW.status = 'accepted' AND (OLD.status = 'pending' OR OLD.status IS NULL) THEN
    SELECT display_name INTO _name FROM public.profiles WHERE id = NEW.friend_id;
    _name := NULLIF(left(btrim(regexp_replace(coalesce(_name, ''), '[\x01-\x1F\x7F-\x9F\u061C\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]', '', 'g')), 40), '');
    PERFORM public.fn_create_notification(
      NEW.user_id, 'friend',
      (COALESCE(_name, 'Dein Kontakt') || ' hat deine Anfrage angenommen 🎉'),
      NULL, '/?screen=profile#friends',
      'friend-acc:' || NEW.friend_id::text
    );
  END IF;
  RETURN NEW;
END; $function$;

-- ── 8. Arten-Bild: nur Dateien im eigenen Ordner des eigenen Buckets ────────
CREATE OR REPLACE FUNCTION public.fn_contribute_species_image(p_species_id text, p_url text, p_storage_path text DEFAULT NULL::text, p_confidence smallint DEFAULT NULL::smallint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_uid uuid := (SELECT auth.uid()); v_id uuid;
        v_vor constant text := 'https://vowbiueikwrauuceilhc.supabase.co/storage/v1/object/public/species-images/';
        v_pfad text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF p_species_id IS NULL OR length(btrim(p_species_id)) = 0 THEN RAISE EXCEPTION 'species_id required'; END IF;
  -- v33.59: nur die Adresse, die gsUploadImage fuer DIESES Konto erzeugt — ein fremder
  -- Server koennte ein freigegebenes Bild nachtraeglich austauschen.
  -- Nur Bild-Endungen: der Bucket kennt keine MIME-Liste, sonst ginge auch .html/.svg.
  IF p_url IS NULL OR left(p_url, length(v_vor)) <> v_vor THEN RAISE EXCEPTION 'valid url required'; END IF;
  v_pfad := substr(p_url, length(v_vor) + 1);
  IF v_pfad !~ ('^' || v_uid::text || '/[A-Za-z0-9_-]{1,120}\.(jpe?g|png|webp)$') THEN
    RAISE EXCEPTION 'valid url required';
  END IF;
  IF NOT public.fn_check_rate_limit(v_uid::text, 'species_contribute', 15) THEN
    RAISE EXCEPTION 'rate_limited';
  END IF;
  IF EXISTS (SELECT 1 FROM public.species_images
             WHERE species_id = p_species_id AND contributed_by = v_uid AND review_status = 'pending') THEN
    RAISE EXCEPTION 'already pending for this species';
  END IF;
  IF (SELECT count(*) FROM public.species_images WHERE contributed_by = v_uid AND review_status = 'pending') >= 30 THEN
    RAISE EXCEPTION 'too many pending';
  END IF;
  INSERT INTO public.species_images
    (species_id, url, storage_path, contributed_by, review_status, scan_confidence, is_primary, license, attribution)
  VALUES
    (p_species_id, p_url, v_pfad, v_uid, 'pending', p_confidence, false, 'user-contributed', 'GreenScan-Community')
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
