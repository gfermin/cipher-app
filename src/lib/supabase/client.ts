import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// @supabase/ssr@0.5.2 was built for the old 3-param SupabaseClient signature.
// @supabase/supabase-js@2.107.0 uses a 5-param signature, so passing the generic
// through createBrowserClient<Database>() misaligns type parameters (Schema → never).
// Workaround: create the client untyped, then cast to SupabaseClient<Database> which
// uses the correct default parameter resolution with __InternalSupabase support.
let client: SupabaseClient<Database> | null = null

export function getSupabaseClient(): SupabaseClient<Database> {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ) as unknown as SupabaseClient<Database>
  }
  return client
}
