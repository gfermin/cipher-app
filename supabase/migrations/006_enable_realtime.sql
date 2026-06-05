-- ================================================================
-- CIPHER — Enable Realtime for messaging tables
-- ================================================================
-- Without this migration, postgres_changes subscriptions for the
-- messages table receive no events. Supabase requires tables to be
-- explicitly added to the supabase_realtime publication.
--
-- REPLICA IDENTITY FULL is required so that row-level filters on
-- UPDATE events (filter: chat_id=eq.X) work correctly — without it,
-- Supabase cannot match the filter against old row values on UPDATE.
-- ================================================================

-- Add messages to the realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END;
$$;

-- Add typing_indicators to the realtime publication (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END;
$$;

-- Required for row-level filters on UPDATE events to work correctly
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;
