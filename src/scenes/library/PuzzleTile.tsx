import type { GameId } from '@shared/games'
import { en, format } from '@/copy/en'
import { maxFor, type LibraryEntry } from './library-model'

// One puzzle in the Game Selector (5.5 L1): its number, then a progress bar while a
// run is open, or the check and best score once played. The button's name starts
// with the visible number, so speech input can say it (WCAG 2.5.3).
export function PuzzleTile({ game, entry, onSelect }: { game: GameId; entry: LibraryEntry; onSelect: () => void }) {
  const { n, difficulty, status, best, progress } = entry
  return (
    <button type="button" className={`tile tile--${status}`} onClick={onSelect}>
      <span className="tile__n">{n}</span>
      {progress ? (
        <>
          <progress className="tile__progress" value={progress.done} max={progress.total} aria-hidden="true" />
          <span className="visually-hidden">
            {format(game === 'category-escape' ? 'library.levelProgress' : 'library.roundProgress', progress)}
          </span>
        </>
      ) : (
        <span className="tile__bottom">
          {(status === 'solved' || status === 'perfect') && (
            <span className="tile__check" aria-hidden="true">
              {en['library.completedMark']}
            </span>
          )}
          <span className="tile__score">{status === 'perfect' ? en['library.perfectMark'] : best}</span>
        </span>
      )}
      <span className="visually-hidden">
        {format('library.tile', {
          difficulty: en[`difficulty.${difficulty}`],
          status: format(`library.status.${status}`, { best: best ?? 0, max: maxFor(game) }),
        })}
      </span>
    </button>
  )
}
