import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let public_id: string
  try {
    const body = await request.json() as { public_id?: unknown }
    if (!body.public_id || typeof body.public_id !== 'string') {
      return NextResponse.json({ error: 'Missing public_id' }, { status: 400 })
    }
    public_id = body.public_id
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // Ownership check via SECURITY DEFINER RPC (bypasses the is_vaulted RLS
  // restriction so vaulted image paths are verifiable server-side).
  const { data: owns, error: ownsError } = await supabase.rpc(
    'check_owns_image',
    { p_public_id: public_id }
  )
  if (ownsError || !owns) {
    return NextResponse.json({ error: 'Asset not found or access denied' }, { status: 403 })
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Media provider not configured' }, { status: 500 })
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = createHash('sha1')
    .update(`public_id=${public_id}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex')

  const form = new FormData()
  form.append('public_id', public_id)
  form.append('timestamp', String(timestamp))
  form.append('api_key', apiKey)
  form.append('signature', signature)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
    { method: 'POST', body: form }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return NextResponse.json(
      { error: 'Cloudinary deletion failed', detail: err.error?.message },
      { status: 502 }
    )
  }

  return NextResponse.json({ ok: true })
}
