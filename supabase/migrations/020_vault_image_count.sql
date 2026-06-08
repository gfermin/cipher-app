-- L-1: Fix vault_chat_images to return the count of images vaulted.
-- The original RETURNS VOID meant the service layer always received null → 0,
-- so the "Images vaulted" toast in useAutoVault never fired.
CREATE OR REPLACE FUNCTION public.vault_chat_images(p_chat_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant of this chat';
  END IF;

  UPDATE public.messages
  SET is_vaulted = TRUE
  WHERE chat_id = p_chat_id
    AND type = 'image'
    AND is_vaulted = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
