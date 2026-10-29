import { judgeErrorSchema, judgeSuccessSchema, type JudgeRequest, type JudgeSuccess } from '@shared/schemas/judge'

// One cloud-judged guess (plan 3.7, 3.12), with a hard 10-second limit so nothing
// arrives after the guess is over. Phase 2 has only the cloud judge.

export const JUDGE_TIMEOUT_MS = 10_000

export type CloudMessage = 'judge.cloud.timeout' | 'judge.cloud.unreachable' | 'net.offline' | 'session.botcheck'

export type CloudOutcome =
  | { kind: 'judged', result: JudgeSuccess }
  | { kind: 'busy', retryAfter: number }
  | { kind: 'resting', resetAt: string }
  | { kind: 'invalid' }
  | { kind: 'error', message: CloudMessage }

// Renews the session with a fresh Turnstile token: 'ok', or why it couldn't.
export type RenewSession = () => Promise<'ok' | 'botcheck' | 'error'>

export interface AttemptDeps {
  fetch?: typeof fetch
  isOnline?: () => boolean
  timeoutMs?: number
  now?: () => Date
}

const nextUtcMidnight = (now: Date) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}

export async function judgeOnCloud(
  request: JudgeRequest,
  renewSession: RenewSession,
  { fetch: fetchImpl = fetch, isOnline = () => navigator.onLine, timeoutMs = JUDGE_TIMEOUT_MS, now = () => new Date() }: AttemptDeps = {},
): Promise<CloudOutcome> {
  const signal = AbortSignal.timeout(timeoutMs)
  const send = () => fetchImpl('/api/judge', {
    method: 'POST', body: JSON.stringify(request), headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', signal,
  })

  try {
    let response = await send()
    if (response.status === 401) {
      const renewed = await renewSession()
      if (renewed === 'botcheck') return { kind: 'error', message: 'session.botcheck' }
      if (renewed === 'error') return { kind: 'error', message: 'judge.cloud.unreachable' }
      response = await send()
    }

    const body = await readJson(response)
    if (response.ok) {
      const success = judgeSuccessSchema.safeParse(body)
      return success.success && success.data.attempt === request.attempt
        ? { kind: 'judged', result: success.data }
        : { kind: 'error', message: 'judge.cloud.unreachable' }
    }

    const failure = judgeErrorSchema.safeParse(body)
    // The platform's own 429 at the daily Worker request cap isn't our JSON: treat it as resting.
    if (response.status === 429 && !failure.success) return { kind: 'resting', resetAt: nextUtcMidnight(now()) }
    if (!failure.success) return { kind: 'error', message: 'judge.cloud.unreachable' }
    switch (failure.data.error) {
      case 'busy': return { kind: 'busy', retryAfter: failure.data.retryAfter ?? 60 }
      case 'resting': return { kind: 'resting', resetAt: failure.data.resetAt ?? nextUtcMidnight(now()) }
      case 'invalid': return { kind: 'invalid' }
      case 'session': return { kind: 'error', message: 'judge.cloud.unreachable' }
      case 'unknown':
      case 'unavailable': return { kind: 'error', message: 'judge.cloud.unreachable' }
    }
  } catch {
    if (signal.aborted) return { kind: 'error', message: 'judge.cloud.timeout' }
    return { kind: 'error', message: isOnline() ? 'judge.cloud.unreachable' : 'net.offline' }
  }
}
