import { getSupabaseClient } from '@/lib/supabase/client'
import type { ChatWithParticipants, Profile, Message } from '@/types/app'

async function hydrateChatIds(userId: string, chatIds: string[]): Promise<ChatWithParticipants[]> {
  if (!chatIds.length) return []
  const sb = getSupabaseClient()

  // 5 parallel queries — one per data type regardless of chatIds.length
  const [
    { data: chats },
    { data: allParticipants },
    { data: allMessages },
    { data: unreadMsgs },
    { data: allPrefs },
  ] = await Promise.all([
    sb.from('chats').select('*').in('id', chatIds),
    sb.from('chat_participants').select('chat_id, user_id').in('chat_id', chatIds),
    sb.from('messages').select('*').in('chat_id', chatIds).order('created_at', { ascending: false }),
    sb.from('messages').select('id, chat_id').in('chat_id', chatIds)
      .neq('sender_id', userId).not('read_by', 'cs', `{"${userId}"}`),
    sb.from('chat_user_preferences').select('*').in('chat_id', chatIds).eq('user_id', userId),
  ])

  if (!chats?.length) return []

  // One sequential query for profiles — needs participant user IDs from above
  const allUserIds = [...new Set((allParticipants ?? []).map((p) => p.user_id))]
  const { data: profiles } = await sb.from('profiles').select('*').in('id', allUserIds)

  // Build lookup maps in JS — O(n) each
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p as Profile]))

  const participantsByChat = new Map<string, string[]>()
  for (const p of allParticipants ?? []) {
    const list = participantsByChat.get(p.chat_id) ?? []
    list.push(p.user_id)
    participantsByChat.set(p.chat_id, list)
  }

  // allMessages is sorted desc — first hit per chat_id is the latest message
  const lastMessageByChat = new Map<string, Message>()
  for (const msg of allMessages ?? []) {
    if (!lastMessageByChat.has(msg.chat_id)) {
      lastMessageByChat.set(msg.chat_id, msg as Message)
    }
  }

  const unreadByChat = new Map<string, number>()
  for (const msg of unreadMsgs ?? []) {
    unreadByChat.set(msg.chat_id, (unreadByChat.get(msg.chat_id) ?? 0) + 1)
  }

  type PrefRow = NonNullable<typeof allPrefs>[number]
  const prefsByChat = new Map<string, PrefRow>()
  for (const pref of allPrefs ?? []) {
    prefsByChat.set(pref.chat_id, pref)
  }

  const results: ChatWithParticipants[] = []
  for (const rawChat of chats) {
    const userIds = participantsByChat.get(rawChat.id) ?? []
    const profileList = userIds.map((id) => profileMap.get(id)).filter(Boolean) as Profile[]
    const otherUser = profileList.find((pr) => pr.id !== userId)
    if (!otherUser) continue

    results.push({
      ...rawChat,
      participants: profileList,
      lastMessage: lastMessageByChat.get(rawChat.id) ?? null,
      unreadCount: unreadByChat.get(rawChat.id) ?? 0,
      otherUser,
      myPreferences: prefsByChat.get(rawChat.id) ?? null,
    })
  }

  return results.sort((a, b) => {
    const aTime = a.lastMessage?.created_at ?? a.created_at
    const bTime = b.lastMessage?.created_at ?? b.created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })
}

export async function getChats(userId: string): Promise<ChatWithParticipants[]> {
  const sb = getSupabaseClient()

  const { data: participations } = await sb
    .from('chat_participants').select('chat_id').eq('user_id', userId)
  if (!participations?.length) return []

  // Fetch hidden chat IDs server-side so their content never enters the response
  const { data: hiddenRows } = await sb.rpc('get_hidden_chats')
  const hiddenIds = new Set((hiddenRows ?? []).map((r) => r.chat_id))

  const chatIds = participations
    .map((p) => p.chat_id)
    .filter((id) => !hiddenIds.has(id))

  return hydrateChatIds(userId, chatIds)
}

export async function getHiddenChats(userId: string): Promise<ChatWithParticipants[]> {
  const sb = getSupabaseClient()

  const { data: hiddenRows } = await sb.rpc('get_hidden_chats')
  if (!hiddenRows?.length) return []

  return hydrateChatIds(userId, hiddenRows.map((r) => r.chat_id))
}

export async function setChatHidden(chatId: string, hidden: boolean): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.rpc('set_chat_hidden', { p_chat_id: chatId, p_hidden: hidden })
  if (error) throw new Error(error.message)
}

export async function setChatLockEnabled(enabled: boolean): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.rpc('set_chat_lock_enabled', { p_enabled: enabled })
  if (error) throw new Error(error.message)
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

export async function updatePrivateAvatar(chatId: string, userId: string, url: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb
    .from('chat_user_preferences')
    .upsert({ chat_id: chatId, user_id: userId, private_avatar: url })
  if (error) throw new Error(error.message)
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
