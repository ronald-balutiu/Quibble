import { describe, expect, test, vi } from 'vitest'
import { gameConfigs, gameIds } from '@shared/games'
import type { PuzzleIndex } from '@shared/schemas/puzzle'
import { startRun } from '@/games/rounds/reducer'
import {
  gameCounts,
  libraryEntries,
  matchesFilter,
  maxFor,
  pickAtRandom,
  statusOf,
  summarize,
  type LibraryEntry,
} from '@/scenes/library/library-model'

describe('Library progress', () => {
  test.each(gameIds)('preserves untouched, completed-zero and perfect states for %s', (game) => {
    expect(statusOf(game, {})).toEqual({ status: 'unplayed' })
    expect(statusOf(game, { best: 0 })).toEqual({ status: 'solved', best: 0 })
    expect(statusOf(game, { best: maxFor(game) })).toEqual({ status: 'perfect', best: maxFor(game) })
  })

  test('an untouched replay keeps its best; activity shows the current run', () => {
    const run = startRun(gameConfigs['oddly-specific'])
    expect(statusOf('oddly-specific', { run })).toEqual({ status: 'unplayed' })
    expect(statusOf('oddly-specific', { best: 15, run })).toEqual({ status: 'perfect', best: 15 })
    run.rounds = run.rounds.map((round, i) => (i === 0 ? { ...round, status: 'skipped' } : round))
    run.current = 1
    expect(statusOf('oddly-specific', { best: 15, run })).toEqual({
      status: 'open',
      best: 15,
      round: 2,
      progress: { done: 1, total: 5 },
    })
  })

  test('reads each indexed puzzle once and supplies empty games', () => {
    const index: PuzzleIndex = {
      'oddly-specific': [
        { n: 1, difficulty: 'easy' },
        { n: 2, difficulty: 'hard' },
      ],
    }
    const load = vi.fn(() => ({ best: 0 }))
    const entries = libraryEntries(index, load)
    expect(load).toHaveBeenCalledTimes(2)
    expect(entries['oddly-specific'].map((entry) => entry.status)).toEqual(['solved', 'solved'])
    expect(entries['category-escape']).toEqual([])
  })

  const entries: LibraryEntry[] = [
    { n: 1, difficulty: 'easy', status: 'perfect', best: 15 },
    { n: 2, difficulty: 'easy', status: 'solved', best: 0 },
    { n: 3, difficulty: 'hard', status: 'open', round: 2, progress: { done: 1, total: 5 } },
    { n: 4, difficulty: 'hard', status: 'unplayed' },
    { n: 5, difficulty: 'easy', status: 'unplayed' },
  ]

  test('summarizes a game: completed, open and perfect counts, the run to continue and what is unplayed', () => {
    expect(summarize(entries)).toEqual({
      solved: 2,
      open: 1,
      perfect: 1,
      played: 2,
      continuing: entries[2],
      unplayed: [entries[3], entries[4]],
    })
    expect(summarize([])).toMatchObject({ solved: 0, played: 0, continuing: undefined, unplayed: [] })
  })

  test('filters by difficulty or by unplayed', () => {
    const shown = (filter: Parameters<typeof matchesFilter>[1]) =>
      entries.filter((entry) => matchesFilter(entry, filter)).map(({ n }) => n)
    expect(shown('all')).toEqual([1, 2, 3, 4, 5])
    expect(shown('easy')).toEqual([1, 2, 5])
    expect(shown('hard')).toEqual([3, 4])
    expect(shown('unplayed')).toEqual([4, 5])
  })

  test("counts every game's puzzles and plays, including games not loaded yet", () => {
    const index: PuzzleIndex = { 'oddly-specific': entries.map(({ n, difficulty }) => ({ n, difficulty })) }
    const counts = gameCounts(index, { 'oddly-specific': entries, 'category-escape': [], 'double-agent': [] })
    expect(counts['oddly-specific']).toEqual({ total: 5, played: 2 })
    expect(counts['double-agent']).toEqual({ total: 0, played: 0 })
    expect(gameCounts(undefined, undefined)['category-escape']).toEqual({ total: 0, played: 0 })
  })

  test('shuffle picks across the whole list, and nothing from an empty one', () => {
    expect(pickAtRandom(['a', 'b', 'c'], () => 0)).toBe('a')
    expect(pickAtRandom(['a', 'b', 'c'], () => 0.99)).toBe('c')
    expect(pickAtRandom<string>([], () => 0.5)).toBeUndefined()
  })
})
