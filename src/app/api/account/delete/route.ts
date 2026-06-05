import { createHash } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Run DB cleanup RPC — soft-deletes messages, hard-deletes all personal data,
  //    and returns Cloudinary public_ids that need server-side signed deletion.
  const { data: paths, error: rpcError } = await supabase.rpc('delete_my_account')
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // 2. Best-effort Cloudinary cleanup (errors are swallowed — the asset paths are
  //    already removed from the DB so they are no longer reachable through Cipher).
  const publicIds = [
    ...((paths?.image_paths as string[] | null) ?? []),
    ...((paths?.avatar_paths as string[] | null) ?? []),
  ].filter(Boolean)

  if (publicIds.length > 0) {
    await deleteCloudinaryAssets(publicIds)
  }

  // 3. Delete the auth.users row (requires service_role; anon key cannot self-delete).
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceKey) {
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await admin.auth.admin.deleteUser(user.id).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}

async function deleteCloudinaryAssets(publicIds: string[]) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) return

  // Cloudinary destroy accepts one public_id per request; fire in parallel.
  await Promise.allSettled(
    publicIds.map(async (public_id) => {
      const timestamp = Math.floor(Date.now() / 1000)
      const signature = createHash('sha1')
        .update(`public_id=${public_id}&timestamp=${timestamp}${apiSecret}`)
        .digest('hex')

      const form = new FormData()
      form.append('public_id', public_id)
      form.append('timestamp', String(timestamp))
      form.append('api_key', apiKey)
      form.append('signature', signature)

      await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
        method: 'POST',
        body: form,
      })
    })
  )
}
