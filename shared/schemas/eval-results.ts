import { z } from 'zod'

// public/eval/results.json (plan 3.10): the answer-key numbers the app shows in
// "How the judges compare" and on /about, built by eval/publish.ts from
// eval/history.json and eval/device-measurements.json. Rates are 0–1.

const interval = z.strictObject({ value: z.number(), low: z.number(), high: z.number(), n: z.int().min(0) })
export const resultsJudges = ['clef-flash', 'gemma-4', 'device'] as const
export type ResultsJudge = (typeof resultsJudges)[number]

const judgeResult = z.strictObject({
  model: z.string(),
  backend: z.string(),
  threshold: z.number(),
  perCondition: interval,
  wholeGuess: interval,
  falseAcceptRate: interval,
  falseRejectRate: interval,
  brier: z.number(),
  medianMs: z.number(),
  neuronsPerGuess: z.number().optional(),
})

export const evalResultsSchema = z.strictObject({
  target: z.strictObject({ wholeGuess: z.number(), falseAcceptRate: z.number() }),
  // The held-out test split, run once on the final setup.
  test: z.strictObject({ date: z.string(), cases: z.int(), judges: z.partialRecord(z.enum(resultsJudges), judgeResult) }),
  // Development runs: the iteration story. Build n is the nth tuning change.
  builds: z.array(z.strictObject({ build: z.int().min(1), date: z.string(), note: z.string(), wholeGuess: z.partialRecord(z.enum(resultsJudges), z.number()) })),
  devices: z.array(z.strictObject({
    machine: z.string(), browser: z.string(), measuredAt: z.string(), coldLoadSeconds: z.number(),
    firstGuessMs: z.number(), warmGuessMedianMs: z.number(), warmGuessP95Ms: z.number(), guesses: z.int(),
    browserMemoryMb: z.strictObject({ before: z.number(), peak: z.number(), warm: z.number() }),
    cancelMs: z.number(), turnOffMs: z.number(),
  })),
})
export type EvalResults = z.infer<typeof evalResultsSchema>
