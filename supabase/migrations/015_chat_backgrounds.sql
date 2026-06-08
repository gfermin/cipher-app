-- Migration 014: Background images for global and per-chat use

-- Global background on user profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS global_background_url TEXT;

-- Per-chat background (NULL means fall back to global, then none)
ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS background_url TEXT;
