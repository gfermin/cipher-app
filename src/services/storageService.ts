import { mediaProvider } from '@/lib/media'
import { CLOUDINARY_FOLDERS } from '@/lib/constants'

export async function uploadChatImage(
  file: File,
  chatId: string,
  userId: string
): Promise<{ url: string; path: string }> {
  const folder = `${CLOUDINARY_FOLDERS.CHAT_IMAGES}/${chatId}/${userId}`
  return mediaProvider.uploadImage(file, folder, String(Date.now()))
}

/** Returns a delivery URL from a stored public_id or passes a full URL through unchanged. */
export function getImageUrl(publicIdOrUrl: string): string {
  return mediaProvider.getImageUrl(publicIdOrUrl)
}

export async function uploadAvatar(
  file: File,
  userId: string,
  prefix = 'public'
): Promise<{ url: string; path: string }> {
  const folder = `${CLOUDINARY_FOLDERS.AVATARS}/${prefix}/${userId}`
  return mediaProvider.uploadImage(file, folder, String(Date.now()))
}

export async function deleteFile(_bucket: string, path: string): Promise<void> {
  return mediaProvider.deleteImage(path)
}
