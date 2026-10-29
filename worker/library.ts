import { z } from 'zod'
import { gameIds, type GameId } from '@shared/games'

// The server-only library bundled into the Worker (plan 3.2): per puzzle, each
// round's conditions, known answers and example, plus Category Escape's path.
// Questions are the model wording for every condition ID, including clues.

const round = z.strictObject({
  conditions: z.array(z.string().min(1)).min(1),
  known: z.array(z.string().min(1)),
  example: z.string().min(1),
})
export type LibraryRound = z.infer<typeof round>

const puzzle = z.strictObject({
  rounds: z.record(z.string().regex(/^(?:r|L)\d+$/u), round),
  path: z.array(z.string().min(1)).optional(),
})

export const librarySchema = z.strictObject({
  puzzles: z.partialRecord(z.enum(gameIds), z.record(z.string().regex(/^\d+$/u), puzzle)),
  questions: z.record(z.string().min(1), z.string().min(1)),
  aliases: z.record(z.string().min(1), z.string().min(1)),
})
export type Library = z.infer<typeof librarySchema>

export function findRound(library: Library, game: GameId, n: number, roundId: string): LibraryRound | undefined {
  return library.puzzles[game]?.[String(n)]?.rounds[roundId]
}

export function findPath(library: Library, game: GameId, n: number): string[] | undefined {
  return library.puzzles[game]?.[String(n)]?.path
}
