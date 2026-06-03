-- ================================================================
-- CIPHER — Phase 3: Rate Limiting + Realtime
-- Migration: 004_phase3_rate_limiting.sql
-- Depends on: 002_contact_discovery.sql
--
-- Adds a rolling lookup-attempt log and two SECURITY DEFINER helpers
-- so the contact-lookup Edge Function can enforce per-user rate limits
-- without direct client access to the log table.
--
-- Also enables Supabase Realtime on chat_requests so the receiver
-- gets notified on INSERT and both parties get notified on UPDATE.
-- ================================================================

-- ── lookup_rate_log ───────────────────────────────────────────────
-- Tracks code-lookup attempts per user. The Edge Function inserts here
-- after each call; the check function counts the rolling window.
-- Rows older than 1 hour are pruned by log_lookup_attempt itself.

CREATE TABLE public.lookup_rate_log (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index used by both the rate-limit check (WHERE user_id + window) and pruning.
CREATE INDEX idx_lookup_rate_log_user_window
  ON public.lookup_rate_log (user_id, attempted_at DESC);

-- No client policies — all access is via SECURITY DEFINER functions only.
ALTER TABLE public.lookup_rate_log ENABLE ROW LEVEL SECURITY;

-- ── check_lookup_rate_limit(user_id) ─────────────────────────────
-- Returns TRUE  — within limits, allow the lookup.
-- Returns FALSE — rate-limit exceeded, caller should return 429.
-- Limits: 5 per minute, 20 per hour (matches the security spec in §8).

CREATE OR REPLACE FUNCTION public.check_lookup_rate_limit(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_per_minute INT;
  v_per_hour   INT;
BEGIN
  SELECT COUNT(*) INTO v_per_minute
  FROM lookup_rate_log
  WHERE user_id    = p_user_id
    AND attempted_at > NOW() - INTERVAL '1 minute';

  IF v_per_minute >= 5 THEN RETURN FALSE; END IF;

  SELECT COUNT(*) INTO v_per_hour
  FROM lookup_rate_log
  WHERE user_id    = p_user_id
    AND attempted_at > NOW() - INTERVAL '1 hour';

  IF v_per_hour >= 20 THEN RETURN FALSE; END IF;

  RETURN TRUE;
END;
$$;

-- ── log_lookup_attempt(user_id) ───────────────────────────────────
-- Records a new attempt and prunes entries older than 1 hour for this user.
-- Pruning is per-user so it stays cheap and avoids a global table scan.

CREATE OR REPLACE FUNCTION public.log_lookup_attempt(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lookup_rate_log (user_id) VALUES (p_user_id);

  DELETE FROM lookup_rate_log
  WHERE user_id    = p_user_id
    AND attempted_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Only the service_role (Edge Functions) may call these helpers.
GRANT EXECUTE ON FUNCTION public.check_lookup_rate_limit(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.log_lookup_attempt(UUID)      TO service_role;

-- ── Realtime publication ──────────────────────────────────────────
-- Enable Postgres Changes on chat_requests so:
--   • Receivers get an INSERT notification when someone sends a request.
--   • Senders get an UPDATE notification when their request is accepted.
-- If chat_requests is already in the publication this is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'chat_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_requests;
  END IF;
END;
$$;
