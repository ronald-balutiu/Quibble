import { readAnswers, readGemma, type ClefModel } from './read-answers'

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
// 3036 is the documented daily-allowance code, but a live response on 2026-10-30
// returned 4006 ("you have used up your daily free allocation"), so both count (D-58).
const DAILY_ALLOWANCE = new Set([3036, 4006])
const TIMEOUT_CODES = new Set([3007, 3008])

function errorCode(error: unknown): number | undefined {
  const match = error instanceof Error ? /^(\d{4}):/u.exec(error.message) : null
  return match?.[1] === undefined ? undefined : Number(match[1])
}

export function isDailyAllowance(error: unknown): boolean {
  return DAILY_ALLOWANCE.has(errorCode(error) ?? 0) || (error instanceof Error && /daily free allocation/iu.test(error.message))
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
      if (isDailyAllowance(error)) return { ok: false, error: 'resting' }
      // Retry once on a timeout or an uncoded (upstream) failure only; usage, auth
      // and validation errors carry a code and are not retried.
      if (!isTimeout(error) && code !== undefined) return { ok: false, error: 'unavailable' }
    }
  }
  return { ok: false, error: 'unavailable' }
}

// Gemma 4 (D-62): one chat request per condition, sent in parallel, reading P(yes)
// from the first token's logprobs. The prompt matches the answer-key eval exactly.
export const GEMMA_MODEL = '@cf/google/gemma-4-26b-a4b-it'

export function gemmaRequest(answer: string, question: string) {
  return {
    messages: [{ role: 'user', content: `The player answered: "${answer}".\n\n${question}\n\nAnswer with only YES or NO.` }],
    chat_template_kwargs: { enable_thinking: false },
    temperature: 0,
    max_completion_tokens: 1,
    logprobs: true,
    top_logprobs: 5,
  }
}

export async function judgeWithGemma(
  ai: AiRunner,
  answer: string,
  questions: readonly JudgeQuestion[],
  { timeoutMs = 4000, retryDelayMs = 300, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) }: Omit<JudgeOptions, 'model'> = {},
): Promise<CloudVerdict> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(retryDelayMs)
    const started = Date.now()
    try {
      const signal = AbortSignal.timeout(timeoutMs)
      const replies = await Promise.all(questions.map(({ question }) => ai.run(GEMMA_MODEL, gemmaRequest(answer, question), { signal })))
      const scores = replies.map(readGemma)
      if (!scores.every((p): p is number => p !== undefined)) return { ok: false, error: 'unavailable' }
      return { ok: true, scores: Object.fromEntries(questions.map(({ id }, i) => [id, scores[i] ?? 0])), modelMs: Date.now() - started }
    } catch (error) {
      const code = errorCode(error)
      if (isDailyAllowance(error)) return { ok: false, error: 'resting' }
      if (!isTimeout(error) && code !== undefined) return { ok: false, error: 'unavailable' }
    }
  }
  return { ok: false, error: 'unavailable' }
}
