export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          display_name: string | null
          public_avatar: string | null
          app_theme: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username: string
          display_name?: string | null
          public_avatar?: string | null
          app_theme?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          username?: string
          display_name?: string | null
          public_avatar?: string | null
          app_theme?: string
          updated_at?: string
        }
      }
      chats: {
        Row: {
          id: string
          custom_theme: string | null
          created_at: string
          updated_at: string
        }
        Insert: { custom_theme?: string | null; created_at?: string; updated_at?: string }
        Update: { custom_theme?: string | null; updated_at?: string }
      }
      chat_participants: {
        Row: { chat_id: string; user_id: string; joined_at: string }
        Insert: { chat_id: string; user_id: string; joined_at?: string }
        Update: never
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          type: 'text' | 'image' | 'deleted'
          content: string | null
          image_url: string | null
          image_path: string | null
          is_vaulted: boolean
          is_deleted: boolean
          read_by: string[]
          created_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          type?: 'text' | 'image' | 'deleted'
          content?: string | null
          image_url?: string | null
          image_path?: string | null
          is_vaulted?: boolean
          is_deleted?: boolean
          read_by?: string[]
          created_at?: string
        }
        Update: {
          type?: 'text' | 'image' | 'deleted'
          content?: string | null
          is_vaulted?: boolean
          is_deleted?: boolean
          read_by?: string[]
        }
      }
      chat_vaults: {
        Row: { id: string; chat_id: string; password_hash: string; created_at: string; updated_at: string }
        Insert: { chat_id: string; password_hash: string }
        Update: { password_hash?: string; updated_at?: string }
      }
      chat_user_preferences: {
        Row: {
          chat_id: string
          user_id: string
          private_avatar: string | null
          private_avatar_path: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          chat_id: string
          user_id: string
          private_avatar?: string | null
          private_avatar_path?: string | null
        }
        Update: {
          private_avatar?: string | null
          private_avatar_path?: string | null
          updated_at?: string
        }
      }
      typing_indicators: {
        Row: { chat_id: string; user_id: string; updated_at: string }
        Insert: { chat_id: string; user_id: string; updated_at?: string }
        Update: { updated_at?: string }
      }
    }
    Functions: {
      set_vault_password: {
        Args: { p_chat_id: string; p_password: string }
        Returns: void
      }
      verify_vault_password: {
        Args: { p_chat_id: string; p_password: string }
        Returns: boolean
      }
      vault_chat_images: {
        Args: { p_chat_id: string }
        Returns: void
      }
    }
  }
}
