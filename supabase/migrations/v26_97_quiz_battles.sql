-- ============================================================================
-- v26_97_quiz_battles — Quiz-Battles: 1v1 ELO-Duelle (async) + Random-Matchmaker
-- ----------------------------------------------------------------------------
-- ARCHITEKTUR-REALITÄT (Hard-Lesson #8):
--  * KEINE quiz_questions-Tabelle → Fragen werden client-seitig generiert und
--    als p_questions jsonb in fn_quiz_battle_create gereicht.
--  * Spec-Tabelle ohne updated_at, aber die RPCs referenzieren es → ergänzt.
--  * achievements_catalog ist FLACH (eine Zeile pro Stufe) → 8 Einzel-Seeds.
--  * Kein Friends-/User-Such-System → Random-Matchmaker als primärer Einstieg.
-- Spiegel der LIVE angewandten Migration (project vowbiueikwrauuceilhc).
-- Rein additiv. ELO K=32, symmetrisch, clamp GREATEST(100, …).
-- ============================================================================

-- ─── 1) Tabelle quiz_battles ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quiz_battles (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status                 text NOT NULL DEFAULT 'open'
                           CHECK (status IN ('open','accepted','challenger_done','opponent_done','resolved','expired','declined')),
  questions              jsonb NOT NULL,
  challenger_answers     jsonb,
  opponent_answers       jsonb,
  challenger_score       smallint,
  opponent_score         smallint,
  winner_id              uuid,
  elo_change_challenger  smallint NOT NULL DEFAULT 0,
  elo_change_opponent    smallint NOT NULL DEFAULT 0,
  is_random_match        boolean NOT NULL DEFAULT false,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  resolved_at            timestamptz,
  expires_at             timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_qb_challenger ON public.quiz_battles (challenger_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qb_opponent   ON public.quiz_battles (opponent_id, created_at DESC);
-- Matchmaker-Suche: offene Random-Matches ohne Gegner
CREATE INDEX IF NOT EXISTS idx_qb_open_random ON public.quiz_battles (created_at)
  WHERE is_random_match = true AND opponent_id IS NULL AND status = 'open';

ALTER TABLE public.quiz_battles ENABLE ROW LEVEL SECURITY;

-- Teilnehmer dürfen lesen; offene Random-Matches sind für potentielle Gegner sichtbar
DROP POLICY IF EXISTS qb_participants_read ON public.quiz_battles;
CREATE POLICY qb_participants_read ON public.quiz_battles
  FOR SELECT TO authenticated
  USING (
    challenger_id = (SELECT auth.uid())
    OR opponent_id = (SELECT auth.uid())
    OR (is_random_match = true AND opponent_id IS NULL AND status IN ('open','challenger_done'))
  );

DROP POLICY IF EXISTS qb_challenger_create ON public.quiz_battles;
CREATE POLICY qb_challenger_create ON public.quiz_battles
  FOR INSERT TO authenticated
  WITH CHECK (challenger_id = (SELECT auth.uid()));

GRANT SELECT, INSERT ON public.quiz_battles TO authenticated;

-- ─── 2) profiles: ELO + Battle-Statistik ────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quiz_elo     int NOT NULL DEFAULT 1200;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS battles_won  int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS battles_lost int NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS battles_tied int NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_profiles_quiz_elo ON public.profiles (quiz_elo DESC);

-- ─── 3) _fn_quiz_battle_finalize: ELO-Auswertung (idempotent) ────────────────
CREATE OR REPLACE FUNCTION public._fn_quiz_battle_finalize(p_battle_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b            public.quiz_battles%ROWTYPE;
  v_elo_c      int;
  v_elo_o      int;
  v_exp_c      numeric;
  v_exp_o      numeric;
  v_score_c    numeric;  -- 1 win / 0.5 tie / 0 loss
  v_score_o    numeric;
  v_delta_c    int;
  v_delta_o    int;
  v_winner     uuid;
  k            int := 32;
BEGIN
  SELECT * INTO b FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF b.resolved_at IS NOT NULL THEN RETURN; END IF;  -- idempotent guard
  IF b.challenger_score IS NULL OR b.opponent_score IS NULL THEN RETURN; END IF;
  IF b.opponent_id IS NULL THEN RETURN; END IF;

  -- Sicherstellen, dass beide profiles-Zeilen existieren
  INSERT INTO public.profiles (id) VALUES (b.challenger_id) ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.profiles (id) VALUES (b.opponent_id)   ON CONFLICT (id) DO NOTHING;

  SELECT quiz_elo INTO v_elo_c FROM public.profiles WHERE id = b.challenger_id;
  SELECT quiz_elo INTO v_elo_o FROM public.profiles WHERE id = b.opponent_id;
  v_elo_c := COALESCE(v_elo_c, 1200);
  v_elo_o := COALESCE(v_elo_o, 1200);

  v_exp_c := 1.0 / (1.0 + power(10.0, (v_elo_o - v_elo_c) / 400.0));
  v_exp_o := 1.0 / (1.0 + power(10.0, (v_elo_c - v_elo_o) / 400.0));

  IF b.challenger_score > b.opponent_score THEN
    v_score_c := 1; v_score_o := 0; v_winner := b.challenger_id;
  ELSIF b.opponent_score > b.challenger_score THEN
    v_score_c := 0; v_score_o := 1; v_winner := b.opponent_id;
  ELSE
    v_score_c := 0.5; v_score_o := 0.5; v_winner := NULL;
  END IF;

  v_delta_c := round(k * (v_score_c - v_exp_c));
  v_delta_o := round(k * (v_score_o - v_exp_o));

  UPDATE public.profiles SET
    quiz_elo     = GREATEST(100, quiz_elo + v_delta_c),
    battles_won  = battles_won  + CASE WHEN v_winner = b.challenger_id THEN 1 ELSE 0 END,
    battles_lost = battles_lost + CASE WHEN v_winner = b.opponent_id   THEN 1 ELSE 0 END,
    battles_tied = battles_tied + CASE WHEN v_winner IS NULL           THEN 1 ELSE 0 END
  WHERE id = b.challenger_id;

  UPDATE public.profiles SET
    quiz_elo     = GREATEST(100, quiz_elo + v_delta_o),
    battles_won  = battles_won  + CASE WHEN v_winner = b.opponent_id   THEN 1 ELSE 0 END,
    battles_lost = battles_lost + CASE WHEN v_winner = b.challenger_id THEN 1 ELSE 0 END,
    battles_tied = battles_tied + CASE WHEN v_winner IS NULL           THEN 1 ELSE 0 END
  WHERE id = b.opponent_id;

  UPDATE public.quiz_battles SET
    winner_id             = v_winner,
    elo_change_challenger = v_delta_c,
    elo_change_opponent   = v_delta_o,
    status                = 'resolved',
    resolved_at           = now(),
    updated_at            = now()
  WHERE id = p_battle_id;
END;
$$;

REVOKE ALL ON FUNCTION public._fn_quiz_battle_finalize(uuid) FROM PUBLIC, anon, authenticated;

-- ─── 4) fn_quiz_battle_create ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_create(
  p_questions    jsonb,
  p_opponent_id  uuid DEFAULT NULL,
  p_random_match boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := (SELECT auth.uid());
  v_id     uuid;
  v_len    int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF jsonb_typeof(p_questions) <> 'array' THEN RAISE EXCEPTION 'questions must be a json array'; END IF;
  v_len := jsonb_array_length(p_questions);
  IF v_len < 3 OR v_len > 10 THEN RAISE EXCEPTION 'questions must contain 3-10 entries'; END IF;

  INSERT INTO public.profiles (id) VALUES (v_uid) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.quiz_battles (challenger_id, opponent_id, questions, is_random_match, status)
  VALUES (v_uid, p_opponent_id, p_questions, COALESCE(p_random_match, false), 'open')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_quiz_battle_create(jsonb, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quiz_battle_create(jsonb, uuid, boolean) TO authenticated;

-- ─── 5) fn_quiz_battle_find_or_create_random: Matchmaker ─────────────────────
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_find_or_create_random(p_questions jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := (SELECT auth.uid());
  v_my_elo  int;
  v_match   uuid;
  v_new     uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.profiles (id) VALUES (v_uid) ON CONFLICT (id) DO NOTHING;
  SELECT COALESCE(quiz_elo, 1200) INTO v_my_elo FROM public.profiles WHERE id = v_uid;

  -- Offenes Random-Match eines anderen Spielers mit ähnlicher ELO suchen + claimen
  SELECT b.id INTO v_match
  FROM public.quiz_battles b
  JOIN public.profiles p ON p.id = b.challenger_id
  WHERE b.is_random_match = true
    AND b.opponent_id IS NULL
    AND b.status = 'open'
    AND b.challenger_id <> v_uid
    AND abs(COALESCE(p.quiz_elo, 1200) - v_my_elo) <= 250
    AND b.expires_at > now()
  ORDER BY b.created_at ASC
  FOR UPDATE OF b SKIP LOCKED
  LIMIT 1;

  IF v_match IS NOT NULL THEN
    UPDATE public.quiz_battles
      SET opponent_id = v_uid, status = 'accepted', updated_at = now()
      WHERE id = v_match;
    RETURN jsonb_build_object('battle_id', v_match, 'matched', true, 'role', 'opponent');
  END IF;

  -- Sonst neues offenes Random-Match anlegen
  INSERT INTO public.quiz_battles (challenger_id, questions, is_random_match, status)
  VALUES (v_uid, p_questions, true, 'open')
  RETURNING id INTO v_new;

  RETURN jsonb_build_object('battle_id', v_new, 'matched', false, 'role', 'challenger');
END;
$$;

REVOKE ALL ON FUNCTION public.fn_quiz_battle_find_or_create_random(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quiz_battle_find_or_create_random(jsonb) TO authenticated;

-- ─── 6) fn_quiz_battle_accept ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_accept(p_battle_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_ok  int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  UPDATE public.quiz_battles
    SET opponent_id = v_uid,
        status = CASE WHEN status = 'challenger_done' THEN 'challenger_done' ELSE 'accepted' END,
        updated_at = now()
    WHERE id = p_battle_id
      AND opponent_id IS NULL
      AND challenger_id <> v_uid
      AND status IN ('open','challenger_done')
      AND expires_at > now();
  GET DIAGNOSTICS v_ok = ROW_COUNT;
  RETURN v_ok > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_quiz_battle_accept(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quiz_battle_accept(uuid) TO authenticated;

-- ─── 7) fn_quiz_battle_submit: Antworten scoren + Status fortschreiben ───────
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_submit(p_battle_id uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := (SELECT auth.uid());
  b           public.quiz_battles%ROWTYPE;
  v_is_chal   boolean;
  v_score     int := 0;
  v_n         int;
  i           int;
  v_correct   int;
  v_picked    int;
  v_enriched  jsonb := '[]'::jsonb;
  v_ans_elem  jsonb;
  v_new_stat  text;
  v_resolved  boolean := false;
  v_you_won   int;       -- 1 win / 0 tie / -1 loss / NULL pending
  v_elo_delta int;
  v_your_elo  int;
  v_your_won  int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO b FROM public.quiz_battles WHERE id = p_battle_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'battle not found'; END IF;

  -- Offenes Random-Match darf beim Submit vom Gegner geclaimt werden
  IF b.opponent_id IS NULL AND b.is_random_match AND b.challenger_id <> v_uid
     AND b.status IN ('open','challenger_done') THEN
    UPDATE public.quiz_battles SET opponent_id = v_uid, updated_at = now() WHERE id = p_battle_id;
    b.opponent_id := v_uid;
  END IF;

  IF v_uid = b.challenger_id THEN v_is_chal := true;
  ELSIF v_uid = b.opponent_id THEN v_is_chal := false;
  ELSE RAISE EXCEPTION 'not a participant'; END IF;

  IF (v_is_chal AND b.challenger_answers IS NOT NULL)
     OR (NOT v_is_chal AND b.opponent_answers IS NOT NULL) THEN
    RAISE EXCEPTION 'already submitted';
  END IF;

  v_n := LEAST(jsonb_array_length(b.questions), 10);
  FOR i IN 0 .. v_n - 1 LOOP
    v_correct := (b.questions -> i ->> 'correct_idx')::int;
    v_ans_elem := COALESCE(p_answers -> i, '{}'::jsonb);
    v_picked := NULLIF(v_ans_elem ->> 'idx', '')::int;
    IF v_picked IS NOT NULL AND v_picked = v_correct THEN
      v_score := v_score + 1;
    END IF;
    v_enriched := v_enriched || jsonb_build_array(
      jsonb_build_object('idx', v_picked, 'correct', (v_picked IS NOT NULL AND v_picked = v_correct),
                         'time_ms', (v_ans_elem ->> 'time_ms')));
  END LOOP;

  IF v_is_chal THEN
    UPDATE public.quiz_battles
      SET challenger_answers = v_enriched, challenger_score = v_score,
          status = CASE WHEN opponent_score IS NOT NULL THEN 'opponent_done' ELSE 'challenger_done' END,
          updated_at = now()
      WHERE id = p_battle_id;
  ELSE
    UPDATE public.quiz_battles
      SET opponent_answers = v_enriched, opponent_score = v_score,
          status = CASE WHEN challenger_score IS NOT NULL THEN 'challenger_done' ELSE 'opponent_done' END,
          updated_at = now()
      WHERE id = p_battle_id;
  END IF;

  -- Beide gespielt → finalisieren (ELO)
  SELECT * INTO b FROM public.quiz_battles WHERE id = p_battle_id;
  IF b.challenger_score IS NOT NULL AND b.opponent_score IS NOT NULL AND b.opponent_id IS NOT NULL THEN
    PERFORM public._fn_quiz_battle_finalize(p_battle_id);
    SELECT * INTO b FROM public.quiz_battles WHERE id = p_battle_id;
    v_resolved := (b.status = 'resolved');
  END IF;

  IF v_resolved THEN
    IF b.winner_id IS NULL THEN v_you_won := 0;
    ELSIF b.winner_id = v_uid THEN v_you_won := 1;
    ELSE v_you_won := -1; END IF;
    v_elo_delta := CASE WHEN v_is_chal THEN b.elo_change_challenger ELSE b.elo_change_opponent END;
  END IF;

  SELECT quiz_elo, battles_won INTO v_your_elo, v_your_won FROM public.profiles WHERE id = v_uid;

  RETURN jsonb_build_object(
    'your_score',        v_score,
    'status',            (SELECT status FROM public.quiz_battles WHERE id = p_battle_id),
    'resolved',          v_resolved,
    'you_won',           v_you_won,
    'elo_delta',         v_elo_delta,
    'your_elo',          v_your_elo,
    'your_battles_won',  v_your_won
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_quiz_battle_submit(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quiz_battle_submit(uuid, jsonb) TO authenticated;

-- ─── 8) fn_quiz_battle_list: rollen-relative Battle-Liste ────────────────────
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_list(p_limit int DEFAULT 40)
RETURNS TABLE (
  id              uuid,
  status          text,
  is_random_match boolean,
  role            text,
  your_score      smallint,
  their_score     smallint,
  opponent_name   text,
  opponent_emoji  text,
  opponent_elo    int,
  you_won         int,
  elo_delta       smallint,
  your_elo        int,
  you_answered    boolean,
  they_answered   boolean,
  created_at      timestamptz,
  resolved_at     timestamptz,
  expires_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (SELECT (SELECT auth.uid()) AS uid)
  SELECT
    b.id,
    b.status,
    b.is_random_match,
    CASE WHEN b.challenger_id = me.uid THEN 'challenger' ELSE 'opponent' END AS role,
    CASE WHEN b.challenger_id = me.uid THEN b.challenger_score ELSE b.opponent_score END AS your_score,
    CASE WHEN b.challenger_id = me.uid THEN b.opponent_score ELSE b.challenger_score END AS their_score,
    op.display_name AS opponent_name,
    op.avatar_emoji AS opponent_emoji,
    op.quiz_elo     AS opponent_elo,
    CASE WHEN b.status <> 'resolved' THEN NULL
         WHEN b.winner_id IS NULL THEN 0
         WHEN b.winner_id = me.uid THEN 1
         ELSE -1 END AS you_won,
    CASE WHEN b.challenger_id = me.uid THEN b.elo_change_challenger ELSE b.elo_change_opponent END AS elo_delta,
    mp.quiz_elo AS your_elo,
    CASE WHEN b.challenger_id = me.uid THEN b.challenger_answers IS NOT NULL ELSE b.opponent_answers IS NOT NULL END AS you_answered,
    CASE WHEN b.challenger_id = me.uid THEN b.opponent_answers IS NOT NULL ELSE b.challenger_answers IS NOT NULL END AS they_answered,
    b.created_at,
    b.resolved_at,
    b.expires_at
  FROM public.quiz_battles b
  CROSS JOIN me
  LEFT JOIN public.profiles op ON op.id = (CASE WHEN b.challenger_id = me.uid THEN b.opponent_id ELSE b.challenger_id END)
  LEFT JOIN public.profiles mp ON mp.id = me.uid
  WHERE b.challenger_id = me.uid OR b.opponent_id = me.uid
  ORDER BY (b.status NOT IN ('resolved','expired','declined')) DESC, b.updated_at DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 40), 100));
$$;

REVOKE ALL ON FUNCTION public.fn_quiz_battle_list(int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quiz_battle_list(int) TO authenticated;

-- ─── 9) fn_quiz_battle_get: Fragen ohne correct_idx (Anti-Cheat-Play-Pfad) ───
CREATE OR REPLACE FUNCTION public.fn_quiz_battle_get(p_battle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  b     public.quiz_battles%ROWTYPE;
  v_q   jsonb;
  v_role text;
  v_you_answered boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO b FROM public.quiz_battles WHERE id = p_battle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'battle not found'; END IF;

  IF b.challenger_id = v_uid THEN v_role := 'challenger';
  ELSIF b.opponent_id = v_uid THEN v_role := 'opponent';
  ELSIF b.is_random_match AND b.opponent_id IS NULL AND b.status IN ('open','challenger_done') THEN v_role := 'opponent';
  ELSE RAISE EXCEPTION 'not allowed'; END IF;

  -- correct_idx aus jedem Frage-Objekt entfernen
  SELECT jsonb_agg(elem - 'correct_idx') INTO v_q
  FROM jsonb_array_elements(b.questions) elem;

  v_you_answered := CASE WHEN v_role = 'challenger' THEN b.challenger_answers IS NOT NULL
                         ELSE b.opponent_answers IS NOT NULL END;

  RETURN jsonb_build_object(
    'id',              b.id,
    'status',          b.status,
    'role',            v_role,
    'is_random_match', b.is_random_match,
    'questions',       COALESCE(v_q, '[]'::jsonb),
    'you_answered',    v_you_answered,
    'expires_at',      b.expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fn_quiz_battle_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_quiz_battle_get(uuid) TO authenticated;

-- ─── 10) Achievements-Seeds (flaches Katalog-Schema, eine Zeile pro Stufe) ───
INSERT INTO public.achievements_catalog (slug, title, description, icon, category, rarity, condition, xp_reward)
VALUES
  ('battle_first',     'Erstes Duell',        'Gewinne dein erstes Quiz-Battle.',            '⚔️', 'sage', 'common',    jsonb_build_object('type','battles_won','value',1),   25),
  ('battle_master_10', 'Duell-Veteran',       'Gewinne 10 Quiz-Battles.',                    '🛡️', 'sage', 'uncommon',  jsonb_build_object('type','battles_won','value',10),  75),
  ('battle_master_50', 'Duell-Meister',       'Gewinne 50 Quiz-Battles.',                    '🏅', 'sage', 'rare',      jsonb_build_object('type','battles_won','value',50),  200),
  ('battle_master_200','Duell-Legende',       'Gewinne 200 Quiz-Battles.',                   '👑', 'sage', 'legendary', jsonb_build_object('type','battles_won','value',200), 600),
  ('elo_1300',         'Aufsteiger',          'Erreiche eine Quiz-ELO von 1300.',            '📈', 'sage', 'uncommon',  jsonb_build_object('type','quiz_elo','value',1300),   75),
  ('elo_1500',         'Wettkämpfer',         'Erreiche eine Quiz-ELO von 1500.',            '🎯', 'sage', 'rare',      jsonb_build_object('type','quiz_elo','value',1500),   200),
  ('elo_1800',         'Grossmeister',        'Erreiche eine Quiz-ELO von 1800.',            '🌟', 'sage', 'epic',      jsonb_build_object('type','quiz_elo','value',1800),   400),
  ('elo_2200',         'Quiz-Champion',       'Erreiche eine Quiz-ELO von 2200.',            '🏆', 'sage', 'legendary', jsonb_build_object('type','quiz_elo','value',2200),   800)
ON CONFLICT (slug) DO NOTHING;

-- ─── 11) fn_quiz_battles_expire + cron ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fn_quiz_battles_expire()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_n int;
BEGIN
  UPDATE public.quiz_battles
    SET status = 'expired', updated_at = now()
    WHERE status IN ('open','accepted','challenger_done','opponent_done')
      AND expires_at < now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_quiz_battles_expire() FROM PUBLIC, anon, authenticated;

-- alle 30 Minuten abgelaufene Battles markieren
SELECT cron.schedule('quiz-battles-expire', '*/30 * * * *',
  $$ SELECT public.fn_quiz_battles_expire(); $$);
