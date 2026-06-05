// expire-chat-requests
// Scheduled Edge Function — run daily via Supabase Dashboard cron.
//
// Dashboard setup (Supabase > Integrations > Cron):
//   Schedule: 0 3 * * *   (3 AM UTC daily — low-traffic window)
//   No auth header needed when invoked by the scheduler; use service_role key.
//
// Calls expire_stale_chat_requests() which flips pending requests older than
// 7 days to status = 'expired'. Returns the count of rows updated.
//
// Idempotent: the RPC only touches rows still in 'pending' state.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: expired, error } = await admin.rpc('expire_stale_chat_requests')
  if (error) {
    console.error('expire_stale_chat_requests failed:', error)
    return new Response(JSON.stringify({ error: 'expire_failed', detail: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const result = { expired: expired ?? 0 }
  console.log('expire-chat-requests result:', result)

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
