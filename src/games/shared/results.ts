import type { GameId } from '@shared/games'
import { en, format } from '@/copy/en'

// The results screens' best-score note and share text (5.5 G6, E2).

export function bestNote(score: number, best: number | undefined): string {
  if (best === undefined) return en['results.firstPlay']
  return format(score > best ? 'results.newBest' : 'results.best', { n: best })
}

export function shareText(
  game: GameId,
  n: number,
  grid: { tiles: string; text: string },
  score: number,
  max: number,
): string {
  return `${format('results.share', { game: en[`game.name.${game}`], n, tiles: grid.tiles, score, max })}\n${grid.text}`
}
