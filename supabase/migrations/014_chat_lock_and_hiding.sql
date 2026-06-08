-- ================================================================
-- CIPHER — Chat Security Phase 1: Database Foundation
-- Migration: 013_chat_lock_and_hiding.sql
-- Depends on: 012_account_deletion.sql
--
-- Changes:
-- 1. profiles.chat_lock_enabled — global auto-lock preference
-- 2. hidden_chats table — per-user per-chat hide records with RLS
-- 3. get_hidden_chats() — returns hidden chat IDs for the caller
-- 4. set_chat_hidden() — idempotent hide/unhide toggle
-- 5. set_chat_lock_enabled() — toggles the global lock preference
-- ================================================================


-- ── profiles.chat_lock_enabled ───────────────────────────────────
-- Global preference: when TRUE, every chat is locked on app load
-- and re-locked whenever the user navigates away from it.
-- The in-memory lockedChats Set in uiStore gates the per-chat state;
-- this column is the durable preference that survives page refreshes.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS chat_lock_enabled BOOLEAN NOT NULL DEFAULT FALSE;


-- ── hidden_chats ─────────────────────────────────────────────────
-- One row per (user_id, chat_id) pair the user has chosen to hide.
-- Hidden chats are excluded from the normal getChats() board query
-- server-side so their content never enters a network response.
-- They are accessible only via get_hidden_chats() + the secret_chats
-- command (Phase 5).
--
-- CASCADE ensures rows are cleaned up when a profile or chat is deleted.
-- No direct client writes — all mutations go through SECURITY DEFINER RPCs.

CREATE TABLE public.hidden_chats (
  user_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  chat_id   UUID        NOT NULL REFERENCES public.chats(id)    ON DELETE CASCADE,
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, chat_id)
);

ALTER TABLE public.hidden_chats ENABLE ROW LEVEL SECURITY;

-- Owner-only read policy — defence-in-depth for direct API access.
-- All writes go through SECURITY DEFINER RPCs which bypass RLS.
CREATE POLICY "hidden_chats_owner" ON public.hidden_chats
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());


-- ── get_hidden_chats ─────────────────────────────────────────────
-- Returns the chat_ids the calling user has hidden, newest-first.
-- The client (chatService.getHiddenChats) hydrates these IDs into
-- full ChatWithParticipants objects using the same query loop as
-- getChats(), keeping the RPC payload minimal.
-- Returns an empty result set (not an error) when nothing is hidden.

CREATE OR REPLACE FUNCTION public.get_hidden_chats()
RETURNS TABLE (chat_id UUID) LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
    SELECT hc.chat_id
    FROM   public.hidden_chats hc
    WHERE  hc.user_id = auth.uid()
    ORDER  BY hc.hidden_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_hidden_chats()             FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_hidden_chats()         TO authenticated;


-- ── set_chat_hidden ───────────────────────────────────────────────
-- Idempotent: p_hidden=TRUE hides the chat, p_hidden=FALSE unhides.
-- Verifies the caller is a participant before writing.
-- Raises P0001 'not_a_participant' if the chat_id is invalid or the
-- caller is not a member — same error pattern as vault RPCs.

CREATE OR REPLACE FUNCTION public.set_chat_hidden(p_chat_id UUID, p_hidden BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE  chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  IF p_hidden THEN
    INSERT INTO public.hidden_chats (user_id, chat_id)
    VALUES (auth.uid(), p_chat_id)
    ON CONFLICT (user_id, chat_id) DO NOTHING;
  ELSE
    DELETE FROM public.hidden_chats
    WHERE  user_id = auth.uid() AND chat_id = p_chat_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_chat_hidden(UUID, BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_chat_hidden(UUID, BOOLEAN) TO authenticated;


-- ── set_chat_lock_enabled ─────────────────────────────────────────
-- Toggles the global chat lock preference for the calling user.
-- The client reads this on app load to decide whether to populate
-- uiStore.lockedChats with all chat IDs.

CREATE OR REPLACE FUNCTION public.set_chat_lock_enabled(p_enabled BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET    chat_lock_enabled = p_enabled
  WHERE  id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.set_chat_lock_enabled(BOOLEAN) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.set_chat_lock_enabled(BOOLEAN) TO authenticated;
