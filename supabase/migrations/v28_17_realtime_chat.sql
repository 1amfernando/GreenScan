-- ============================================================================
-- v28_17_realtime_chat — Spiegel der LIVE-Migration (Block 2/4).
-- marketplace_messages zur supabase_realtime-Publication → postgres_changes-Broadcasts
-- (INSERT) für den In-App-Chat. RLS unverändert (owner/buyer/seller-only) → Realtime
-- liefert nur Zeilen, die der User per RLS sehen darf. Idempotent.
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'marketplace_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.marketplace_messages;
  END IF;
END $$;
