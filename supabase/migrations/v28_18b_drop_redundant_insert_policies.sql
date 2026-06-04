-- ============================================================================
-- v28_18b_drop_redundant_insert_policies — Spiegel der LIVE-Migration (Block 3/4, Teil 2).
-- 5 redundante *_insert_own-Policies gedroppt: jede ist FOR INSERT WITH CHECK
-- ((SELECT auth.uid())=user_id) — identisch zur WITH CHECK der jeweiligen *_owner_all (FOR ALL)
-- Policy, die INSERT bereits abdeckt → multiple_permissive auf INSERT. Drop semantik-erhaltend
-- (Owner kann weiter INSERTen via owner_all, Fremde geblockt — transaktional verifiziert).
-- ============================================================================
DROP POLICY IF EXISTS "garden_diary_insert_own"     ON public.garden_diary;
DROP POLICY IF EXISTS "garden_harvests_insert_own"  ON public.garden_harvests;
DROP POLICY IF EXISTS "garden_plans_insert_own"     ON public.garden_plans;
DROP POLICY IF EXISTS "garden_plantings_insert_own" ON public.garden_plantings;
DROP POLICY IF EXISTS "gardens_insert_own"          ON public.gardens;
