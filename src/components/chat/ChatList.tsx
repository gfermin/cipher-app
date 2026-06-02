'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useChatStore } from '@/stores/chatStore'
import { useAuthStore } from '@/stores/authStore'
import { getChats, createChat, searchUsers } from '@/services/chatService'
import { useChats } from '@/hooks/useChats'
import { ChatItem } from './ChatItem'
import { Avatar } from '@/components/ui/Avatar'
import type { Profile } from '@/types/app'

export function ChatList() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { chats, setChats, activeChatId } = useChatStore()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)

  // Realtime chat list subscription
  useChats()

  useEffect(() => {
    if (!user) return
    getChats(user.id)
      .then(setChats)
      .finally(() => setLoading(false))
  }, [user, setChats])

  useEffect(() => {
    if (!search.trim() || !user) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      const results = await searchUsers(search, user.id).catch(() => [])
      setSearchResults(results)
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [search, user])

  async function handleSelectUser(profile: Profile) {
    if (!user) return
    const chatId = await createChat(user.id, profile.id).catch(() => null)
    if (chatId) {
      setSearch('')
      const updated = await getChats(user.id).catch(() => chats)
      setChats(updated)
      router.push(`/chats/${chatId}`)
    }
  }

  const filtered = search
    ? chats.filter((c) =>
        (c.otherUser.display_name ?? c.otherUser.username)
          .toLowerCase()
          .includes(search.toLowerCase())
      )
    : chats

  return (
    <>
      <div className="search-bar">
        <div className="search-input-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            className="search-input"
            type="search"
            placeholder="Search or start new chat"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="chat-list">
        {search && searchResults.length > 0 && (
          <div style={{ padding: '4px 8px' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px' }}>
              Users
            </div>
            {searchResults.map((p) => (
              <div
                key={p.id}
                className="chat-item"
                onClick={() => handleSelectUser(p)}
              >
                <Avatar src={p.public_avatar} name={p.display_name ?? p.username} size={44} />
                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">{p.display_name ?? p.username}</span>
                  </div>
                  <span className="chat-item-last">@{p.username}</span>
                </div>
              </div>
            ))}
            {searchResults.length > 0 && filtered.length > 0 && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 8px 4px' }}>
                Chats
              </div>
            )}
          </div>
        )}

        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', alignItems: 'center' }}>
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: '50%' }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ height: 13, width: '60%', marginBottom: 6 }} />
                <div className="skeleton" style={{ height: 11, width: '80%' }} />
              </div>
            </div>
          ))
        ) : filtered.length === 0 && !searching ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
            {search ? 'No chats found' : 'No conversations yet'}
          </div>
        ) : (
          filtered.map((chat) => (
            <ChatItem
              key={chat.id}
              chat={chat}
              isActive={activeChatId === chat.id}
              currentUserId={user?.id ?? ''}
              onClick={() => router.push(`/chats/${chat.id}`)}
            />
          ))
        )}
      </div>
    </>
  )
}
