import { describe, expect, test } from 'vitest'
import { gameConfigs } from '@shared/games'
import { runReducer, startRun } from '@/games/rounds/reducer'
import { escapeReducer, startEscape } from '@/games/category-escape/reducer'
import { usableRun } from '@/games/shared/restore-run'
import { startRunOf, type RunState } from '@/games/shared/run'
import { puzzleSchema } from '@shared/schemas/puzzle'
import oddly from '../../../public/puzzles/oddly-specific/1.json'
import escape from '../../../public/puzzles/category-escape/1.json'
import agent from '../../../public/puzzles/double-agent/1.json'

function roundOf(run: RunState, index = 0) {
  const round = run.rounds[index]
  if (!round) throw new Error(`Expected round ${String(index)}`)
  return round
}

for (const source of [oddly, escape, agent]) {
  const puzzle = puzzleSchema.parse(source)
  const start = () => startRunOf(puzzle.rounds.length)
  describe(`${puzzle.game} saved-run recovery`, () => {
    test('keeps an untouched or pending run exactly as saved', () => {
      const run = start()
      expect(usableRun(puzzle, run)).toBe(run)
      const current = run.rounds[0]
      if (!current) throw new Error('Puzzle must contain a round')
      current.pending = true
      current.guesses.push({
        answer: 'knife',
        pass: false,
        failed: [puzzle.rounds[0]?.conditions[0]?.id ?? ''],
        closeCall: false,
      })
      expect(usableRun(puzzle, run)).toBe(run)
    })

    test.each([
      ['no run', () => undefined],
      ['no rounds', (run: RunState) => ({ ...run, rounds: [] })],
      ['wrong round count', (run: RunState) => ({ ...run, rounds: run.rounds.slice(1) })],
      ['out of bounds current', (run: RunState) => ({ ...run, current: run.rounds.length })],
      ['unfinished run incorrectly marked finished', (run: RunState) => ({ ...run, finished: true })],
      ['unfinished prior round', (run: RunState) => ({ ...run, current: 1 })],
    ] as const)('discards %s', (_name, change) => {
      expect(usableRun(puzzle, change(start()))).toBeUndefined()
    })

    test.each([
      [
        'pending without a rejected guess',
        (run: RunState) => {
          roundOf(run).pending = true
        },
      ],
      [
        'too many strikes',
        (run: RunState) => {
          roundOf(run).strikes = 4
        },
      ],
      [
        'points on an unsolved round',
        (run: RunState) => {
          roundOf(run).points = 99
        },
      ],
      [
        'a false solved round',
        (run: RunState) => {
          roundOf(run).status = 'solved'
        },
      ],
      [
        'an overrule on an unsolved round',
        (run: RunState) => {
          roundOf(run).overruled = true
        },
      ],
      [
        'a modified future round',
        (run: RunState) => {
          roundOf(run, 1).status = 'skipped'
        },
      ],
      [
        'a foreign condition',
        (run: RunState) => {
          roundOf(run).guesses.push({ answer: 'x', pass: false, failed: ['not-a-rule'], closeCall: false })
        },
      ],
    ] as const)('discards %s', (_name, change) => {
      const run = start()
      change(run)
      expect(usableRun(puzzle, run)).toBeUndefined()
    })

    test('preserves a valid completed run for its results screen', () => {
      const config = gameConfigs[puzzle.game]
      let run: RunState
      if (config.id === 'category-escape') {
        const reduce = escapeReducer(config)
        run = startEscape(config)
        for (let i = 0; i < config.levels; i++)
          run = reduce(run, {
            type: 'judged',
            guess: { answer: `answer${String(i)}`, pass: true, failed: [], closeCall: false },
          })
      } else {
        const reduce = runReducer(config)
        run = startRun(config)
        for (let i = 0; i < config.rounds; i++) {
          run = reduce(run, { type: 'skip' })
          run = reduce(run, { type: 'nextRound' })
        }
      }
      expect(run.finished).toBe(true)
      expect(usableRun(puzzle, run)).toBe(run)
    })

    test('rejects a premature completion before the final round', () => {
      const run = start()
      const first = roundOf(run)
      Object.assign(first, { status: 'solved', points: puzzle.game === 'category-escape' ? 1 : 3 })
      first.guesses.push({ answer: 'x', pass: true, failed: [], closeCall: false })
      run.finished = true
      expect(usableRun(puzzle, run)).toBeUndefined()
    })

    test('retains completed rounds and resumes the next one', () => {
      const run = start()
      const first = run.rounds[0]
      if (!first) throw new Error('Puzzle must contain a round')
      Object.assign(first, { status: 'solved', points: puzzle.game === 'category-escape' ? 1 : 3 })
      first.guesses.push({ answer: 'x', pass: true, failed: [], closeCall: false })
      run.current = 1
      expect(usableRun(puzzle, run)).toBe(run)
      first.overruled = true
      if (first.guesses[0]) first.guesses[0].pass = false
      expect(usableRun(puzzle, run)).toBe(run)
    })
  })
}

test('Escape cannot resume after its last strike or from a terminal level', () => {
  const puzzle = puzzleSchema.parse(escape)
  const run = startRunOf(puzzle.rounds.length)
  const first = run.rounds[0]
  if (!first) throw new Error('Expected an Escape level')
  first.strikes = 3
  expect(usableRun(puzzle, run)).toBeUndefined()
  first.strikes = 0
  first.status = 'lost'
  expect(usableRun(puzzle, run)).toBeUndefined()
})

test('a finished Escape run can retain its Give up results before the last level', () => {
  const puzzle = puzzleSchema.parse(escape)
  const config = gameConfigs['category-escape']
  const run = escapeReducer(config)(startEscape(config), { type: 'giveUp' })
  expect(usableRun(puzzle, run)).toBe(run)
})
