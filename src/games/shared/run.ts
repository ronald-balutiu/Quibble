// The run shape every game shares (plan 1.3, 1.4), and the saved-progress format
// (D-73): one round per Oddly Specific or Double Agent round, or per Category
// Escape level. Pure: no React, no I/O.

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

const freshRound = (): RoundState => ({
  status: 'playing',
  guesses: [],
  strikes: 0,
  pending: false,
  overruled: false,
  points: 0,
})

export function startRunOf(length: number): RunState {
  return { current: 0, rounds: Array.from({ length }, freshRound), finished: false }
}

// An answer already judged in this round shows its earlier verdict again, free.
export function previousGuess(state: RunState, answer: string): Guess | undefined {
  return state.rounds[state.current]?.guesses.find((guess) => guess.answer === answer)
}

// Replaces the current round with `change(round)`.
export function updateCurrent(state: RunState, change: (round: RoundState) => RoundState): RunState {
  const round = state.rounds[state.current]
  if (!round) return state
  const rounds = [...state.rounds]
  rounds[state.current] = change(round)
  return { ...state, rounds }
}

export const totalScore = (state: RunState) => state.rounds.reduce((total, round) => total + round.points, 0)

// A share grid from one [tile, text] mark per round: the coloured tiles, and a text
// form that doesn't rely on colour (plan 1.4).
export function shareGridOf(marks: readonly (readonly [string, string])[]): { tiles: string; text: string } {
  return { tiles: marks.map(([tile]) => tile).join(''), text: marks.map(([, text]) => text).join(' ') }
}
