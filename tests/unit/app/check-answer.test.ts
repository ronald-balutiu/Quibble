import { describe, expect, test } from 'vitest'
import { categoryEscapeConfig } from '@shared/games/category-escape'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { escapeReducer, startEscape } from '@/games/category-escape/reducer'
import { runReducer, startRun, type Guess } from '@/games/rounds/reducer'
import { checkAnswer } from '@/scenes/game/check-answer'

const guess = (answer: string, pass: boolean): Guess => ({ answer, pass, failed: pass ? [] : ['a'], closeCall: false })

describe('local answer checks shared by the game screens', () => {
  test('normalizes an answer before judging or checking for repeats', () => {
    expect(checkAnswer(' The  Wooden Spoon! ', 'oddly-specific', startRun(oddlySpecificConfig))).toEqual({ normalized: 'wooden spoon' })
  })

  test.each([
    ['oddly-specific', '...', 'input.empty'],
    ['oddly-specific', 'a'.repeat(61), 'input.tooLong'],
    ['category-escape', '  ', 'input.empty'],
    ['double-agent', 'two words', 'input.tooLong'],
    ['double-agent', 'a'.repeat(21), 'input.tooLong'],
  ] as const)('%s refuses invalid input without changing the run', (game, answer, notice) => {
    const run = startRun(oddlySpecificConfig)
    const before = structuredClone(run)
    expect(checkAnswer(answer, game, run).ui).toEqual({ kind: 'input', notice })
    expect(run).toEqual(before)
  })

  test('shows a repeated rejection, including one the player has already moved past', () => {
    const rejected = guess('spoon', false)
    const reduce = runReducer(oddlySpecificConfig)
    const pending = reduce(startRun(oddlySpecificConfig), { type: 'judged', guess: rejected })
    for (const run of [pending, reduce(pending, { type: 'moveOn' })]) {
      expect(checkAnswer('A spoon!', 'oddly-specific', run)).toEqual({ normalized: 'spoon', ui: { kind: 'rejected', guess: rejected } })
    }
  })

  test('an accepted answer cannot be judged twice in a round', () => {
    const run = runReducer(oddlySpecificConfig)(startRun(oddlySpecificConfig), { type: 'judged', guess: guess('spoon', true) })
    expect(checkAnswer('SPOON', 'oddly-specific', run).ui).toEqual({ kind: 'input', notice: 'input.repeat' })
  })

  test('Category Escape refuses a cleared answer but allows new answers on the next level', () => {
    const run = escapeReducer(categoryEscapeConfig)(startEscape(categoryEscapeConfig), { type: 'judged', guess: guess('spoon', true) })
    expect(checkAnswer('The spoon', 'category-escape', run).ui).toEqual({ kind: 'reused', level: 0 })
    expect(checkAnswer('fork', 'category-escape', run)).toEqual({ normalized: 'fork' })
  })

  test('a rejection from a previous round is allowed in a new round', () => {
    const reduce = runReducer(oddlySpecificConfig)
    const run = [{ type: 'judged', guess: guess('spoon', false) }, { type: 'skip' }, { type: 'nextRound' }].reduce(
      (state, action) => reduce(state, action as Parameters<typeof reduce>[1]), startRun(oddlySpecificConfig),
    )
    expect(checkAnswer('spoon', 'oddly-specific', run)).toEqual({ normalized: 'spoon' })
  })
})
