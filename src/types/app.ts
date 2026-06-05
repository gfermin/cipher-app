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

export interface CodeMetadata {
  has_code: boolean
  expires_at: string | null
  rotation_sequence: number | null
  is_encrypted: boolean
}

export type ChatRequestStatus = 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'

export interface ChatRequest {
  id: string
  sender_id: string | null
  receiver_id: string | null
  code_hash_used: string
  code_rotation_sequence: number
  status: ChatRequestStatus
  created_at: string
  expires_at: string
  responded_at: string | null
  conversation_id: string | null
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
