// @vitest-environment happy-dom
import { useReducer } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { gameConfigs } from '@shared/games'
import { puzzleSchema, type Puzzle } from '@shared/schemas/puzzle'
import { useGameSession } from '@/games/shared/use-game-session'
import { runReducer, startRun, type RunAction } from '@/games/rounds/reducer'
import { escapeReducer, startEscape } from '@/games/category-escape/reducer'
import { judgeGuess, type GuessOutcome } from '@/games/shared/judge-guess'
import { loadProgress } from '@/lib/storage/progress'
import { refreshCloudModel, refreshReferee, saveCloudModel, saveReferee } from '@/lib/storage/settings'
import type { Guess, RunState } from '@/games/shared/run'
import { installStorage } from './support/storage'
import { deferred } from '../../support/deferred'
import oddlyFile from '../../../public/puzzles/oddly-specific/1.json'
import escapeFile from '../../../public/puzzles/category-escape/1.json'

vi.mock('@/games/shared/judge-guess', () => ({ judgeGuess: vi.fn() }))
const judging = vi.mocked(judgeGuess)
const oddly = puzzleSchema.parse(oddlyFile)
const escape = puzzleSchema.parse(escapeFile)
const guess = (answer: string, pass = false): Guess => ({
  answer,
  pass,
  failed: pass ? [] : [oddly.rounds[0]?.conditions[0]?.id ?? ''],
  closeCall: false,
})
const outcome = (answer: string, pass = false): GuessOutcome => ({
  guess: guess(answer, pass),
  scores: {},
  decidedBy: 'cloud',
})

beforeEach(() => {
  installStorage()
  refreshCloudModel()
  refreshReferee()
  judging.mockReset()
})
afterEach(() => {
  cleanup()
})

function session(puzzle: Puzzle = oddly, saved?: RunState) {
  const config = gameConfigs[puzzle.game]
  const reduce: (
    state: RunState,
    action: Extract<RunAction, { type: 'judged' | 'moveOn' | 'countAnyway' }>,
  ) => RunState = config.id === 'category-escape' ? escapeReducer(config) : runReducer(config)
  const initial = saved ?? (config.id === 'category-escape' ? startEscape(config) : startRun(config))
  return renderHook(() => {
    const [run, dispatch] = useReducer(reduce, initial)
    return { run, ...useGameSession(puzzle, run, dispatch) }
  })
}

test('local invalid answers never call a judge or spend a strike, and typing clears the notice', async () => {
  const { result } = session()
  await act(() => result.current.judge())
  expect(result.current.ui).toEqual({ kind: 'input', notice: 'input.empty' })
  act(() => {
    result.current.type('x'.repeat(41))
  })
  await act(() => result.current.judge())
  expect(result.current.ui).toEqual({ kind: 'input', notice: 'input.tooLong' })
  act(() => {
    result.current.type('spoon')
  })
  expect(result.current.ui).toEqual({ kind: 'input' })
  expect(result.current.run.rounds[0]?.strikes).toBe(0)
  expect(judging).not.toHaveBeenCalled()
})

test('keeps judging locked, draws cloud scores early, and uses the selected model on the next guess', async () => {
  const pending = deferred<GuessOutcome>()
  judging.mockImplementationOnce((_turn, watchers) => {
    watchers?.onCloud?.({ a: 0.2 }, 15)
    return pending.promise
  })
  const { result } = session()
  act(() => {
    result.current.type('A spoon!')
  })
  let finished: Promise<void> | undefined
  act(() => {
    finished = result.current.judge()
  })
  expect(result.current.busy).toBe(true)
  expect(result.current.scores).toEqual({ a: 0.2 })
  expect(result.current.column.modelMs).toBe(15)
  await act(() => result.current.judge())
  act(() => {
    result.current.countAnyway()
    saveCloudModel('gemma-4')
  })
  expect(judging).toHaveBeenCalledTimes(1)
  expect(result.current.model).toBe('clef-flash')
  await act(async () => {
    pending.resolve(outcome('spoon'))
    await finished
  })
  expect(result.current.run.rounds[0]).toMatchObject({ pending: true, strikes: 0 })
  expect(result.current.last).toEqual({ answer: 'spoon', level: 0, pass: false })
  act(() => {
    result.current.type('fork')
  })
  judging.mockResolvedValueOnce(outcome('fork', true))
  await act(() => result.current.judge())
  expect(result.current.model).toBe('gemma-4')
  expect(result.current.run.rounds[0]).toMatchObject({ status: 'solved', strikes: 1, points: 2 })
  expect(loadProgress('oddly-specific', 1).run).toEqual(result.current.run)
})

test('restores the pending rejection, and a current overrule keeps the try', () => {
  const reduce = runReducer(gameConfigs['oddly-specific'])
  const run = reduce(startRun(gameConfigs['oddly-specific']), { type: 'judged', guess: guess('spoon') })
  const { result } = session(oddly, run)
  expect(result.current.ui.kind).toBe('rejected')
  act(() => {
    result.current.countAnyway()
  })
  expect(result.current.run.rounds[0]).toMatchObject({ status: 'solved', overruled: true, points: 3, strikes: 0 })
  expect(result.current.last).toMatchObject({ answer: 'spoon', pass: true, overruled: true })
})

test('moving on charges once; replaying a historical rejection is view-only and free', async () => {
  judging.mockResolvedValueOnce(outcome('spoon'))
  const { result } = session()
  act(() => {
    result.current.type('spoon')
  })
  await act(() => result.current.judge())
  act(() => {
    result.current.tryAgain()
  })
  expect(result.current.answer).toBe('')
  act(() => {
    result.current.type('spoon')
  })
  await act(() => result.current.judge())
  expect(result.current.ui.kind).toBe('repeated')
  expect(result.current.scores).toEqual({})
  const run = result.current.run
  act(() => {
    result.current.countAnyway()
  })
  expect(result.current.run).toBe(run)
  expect(result.current.last?.overruled).toBeUndefined()
  act(() => {
    result.current.type('fork')
  })
  expect(result.current.ui.kind).toBe('input')
  expect(result.current.run.rounds[0]?.strikes).toBe(1)
  expect(judging).toHaveBeenCalledTimes(1)
})

test('an accepted repeated answer stays local and gives the repeat notice', async () => {
  judging.mockResolvedValueOnce(outcome('spoon', true))
  const { result } = session()
  act(() => {
    result.current.type('spoon')
  })
  await act(() => result.current.judge())
  await act(() => result.current.judge())
  expect(result.current.ui).toEqual({ kind: 'input', notice: 'input.repeat' })
  expect(judging).toHaveBeenCalledTimes(1)
})

test('a not-judged outcome can be edited and retried without a strike', async () => {
  judging.mockResolvedValueOnce({ ui: { kind: 'notJudged', message: 'net.offline' } })
  const { result } = session()
  act(() => {
    result.current.type('spoon')
  })
  await act(() => result.current.judge())
  expect(result.current.ui.kind).toBe('notJudged')
  act(() => {
    result.current.edit()
  })
  expect(result.current.ui.kind).toBe('input')
  expect(result.current.run.rounds[0]?.strikes).toBe(0)
  judging.mockResolvedValueOnce(outcome('spoon', true))
  await act(() => result.current.judge())
  expect(result.current.run.rounds[0]?.points).toBe(3)
})

test.each([true, false])(
  'Escape advances and clears the field after a %s pass, including an overrule',
  async (pass) => {
    judging.mockResolvedValueOnce(outcome('spoon', pass))
    const { result } = session(escape)
    act(() => {
      result.current.type('spoon')
      saveReferee('device')
    })
    await act(() => result.current.judge())
    if (!pass)
      act(() => {
        result.current.countAnyway()
      })
    expect(result.current.run.current).toBe(1)
    expect(result.current.answer).toBe('')
    expect(result.current.ui.kind).toBe('input')
    expect(judging.mock.calls[0]?.[1]?.referee).toBe('device')
    act(() => {
      result.current.type('spoon')
    })
    await act(() => result.current.judge())
    expect(result.current.ui).toEqual({ kind: 'reused', level: 0 })
    act(() => {
      result.current.type('fork')
    })
    expect(result.current.ui.kind).toBe('input')
  },
)

test('reset forgets verdict state and refreshes the best score and selected model', async () => {
  judging.mockResolvedValueOnce(outcome('spoon'))
  const { result } = session()
  act(() => {
    result.current.type('spoon')
  })
  await act(() => result.current.judge())
  act(() => {
    localStorage.setItem('quibble:progress:oddly-specific:1', JSON.stringify({ best: 9 }))
    saveCloudModel('gemma-4')
    result.current.reset()
  })
  expect(result.current).toMatchObject({
    ui: { kind: 'input' },
    scores: {},
    last: undefined,
    answer: '',
    best: 9,
    model: 'gemma-4',
  })
})
