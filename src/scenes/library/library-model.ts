import { gameConfigs, gameIds, type GameId } from '@shared/games'
import type { PuzzleIndex } from '@shared/schemas/puzzle'
import { format } from '@/copy/en'
import { maxScore } from '@/games/rounds/reducer'
import { hasProgressActivity, loadProgress, type Progress } from '@/lib/storage/progress'

export type Status = 'unplayed' | 'open' | 'solved' | 'perfect'
// A perfect score: 15/15 or 9/9 points, or 6/6 levels for Category Escape (5.5 L1).
export function maxFor(game: GameId): number {
  const config = gameConfigs[game]
  return 'levels' in config ? config.levels : maxScore(config)
}

// Category Escape counts levels where the other games count rounds (D-78).
export function progressText(game: GameId, key: 'library.continue' | 'sheet.resume', values: Record<string, string | number>): string {
  return format(game === 'category-escape' ? `${key}.level` : key, values)
}

export function statusOf(game: GameId, saved: Progress): { status: Status, best?: number, round?: number, progress?: { done: number, total: number } } {
  const { best, run } = saved
  if (run && !run.finished && hasProgressActivity({ run })) return {
    status: 'open', round: run.current + 1,
    progress: { done: run.rounds.filter(({ status }) => status !== 'playing').length, total: run.rounds.length },
    ...(best === undefined ? {} : { best }),
  }
  if (best === undefined) return { status: 'unplayed' }
  return { status: best === maxFor(game) ? 'perfect' : 'solved', best }
}

// One read per puzzle per storage revision, shared by tiles and game summaries.
export function libraryEntries(index: PuzzleIndex, load = loadProgress) {
  return Object.fromEntries(gameIds.map((game) => [game,
    (index[game] ?? []).map((entry) => ({ ...entry, ...statusOf(game, load(game, entry.n)) })),
  ])) as Record<GameId, (NonNullable<PuzzleIndex[GameId]>[number] & ReturnType<typeof statusOf>)[]>
}
