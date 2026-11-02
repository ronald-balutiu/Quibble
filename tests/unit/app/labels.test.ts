import { describe, expect, test } from 'vitest'
import type { Puzzle } from '@shared/schemas/puzzle'
import { dateLabel, milliseconds, percent } from '@/components/JudgesCompare/format'
import { puzzleNumber } from '@/copy/en'
import { levelCode, ruleOf, ruleText } from '@/games/category-escape/labels'

describe('display formats', () => {
  test('puzzle numbers show three digits', () => {
    expect([1, 42, 100].map(puzzleNumber)).toEqual(['001', '042', '100'])
  })

  test('the comparison shows one decimal, whole milliseconds and UTC dates', () => {
    expect(percent(0.9315)).toBe('93.2%')
    expect(milliseconds(196.6)).toBe('197 ms')
    expect(milliseconds(1234.4)).toBe('1,234 ms')
    expect(milliseconds(undefined)).toBe('–')
    expect(dateLabel('2026-10-29T23:30:00.000Z')).toBe('Oct 29, 2026')
  })
})

describe('Category Escape labels (E1)', () => {
  const condition = (id: string, label: string) => ({ id, label, negation: `isn't ${label}`, claim: `{answer} is ${label}` })
  const puzzle = {
    game: 'category-escape', n: 1, difficulty: 'easy',
    rounds: [
      { id: 'L1', conditions: [condition('fruit', 'A fruit')] },
      { id: 'L2', conditions: [condition('fruit', 'A fruit'), condition('red', 'Red')] },
    ],
  } as unknown as Puzzle

  test('levels are numbered L-01 onwards, and each adds its last condition as a rule', () => {
    expect([0, 1, 9].map(levelCode)).toEqual(['L-01', 'L-02', 'L-10'])
    expect(ruleOf(puzzle, 1)?.id).toBe('red')
    expect(ruleText(puzzle, 0)).toBe('A fruit')
    expect(ruleText(puzzle, 1)).toBe('+ Red')
    expect(ruleOf(puzzle, 5)).toBeUndefined()
  })
})
