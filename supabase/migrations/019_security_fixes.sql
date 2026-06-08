-- H-1: Restrict message hard-delete to sender only
-- The old policy allowed any chat participant to hard-delete any message,
-- including messages sent by the other user.
DROP POLICY IF EXISTS "messages_delete_participant" ON public.messages;
CREATE POLICY "messages_delete_own" ON public.messages
  FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid() AND
    chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
  );

-- H-2: Prevent client from flipping is_vaulted FALSE
-- The messages_update_own policy allowed senders to unvault their own
-- messages via a direct UPDATE, bypassing vault protection.
CREATE OR REPLACE FUNCTION public.guard_is_vaulted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.is_vaulted = TRUE AND NEW.is_vaulted = FALSE THEN
    RAISE EXCEPTION 'cannot_unvault_directly' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_unvault ON public.messages;
CREATE TRIGGER prevent_unvault
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_is_vaulted();

-- M-2: Vault token revocation on vault close
-- lockVault() previously only cleared the token client-side; the server-side
-- row remained valid for up to 5 minutes after vault close.
CREATE OR REPLACE FUNCTION public.revoke_vault_token(p_chat_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.vault_session_tokens
  WHERE user_id = auth.uid() AND chat_id = p_chat_id;
END;
$$;
REVOKE ALL ON FUNCTION public.revoke_vault_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_vault_token(UUID) TO authenticated;
