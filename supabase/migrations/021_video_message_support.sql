-- Phase 3: Add video message type + extend vault RPC to cover video.
--
-- 1. Extend messages.type check constraint to include 'video'.
-- 2. Create vault_chat_media() — vaults both 'image' and 'video' rows.
-- 3. Redefine vault_chat_images() as a deprecated alias for vault_chat_media()
--    so existing call sites continue to work during Phase 8 migration.

-- Step 1: Replace the type check constraint
ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_type_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_type_check
  CHECK (type IN ('text', 'image', 'video', 'deleted'));

-- Step 2: Create vault_chat_media — covers image + video types
CREATE OR REPLACE FUNCTION public.vault_chat_media(p_chat_id UUID)
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
    AND type IN ('image', 'video')
    AND is_vaulted = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Step 3: vault_chat_images becomes a thin alias — call sites migrated in Phase 8
CREATE OR REPLACE FUNCTION public.vault_chat_images(p_chat_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN public.vault_chat_media(p_chat_id);
END;
$$;
