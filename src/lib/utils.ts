export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function generateAvatarColor(seed: string): string {
  const colors = [
    '#7c5ff7', '#ff6b9d', '#00b4d8', '#52b788',
    '#e63946', '#f4a261', '#2ec4b6', '#e76f51',
  ]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function buildEmailFromUsername(username: string): string {
  return `${username.toLowerCase().trim()}@cipher.app`
}

export function extractUsernameFromEmail(email: string): string {
  return email.replace('@cipher.app', '')
}

export function generateId(): string {
  return crypto.randomUUID()
}

// Returns content sliced to show ≤contextChars characters before and after the first
// match of query. Prepends/appends "…" when the slice doesn't reach the string boundary.
export function getSearchExcerpt(content: string, query: string, contextChars = 40): string {
  const q = query.trim()
  if (!q) return content.slice(0, 80)
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(escaped, 'i').exec(content)
  if (!match) return content.slice(0, 80)
  const start = Math.max(0, match.index - contextChars)
  const end = Math.min(content.length, match.index + match[0].length + contextChars)
  let excerpt = content.slice(start, end)
  if (start > 0) excerpt = '…' + excerpt
  if (end < content.length) excerpt = excerpt + '…'
  return excerpt
}

// Splits text into highlighted and non-highlighted segments for the matched query term.
export function highlightMatch(
  text: string,
  query: string
): Array<{ text: string; highlight: boolean }> {
  const q = query.trim()
  if (!q) return [{ text, highlight: false }]
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'gi')
  const parts: Array<{ text: string; highlight: boolean }> = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), highlight: false })
    parts.push({ text: m[0], highlight: true })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), highlight: false })
  return parts.length > 0 ? parts : [{ text, highlight: false }]
}
