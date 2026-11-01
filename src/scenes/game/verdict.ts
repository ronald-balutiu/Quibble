import { isCloseCall, judgeConfig, passes } from '@shared/config'
import type { CloudModel, JudgeSuccess } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import type { Guess } from '@/games/oddly-specific/reducer'
import type { DeviceRun } from './judge-guess'

// Turns a judge reply into a reducer guess and the verdict sentence (plan 5.7).

export const letterFor = (index: number) => String.fromCharCode(65 + index)

export const devicePasses = (p: number) => passes(p, judgeConfig.passThreshold.device)

// Whether the on-device judge split from the referee on a judged guess, once both
// answered (5.7); undefined while it hasn't, or when it's off.
export function judgesSplit(run: DeviceRun | undefined, failed: readonly string[], conditions: readonly PuzzleCondition[]): boolean | undefined {
  if (run?.kind !== 'scored' || run.compared === undefined) return undefined
  return conditions.some(({ id }) => {
    const d = run.scores[id]
    return d !== undefined && devicePasses(d) === failed.includes(id)
  })
}

export function toGuess(answer: string, result: JudgeSuccess, conditions: readonly PuzzleCondition[], model: CloudModel): Guess {
  return decide(answer, conditions.map(({ id }) => ({ id, ...result.conditions[id] })), judgeConfig.passThreshold[model])
}

// When the cloud is out of usage, the on-device judge decides with its own threshold (3.7, S1).
export function toDeviceGuess(answer: string, scores: Record<string, number>, conditions: readonly PuzzleCondition[]): Guess {
  const threshold = judgeConfig.passThreshold.device
  return decide(answer, conditions.map(({ id }) => {
    const p = scores[id] ?? 0
    return { id, p, pass: passes(p, threshold) }
  }), threshold)
}

function decide(answer: string, scores: { id: string, p?: number, pass?: boolean }[], threshold: number): Guess {
  const failed = scores.filter(({ pass }) => pass === false).map(({ id }) => id)
  // The deciding score: the lowest for a pass, or the failing score nearest the threshold.
  const deciding = failed.length === 0
    ? Math.min(...scores.map(({ p }) => p ?? 1))
    : Math.max(...scores.filter(({ id }) => failed.includes(id)).map(({ p }) => p ?? 0))
  return {
    answer,
    pass: failed.length === 0 && scores.every(({ pass, p }) => pass ?? (p !== undefined && passes(p, threshold))),
    failed,
    closeCall: isCloseCall(deciding, threshold),
  }
}

// `mark` names a condition in the multi-failure sentence: a letter, or a Category Escape level code.
export function rejectedSentence(guess: Guess, conditions: readonly PuzzleCondition[], mark = letterFor): string {
  const failed = conditions.filter(({ id }) => guess.failed.includes(id))
  const sentence = failed.length === 1 && failed[0]
    ? format('verdict.rejected', { negation: failed[0].negation })
    : format('verdict.rejected.multi', {
        conditions: failed.map((condition) => mark(conditions.indexOf(condition))).join(' and '),
      })
  return guess.closeCall ? sentence + format('verdict.closeCall') : sentence
}

// What the rejected sentence adds about the judges (5.7): a device-only verdict
// isn't compared (S1); otherwise whether they split.
export function verdictNote(column: { decidedBy?: 'cloud' | 'device' | undefined }, split: boolean | undefined): string {
  if (column.decidedBy === 'device') return en['verdict.notCompared']
  return split ? en['verdict.judgesDisagree'] : ''
}
