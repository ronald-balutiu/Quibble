import type { GameId } from '@shared/games'
import type { CloudModel, JudgeSuccess } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import type { Guess } from '@/games/oddly-specific/reducer'
import { judgeOnCloud, type CloudMessage } from '@/judges/attempt'
import { deviceJudge, type DeviceJudge, type ScoreResult } from '@/judges/device/client'
import { saveComparison, type Comparison } from '@/lib/storage/comparisons'
import { renewSession } from '@/lib/turnstile'
import { devicePasses, toGuess } from './verdict'

// One guess, shared by every game screen, and the game screen's UI state. The
// cloud judge is the referee (D-07); when the on-device judge is on it scores the
// same claims alongside, and its result is shown but never scores (3.7).

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

// The on-device column for one guess. `agreed` / `compared` count the conditions
// on which both judges gave the same verdict, once both have answered.
export type DeviceRun =
  | { kind: 'scanning', started: number }
  | { kind: 'scored', scores: Record<string, number>, ms: number, agreed?: number, compared?: number }
  | { kind: 'timeout' | 'error', retry: () => void }

// The comparison record for a guess both judges answered (3.8).
export function toComparison(turn: JudgeTurn, cloud: JudgeSuccess, cloudMs: number, device: { scores: Record<string, number>, ms: number, warm: boolean }, at: number): Comparison {
  const conditions: Comparison['conditions'] = {}
  for (const { id } of turn.conditions) {
    const c = cloud.conditions[id]
    const d = device.scores[id]
    // Three decimals keep more records under the 500 KB limit.
    if (c && d !== undefined) conditions[id] = { cloud: c.p, cloudPass: c.pass, device: Math.round(d * 1000) / 1000, devicePass: devicePasses(d) }
  }
  return {
    at, game: turn.game, n: turn.n, round: turn.roundId, answer: turn.normalized, conditions,
    cloudModel: cloud.model, cloudMs: Math.round(cloudMs), cloudModelMs: Math.round(cloud.modelMs), deviceMs: device.ms,
    backend: 'webgpu', precision: 'q4', warm: device.warm, referee: 'cloud', overruled: false,
  }
}

// The verdict for a guess that passed the local checks: a reducer guess with its
// scores, or the panel to show instead. No outcome here ever costs a strike.
// `onDevice` follows the on-device run, which may finish after the referee.
export async function judgeGuess(
  turn: JudgeTurn, onDevice: (run: DeviceRun) => void = () => undefined, device: DeviceJudge = deviceJudge,
): Promise<{ guess: Guess, scores: Record<string, number | undefined>, modelMs: number } | { ui: Ui }> {
  const { turnstile } = turn
  const started = performance.now()
  const claims = turn.conditions.map(({ id, claim }) => ({ id, claim }))
  const deviceRun = device.ready ? device.score(turn.normalized, claims) : undefined
  if (deviceRun) onDevice({ kind: 'scanning', started })
  const outcome = await judgeOnCloud(
    { game: turn.game, n: turn.n, roundId: turn.roundId, answer: turn.text, attempt: turn.attempt, model: turn.model },
    () => (turnstile ? renewSession(turnstile) : Promise.resolve('error')),
  )
  const cloudMs = performance.now() - started
  const follow = (run: Promise<ScoreResult>) => {
    void run.then((result) => {
      if (result.kind !== 'scored') {
        // Only the device column says so; its Retry scores the same answer again (5.5 G7).
        onDevice({ kind: result.kind, retry: () => { onDevice({ kind: 'scanning', started: performance.now() }); follow(device.score(turn.normalized, claims)) } })
        return
      }
      if (outcome.kind !== 'judged') { onDevice({ kind: 'scored', scores: result.scores, ms: result.ms }); return }
      // Recorded even if the player has moved on (5.5 G2).
      const record = toComparison(turn, outcome.result, cloudMs, result, Date.now())
      saveComparison(record)
      const verdicts = Object.values(record.conditions)
      onDevice({
        kind: 'scored', scores: result.scores, ms: result.ms,
        agreed: verdicts.filter(({ cloudPass, devicePass }) => cloudPass === devicePass).length, compared: verdicts.length,
      })
    })
  }
  if (deviceRun) follow(deviceRun)
  switch (outcome.kind) {
    case 'judged': return {
      guess: toGuess(turn.normalized, outcome.result, turn.conditions, turn.model),
      scores: Object.fromEntries(Object.entries(outcome.result.conditions).map(([id, { p }]) => [id, p])),
      modelMs: outcome.result.modelMs,
    }
    case 'busy': return { ui: { kind: 'notJudged', message: 'cloud.busy', retryAfter: outcome.retryAfter } }
    case 'resting': return { ui: { kind: 'resting', resetAt: outcome.resetAt } }
    case 'invalid': return { ui: { kind: 'input', notice: 'input.tooLong' } }
    case 'error': return { ui: { kind: 'notJudged', message: outcome.message } }
  }
}
