-- v28.33 Tutti-Lifecycle Sichtbarkeit: sold + archived (+ draft/paused) für Fremde unsichtbar.
-- Vorher: marketplace_select_active = (status <> 'archived' OR own) → sold war öffentlich (Bug).
-- Nachher: nur active/reserved öffentlich; eigene (aller Status) immer sichtbar.
-- Bewusst OHNE is_admin_user() in der PUBLIC-SELECT-Policy (Perf + vermeidet anon-EXECUTE-Bedarf).
-- Admin-Voll-Sicht kommt via dedizierter SECURITY-DEFINER-RPC (A.5 Admin-Archiv).
-- Verifiziert transaktional: anon=active,reserved · fremd=active,reserved · Eigentümer=alle.
DROP POLICY IF EXISTS marketplace_select_active ON public.marketplace_listings;
CREATE POLICY marketplace_select_active ON public.marketplace_listings
  FOR SELECT
  USING (
    status IN ('active','reserved')
    OR (SELECT auth.uid()) = user_id
  );
