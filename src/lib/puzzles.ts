import { cachedLoader } from './cached-loader'
import type { GameId } from '@shared/games'
import { puzzleIndexSchema, puzzleSchema, type Puzzle, type PuzzleIndex } from '@shared/schemas/puzzle'

// Loads the static player-facing puzzle files. Undefined means missing or invalid.

async function load<T>(url: string, parse: (value: unknown) => T | undefined): Promise<T | undefined> {
  try {
    const response = await fetch(url)
    return response.ok ? parse(await response.json()) : undefined
  } catch {
    return undefined
  }
}

export const loadPuzzleIndex = cachedLoader<PuzzleIndex>(() =>
  load('/puzzles/index.json', (value) => puzzleIndexSchema.safeParse(value).data),
)

export type PuzzleLoad = { kind: 'loaded'; puzzle: Puzzle } | { kind: 'missing' | 'error' }

export async function loadPuzzle(game: GameId, n: number): Promise<PuzzleLoad> {
  try {
    const response = await fetch(`/puzzles/${game}/${String(n)}.json`)
    if (response.status === 404) return { kind: 'missing' }
    if (!response.ok) return { kind: 'error' }
    const puzzle = puzzleSchema.safeParse(await response.json()).data
    return puzzle?.game === game && puzzle.n === n ? { kind: 'loaded', puzzle } : { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}
