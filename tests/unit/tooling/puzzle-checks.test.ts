import { describe, expect, test } from 'vitest'
import type { Puzzle } from '@shared/schemas/puzzle'
import { checkPuzzles, type PuzzleSet } from '../../../factory/puzzle-checks'

const cond = (id: string) => ({ id, label: id, negation: `isn't ${id}`, claim: `{answer} is ${id}` })
const known = ['one', 'two', 'three', 'four']

// One valid puzzle per game; each test breaks one guarantee.
function valid(): PuzzleSet {
  const osRounds = [['a', 'b', 'c'], ['a', 'd', 'e'], ['f', 'g', 'h'], ['i', 'j', 'k'], ['l', 'm', 'n']]
  const levels = ['cat', 'x1', 'x2', 'x3', 'x4', 'x5'].map((_, i, all) => all.slice(0, i + 1))
  const path = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6']
  const words = ['bank', 'bat', 'pitch']
  const clueIds = words.map((_, i) => [`clue:1-r${String(i + 1)}-a`, `clue:1-r${String(i + 1)}-b`])
  const files: Puzzle[] = [
    { game: 'oddly-specific', n: 1, difficulty: 'easy', rounds: osRounds.map((ids, i) => ({ id: `r${String(i + 1)}`, conditions: ids.map(cond) })) },
    { game: 'category-escape', n: 1, difficulty: 'easy', rounds: levels.map((ids, i) => ({ id: `L${String(i + 1)}`, conditions: ids.map(cond) })) },
    { game: 'double-agent', n: 1, difficulty: 'easy', rounds: clueIds.map((ids, i) => ({ id: `r${String(i + 1)}`, conditions: ids.map(cond) })) },
  ]
  const ids = [...osRounds.flat(), ...levels.flat(), ...clueIds.flat()]
  return {
    index: { 'oddly-specific': [{ n: 1, difficulty: 'easy' }], 'category-escape': [{ n: 1, difficulty: 'easy' }], 'double-agent': [{ n: 1, difficulty: 'easy' }] },
    files,
    library: {
      puzzles: {
        'oddly-specific': { 1: { rounds: Object.fromEntries(osRounds.map((c, i) => [`r${String(i + 1)}`, { conditions: c, known, example: 'one' }])) } },
        'category-escape': { 1: { path, rounds: Object.fromEntries(levels.map((c, i) => [`L${String(i + 1)}`, { conditions: c, known: [path[i] ?? '', 'other'], example: path[i] ?? '' }])) } },
        'double-agent': { 1: { rounds: Object.fromEntries(clueIds.map((c, i) => [`r${String(i + 1)}`, { conditions: c, known: [words[i] ?? ''], example: words[i] ?? '' }])) } },
      },
      questions: Object.fromEntries(ids.map((id) => [id, `Is it ${id}?`])),
      aliases: {},
    },
    blocklist: [],
  }
}

const errorsAfter = (change: (set: PuzzleSet) => void) => {
  const set = valid()
  change(set)
  return checkPuzzles(set)
}
const round = (set: PuzzleSet, game: 'oddly-specific' | 'category-escape' | 'double-agent', id: string) => {
  const found = set.library.puzzles[game]?.[1]?.rounds[id]
  if (!found) throw new Error('fixture round missing')
  return found
}

describe('check-puzzles', () => {
  test('passes a valid library', () => {
    expect(checkPuzzles(valid())).toEqual([])
  })

  test('catches index, file and library mismatches', () => {
    expect(errorsAfter((set) => { set.files.pop() })).toContainEqual(expect.stringContaining('found 0 files'))
    expect(errorsAfter((set) => { set.index['double-agent'] = [{ n: 2, difficulty: 'easy' }] })).toContainEqual(expect.stringContaining('numbered 2'))
    expect(errorsAfter((set) => { delete set.library.questions.a })).toContainEqual(expect.stringContaining('no model question for a'))
    expect(errorsAfter((set) => { round(set, 'oddly-specific', 'r1').conditions = ['a', 'b', 'z'] })).toContainEqual(expect.stringContaining('differ from the Worker library'))
  })

  test('Oddly Specific: at least 4 known answers, no near-duplicate or repeated rounds', () => {
    expect(errorsAfter((set) => { round(set, 'oddly-specific', 'r1').known = ['one', 'two', 'three'] })).toContainEqual(expect.stringContaining('only 3 known'))
    expect(errorsAfter((set) => {
      const file = set.files[0]
      if (file?.rounds[1]) file.rounds[1].conditions = ['a', 'b', 'e'].map(cond)
      round(set, 'oddly-specific', 'r2').conditions = ['a', 'b', 'e']
    })).toContainEqual(expect.stringContaining('shares more than one condition'))
  })

  test('Category Escape: cumulative levels with a distinct, known path', () => {
    expect(errorsAfter((set) => { set.library.puzzles['category-escape']?.[1]?.path?.splice(1, 1, 'p1') })).toContainEqual(expect.stringContaining('distinct path'))
    expect(errorsAfter((set) => { round(set, 'category-escape', 'L3').known = ['other'] })).toContainEqual(expect.stringContaining('path answer is not a known answer'))
  })

  test('Double Agent: one hidden word per round, never reused', () => {
    expect(errorsAfter((set) => { Object.assign(round(set, 'double-agent', 'r2'), { known: ['bank'], example: 'bank' }) })).toContainEqual(expect.stringContaining('reuses the word "bank"'))
  })

  test('known answers survive normalization and avoid the blocklist', () => {
    expect(errorsAfter((set) => { round(set, 'oddly-specific', 'r1').known.push('The Thing') })).toContainEqual(expect.stringContaining('changes under normalization'))
    expect(errorsAfter((set) => { set.blocklist = ['bat'] })).toContainEqual(expect.stringContaining('"bat" is blocklisted'))
  })
})
