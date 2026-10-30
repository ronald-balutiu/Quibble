import { describe, expect, test } from 'vitest'
import { doubleAgentConfig, type DoubleAgentRounds } from '@shared/games/double-agent'
import { agentSentence } from '@/games/double-agent/verdict'
import { maxScore, runReducer, startRun, totalScore, type Guess, type RunAction } from '@/games/oddly-specific/reducer'

const clues = [
  { id: 'clue:1-r1-a', label: 'An accusation in court', negation: "doesn't mean that", claim: '{answer} means an accusation in court' },
  { id: 'clue:1-r1-b', label: 'Stored electrical energy', negation: "doesn't mean that", claim: '{answer} means stored electrical energy' },
]
const guess = (answer: string, failed: string[], closeCall = false): Guess => ({ answer, pass: failed.length === 0, failed, closeCall })

describe('Double Agent', () => {
  test('a wrong guess says which meaning it matched', () => {
    expect(agentSentence(guess('battery', ['clue:1-r1-a']), clues)).toBe('battery fits B, not A.')
    expect(agentSentence(guess('indictment', ['clue:1-r1-b'], true), clues)).toBe('indictment fits A, not B. Close call.')
    expect(agentSentence(guess('table', ['clue:1-r1-a', 'clue:1-r1-b']), clues)).toBe('It misses A and B.')
  })

  test.each([3, 5] as DoubleAgentRounds[])('a run has %i rounds when the config says so', (rounds) => {
    const config = { ...doubleAgentConfig, rounds }
    const reduce = runReducer(config)
    const pass: RunAction = { type: 'judged', guess: guess('charge', []) }
    let state = startRun(config)
    for (let i = 0; i < rounds; i++) state = [pass, { type: 'nextRound' } as const].reduce(reduce, state)
    expect(state.rounds).toHaveLength(rounds)
    expect(state.finished).toBe(true)
    expect(totalScore(state)).toBe(maxScore(config))
    expect(maxScore(config)).toBe(rounds * 3)
  })
})
