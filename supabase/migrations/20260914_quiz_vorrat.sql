-- ═══════════════════════════════════════════════════════════════════════════
-- v33.29: Der Fragen-Vorrat ist eine ZAHL — und jemand liest sie.
--
-- NICHT ANGEWANDT. Wie alle Migrationen dieses Repos liegt sie hier bereit;
-- DDL auf der Produktivdatenbank ist Fernandos Entscheid (STATUS 2026-08-31 y).
-- Sie ist idempotent und in scripts/quiz_gen_check.js gegen ein lokales
-- Postgres nachgerechnet — mit Reproduktion und Gegenprobe.
--
-- ── Der Befund (14.09.2026, nur lesend an der Live-DB gemessen) ────────────
--
--   215 Fragen, alle aktiv. `daily_quiz_history` zaehlt 34 gespielte Tage
--   (11.06. bis 12.09.), 34 verschiedene Fragen, 0 Wiederholungen.
--   Nach der Regel von `fn_get_daily_quiz` (keine Frage, die in den letzten
--   730 Tagen dran war) sind damit **181 Fragen frei** — 181 weitere Tage.
--
--   Der Nachschub laeuft: `knowledge-growth-daily` (03:30) rotiert ueber 35
--   Themen und schickt `{topic, count: 12}` an `knowledge-bulk-gen`.
--   `daily_quizzes` kommt also alle 35 Tage dran. Gemessen an created_at:
--   15.05. · 27.05. · 01.07. · 05.08. · 09.09. — die letzten drei genau 35
--   Tage auseinander, jedes Mal 12 Fragen.
--
--     Zulauf    12 / 35 Tage = 0,343 / Tag
--     Verbrauch  1 /  1 Tag  = 1,0   / Tag
--     Bilanz                  −0,657 / Tag  →  181 / 0,657 ≈ 275 Tage
--
--   Der Vorrat ist also um den **16.06.2027** erschoepft. Danach faellt
--   `fn_get_daily_quiz` auf ihren Rueckfall und wiederholt Fragen INNERHALB
--   des 730-Tage-Fensters, das sie verhindern soll — **und nichts meldet es.**
--   Um mitzuhalten, muesste ein Lauf 35 Fragen liefern statt 12 (oder
--   `daily_quizzes` oefter an die Reihe kommen). Das ist eine Entscheidung
--   ueber KI-Kosten, keine Reparatur — sie steht in docs/FUER-FERNANDO.md.
--
-- Diese Migration baut nur die MESSUNG: eine Funktion, die die Zahlen
-- liefert, und einen taeglichen Eintrag nach `system_events`, sobald der
-- Vorrat unter die Warnschwelle faellt. Sie aendert nichts am Quiz selbst.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Die Zahlen ────────────────────────────────────────────────────────
create or replace function public.fn_quiz_vorrat()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $$
  select jsonb_build_object(
    'aktiv',        (select count(*) from public.daily_quizzes where is_active),
    'frei',         (select count(*) from public.daily_quizzes q
                     where q.is_active
                       and not exists (select 1 from public.daily_quiz_history h
                                       where h.question_id = q.id
                                         and h.day_key > current_date - interval '730 days')),
    'tage_gespielt',(select count(*) from public.daily_quiz_history),
    'letzter_tag',  (select max(day_key) from public.daily_quiz_history),
    -- Zulauf: wie viele Fragen kamen in den letzten 120 Tagen dazu? Das deckt
    -- mindestens drei Rotationen à 35 Tage ab, also drei echte Laeufe.
    -- `is_active` auch hier: `aktiv` und `frei` zaehlen nur aktive Fragen, und
    -- eine abgeschaltete ist kein Zulauf. Ohne den Filter zaehlte die Bilanz
    -- Fragen mit, die das Quiz nie zieht.
    'zulauf_120t',  (select count(*) from public.daily_quizzes
                     where is_active and created_at > now() - interval '120 days'),
    'gemessen_am',  current_date
  );
$$;

comment on function public.fn_quiz_vorrat() is
  'v33.29: Fragen-Vorrat in Zahlen — aktiv, frei (730-Tage-Fenster), gespielte Tage, Zulauf der letzten 120 Tage. Nur Zahlen, keine Kennungen.';

revoke all on function public.fn_quiz_vorrat() from public, anon;
grant execute on function public.fn_quiz_vorrat() to authenticated, service_role;

-- ── 2 · Die Warnung ───────────────────────────────────────────────────────
-- Schwelle: 60 freie FRAGEN. Bei einer Frage je Tag sind das 60 Tage — die
-- beiden Zahlen fallen nur zusammen, solange das Quiz eine Frage pro Tag zieht;
-- gezaehlt werden Fragen. Frueher zu warnen hiesse, monatelang jeden Tag zu
-- warnen; spaeter liesse keine Zeit mehr, den Nachschub zu aendern (eine
-- Rotation dauert 35 Tage — bei 30 uebrigen kaeme die naechste Lieferung zu spaet).
create or replace function public.fn_quiz_vorrat_pruefen()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_catalog'
as $$
declare
  v jsonb := public.fn_quiz_vorrat();
  v_frei int := (v->>'frei')::int;
  v_stufe text := case when (v->>'frei')::int <= 14 then 'error' else 'warn' end;
begin
  if v_frei > 60 then return; end if;
  -- Hoechstens EINE Meldung je Woche und Stufe. Die Nachbar-Waechter
  -- (finance/snapshot, data_integrity/scan, security/scan) schreiben taeglich,
  -- aber das sind MOMENTAUFNAHMEN. Dies hier ist eine WARNUNG, und eine
  -- Warnung, die 60 Tage lang jeden Morgen dasteht, lernt man zu ueberlesen
  -- (CLAUDE.md §7.1: nicht die falsche Zahl macht einen Bericht unlesbar,
  -- sondern die, die man zu ignorieren gelernt hat). Steigt die Stufe von
  -- warn auf error, meldet sie sich sofort wieder.
  if exists (select 1 from public.system_events
             where source = 'quiz' and event = 'vorrat_knapp'
               and severity = v_stufe
               and created_at > now() - interval '7 days') then
    return;
  end if;
  insert into public.system_events (severity, source, event, detail)
  values (v_stufe, 'quiz', 'vorrat_knapp', v || jsonb_build_object('schwelle', 60));
end;
$$;

comment on function public.fn_quiz_vorrat_pruefen() is
  'v33.29: schreibt einen system_events-Eintrag, sobald weniger als 60 nicht-wiederholende Fragen uebrig sind. Ohne diese Pruefung faellt fn_get_daily_quiz lautlos auf Wiederholungen zurueck.';

revoke all on function public.fn_quiz_vorrat_pruefen() from public, anon, authenticated;
grant execute on function public.fn_quiz_vorrat_pruefen() to service_role;

-- ── 3 · Taeglich, im selben Fenster wie die anderen Waechter ───────────────
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('quiz-vorrat-daily')
      where exists (select 1 from cron.job where jobname = 'quiz-vorrat-daily');
    perform cron.schedule('quiz-vorrat-daily', '55 4 * * *',
                          'select public.fn_quiz_vorrat_pruefen();');
  end if;
end $$;
