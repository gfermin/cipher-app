-- ================================================================
-- CIPHER — Chat Search: Full-Text Search Upgrade
-- Migration: 025_chat_search_fts.sql
-- Depends on: 024_chat_search.sql
--
-- Upgrades the ILIKE search foundation (024) to full-text search:
-- 1. Adds content_tsv tsvector STORED generated column to messages.
-- 2. Creates a GIN index on content_tsv for FTS query performance.
-- 3. Replaces search_chat_messages RPC to use ts_rank + tsquery
--    instead of ILIKE, gaining relevance ranking, stemming, and
--    stop-word handling with no change to the service-layer API.
--
-- The ILIKE index from 024 is intentionally retained — it covers
-- the partial index condition used by the old RPC and costs nothing
-- to keep. The GIN index becomes the primary search path.
-- ================================================================


-- ── Generated tsvector column ────────────────────────────────────
-- STORED: computed on every write and persisted — required for GIN
-- indexing (expression indexes cannot be GIN over a volatile function).
-- coalesce(content, '') keeps the column non-NULL for image/video rows
-- (where content IS NULL), producing an empty tsvector instead of NULL.
-- 'english' configuration applies stemming and stop-word removal.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;


-- ── GIN index on content_tsv ─────────────────────────────────────
-- Partial condition mirrors 024's B-tree index — only text, non-deleted,
-- non-vaulted rows are indexed. GIN is the standard access method for
-- tsvector full-text search in PostgreSQL.

CREATE INDEX IF NOT EXISTS messages_content_tsv_idx
  ON public.messages USING GIN (content_tsv)
  WHERE type = 'text' AND is_deleted = FALSE AND is_vaulted = FALSE;


-- ── search_chat_messages (replace) ───────────────────────────────
-- Upgraded from ILIKE to full-text search.
--
-- Key improvements over the ILIKE version:
--   • Relevance ranking: ts_rank orders by match quality, then recency.
--   • Stemming: "running" matches "run"; "searches" matches "search".
--   • Stop-word handling: common words ("the", "is") are ignored cleanly.
--   • Performance: GIN index supports @@ far better than B-tree + ILIKE
--     at large message volumes.
--
-- Uses websearch_to_tsquery (not to_tsquery) so arbitrary user text
-- is parsed safely — no syntax errors on natural input like "hello world".
-- websearch_to_tsquery returns NULL when all terms are stop-words;
-- the NULL guard returns an empty result set in that case.
--
-- Security: unchanged — SECURITY INVOKER, RLS enforces chat membership
-- and vault exclusion; explicit WHERE guards for defense-in-depth.

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
  v_tsquery TSQUERY;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  -- websearch_to_tsquery parses natural user text without raising errors.
  -- Returns NULL when the query is empty or consists entirely of stop-words
  -- (e.g. "the a is") — return empty result set rather than an error.
  v_tsquery := websearch_to_tsquery('english', p_query);
  IF v_tsquery IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT m.*
    FROM   public.messages m
    WHERE  m.chat_id     = p_chat_id
      AND  m.type        = 'text'
      AND  m.is_deleted  = FALSE
      AND  m.is_vaulted  = FALSE
      AND  m.content_tsv @@ v_tsquery
    ORDER BY
      ts_rank(m.content_tsv, v_tsquery) DESC,
      m.created_at DESC
    LIMIT  p_limit;
END;
$$;

REVOKE ALL  ON FUNCTION public.search_chat_messages(UUID, TEXT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.search_chat_messages(UUID, TEXT, INT) TO authenticated;
