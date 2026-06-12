-- ================================================================
-- CIPHER — SQL-Based Contact Code Rotation
-- Migration: 023_cron_sql_rotation.sql
-- Depends on: 002_contact_discovery.sql, 003_phase2_code_generation.sql
--
-- Adds the rotation orchestrator that the pg_cron job calls directly
-- inside the database, replacing the Edge Function as the primary
-- rotation driver. The Edge Function (rotate-contact-codes) remains
-- as a fallback but pg_cron becomes the authoritative scheduler.
--
-- Objects introduced:
--   rotate_expired_codes() — iterates all users whose current code
--     has expired and calls mint_contact_code() for each one.
--     Also prunes codes older than 48h. Returns the count rotated.
--
--   pg_cron job "rotate-contact-codes" — runs every 12 hours.
--
-- Note: _cipher_gen_code(), mint_contact_code(), get_users_needing_rotation(),
-- and cleanup_expired_contact_codes() were introduced in migrations 002 and
-- 003 and are not redefined here.
-- ================================================================

-- ── rotate_expired_codes ──────────────────────────────────────────
-- Loops over every user with an expired is_current=TRUE code and
-- mints a fresh one. Errors on individual users are swallowed so a
-- single bad row cannot abort the entire rotation run.
-- Also prunes codes older than 48h (well past the 15-min grace window).

CREATE OR REPLACE FUNCTION public.rotate_expired_codes()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  r       RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR r IN
    SELECT user_id
    FROM   public.contact_codes
    WHERE  is_current = TRUE
      AND  expires_at < NOW()
  LOOP
    BEGIN
      PERFORM public.mint_contact_code(r.user_id);
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;

  DELETE FROM public.contact_codes
  WHERE expires_at < NOW() - INTERVAL '48 hours';

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.rotate_expired_codes() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.rotate_expired_codes() TO service_role;

-- ── pg_cron schedule ─────────────────────────────────────────────
-- Runs every 12 hours. Uses cron.schedule so a re-run of this
-- migration is idempotent (same job name = upsert, not duplicate).

SELECT cron.schedule(
  'rotate-contact-codes',
  '0 */12 * * *',
  $$SELECT public.rotate_expired_codes();$$
);
