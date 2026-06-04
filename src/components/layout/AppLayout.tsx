'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useChatStore } from '@/stores/chatStore'
import { useUIStore } from '@/stores/uiStore'
import { useContactStore } from '@/stores/contactStore'
import { useContactRequests } from '@/hooks/useContactRequests'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { ChatPanel } from '@/components/chat/ChatPanel'
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
  const { chats, activeChatId, setActiveChat } = useChatStore()
  const { isMobileChatOpen, setMobileChatOpen } = useUIStore()
  const { pendingRequests } = useContactStore()

  const initialTab: Tab = showSettings ? 'settings' : showContacts ? 'contacts' : 'chats'
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)

  // Keep subscriptions active for the whole session
  useContactRequests()

  useEffect(() => {
    if (!isLoading && !user) {
      // Hard navigation resets the Zustand store on the next load, which prevents
      // the infinite redirect loop where client auth state (user=null, isLoading=false)
      // is out of sync with valid server-side session cookies. With router.replace the
      // store is NOT reset on client-side navigation, so AppLayout immediately
      // redirects again when middleware bounces the request back to /chats.
      window.location.replace('/login')
    }
  }, [user, isLoading])

  useEffect(() => {
    if (initialChatId) {
      setActiveChat(initialChatId)
      setMobileChatOpen(true)
    }
  }, [initialChatId, setActiveChat, setMobileChatOpen])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Show loading while auth resolves OR while the unauthenticated redirect is
  // in-flight. Never return null — a blank DOM is the bug we're fixing.
  if (isLoading || !user) {
    return (
      <div className="app-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Loading…</div>
      </div>
    )
  }

  const activeChat = activeChatId ? chats.find((c) => c.id === activeChatId) : null
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
        hidden={isMobileChatOpen}
        pendingCount={pendingCount}
        onSettingsClick={() => handleTabChange('settings')}
        onContactsClick={() => handleTabChange('contacts')}
      />

      {activeTab === 'settings' ? (
        <SettingsView onBack={() => handleTabChange('chats')} />
      ) : activeTab === 'contacts' ? (
        <ContactsView onBack={() => handleTabChange('chats')} />
      ) : activeChatId ? (
        <>
          <ChatPanel chatId={activeChatId} onBack={handleBack} />
          {activeChat && <ChatSettingsPanel chat={activeChat} />}
        </>
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
