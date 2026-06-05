// Active media provider. To swap providers:
//   1. Implement MediaProvider in a new file under this directory.
//   2. Change the import below — nothing else in the codebase needs to change.
export { cloudinaryProvider as mediaProvider } from './cloudinary'
export type { MediaProvider, UploadResult } from './types'
