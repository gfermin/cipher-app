-- Fix: get_vault_messages and delete_vault_image both filtered type = 'image',
-- excluding video rows from vault reads and deletion.
-- Extends both RPCs to cover type IN ('image', 'video').

-- ── get_vault_messages (replace) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_vault_messages(p_chat_id UUID, p_token UUID)
RETURNS SETOF public.messages LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.vault_session_tokens
    WHERE  token      = p_token
      AND  user_id    = auth.uid()
      AND  chat_id    = p_chat_id
      AND  expires_at > NOW()
  ) THEN
    RAISE EXCEPTION 'invalid_vault_token' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT * FROM public.messages
    WHERE  chat_id    = p_chat_id
      AND  is_vaulted = TRUE
      AND  type       IN ('image', 'video')
      AND  is_deleted = FALSE
    ORDER BY created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_vault_messages(UUID, UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_vault_messages(UUID, UUID) TO authenticated;


-- ── delete_vault_image (replace) ─────────────────────────────────
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
    AND  type       IN ('image', 'video');

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

REVOKE ALL ON FUNCTION public.delete_vault_image(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.delete_vault_image(UUID) TO authenticated;
