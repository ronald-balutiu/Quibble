import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { gameIds, type GameId } from '@shared/games'
import type { PuzzleIndex } from '@shared/schemas/puzzle'
import { usePageMeta } from '@/app/use-page-meta'
import { en, format } from '@/copy/en'
import { loadPuzzleIndex } from '@/lib/puzzles'
import { JudgesCompare } from '@/components/JudgesCompare/JudgesCompare'
import { RingMark } from '@/components/RingMark/RingMark'
import { SettingsButton } from '@/components/SettingsDrawer/SettingsDrawer'
import { totalScore } from '@/games/oddly-specific/reducer'
import { loadProgress } from '@/lib/storage/progress'
import '../scenes.css'

// The primary action (5.5 H1, H2): continue an open run, else the next unplayed
// puzzle in a game already played, else Play for a first visit.
function primaryAction(index: PuzzleIndex | undefined) {
  const puzzles = gameIds.flatMap((game) => (index?.[game] ?? []).map(({ n }) => ({ game, n, progress: loadProgress(game, n) })))
  const open = puzzles.find(({ progress }) => progress.run !== undefined)
  if (open?.progress.run) {
    const { run } = open.progress
    const escape = open.game === 'category-escape'
    return {
      to: `/play/${open.game}/${String(open.n)}`,
      label: format('home.continue', { n: String(open.n).padStart(3, '0'), game: en[`game.name.${open.game}`] }),
      line: format(escape ? 'home.continueLine.level' : 'home.continueLine', { round: run.current + 1, total: run.rounds.length, points: totalScore(run) }),
    }
  }
  const played = gameIds.find((game) => puzzles.some((p) => p.game === game && p.progress.best !== undefined))
  const next = played && puzzles.find((p) => p.game === played && p.progress.best === undefined)
  if (next) return { to: `/play/${next.game}/${String(next.n)}`, label: format('home.next', { game: en[`game.name.${next.game}`], n: String(next.n).padStart(3, '0') }) }
  return { to: '/play', label: en['home.play'] }
}

const solvedIn = (index: PuzzleIndex | undefined, game: GameId) => (index?.[game] ?? []).filter(({ n }) => loadProgress(game, n).best !== undefined).length

// H1 / H2: the pitch, one primary action, the three games, and "How the judges
// compare" (H3), collapsed.
export function HomeScene() {
  usePageMeta(en['meta.title.home'])
  const [index, setIndex] = useState<PuzzleIndex | undefined>()
  const [healthy, setHealthy] = useState<boolean | undefined>()
  useEffect(() => {
    void loadPuzzleIndex().then(setIndex)
    void fetch('/api/health').then((response) => { setHealthy(response.ok) }, () => { setHealthy(false) })
  }, [])

  const action = primaryAction(index)

  return (
    <main className="app-frame scene" data-scene="home">
      <header className="scene-header scene-header--cells">
        <span className="telemetry scene-header__name">{en['app.name']}</span>
        <Link className="telemetry scene-header__link control-link" to="/about">{en['nav.about']}</Link>
        <SettingsButton />
      </header>
      {/* Phone: text, mark, then play. Desktop (H1): text and play beside a larger mark. */}
      <div className="home-top">
        <section className="home-hero">
          <p className="telemetry">{en['home.eyebrow']}</p>
          <h1 className="home-hero__title">{en['home.title']}</h1>
          <p className="home-hero__lede">
            <span className="home-hero__lede--phone">{en['home.lede']}</span>
            <span className="home-hero__lede--desktop">{en['home.lede.desktop']}</span>
          </p>
        </section>
        <div className="home-mark"><RingMark /></div>
        <section className="home-play">
          <Link className="pill pill--wide control-link" to={action.to}>{action.label}</Link>
          <Link className="pill pill--quiet control-link home-play__library" to="/play">{en['nav.library']}</Link>
          {action.line && <p className="telemetry home-play__line">{action.line}</p>}
        </section>
      </div>
      <section className="home-games" aria-label={en['home.games']}>
        {gameIds.map((game) => {
          const total = index?.[game]?.length ?? 0
          const solved = solvedIn(index, game)
          return (
            <Link key={game} className="home-game" to={`/play?game=${game}`}>
              <span className="telemetry home-game__meta">
                <span>{en[`game.code.${game}`]}</span>
                {/* A first visit shows the library size; a returning player, progress (H1, H2). */}
                <span>{solved > 0 ? format('home.solved', { solved: String(solved).padStart(3, '0'), total }) : format('home.puzzles', { count: total })}</span>
              </span>
              <span className="home-game__name">{en[`game.name.${game}`]}</span>
              <span className="muted">{en[`game.tagline.${game}`]}</span>
              {solved > 0 && (
                // eslint-disable-next-line react/forbid-dom-props -- the line's length is the player's progress.
                <span className="home-game__progress" style={{ '--solved': solved / total } as CSSProperties} aria-hidden="true" />
              )}
            </Link>
          )
        })}
      </section>
      <JudgesCompare />
      <footer className="scene-footer telemetry">
        <span>{en['home.footer']}</span>
        {healthy !== undefined && <span>{en[healthy ? 'home.status.ok' : 'home.status.down']}</span>}
      </footer>
    </main>
  )
}
