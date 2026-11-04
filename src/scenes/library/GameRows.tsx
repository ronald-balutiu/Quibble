import { gameIds, type GameId } from '@shared/games'
import { en, format, puzzleNumber } from '@/copy/en'

// The Library's game switcher: each game's code, name, tagline and how many of its
// puzzles have been played. The current game is marked as the page.
export function GameRows({
  game,
  counts,
  onSelect,
}: {
  game: GameId
  counts: Record<GameId, { total: number; played: number }>
  onSelect: (game: GameId) => void
}) {
  return (
    <nav className="game-rows" aria-label={en['home.games']}>
      {gameIds.map((id) => (
        <button
          key={id}
          type="button"
          className="game-row"
          data-game={id}
          aria-current={id === game ? 'page' : undefined}
          onClick={() => {
            if (id !== game) onSelect(id)
          }}
        >
          <span className="telemetry">{en[`game.code.${id}`]}</span>
          <span className="game-row__name">{en[`game.name.${id}`]}</span>
          <span className="muted game-row__tagline">{en[`game.tagline.${id}`]}</span>
          <span className="telemetry">
            {counts[id].total === 0
              ? en['library.new']
              : format('library.progress', {
                  solved: puzzleNumber(counts[id].played),
                  total: puzzleNumber(counts[id].total),
                })}
          </span>
        </button>
      ))}
    </nav>
  )
}
