import { isCloseCall, judgeConfig, passes } from '@shared/config'
import type { CloudModel, JudgeSuccess } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { format } from '@/copy/en'
import type { Guess } from '@/games/oddly-specific/reducer'

// Turns a judge reply into a reducer guess and the verdict sentence (plan 5.7).

export const letterFor = (index: number) => String.fromCharCode(65 + index)

export function toGuess(answer: string, result: JudgeSuccess, conditions: readonly PuzzleCondition[], model: CloudModel): Guess {
  const threshold = judgeConfig.passThreshold[model]
  const scores = conditions.map(({ id }) => ({ id, ...result.conditions[id] }))
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

export function rejectedSentence(guess: Guess, conditions: readonly PuzzleCondition[]): string {
  const failed = conditions.filter(({ id }) => guess.failed.includes(id))
  const sentence = failed.length === 1 && failed[0]
    ? format('verdict.rejected', { negation: failed[0].negation })
    : format('verdict.rejected.multi', {
        conditions: failed.map((condition) => letterFor(conditions.indexOf(condition))).join(' and '),
      })
  return guess.closeCall ? sentence + format('verdict.closeCall') : sentence
}
