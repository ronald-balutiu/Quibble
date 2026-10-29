import { revealSchema, type Reveal } from '@shared/schemas/judge'

// Session and reveal calls. Judging lives in src/judges/attempt.ts.

export type SessionResult = 'ok' | 'botcheck' | 'error'

// Exchanges a Turnstile token for the session cookie.
export async function startSession(turnstileToken: string, fetchImpl: typeof fetch = fetch): Promise<SessionResult> {
  try {
    const response = await fetchImpl('/api/session', {
      method: 'POST', body: JSON.stringify({ turnstileToken }), headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    })
    if (response.ok) return 'ok'
    return response.status === 401 ? 'botcheck' : 'error'
  } catch {
    return 'error'
  }
}

export async function fetchReveal(game: string, n: number, roundId: string, fetchImpl: typeof fetch = fetch): Promise<Reveal | undefined> {
  try {
    const response = await fetchImpl(`/api/reveal/${encodeURIComponent(game)}/${String(n)}/${encodeURIComponent(roundId)}`)
    if (!response.ok) return undefined
    const parsed = revealSchema.safeParse(await response.json())
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}
