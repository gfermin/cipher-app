import { getSupabaseClient } from '@/lib/supabase/client'
import type { ChatWithParticipants, Profile, Message } from '@/types/app'

export async function getChats(userId: string): Promise<ChatWithParticipants[]> {
  const sb = getSupabaseClient()

  const { data: participations } = await sb
    .from('chat_participants').select('chat_id').eq('user_id', userId)
  if (!participations?.length) return []

  const chatIds = (participations as { chat_id: string }[]).map((p) => p.chat_id)

  const { data: chats } = await sb.from('chats').select('*').in('id', chatIds)
  if (!chats?.length) return []

  const results: ChatWithParticipants[] = []

  for (const rawChat of chats as { id: string; custom_theme: string | null; created_at: string; updated_at: string }[]) {
    const { data: parts } = await sb
      .from('chat_participants').select('user_id').eq('chat_id', rawChat.id)

    const userIds = ((parts ?? []) as { user_id: string }[]).map((p) => p.user_id)

    const { data: profiles } = await sb.from('profiles').select('*').in('id', userIds)
    const profileList = (profiles ?? []) as Profile[]
    const otherUser = profileList.find((pr) => pr.id !== userId)
    if (!otherUser) continue

    const { data: lastMsgArr } = await sb
      .from('messages').select('*').eq('chat_id', rawChat.id)
      .order('created_at', { ascending: false }).limit(1)
    const lastMessage = ((lastMsgArr ?? []) as Message[])[0] ?? null

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
      myPreferences: (myPrefs as ChatWithParticipants['myPreferences']) ?? null,
      hasVault: !!vault,
    })
  }

  return results.sort((a, b) => {
    const aTime = a.lastMessage?.created_at ?? a.created_at
    const bTime = b.lastMessage?.created_at ?? b.created_at
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })
}

export async function createChat(currentUserId: string, otherUserId: string): Promise<string> {
  const sb = getSupabaseClient()

  const { data: myParts } = await sb
    .from('chat_participants').select('chat_id').eq('user_id', currentUserId)

  if (myParts) {
    for (const p of myParts as { chat_id: string }[]) {
      const { data: match } = await sb
        .from('chat_participants').select('chat_id')
        .eq('chat_id', p.chat_id).eq('user_id', otherUserId).maybeSingle()
      if (match) return (match as { chat_id: string }).chat_id
    }
  }

  const { data: chat, error } = await sb
    .from('chats').insert({ custom_theme: null }).select().single()
  if (error || !chat) throw new Error('Failed to create chat')

  const chatId = (chat as { id: string }).id

  await sb.from('chat_participants').insert([
    { chat_id: chatId, user_id: currentUserId },
    { chat_id: chatId, user_id: otherUserId },
  ])

  return chatId
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

export async function markMessagesRead(chatId: string, userId: string): Promise<void> {
  const sb = getSupabaseClient()
  const { data: msgs } = await sb
    .from('messages').select('id, read_by').eq('chat_id', chatId).neq('sender_id', userId)

  if (!msgs?.length) return
  const toUpdate = (msgs as { id: string; read_by: string[] }[])
    .filter((m) => !m.read_by.includes(userId))

  for (const msg of toUpdate) {
    await sb.from('messages').update({ read_by: [...msg.read_by, userId] }).eq('id', msg.id)
  }
}
