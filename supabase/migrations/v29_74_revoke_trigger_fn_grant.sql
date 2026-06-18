-- v29.74 · Backend-Hygiene (Security-Advisor): fn_force_author_role ist eine reine
-- TRIGGER-Funktion (RETURNS trigger, setzt NEW.role), wurde aber per Default-Grant als
-- SECURITY-DEFINER-RPC für anon/authenticated exponiert. Trigger laufen als Tabellen-Owner
-- und brauchen keine EXECUTE-Grants → Grant ersatzlos entziehen (nicht über REST aufrufbar machen).
-- Hinweis: die ebenfalls geflaggten Rollen-Helfer fn_is_role/fn_role_at_least bleiben für anon
-- aufrufbar — sie werden in PUBLIC-RLS-Policies (anon-anwendbar) genutzt; Revoke würde anon-Lesen brechen.
revoke execute on function public.fn_force_author_role() from public, anon, authenticated;
