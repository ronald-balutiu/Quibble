import type { GameId } from '@shared/games'
import type { CloudModel, JudgeSuccess } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import type { Guess } from '@/games/rounds/reducer'
import { judgeOnCloud, type CloudMessage } from '@/judges/attempt'
import { deviceJudge, type DeviceJudge, type ScoreResult } from '@/judges/device/client'
import { saveComparison, type Comparison } from '@/lib/storage/comparisons'
import { renewSession } from '@/lib/turnstile'
import { devicePasses, toDeviceGuess, toGuess } from './verdict'

// One guess, shared by every game screen, and the game screen's UI state. The
// cloud judge is the referee (D-07); when the on-device judge is on it scores the
// same claims alongside, and its result is shown but never scores (3.7).

export type Ui =
  | { kind: 'input', notice?: 'input.empty' | 'input.tooLong' | 'input.repeat' }
  | { kind: 'judging' }
  | { kind: 'rejected', guess: Guess }
  | { kind: 'notJudged', message: CloudMessage | 'cloud.busy' | 'judge.device.timeout', retryAfter?: number }
  | { kind: 'resting', resetAt: string }
  | { kind: 'reused', level: number }

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
  // `retry` re-runs only the device; absent when the device was deciding, since then
  // the whole guess is retried (G7).
  | { kind: 'timeout' | 'error', retry?: () => void }

// The comparison record for a guess both judges answered (3.8).
export function toComparison(
  turn: JudgeTurn, cloud: JudgeSuccess, cloudMs: number, device: { scores: Record<string, number>, ms: number, warm: boolean }, at: number, referee: Referee = 'cloud',
): Comparison {
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
    backend: 'webgpu', precision: 'q4', warm: device.warm, referee, overruled: false,
  }
}

export type Referee = 'cloud' | 'device'

interface JudgeWatchers {
  // Read at the start of each guess, so a settings change applies from the next one (3.7).
  referee?: Referee
  // The referee's scores, drawn as soon as they arrive (5.5 G2).
  onCloud?: (scores: Record<string, number | undefined>, modelMs: number) => void
  // The on-device run: scanning, then its scores or a timeout.
  onDevice?: (run: DeviceRun) => void
  device?: DeviceJudge
}

const scoresOf = (result: JudgeSuccess) => Object.fromEntries(Object.entries(result.conditions).map(([id, { p }]) => [id, p]))

// Which judge decided a guess, and when the cloud is resting, until when (S1, S2).
// `cloudMessage`: the cloud failed while the device refereed, so only its column
// says so (3.12). `notScored`: the guess wasn't judged, but this judge answered
// and its verdict is shown, not scored (G7).
interface Decision { decidedBy: Referee, restingUntil?: string, cloudMessage?: CloudMessage }
export type GuessOutcome = ({ guess: Guess, scores: Record<string, number | undefined> } & Decision) | { ui: Ui, restingUntil?: string, notScored?: Referee }

// The verdict for a guess that passed the local checks: a reducer guess with its
// scores, or the panel to show instead. No outcome here ever costs a strike. It
// resolves only once both judges have answered or timed out (3.7, D-83), so the
// screen moves on with everything back; the cloud's scores are drawn before that.
// The on-device judge decides when it's the referee, or when the cloud is out of
// usage (busy or resting); a verdict without the cloud's isn't compared (3.7, S1).
export async function judgeGuess(
  turn: JudgeTurn, { referee = 'cloud', onCloud = () => undefined, onDevice = () => undefined, device = deviceJudge }: JudgeWatchers = {},
): Promise<GuessOutcome> {
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
  const cloudOut = outcome.kind === 'busy' || outcome.kind === 'resting'
  // When the device decides, a device failure retries the whole guess (G7), not just its column.
  const deviceDecides = cloudOut || referee === 'device'
  const restingUntil = outcome.kind === 'resting' ? outcome.resetAt : undefined
  let deviceResult: ScoreResult | undefined
  const follow = (run: Promise<ScoreResult>): Promise<void> =>
    run.then((result) => {
      deviceResult = result
      if (result.kind !== 'scored') {
        // Only the device column says so; its Retry scores the same answer again (5.5 G7).
        onDevice(deviceDecides ? { kind: result.kind } : { kind: result.kind, retry: () => { onDevice({ kind: 'scanning', started: performance.now() }); void follow(device.score(turn.normalized, claims)) } })
        return
      }
      if (outcome.kind !== 'judged') { onDevice({ kind: 'scored', scores: result.scores, ms: result.ms }); return }
      const record = toComparison(turn, outcome.result, cloudMs, result, Date.now(), referee)
      saveComparison(record)
      const verdicts = Object.values(record.conditions)
      onDevice({
        kind: 'scored', scores: result.scores, ms: result.ms,
        agreed: verdicts.filter(({ cloudPass, devicePass }) => cloudPass === devicePass).length, compared: verdicts.length,
      })
    })
  if (outcome.kind === 'judged') onCloud(scoresOf(outcome.result), outcome.result.modelMs)
  if (deviceRun) await follow(deviceRun)
  const resting = restingUntil === undefined ? {} : { restingUntil }
  if (outcome.kind === 'invalid') return { ui: { kind: 'input', notice: 'input.tooLong' } }
  if (deviceDecides && deviceResult) {
    const cloudScores = outcome.kind === 'judged' ? scoresOf(outcome.result) : {}
    if (deviceResult.kind !== 'scored') {
      return { ui: { kind: 'notJudged', message: 'judge.device.timeout' }, ...resting, ...(outcome.kind === 'judged' ? { notScored: 'cloud' as const } : {}) }
    }
    return {
      guess: toDeviceGuess(turn.normalized, deviceResult.scores, turn.conditions), scores: cloudScores, decidedBy: 'device', ...resting,
      ...(outcome.kind === 'error' ? { cloudMessage: outcome.message } : {}),
    }
  }
  const deviceAnswered = deviceResult?.kind === 'scored' ? { notScored: 'device' as const } : {}
  switch (outcome.kind) {
    case 'judged': return {
      guess: toGuess(turn.normalized, outcome.result, turn.conditions, turn.model),
      scores: scoresOf(outcome.result),
      decidedBy: 'cloud',
    }
    case 'busy': return { ui: { kind: 'notJudged', message: 'cloud.busy', retryAfter: outcome.retryAfter } }
    case 'resting': return { ui: { kind: 'resting', resetAt: outcome.resetAt }, ...resting }
    case 'error': return { ui: { kind: 'notJudged', message: outcome.message }, ...deviceAnswered }
  }
}
