// One Category Escape run (plan 1.3, 1.4, 5.5 E1–E2). Pure: no React, no I/O.
// It keeps the round-based run shape, one round per level, so saved progress
// stays in the frozen format (D-73): a level's strikes are the wrong guesses made
// on it, a cleared level scores 1 point, and Give up marks the level 'skipped'.
import { previousGuess, shareGridOf, startRunOf, updateCurrent, type Guess, type RoundState, type RunState } from '@/games/shared/run'

interface EscapeConfig {
  levels: number
  maxWrongGuessesPerRun: number
}

export type EscapeAction =
  | { type: 'judged', guess: Guess }
  | { type: 'moveOn' }
  | { type: 'countAnyway' }
  | { type: 'giveUp' }
  | { type: 'restart' }

type EscapeEnd = 'escaped' | 'over' | 'gaveUp'

export const startEscape = (config: EscapeConfig): RunState => startRunOf(config.levels)

export const strikesUsed = (state: RunState) => state.rounds.reduce((total, level) => total + level.strikes, 0)

// The pending rejection is the run's last allowed miss: moving on ends the run.
export const onLastTry = (config: EscapeConfig, state: RunState) =>
  state.rounds[state.current]?.pending === true && strikesUsed(state) + 1 >= config.maxWrongGuessesPerRun
export const levelsCleared = (state: RunState) => state.rounds.filter((level) => level.status === 'solved').length

// The level an answer cleared, if it was already used; reusing it is a local rule, never a strike.
export function usedOn(state: RunState, answer: string): number | undefined {
  const index = state.rounds.findIndex((level) => level.status === 'solved' && level.guesses.at(-1)?.answer === answer)
  return index === -1 ? undefined : index
}

// Changes the current level; `end` finishes the run.
function update(state: RunState, change: (level: RoundState) => RoundState, end = false): RunState {
  return { ...updateCurrent(state, change), finished: end }
}

// Clearing a level moves straight on to the next one; clearing the last escapes.
function clear(state: RunState, change: (level: RoundState) => RoundState): RunState {
  const last = state.current === state.rounds.length - 1
  const next = update(state, (level) => ({ ...change(level), pending: false, status: 'solved', points: 1 }), last)
  return last ? next : { ...next, current: state.current + 1 }
}

export function escapeReducer(config: EscapeConfig) {
  return (state: RunState, action: EscapeAction): RunState => {
    if (action.type === 'restart') return startEscape(config)
    const level = state.rounds[state.current]
    if (!level || state.finished) return state

    switch (action.type) {
      case 'judged': {
        const { guess } = action
        if (level.pending || previousGuess(state, guess.answer) || usedOn(state, guess.answer) !== undefined) return state
        return guess.pass
          ? clear(state, (l) => ({ ...l, guesses: [...l.guesses, guess] }))
          : update(state, (l) => ({ ...l, guesses: [...l.guesses, guess], pending: true }))
      }
      case 'moveOn': {
        if (!level.pending) return state
        const over = strikesUsed(state) + 1 >= config.maxWrongGuessesPerRun
        return update(state, (l) => ({ ...l, pending: false, strikes: l.strikes + 1, status: over ? 'lost' : 'playing' }), over)
      }
      case 'countAnyway': {
        if (!level.pending) return state
        return clear(state, (l) => ({ ...l, overruled: true }))
      }
      case 'giveUp': {
        return update(state, (l) => ({ ...l, pending: false, status: 'skipped' }), true)
      }
    }
  }
}

export function escapeEnd(state: RunState): EscapeEnd {
  if (state.rounds.every((level) => level.status === 'solved')) return 'escaped'
  return state.rounds.some((level) => level.status === 'skipped') ? 'gaveUp' : 'over'
}

// Share-grid tiles (plan 1.4): 🟩 cleared first try, 🟨 after a miss, 🟦 overruled,
// 🟥 where the run ended, ⬛ never reached (E2 mock); with a colour-free text form.
export function escapeShareGrid(state: RunState): { tiles: string, text: string } {
  return shareGridOf(state.rounds.map((level, i) => {
    if (level.status === 'solved') {
      if (level.overruled) return ['🟦', '✓*'] as const
      return level.strikes === 0 ? ['🟩', '✓'] as const : ['🟨', String(level.strikes + 1)] as const
    }
    return i === state.current ? ['🟥', '✗'] as const : ['⬛', '-'] as const
  }))
}
