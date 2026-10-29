import { describe, expect, test, vi } from 'vitest'
import { judgeOnCloud, type RenewSession } from '@/judges/attempt'
import type { JudgeRequest } from '@shared/schemas/judge'

const request: JudgeRequest = { game: 'oddly-specific', n: 1, roundId: 'r1', answer: 'pocket knife', attempt: 4 }
const success = { attempt: 4, model: 'clef-flash', modelMs: 200, conditions: { pocket: { pass: true, p: 0.8 } } }
const ok: RenewSession = () => Promise.resolve('ok')
const reply = (status: number, body?: unknown) => Promise.resolve(body === undefined ? new Response('nope', { status }) : Response.json(body, { status }))

function run(fetchImpl: () => Promise<Response>, { renew = ok, online = true, timeoutMs = 1000 } = {}) {
  return judgeOnCloud(request, renew, { fetch: vi.fn(fetchImpl), isOnline: () => online, timeoutMs, now: () => new Date('2026-10-29T12:00:00Z') })
}

describe('judgeOnCloud', () => {
  test('returns the verdict', async () => {
    expect(await run(() => reply(200, success))).toEqual({ kind: 'judged', result: success })
  })

  test('treats a reply for another attempt as unreachable', async () => {
    expect(await run(() => reply(200, { ...success, attempt: 3 }))).toEqual({ kind: 'error', message: 'judge.cloud.unreachable' })
  })

  test('renews an expired session once, then resends', async () => {
    const fetchImpl = vi.fn().mockReturnValueOnce(reply(401, { error: 'session' })).mockReturnValueOnce(reply(200, success))
    const renew = vi.fn(ok)
    expect(await judgeOnCloud(request, renew, { fetch: fetchImpl })).toMatchObject({ kind: 'judged' })
    expect(renew).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  test.each([
    ['botcheck', 'session.botcheck'],
    ['error', 'judge.cloud.unreachable'],
  ] as const)('maps a %s renewal to %s', async (renewal, message) => {
    expect(await run(() => reply(401, { error: 'session' }), { renew: () => Promise.resolve(renewal) })).toEqual({ kind: 'error', message })
  })

  test.each([
    [429, { attempt: 4, error: 'busy', retryAfter: 60 }, { kind: 'busy', retryAfter: 60 }],
    [503, { attempt: 4, error: 'resting', resetAt: '2026-10-30T00:00:00.000Z' }, { kind: 'resting', resetAt: '2026-10-30T00:00:00.000Z' }],
    [400, { attempt: 4, error: 'invalid' }, { kind: 'invalid' }],
    [502, { attempt: 4, error: 'unavailable' }, { kind: 'error', message: 'judge.cloud.unreachable' }],
    [500, undefined, { kind: 'error', message: 'judge.cloud.unreachable' }],
  ])('maps HTTP %i', async (status, body, outcome) => {
    expect(await run(() => reply(status, body))).toEqual(outcome)
  })

  test("treats the platform's non-JSON 429 as resting until the next UTC midnight", async () => {
    expect(await run(() => reply(429))).toEqual({ kind: 'resting', resetAt: '2026-10-30T00:00:00.000Z' })
  })

  test('times out after the limit', async () => {
    const hang = () => new Promise<Response>((_, reject) => { setTimeout(() => { reject(new DOMException('aborted', 'TimeoutError')) }, 50) })
    expect(await run(hang, { timeoutMs: 10 })).toEqual({ kind: 'error', message: 'judge.cloud.timeout' })
  })

  test('distinguishes offline from unreachable on a network failure', async () => {
    const down = () => Promise.reject(new TypeError('Failed to fetch'))
    expect(await run(down, { online: false })).toEqual({ kind: 'error', message: 'net.offline' })
    expect(await run(down, { online: true })).toEqual({ kind: 'error', message: 'judge.cloud.unreachable' })
  })
})
