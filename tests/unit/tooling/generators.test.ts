import { describe, expect, test } from 'vitest'
import { truth, type Matrix } from '../../../factory/matrix'
import { knownAnswers, oddlySpecificRounds, seeded, shuffled } from '../../../factory/generators/rounds'

describe('truth matrix cells', () => {
  test.each([
    [{ flash: 0.9 }, 'yes'], [{ flash: 0.1 }, 'no'], [{ flash: 0.5 }, 'unknown'],
    [{ flash: 0.65 }, 'yes'], [{ flash: 0.5, gemma: 0.85 }, 'yes'], [{ flash: 0.9, gemma: 0.5 }, 'unknown'],
    [{ flash: 0.5, clef: 0.1 }, 'no'], [undefined, 'unknown'],
  ] as const)('%j is %s', (cell, expected) => {
    expect(truth(cell)).toBe(expected)
  })
})

describe('Oddly Specific generator', () => {
  const conditions = { a: { tag: 'size' }, b: { tag: 'use' }, c: { tag: 'power' }, d: { tag: 'power' } }
  const things = ['t1', 't2', 't3', 't4', 't5', 't6']
  const row = (a: number, b: number, c: number, d = 0.9) => ({ a: { flash: a, gemma: a }, b: { flash: b, gemma: b }, c: { flash: c, gemma: c }, d: { flash: d } })
  const matrix: Matrix = {
    t1: row(0.9, 0.9, 0.9), t2: row(0.9, 0.9, 0.9), t3: row(0.9, 0.9, 0.9), t4: row(0.9, 0.9, 0.9),
    t5: row(0.9, 0.9, 0.1), t6: row(0.1, 0.9, 0.9),
  }

  test('keeps rounds with distinct tags, 4–40 solutions and no redundant condition', () => {
    // Here b never rules out anything a and c allow, so {a, b, c} is redundant;
    // d shares c's tag, so no other triple qualifies.
    const rounds = oddlySpecificRounds(matrix, things, conditions)
    expect(rounds.map((r) => r.conditions)).toEqual([])
    // Once every condition rules something out, the round is kept.
    const loose: Matrix = { ...matrix, t5: row(0.9, 0.1, 0.9) }
    const kept = oddlySpecificRounds({ ...loose, t6: row(0.9, 0.9, 0.1) }, [...things, 't7'], conditions)
    expect(kept).toEqual([])
    const full = oddlySpecificRounds({ ...loose, t6: row(0.9, 0.9, 0.1), t7: row(0.1, 0.9, 0.9) }, [...things, 't7'], conditions)
    expect(full.map((r) => [r.conditions, r.solutions.length])).toEqual([[['a', 'b', 'c'], 4]])
  })

  test('known answers need Gemma 4 to confirm every cell', () => {
    const partial: Matrix = { ...matrix, t1: { ...matrix.t1, c: { flash: 0.9 } } }
    expect(knownAnswers(partial, ['t1', 't2'], ['a', 'b', 'c'])).toEqual(['t2'])
  })

  test('seeded shuffles are deterministic', () => {
    expect(shuffled([1, 2, 3, 4, 5], seeded(7))).toEqual(shuffled([1, 2, 3, 4, 5], seeded(7)))
  })
})
