-- ================================================================
-- CIPHER — Phase 2: RLS Policy Hardening
-- Migration: 010_rls_policy_hardening.sql
-- Depends on: 001_initial_schema.sql
--
-- Fixes M-1 (any authenticated user can join any chat):
--   - Drop permissive cp_insert_auth INSERT policy on chat_participants.
--   - All participant writes now go through SECURITY DEFINER RPCs that
--     bypass RLS: accept_chat_request (002) and create_direct_chat (below).
--
-- Fixes M-2 (any participant can update any message in their chats):
--   - Drop permissive messages_update_participant UPDATE policy.
--   - Replace with messages_update_own: callers may only update their
--     own messages (sender_id = auth.uid()).
--   - markMessagesRead client path moves to mark_messages_read RPC
--     (SECURITY DEFINER) so read_by updates on other users' messages
--     remain possible without a permissive policy.
--
-- Confirms M-3 resolved: vault rate-limiting is embedded server-side
--   inside verify_user_vault_code (migration 008). No change needed.
-- ================================================================


-- ── create_direct_chat ────────────────────────────────────────────
-- Replaces the client-side createChat() direct-insert pattern.
-- Idempotent: returns existing chat_id if a 1:1 chat already exists.
-- Atomic: chat + both participant rows inserted in one transaction.
-- Prevents self-chat at the RPC level.

CREATE OR REPLACE FUNCTION public.create_direct_chat(p_other_user_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_chat_id          UUID;
  v_existing_chat_id UUID;
BEGIN
  IF p_other_user_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_chat_with_self' USING ERRCODE = 'P0001';
  END IF;

  -- Return existing 1:1 chat if one already exists between these two users.
  SELECT cp1.chat_id INTO v_existing_chat_id
  FROM   public.chat_participants cp1
  JOIN   public.chat_participants cp2
         ON cp1.chat_id = cp2.chat_id
  WHERE  cp1.user_id = auth.uid()
    AND  cp2.user_id = p_other_user_id
  LIMIT 1;

  IF v_existing_chat_id IS NOT NULL THEN
    RETURN v_existing_chat_id;
  END IF;

  INSERT INTO public.chats (custom_theme) VALUES (NULL)
  RETURNING id INTO v_chat_id;

  INSERT INTO public.chat_participants (chat_id, user_id) VALUES
    (v_chat_id, auth.uid()),
    (v_chat_id, p_other_user_id);

  RETURN v_chat_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_direct_chat(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.create_direct_chat(UUID) TO authenticated;


-- ── mark_messages_read ────────────────────────────────────────────
-- Replaces the client-side markMessagesRead() direct-update pattern.
-- Updates read_by on messages NOT sent by the caller (other users'
-- messages) without requiring a permissive UPDATE policy.
-- Participation is verified before any writes occur.

CREATE OR REPLACE FUNCTION public.mark_messages_read(p_chat_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE  chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.messages
  SET    read_by = array_append(read_by, auth.uid())
  WHERE  chat_id   = p_chat_id
    AND  sender_id != auth.uid()
    AND  NOT (auth.uid() = ANY(read_by));
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.mark_messages_read(UUID) TO authenticated;


-- ── P1: Remove permissive chat_participants INSERT policy ─────────
-- After this drop, no authenticated user can INSERT into
-- chat_participants directly. All inserts go through:
--   - accept_chat_request  (002_contact_discovery.sql — SECURITY DEFINER)
--   - create_direct_chat   (this migration — SECURITY DEFINER)

DROP POLICY IF EXISTS "cp_insert_auth" ON public.chat_participants;


-- ── P2: Restrict messages UPDATE to own messages ──────────────────
-- After this change:
--   - Direct soft-delete (deleteMessage) works — caller is sender.
--   - Direct read_by updates are no longer allowed; use mark_messages_read.

DROP POLICY IF EXISTS "messages_update_participant" ON public.messages;

CREATE POLICY "messages_update_own" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid() AND
    chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
  );
