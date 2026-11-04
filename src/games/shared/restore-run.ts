import { gameConfigs } from '@shared/games'
import type { Puzzle } from '@shared/schemas/puzzle'
import type { RunState } from './run'

// Saved records have already passed their frozen shape schema. Check whether the
// run can actually be resumed with this puzzle; the caller retains its best score.
export function usableRun(puzzle: Puzzle, run: RunState | undefined): RunState | undefined {
  if (run?.rounds.length !== puzzle.rounds.length || run.current >= run.rounds.length) return undefined
  const config = gameConfigs[puzzle.game]
  const escape = config.id === 'category-escape'
  let strikes = 0
  for (const [i, round] of run.rounds.entries()) {
    strikes += round.strikes
    const limit = escape ? config.maxWrongGuessesPerRun : config.maxWrongGuessesPerRound
    const conditionIds = new Set(puzzle.rounds[i]?.conditions.map(({ id }) => id))
    if (round.strikes > limit || round.guesses.some(({ failed }) => failed.some((id) => !conditionIds.has(id))))
      return undefined
    if (i < run.current && (escape ? round.status !== 'solved' : round.status === 'playing')) return undefined
    if (
      i > run.current &&
      (round.status !== 'playing' ||
        round.guesses.length > 0 ||
        round.strikes > 0 ||
        round.pending ||
        round.overruled ||
        round.points > 0)
    )
      return undefined
    if (round.pending && (i !== run.current || round.status !== 'playing' || round.guesses.at(-1)?.pass !== false))
      return undefined
    if (round.status === 'solved' && (!round.guesses.length || (!round.overruled && !round.guesses.at(-1)?.pass)))
      return undefined
    if (round.overruled && round.status !== 'solved') return undefined
    if (round.points !== (round.status === 'solved' ? (escape ? 1 : (config.pointsByGuess[round.strikes] ?? 0)) : 0))
      return undefined
  }
  if (run.finished) {
    if (run.rounds[run.current]?.status === 'playing') return undefined
    if ((!escape || run.rounds[run.current]?.status === 'solved') && run.current !== run.rounds.length - 1)
      return undefined
  } else if (escape && (strikes >= config.maxWrongGuessesPerRun || run.rounds[run.current]?.status !== 'playing'))
    return undefined
  return run
}
