export interface UploadResult {
  /** Permanent delivery URL — store in messages.image_url / profiles.public_avatar */
  url: string
  /** Provider-specific ID — store in messages.image_path for future transforms or deletion */
  path: string
}

export interface MediaProvider {
  uploadImage(file: File, folder: string, filename: string): Promise<UploadResult>
  /** Deletion may be a no-op on providers that require server-side signing. */
  deleteImage(publicId: string): Promise<void>
  /** Reconstructs a delivery URL from a stored publicId or passes a full URL through unchanged. */
  getImageUrl(publicIdOrUrl: string): string
}
