-- v26.70 Marketplace Tutti-Style (Master-Auftrag #5)
-- Inserate ohne Pflicht-Stripe-Connect. Online-Payment ist optional.
-- Default-Verkauf = "Tutti-Style" via Chat + private Übergabe.

-- (1) marketplace_listings erweitern
ALTER TABLE public.marketplace_listings
  ADD COLUMN IF NOT EXISTS allow_online_payment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contact_method text NOT NULL DEFAULT 'chat'
    CHECK (contact_method IN ('chat','email','phone'));

COMMENT ON COLUMN public.marketplace_listings.allow_online_payment IS
  'v26.70: true = Käufer kann in der App über Stripe bezahlen. false (default) = Tutti-Style: Kontaktiere Verkäufer, private Klärung.';
COMMENT ON COLUMN public.marketplace_listings.contact_method IS
  'v26.70: chat (default in-app) / email / phone';

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_online_pay
  ON public.marketplace_listings (allow_online_payment) WHERE allow_online_payment = true;

-- (2) marketplace_messages — In-App-Chat Käufer↔Verkäufer
CREATE TABLE IF NOT EXISTS public.marketplace_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(message) <= 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_messages_listing_time
  ON public.marketplace_messages (listing_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_buyer
  ON public.marketplace_messages (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_seller
  ON public.marketplace_messages (seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_messages_unread
  ON public.marketplace_messages (seller_id, listing_id) WHERE read_at IS NULL;

ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "users read own chat" ON public.marketplace_messages;
CREATE POLICY "users read own chat" ON public.marketplace_messages
  FOR SELECT USING (
    buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "users send own messages" ON public.marketplace_messages;
CREATE POLICY "users send own messages" ON public.marketplace_messages
  FOR INSERT WITH CHECK (
    sender_id = (SELECT auth.uid())
    AND (buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "users update own seen flag" ON public.marketplace_messages;
CREATE POLICY "users update own seen flag" ON public.marketplace_messages
  FOR UPDATE USING (
    buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())
  ) WITH CHECK (
    buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid())
  );

DROP POLICY IF EXISTS "users delete own messages" ON public.marketplace_messages;
CREATE POLICY "users delete own messages" ON public.marketplace_messages
  FOR DELETE USING (sender_id = (SELECT auth.uid()));

COMMENT ON TABLE public.marketplace_messages IS
  'v26.70: In-App-Chat zwischen Buyer und Seller eines Listings. RLS: nur Beteiligte sehen die Messages.';

-- (3) View für Conversation-Übersicht
CREATE OR REPLACE VIEW public.v_marketplace_conversations
WITH (security_invoker=true) AS
SELECT
  m.listing_id,
  m.buyer_id,
  m.seller_id,
  l.title AS listing_title,
  l.user_id AS listing_owner,
  MAX(m.created_at) AS last_message_at,
  COUNT(*) FILTER (WHERE m.read_at IS NULL AND m.sender_id <> (SELECT auth.uid())) AS unread_count,
  (SELECT mm.message FROM public.marketplace_messages mm
     WHERE mm.listing_id = m.listing_id AND mm.buyer_id = m.buyer_id
     ORDER BY mm.created_at DESC LIMIT 1) AS last_message,
  (SELECT mm.sender_id FROM public.marketplace_messages mm
     WHERE mm.listing_id = m.listing_id AND mm.buyer_id = m.buyer_id
     ORDER BY mm.created_at DESC LIMIT 1) AS last_sender_id
FROM public.marketplace_messages m
JOIN public.marketplace_listings l ON l.id = m.listing_id
WHERE m.buyer_id = (SELECT auth.uid()) OR m.seller_id = (SELECT auth.uid())
GROUP BY m.listing_id, m.buyer_id, m.seller_id, l.title, l.user_id;

COMMENT ON VIEW public.v_marketplace_conversations IS
  'v26.70: Conversation-Übersicht für In-App-Chat. RLS via security_invoker — User sieht nur eigene Chats.';

-- (4) RPC fn_mkt_chat_mark_read
CREATE OR REPLACE FUNCTION public.fn_mkt_chat_mark_read(
  p_listing_id uuid, p_buyer_id uuid
) RETURNS int LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE _uid uuid := (SELECT auth.uid()); _n int;
BEGIN
  IF _uid IS NULL THEN RETURN 0; END IF;
  UPDATE public.marketplace_messages
  SET read_at = now()
  WHERE listing_id = p_listing_id
    AND buyer_id = p_buyer_id
    AND sender_id <> _uid
    AND read_at IS NULL
    AND (buyer_id = _uid OR seller_id = _uid);
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

REVOKE EXECUTE ON FUNCTION public.fn_mkt_chat_mark_read(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_mkt_chat_mark_read(uuid,uuid) TO authenticated;
