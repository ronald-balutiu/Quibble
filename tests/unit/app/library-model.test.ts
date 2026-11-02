import { describe, expect, test, vi } from 'vitest'
import { gameConfigs, gameIds } from '@shared/games'
import type { PuzzleIndex } from '@shared/schemas/puzzle'
import { startRun } from '@/games/rounds/reducer'
import { libraryEntries, maxFor, statusOf } from '@/scenes/library/library-model'

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
    run.rounds[0]!.status = 'skipped'
    run.current = 1
    expect(statusOf('oddly-specific', { best: 15, run })).toEqual({ status: 'open', best: 15, round: 2, progress: { done: 1, total: 5 } })
  })

  test('reads each indexed puzzle once and supplies empty games', () => {
    const index: PuzzleIndex = { 'oddly-specific': [{ n: 1, difficulty: 'easy' }, { n: 2, difficulty: 'hard' }] }
    const load = vi.fn(() => ({ best: 0 }))
    const entries = libraryEntries(index, load)
    expect(load).toHaveBeenCalledTimes(2)
    expect(entries['oddly-specific'].map((entry) => entry.status)).toEqual(['solved', 'solved'])
    expect(entries['category-escape']).toEqual([])
  })
})
