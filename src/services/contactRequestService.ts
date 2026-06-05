import { getSupabaseClient } from '@/lib/supabase/client'
import type { ChatRequest } from '@/types/app'

// ── Inbox queries ─────────────────────────────────────────────────

export async function getReceivedRequests(): Promise<ChatRequest[]> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []
  const { data, error } = await sb
    .from('chat_requests')
    .select('*')
    .eq('receiver_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ChatRequest[]
}

export async function getSentRequests(): Promise<ChatRequest[]> {
  const sb = getSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []
  const { data, error } = await sb
    .from('chat_requests')
    .select('*')
    .eq('sender_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []) as ChatRequest[]
}

// ── Request lifecycle RPCs ─────────────────────────────────────────
// These wrap the SECURITY DEFINER RPCs defined in 002_contact_discovery.sql.

export async function sendContactRequest(lookupToken: string): Promise<string> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('create_chat_request', { p_request_token: lookupToken })
  if (error) throw new Error(error.message)
  return data as string
}

export async function acceptContactRequest(requestId: string): Promise<string> {
  const sb = getSupabaseClient()
  const { data, error } = await sb.rpc('accept_chat_request', { p_request_id: requestId })
  if (error) throw new Error(error.message)
  return data as string
}

// Rejection is silent — no Realtime event fires so the sender cannot
// distinguish rejection from still-pending. This is intentional per §6.
export async function rejectContactRequest(requestId: string): Promise<void> {
  const sb = getSupabaseClient()
  const { error } = await sb.rpc('reject_chat_request', { p_request_id: requestId })
  if (error) throw new Error(error.message)
}

// ── Realtime subscriptions ────────────────────────────────────────
// Each subscribe function returns a cleanup function — call it in a
// useEffect return or component unmount to remove the channel.

type RequestCallback  = (request: ChatRequest) => void
type AcceptedCallback = (request: ChatRequest, chatId: string) => void

// Notifies the receiver when someone sends them a contact request.
// Fires on INSERT to chat_requests where receiver_id matches.
export function subscribeToIncomingRequests(
  userId: string,
  onRequest: RequestCallback
): () => void {
  const sb = getSupabaseClient()
  const channel = sb
    .channel(`incoming_requests:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'INSERT',
        schema: 'public',
        table:  'chat_requests',
        filter: `receiver_id=eq.${userId}`,
      },
      (payload) => onRequest(payload.new as ChatRequest)
    )
    .subscribe()

  return () => { sb.removeChannel(channel) }
}

// Notifies the sender when their request is accepted.
// Fires on UPDATE to chat_requests where sender_id matches.
// The callback receives the updated request + the new chat ID for navigation.
// Rejection updates are intentionally ignored here (no callback fires),
// matching the privacy design: sender cannot observe rejection vs. pending.
export function subscribeToAcceptedRequests(
  userId: string,
  onAccepted: AcceptedCallback
): () => void {
  const sb = getSupabaseClient()
  const channel = sb
    .channel(`accepted_requests:${userId}`)
    .on(
      'postgres_changes',
      {
        event:  'UPDATE',
        schema: 'public',
        table:  'chat_requests',
        filter: `sender_id=eq.${userId}`,
      },
      (payload) => {
        const request = payload.new as ChatRequest
        if (request.status === 'accepted' && request.conversation_id) {
          onAccepted(request, request.conversation_id)
        }
      }
    )
    .subscribe()

  return () => { sb.removeChannel(channel) }
}
