import { z } from 'zod'
import { gameIds } from '../games'

// POST /api/judge contract shared by the browser and the Worker (plan 3.4).

const id = z.string().regex(/^[\w.:#-]{1,100}$/u)

export const judgeRequestSchema = z.strictObject({
  game: z.enum(gameIds),
  n: z.int().min(1),
  roundId: id,
  level: z.int().min(1).optional(),
  answer: z.string().min(1).max(200),
  attempt: z.int().min(0),
})
export type JudgeRequest = z.infer<typeof judgeRequestSchema>

const probability = z.number().min(0).max(1)

export const judgeSuccessSchema = z.strictObject({
  attempt: z.int().min(0),
  source: z.enum(['known', 'model']),
  // p is absent for known answers.
  conditions: z.record(id, z.strictObject({ pass: z.boolean(), p: probability.optional() })),
  modelMs: z.number().min(0).optional(),
})
export type JudgeSuccess = z.infer<typeof judgeSuccessSchema>

export const judgeErrorCodes = ['invalid', 'unknown', 'session', 'busy', 'resting', 'unavailable'] as const
export type JudgeErrorCode = (typeof judgeErrorCodes)[number]

export const judgeErrorSchema = z.strictObject({
  attempt: z.int().min(0).optional(),
  error: z.enum(judgeErrorCodes),
  retryAfter: z.int().min(0).optional(),
  resetAt: z.iso.datetime().optional(),
})
export type JudgeError = z.infer<typeof judgeErrorSchema>
