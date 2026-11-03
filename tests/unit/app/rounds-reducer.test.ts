import { describe, expect, test } from 'vitest'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { maxScore, onLastTry, runReducer, shareGrid, startRun, type RunAction } from '@/games/rounds/reducer'
import { previousGuess, totalScore, type Guess, type RunState } from '@/games/shared/run'

const reduce = runReducer(oddlySpecificConfig)
const play = (...actions: RunAction[]) => actions.reduce(reduce, startRun(oddlySpecificConfig))
const pass = (answer: string): RunAction => ({
  type: 'judged',
  guess: { answer, pass: true, failed: [], closeCall: false },
})
const fail = (answer: string): RunAction => ({
  type: 'judged',
  guess: { answer, pass: false, failed: ['secure'], closeCall: false },
})
const round = (state: RunState) => state.rounds[state.current]

describe('Oddly Specific rounds', () => {
  test('scores 3 / 2 / 1 for solving on guess 1 / 2 / 3', () => {
    expect(round(play(pass('a')))).toMatchObject({ status: 'solved', points: 3 })
    expect(round(play(fail('a'), { type: 'moveOn' }, pass('b')))).toMatchObject({ status: 'solved', points: 2 })
    expect(round(play(fail('a'), { type: 'moveOn' }, fail('b'), { type: 'moveOn' }, pass('c')))).toMatchObject({
      points: 1,
    })
  })

  test('a rejection costs a strike only when the player moves on', () => {
    const rejected = play(fail('a'))
    expect(round(rejected)).toMatchObject({ pending: true, strikes: 0 })
    expect(round(reduce(rejected, { type: 'moveOn' }))).toMatchObject({ pending: false, strikes: 1 })
  })

  test('only the third pending rejection is the last try, and moving on from it loses the round', () => {
    const third = play(fail('a'), { type: 'moveOn' }, fail('b'), { type: 'moveOn' }, fail('c'))
    expect(onLastTry(oddlySpecificConfig, play(fail('a')))).toBe(false)
    expect(onLastTry(oddlySpecificConfig, play(fail('a'), { type: 'moveOn' }, fail('b')))).toBe(false)
    expect(onLastTry(oddlySpecificConfig, third)).toBe(true)
    expect(round(reduce(third, { type: 'moveOn' }))).toMatchObject({ status: 'lost', strikes: 3, points: 0 })
    // "Count it anyway" on the last try still scores the third guess's point.
    expect(round(reduce(third, { type: 'countAnyway' }))).toMatchObject({
      status: 'solved',
      overruled: true,
      points: 1,
    })
    expect(onLastTry(oddlySpecificConfig, play())).toBe(false)
  })

  test('a new guess is ignored until the pending rejection is moved on', () => {
    const pending = play(fail('a'))
    expect(reduce(pending, pass('b'))).toBe(pending)
    expect(round(pending)).toMatchObject({ status: 'playing', pending: true, guesses: [{ answer: 'a' }] })
  })

  // Third-strike scoring and overruling are covered above; ended rounds also
  // need to resist late guesses and actions before moving to the next round.
  test.each([
    ['solved', play(pass('a'))],
    ['lost', play(fail('a'), { type: 'moveOn' }, fail('b'), { type: 'moveOn' }, fail('c'), { type: 'moveOn' })],
    ['skipped', play({ type: 'skip' })],
  ] as const)('a %s round ignores further guesses and scoring actions', (_status, state) => {
    const actions: RunAction[] = [pass('late'), { type: 'moveOn' }, { type: 'countAnyway' }, { type: 'skip' }]
    for (const action of actions) expect(reduce(state, action)).toBe(state)
  })

  test('a repeated answer is free and is not judged again', () => {
    const state = play(fail('a'), { type: 'moveOn' })
    expect(previousGuess(state, 'a')?.pass).toBe(false)
    expect(reduce(state, fail('a'))).toBe(state)
  })

  test('skip ends the round with no points', () => {
    expect(round(play(fail('a'), { type: 'skip' }))).toMatchObject({ status: 'skipped', points: 0, pending: false })
  })

  test('next round only after the round ends; the last one finishes the run', () => {
    expect(play({ type: 'nextRound' }).current).toBe(0)
    let state = startRun(oddlySpecificConfig)
    for (let i = 0; i < oddlySpecificConfig.rounds; i++)
      state = [pass(`x${String(i)}`), { type: 'nextRound' } as const].reduce(reduce, state)
    expect(state.finished).toBe(true)
    expect(totalScore(state)).toBe(maxScore(oddlySpecificConfig))
    expect(reduce(state, pass('more'))).toBe(state)
  })

  test('builds the share grid with a colour-free text form', () => {
    const guess = (answer: string, ok: boolean): Guess => ({ answer, pass: ok, failed: [], closeCall: false })
    const state = play(
      { type: 'judged', guess: guess('a', true) },
      { type: 'nextRound' },
      { type: 'judged', guess: guess('b', false) },
      { type: 'moveOn' },
      { type: 'judged', guess: guess('c', true) },
      { type: 'nextRound' },
      { type: 'judged', guess: guess('d', false) },
      { type: 'countAnyway' },
      { type: 'nextRound' },
      { type: 'skip' },
      { type: 'nextRound' },
      { type: 'judged', guess: guess('e', true) },
    )
    expect(shareGrid(state)).toEqual({ tiles: '🟩🟨🟦🟥🟩', text: '✓ 2 ✓* ✗ ✓' })
    expect(totalScore(state)).toBe(3 + 2 + 3 + 0 + 3)
  })
})
