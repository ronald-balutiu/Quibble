import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { gameIds, type GameId } from '@shared/games'
import type { Puzzle } from '@shared/schemas/puzzle'
import { usePageMeta } from '@/app/use-page-meta'
import { en, format } from '@/copy/en'
import { EscapeGame } from '@/games/category-escape/Screen'
import { RoundGame } from '@/games/rounds/Game'
import { loadPuzzle } from '@/lib/puzzles'
import './game.css'

export function GameScene() {
  const params = useParams()
  const game = gameIds.find((id) => id === params.game)
  const n = Number(params.n)
  const playable = game !== undefined && Number.isInteger(n) && n > 0
  return <PuzzleRoute key={`${params.game ?? ''}-${params.n ?? ''}`} game={game} n={n} playable={playable} />
}

function PuzzleRoute({ game, n, playable }: { game: GameId | undefined, n: number, playable: boolean }) {
  const [puzzle, setPuzzle] = useState<Puzzle | null | undefined>(undefined)
  // A path that names no puzzle is a not-found page for search engines.
  usePageMeta(
    game && playable ? format('meta.title.game', { game: en[`game.name.${game}`], n: String(n).padStart(3, '0') }) : en['meta.title.notFound'],
    { indexable: playable && puzzle !== null },
  )

  useEffect(() => {
    if (!playable || !game) return
    let live = true
    void loadPuzzle(game, n).then((loaded) => { if (live) setPuzzle(loaded ?? null) })
    return () => { live = false }
  }, [playable, game, n])

  if (playable && puzzle === undefined) return <main data-scene="game" className="app-frame game-frame" aria-busy="true"><p>{en['game.loading']}</p></main>
  if (!playable || !puzzle) return <main data-scene="game" className="app-frame game-frame"><p>{en['game.notFound']}</p><Link className="control-link" to="/play">{en['nav.library']}</Link></main>
  if (puzzle.game === 'category-escape') return <EscapeGame puzzle={puzzle} />
  return <RoundGame puzzle={puzzle} />
}
