-- ================================================================
-- CIPHER — Phase 2: Per-User Vault Codes
-- Migration: 006_vault_per_user_codes.sql
-- Depends on: 005_phase6_security_hardening.sql
--
-- Changes:
-- 1. user_vault_codes table — per-user per-chat vault codes.
--    Replaces the shared chat_vaults code model. chat_vaults is
--    retained for backwards compatibility but no longer used by
--    the application.
-- 2. set_user_vault_code RPC — upserts a bcrypt hash for the
--    calling user's vault code in a specific chat.
-- 3. verify_user_vault_code RPC — returns TRUE/FALSE/NULL where
--    NULL means no code has been set (no row found).
-- 4. has_user_vault_code RPC — returns whether the caller has set
--    a vault code for a given chat.
-- 5. vault_chat_images (replace) — now returns INTEGER: the count
--    of image rows newly flipped to is_vaulted = TRUE.
-- ================================================================


-- ── user_vault_codes ─────────────────────────────────────────────
-- One row per (user_id, chat_id) pair. Each participant holds their
-- own key; the shared vault content is accessible to anyone with a
-- valid code for that chat.

CREATE TABLE public.user_vault_codes (
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id       UUID        NOT NULL REFERENCES public.chats(id)    ON DELETE CASCADE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);

-- PK covers (user_id, chat_id). Separate index for chat-level queries
-- (listing all users with codes set in a chat).
CREATE INDEX idx_user_vault_codes_chat ON public.user_vault_codes(chat_id);

ALTER TABLE public.user_vault_codes ENABLE ROW LEVEL SECURITY;

-- Users can only read their own code row.
-- The hash is never returned to the client (only RPCs read it),
-- but this is defence-in-depth against direct API access.
CREATE POLICY "uvc_select_own" ON public.user_vault_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- All writes go through SECURITY DEFINER RPCs which bypass RLS.
-- Direct INSERT/UPDATE/DELETE by clients is denied by default
-- (no policies = deny). Matches the pattern used for all
-- contact-discovery tables in this codebase.


-- ── set_user_vault_code ───────────────────────────────────────────
-- Creates or updates the calling user's vault code for p_chat_id.
-- No current-code verification required: possession of the
-- secret_vault command is the implicit authorisation.

CREATE OR REPLACE FUNCTION public.set_user_vault_code(p_chat_id UUID, p_code TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  v_hash := crypt(p_code, gen_salt('bf', 10));

  INSERT INTO public.user_vault_codes (user_id, chat_id, password_hash)
  VALUES (auth.uid(), p_chat_id, v_hash)
  ON CONFLICT (user_id, chat_id) DO UPDATE
    SET password_hash = v_hash,
        updated_at    = NOW();
END;
$$;


-- ── verify_user_vault_code ────────────────────────────────────────
-- Returns:
--   TRUE  — code is correct
--   FALSE — code is incorrect
--   NULL  — no vault code has been set for this (user, chat) pair
--
-- Callers must distinguish NULL from FALSE to show the correct toast.

CREATE OR REPLACE FUNCTION public.verify_user_vault_code(p_chat_id UUID, p_code TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  SELECT password_hash INTO v_hash
  FROM public.user_vault_codes
  WHERE user_id = auth.uid() AND chat_id = p_chat_id;

  IF v_hash IS NULL THEN RETURN NULL; END IF;

  RETURN v_hash = crypt(p_code, v_hash);
END;
$$;


-- ── has_user_vault_code ───────────────────────────────────────────
-- Returns TRUE if the calling user has set a vault code for p_chat_id.
-- Used by VaultSetupModal to decide Create vs. Update header text.

CREATE OR REPLACE FUNCTION public.has_user_vault_code(p_chat_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_vault_codes
    WHERE user_id = auth.uid() AND chat_id = p_chat_id
  );
END;
$$;


-- ── vault_chat_images (replace) ───────────────────────────────────
-- Now returns INTEGER: the count of image rows newly flipped to
-- is_vaulted = TRUE. The client uses this to conditionally show
-- the "Images vaulted" toast (Phase 5 implementation).
-- Must DROP first because the return type changes from VOID to INTEGER.

DROP FUNCTION IF EXISTS public.vault_chat_images(UUID);

CREATE OR REPLACE FUNCTION public.vault_chat_images(p_chat_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant of this chat';
  END IF;

  UPDATE public.messages
  SET is_vaulted = TRUE
  WHERE chat_id    = p_chat_id
    AND type       = 'image'
    AND is_vaulted = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;


-- ── Permissions ───────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.set_user_vault_code(UUID, TEXT)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_user_vault_code(UUID, TEXT)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_user_vault_code(UUID)           FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_user_vault_code(UUID, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_user_vault_code(UUID, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_user_vault_code(UUID)           TO authenticated;

-- vault_chat_images keeps its existing authenticated grant from
-- 001_initial_schema.sql. No re-grant needed.
