-- v29.33 (Audit-Hygiene, HL#17): system_events ist service/definer-only. Die breiten
-- Default-Tabellen-Grants für anon/authenticated sind durch RLS (default-deny) zwar inert,
-- aber least-privilege ist sauberer. Explizit entziehen (RLS bleibt zusätzlich aktiv).
-- Verifiziert: danach keine anon/authenticated-Grants mehr auf system_events.
REVOKE ALL ON public.system_events FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.system_events_id_seq FROM anon, authenticated;
