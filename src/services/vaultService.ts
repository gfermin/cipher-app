import { getSupabaseClient } from '@/lib/supabase/client'
import { deleteFile } from '@/services/storageService'

// ── Legacy (chat_vaults) — kept for backwards compatibility ──────

export async function setVaultPassword(chatId: string, password: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.rpc('set_vault_password' as never, { p_chat_id: chatId, p_password: password } as never)
  if (error) throw new Error((error as { message: string }).message)
}

export async function verifyVaultPassword(chatId: string, password: string): Promise<boolean> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('verify_vault_password' as never, { p_chat_id: chatId, p_password: password } as never)
  if (error) return false
  return data === true
}

export async function hasVault(chatId: string): Promise<boolean> {
  const sb = getSupabaseClient()
  const { data } = await sb.from('chat_vaults').select('id').eq('chat_id', chatId).maybeSingle()
  return !!data
}

// ── Per-user vault codes (user_vault_codes) ──────────────────────

export async function setUserVaultCode(chatId: string, code: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.rpc('set_user_vault_code' as never, { p_chat_id: chatId, p_code: code } as never)
  if (error) throw new Error((error as { message: string }).message)
}

// Returns true (correct), false (incorrect), null (no code set),
// or 'rate_limited' when the server rejects due to too many attempts.
export async function verifyUserVaultCode(chatId: string, code: string): Promise<boolean | null | 'rate_limited'> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('verify_user_vault_code' as never, { p_chat_id: chatId, p_code: code } as never)
  if (error) {
    if ((error as { message?: string }).message?.includes('vault_rate_limited')) return 'rate_limited'
    return false
  }
  if (data === null || data === undefined) return null
  return data === true
}

export async function hasUserVaultCode(chatId: string): Promise<boolean> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('has_user_vault_code' as never, { p_chat_id: chatId } as never)
  if (error) return false
  return data === true
}

// Hard-deletes a vaulted image message. Returns the image_path on
// success (or null if the row was already gone). Callers should
// swallow a null return without showing an error.
export async function deleteVaultImage(messageId: string): Promise<string | null> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('delete_vault_image' as never, { p_message_id: messageId } as never)
  if (error) return null
  const imagePath = data as string | null
  if (imagePath) {
    await deleteFile('', imagePath).catch(() => {})
  }
  return imagePath
}
