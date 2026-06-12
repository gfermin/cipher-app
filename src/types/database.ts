export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      blocks: {
        Row: { blocked_id: string; blocker_id: string; created_at: string; id: string }
        Insert: { blocked_id: string; blocker_id: string; created_at?: string; id?: string }
        Update: { blocked_id?: string; blocker_id?: string; created_at?: string; id?: string }
        Relationships: []
      }
      chat_participants: {
        Row: { chat_id: string; joined_at: string; user_id: string }
        Insert: { chat_id: string; joined_at?: string; user_id: string }
        Update: { chat_id?: string; joined_at?: string; user_id?: string }
        Relationships: []
      }
      chat_requests: {
        Row: {
          code_hash_used: string
          code_rotation_sequence: number
          conversation_id: string | null
          created_at: string
          expires_at: string
          id: string
          receiver_id: string | null
          responded_at: string | null
          sender_id: string | null
          status: Database['public']['Enums']['chat_request_status']
        }
        Insert: {
          code_hash_used: string
          code_rotation_sequence: number
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          receiver_id?: string | null
          responded_at?: string | null
          sender_id?: string | null
          status?: Database['public']['Enums']['chat_request_status']
        }
        Update: {
          code_hash_used?: string
          code_rotation_sequence?: number
          conversation_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          receiver_id?: string | null
          responded_at?: string | null
          sender_id?: string | null
          status?: Database['public']['Enums']['chat_request_status']
        }
        Relationships: []
      }
      hidden_chats: {
        Row: { user_id: string; chat_id: string; hidden_at: string }
        Insert: { user_id: string; chat_id: string; hidden_at?: string }
        Update: { user_id?: string; chat_id?: string; hidden_at?: string }
        Relationships: []
      }
      chat_user_preferences: {
        Row: {
          chat_id: string
          created_at: string
          private_avatar: string | null
          private_avatar_path: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          private_avatar?: string | null
          private_avatar_path?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          private_avatar?: string | null
          private_avatar_path?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          background_url: string | null
          connection_id: string | null
          created_at: string
          custom_theme: string | null
          id: string
          is_request_pending: boolean
          updated_at: string
        }
        Insert: {
          background_url?: string | null
          connection_id?: string | null
          created_at?: string
          custom_theme?: string | null
          id?: string
          is_request_pending?: boolean
          updated_at?: string
        }
        Update: {
          background_url?: string | null
          connection_id?: string | null
          created_at?: string
          custom_theme?: string | null
          id?: string
          is_request_pending?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          connected_at: string
          id: string
          initiated_via_request_id: string | null
          user_a_id: string
          user_b_id: string
        }
        Insert: {
          connected_at?: string
          id?: string
          initiated_via_request_id?: string | null
          user_a_id: string
          user_b_id: string
        }
        Update: {
          connected_at?: string
          id?: string
          initiated_via_request_id?: string | null
          user_a_id?: string
          user_b_id?: string
        }
        Relationships: []
      }
      contact_codes: {
        Row: {
          code_encrypted: string | null
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          is_current: boolean
          rotation_sequence: number
          user_id: string
        }
        Insert: {
          code_encrypted?: string | null
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          is_current?: boolean
          rotation_sequence?: number
          user_id: string
        }
        Update: {
          code_encrypted?: string | null
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          is_current?: boolean
          rotation_sequence?: number
          user_id?: string
        }
        Relationships: []
      }
      contact_lookup_tokens: {
        Row: {
          code_hash: string
          expires_at: string
          id: string
          receiver_id: string
          rotation_sequence: number
          used_at: string | null
        }
        Insert: {
          code_hash: string
          expires_at?: string
          id?: string
          receiver_id: string
          rotation_sequence: number
          used_at?: string | null
        }
        Update: {
          code_hash?: string
          expires_at?: string
          id?: string
          receiver_id?: string
          rotation_sequence?: number
          used_at?: string | null
        }
        Relationships: []
      }
      lookup_rate_log: {
        Row: { attempted_at: string; id: string; user_id: string }
        Insert: { attempted_at?: string; id?: string; user_id: string }
        Update: { attempted_at?: string; id?: string; user_id?: string }
        Relationships: []
      }
      messages: {
        Row: {
          chat_id: string
          content: string | null
          created_at: string
          id: string
          image_path: string | null
          image_url: string | null
          is_deleted: boolean
          is_vaulted: boolean
          read_by: string[]
          sender_id: string
          type: 'text' | 'image' | 'video' | 'deleted'
          content_tsv: unknown
        }
        Insert: {
          chat_id: string
          content?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_deleted?: boolean
          is_vaulted?: boolean
          read_by?: string[]
          sender_id: string
          type?: 'text' | 'image' | 'video' | 'deleted'
        }
        Update: {
          chat_id?: string
          content?: string | null
          created_at?: string
          id?: string
          image_path?: string | null
          image_url?: string | null
          is_deleted?: boolean
          is_vaulted?: boolean
          read_by?: string[]
          sender_id?: string
          type?: 'text' | 'image' | 'video' | 'deleted'
        }
        Relationships: []
      }
      profiles: {
        Row: {
          app_theme: string
          chat_lock_enabled: boolean
          created_at: string
          display_name: string | null
          global_background_url: string | null
          id: string
          public_avatar: string | null
          rotation_offset: number
          updated_at: string
          username: string
        }
        Insert: {
          app_theme?: string
          chat_lock_enabled?: boolean
          created_at?: string
          display_name?: string | null
          global_background_url?: string | null
          id: string
          public_avatar?: string | null
          rotation_offset?: number
          updated_at?: string
          username: string
        }
        Update: {
          app_theme?: string
          chat_lock_enabled?: boolean
          created_at?: string
          display_name?: string | null
          global_background_url?: string | null
          id?: string
          public_avatar?: string | null
          rotation_offset?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: { chat_id: string; updated_at: string; user_id: string }
        Insert: { chat_id: string; updated_at?: string; user_id: string }
        Update: { chat_id?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      user_vault_codes: {
        Row: { chat_id: string; created_at: string; password_hash: string; updated_at: string; user_id: string }
        Insert: { chat_id: string; created_at?: string; password_hash: string; updated_at?: string; user_id: string }
        Update: { chat_id?: string; created_at?: string; password_hash?: string; updated_at?: string; user_id?: string }
        Relationships: []
      }
      vault_session_tokens: {
        Row: { chat_id: string; expires_at: string; token: string; user_id: string }
        Insert: { chat_id: string; expires_at?: string; token?: string; user_id: string }
        Update: { chat_id?: string; expires_at?: string; token?: string; user_id?: string }
        Relationships: []
      }
      vault_verify_attempts: {
        Row: { attempted_at: string; id: number; user_id: string }
        Insert: { attempted_at?: string; id?: number; user_id: string }
        Update: { attempted_at?: string; id?: number; user_id?: string }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _cipher_gen_code: { Args: Record<PropertyKey, never>; Returns: string }
      get_hidden_chats: { Args: Record<PropertyKey, never>; Returns: { chat_id: string }[] }
      set_chat_hidden: { Args: { p_chat_id: string; p_hidden: boolean }; Returns: undefined }
      set_chat_lock_enabled: { Args: { p_enabled: boolean }; Returns: undefined }
      accept_chat_request: { Args: { p_request_id: string }; Returns: string }
      block_user: { Args: { p_blocked_id: string }; Returns: undefined }
      check_lookup_rate_limit: { Args: { p_user_id: string }; Returns: boolean }
      check_owns_image: { Args: { p_public_id: string }; Returns: boolean }
      cleanup_expired_contact_codes: { Args: Record<PropertyKey, never>; Returns: number }
      // Returns chat UUID string on success
      create_direct_chat: { Args: { p_other_user_id: string }; Returns: string }
      delete_my_account: { Args: Record<PropertyKey, never>; Returns: { image_paths: string[]; avatar_paths: string[] } }
      create_chat_request: { Args: { p_request_token: string }; Returns: string }
      delete_vault_image: { Args: { p_message_id: string }; Returns: string }
      expire_stale_chat_requests: { Args: Record<PropertyKey, never>; Returns: number }
      get_my_code_encrypted: { Args: Record<PropertyKey, never>; Returns: string }
      get_my_code_metadata: {
        Args: Record<PropertyKey, never>
        Returns: {
          expires_at: string
          has_code: boolean
          is_encrypted: boolean
          rotation_sequence: number
        }[]
      }
      // Returns vault-content rows; token must be a valid vault_session_tokens UUID
      get_vault_messages: {
        Args: { p_chat_id: string; p_token: string }
        Returns: {
          id: string; chat_id: string; sender_id: string
          type: 'text' | 'image' | 'video' | 'deleted'; content: string | null
          image_url: string | null; image_path: string | null
          is_vaulted: boolean; is_deleted: boolean; read_by: string[]; created_at: string
        }[]
      }
      get_users_needing_rotation: {
        Args: Record<PropertyKey, never>
        Returns: { user_id: string }[]
      }
      has_user_vault_code: { Args: { p_chat_id: string }; Returns: boolean }
      get_my_chat_ids: { Args: Record<PropertyKey, never>; Returns: string[] }
      log_lookup_attempt: { Args: { p_user_id: string }; Returns: undefined }
      lookup_contact_code: { Args: { p_code: string }; Returns: string }
      // Returns void; updates read_by on messages the caller did not send
      mark_messages_read: { Args: { p_chat_id: string }; Returns: undefined }
      mint_contact_code: { Args: { p_user_id: string }; Returns: string }
      prune_lookup_rate_log: { Args: Record<PropertyKey, never>; Returns: number }
      reject_chat_request: { Args: { p_request_id: string }; Returns: undefined }
      revoke_vault_token: { Args: { p_chat_id: string }; Returns: undefined }
      rotate_expired_codes: { Args: Record<PropertyKey, never>; Returns: number }
      set_user_vault_code: { Args: { p_chat_id: string; p_code: string }; Returns: undefined }
      store_code_encrypted: { Args: { p_encrypted: string; p_user_id: string }; Returns: undefined }
      unblock_user: { Args: { p_blocked_id: string }; Returns: undefined }
      vault_chat_media: { Args: { p_chat_id: string }; Returns: number }
      vault_chat_images: { Args: { p_chat_id: string }; Returns: number }
      // Returns TEXT: UUID token string (success), '' (wrong code), NULL (no code set)
      // Raises P0001 'vault_rate_limited' after 5 attempts / 60 s
      verify_user_vault_code: { Args: { p_chat_id: string; p_code: string }; Returns: string }
      search_chat_messages: {
        Args: { p_chat_id: string; p_query: string; p_limit?: number }
        Returns: {
          id: string; chat_id: string; sender_id: string
          type: 'text' | 'image' | 'video' | 'deleted'; content: string | null
          image_url: string | null; image_path: string | null
          is_vaulted: boolean; is_deleted: boolean; read_by: string[]; created_at: string
        }[]
      }
      get_messages_around_timestamp: {
        Args: { p_chat_id: string; p_timestamp: string; p_window?: number }
        Returns: {
          id: string; chat_id: string; sender_id: string
          type: 'text' | 'image' | 'video' | 'deleted'; content: string | null
          image_url: string | null; image_path: string | null
          is_vaulted: boolean; is_deleted: boolean; read_by: string[]; created_at: string
        }[]
      }
    }
    Enums: {
      chat_request_status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never
