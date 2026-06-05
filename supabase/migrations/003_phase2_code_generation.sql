-- ================================================================
-- CIPHER — Phase 2: Contact Code Generation Engine
-- Migration: 003_phase2_code_generation.sql
-- Depends on: 002_contact_discovery.sql
--
-- Adds encrypted code storage so users can reveal their code in
-- Settings. The plaintext is NEVER stored in the DB — only an
-- AES-256-GCM blob encrypted by the generate/rotate Edge Functions
-- using the CIPHER_CODE_SECRET env secret (never in Postgres).
-- ================================================================

-- ── Encrypted code column ─────────────────────────────────────────
-- Populated by generate-contact-code and rotate-contact-codes Edge
-- Functions after each mint. NULL until the Edge Function runs.

ALTER TABLE public.contact_codes
  ADD COLUMN code_encrypted TEXT;

-- ── store_code_encrypted ──────────────────────────────────────────
-- Called by Edge Functions (service_role) after each mint to persist
-- the encrypted blob alongside the hash.

CREATE OR REPLACE FUNCTION public.store_code_encrypted(
  p_user_id  UUID,
  p_encrypted TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.contact_codes
  SET    code_encrypted = p_encrypted
  WHERE  user_id   = p_user_id
    AND  is_current = TRUE;
END;
$$;

-- ── get_my_code_encrypted ─────────────────────────────────────────
-- Returns the encrypted blob for the calling user's current code.
-- Used exclusively by the reveal-contact-code Edge Function, which
-- decrypts it server-side — the plaintext never crosses the wire
-- without a fresh re-authentication step.

CREATE OR REPLACE FUNCTION public.get_my_code_encrypted()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_encrypted TEXT;
BEGIN
  SELECT code_encrypted INTO v_encrypted
  FROM   public.contact_codes
  WHERE  user_id    = auth.uid()
    AND  is_current = TRUE;
  RETURN v_encrypted;
END;
$$;

-- ── get_my_code_metadata ──────────────────────────────────────────
-- Returns UI-safe metadata about the current user's contact code.
-- Never exposes the hash or encrypted blob to the client.
-- Returns a single row; has_code = FALSE when no code exists yet.

CREATE OR REPLACE FUNCTION public.get_my_code_metadata()
RETURNS TABLE(
  has_code          BOOLEAN,
  expires_at        TIMESTAMPTZ,
  rotation_sequence INT,
  is_encrypted      BOOLEAN
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    TRUE,
    cc.expires_at,
    cc.rotation_sequence,
    cc.code_encrypted IS NOT NULL
  FROM public.contact_codes cc
  WHERE cc.user_id = auth.uid()
    AND cc.is_current = TRUE
  UNION ALL
  SELECT FALSE, NULL::TIMESTAMPTZ, NULL::INT, FALSE
  WHERE NOT EXISTS (
    SELECT 1 FROM public.contact_codes
    WHERE  user_id = auth.uid() AND is_current = TRUE
  );
$$;

-- ── get_users_needing_rotation ────────────────────────────────────
-- Returns user IDs whose current code has expired.
-- Used by the rotate-contact-codes Edge Function (service_role).

CREATE OR REPLACE FUNCTION public.get_users_needing_rotation()
RETURNS TABLE(user_id UUID) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT user_id
  FROM   public.contact_codes
  WHERE  is_current  = TRUE
    AND  expires_at  < NOW();
$$;

-- ── Permissions ───────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.store_code_encrypted(UUID, TEXT)  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_users_needing_rotation()       FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.store_code_encrypted(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_users_needing_rotation()      TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_code_encrypted()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_code_metadata()            TO authenticated;

-- ── Setup note ────────────────────────────────────────────────────
-- Before deploying Edge Functions, set the encryption secret:
--
--   supabase secrets set CIPHER_CODE_SECRET=$(openssl rand -hex 32)
--
-- This secret must be 32+ characters. It is the only key that can
-- decrypt contact codes — losing it means all codes must be
-- regenerated. Store it in your password manager.
