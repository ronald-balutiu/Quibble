import { z } from 'zod'
import { gameIds } from '../games'

// Answer-key cases (plan 3.10): whole guesses with a hand-checked verdict per
// condition. Thing conditions refer to factory/conditions.json; Double Agent
// clues carry their own text.

export const caseKinds = [
  'clear', 'one-fail', 'multi-fail', 'ambiguous', 'borderline',
  'polysemy', 'misspelling', 'gibberish', 'instruction',
] as const

export const expectedLabels = ['yes', 'no', 'unsure'] as const
export type ExpectedLabel = (typeof expectedLabels)[number]

const caseCondition = z.strictObject({
  id: z.string().regex(/^(?:[a-z]+|clue:[a-z'-]+#\d)$/u),
  clue: z.string().min(1).optional(),
  expected: z.enum(expectedLabels),
})

export const answerKeyCaseSchema = z.strictObject({
  id: z.string().regex(/^[a-z]{2}-\d{2}-\d+$/u),
  game: z.enum(gameIds),
  group: z.string().regex(/^[a-z]{2}-\d{2}$/u),
  answer: z.string().min(1),
  kind: z.enum(caseKinds),
  level: z.int().min(1).optional(),
  conditions: z.array(caseCondition).min(1),
  reviewed: z.boolean(),
}).refine(
  (c) => c.conditions.every((condition) => condition.id.startsWith('clue:') === (condition.clue !== undefined)),
  { message: 'Clue conditions, and only clue conditions, carry clue text.' },
)
export type AnswerKeyCase = z.infer<typeof answerKeyCaseSchema>

export const answerKeySchema = z.array(answerKeyCaseSchema)
