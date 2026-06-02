import { getSupabaseClient } from '@/lib/supabase/client'

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
