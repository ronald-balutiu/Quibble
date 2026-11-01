import { describe, expect, test } from 'vitest'
import { categoryEscapeConfig } from '@shared/games/category-escape'
import {
  escapeEnd, escapeReducer, escapeShareGrid, levelsCleared, startEscape, strikesUsed, usedOn, type EscapeAction,
} from '@/games/category-escape/reducer'

import { previousGuess } from '@/games/rounds/reducer'

const reduce = escapeReducer(categoryEscapeConfig)
const play = (...actions: EscapeAction[]) => actions.reduce(reduce, startEscape(categoryEscapeConfig))
const pass = (answer: string): EscapeAction => ({ type: 'judged', guess: { answer, pass: true, failed: [], closeCall: false } })
const fail = (answer: string): EscapeAction => ({ type: 'judged', guess: { answer, pass: false, failed: ['L2'], closeCall: false } })
const moveOn: EscapeAction = { type: 'moveOn' }

describe('Category Escape run', () => {
  test('clearing a level moves straight to the next and scores one point', () => {
    const state = play(pass('apple'), pass('toaster'))
    expect(state.current).toBe(2)
    expect(levelsCleared(state)).toBe(2)
    expect(state.rounds[0]).toMatchObject({ status: 'solved', points: 1 })
  })

  test('an answer used on an earlier level is refused without a strike', () => {
    const state = play(pass('apple'))
    expect(usedOn(state, 'apple')).toBe(0)
    expect(reduce(state, pass('apple'))).toBe(state)
    expect(reduce(state, fail('apple'))).toBe(state)
  })

  test('strikes count across the whole run, and only when the player moves on', () => {
    const rejected = play(fail('banana'))
    expect(strikesUsed(rejected)).toBe(0)
    const state = play(fail('banana'), moveOn, pass('apple'), fail('bread'), moveOn)
    expect(strikesUsed(state)).toBe(2)
    expect(state.finished).toBe(false)
  })

  test('the third wrong guess ends the run, but "Count it anyway" is still available before it', () => {
    const third = play(fail('a'), moveOn, fail('b'), moveOn, pass('apple'), fail('c'))
    const over = reduce(third, moveOn)
    expect(over.finished).toBe(true)
    expect(escapeEnd(over)).toBe('over')
    expect(levelsCleared(over)).toBe(1)
    const counted = reduce(third, { type: 'countAnyway' })
    expect(counted.rounds[1]).toMatchObject({ status: 'solved', overruled: true })
    expect(counted.current).toBe(2)
  })

  test('a repeated answer on the same level is free and is not judged again', () => {
    const state = play(fail('banana'), moveOn)
    expect(previousGuess(state, 'banana')?.pass).toBe(false)
    expect(reduce(state, fail('banana'))).toBe(state)
  })

  test('give up ends the run at the levels cleared', () => {
    const state = play(pass('apple'), fail('banana'), { type: 'giveUp' })
    expect(state.finished).toBe(true)
    expect(escapeEnd(state)).toBe('gaveUp')
    expect(levelsCleared(state)).toBe(1)
    expect(strikesUsed(state)).toBe(0)
  })

  test('clearing every level escapes', () => {
    const state = play(...['a', 'b', 'c', 'd', 'e', 'f'].map(pass))
    expect(state.finished).toBe(true)
    expect(escapeEnd(state)).toBe('escaped')
    expect(levelsCleared(state)).toBe(categoryEscapeConfig.levels)
    expect(reduce(state, pass('g'))).toBe(state)
  })

  test('restart begins a fresh run', () => {
    expect(reduce(play(pass('a'), { type: 'giveUp' }), { type: 'restart' })).toEqual(startEscape(categoryEscapeConfig))
  })

  test('builds the share grid with a colour-free text form', () => {
    const state = play(pass('a'), fail('x'), moveOn, pass('b'), fail('y'), { type: 'countAnyway' }, fail('z'), moveOn, fail('w'), moveOn)
    expect(escapeShareGrid(state)).toEqual({ tiles: '🟩🟨🟦🟥⬛⬛', text: '✓ 2 ✓* ✗ - -' })
  })
})
