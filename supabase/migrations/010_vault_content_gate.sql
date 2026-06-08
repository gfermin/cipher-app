-- ================================================================
-- CIPHER — Phase 1 Security: Vault Content Gate
-- Migration: 009_vault_content_gate.sql
-- Depends on: 008_vault_rate_limiting.sql
--
-- Fixes H-1 (vault content exposed to client before authentication):
--
-- 1. vault_session_tokens — short-lived per-user per-chat tokens
--    issued by verify_user_vault_code on successful unlock.
-- 2. verify_user_vault_code (replace) — now returns TEXT:
--      UUID string  = success (the session token)
--      ''           = wrong code
--      NULL         = no vault code set for this (user, chat)
--    Rate-limit path still raises 'vault_rate_limited' P0001.
-- 3. get_vault_messages — SECURITY DEFINER RPC that validates the
--    session token before returning is_vaulted=TRUE rows. This is
--    the ONLY path that can return vault content to a client.
-- 4. check_owns_image — SECURITY DEFINER ownership helper used by
--    the /api/media/delete route to authorise Cloudinary deletion
--    without exposing vaulted messages through the RLS policy.
-- 5. messages_select_participant (replace) — tightened to exclude
--    is_vaulted=TRUE rows from all direct client queries. Vault
--    content is now inaccessible via the Supabase JS client except
--    through get_vault_messages.
-- ================================================================


-- ── vault_session_tokens ─────────────────────────────────────────
-- One row per (user, chat) unlock session. Deleted and re-issued on
-- each successful verify. Expires 5 minutes after issue — long
-- enough for normal gallery use, short enough to limit exposure.

CREATE TABLE public.vault_session_tokens (
  token      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id    UUID        NOT NULL REFERENCES public.chats(id)    ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE INDEX idx_vault_tokens_user_chat
  ON public.vault_session_tokens(user_id, chat_id);

ALTER TABLE public.vault_session_tokens ENABLE ROW LEVEL SECURITY;
-- No client policies — all access is through SECURITY DEFINER RPCs.


-- ── verify_user_vault_code (replace) ─────────────────────────────
-- Return contract:
--   UUID string → success; session token minted and returned
--   ''          → wrong code
--   NULL        → no vault code set for this (user, chat) pair
--   raises P0001 'vault_rate_limited' → too many attempts
--
-- Must DROP the old BOOLEAN-returning version first (return type change).

DROP FUNCTION IF EXISTS public.verify_user_vault_code(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.verify_user_vault_code(p_chat_id UUID, p_code TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_hash        TEXT;
  v_attempt_cnt INTEGER;
  v_token       UUID;
BEGIN
  -- Participation check
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  -- Rate limit: 5 attempts per 60 seconds (inherited from migration 008)
  SELECT COUNT(*) INTO v_attempt_cnt
  FROM   public.vault_verify_attempts
  WHERE  user_id      = auth.uid()
    AND  attempted_at >= NOW() - INTERVAL '60 seconds';

  IF v_attempt_cnt >= 5 THEN
    RAISE EXCEPTION 'vault_rate_limited' USING ERRCODE = 'P0001';
  END IF;

  -- Log the attempt before verifying so correct guesses consume a slot
  INSERT INTO public.vault_verify_attempts (user_id) VALUES (auth.uid());

  -- Prune stale entries to keep the table compact
  DELETE FROM public.vault_verify_attempts
  WHERE  user_id      = auth.uid()
    AND  attempted_at < NOW() - INTERVAL '60 seconds';

  -- Look up the stored hash
  SELECT password_hash INTO v_hash
  FROM   public.user_vault_codes
  WHERE  user_id = auth.uid() AND chat_id = p_chat_id;

  -- No code set for this (user, chat)
  IF v_hash IS NULL THEN RETURN NULL; END IF;

  -- Wrong code — return empty string so the client can distinguish
  -- from the NULL (no code) case without an exception.
  IF v_hash != crypt(p_code, v_hash) THEN RETURN ''; END IF;

  -- Correct — rotate the session token (one token per user per chat)
  DELETE FROM public.vault_session_tokens
  WHERE user_id = auth.uid() AND chat_id = p_chat_id;

  INSERT INTO public.vault_session_tokens (user_id, chat_id)
  VALUES (auth.uid(), p_chat_id)
  RETURNING token INTO v_token;

  RETURN v_token::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_user_vault_code(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.verify_user_vault_code(UUID, TEXT) TO authenticated;


-- ── get_vault_messages ────────────────────────────────────────────
-- The only server path that returns is_vaulted=TRUE rows.
-- Requires a valid, unexpired session token issued by
-- verify_user_vault_code for the same (user, chat) pair.
-- Returns rows ordered newest-first (matches previous gallery behaviour).

CREATE OR REPLACE FUNCTION public.get_vault_messages(p_chat_id UUID, p_token UUID)
RETURNS SETOF public.messages LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  -- Token must belong to the calling user, match the requested chat,
  -- and still be within its 5-minute window.
  IF NOT EXISTS (
    SELECT 1 FROM public.vault_session_tokens
    WHERE  token      = p_token
      AND  user_id    = auth.uid()
      AND  chat_id    = p_chat_id
      AND  expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'invalid_vault_token' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT * FROM public.messages
    WHERE  chat_id    = p_chat_id
      AND  is_vaulted = TRUE
      AND  type       = 'image'
      AND  is_deleted = FALSE
    ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vault_messages(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_vault_messages(UUID, UUID) TO authenticated;


-- ── check_owns_image ─────────────────────────────────────────────
-- Ownership helper for the /api/media/delete route handler.
-- Returns TRUE if auth.uid() is a participant in the chat that
-- contains the given image_path. Bypasses RLS so it can verify
-- ownership of vaulted images (which are hidden from direct queries).

CREATE OR REPLACE FUNCTION public.check_owns_image(p_public_id TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM   public.messages m
    JOIN   public.chat_participants cp ON cp.chat_id = m.chat_id
    WHERE  m.image_path = p_public_id
      AND  cp.user_id   = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.check_owns_image(TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_owns_image(TEXT) TO authenticated;


-- ── Tighten messages SELECT policy ───────────────────────────────
-- Exclude is_vaulted=TRUE rows from all direct client queries.
-- This closes H-1: vault content no longer reaches the JS runtime
-- on chat open. The get_vault_messages RPC (above) is the only
-- server-authorised path to read vaulted rows.
--
-- SECURITY DEFINER functions (vault_chat_images, delete_vault_image,
-- get_vault_messages) bypass RLS and are unaffected.

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;

CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (
    is_vaulted = false
    AND chat_id IN (
      SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()
    )
  );
