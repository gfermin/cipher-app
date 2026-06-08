export const THEMES = [
  { id: 'dark', label: 'Dark', family: 'Default', variant: 'dark' },
  { id: 'light', label: 'Light', family: 'Default', variant: 'light' },
  { id: 'pink', label: 'Girly Pink', family: 'Girly Pink', variant: 'dark' },
  { id: 'pink-light', label: 'Pink Light', family: 'Girly Pink', variant: 'light' },
  { id: 'blue', label: 'Warrior Blue', family: 'Warrior Blue', variant: 'dark' },
  { id: 'blue-light', label: 'Blue Light', family: 'Warrior Blue', variant: 'light' },
  { id: 'green', label: 'Natural Green', family: 'Natural Green', variant: 'dark' },
  { id: 'green-light', label: 'Green Light', family: 'Natural Green', variant: 'light' },
  { id: 'red', label: 'Passion Red', family: 'Passion Red', variant: 'dark' },
  { id: 'red-light', label: 'Red Light', family: 'Passion Red', variant: 'light' },
] as const

export const THEME_FAMILIES = [
  { id: 'Default', dark: 'dark', light: 'light', accent: '#7c5ff7' },
  { id: 'Girly Pink', dark: 'pink', light: 'pink-light', accent: '#ff6b9d' },
  { id: 'Warrior Blue', dark: 'blue', light: 'blue-light', accent: '#00b4d8' },
  { id: 'Natural Green', dark: 'green', light: 'green-light', accent: '#52b788' },
  { id: 'Passion Red', dark: 'red', light: 'red-light', accent: '#e63946' },
] as const

export const CHAT_THEMES = [
  { id: 'default', label: 'Default' },
  { id: 'purple', label: 'Passion Purple' },
  { id: 'teal', label: 'Friendly Teal' },
  { id: 'rose', label: 'Sexy Rose' },
] as const

export const CLOUDINARY_FOLDERS = {
  AVATARS: 'cipher/avatars',
  CHAT_IMAGES: 'cipher/chat-images',
  BACKGROUNDS: 'cipher/backgrounds',
} as const

export const TYPING_DEBOUNCE_MS = 2000
export const TYPING_EXPIRE_MS = 5000
export const MESSAGES_PAGE_SIZE = 40
