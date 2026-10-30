import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { format } from '@/copy/en'
import type { Guess } from '@/games/oddly-specific/reducer'
import { letterFor, rejectedSentence } from '@/scenes/game/verdict'

// "battery fits B, not A." when exactly one meaning fits; otherwise the usual sentence.
export function agentSentence(guess: Guess, conditions: readonly PuzzleCondition[]): string {
  const fits = conditions.map((condition, i) => ({ letter: letterFor(i), fits: !guess.failed.includes(condition.id) }))
  const yes = fits.find((side) => side.fits)
  const no = fits.find((side) => !side.fits)
  if (fits.length !== 2 || !yes || !no) return rejectedSentence(guess, conditions)
  const sentence = format('verdict.agent.oneSide', { word: guess.answer, fits: yes.letter, misses: no.letter })
  return guess.closeCall ? sentence + format('verdict.closeCall') : sentence
}
