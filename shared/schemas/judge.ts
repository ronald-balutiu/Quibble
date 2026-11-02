import { z } from 'zod'
import { gameIds } from '../games'

// API contracts shared by the browser and the Worker (plan 3.4).

// The player's cloud judge: Clef-flash by default, Gemma 4 for more accuracy (D-66, D-67).
export const cloudModels = ['clef-flash', 'gemma-4'] as const
export type CloudModel = (typeof cloudModels)[number]
export const defaultCloudModel: CloudModel = 'clef-flash'

const id = z.string().regex(/^[\w.:#-]{1,100}$/u)

export const judgeRequestSchema = z.strictObject({
  game: z.enum(gameIds),
  n: z.int().min(1),
  roundId: id,
  level: z.int().min(1).optional(),
  answer: z.string().min(1).max(200),
  attempt: z.int().min(0),
  model: z.enum(cloudModels).optional(),
})
export type JudgeRequest = z.infer<typeof judgeRequestSchema>

const probability = z.number().min(0).max(1)

export const judgeSuccessSchema = z.strictObject({
  attempt: z.int().min(0),
  conditions: z.record(id, z.strictObject({ pass: z.boolean(), p: probability })),
  // The model that judged (D-66): every guess goes to the model (D-72).
  model: z.enum(cloudModels),
  modelMs: z.number().min(0),
})
export type JudgeSuccess = z.infer<typeof judgeSuccessSchema>

const judgeErrorCodes = ['invalid', 'unknown', 'session', 'busy', 'resting', 'unavailable'] as const

export const judgeErrorSchema = z.strictObject({
  attempt: z.int().min(0).optional(),
  error: z.enum(judgeErrorCodes),
  retryAfter: z.int().min(0).optional(),
  resetAt: z.iso.datetime().optional(),
})
export type JudgeError = z.infer<typeof judgeErrorSchema>

// GET /api/reveal/:game/:n/:roundId: the example plus up to two more known answers,
// or for Category Escape the confirmed path.
export const revealSchema = z.strictObject({
  example: z.string().min(1),
  also: z.array(z.string().min(1)).max(2),
  path: z.array(z.string().min(1)).optional(),
})
export type Reveal = z.infer<typeof revealSchema>
