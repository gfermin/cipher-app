-- ================================================================
-- CIPHER — Chat Search: Foundation & Database
-- Migration: 023_chat_search.sql
-- Depends on: 022_vault_video_fix.sql
--
-- 1. Partial B-tree index on messages(chat_id, content) scoped to
--    text-type, non-deleted, non-vaulted rows — enables fast ILIKE
--    searches without scanning image/video/vault rows.
-- 2. search_chat_messages RPC — ILIKE substring search within a
--    single chat. Escapes %, _, and \ to prevent wildcard injection.
-- 3. get_messages_around_timestamp RPC — windowed message fetch
--    centered on a target timestamp, used for jump-to-message
--    navigation after a search result tap.
-- ================================================================


-- ── Index ────────────────────────────────────────────────────────
-- text_pattern_ops allows the B-tree index to accelerate ILIKE
-- patterns in PostgreSQL. The partial condition (type='text',
-- is_deleted=FALSE, is_vaulted=FALSE) keeps the index small by
-- excluding image/video rows (content IS NULL) and vault rows.
-- NOTE: Run this statement alone outside a transaction block in the
-- Supabase SQL editor if the messages table is large, to avoid a
-- brief table lock. For a fresh/small table, the lock is negligible.

CREATE INDEX IF NOT EXISTS messages_content_text_idx
  ON public.messages (chat_id, content text_pattern_ops)
  WHERE type = 'text' AND is_deleted = FALSE AND is_vaulted = FALSE;


-- ── search_chat_messages ─────────────────────────────────────────
-- ILIKE substring search scoped to a single chat.
--
-- Parameters:
--   p_chat_id  UUID       — the chat to search (required scope)
--   p_query    TEXT       — user search string (≥2 chars enforced client-side)
--   p_limit    INT = 50   — max results (newest-first)
--
-- Security (SECURITY INVOKER):
--   • RLS policy messages_select_participant enforces chat membership
--     and excludes is_vaulted=TRUE rows at the database level.
--   • Explicit WHERE filters repeat these conditions for defense-in-depth.
--   • p_query special characters (%, _, \) are escaped before use in
--     ILIKE so user input is never treated as a wildcard pattern.
--
-- Returns SETOF messages ordered newest-first (created_at DESC).
-- Caller (messageService.searchMessages) enriches each row with
-- sender profile via a follow-up profiles query.

CREATE OR REPLACE FUNCTION public.search_chat_messages(
  p_chat_id UUID,
  p_query   TEXT,
  p_limit   INT DEFAULT 50
)
RETURNS SETOF public.messages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_escaped TEXT;
BEGIN
  -- Participation guard — redundant with RLS but kept for clarity
  -- and to surface a meaningful error instead of an empty result set.
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  -- Escape ILIKE special characters so user-supplied text is literal.
  -- Order: backslash first to avoid double-escaping subsequent replacements.
  v_escaped := REPLACE(p_query,   '\', '\\');
  v_escaped := REPLACE(v_escaped, '%', '\%');
  v_escaped := REPLACE(v_escaped, '_', '\_');

  RETURN QUERY
    SELECT m.*
    FROM   public.messages m
    WHERE  m.chat_id    = p_chat_id
      AND  m.type       = 'text'
      AND  m.is_deleted = FALSE
      AND  m.is_vaulted = FALSE          -- defense-in-depth; RLS also enforces
      AND  m.content    ILIKE '%' || v_escaped || '%' ESCAPE '\'
    ORDER BY m.created_at DESC
    LIMIT  p_limit;
END;
$$;

REVOKE ALL  ON FUNCTION public.search_chat_messages(UUID, TEXT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.search_chat_messages(UUID, TEXT, INT) TO authenticated;


-- ── get_messages_around_timestamp ────────────────────────────────
-- Returns a contiguous chronological window of messages centered on
-- a target timestamp. Used by jump-to-message after a search tap.
--
-- Parameters:
--   p_chat_id   UUID          — the chat to fetch from
--   p_timestamp TIMESTAMPTZ   — target message's created_at value
--   p_window    INT = 30      — rows before AND after the target
--                               (up to 2 × p_window rows returned)
--
-- Security (SECURITY INVOKER): same RLS scope as search_chat_messages.
-- Vault rows are excluded (is_vaulted = FALSE) per RLS + explicit filter.
-- Deleted messages ARE included — they render as "Message deleted"
-- placeholders in ChatPanel, which is the correct graceful degradation.
--
-- Returns rows ordered oldest-first (created_at ASC), ready to replace
-- chatStore.messages[chatId] as a new scroll anchor window.

CREATE OR REPLACE FUNCTION public.get_messages_around_timestamp(
  p_chat_id   UUID,
  p_timestamp TIMESTAMPTZ,
  p_window    INT DEFAULT 30
)
RETURNS SETOF public.messages
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Participation guard (defense-in-depth)
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    WITH before_window AS (
      -- Up to p_window messages at or before the target (DESC to get nearest)
      SELECT * FROM public.messages
      WHERE  chat_id    = p_chat_id
        AND  created_at <= p_timestamp
        AND  is_vaulted = FALSE
      ORDER BY created_at DESC
      LIMIT  p_window
    ),
    after_window AS (
      -- Up to p_window messages strictly after the target (ASC for chronology)
      SELECT * FROM public.messages
      WHERE  chat_id    = p_chat_id
        AND  created_at > p_timestamp
        AND  is_vaulted = FALSE
      ORDER BY created_at ASC
      LIMIT  p_window
    )
    SELECT * FROM before_window
    UNION ALL
    SELECT * FROM after_window
    ORDER BY created_at ASC;
END;
$$;

REVOKE ALL  ON FUNCTION public.get_messages_around_timestamp(UUID, TIMESTAMPTZ, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_messages_around_timestamp(UUID, TIMESTAMPTZ, INT) TO authenticated;
