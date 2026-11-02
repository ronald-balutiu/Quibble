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

export const loadPuzzleIndex = cachedLoader<PuzzleIndex>(() => load('/puzzles/index.json', (value) => puzzleIndexSchema.safeParse(value).data))

export function loadPuzzle(game: GameId, n: number): Promise<Puzzle | undefined> {
  return load(`/puzzles/${game}/${String(n)}.json`, (value) => {
    const puzzle = puzzleSchema.safeParse(value).data
    return puzzle?.game === game && puzzle.n === n ? puzzle : undefined
  })
}
