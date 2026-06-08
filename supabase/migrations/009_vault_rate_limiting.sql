-- ================================================================
-- CIPHER — Phase 6: Vault Rate Limiting
-- Migration: 008_vault_rate_limiting.sql
-- Depends on: 006_vault_per_user_codes.sql
--
-- Changes:
-- 1. vault_verify_attempts table — rolling log of verify calls.
--    No direct client access; only SECURITY DEFINER RPCs touch it.
-- 2. verify_user_vault_code (replace) — adds 5-per-60s rate limit.
--    Exceeding the limit raises 'vault_rate_limited' (ERRCODE P0001)
--    so the client can show a distinct toast and enter cooldown.
-- ================================================================


-- ── vault_verify_attempts ─────────────────────────────────────────
-- One row per verification call (correct or incorrect). RLS enabled
-- but no SELECT/INSERT/UPDATE/DELETE policies — clients cannot read
-- or write this table directly. All access goes through the
-- verify_user_vault_code SECURITY DEFINER function below.

CREATE TABLE public.vault_verify_attempts (
  id           BIGSERIAL   PRIMARY KEY,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_vault_verify_attempts_user_time
  ON public.vault_verify_attempts(user_id, attempted_at);

ALTER TABLE public.vault_verify_attempts ENABLE ROW LEVEL SECURITY;


-- ── verify_user_vault_code (replace with rate-limited version) ────
-- Returns:
--   TRUE  — code is correct
--   FALSE — code is incorrect
--   NULL  — no vault code has been set for this (user, chat) pair
-- Raises SQLSTATE P0001 with message 'vault_rate_limited' when the
-- caller has made 5 or more verification attempts in the last 60
-- seconds. The client catches this specific message and shows the
-- cooldown toast instead of a generic error.
--
-- Correct guesses count toward the limit to prevent timing attacks
-- that enumerate validity by flipping between correct and incorrect.

CREATE OR REPLACE FUNCTION public.verify_user_vault_code(p_chat_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_hash        TEXT;
  v_attempt_cnt INTEGER;
BEGIN
  -- Participation check
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  -- Count recent attempts (across all chats for this user)
  SELECT COUNT(*) INTO v_attempt_cnt
  FROM   public.vault_verify_attempts
  WHERE  user_id      = auth.uid()
    AND  attempted_at >= NOW() - INTERVAL '60 seconds';

  IF v_attempt_cnt >= 5 THEN
    RAISE EXCEPTION 'vault_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  -- Log before verifying so correct guesses consume a slot
  INSERT INTO public.vault_verify_attempts (user_id) VALUES (auth.uid());

  -- Prune entries older than 60 seconds to keep the table compact
  DELETE FROM public.vault_verify_attempts
  WHERE  user_id      = auth.uid()
    AND  attempted_at < NOW() - INTERVAL '60 seconds';

  -- Verify the code
  SELECT password_hash INTO v_hash
  FROM   public.user_vault_codes
  WHERE  user_id = auth.uid() AND chat_id = p_chat_id;

  IF v_hash IS NULL THEN RETURN NULL; END IF;

  RETURN v_hash = crypt(p_code, v_hash);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_user_vault_code(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_user_vault_code(UUID, TEXT) TO authenticated;
