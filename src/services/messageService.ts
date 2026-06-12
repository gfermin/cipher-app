import { getSupabaseClient } from '@/lib/supabase/client'
import type { MessageWithSender, Profile, Message } from '@/types/app'

// RPC return types omit generated columns (content_tsv); accept a compatible superset/subset
type MessageLike = Omit<Message, 'content_tsv'> & { content_tsv?: unknown }

async function enrichMessage(msg: MessageLike): Promise<MessageWithSender> {
  const sb = getSupabaseClient()
  const { data: sender } = await sb.from('profiles').select('*').eq('id', msg.sender_id).single()
  return { ...(msg as Message), sender: sender as Profile }
}

// Returns the newest 40 messages for the initial load, ordered oldest-first for display.
export async function getMessages(chatId: string): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages').select('*').eq('chat_id', chatId)
    .order('created_at', { ascending: false }).limit(40)
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).slice().reverse().map(enrichMessage))
}

// Cursor-based fetch for "load more" — returns up to 40 messages older than beforeTimestamp,
// ordered oldest-first for prepending to the top of the message list.
export async function getMessagesBefore(chatId: string, beforeTimestamp: string): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages').select('*').eq('chat_id', chatId)
    .lt('created_at', beforeTimestamp)
    .order('created_at', { ascending: false }).limit(40)
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).slice().reverse().map(enrichMessage))
}

// Reconnect catch-up — fetches messages newer than afterTimestamp so the subscription
// can merge any rows that arrived during a disconnection window without clobbering
// older messages the user had loaded via pagination.
export async function getMessagesAfter(chatId: string, afterTimestamp: string): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages').select('*').eq('chat_id', chatId)
    .gt('created_at', afterTimestamp)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map(enrichMessage))
}

export async function sendTextMessage(chatId: string, senderId: string, content: string): Promise<MessageWithSender> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages').insert({ chat_id: chatId, sender_id: senderId, type: 'text', content }).select().single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to send')
  return enrichMessage(data)
}

export async function sendImageMessage(chatId: string, senderId: string, imageUrl: string, imagePath: string): Promise<MessageWithSender> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages')
    .insert({ chat_id: chatId, sender_id: senderId, type: 'image', image_url: imageUrl, image_path: imagePath })
    .select().single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to send image')
  return enrichMessage(data)
}

export async function sendVideoMessage(chatId: string, senderId: string, videoUrl: string, videoPath: string): Promise<MessageWithSender> {
  const sb = getSupabaseClient()
  const { data, error } = await sb
    .from('messages')
    .insert({ chat_id: chatId, sender_id: senderId, type: 'video', image_url: videoUrl, image_path: videoPath })
    .select().single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to send video')
  return enrichMessage(data)
}

export async function deleteMessage(messageId: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb
    .from('messages').update({ type: 'deleted', content: null, image_url: null, is_deleted: true }).eq('id', messageId)
  if (error) throw new Error(error.message)
}

// Requires a vault session token issued by verifyUserVaultCode.
// The server validates the token before returning vaulted rows,
// so vault content never reaches the client without a successful unlock.
export async function getVaultedMessages(chatId: string, token: string): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('get_vault_messages', { p_chat_id: chatId, p_token: token })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map(enrichMessage))
}

// Returns the count of images newly vaulted (0 if none). Used by
// Phase 5 to conditionally show the "Images vaulted" toast.
export async function vaultChatImages(chatId: string): Promise<number> {
  const sb = getSupabaseClient()
  const { data } = await sb.rpc('vault_chat_images', { p_chat_id: chatId })
  return typeof data === 'number' ? data : 0
}

// Vaults all non-vaulted image and video messages for the given chat.
// Returns the total count of items vaulted.
export async function vaultChatMedia(chatId: string): Promise<number> {
  const sb = getSupabaseClient()
  const { data } = await sb.rpc('vault_chat_media', { p_chat_id: chatId })
  return typeof data === 'number' ? data : 0
}

// Searches non-vaulted text messages in a chat using ILIKE substring matching.
// Returns up to 50 results ordered newest-first. Query escaping is handled
// server-side in the RPC — caller does not need to sanitize p_query.
export async function searchMessages(chatId: string, query: string): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('search_chat_messages', {
    p_chat_id: chatId,
    p_query: query,
    p_limit: 50,
  })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map(enrichMessage))
}

// Fetches a window of messages centered on targetTimestamp for jump-to-message
// navigation. Returns up to 2 × windowSize rows ordered oldest-first, ready
// to replace chatStore.messages[chatId] as the new scroll anchor window.
export async function getMessagesAroundTimestamp(
  chatId: string,
  targetTimestamp: string,
  windowSize: number = 30
): Promise<MessageWithSender[]> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('get_messages_around_timestamp', {
    p_chat_id: chatId,
    p_timestamp: targetTimestamp,
    p_window: windowSize,
  })
  if (error) throw new Error(error.message)
  return Promise.all((data ?? []).map(enrichMessage))
}

export async function setTyping(chatId: string, userId: string): Promise<void> {
  const sb = getSupabaseClient()
  await sb.from('typing_indicators').upsert({ chat_id: chatId, user_id: userId, updated_at: new Date().toISOString() })
}

export async function clearTyping(chatId: string, userId: string): Promise<void> {
  const sb = getSupabaseClient()
  await sb.from('typing_indicators').delete().eq('chat_id', chatId).eq('user_id', userId)
}
