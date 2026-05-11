/**
 * Customer auth — magic link via Resend + HMAC-signed tokens
 *
 * Token format: base64url(json) "." base64url(hmac-sha256(payload, SECRET))
 *
 * Magic link token (short-lived, 15min): { kind: 'login', shopId, email, exp }
 * Session cookie (long-lived, 30d):      { kind: 'session', shopId, customerId, email, exp }
 *
 * Stateless — ไม่มี DB session row. Trade-off: revoke ระดับ token ทำไม่ได้
 * (ต้อง rotate secret หรือเปลี่ยน cookie schema ในอนาคต)
 *
 * คุ้มกับ MVP simplicity และข้ามได้เพราะ public order tracking ก็ใช้ pattern
 * โทเคน opaque แบบนี้อยู่แล้ว
 */

const COOKIE_NAME = 'pc_customer'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const MAGIC_LINK_TTL_SECONDS = 60 * 15 // 15 min

function getSecret(): string {
  const s = process.env.CUSTOMER_AUTH_SECRET
  if (!s || s.length < 16) {
    throw new Error('CUSTOMER_AUTH_SECRET missing or too short (min 16 chars)')
  }
  return s
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  return toBase64Url(new Uint8Array(sig))
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

export type LoginTokenPayload = {
  kind: 'login'
  shopId: string
  email: string
  exp: number // unix seconds
}

export type SessionTokenPayload = {
  kind: 'session'
  shopId: string
  customerId: string
  email: string
  exp: number
}

type AnyPayload = LoginTokenPayload | SessionTokenPayload

async function signPayload(payload: AnyPayload): Promise<string> {
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const sig = await hmac(getSecret(), body)
  return `${body}.${sig}`
}

async function verifyToken<T extends AnyPayload>(token: string): Promise<T | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  let expected: string
  try {
    expected = await hmac(getSecret(), body)
  } catch {
    return null
  }
  if (!constantTimeEqual(sig, expected)) return null
  let payload: AnyPayload
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as AnyPayload
  } catch {
    return null
  }
  if (payload.exp * 1000 < Date.now()) return null
  return payload as T
}

export async function buildMagicLinkToken(args: {
  shopId: string
  email: string
}): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + MAGIC_LINK_TTL_SECONDS
  return signPayload({ kind: 'login', shopId: args.shopId, email: args.email, exp })
}

export async function consumeMagicLinkToken(token: string) {
  const payload = await verifyToken<LoginTokenPayload>(token)
  if (!payload || payload.kind !== 'login') return null
  return payload
}

export async function buildSessionToken(args: {
  shopId: string
  customerId: string
  email: string
}): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  return signPayload({
    kind: 'session',
    shopId: args.shopId,
    customerId: args.customerId,
    email: args.email,
    exp,
  })
}

export async function readSessionToken(token: string) {
  const payload = await verifyToken<SessionTokenPayload>(token)
  if (!payload || payload.kind !== 'session') return null
  return payload
}

export const customerCookieOptions = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  },
}
