import { z } from 'zod'
import { gameIds } from '@shared/games'
import { cloudModels } from '@shared/schemas/judge'

// Judge comparisons (plan 3.8): one record per guess both judges answered, kept in
// this browser only for "Your games". At most 2,000 records and 500 KB, each for
// 90 days; the oldest go first on each write. Every call is wrapped, so the game
// still plays when storage is blocked or full.

const KEY = 'quibble:comparisons'
export const COMPARISON_LIMITS = { records: 2_000, bytes: 500_000, days: 90 } as const
const DAY_MS = 24 * 60 * 60 * 1000

const probability = z.number().min(0).max(1)
const comparisonSchema = z.strictObject({
  at: z.number(),
  game: z.enum(gameIds),
  n: z.int().min(1),
  round: z.string(),
  answer: z.string(), // normalized
  // Each condition's two scores and verdicts.
  conditions: z.record(z.string(), z.strictObject({ cloud: probability, cloudPass: z.boolean(), device: probability, devicePass: z.boolean() })),
  cloudModel: z.enum(cloudModels),
  cloudMs: z.number().min(0), // end to end in the browser
  cloudModelMs: z.number().min(0), // the server's model call
  deviceMs: z.number().min(0),
  backend: z.literal('webgpu'),
  precision: z.literal('q4'),
  warm: z.boolean(), // false for the first guess after the model loads
  referee: z.enum(['cloud', 'device']),
  overruled: z.boolean(), // the player's "Count it anyway", kept apart from the judges' verdicts
})
export type Comparison = z.infer<typeof comparisonSchema>

function read(): Comparison[] {
  const raw = globalThis.localStorage.getItem(KEY)
  if (!raw) return []
  const list: unknown = JSON.parse(raw)
  if (!Array.isArray(list)) return []
  // A record that no longer fits the shape is dropped on its own (1.1).
  return list.flatMap((item) => {
    const parsed = comparisonSchema.safeParse(item)
    return parsed.success ? [parsed.data] : []
  })
}

function write(records: Comparison[], now: number): void {
  const fresh = records.filter((record) => now - record.at < COMPARISON_LIMITS.days * DAY_MS).slice(-COMPARISON_LIMITS.records)
  let json = JSON.stringify(fresh)
  while (fresh.length > 0 && json.length > COMPARISON_LIMITS.bytes) {
    fresh.shift()
    json = JSON.stringify(fresh)
  }
  globalThis.localStorage.setItem(KEY, json)
}

export function loadComparisons(now = Date.now()): Comparison[] {
  try {
    return read().filter((record) => now - record.at < COMPARISON_LIMITS.days * DAY_MS)
  } catch {
    return []
  }
}

export function saveComparison(record: Comparison, now = Date.now()): void {
  try {
    write([...read(), record], now)
  } catch {
    // Storage is off or full: the comparison is lost, the game carries on.
  }
}

// "Count it anyway" on a guess the judges already compared.
export function markOverruled(game: Comparison['game'], n: number, round: string, answer: string, now = Date.now()): void {
  try {
    const records = read()
    const record = records.findLast((r) => r.game === game && r.n === n && r.round === round && r.answer === answer)
    if (!record) return
    record.overruled = true
    write(records, now)
  } catch {
    // Nothing to mark.
  }
}
