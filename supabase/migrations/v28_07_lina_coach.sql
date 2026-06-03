-- ============================================================================
-- v28_07_lina_coach — Lina AI-Garten-Coach (FREE). Spiegel der LIVE-Migration.
-- Eigen-Daten-Chat: own-only RLS, kein DEFINER nötig (direktes REST-CRUD).
-- Mission: Lina ist gratis für alle, fragt NIE nach Geld. Quota = reine API-Kosten-
-- Bremse (lina_per_day free=10/pro=-1, feature_limits v28.05; verdrahtet in callAI
-- via opts.quotaFeature='lina' v28.05). Privacy: own-only verifiziert (User B sieht 0).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_conv_user ON public.coach_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.coach_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,   -- denormalisiert → schnelle own-only-RLS
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coach_msg_conv ON public.coach_messages(conversation_id, created_at);

ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cc_own ON public.coach_conversations;
CREATE POLICY cc_own ON public.coach_conversations FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_conversations TO authenticated;

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cmsg_own ON public.coach_messages;
CREATE POLICY cmsg_own ON public.coach_messages FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coach_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_cleanup_coach()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH d AS (DELETE FROM public.coach_conversations WHERE updated_at < now() - interval '365 days' RETURNING 1)
  SELECT count(*)::int FROM d;
$$;
REVOKE ALL ON FUNCTION public.fn_cleanup_coach() FROM PUBLIC, anon, authenticated;
-- Cron (separat via execute_sql): cron.schedule('coach-cleanup','45 4 * * 0', ...).
-- Frontend: LINA_SYSTEM-Prompt + gsOpenLina/gsLinaSend (callAI mit opts.quotaFeature='lina').
