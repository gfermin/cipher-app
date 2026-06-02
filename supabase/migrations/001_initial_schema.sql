-- ================================================================
-- CIPHER — Initial Database Schema
-- ================================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tables ────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  public_avatar TEXT,
  app_theme TEXT DEFAULT 'dark' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.chats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_theme TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.chat_participants (
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT CHECK (type IN ('text', 'image', 'deleted')) NOT NULL DEFAULT 'text',
  content TEXT,
  image_url TEXT,
  image_path TEXT,
  is_vaulted BOOLEAN DEFAULT FALSE NOT NULL,
  is_deleted BOOLEAN DEFAULT FALSE NOT NULL,
  read_by UUID[] DEFAULT '{}' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.chat_vaults (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE public.chat_user_preferences (
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  private_avatar TEXT,
  private_avatar_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE public.typing_indicators (
  chat_id UUID REFERENCES public.chats(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (chat_id, user_id)
);

-- ── Indexes ───────────────────────────────────────────────────────

CREATE INDEX idx_messages_chat_id ON public.messages(chat_id);
CREATE INDEX idx_messages_created_at ON public.messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_vaulted ON public.messages(chat_id, is_vaulted);
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);
CREATE INDEX idx_typing_updated ON public.typing_indicators(updated_at);

-- ── Row Level Security ────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_auth" ON public.profiles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Chats
CREATE POLICY "chats_select_participant" ON public.chats
  FOR SELECT TO authenticated
  USING (id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "chats_insert_auth" ON public.chats
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "chats_update_participant" ON public.chats
  FOR UPDATE TO authenticated
  USING (id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "chats_delete_participant" ON public.chats
  FOR DELETE TO authenticated
  USING (id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

-- Chat participants
CREATE POLICY "cp_select_own_chats" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (chat_id IN (SELECT chat_id FROM public.chat_participants cp2 WHERE cp2.user_id = auth.uid()));

CREATE POLICY "cp_insert_auth" ON public.chat_participants
  FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE POLICY "cp_delete_own" ON public.chat_participants
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Messages
CREATE POLICY "messages_select_participant" ON public.messages
  FOR SELECT TO authenticated
  USING (chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "messages_insert_participant" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "messages_update_participant" ON public.messages
  FOR UPDATE TO authenticated
  USING (chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "messages_delete_participant" ON public.messages
  FOR DELETE TO authenticated
  USING (chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

-- Chat vaults
CREATE POLICY "vaults_all_participant" ON public.chat_vaults
  FOR ALL TO authenticated
  USING (chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()))
  WITH CHECK (chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

-- Chat user preferences
CREATE POLICY "prefs_select_participant" ON public.chat_user_preferences
  FOR SELECT TO authenticated
  USING (chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()));

CREATE POLICY "prefs_all_own" ON public.chat_user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Typing indicators
CREATE POLICY "typing_all_participant" ON public.typing_indicators
  FOR ALL TO authenticated
  USING (chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid()))
  WITH CHECK (
    user_id = auth.uid() AND
    chat_id IN (SELECT chat_id FROM public.chat_participants WHERE user_id = auth.uid())
  );

-- ── Functions ─────────────────────────────────────────────────────

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Set vault password (hashed server-side)
CREATE OR REPLACE FUNCTION public.set_vault_password(p_chat_id UUID, p_password TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant of this chat';
  END IF;

  v_hash := crypt(p_password, gen_salt('bf', 10));

  INSERT INTO public.chat_vaults (chat_id, password_hash)
  VALUES (p_chat_id, v_hash)
  ON CONFLICT (chat_id) DO UPDATE SET password_hash = v_hash, updated_at = NOW();
END;
$$;

-- Verify vault password
CREATE OR REPLACE FUNCTION public.verify_vault_password(p_chat_id UUID, p_password TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT password_hash INTO v_hash
  FROM public.chat_vaults
  WHERE chat_id = p_chat_id;

  IF v_hash IS NULL THEN RETURN FALSE; END IF;

  RETURN v_hash = crypt(p_password, v_hash);
END;
$$;

-- Vault all image messages in a chat (called on session end)
CREATE OR REPLACE FUNCTION public.vault_chat_images(p_chat_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE chat_id = p_chat_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a participant of this chat';
  END IF;

  UPDATE public.messages
  SET is_vaulted = TRUE
  WHERE chat_id = p_chat_id
    AND type = 'image'
    AND is_vaulted = FALSE;
END;
$$;

-- ── Storage Setup (run manually in dashboard or via CLI) ──────────
-- supabase storage create avatars --public false
-- supabase storage create chat-images --public false
