import type { Puzzle, PuzzleCondition } from '@shared/schemas/puzzle'
import { format } from '@/copy/en'

export const levelCode = (index: number) => format('escape.level', { n: String(index + 1).padStart(2, '0') })
// The rule a level adds: its last condition (level 1's is the category).
export const ruleOf = (puzzle: Puzzle, index: number): PuzzleCondition | undefined => puzzle.rounds[index]?.conditions.at(-1)
export const ruleText = (puzzle: Puzzle, index: number) => {
  const label = ruleOf(puzzle, index)?.label ?? ''
  return index === 0 ? label : format('escape.adds', { rule: label })
}

