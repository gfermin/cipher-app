'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useChatStore } from '@/stores/chatStore'
import { useUIStore } from '@/stores/uiStore'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { ChatPanel } from '@/components/chat/ChatPanel'
import { ChatSettingsPanel } from '@/components/settings/ChatSettingsPanel'
import { SettingsView } from './SettingsView'
import { ToastProvider } from '@/components/ui/ToastProvider'

interface Props {
  initialChatId?: string
  showSettings?: boolean
}

export function AppLayout({ initialChatId, showSettings }: Props) {
  const router = useRouter()
  const { user, isLoading } = useAuth()
  const { theme } = useTheme()
  const { chats, activeChatId, setActiveChat } = useChatStore()
  const { isMobileChatOpen, setMobileChatOpen } = useUIStore()
  const [activeTab, setActiveTab] = useState<'chats' | 'settings'>(showSettings ? 'settings' : 'chats')

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login')
    }
  }, [user, isLoading, router])

  useEffect(() => {
    if (initialChatId) {
      setActiveChat(initialChatId)
      setMobileChatOpen(true)
    }
  }, [initialChatId, setActiveChat, setMobileChatOpen])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  if (isLoading) {
    return (
      <div className="app-root" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Loading…</div>
      </div>
    )
  }

  if (!user) return null

  const activeChat = activeChatId ? chats.find((c) => c.id === activeChatId) : null

  function handleTabChange(tab: 'chats' | 'settings') {
    setActiveTab(tab)
    if (tab === 'chats') {
      router.push('/chats')
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
        onSettingsClick={() => handleTabChange('settings')}
      />

      {activeTab === 'settings' ? (
        <SettingsView onBack={() => handleTabChange('chats')} />
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

      <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
      <ToastProvider />
    </div>
  )
}
