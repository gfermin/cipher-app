import { getSupabaseClient } from '@/lib/supabase/client'
import type { MessageWithSender, Profile } from '@/types/app'

interface RawMsg {
  id: string; chat_id: string; sender_id: string
  type: 'text' | 'image' | 'deleted'; content: string | null
  image_url: string | null; image_path: string | null
  is_vaulted: boolean; is_deleted: boolean; read_by: string[]; created_at: string
}

async function enrichMessage(msg: RawMsg): Promise<MessageWithSender> {
  const sb = getSupabaseClient()
  const { data: sender } = await sb.from('profiles').select('*').eq('id', msg.sender_id).single()
  return { ...msg, sender: sender as Profile }
}

export async function getMessages(chatId: string, page = 0): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const from = page * 40
  const { data, error } = await sb
    .from('messages').select('*').eq('chat_id', chatId)
    .order('created_at', { ascending: true }).range(from, from + 39)
  if (error) throw new Error(error.message)
  return Promise.all(((data ?? []) as RawMsg[]).map(enrichMessage))
}

export async function sendTextMessage(chatId: string, senderId: string, content: string): Promise<MessageWithSender> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages').insert({ chat_id: chatId, sender_id: senderId, type: 'text', content }).select().single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to send')
  return enrichMessage(data as RawMsg)
}

export async function sendImageMessage(chatId: string, senderId: string, imageUrl: string, imagePath: string): Promise<MessageWithSender> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages')
    .insert({ chat_id: chatId, sender_id: senderId, type: 'image', image_url: imageUrl, image_path: imagePath })
    .select().single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to send image')
  return enrichMessage(data as RawMsg)
}

export async function deleteMessage(messageId: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb
    .from('messages').update({ type: 'deleted', content: null, image_url: null, is_deleted: true }).eq('id', messageId)
  if (error) throw new Error(error.message)
}

export async function getVaultedMessages(chatId: string): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages').select('*').eq('chat_id', chatId)
    .eq('type', 'image').eq('is_vaulted', true).order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return Promise.all(((data ?? []) as RawMsg[]).map(enrichMessage))
}

// Returns the count of images newly vaulted (0 if none). Used by
// Phase 5 to conditionally show the "Images vaulted" toast.
export async function vaultChatImages(chatId: string): Promise<number> {
  const sb = getSupabaseClient()
  const { data } = await sb.rpc('vault_chat_images' as never, { p_chat_id: chatId } as never)
  return typeof data === 'number' ? data : 0
}

export async function setTyping(chatId: string, userId: string): Promise<void> {
  const sb = getSupabaseClient()
  await sb.from('typing_indicators').upsert({ chat_id: chatId, user_id: userId, updated_at: new Date().toISOString() })
}

export async function clearTyping(chatId: string, userId: string): Promise<void> {
  const sb = getSupabaseClient()
  await sb.from('typing_indicators').delete().eq('chat_id', chatId).eq('user_id', userId)
}
