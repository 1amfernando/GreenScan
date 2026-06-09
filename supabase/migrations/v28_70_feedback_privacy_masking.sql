-- ============================================================================
-- v28_70_feedback_privacy_masking — Block G A1 (LIVE-Spiegel): nDSG-Härtung.
-- BEFUND (Block-G-Audit + Main-Loop-Spot-Check): feedback_items war per
-- feedback_items_select_all (qual='true', roles {public}) für ALLE lesbar — inkl.
-- context.author_email (PII im jsonb). expert_verifications ebenso anon-lesbar.
-- FIX:
--   (1) v_feedback_public (security_definer-View) — exponiert nur sichere Spalten
--       + server-seitig maskierten author_nick; author_email aus context entfernt
--       (`context - 'author_email'`). Frontend liest künftig diese View (Feed bleibt
--       für alle sichtbar, auch anon, aber OHNE Email-Preisgabe).
--   (2) feedback_items SELECT auf Owner + Staff beschränkt (Basis-Tabelle inkl.
--       author_email nicht mehr anon-lesbar).
--   (3) expert_verifications SELECT: anon raus, authenticated-Read-all bleibt.
--       Badges laufen über LEFT-JOIN-View v_social_posts_with_verifications
--       (COALESCE) → anon sieht Posts ohne Badge (graceful), eingeloggt voll.
-- Verifiziert: v_feedback_public 0 Email-Leaks; Policies {own_or_staff}/{authenticated};
-- View-Grants anon+authenticated.
-- ============================================================================

CREATE OR REPLACE VIEW public.v_feedback_public AS
SELECT
  fi.id, fi.content, fi.kind, fi.created_at,
  fi.votes_up, fi.votes_down,
  fi.ki_status, fi.ki_priority, fi.ki_rationale, fi.ki_action,
  (fi.context - 'author_email') AS context,
  CASE WHEN coalesce(fi.context->>'author_email','') <> ''
       THEN left(split_part(fi.context->>'author_email','@',1), 14)
       ELSE NULL END AS author_nick
FROM public.feedback_items fi;

REVOKE ALL ON public.v_feedback_public FROM PUBLIC;
GRANT SELECT ON public.v_feedback_public TO anon, authenticated;

DROP POLICY IF EXISTS feedback_items_select_all ON public.feedback_items;
CREATE POLICY feedback_items_select_own_or_staff ON public.feedback_items
  FOR SELECT USING ( (SELECT auth.uid()) = user_id OR fn_role_at_least('staff'::text) );

DROP POLICY IF EXISTS expert_verif_select_all ON public.expert_verifications;
CREATE POLICY expert_verif_select_authenticated ON public.expert_verifications
  FOR SELECT TO authenticated USING ( true );
