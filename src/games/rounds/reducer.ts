// Round-based play (plan 1.3, 1.4, 5.5 G1–G6), shared by Oddly Specific and Double
// Agent. Pure: no React, no I/O. The game config supplies the numbers.
import {
  previousGuess,
  shareGridOf,
  startRunOf,
  updateCurrent,
  type Guess,
  type RoundState,
  type RunState,
} from '@/games/shared/run'

export interface RoundsConfig {
  rounds: number
  maxWrongGuessesPerRound: number
  pointsByGuess: readonly number[]
}

export type RunAction =
  | { type: 'judged'; guess: Guess }
  | { type: 'moveOn' }
  | { type: 'countAnyway' }
  | { type: 'skip' }
  | { type: 'nextRound' }

export const startRun = (config: RoundsConfig): RunState => startRunOf(config.rounds)

// The guess number a pass would score as: one more than the strikes taken so far.
const pointsFor = (config: RoundsConfig, round: RoundState) => config.pointsByGuess[round.strikes] ?? 0

export function runReducer(config: RoundsConfig) {
  return (state: RunState, action: RunAction): RunState => {
    const round = state.rounds[state.current]
    if (!round || state.finished) return state

    switch (action.type) {
      case 'judged': {
        if (round.status !== 'playing' || round.pending || previousGuess(state, action.guess.answer)) return state
        return updateCurrent(state, (r) => {
          const guesses = [...r.guesses, action.guess]
          return action.guess.pass
            ? { ...r, guesses, status: 'solved', points: pointsFor(config, r) }
            : { ...r, guesses, pending: true }
        })
      }
      case 'moveOn': {
        if (!round.pending) return state
        return updateCurrent(state, (r) => {
          const strikes = r.strikes + 1
          return {
            ...r,
            pending: false,
            strikes,
            status: strikes >= config.maxWrongGuessesPerRound ? 'lost' : 'playing',
          }
        })
      }
      case 'countAnyway': {
        if (!round.pending) return state
        return updateCurrent(state, (r) => ({
          ...r,
          pending: false,
          overruled: true,
          status: 'solved',
          points: pointsFor(config, r),
        }))
      }
      case 'skip': {
        if (round.status !== 'playing') return state
        return updateCurrent(state, (r) => ({ ...r, pending: false, status: 'skipped', points: 0 }))
      }
      case 'nextRound': {
        if (round.status === 'playing') return state
        const last = state.current === state.rounds.length - 1
        return last ? { ...state, finished: true } : { ...state, current: state.current + 1 }
      }
    }
  }
}

// The pending rejection is the round's last allowed miss: moving on ends the round,
// so the screen offers "End round" rather than another try.
export function onLastTry(config: RoundsConfig, state: RunState): boolean {
  const round = state.rounds[state.current]
  return round?.pending === true && round.strikes + 1 >= config.maxWrongGuessesPerRound
}

export const maxScore = (config: RoundsConfig) => config.rounds * (config.pointsByGuess[0] ?? 0)

// Share-grid tiles (plan 1.4): 🟩 first guess, 🟨 a later guess, 🟦 overruled,
// 🟥 lost or skipped; with a text form that doesn't rely on colour.
export function shareGrid(state: RunState): { tiles: string; text: string } {
  return shareGridOf(
    state.rounds.map((round) => {
      if (round.status !== 'solved') return ['🟥', '✗'] as const
      if (round.overruled) return ['🟦', '✓*'] as const
      return round.strikes === 0 ? (['🟩', '✓'] as const) : (['🟨', String(round.strikes + 1)] as const)
    }),
  )
}
