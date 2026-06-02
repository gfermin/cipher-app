import type { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Chat = Database['public']['Tables']['chats']['Row']
export type Message = Database['public']['Tables']['messages']['Row']
export type ChatParticipant = Database['public']['Tables']['chat_participants']['Row']
export type ChatUserPreferences = Database['public']['Tables']['chat_user_preferences']['Row']

export type Theme =
  | 'dark' | 'light'
  | 'pink' | 'pink-light'
  | 'blue' | 'blue-light'
  | 'green' | 'green-light'
  | 'red' | 'red-light'

export type ChatTheme = 'default' | 'purple' | 'teal' | 'rose'

export interface ChatWithParticipants extends Chat {
  participants: Profile[]
  lastMessage: Message | null
  unreadCount: number
  otherUser: Profile
  myPreferences: ChatUserPreferences | null
  hasVault: boolean
}

export interface MessageWithSender extends Message {
  sender: Profile
}

export interface AuthUser {
  id: string
  email: string
  profile: Profile
}

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

export interface VaultState {
  isUnlocked: boolean
  chatId: string | null
}
