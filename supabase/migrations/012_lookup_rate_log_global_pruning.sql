-- ================================================================
-- CIPHER — Phase 4: Global lookup_rate_log pruning
-- Migration: 011_lookup_rate_log_global_pruning.sql
--
-- The existing log_lookup_attempt() RPC only prunes rows older than
-- 1 hour for the CALLING user. Inactive users' rows accumulate
-- indefinitely. This migration adds a SECURITY DEFINER function
-- that deletes ALL rows older than 1 hour and schedules it as a
-- daily pg_cron job.
--
-- If pg_cron is not enabled, the function is still created and can
-- be scheduled manually via Supabase Dashboard → Integrations → Cron.
-- ================================================================

-- ── prune_lookup_rate_log ─────────────────────────────────────────
-- Deletes all rows older than 1 hour from lookup_rate_log.
-- Safe to call at any time; the 1-hour window matches the rate-limit
-- window used by check_lookup_rate_limit / log_lookup_attempt.

CREATE OR REPLACE FUNCTION public.prune_lookup_rate_log()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.lookup_rate_log
  WHERE attempted_at < NOW() - INTERVAL '1 hour';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.prune_lookup_rate_log() FROM PUBLIC;
-- Only service_role (Supabase cron / Edge Functions) should call this.
GRANT EXECUTE ON FUNCTION public.prune_lookup_rate_log() TO service_role;


-- ── Schedule daily pruning via pg_cron ───────────────────────────
-- Runs at 03:00 UTC daily. Unschedule with:
--   SELECT cron.unschedule('cipher_prune_lookup_rate_log');
-- If pg_cron is not enabled this block can be skipped; schedule
-- via Supabase Dashboard → Integrations → Cron instead.

SELECT cron.schedule(
  'cipher_prune_lookup_rate_log',
  '0 3 * * *',
  $cron$ SELECT public.prune_lookup_rate_log(); $cron$
);
