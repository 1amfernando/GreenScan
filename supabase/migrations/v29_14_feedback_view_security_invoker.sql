-- ============ v29.14 Security: v_feedback_public SECURITY DEFINER Fix ============
-- Supabase Advisor flagged v_feedback_public as SECURITY DEFINER (ERROR level).
-- The view bypasses RLS on feedback_items, allowing anon/authenticated users to
-- enumerate ALL feedback content from all users — despite the underlying table's
-- SELECT policy restricting to own rows or staff only.
-- Fix: recreate as security_invoker=true so the view respects the caller's RLS context.
-- After fix: anon sees 0 rows, authenticated users see only their own rows, staff sees all.

CREATE OR REPLACE VIEW public.v_feedback_public
WITH (security_invoker=true)
AS
SELECT
    id,
    content,
    kind,
    created_at,
    votes_up,
    votes_down,
    ki_status,
    ki_priority,
    ki_rationale,
    ki_action,
    (context - 'author_email'::text) AS context,
    CASE
        WHEN (COALESCE((context ->> 'author_email'::text), ''::text) <> ''::text)
             THEN "left"(split_part((context ->> 'author_email'::text), '@'::text, 1), 14)
        ELSE NULL::text
    END AS author_nick
FROM feedback_items fi;

-- Re-grant access (security_invoker preserves grants, but explicit for clarity)
GRANT SELECT ON public.v_feedback_public TO anon, authenticated, service_role;
