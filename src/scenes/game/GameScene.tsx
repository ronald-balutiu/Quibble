import { useCallback } from 'react'
import { Link, useParams } from 'react-router'
import { gameIds, type GameId } from '@shared/games'
import { usePageMeta } from '@/app/use-page-meta'
import { en, format, puzzleNumber } from '@/copy/en'
import { EscapeGame } from '@/games/category-escape/EscapeGame'
import { RoundGame } from '@/games/rounds/RoundGame'
import { libraryPath } from '@/lib/paths'
import { loadPuzzle } from '@/lib/puzzles'
import { useResource } from '@/lib/use-resource'
import '@/games/shared/game.css'

export function GameScene() {
  const params = useParams()
  const game = gameIds.find((id) => id === params.game)
  const n = Number(params.n)
  const playable = game !== undefined && Number.isInteger(n) && n > 0
  return <PuzzleRoute key={`${params.game ?? ''}-${params.n ?? ''}`} game={game} n={n} playable={playable} />
}

function PuzzleRoute({ game, n, playable }: { game: GameId | undefined; n: number; playable: boolean }) {
  const load = useCallback(
    () => (game && playable ? loadPuzzle(game, n) : Promise.resolve({ kind: 'missing' } as const)),
    [game, n, playable],
  )
  const { data: result, retry } = useResource(load)
  const missing = !playable || result?.kind === 'missing'
  usePageMeta(
    game && playable
      ? format('meta.title.game', { game: en[`game.name.${game}`], n: puzzleNumber(n) })
      : en['meta.title.notFound'],
    { indexable: !missing },
  )

  if (playable && result === undefined)
    return (
      <main data-scene="game" className="app-frame game-frame" aria-busy="true">
        <p>{en['game.loading']}</p>
      </main>
    )
  if (missing)
    return (
      <main data-scene="game" className="app-frame game-frame">
        <p>{en['game.notFound']}</p>
        <Link className="control-link" to={libraryPath()}>
          {en['nav.library']}
        </Link>
      </main>
    )
  if (result?.kind !== 'loaded')
    return (
      <main data-scene="game" className="app-frame game-frame">
        <p role="status">{en['load.unavailable']}</p>
        <button type="button" className="pill" onClick={retry}>
          {en['action.retry']}
        </button>
        <Link className="control-link" to={libraryPath()}>
          {en['nav.library']}
        </Link>
      </main>
    )
  const { puzzle } = result
  if (puzzle.game === 'category-escape') return <EscapeGame puzzle={puzzle} />
  return <RoundGame puzzle={puzzle} />
}
