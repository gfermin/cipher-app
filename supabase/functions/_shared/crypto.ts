// AES-256-GCM encrypt/decrypt for contact codes.
// The 12-byte IV is prepended to the ciphertext and base64-encoded together.

function keyBytes(secret: string): ArrayBuffer {
  const raw = new TextEncoder().encode(secret)
  const buf = new Uint8Array(32)
  buf.set(raw.slice(0, 32))
  return buf.buffer as ArrayBuffer
}

export async function encryptCode(plaintext: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', keyBytes(secret), { name: 'AES-GCM' }, false, ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv)
  out.set(new Uint8Array(ct), 12)
  return btoa(String.fromCharCode(...out))
}

export async function decryptCode(ciphertext: string, secret: string): Promise<string> {
  const raw = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw', keyBytes(secret), { name: 'AES-GCM' }, false, ['decrypt']
  )
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12))
  return new TextDecoder().decode(pt)
}
