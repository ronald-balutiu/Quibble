import { z } from 'zod'
import { storageSignal } from './signal'
import type { GameId } from '@shared/games'
import type { RunState } from '@/games/rounds/reducer'

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

// An untouched run should not show a Continue action in the Library.
export function hasProgressActivity({ best, run }: Progress): boolean {
  return best !== undefined || (run?.rounds.some((r) => r.guesses.length > 0 || r.status !== 'playing') ?? false)
}

const PREFIX = 'quibble:progress:'
export const progressChanges = storageSignal((key) => key.startsWith(PREFIX))

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

function parseProgress(raw: string | null | undefined): Progress | undefined {
  try {
    return raw ? progressSchema.safeParse(JSON.parse(raw)).data : undefined
  } catch {
    return undefined
  }
}

export function loadProgress(game: GameId, n: number): Progress {
  try {
    return parseProgress(storage()?.getItem(key(game, n))) ?? {}
  } catch {
    return {}
  }
}

function save(game: GameId, n: number, progress: Progress): boolean {
  try {
    const store = storage()
    if (!store) return false
    store.setItem(key(game, n), JSON.stringify(progress))
    progressChanges.notify()
    return true
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
    const store = storage()
    if (!store) return false
    store.removeItem(key(game, n))
    progressChanges.notify()
    return true
  } catch {
    return false
  }
}

const progressKeys = (store: Storage) => Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => k?.startsWith(PREFIX) ?? false)

// L3 "Your data": how many puzzles have saved progress, and how many runs are open.
export function progressSummary(): { puzzles: number, open: number } {
  try {
    const store = globalThis.localStorage
    const saved = progressKeys(store).flatMap((k) => {
      const value = parseProgress(store.getItem(k))
      return value ? [value] : []
    })
    return { puzzles: saved.length, open: saved.filter((p) => p.run !== undefined).length }
  } catch {
    return { puzzles: 0, open: 0 }
  }
}

// "Clear game data": every puzzle's best score and open run.
export function clearGameData(): void {
  try {
    const store = globalThis.localStorage
    for (const k of progressKeys(store)) store.removeItem(k)
    progressChanges.notify()
  } catch {
    // Nothing to clear.
  }
}
