import type { GameId } from '@shared/games'
import { isValidAnswer, normalizeAnswer } from '@shared/normalize'
import { usedOn } from '@/games/category-escape/reducer'
import { previousGuess, type RunState } from '@/games/rounds/reducer'
import type { Ui } from './judge-guess'

// Local checks never call a judge or cost a strike. An earlier verdict is shown
// again; Category Escape also prevents reusing an answer that cleared a level.
export function checkAnswer(text: string, game: GameId, run: RunState): { normalized: string, ui?: Ui } {
  const normalized = normalizeAnswer(text, game)
  if (!normalized) return { normalized, ui: { kind: 'input', notice: 'input.empty' } }
  if (!isValidAnswer(normalized, game)) return { normalized, ui: { kind: 'input', notice: 'input.tooLong' } }
  if (game === 'category-escape') {
    const level = usedOn(run, normalized)
    if (level !== undefined) return { normalized, ui: { kind: 'reused', level } }
  }
  const earlier = previousGuess(run, normalized)
  if (earlier) return { normalized, ui: earlier.pass ? { kind: 'input', notice: 'input.repeat' } : { kind: 'rejected', guess: earlier } }
  return { normalized }
}
