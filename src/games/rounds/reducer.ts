// Round-based play (plan 1.3, 1.4, 5.5 G1–G6), shared by Oddly Specific and Double
// Agent. Pure: no React, no I/O. The game config supplies the numbers.

export interface RoundsConfig {
  rounds: number
  maxWrongGuessesPerRound: number
  pointsByGuess: readonly number[]
}

export interface Guess {
  answer: string // normalized
  pass: boolean
  failed: string[] // condition IDs that failed
  closeCall: boolean
}

type RoundStatus = 'playing' | 'solved' | 'lost' | 'skipped'

export interface RoundState {
  status: RoundStatus
  guesses: Guess[]
  strikes: number
  // A rejection waiting for the player to move on; only then does it cost a strike.
  pending: boolean
  overruled: boolean
  points: number
}

export interface RunState {
  current: number
  rounds: RoundState[]
  finished: boolean
}

export type RunAction =
  | { type: 'judged', guess: Guess }
  | { type: 'moveOn' }
  | { type: 'countAnyway' }
  | { type: 'skip' }
  | { type: 'nextRound' }

export const freshRound = (): RoundState => ({ status: 'playing', guesses: [], strikes: 0, pending: false, overruled: false, points: 0 })

export function startRun(config: RoundsConfig): RunState {
  return { current: 0, rounds: Array.from({ length: config.rounds }, freshRound), finished: false }
}

// An answer already judged in this round shows its earlier verdict again, free.
export function previousGuess(state: RunState, answer: string): Guess | undefined {
  return state.rounds[state.current]?.guesses.find((guess) => guess.answer === answer)
}

function update(state: RunState, change: (round: RoundState) => RoundState): RunState {
  const round = state.rounds[state.current]
  if (!round) return state
  const rounds = [...state.rounds]
  rounds[state.current] = change(round)
  return { ...state, rounds }
}

// The guess number a pass would score as: one more than the strikes taken so far.
const pointsFor = (config: RoundsConfig, round: RoundState) => config.pointsByGuess[round.strikes] ?? 0

export function runReducer(config: RoundsConfig) {
  return (state: RunState, action: RunAction): RunState => {
    const round = state.rounds[state.current]
    if (!round || state.finished) return state

    switch (action.type) {
      case 'judged': {
        if (round.status !== 'playing' || round.pending || previousGuess(state, action.guess.answer)) return state
        return update(state, (r) => {
          const guesses = [...r.guesses, action.guess]
          return action.guess.pass
            ? { ...r, guesses, status: 'solved', points: pointsFor(config, r) }
            : { ...r, guesses, pending: true }
        })
      }
      case 'moveOn': {
        if (!round.pending) return state
        return update(state, (r) => {
          const strikes = r.strikes + 1
          return { ...r, pending: false, strikes, status: strikes >= config.maxWrongGuessesPerRound ? 'lost' : 'playing' }
        })
      }
      case 'countAnyway': {
        if (!round.pending) return state
        return update(state, (r) => ({ ...r, pending: false, overruled: true, status: 'solved', points: pointsFor(config, r) }))
      }
      case 'skip': {
        if (round.status !== 'playing') return state
        return update(state, (r) => ({ ...r, pending: false, status: 'skipped', points: 0 }))
      }
      case 'nextRound': {
        if (round.status === 'playing') return state
        const last = state.current === state.rounds.length - 1
        return last ? { ...state, finished: true } : { ...state, current: state.current + 1 }
      }
    }
  }
}

export const totalScore = (state: RunState) => state.rounds.reduce((total, round) => total + round.points, 0)
export const maxScore = (config: RoundsConfig) => config.rounds * (config.pointsByGuess[0] ?? 0)

// Share-grid tiles (plan 1.4): 🟩 first guess, 🟨 a later guess, 🟦 overruled,
// 🟥 lost or skipped; with a text form that doesn't rely on colour.
export function shareGrid(state: RunState): { tiles: string, text: string } {
  const marks = state.rounds.map((round) => {
    if (round.status !== 'solved') return ['🟥', '✗']
    if (round.overruled) return ['🟦', '✓*']
    return round.strikes === 0 ? ['🟩', '✓'] : ['🟨', String(round.strikes + 1)]
  })
  return { tiles: marks.map(([tile]) => tile).join(''), text: marks.map(([, text]) => text).join(' ') }
}
