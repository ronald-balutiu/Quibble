import { Link } from 'react-router'
import type { GameId } from '@shared/games'
import { en, format, puzzleNumber } from '@/copy/en'
import { puzzlePath } from '@/lib/paths'
import { progressText, type LibraryEntry } from './library-model'

// The prompt above a game's puzzles: continue the open run, or start the first
// unplayed puzzle. Its note changes once any game has a completed puzzle.
export function LibraryStart({
  game,
  continuing,
  starter,
  hasCompleted,
}: {
  game: GameId
  continuing: LibraryEntry | undefined
  starter: LibraryEntry | undefined
  hasCompleted: boolean
}) {
  const target = continuing ?? starter
  if (!target) return null
  return (
    <div className="library-start">
      <p>{en[continuing ? 'library.continue.note' : hasCompleted ? 'library.next.note' : 'library.start.note']}</p>
      <Link className="pill control-link" to={puzzlePath(game, target.n)}>
        {continuing
          ? progressText(game, 'library.continue', { n: puzzleNumber(continuing.n), round: continuing.round ?? 1 })
          : format('library.start', {
              n: puzzleNumber(target.n),
              difficulty: en[`difficulty.${target.difficulty}`],
            })}
      </Link>
    </div>
  )
}
