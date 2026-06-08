-- ================================================================
-- CIPHER — Phase 5: Account Deletion
-- Migration: 012_account_deletion.sql
--
-- Adds delete_my_account() SECURITY DEFINER RPC that:
--   1. Collects Cloudinary public_ids for server-side cleanup
--   2. Soft-deletes the caller's messages (preserves chat structure
--      for the other participant while removing private content)
--   3. Hard-deletes all personal data rows
--   4. Deletes the caller's profile row
--
-- The API route /api/account/delete handles:
--   - Calling this RPC
--   - Deleting Cloudinary assets (signed server-side request)
--   - Deleting the auth.users row via service_role
-- ================================================================

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   UUID    := auth.uid();
  v_img_paths TEXT[]  := ARRAY[]::TEXT[];
  v_av_paths  TEXT[]  := ARRAY[]::TEXT[];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- ── 1. Collect Cloudinary paths before any deletion ──────────────
  SELECT ARRAY_AGG(image_path) INTO v_img_paths
  FROM   public.messages
  WHERE  sender_id = v_user_id
    AND  image_path IS NOT NULL;

  SELECT ARRAY_AGG(private_avatar_path) INTO v_av_paths
  FROM   public.chat_user_preferences
  WHERE  user_id = v_user_id
    AND  private_avatar_path IS NOT NULL;

  -- ── 2. Remove ephemeral / session data ───────────────────────────
  DELETE FROM public.typing_indicators     WHERE user_id = v_user_id;
  DELETE FROM public.vault_session_tokens  WHERE user_id = v_user_id;
  DELETE FROM public.vault_verify_attempts WHERE user_id = v_user_id;
  DELETE FROM public.user_vault_codes      WHERE user_id = v_user_id;
  DELETE FROM public.lookup_rate_log       WHERE user_id = v_user_id;
  DELETE FROM public.contact_lookup_tokens WHERE receiver_id = v_user_id;

  -- ── 3. Remove social graph data ──────────────────────────────────
  DELETE FROM public.blocks
  WHERE  blocker_id = v_user_id OR blocked_id = v_user_id;

  DELETE FROM public.contact_codes WHERE user_id = v_user_id;

  -- Null out sender/receiver on chat_requests (FK is SET NULL on profile delete,
  -- but we do it explicitly here before removing the profile row).
  UPDATE public.chat_requests SET sender_id   = NULL WHERE sender_id   = v_user_id;
  UPDATE public.chat_requests SET receiver_id = NULL WHERE receiver_id = v_user_id;

  -- ── 4. Remove chat membership and preferences ────────────────────
  DELETE FROM public.chat_user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.chat_participants     WHERE user_id = v_user_id;

  -- Remove connections on both sides
  DELETE FROM public.connections
  WHERE  user_a_id = v_user_id OR user_b_id = v_user_id;

  -- ── 5. Soft-delete messages (keeps chat structure for other participant) ──
  UPDATE public.messages
  SET    type      = 'deleted',
         content   = NULL,
         image_url = NULL,
         image_path = NULL,
         is_deleted = TRUE
  WHERE  sender_id = v_user_id
    AND  type      <> 'deleted';

  -- ── 6. Delete profile (auth.users deletion done by API route) ────
  DELETE FROM public.profiles WHERE id = v_user_id;

  -- ── 7. Return Cloudinary paths for server-side cleanup ───────────
  RETURN jsonb_build_object(
    'image_paths',  COALESCE(v_img_paths, ARRAY[]::TEXT[]),
    'avatar_paths', COALESCE(v_av_paths,  ARRAY[]::TEXT[])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
