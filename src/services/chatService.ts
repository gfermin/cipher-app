import { getSupabaseClient } from '@/lib/supabase/client'
import type { ChatWithParticipants, Profile, Message } from '@/types/app'

export async function getChats(userId: string): Promise<ChatWithParticipants[]> {
  const sb = getSupabaseClient()

  const { data: participations } = await sb
    .from('chat_participants').select('chat_id').eq('user_id', userId)
  if (!participations?.length) return []

  const chatIds = participations.map((p) => p.chat_id)

  const { data: chats } = await sb.from('chats').select('*').in('id', chatIds)
  if (!chats?.length) return []

  const results: ChatWithParticipants[] = []

  for (const rawChat of chats) {
    const { data: parts } = await sb
      .from('chat_participants').select('user_id').eq('chat_id', rawChat.id)

    const userIds = (parts ?? []).map((p) => p.user_id)

    const { data: profiles } = await sb.from('profiles').select('*').in('id', userIds)
    const profileList = (profiles ?? []) as Profile[]
    const otherUser = profileList.find((pr) => pr.id !== userId)
    if (!otherUser) continue

    const { data: lastMsgArr } = await sb
      .from('messages').select('*').eq('chat_id', rawChat.id)
      .order('created_at', { ascending: false }).limit(1)
    const lastMessage = (lastMsgArr ?? [])[0] as Message | undefined ?? null

    const { count: unreadCount } = await sb
      .from('messages').select('id', { count: 'exact', head: true })
      .eq('chat_id', rawChat.id).neq('sender_id', userId)
      .not('read_by', 'cs', `{"${userId}"}`)

    const { data: myPrefs } = await sb
      .from('chat_user_preferences').select('*')
      .eq('chat_id', rawChat.id).eq('user_id', userId).maybeSingle()

    const { data: vault } = await sb
      .from('chat_vaults').select('id').eq('chat_id', rawChat.id).maybeSingle()

    results.push({
      ...rawChat,
      participants: profileList,
      lastMessage,
      unreadCount: unreadCount ?? 0,
      otherUser,
      myPreferences: myPrefs ?? null,
      hasVault: !!vault,
    })
  }

  return results.sort((a, b) => {
    const aTime = a.lastMessage?.created_at ?? a.created_at
    const bTime = b.lastMessage?.created_at ?? b.created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })
}

export async function createChat(_currentUserId: string, otherUserId: string): Promise<string> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('create_direct_chat', { p_other_user_id: otherUserId })
  if (error) throw new Error(error.message)
  return data as string
}

export async function deleteChat(chatId: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.from('chats').delete().eq('id', chatId)
  if (error) throw new Error(error.message)
}

export async function updateChatTheme(chatId: string, theme: string | null): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb
    .from('chats').update({ custom_theme: theme, updated_at: new Date().toISOString() }).eq('id', chatId)
  if (error) throw new Error(error.message)
}

export async function searchUsers(query: string, currentUserId: string): Promise<Profile[]> {
  const sb = getSupabaseClient()
  const { data } = await sb
    .from('profiles').select('*').ilike('username', `%${query}%`)
    .neq('id', currentUserId).limit(10)
  return (data ?? []) as Profile[]
}

export async function markMessagesRead(chatId: string, _userId: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.rpc('mark_messages_read', { p_chat_id: chatId })
  if (error) throw new Error(error.message)
}

export async function setChatBackground(chatId: string, url: string | null): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb
    .from('chats')
    .update({ background_url: url, updated_at: new Date().toISOString() })
    .eq('id', chatId)
  if (error) throw new Error(error.message)
}

export async function setGlobalBackground(url: string | null): Promise<void> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await sb
    .from('profiles')
    .update({ global_background_url: url, updated_at: new Date().toISOString() })
    .eq('id', user.id)
  if (error) throw new Error(error.message)
}
