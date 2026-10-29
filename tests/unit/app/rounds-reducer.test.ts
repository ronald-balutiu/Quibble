import { describe, expect, test } from 'vitest'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import {
  maxScore, previousGuess, runReducer, shareGrid, startRun, totalScore, type Guess, type RunAction, type RunState,
} from '@/games/oddly-specific/reducer'

const reduce = runReducer(oddlySpecificConfig)
const play = (...actions: RunAction[]) => actions.reduce(reduce, startRun(oddlySpecificConfig))
const pass = (answer: string): RunAction => ({ type: 'judged', guess: { answer, pass: true, failed: [], closeCall: false } })
const fail = (answer: string): RunAction => ({ type: 'judged', guess: { answer, pass: false, failed: ['secure'], closeCall: false } })
const round = (state: RunState) => state.rounds[state.current]

describe('Oddly Specific rounds', () => {
  test('scores 3 / 2 / 1 for solving on guess 1 / 2 / 3', () => {
    expect(round(play(pass('a')))).toMatchObject({ status: 'solved', points: 3 })
    expect(round(play(fail('a'), { type: 'moveOn' }, pass('b')))).toMatchObject({ status: 'solved', points: 2 })
    expect(round(play(fail('a'), { type: 'moveOn' }, fail('b'), { type: 'moveOn' }, pass('c')))).toMatchObject({ points: 1 })
  })

  test('a rejection costs a strike only when the player moves on', () => {
    const rejected = play(fail('a'))
    expect(round(rejected)).toMatchObject({ pending: true, strikes: 0 })
    expect(round(reduce(rejected, { type: 'moveOn' }))).toMatchObject({ pending: false, strikes: 1 })
  })

  test('a new guess is ignored until the pending rejection is moved on', () => {
    expect(round(play(fail('a'), pass('b')))?.status).toBe('playing')
  })

  test('the third strike loses the round, but "Count it anyway" is still available before it', () => {
    const third = play(fail('a'), { type: 'moveOn' }, fail('b'), { type: 'moveOn' }, fail('c'))
    expect(round(reduce(third, { type: 'moveOn' }))).toMatchObject({ status: 'lost', strikes: 3, points: 0 })
    expect(round(reduce(third, { type: 'countAnyway' }))).toMatchObject({ status: 'solved', overruled: true, points: 1 })
  })

  test('a repeated answer is free and is not judged again', () => {
    const state = play(fail('a'), { type: 'moveOn' })
    expect(previousGuess(state, 'a')?.pass).toBe(false)
    expect(round(reduce(state, fail('a')))).toEqual(round(state))
  })

  test('skip ends the round with no points', () => {
    expect(round(play(fail('a'), { type: 'skip' }))).toMatchObject({ status: 'skipped', points: 0, pending: false })
  })

  test('next round only after the round ends; the last one finishes the run', () => {
    expect(play({ type: 'nextRound' }).current).toBe(0)
    let state = startRun(oddlySpecificConfig)
    for (let i = 0; i < oddlySpecificConfig.rounds; i++) state = [pass(`x${String(i)}`), { type: 'nextRound' } as const].reduce(reduce, state)
    expect(state.finished).toBe(true)
    expect(totalScore(state)).toBe(maxScore(oddlySpecificConfig))
    expect(reduce(state, pass('more'))).toBe(state)
  })

  test('builds the share grid with a colour-free text form', () => {
    const guess = (answer: string, ok: boolean): Guess => ({ answer, pass: ok, failed: [], closeCall: false })
    const state = [
      { type: 'judged', guess: guess('a', true) }, { type: 'nextRound' },
      { type: 'judged', guess: guess('b', false) }, { type: 'moveOn' }, { type: 'judged', guess: guess('c', true) }, { type: 'nextRound' },
      { type: 'judged', guess: guess('d', false) }, { type: 'countAnyway' }, { type: 'nextRound' },
      { type: 'skip' }, { type: 'nextRound' },
      { type: 'judged', guess: guess('e', true) },
    ].reduce((s, a) => reduce(s, a as RunAction), startRun(oddlySpecificConfig))
    expect(shareGrid(state)).toEqual({ tiles: '🟩🟨🟦🟥🟩', text: '✓ 2 ✓* ✗ ✓' })
    expect(totalScore(state)).toBe(3 + 2 + 3 + 0 + 3)
  })
})
