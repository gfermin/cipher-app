import { getSupabaseClient } from '@/lib/supabase/client'
import { SUPABASE_STORAGE } from '@/lib/constants'

export async function uploadChatImage(
  file: File,
  chatId: string,
  userId: string
): Promise<{ url: string; path: string }> {
  const supabase = getSupabaseClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${chatId}/${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE.CHAT_IMAGES)
    .upload(path, file, { upsert: false })

  if (error) throw new Error(error.message)

  const { data: signedData } = await supabase.storage
    .from(SUPABASE_STORAGE.CHAT_IMAGES)
    .createSignedUrl(path, 3600)

  return { url: signedData?.signedUrl ?? '', path }
}

export async function getSignedImageUrl(path: string): Promise<string> {
  const supabase = getSupabaseClient()
  const { data } = await supabase.storage
    .from(SUPABASE_STORAGE.CHAT_IMAGES)
    .createSignedUrl(path, 3600)
  return data?.signedUrl ?? ''
}

export async function uploadAvatar(
  file: File,
  userId: string,
  prefix = 'public'
): Promise<{ url: string; path: string }> {
  const supabase = getSupabaseClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${prefix}/${userId}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(SUPABASE_STORAGE.AVATARS)
    .upload(path, file, { upsert: true })

  if (error) throw new Error(error.message)

  const { data: signedData } = await supabase.storage
    .from(SUPABASE_STORAGE.AVATARS)
    .createSignedUrl(path, 86400)

  return { url: signedData?.signedUrl ?? '', path }
}

export async function deleteFile(bucket: string, path: string): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase.storage.from(bucket).remove([path])
}
