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
export function progressText(
  game: GameId,
  key: 'library.continue' | 'sheet.resume',
  values: Record<string, string | number>,
): string {
  return format(game === 'category-escape' ? `${key}.level` : key, values)
}

export function statusOf(
  game: GameId,
  saved: Progress,
): { status: Status; best?: number; round?: number; progress?: { done: number; total: number } } {
  const { best, run } = saved
  if (run && !run.finished && hasProgressActivity({ run }))
    return {
      status: 'open',
      round: run.current + 1,
      progress: { done: run.rounds.filter(({ status }) => status !== 'playing').length, total: run.rounds.length },
      ...(best === undefined ? {} : { best }),
    }
  if (best === undefined) return { status: 'unplayed' }
  return { status: best === maxFor(game) ? 'perfect' : 'solved', best }
}

export type PuzzleStatus = ReturnType<typeof statusOf>
export type LibraryEntry = NonNullable<PuzzleIndex[GameId]>[number] & PuzzleStatus

// One read per puzzle per storage revision, shared by tiles and game summaries.
export function libraryEntries(index: PuzzleIndex, load = loadProgress) {
  return Object.fromEntries(
    gameIds.map((game) => [
      game,
      (index[game] ?? []).map((entry) => ({ ...entry, ...statusOf(game, load(game, entry.n)) })),
    ]),
  ) as Record<GameId, LibraryEntry[]>
}

// What the Library says about one game: its counts, the run to continue, and the
// unplayed puzzles that Start and Shuffle pick from.
export function summarize(entries: readonly LibraryEntry[]) {
  const count = (status: Status) => entries.filter((entry) => entry.status === status).length
  return {
    solved: count('solved') + count('perfect'),
    open: count('open'),
    perfect: count('perfect'),
    // A best score of zero still counts as played (5.5 L1).
    played: entries.filter(({ best }) => best !== undefined).length,
    continuing: entries.find(({ status }) => status === 'open'),
    unplayed: entries.filter(({ status }) => status === 'unplayed'),
  }
}

// Every game's puzzle count and how many have been played, for the game rows.
export function gameCounts(index: PuzzleIndex | undefined, entries: Record<GameId, LibraryEntry[]> | undefined) {
  return Object.fromEntries(
    gameIds.map((game) => [
      game,
      { total: index?.[game]?.length ?? 0, played: summarize(entries?.[game] ?? []).played },
    ]),
  ) as Record<GameId, { total: number; played: number }>
}

export const filters = ['all', 'easy', 'hard', 'unplayed'] as const
export type Filter = (typeof filters)[number]

export const matchesFilter = (entry: LibraryEntry, filter: Filter) =>
  filter === 'all' || (filter === 'unplayed' ? entry.status === 'unplayed' : entry.difficulty === filter)

// Shuffle unplayed: one entry at random, or undefined when there are none.
export const pickAtRandom = <T>(list: readonly T[], random: () => number = Math.random): T | undefined =>
  list[Math.floor(random() * list.length)]
