-- 20261111_launch_offer_usage_nur_server.sql — NICHT ANGEWANDT (wartet auf Fernando)
--
-- Der Launch-Zähler gehört dem Server.
--
-- Gemessen am 11.11.2026 (Live-DB, nur lesend: pg_policy): auf `launch_offer_usage`
-- gibt es die Policy `launch_offer_insert_own` — FOR INSERT, WITH CHECK
-- ((select auth.uid()) = user_id). Der Zähler lässt sich damit aus dem Browser
-- beschreiben, ohne dass ein Kauf dahintersteht — und `launch_offer_available()`
-- zählt jede Zeile mit. Ein Zähler, den nicht nur der Server schreibt, zählt nicht.
-- Gebraucht wird die Policy von niemandem: die App schreibt die Tabelle nie
-- (0 Stellen in index.html), der einzige Schreiber ist stripe-webhook nach einem
-- BEZAHLTEN Lifetime-Kauf — mit dem Service-Schlüssel, an RLS vorbei.
--
-- Was diese Migration tut: sie nimmt die INSERT-Policy weg und dazu die
-- Schreibrechte der beiden Browser-Rollen. Lesen bleibt, wie es ist
-- (`launch_offer_usage_select`: die eigene Zeile). `launch_offer_available()` ist
-- SECURITY DEFINER und zählt weiter.
--
-- Idempotent. Nachgespielt in scripts/stripe_check.js (Fall „Launch-Zähler ·
-- SQL"): Live-Stand aufgebaut, das Loch reproduziert, zweimal angewandt, danach
-- abgelehnt — und der Webhook-Weg schreibt weiter.

DROP POLICY IF EXISTS launch_offer_insert_own ON public.launch_offer_usage;

REVOKE INSERT, UPDATE, DELETE ON public.launch_offer_usage FROM anon, authenticated;
