import { z } from 'zod'
import { json, type Env } from './env'

// POST /api/session (plan 3.4, 3.11): verifies a Turnstile token, then sets an
// HttpOnly cookie holding an HMAC-signed {sid, exp}. The cookie is a session
// token, not a counter; the rate limiter counts judgments per sid.

const COOKIE = 'quibble_session'
const LIFETIME_SECONDS = 2 * 60 * 60
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

const sessionRequestSchema = z.strictObject({ turnstileToken: z.string().min(1).max(2048) })
const siteverifySchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  metadata: z.object({ result_with_testing_key: z.boolean().optional() }).optional(),
})
const payloadSchema = z.strictObject({ sid: z.string().regex(/^[0-9a-f]{32}$/u), exp: z.int() })

const encoder = new TextEncoder()

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '')
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> | undefined {
  try {
    const binary = atob(text.replace(/-/gu, '+').replace(/_/gu, '/'))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return undefined
  }
}

function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(secret: string, sid: string, exp: number): Promise<string> {
  const payload = encoder.encode(JSON.stringify({ sid, exp }))
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), payload))
  return `${base64url(payload)}.${base64url(signature)}`
}

// The session ID from a valid, unexpired cookie, or undefined.
export async function readSession(request: Request, secret: string, now = Date.now()): Promise<string | undefined> {
  const value = request.headers.get('Cookie')?.split(/;\s*/u).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  const [payloadText, signatureText] = value?.split('.') ?? []
  const payload = payloadText === undefined ? undefined : fromBase64url(payloadText)
  const signature = signatureText === undefined ? undefined : fromBase64url(signatureText)
  if (!payload || !signature) return undefined
  if (!await crypto.subtle.verify('HMAC', await key(secret), signature, payload)) return undefined
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(payload))
  } catch {
    return undefined
  }
  const session = payloadSchema.safeParse(parsed)
  return session.success && session.data.exp * 1000 > now ? session.data.sid : undefined
}

export async function handleSession(request: Request, env: Env): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid' }, 400)
  }
  const parsed = sessionRequestSchema.safeParse(body)
  if (!parsed.success) return json({ error: 'invalid' }, 400)

  const form = new FormData()
  form.append('secret', env.TURNSTILE_SECRET)
  form.append('response', parsed.data.turnstileToken)
  const ip = request.headers.get('CF-Connecting-IP')
  if (ip) form.append('remoteip', ip)

  let verdict: z.infer<typeof siteverifySchema>
  try {
    const response = await fetch(SITEVERIFY, { method: 'POST', body: form })
    verdict = siteverifySchema.parse(await response.json())
  } catch {
    return json({ error: 'unavailable' }, 502)
  }
  // Turnstile's test keys (development only) report no action; real tokens must carry ours.
  const actionOk = verdict.action === 'session' || verdict.metadata?.result_with_testing_key === true
  if (!verdict.success || verdict.hostname !== env.SITE_HOSTNAME || !actionOk) {
    return json({ error: 'session' }, 401)
  }

  const sid = [...crypto.getRandomValues(new Uint8Array(16))].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  const exp = Math.floor(Date.now() / 1000) + LIFETIME_SECONDS
  const cookie = `${COOKIE}=${await signSession(env.SESSION_KEY, sid, exp)}; Path=/api; Max-Age=${String(LIFETIME_SECONDS)}; HttpOnly; Secure; SameSite=Strict`
  return json({ expiresAt: new Date(exp * 1000).toISOString() }, 200, { 'Set-Cookie': cookie })
}
