-- ================================================================
-- CIPHER — Phase 6: Security Hardening
-- Migration: 005_phase6_security_hardening.sql
-- Depends on: 004_phase3_rate_limiting.sql
--
-- Changes:
-- 1. blocks table — lets users block others; blocked senders'
--    requests are silently dropped by create_chat_request.
-- 2. lookup_contact_code — rate limiting is now embedded in the RPC
--    itself (was only in the Edge Function). Direct RPC calls no
--    longer bypass the 5/min, 20/hr limits.
-- 3. create_chat_request — per-minute anti-spam (3/min) + blocking
--    integration (silently drop if receiver has blocked sender).
-- ================================================================


-- ── blocks ───────────────────────────────────────────────────────
-- Stores one-directional "A has blocked B" relationships.
-- Used exclusively by create_chat_request to silently drop requests
-- from blocked senders. Block-management UI ships in a later phase.

CREATE TABLE public.blocks (
  id         UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT blocks_no_self_block CHECK (blocker_id <> blocked_id)
);

CREATE UNIQUE INDEX idx_blocks_pair    ON public.blocks(blocker_id, blocked_id);
CREATE INDEX         idx_blocks_blocker ON public.blocks(blocker_id);
CREATE INDEX         idx_blocks_blocked ON public.blocks(blocked_id);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

-- Users can see and manage only their own outbound block list.
-- Neither party can directly write to blocks — only via the SECURITY
-- DEFINER RPCs below, which validate the caller's identity.
CREATE POLICY "blocks_select_own" ON public.blocks
  FOR SELECT TO authenticated USING (blocker_id = auth.uid());


-- ── block_user / unblock_user ─────────────────────────────────────
-- SECURITY DEFINER so the caller cannot write to blocks directly.

CREATE OR REPLACE FUNCTION public.block_user(p_blocked_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF p_blocked_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_block_self' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO blocks (blocker_id, blocked_id)
  VALUES (auth.uid(), p_blocked_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(p_blocked_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  DELETE FROM blocks
  WHERE blocker_id = auth.uid() AND blocked_id = p_blocked_id;
END;
$$;


-- ── lookup_contact_code (replace) ────────────────────────────────
-- Same behaviour as before PLUS built-in rate limiting that mirrors
-- the Edge Function's check (5/min, 20/hr). The Edge Function is
-- still the primary gate; this is defense-in-depth so the RPC
-- cannot be abused by callers who bypass the Edge Function.
--
-- Side-effect: logs and self-prunes the lookup_rate_log table so the
-- Edge Function no longer needs to call log_lookup_attempt separately.

CREATE OR REPLACE FUNCTION public.lookup_contact_code(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions AS $$
DECLARE
  v_per_min     INT;
  v_per_hour    INT;
  v_hash        TEXT;
  v_receiver_id UUID;
  v_seq         INT;
  v_token_id    UUID;
BEGIN
  -- ── Rate limiting (5/min, 20/hr per user) ────────────────────
  SELECT COUNT(*) INTO v_per_min
  FROM lookup_rate_log
  WHERE user_id = auth.uid()
    AND attempted_at > NOW() - INTERVAL '1 minute';

  IF v_per_min >= 5 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_per_hour
  FROM lookup_rate_log
  WHERE user_id = auth.uid()
    AND attempted_at > NOW() - INTERVAL '1 hour';

  IF v_per_hour >= 20 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  -- Record attempt; prune this user's entries older than 1 hour.
  INSERT INTO lookup_rate_log (user_id) VALUES (auth.uid());
  DELETE FROM lookup_rate_log
  WHERE user_id = auth.uid()
    AND attempted_at < NOW() - INTERVAL '1 hour';

  -- ── Code lookup ───────────────────────────────────────────────
  v_hash := encode(digest(p_code, 'sha256'), 'hex');

  SELECT cc.user_id, cc.rotation_sequence
  INTO v_receiver_id, v_seq
  FROM contact_codes cc
  WHERE cc.code_hash = v_hash
    AND cc.expires_at + INTERVAL '15 minutes' > NOW()
  LIMIT 1;

  -- Identical error for invalid, expired, non-existent, and self-lookup.
  -- No oracle that confirms whether a user exists.
  IF v_receiver_id IS NULL OR v_receiver_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO contact_lookup_tokens (receiver_id, code_hash, rotation_sequence)
  VALUES (v_receiver_id, v_hash, v_seq)
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;


-- ── create_chat_request (replace) ────────────────────────────────
-- Adds two new guards over the Phase 1 version:
--   • Per-minute rate limit (3 requests/min) — prevents rapid-fire spam
--     even within the 10/day daily cap.
--   • Blocking check — if the receiver has blocked the sender, the
--     function silently returns a fake UUID. The sender has no indication
--     they were blocked: their UI shows "request sent" but the receiver
--     never sees it. This prevents harassment enumeration via block detection.

CREATE OR REPLACE FUNCTION public.create_chat_request(p_request_token UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_receiver_id UUID;
  v_code_hash   TEXT;
  v_seq         INT;
  v_per_minute  INT;
  v_daily_count INT;
  v_request_id  UUID;
BEGIN
  -- Consume the lookup token atomically (used_at prevents replay)
  UPDATE contact_lookup_tokens
  SET used_at = NOW()
  WHERE id        = p_request_token
    AND used_at   IS NULL
    AND expires_at > NOW()
  RETURNING receiver_id, code_hash, rotation_sequence
  INTO v_receiver_id, v_code_hash, v_seq;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE = 'P0001';
  END IF;

  IF v_receiver_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE = 'P0001';
  END IF;

  -- Per-minute anti-spam: 3 requests per minute
  SELECT COUNT(*) INTO v_per_minute
  FROM chat_requests
  WHERE sender_id  = auth.uid()
    AND created_at > NOW() - INTERVAL '1 minute';

  IF v_per_minute >= 3 THEN
    RAISE EXCEPTION 'rate_limited' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM connections
    WHERE user_a_id = LEAST(auth.uid(), v_receiver_id)
      AND user_b_id = GREATEST(auth.uid(), v_receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_connected' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM chat_requests
    WHERE sender_id   = auth.uid()
      AND receiver_id = v_receiver_id
      AND status      = 'pending'
  ) THEN
    RAISE EXCEPTION 'request_already_pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_daily_count
  FROM chat_requests
  WHERE sender_id  = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_count >= 10 THEN
    RAISE EXCEPTION 'daily_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  -- Blocking check: receiver has blocked this sender.
  -- Return a fake UUID so the sender cannot distinguish "blocked" from "sent".
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE blocker_id = v_receiver_id
      AND blocked_id = auth.uid()
  ) THEN
    RETURN gen_random_uuid();
  END IF;

  INSERT INTO chat_requests (
    sender_id, receiver_id, code_hash_used, code_rotation_sequence
  ) VALUES (
    auth.uid(), v_receiver_id, v_code_hash, v_seq
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;


-- ── Permissions ───────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.block_user(UUID)   FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unblock_user(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.block_user(UUID)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(UUID) TO authenticated;

-- lookup_contact_code and create_chat_request keep their existing
-- authenticated grants (callers are still authenticated users).
-- The grants were set in 002_contact_discovery.sql and do not need
-- to be re-stated here.


-- ── Phase 6 Security Audit Notes ─────────────────────────────────
-- Findings reviewed and dispositions:
--
-- [FIXED]  Rate-limit bypass on lookup_contact_code
--          Previously: rate limit lived only in the contact-lookup Edge Function.
--          An authenticated caller could invoke lookup_contact_code RPC directly
--          and skip the check. Fixed: rate limit now embedded in the RPC itself.
--          Edge Function's explicit check/log calls are now redundant and removed.
--
-- [FIXED]  No per-minute limit on create_chat_request
--          Daily cap (10/day) existed but a burst of 10 requests in <1 minute
--          was possible. Fixed: 3/minute limit added inside the RPC.
--
-- [FIXED]  No blocking enforcement
--          Blocked senders could still deliver requests. Fixed: blocking check
--          added to create_chat_request; request silently dropped, fake ID returned.
--
-- [ACCEPTED] Timing oracle on code lookup
--            The "valid code" path performs one extra INSERT vs. the "invalid"
--            path. The timing delta (~1ms) is dwarfed by network jitter and is
--            protected by the 5/min rate limit. No fix warranted.
--
-- [OK]  IDOR on request IDs
--       accept_chat_request and reject_chat_request both verify receiver_id = auth.uid().
--       RLS cr_select_as_sender / cr_select_as_receiver prevents cross-read.
--       No IDOR surface found.
--
-- [OK]  RLS bypass
--       No INSERT/UPDATE/DELETE policies exist on any contact-discovery table.
--       All writes go through SECURITY DEFINER functions. Direct client writes
--       are deny-all by default. No bypass surface found.
--
-- [OK]  Token replay
--       contact_lookup_tokens.used_at is set atomically by the UPDATE ... RETURNING
--       in create_chat_request. A second call with the same token finds used_at IS NOT
--       NULL and returns invalid_or_expired_token. No replay surface found.
