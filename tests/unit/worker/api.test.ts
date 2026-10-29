import { afterEach, describe, expect, test, vi } from 'vitest'
import type { Env } from '../../../worker/env'
import type { AiRunner } from '../../../worker/judge'
import { nextUtcMidnight } from '../../../worker/judge-route'
import type { Library } from '../../../worker/library'
import { route } from '../../../worker/index'
import { readSession, signSession } from '../../../worker/session'
import clefFlash from '../../fixtures/clef/clef-flash-success.json'
import gemma from '../../fixtures/clef/gemma-4-success.json'

const SESSION_KEY = 'test-session-key'
const library: Library = {
  puzzles: {
    'oddly-specific': { 1: { rounds: { r1: { conditions: ['pocket', 'secure', 'nonelec'], known: ['safety pin', 'paper clip', 'zip tie'], example: 'safety pin' } } } },
    'category-escape': { 2: { rounds: { L1: { conditions: ['kitchen'], known: ['apple'], example: 'apple' } }, path: ['apple', 'toaster'] } },
  },
  questions: Object.fromEntries(Object.entries(clefFlash.request.questions).map(([id, q]) => [id, q.instructions])),
  aliases: { 'pocketknife': 'pocket knife' },
}

// Bindings plus their spies, so tests can check what was called.
function env(ai: AiRunner['run'] = () => Promise.resolve(clefFlash.response.body.result), limited = false) {
  const run = vi.fn<AiRunner['run']>(ai)
  const limit = vi.fn(() => Promise.resolve({ success: !limited }))
  const bindings: Env = { AI: { run }, JUDGE_LIMIT: { limit }, TURNSTILE_SECRET: 'turnstile-secret', SESSION_KEY, SITE_HOSTNAME: 'quibble.example' }
  return Object.assign(bindings, { run, limit })
}

async function cookie(exp = Math.floor(Date.now() / 1000) + 3600) {
  return `quibble_session=${await signSession(SESSION_KEY, '0123456789abcdef0123456789abcdef', exp)}`
}

async function judge(body: unknown, e = env(), headers: Record<string, string> = {}) {
  const request = new Request('https://quibble.example/api/judge', {
    method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { Cookie: await cookie(), ...headers },
  })
  const response = await route(request, e, () => library)
  return { status: response.status, body: await response.json<Record<string, unknown>>() }
}

const guess = { game: 'oddly-specific', n: 1, roundId: 'r1', answer: 'A Pocket Knife!', attempt: 3 }

afterEach(() => { vi.unstubAllGlobals() })

describe('POST /api/session', () => {
  const session = (token: unknown) => route(new Request('https://quibble.example/api/session', { method: 'POST', body: JSON.stringify({ turnstileToken: token }) }), env())
  const siteverify = (reply: object) => vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(Response.json(reply))))

  test('sets a signed HttpOnly cookie after a valid Turnstile token', async () => {
    siteverify({ success: true, hostname: 'quibble.example', action: 'session' })
    const response = await session('token')
    const setCookie = response.headers.get('Set-Cookie') ?? ''

    expect(response.status).toBe(200)
    expect(setCookie).toMatch(/^quibble_session=[\w-]+\.[\w-]+; Path=\/api; Max-Age=7200; HttpOnly; Secure; SameSite=Strict$/u)
    const sid = await readSession(new Request('https://x', { headers: { Cookie: setCookie.split(';')[0] ?? '' } }), SESSION_KEY)
    expect(sid).toMatch(/^[0-9a-f]{32}$/u)
  })

  test.each([
    ['a failed check', { success: false }],
    ['another hostname', { success: true, hostname: 'evil.example', action: 'session' }],
    ['another action', { success: true, hostname: 'quibble.example', action: 'login' }],
  ])('rejects %s', async (_name, reply) => {
    siteverify(reply)
    expect((await session('token')).status).toBe(401)
  })

  test("accepts Turnstile's test-key result, which carries no action", async () => {
    siteverify({ success: true, hostname: 'quibble.example', metadata: { result_with_testing_key: true } })
    expect((await session('token')).status).toBe(200)
  })

  test('rejects a missing token without calling Turnstile', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await session('')).status).toBe(400)
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('session cookies', () => {
  test('reject tampering, the wrong key and expiry', async () => {
    const valid = await cookie()
    const request = (value: string) => new Request('https://x', { headers: { Cookie: value } })
    expect(await readSession(request(valid), SESSION_KEY)).toBeDefined()
    expect(await readSession(request(`${valid.slice(0, -2)}xx`), SESSION_KEY)).toBeUndefined()
    expect(await readSession(request(valid), 'other-key')).toBeUndefined()
    expect(await readSession(request(await cookie(Math.floor(Date.now() / 1000) - 1)), SESSION_KEY)).toBeUndefined()
  })
})

describe('POST /api/judge', () => {
  test('judges with Clef-flash by default, sending the normalized answer as data', async () => {
    const e = env()
    const { status, body } = await judge(guess, e)

    expect(status).toBe(200)
    expect(body).toMatchObject({ attempt: 3, source: 'model', model: 'clef-flash', conditions: { pocket: { pass: true }, secure: { pass: false }, nonelec: { pass: true } } })
    const [model, inputs] = e.run.mock.calls[0] ?? []
    expect(model).toBe('@cf/cloudflare/clef-flash')
    expect(inputs).toMatchObject({ state: { playerAnswer: 'pocket knife' } })
  })

  test('judges with Gemma 4 when chosen, one parallel request per condition', async () => {
    const replies = gemma.calls.map((call) => call.response.body.result)
    let i = 0
    const e = env(() => Promise.resolve(replies[i++]))
    const { status, body } = await judge({ ...guess, model: 'gemma-4' }, e)

    expect(status).toBe(200)
    expect(body).toMatchObject({ source: 'model', model: 'gemma-4', conditions: { pocket: { pass: true }, secure: { pass: false }, nonelec: { pass: true } } })
    expect(e.run).toHaveBeenCalledTimes(3)
  })

  test('passes a known answer without a model call or the usage limit', async () => {
    const e = env(undefined, true)
    const { status, body } = await judge({ ...guess, answer: 'The Paper Clip' }, e)

    expect(status).toBe(200)
    expect(body).toEqual({ attempt: 3, source: 'known', conditions: { pocket: { pass: true }, secure: { pass: true }, nonelec: { pass: true } } })
    expect(e.run).not.toHaveBeenCalled()
    expect(e.limit).not.toHaveBeenCalled()
  })

  test('applies the alias map before judging', async () => {
    const e = env()
    await judge({ ...guess, answer: 'Pocketknife' }, e)
    expect(e.run.mock.calls[0]?.[1]).toMatchObject({ state: { playerAnswer: 'pocket knife' } })
  })

  test.each([
    ['no session', {}, 401, 'session'],
    ['a body over 2 KB', { answer: 'x'.repeat(3000) }, 413, 'invalid'],
    ['a bad schema', { n: 'one' }, 400, 'invalid'],
    ['an unknown round', { roundId: 'r9' }, 404, 'unknown'],
    ['an answer over 40 characters', { answer: 'x'.repeat(41) }, 400, 'invalid'],
  ])('rejects %s', async (name, change, status, code) => {
    const e = env()
    const headers: Record<string, string> = name === 'no session' ? { Cookie: '' } : {}
    const result = await judge({ ...guess, ...change }, e, headers)
    expect(result.status).toBe(status)
    expect(result.body.error).toBe(code)
    expect(e.run).not.toHaveBeenCalled()
  })

  test('returns busy with retryAfter when the per-minute limit is hit', async () => {
    const e = env(undefined, true)
    const { status, body } = await judge(guess, e)
    expect(status).toBe(429)
    expect(body).toEqual({ attempt: 3, error: 'busy', retryAfter: 60 })
    expect(e.run).not.toHaveBeenCalled()
  })

  test('returns resting with the next UTC midnight when the daily allowance is used up', async () => {
    const e = env(() => Promise.reject(Object.assign(new Error('3036: You have used up your daily free allocation.'), { name: 'AiError' })))
    const { status, body } = await judge(guess, e)
    expect(status).toBe(503)
    expect(body).toMatchObject({ error: 'resting', resetAt: nextUtcMidnight() })
  })

  test('returns unavailable for an unreadable model reply', async () => {
    const { status, body } = await judge(guess, env(() => Promise.resolve({ answers: {} })))
    expect(status).toBe(502)
    expect(body.error).toBe('unavailable')
  })
})

describe('GET /api/reveal', () => {
  const reveal = async (path: string) => {
    const response = await route(new Request(`https://quibble.example/api/reveal/${path}`), env(), () => library)
    return { status: response.status, body: await response.json<unknown>() }
  }

  test('returns the example plus up to two more known answers', async () => {
    expect(await reveal('oddly-specific/1/r1')).toEqual({ status: 200, body: { example: 'safety pin', also: ['paper clip', 'zip tie'] } })
  })

  test('includes the confirmed path for Category Escape', async () => {
    expect((await reveal('category-escape/2/L1')).body).toMatchObject({ path: ['apple', 'toaster'] })
  })

  test.each(['oddly-specific/1/r9', 'nope/1/r1', 'oddly-specific/x/r1'])('404s for %s', async (path) => {
    expect((await reveal(path)).status).toBe(404)
  })
})

test('nextUtcMidnight is the start of the next UTC day', () => {
  expect(nextUtcMidnight(new Date('2026-10-29T23:59:00Z'))).toBe('2026-10-30T00:00:00.000Z')
})
