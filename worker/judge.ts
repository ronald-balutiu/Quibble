import { readAnswers, type ClefModel } from './read-answers'

// Asks Clef or Clef-flash one yes/no question per condition (plan 3.5). The answer
// is only ever data inside state, never part of a question.

export interface AiRunner {
  run(model: string, inputs: unknown, options?: { signal?: AbortSignal }): Promise<unknown>
}

export interface JudgeQuestion { id: string, question: string }

export type CloudVerdict =
  | { ok: true, scores: Record<string, number>, modelMs: number }
  | { ok: false, error: 'resting' | 'unavailable' }

export interface JudgeOptions {
  model?: ClefModel
  timeoutMs?: number
  retryDelayMs?: number
  sleep?: (ms: number) => Promise<void>
}

// Workers AI error codes (developers.cloudflare.com/workers-ai/platform/errors/).
// 3036 is the documented daily-allowance code; D-58 still requires it to be
// confirmed against a live response before the usage handling ships.
const DAILY_ALLOWANCE = 3036
const TIMEOUT_CODES = new Set([3007, 3008])

function errorCode(error: unknown): number | undefined {
  const match = error instanceof Error ? /^(\d{4}):/u.exec(error.message) : null
  return match?.[1] === undefined ? undefined : Number(match[1])
}

function isTimeout(error: unknown): boolean {
  return (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
    || TIMEOUT_CODES.has(errorCode(error) ?? 0)
}

export async function judgeWithClef(
  ai: AiRunner,
  answer: string,
  questions: readonly JudgeQuestion[],
  { model = 'clef-flash', timeoutMs = 4000, retryDelayMs = 300, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: JudgeOptions = {},
): Promise<CloudVerdict> {
  const inputs = {
    model,
    state: { game: 'word game', playerAnswer: answer },
    questions: Object.fromEntries(questions.map(({ id, question }) => [id, { type: 'noul', instructions: question }])),
  }
  const ids = questions.map(({ id }) => id)

  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs)
    const started = Date.now()
    try {
      const response = await ai.run(`@cf/cloudflare/${model}`, inputs, { signal: AbortSignal.timeout(timeoutMs) })
      const read = readAnswers(response, model, ids)
      return read.ok ? { ok: true, scores: read.scores, modelMs: Date.now() - started } : { ok: false, error: 'unavailable' }
    } catch (error) {
      const code = errorCode(error)
      if (code === DAILY_ALLOWANCE) return { ok: false, error: 'resting' }
      // Retry once on a timeout or an uncoded (upstream) failure only; usage, auth
      // and validation errors carry a code and are not retried.
      if (!isTimeout(error) && code !== undefined) return { ok: false, error: 'unavailable' }
    }
  }
  return { ok: false, error: 'unavailable' }
}
