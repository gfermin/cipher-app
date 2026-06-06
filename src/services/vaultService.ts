import { getSupabaseClient } from '@/lib/supabase/client'
import { deleteFile } from '@/services/storageService'

// ── Legacy (chat_vaults) — kept for backwards compatibility ──────

export async function setVaultPassword(chatId: string, password: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.rpc('set_vault_password', { p_chat_id: chatId, p_password: password })
  if (error) throw new Error(error.message)
}

export async function verifyVaultPassword(chatId: string, password: string): Promise<boolean> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('verify_vault_password', { p_chat_id: chatId, p_password: password })
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
  const { error } = await sb.rpc('set_user_vault_code', { p_chat_id: chatId, p_code: code })
  if (error) throw new Error(error.message)
}

// Returns a vault session token string (correct), false (incorrect),
// null (no code set), or 'rate_limited' when the server rate-limits.
export async function verifyUserVaultCode(chatId: string, code: string): Promise<string | false | null | 'rate_limited'> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('verify_user_vault_code', { p_chat_id: chatId, p_code: code })
  if (error) {
    if (error.message?.includes('vault_rate_limited')) return 'rate_limited'
    return false
  }
  if (data === null || data === undefined) return null
  if (data === '') return false
  return data
}

export async function hasUserVaultCode(chatId: string): Promise<boolean> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('has_user_vault_code', { p_chat_id: chatId })
  if (error) return false
  return data === true
}

// Hard-deletes a vaulted image message. Returns the image_path on
// success (or null if the row was already gone). Callers should
// swallow a null return without showing an error.
export async function deleteVaultImage(messageId: string): Promise<string | null> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('delete_vault_image', { p_message_id: messageId })
  if (error) return null
  const imagePath = data as string | null
  if (imagePath) {
    await deleteFile('', imagePath).catch(() => {})
  }
  return imagePath
}
