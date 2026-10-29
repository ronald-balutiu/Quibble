import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { gameIds } from '@shared/games'
import type { PuzzleIndex } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import { loadPuzzleIndex } from '@/lib/puzzles'
import { loadProgress } from '@/lib/storage/progress'
import { RingMark } from '@/components/RingMark/RingMark'
import '../scenes.css'

// H1 / H2: the pitch, one primary action, the three games. H3 (the judge
// comparison) stays hidden until results.json exists (Phase 2 scope).
export function HomeScene() {
  const [index, setIndex] = useState<PuzzleIndex | undefined>()
  useEffect(() => { void loadPuzzleIndex().then(setIndex) }, [])

  const open = gameIds.flatMap((game) => (index?.[game] ?? []).map(({ n }) => ({ game, n })))
    .find(({ game, n }) => loadProgress(game, n).run !== undefined)

  return (
    <main className="app-frame scene" data-scene="home">
      <header className="scene-header scene-header--cells">
        <span className="telemetry scene-header__name">{en['app.name']}</span>
      </header>
      <section className="home-hero">
        <p className="telemetry">{en['home.eyebrow']}</p>
        <h1 className="home-hero__title">{en['home.title']}</h1>
        <p className="home-hero__lede">{en['home.lede']}</p>
      </section>
      <RingMark />
      <section className="home-play">
        <Link className="pill pill--wide control-link" to={open ? `/play/${open.game}/${String(open.n)}` : '/play'}>
          {open ? format('home.continue', { n: String(open.n).padStart(3, '0') }) : en['home.play']}
        </Link>
      </section>
      <section className="home-games" aria-label={en['home.games']}>
        {gameIds.map((game) => (
          <Link key={game} className="home-game" to={`/play?game=${game}`}>
            <span className="telemetry home-game__meta">
              <span>{en[`game.code.${game}`]}</span>
              <span>{format('home.puzzles', { count: index?.[game]?.length ?? 0 })}</span>
            </span>
            <span className="home-game__name">{en[`game.name.${game}`]}</span>
            <span className="muted">{en[`game.tagline.${game}`]}</span>
          </Link>
        ))}
      </section>
    </main>
  )
}
