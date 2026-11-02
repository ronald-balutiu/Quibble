import { z } from 'zod'
import { gameIds } from '../games'

// Player-facing puzzle files, served statically (plan 3.2):
// public/puzzles/index.json and public/puzzles/<game>/<n>.json.

export const difficulties = ['easy', 'medium', 'hard'] as const

const puzzleConditionSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  // "doesn't fit in a pocket": the rejected sentence reads "It {negation}." (5.7).
  negation: z.string().min(1),
  claim: z.string().includes('{answer}'),
})
export type PuzzleCondition = z.infer<typeof puzzleConditionSchema>

export const puzzleSchema = z.strictObject({
  game: z.enum(gameIds),
  n: z.int().min(1),
  difficulty: z.enum(difficulties),
  rounds: z.array(z.strictObject({ id: z.string().regex(/^(?:r|L)\d+$/u), conditions: z.array(puzzleConditionSchema).min(1) })).min(1),
})
export type Puzzle = z.infer<typeof puzzleSchema>

export const puzzleIndexSchema = z.partialRecord(z.enum(gameIds), z.array(z.strictObject({ n: z.int().min(1), difficulty: z.enum(difficulties) })))
export type PuzzleIndex = z.infer<typeof puzzleIndexSchema>
