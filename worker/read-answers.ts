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

type ReadAnswersResult =
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

// Gemma 4 (D-62): P(yes) from the first generated token's top logprobs, the shape
// both Gemma backends returned in the Phase 0 fixtures. Undefined when unreadable.
const gemmaSchema = z.object({
  choices: z.array(z.object({
    logprobs: z.object({
      content: z.array(z.object({ top_logprobs: z.array(z.object({ token: z.string(), logprob: z.number() })) })).min(1),
    }),
  })).min(1),
})

const yesTokens = new Set(['yes', 'YES', 'Yes'])
const noTokens = new Set(['no', 'NO', 'No'])

export function readGemma(response: unknown): number | undefined {
  const parsed = gemmaSchema.safeParse(response)
  const top = parsed.success ? parsed.data.choices[0]?.logprobs.content[0]?.top_logprobs : undefined
  if (!top) return undefined
  const mass = (tokens: Set<string>) => top.filter(({ token }) => tokens.has(token.trim())).reduce((sum, { logprob }) => sum + Math.exp(logprob), 0)
  const yes = mass(yesTokens)
  const no = mass(noTokens)
  return yes + no > 0 ? yes / (yes + no) : undefined
}
