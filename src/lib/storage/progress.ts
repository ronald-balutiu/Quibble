import { z } from 'zod'
import type { GameId } from '@shared/games'
import type { RunState } from '@/games/oddly-specific/reducer'

// Progress per puzzle (plan 3.8): the best score and one in-progress run. Every
// call is wrapped, so the game still plays when storage is blocked or full.
// Saved data that no longer fits the shape is discarded, never migrated (1.1).

const guess = z.strictObject({ answer: z.string(), pass: z.boolean(), failed: z.array(z.string()), closeCall: z.boolean() })
const round = z.strictObject({
  status: z.enum(['playing', 'solved', 'lost', 'skipped']),
  guesses: z.array(guess),
  strikes: z.int().min(0),
  pending: z.boolean(),
  overruled: z.boolean(),
  points: z.int().min(0),
})
const progressSchema = z.strictObject({
  best: z.int().min(0).optional(),
  run: z.strictObject({ current: z.int().min(0), rounds: z.array(round), finished: z.boolean() }).optional(),
})
export type Progress = z.infer<typeof progressSchema>

const key = (game: GameId, n: number) => `quibble:progress:${game}:${String(n)}`

function storage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

// Whether this browser will keep progress; false shows the storage.off strip.
export function isStorageAvailable(): boolean {
  const store = storage()
  if (!store) return false
  try {
    store.setItem('quibble:probe', '1')
    store.removeItem('quibble:probe')
    return true
  } catch {
    return false
  }
}

export function loadProgress(game: GameId, n: number): Progress {
  try {
    const raw = storage()?.getItem(key(game, n))
    if (!raw) return {}
    const parsed = progressSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

function save(game: GameId, n: number, progress: Progress): boolean {
  try {
    storage()?.setItem(key(game, n), JSON.stringify(progress))
    return storage() !== undefined
  } catch {
    return false
  }
}

// Saves the run in progress, or on finishing clears it and keeps the best score.
export function saveRun(game: GameId, n: number, run: RunState, score: number): boolean {
  const { best } = loadProgress(game, n)
  if (!run.finished) return save(game, n, best === undefined ? { run } : { best, run })
  return save(game, n, { best: Math.max(best ?? 0, score) })
}

export function resetPuzzle(game: GameId, n: number): boolean {
  try {
    storage()?.removeItem(key(game, n))
    return true
  } catch {
    return false
  }
}

const PREFIX = 'quibble:progress:'
const progressKeys = (store: Storage) => Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => k?.startsWith(PREFIX) ?? false)

// L3 "Your data": how many puzzles have saved progress, and how many runs are open.
export function progressSummary(): { puzzles: number, open: number } {
  try {
    const store = globalThis.localStorage
    const saved = progressKeys(store).map((k) => progressSchema.safeParse(JSON.parse(store.getItem(k) ?? 'null')))
    return { puzzles: saved.length, open: saved.filter((p) => p.success && p.data.run !== undefined).length }
  } catch {
    return { puzzles: 0, open: 0 }
  }
}

// "Clear game data": every puzzle's best score and open run.
export function clearGameData(): void {
  try {
    const store = globalThis.localStorage
    for (const k of progressKeys(store)) store.removeItem(k)
  } catch {
    // Nothing to clear.
  }
}
