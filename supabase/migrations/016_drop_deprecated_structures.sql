-- ================================================================
-- CIPHER — Drop Deprecated Structures
-- Migration: 016_drop_deprecated_structures.sql
--
-- Removes accumulated technical debt from the initial schema:
--
--   1. chat_vaults table — superseded by user_vault_codes (migration 007).
--      No code path references this table.
--
--   2. set_vault_password() / verify_vault_password() — superseded by
--      set_user_vault_code() / verify_user_vault_code() (migration 007).
--      Not called anywhere in the application.
--
--   3. chats_insert_auth policy — permissive INSERT on public.chats.
--      All chat creation now goes through create_direct_chat() and
--      accept_chat_request() (both SECURITY DEFINER, bypass RLS).
--      The open policy is unreachable in practice but represents
--      unnecessary attack surface.
--
-- Depends on: 001_initial_schema.sql, 007_vault_per_user_codes.sql,
--             011_rls_policy_hardening.sql
-- ================================================================

-- 1. Drop deprecated vault functions (reference chat_vaults, must drop first)
DROP FUNCTION IF EXISTS public.set_vault_password(UUID, TEXT);
DROP FUNCTION IF EXISTS public.verify_vault_password(UUID, TEXT);

-- 2. Drop deprecated table (CASCADE removes its RLS policies and indexes)
DROP TABLE IF EXISTS public.chat_vaults CASCADE;

-- 3. Close the permissive INSERT policy on chats (TD-10 / RLS-1)
DROP POLICY IF EXISTS "chats_insert_auth" ON public.chats;
