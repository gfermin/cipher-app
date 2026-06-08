-- ================================================================
-- CIPHER — Fix Infinite Recursion in chat_participants SELECT Policy
-- Migration: 018_fix_cp_select_recursion.sql
--
-- Problem:
--   cp_select_own_chats evaluates:
--     chat_id IN (SELECT chat_id FROM chat_participants WHERE user_id = auth.uid())
--   This subquery hits chat_participants again, which re-evaluates the
--   same policy → infinite recursion. The error surfaces on any table
--   whose policy joins against chat_participants (messages, chats, etc.).
--
-- Fix:
--   Introduce get_my_chat_ids(), a SECURITY DEFINER helper that reads
--   chat_participants bypassing RLS. Replace the recursive subquery in
--   cp_select_own_chats with a call to this function.
--
-- Depends on: 001_initial_schema.sql
-- ================================================================

-- Helper: returns the calling user's chat_id list without triggering
-- RLS on chat_participants (SECURITY DEFINER bypasses row policies).
CREATE OR REPLACE FUNCTION public.get_my_chat_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER
SET search_path = public AS $$
  SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_chat_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_chat_ids() TO authenticated;

-- Rewrite the recursive policy to use the SECURITY DEFINER helper.
DROP POLICY IF EXISTS "cp_select_own_chats" ON public.chat_participants;

CREATE POLICY "cp_select_own_chats" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (chat_id IN (SELECT public.get_my_chat_ids()));
