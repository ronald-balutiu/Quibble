import { describe, expect, test, vi } from 'vitest'
import { fetchReveal, startSession } from '@/lib/api'

const reply = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })))

describe('session (3.4)', () => {
  test('exchanges a Turnstile token for the session cookie', async () => {
    const fetch = reply(200, { ok: true })
    expect(await startSession('token', fetch as typeof globalThis.fetch)).toBe('ok')
    expect(fetch).toHaveBeenCalledWith('/api/session', expect.objectContaining({ method: 'POST', body: JSON.stringify({ turnstileToken: 'token' }), credentials: 'same-origin' }))
  })

  test('a failed bot check, a server error and a network failure are told apart', async () => {
    expect(await startSession('token', reply(401, {}) as typeof fetch)).toBe('botcheck')
    expect(await startSession('token', reply(500, {}) as typeof fetch)).toBe('error')
    expect(await startSession('token', (() => Promise.reject(new Error('offline'))))).toBe('error')
  })
})

describe('reveal (G4, G5)', () => {
  test('returns the example and other answers, with the path parts encoded', async () => {
    const fetch = reply(200, { example: 'sock', also: ['sweater'] })
    expect(await fetchReveal('oddly-specific', 7, 'r 1', fetch as typeof globalThis.fetch)).toEqual({ example: 'sock', also: ['sweater'] })
    expect(fetch).toHaveBeenCalledWith('/api/reveal/oddly-specific/7/r%201')
  })

  test('anything other than a valid reveal is no reveal', async () => {
    expect(await fetchReveal('oddly-specific', 7, 'r1', reply(404, {}) as typeof fetch)).toBeUndefined()
    expect(await fetchReveal('oddly-specific', 7, 'r1', reply(200, { example: 3 }) as typeof fetch)).toBeUndefined()
    expect(await fetchReveal('oddly-specific', 7, 'r1', (() => Promise.reject(new Error('offline'))))).toBeUndefined()
  })
})
