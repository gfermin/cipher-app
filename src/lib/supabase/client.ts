import { createBrowserClient } from '@supabase/ssr'

// We cast query results explicitly in service files rather than relying on
// the generic Database type, which becomes `never` with complex Supabase queries.
let client: ReturnType<typeof createBrowserClient> | null = null

export function getSupabaseClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
