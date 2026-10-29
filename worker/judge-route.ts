import { judgeConfig, passes } from '@shared/config'
import { isValidAnswer, normalizeAnswer } from '@shared/normalize'
import { defaultCloudModel, judgeRequestSchema, type JudgeError, type JudgeSuccess } from '@shared/schemas/judge'
import { json, type Env } from './env'
import { judgeWithClef, judgeWithGemma, type JudgeQuestion } from './judge'
import { findRound, type Library } from './library'
import { readSession } from './session'

// POST /api/judge (plan 3.4, D-72). Order: body size → session → schema and IDs →
// normalize → usage limit → model. Every answer is judged by the model; known
// answers are only used for the reveal.

const MAX_BODY_BYTES = 2048
const RETRY_AFTER_SECONDS = 60

const statusFor: Record<JudgeError['error'], number> = { invalid: 400, unknown: 404, session: 401, busy: 429, resting: 503, unavailable: 502 }

function error(code: JudgeError['error'], attempt: number | undefined, extra: Partial<JudgeError> = {}, status = statusFor[code]): Response {
  const body: JudgeError = attempt === undefined ? { error: code, ...extra } : { attempt, error: code, ...extra }
  return json(body, status)
}

// The daily allowance resets at the next 00:00 UTC.
export function nextUtcMidnight(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString()
}

export async function handleJudge(request: Request, env: Env, library: Library): Promise<Response> {
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return error('invalid', undefined, {}, 413)

  const sid = await readSession(request, env.SESSION_KEY)
  if (!sid) return error('session', undefined)

  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return error('invalid', undefined)
  }
  const parsed = judgeRequestSchema.safeParse(body)
  if (!parsed.success) return error('invalid', undefined)
  const { game, n, roundId, answer, attempt, model = defaultCloudModel } = parsed.data

  const round = findRound(library, game, n, roundId)
  if (!round) return error('unknown', attempt)

  const normalized = normalizeAnswer(answer, game, new Map(Object.entries(library.aliases)))
  if (!isValidAnswer(normalized, game)) return error('invalid', attempt)

  const { success } = await env.JUDGE_LIMIT.limit({ key: sid })
  if (!success) return error('busy', attempt, { retryAfter: RETRY_AFTER_SECONDS })

  const questions: JudgeQuestion[] = []
  for (const id of round.conditions) {
    const question = library.questions[id]
    if (!question) return error('unavailable', attempt)
    questions.push({ id, question })
  }

  const verdict = model === 'gemma-4'
    ? await judgeWithGemma(env.AI, normalized, questions)
    : await judgeWithClef(env.AI, normalized, questions, { model: 'clef-flash' })
  if (!verdict.ok) {
    return verdict.error === 'resting' ? error('resting', attempt, { resetAt: nextUtcMidnight() }) : error('unavailable', attempt)
  }

  const threshold = judgeConfig.passThreshold[model]
  const judged: JudgeSuccess = {
    attempt,
    model,
    modelMs: verdict.modelMs,
    conditions: Object.fromEntries(Object.entries(verdict.scores).map(([id, p]) => [id, { pass: passes(p, threshold), p }])),
  }
  return json(judged)
}
