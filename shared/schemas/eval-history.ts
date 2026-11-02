import { z } from 'zod'

// One entry per `npm run eval` run, appended to eval/history.json (plan 3.10).

const interval = z.strictObject({ value: z.number(), low: z.number(), high: z.number(), n: z.int().min(0) })

const evalRunSchema = z.strictObject({
  date: z.iso.datetime(),
  split: z.enum(['dev', 'test']),
  judge: z.enum(['clef-flash', 'clef', 'gemma-4', 'device']),
  model: z.string().min(1),
  precision: z.string().min(1),
  backend: z.string().min(1),
  n: z.int().min(1),
  reviewed: z.int().min(0),
  caseSetHash: z.string().regex(/^[0-9a-f]{64}$/u),
  threshold: z.number().min(0).max(1),
  note: z.string().min(1),
  metrics: z.strictObject({
    conditions: z.strictObject({
      n: z.int().min(0), accuracy: interval, falseAccepts: z.int().min(0), falseRejects: z.int().min(0), brier: z.number(),
    }),
    guesses: z.strictObject({ n: z.int().min(0), accuracy: interval, falseAcceptRate: interval, falseRejectRate: interval }),
    reliability: z.array(z.strictObject({ bin: z.int(), n: z.int().min(0), meanP: z.number().nullable(), observed: z.number().nullable() })),
    latencyMs: z.strictObject({ median: z.number(), p95: z.number() }),
    neuronsPerGuess: z.number().min(0).optional(),
  }),
  kappa: z.record(z.string(), z.number()).optional(),
})
export type EvalRun = z.infer<typeof evalRunSchema>

export const evalHistorySchema = z.array(evalRunSchema)
