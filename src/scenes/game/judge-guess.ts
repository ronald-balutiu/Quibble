import type { GameId } from '@shared/games'
import type { CloudModel } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import type { Guess } from '@/games/oddly-specific/reducer'
import { judgeOnCloud, type CloudMessage } from '@/judges/attempt'
import { renewSession } from '@/lib/turnstile'
import { toGuess } from './verdict'

// One cloud-judged guess, shared by every game screen, and the game screen's UI state.

export type Ui =
  | { kind: 'input', notice?: 'input.empty' | 'input.tooLong' | 'input.repeat' }
  | { kind: 'judging' }
  | { kind: 'rejected', guess: Guess }
  | { kind: 'notJudged', message: CloudMessage | 'cloud.busy', retryAfter?: number }
  | { kind: 'resting', resetAt: string }

export interface JudgeTurn {
  game: GameId
  n: number
  roundId: string
  text: string // as typed; normalized is the reducer's form
  normalized: string
  attempt: number
  model: CloudModel
  conditions: readonly PuzzleCondition[]
  turnstile: HTMLDivElement | null
}

// The verdict for a guess that passed the local checks: a reducer guess with its
// scores, or the panel to show instead. No outcome here ever costs a strike.
export async function judgeGuess(turn: JudgeTurn): Promise<{ guess: Guess, scores: Record<string, number | undefined> } | { ui: Ui }> {
  const { turnstile } = turn
  const outcome = await judgeOnCloud(
    { game: turn.game, n: turn.n, roundId: turn.roundId, answer: turn.text, attempt: turn.attempt, model: turn.model },
    () => (turnstile ? renewSession(turnstile) : Promise.resolve('error')),
  )
  switch (outcome.kind) {
    case 'judged': return {
      guess: toGuess(turn.normalized, outcome.result, turn.conditions, turn.model),
      scores: Object.fromEntries(Object.entries(outcome.result.conditions).map(([id, { p }]) => [id, p])),
    }
    case 'busy': return { ui: { kind: 'notJudged', message: 'cloud.busy', retryAfter: outcome.retryAfter } }
    case 'resting': return { ui: { kind: 'resting', resetAt: outcome.resetAt } }
    case 'invalid': return { ui: { kind: 'input', notice: 'input.tooLong' } }
    case 'error': return { ui: { kind: 'notJudged', message: outcome.message } }
  }
}
