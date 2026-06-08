-- ================================================================
-- CIPHER — Phase 4: Vault Image Deletion
-- Migration: 007_vault_image_deletion.sql
-- Depends on: 006_vault_per_user_codes.sql, 006_enable_realtime.sql
--
-- Changes:
-- 1. delete_vault_image RPC — hard-deletes a vaulted image message,
--    validates the caller is a participant, and returns the
--    image_path for client-side storage cleanup. Returns NULL
--    if the row is already gone (race condition safe).
-- ================================================================


-- ── delete_vault_image ────────────────────────────────────────────
-- Hard-deletes a vaulted image message row and returns its
-- image_path so the client can clean up the storage file.
--
-- Authorization: caller must be a participant of the message's chat.
-- Race safety: if the row is already deleted, returns NULL silently.
-- Any participant may delete any vaulted image (matches the existing
-- messages_delete_participant RLS model for regular messages).

CREATE OR REPLACE FUNCTION public.delete_vault_image(p_message_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  v_chat_id   UUID;
  v_img_path  TEXT;
BEGIN
  SELECT chat_id, image_path
  INTO   v_chat_id, v_img_path
  FROM   public.messages
  WHERE  id         = p_message_id
    AND  is_vaulted = TRUE
    AND  type       = 'image';

  -- Row already gone — return NULL, client swallows gracefully.
  IF v_chat_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = v_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'not_a_participant' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.messages WHERE id = p_message_id;

  RETURN v_img_path;
END;
$$;


-- ── Permissions ───────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.delete_vault_image(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_vault_image(UUID) TO authenticated;
