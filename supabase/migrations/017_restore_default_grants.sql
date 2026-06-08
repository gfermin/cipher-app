-- ================================================================
-- CIPHER — Restore Default Supabase Table Grants
-- Migration: 017_restore_default_grants.sql
--
-- After a full schema reset (DROP SCHEMA public CASCADE + recreate),
-- Supabase's default table grants for anon/authenticated are wiped.
-- PostgREST requires BOTH an RLS policy AND the SQL privilege to
-- execute a query. Without these grants, all API calls return 403
-- even when a valid JWT is present.
--
-- Depends on: all prior migrations (must run after all tables exist)
-- ================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, anon;
