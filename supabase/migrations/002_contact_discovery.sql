-- ================================================================
-- CIPHER — Contact Discovery System
-- Migration: 002_contact_discovery.sql
-- Depends on: 001_initial_schema.sql
--
-- Implements Phase 1 of the Private Contact Discovery System:
-- rotating ephemeral codes, request lifecycle, and connection registry.
-- ================================================================

-- ── Profile: per-user rotation offset ────────────────────────────
-- Random 0–23h stagger so rotations are distributed across the day
-- instead of thundering together at a fixed time.

ALTER TABLE public.profiles
  ADD COLUMN rotation_offset SMALLINT NOT NULL
    DEFAULT (floor(random() * 24))::SMALLINT;

-- ── Chats: connection linkage ─────────────────────────────────────
-- connection_id is populated when a chat is born from an accepted request.
-- FK to connections added after that table is created below.
-- is_request_pending is reserved for UI state (e.g., request preview before first message).

ALTER TABLE public.chats
  ADD COLUMN connection_id UUID,
  ADD COLUMN is_request_pending BOOLEAN NOT NULL DEFAULT FALSE;

-- ── contact_codes ─────────────────────────────────────────────────
-- One row per code per user. Plaintext is NEVER stored — only the
-- SHA-256 hex digest is persisted. Lookup: hash(submitted_code) → code_hash.

CREATE TABLE public.contact_codes (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash         TEXT        NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL,
  is_current        BOOLEAN     NOT NULL DEFAULT TRUE,
  rotation_sequence INT         NOT NULL DEFAULT 1
);

-- ── contact_lookup_tokens ─────────────────────────────────────────
-- Short-lived (5-min) opaque UUIDs issued after a successful code lookup.
-- Decouples receiver identity from the request-submission step — the
-- frontend never learns who owns a code, only whether the code was valid.

CREATE TABLE public.contact_lookup_tokens (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receiver_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code_hash         TEXT        NOT NULL,
  rotation_sequence INT         NOT NULL,
  used_at           TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '5 minutes'
);

-- ── chat_request_status ───────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.chat_request_status AS ENUM (
    'pending', 'accepted', 'rejected', 'expired', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── chat_requests ─────────────────────────────────────────────────
-- Full lifecycle ledger. Rows are append-only (status transitions only).
-- sender/receiver use SET NULL on account deletion to preserve the audit row.
-- conversation_id FK references chats (already exists from 001).

CREATE TABLE public.chat_requests (
  id                     UUID                       NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id              UUID                       REFERENCES public.profiles(id) ON DELETE SET NULL,
  receiver_id            UUID                       REFERENCES public.profiles(id) ON DELETE SET NULL,
  code_hash_used         TEXT                       NOT NULL,
  code_rotation_sequence INT                        NOT NULL,
  status                 public.chat_request_status NOT NULL DEFAULT 'pending',
  created_at             TIMESTAMPTZ                NOT NULL DEFAULT NOW(),
  expires_at             TIMESTAMPTZ                NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  responded_at           TIMESTAMPTZ,
  conversation_id        UUID                       REFERENCES public.chats(id) ON DELETE SET NULL
);

-- ── connections ───────────────────────────────────────────────────
-- Permanent, immutable record of an established relationship.
-- user_a_id is always the lexicographically lower UUID (canonical ordering)
-- so (A,B) and (B,A) are the same pair — enforced via unique index below.
-- initiated_via_request_id FK added after chat_requests exists.

CREATE TABLE public.connections (
  id                       UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a_id                UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b_id                UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  connected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  initiated_via_request_id UUID,
  CONSTRAINT connections_different_users CHECK (user_a_id <> user_b_id),
  CONSTRAINT connections_canonical_order CHECK (user_a_id < user_b_id)
);

-- ── Deferred FK constraints (resolve creation-order dependency) ───

ALTER TABLE public.connections
  ADD CONSTRAINT connections_request_fkey
  FOREIGN KEY (initiated_via_request_id)
  REFERENCES public.chat_requests(id) ON DELETE SET NULL;

ALTER TABLE public.chats
  ADD CONSTRAINT chats_connection_id_fkey
  FOREIGN KEY (connection_id)
  REFERENCES public.connections(id) ON DELETE SET NULL;

-- ── Indexes ───────────────────────────────────────────────────────

-- contact_codes
CREATE UNIQUE INDEX idx_cc_hash
  ON public.contact_codes(code_hash);

-- Only one current code per user at a time
CREATE UNIQUE INDEX idx_cc_current_per_user
  ON public.contact_codes(user_id) WHERE is_current = TRUE;

CREATE INDEX idx_cc_expires
  ON public.contact_codes(expires_at);

-- contact_lookup_tokens
CREATE INDEX idx_clt_expires
  ON public.contact_lookup_tokens(expires_at);

-- chat_requests: hot path for the receiver's inbox
CREATE INDEX idx_cr_inbox
  ON public.chat_requests(receiver_id, status, created_at DESC);

-- Prevents duplicate pending requests between the same pair
CREATE UNIQUE INDEX idx_cr_pending_pair
  ON public.chat_requests(sender_id, receiver_id) WHERE status = 'pending';

-- Sender's sent-request history + daily-limit check
CREATE INDEX idx_cr_sender
  ON public.chat_requests(sender_id, created_at DESC);

-- Expiration cleanup job scan
CREATE INDEX idx_cr_expires_pending
  ON public.chat_requests(expires_at) WHERE status = 'pending';

-- connections: pair deduplication (canonical order enforced by CHECK above)
CREATE UNIQUE INDEX idx_conn_pair
  ON public.connections(user_a_id, user_b_id);

CREATE INDEX idx_conn_user_a ON public.connections(user_a_id);
CREATE INDEX idx_conn_user_b ON public.connections(user_b_id);

-- ── Row Level Security ────────────────────────────────────────────

ALTER TABLE public.contact_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_lookup_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections          ENABLE ROW LEVEL SECURITY;

-- contact_codes: users see only their own row
-- Writes are exclusively via SECURITY DEFINER functions (no insert/update/delete policy)
CREATE POLICY "cc_select_own" ON public.contact_codes
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- contact_lookup_tokens: zero direct client access
-- (no policies = deny-all for direct queries; SECURITY DEFINER functions bypass RLS)

-- chat_requests: sender sees their sent requests; receiver sees their received requests
CREATE POLICY "cr_select_as_sender" ON public.chat_requests
  FOR SELECT TO authenticated USING (sender_id = auth.uid());

CREATE POLICY "cr_select_as_receiver" ON public.chat_requests
  FOR SELECT TO authenticated USING (receiver_id = auth.uid());

-- connections: both parties can read their shared record
-- No direct writes — only accept_chat_request RPC can insert
CREATE POLICY "conn_select_participant" ON public.connections
  FOR SELECT TO authenticated
  USING (user_a_id = auth.uid() OR user_b_id = auth.uid());

-- ── Internal Code Generator ───────────────────────────────────────
-- Format: CXXX-XXXX-XXXX-XXX  (C + 14 random chars from 31-char alphabet)
-- Alphabet excludes visually ambiguous chars: O, 0, I, 1, L
-- 31^14 ≈ 7.2 quadrillion combinations — brute force infeasible.
-- Called only by mint_contact_code; not exposed to any role directly.

CREATE OR REPLACE FUNCTION public._cipher_gen_code()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_alpha TEXT  := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  v_bytes BYTEA;
  v_chars TEXT  := '';
  i       INT;
BEGIN
  v_bytes := gen_random_bytes(14);
  FOR i IN 0..13 LOOP
    v_chars := v_chars || substr(v_alpha, (get_byte(v_bytes, i) % 31) + 1, 1);
  END LOOP;
  RETURN 'C' || substr(v_chars,  1, 3)
      || '-' || substr(v_chars,  4, 4)
      || '-' || substr(v_chars,  8, 4)
      || '-' || substr(v_chars, 12, 3);
END;
$$;

-- ── mint_contact_code ─────────────────────────────────────────────
-- Generates a fresh code for a user. Returns the plaintext (the only
-- moment it exists unmasked). Stores only the SHA-256 hash.
-- Called by the signup trigger (wired in Phase 2) and the rotation job.

CREATE OR REPLACE FUNCTION public.mint_contact_code(p_user_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code     TEXT;
  v_hash     TEXT;
  v_next_seq INT;
BEGIN
  SELECT COALESCE(MAX(rotation_sequence) + 1, 1)
  INTO v_next_seq
  FROM public.contact_codes
  WHERE user_id = p_user_id;

  -- Collision guard: loop exits on first unique hash (expected: 1 iteration)
  LOOP
    v_code := public._cipher_gen_code();
    v_hash := encode(digest(v_code, 'sha256'), 'hex');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.contact_codes WHERE code_hash = v_hash);
  END LOOP;

  UPDATE public.contact_codes
  SET is_current = FALSE
  WHERE user_id = p_user_id AND is_current = TRUE;

  INSERT INTO public.contact_codes (user_id, code_hash, expires_at, is_current, rotation_sequence)
  VALUES (p_user_id, v_hash, NOW() + INTERVAL '24 hours', TRUE, v_next_seq);

  RETURN v_code;
END;
$$;

-- ── lookup_contact_code ───────────────────────────────────────────
-- Validates a code and returns an opaque lookup token UUID.
-- Identical error for invalid, expired, and non-existent codes —
-- no oracle that confirms whether a user exists.
-- 15-minute grace window survives the rotation boundary.

CREATE OR REPLACE FUNCTION public.lookup_contact_code(p_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash        TEXT;
  v_receiver_id UUID;
  v_seq         INT;
  v_token_id    UUID;
BEGIN
  v_hash := encode(digest(p_code, 'sha256'), 'hex');

  SELECT cc.user_id, cc.rotation_sequence
  INTO v_receiver_id, v_seq
  FROM public.contact_codes cc
  WHERE cc.code_hash = v_hash
    AND cc.expires_at + INTERVAL '15 minutes' > NOW()
  LIMIT 1;

  -- Same error regardless of whether the code never existed, expired, or is self-lookup
  IF v_receiver_id IS NULL OR v_receiver_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid_code' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.contact_lookup_tokens (receiver_id, code_hash, rotation_sequence)
  VALUES (v_receiver_id, v_hash, v_seq)
  RETURNING id INTO v_token_id;

  RETURN v_token_id;
END;
$$;

-- ── create_chat_request ───────────────────────────────────────────
-- Converts a lookup token into a pending chat request.
-- Guards: token single-use, no self-request, no duplicate pending,
-- no existing connection, max 10 outgoing requests per 24 hours.

CREATE OR REPLACE FUNCTION public.create_chat_request(p_request_token UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_receiver_id UUID;
  v_code_hash   TEXT;
  v_seq         INT;
  v_daily_count INT;
  v_request_id  UUID;
BEGIN
  -- Consume the token atomically (used_at set here prevents replay)
  UPDATE public.contact_lookup_tokens
  SET used_at = NOW()
  WHERE id = p_request_token
    AND used_at IS NULL
    AND expires_at > NOW()
  RETURNING receiver_id, code_hash, rotation_sequence
  INTO v_receiver_id, v_code_hash, v_seq;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE = 'P0001';
  END IF;

  IF v_receiver_id = auth.uid() THEN
    RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.connections
    WHERE user_a_id = LEAST(auth.uid(), v_receiver_id)
      AND user_b_id = GREATEST(auth.uid(), v_receiver_id)
  ) THEN
    RAISE EXCEPTION 'already_connected' USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.chat_requests
    WHERE sender_id = auth.uid()
      AND receiver_id = v_receiver_id
      AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'request_already_pending' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*) INTO v_daily_count
  FROM public.chat_requests
  WHERE sender_id = auth.uid()
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_count >= 10 THEN
    RAISE EXCEPTION 'daily_limit_reached' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.chat_requests (
    sender_id, receiver_id, code_hash_used, code_rotation_sequence
  ) VALUES (
    auth.uid(), v_receiver_id, v_code_hash, v_seq
  )
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- ── accept_chat_request ───────────────────────────────────────────
-- Atomically creates: connection + chat + two participant rows.
-- Idempotent: if connection already exists (concurrent accept race),
-- returns the existing chat ID without duplicating records.
-- Returns the new conversation (chat) UUID for immediate navigation.

CREATE OR REPLACE FUNCTION public.accept_chat_request(p_request_id UUID)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_id     UUID;
  v_user_a        UUID;
  v_user_b        UUID;
  v_connection_id UUID;
  v_chat_id       UUID;
BEGIN
  SELECT sender_id INTO v_sender_id
  FROM public.chat_requests
  WHERE id = p_request_id
    AND receiver_id = auth.uid()
    AND status = 'pending'
    AND expires_at > NOW();

  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = 'P0001';
  END IF;

  v_user_a := LEAST(auth.uid(), v_sender_id);
  v_user_b := GREATEST(auth.uid(), v_sender_id);

  -- Idempotency: concurrent accepts for the same pair land here
  SELECT id INTO v_connection_id
  FROM public.connections
  WHERE user_a_id = v_user_a AND user_b_id = v_user_b;

  IF v_connection_id IS NULL THEN
    INSERT INTO public.connections (user_a_id, user_b_id, initiated_via_request_id)
    VALUES (v_user_a, v_user_b, p_request_id)
    RETURNING id INTO v_connection_id;

    INSERT INTO public.chats (connection_id, is_request_pending)
    VALUES (v_connection_id, FALSE)
    RETURNING id INTO v_chat_id;

    INSERT INTO public.chat_participants (chat_id, user_id)
    VALUES (v_chat_id, v_user_a), (v_chat_id, v_user_b);
  ELSE
    SELECT id INTO v_chat_id
    FROM public.chats
    WHERE connection_id = v_connection_id
    LIMIT 1;
  END IF;

  UPDATE public.chat_requests
  SET status        = 'accepted',
      responded_at  = NOW(),
      conversation_id = v_chat_id
  WHERE id = p_request_id;

  RETURN v_chat_id;
END;
$$;

-- ── reject_chat_request ───────────────────────────────────────────
-- Marks a request rejected. No Realtime event emitted — by design.
-- The sender has no indication of rejection vs. still-pending
-- (prevents rejection-detection harassment).

CREATE OR REPLACE FUNCTION public.reject_chat_request(p_request_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.chat_requests
  SET status       = 'rejected',
      responded_at = NOW()
  WHERE id          = p_request_id
    AND receiver_id = auth.uid()
    AND status      = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_request' USING ERRCODE = 'P0001';
  END IF;
END;
$$;

-- ── Maintenance Functions ─────────────────────────────────────────
-- Called by Supabase Edge Functions or pg_cron (wired in Phase 2/3).

-- Prune codes older than 48h (well past the 15-min grace window)
CREATE OR REPLACE FUNCTION public.cleanup_expired_contact_codes()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_deleted INT; BEGIN
  DELETE FROM public.contact_codes WHERE expires_at < NOW() - INTERVAL '48 hours';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Expire pending requests that crossed their 7-day window
CREATE OR REPLACE FUNCTION public.expire_stale_chat_requests()
RETURNS INT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_updated INT; BEGIN
  UPDATE public.chat_requests SET status = 'expired'
  WHERE status = 'pending' AND expires_at < NOW();
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- ── Permissions ───────────────────────────────────────────────────

-- Internal helpers: no direct client access
REVOKE ALL ON FUNCTION public._cipher_gen_code()              FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mint_contact_code(UUID)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_contact_codes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_stale_chat_requests()    FROM PUBLIC;

-- Maintenance and code-minting callable by service_role (rotation job, Edge Functions)
GRANT EXECUTE ON FUNCTION public.mint_contact_code(UUID)         TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_contact_codes() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_stale_chat_requests()    TO service_role;

-- Public RPCs callable by authenticated users
GRANT EXECUTE ON FUNCTION public.lookup_contact_code(TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_chat_request(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_chat_request(UUID)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_chat_request(UUID)  TO authenticated;

-- ── Phase 1 Security Review Checklist ────────────────────────────
-- Before Phase 2, verify all of the following hold:
--
-- 1. RLS isolation
--    - User A cannot SELECT contact_codes rows owned by User B
--    - User A cannot SELECT chat_requests where they are neither sender nor receiver
--    - User A cannot SELECT connections where they are neither user_a nor user_b
--    - No direct INSERT/UPDATE/DELETE succeeds on any new table from an authenticated client
--
-- 2. RPC logic
--    - lookup_contact_code returns identical error for: non-existent code, expired code,
--      own code, code with no hash match
--    - create_chat_request token is single-use (second call with same token → error)
--    - accept_chat_request is idempotent (double-accept → same chat_id, no duplicate rows)
--    - reject_chat_request sends no notification (verify Realtime is silent)
--
-- 3. Canonical ordering
--    - Every accept_chat_request produces user_a_id < user_b_id in connections
--    - The CHECK constraint connections_canonical_order fires on violation
--
-- 4. Constraint coverage
--    - idx_cr_pending_pair prevents two pending requests between the same pair
--    - idx_cc_current_per_user prevents two is_current=TRUE codes per user
