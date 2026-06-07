// rotate-contact-codes
// Scheduled Edge Function — invoke hourly via Supabase Dashboard cron or pg_cron.
//
// Dashboard setup (Supabase > Integrations > Cron):
//   Schedule: 0 */12 * * *   (every 12 hours — midnight and noon)
//   No auth header needed when invoked by the scheduler; use service_role key.
//
// Flow per run:
//   1. Fetch all user IDs whose current code has expired
//   2. For each: mint new code → encrypt → store encrypted blob
//   3. Clean up codes older than 48h
//
// Idempotent: mint_contact_code sets is_current = FALSE on the old row before
// inserting the new one, so double-running is safe.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { encryptCode } from '../_shared/crypto.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CIPHER_CODE_SECRET        = Deno.env.get('CIPHER_CODE_SECRET')!

Deno.serve(async (req: Request) => {
  // Allow direct invocation with the service-role key as a Bearer token
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 })
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 1. Find users whose current code has expired
  const { data: rows, error: listError } = await admin.rpc('get_users_needing_rotation')
  if (listError) {
    console.error('get_users_needing_rotation failed:', listError)
    return new Response(JSON.stringify({ error: 'list_failed' }), { status: 500 })
  }

  const users = (rows as Array<{ user_id: string }>) ?? []
  let rotated = 0
  let failed  = 0

  for (const { user_id } of users) {
    try {
      const { data: plaintext, error: mintError } = await admin.rpc('mint_contact_code', {
        p_user_id: user_id,
      })
      if (mintError || !plaintext) throw mintError ?? new Error('no plaintext')

      const encrypted = await encryptCode(plaintext as string, CIPHER_CODE_SECRET)

      const { error: storeError } = await admin.rpc('store_code_encrypted', {
        p_user_id:   user_id,
        p_encrypted: encrypted,
      })
      if (storeError) throw storeError

      rotated++
    } catch (err) {
      console.error(`Rotation failed for user ${user_id}:`, err)
      failed++
    }
  }

  // 2. Prune codes older than 48h
  const { data: pruned, error: pruneError } = await admin.rpc('cleanup_expired_contact_codes')
  if (pruneError) console.error('cleanup_expired_contact_codes failed:', pruneError)

  const result = { rotated, failed, pruned: pruned ?? 0 }
  console.log('rotate-contact-codes result:', result)

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
