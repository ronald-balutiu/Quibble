import { z } from 'zod'

// Reads a Clef or Clef-flash System One response (the shape recorded in
// tests/fixtures/clef/). Each noul score is the probability the answer is "yes".
// Anything else is unreadable: it never searches the response for a number.

export type ClefModel = 'clef' | 'clef-flash'

const noulAnswer = z.strictObject({ type: z.literal('noul'), noul: z.number().min(0).max(1) })

const responseSchema = z.object({
  model: z.enum(['clef', 'clef-flash']),
  answers: z.record(z.string(), noulAnswer),
  usage: z.object({ input_tokens: z.int().min(0) }).optional(),
})

export type ReadAnswersResult =
  | { ok: true, scores: Record<string, number>, inputTokens?: number }
  | { ok: false }

export function readAnswers(response: unknown, model: ClefModel, questionIds: readonly string[]): ReadAnswersResult {
  const parsed = responseSchema.safeParse(response)
  if (!parsed.success || parsed.data.model !== model) return { ok: false }

  const { answers, usage } = parsed.data
  const ids = Object.keys(answers)
  if (ids.length !== questionIds.length || !questionIds.every((id) => Object.hasOwn(answers, id))) {
    return { ok: false }
  }

  const scores = Object.fromEntries(questionIds.map((id) => [id, answers[id]?.noul ?? Number.NaN]))
  if (!Object.values(scores).every(Number.isFinite)) return { ok: false }
  return usage ? { ok: true, scores, inputTokens: usage.input_tokens } : { ok: true, scores }
}
