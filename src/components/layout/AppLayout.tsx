'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useChatStore } from '@/stores/chatStore'
import { useUIStore } from '@/stores/uiStore'
import { useContactStore } from '@/stores/contactStore'
import { useContactRequests } from '@/hooks/useContactRequests'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { ChatUnlockModal } from '@/components/chat/ChatUnlockModal'
import { ChatSettingsPanel } from '@/components/settings/ChatSettingsPanel'
import { SettingsView } from './SettingsView'
import { ContactsView } from '@/components/contacts/ContactsView'
import { ToastProvider } from '@/components/ui/ToastProvider'

type Tab = 'chats' | 'contacts' | 'settings'

interface Props {
  initialChatId?: string
  showSettings?: boolean
  showContacts?: boolean
}

export function AppLayout({ initialChatId, showSettings, showContacts }: Props) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { theme } = useTheme()
  const { chats, activeChatId, setActiveChat, activeHiddenChat, setActiveHiddenChat } = useChatStore()
  const { isMobileChatOpen, setMobileChatOpen, chatLockEnabled, setChatLockEnabled, lockAllChats, lockedChats } = useUIStore()
  const { pendingRequests } = useContactStore()

  const initialTab: Tab = showSettings ? 'settings' : showContacts ? 'contacts' : 'chats'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  useContactRequests()

  // Runtime session-expiry guard — middleware handles unauthenticated page loads;
  // this catches the SIGNED_OUT event while the app is already open.
  useEffect(() => {
    if (!isLoading && !user) {
      window.location.replace('/login')
    }
  }, [user, isLoading])

  useEffect(() => {
    if (initialChatId) {
      setActiveChat(initialChatId)
      setMobileChatOpen(true)
    } else {
      // No active chat — ensure mobile shows the sidebar (chat list), not a blank screen.
      setMobileChatOpen(false)
      // Clear any stale hidden chat session so typing a hidden chat's URL
      // directly won't bypass the hidden board flow.
      if (useChatStore.getState().activeHiddenChat) {
        setActiveHiddenChat(null)
      }
    }
  }, [initialChatId, setActiveChat, setMobileChatOpen, setActiveHiddenChat])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Sync chat lock preference from the persisted DB profile on every app load.
  // uiStore defaults chatLockEnabled to false; without this effect it resets on refresh.
  useEffect(() => {
    if (!user?.profile.chat_lock_enabled) return
    setChatLockEnabled(true)
    if (chats.length > 0) lockAllChats(chats.map((c) => c.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, chats.length > 0])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden' && chatLockEnabled) {
        lockAllChats(chats.map((c) => c.id))
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [chatLockEnabled, lockAllChats, chats])

  if (isLoading || !user) {
    return (
      <div className="app-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Loading…</div>
      </div>
    )
  }

  // Use activeHiddenChat as a fallback so ChatSettingsPanel renders for hidden chats
  const activeChat = activeChatId
    ? (chats.find((c) => c.id === activeChatId) ??
        (activeHiddenChat?.id === activeChatId ? activeHiddenChat : null))
    : null
  const isViewingHiddenChat = !!activeHiddenChat && activeHiddenChat.id === activeChatId
  const pendingCount = pendingRequests.length

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    if (tab === 'chats') {
      router.push('/chats')
    } else if (tab === 'contacts') {
      router.push('/contacts')
    } else {
      router.push('/settings')
    }
  }

  function handleChatSelect(chatId: string) {
    setActiveChat(chatId)
    setMobileChatOpen(true)
    router.push(`/chats/${chatId}`)
  }

  function handleBack() {
    setMobileChatOpen(false)
    setActiveChat(null)
    router.push('/chats')
  }

  return (
    <div className="app-root">
      <Sidebar
        hidden={isMobileChatOpen || activeTab !== 'chats'}
        pendingCount={pendingCount}
        onSettingsClick={() => handleTabChange('settings')}
        onContactsClick={() => handleTabChange('contacts')}
      />

      {activeTab === 'settings' ? (
        <SettingsView onBack={() => handleTabChange('chats')} />
      ) : activeTab === 'contacts' ? (
        <ContactsView onBack={() => handleTabChange('chats')} />
      ) : activeChatId ? (
        lockedChats.has(activeChatId) ? (
          <>
            <div className={`chat-panel empty-state${isMobileChatOpen ? ' visible' : ''}`} style={{ display: 'flex' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span style={{ fontSize: 'var(--text-sm)' }}>This chat is locked</span>
            </div>
            <ChatUnlockModal
              chatId={activeChatId}
              onClose={handleBack}
              onUnlocked={() => {}}
            />
          </>
        ) : (
          <>
            <ChatPanel chatId={activeChatId} onBack={handleBack} />
            {activeChat && (
              <ChatSettingsPanel chat={activeChat} isHidden={isViewingHiddenChat} />
            )}
          </>
        )
      ) : (
        <div className="chat-panel empty-state" style={{ display: 'flex' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          <span style={{ fontSize: 'var(--text-sm)' }}>Select a conversation</span>
        </div>
      )}

      <MobileNav activeTab={activeTab} pendingCount={pendingCount} onTabChange={handleTabChange} />
      <ToastProvider />
    </div>
  )
}
