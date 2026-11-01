import { Link, Navigate, useSearchParams } from 'react-router'
import { gameIds } from '@shared/games'
import { usePageMeta } from '@/app/use-page-meta'
import { CloudModelChoice } from '@/components/JudgeSetup/CloudModelChoice'
import { DeviceJudgeCard } from '@/components/JudgeSetup/DeviceJudgeCard'
import { JudgesCompare } from '@/components/JudgesCompare/JudgesCompare'
import { RingMark } from '@/components/RingMark/RingMark'
import { en } from '@/copy/en'
import { hasPlayed } from '@/lib/storage/progress'
import '../scenes.css'
import './home.css'

export function HomeScene() {
  usePageMeta(en['meta.title.home'])
  const [params] = useSearchParams()
  if (!params.has('home') && hasPlayed()) return <Navigate to="/play" replace />

  return (
    <main className="app-frame scene welcome" data-scene="home">
      <div className="welcome-top">
        <section className="welcome-hero">
          <p className="telemetry">{en['welcome.eyebrow']}</p>
          <h1>{en['home.title']}</h1>
          <p className="welcome-lede">{en['welcome.lede']}</p>
          <div className="welcome-actions">
            <Link className="pill control-link" to="/play">{en['welcome.choose']}</Link>
          </div>
        </section>
        <div className="welcome-mark"><RingMark /></div>
      </div>
      <section className="welcome-section" id="games" aria-labelledby="welcome-games">
        <h2 id="welcome-games">{en['welcome.games']}</h2>
        <div className="welcome-games">
          {gameIds.map((game) => (
            <article className="welcome-game" data-game={game} key={game}>
              <p className="telemetry welcome-game__label">{en[`game.name.${game}`]}</p>
              <h3>{en[`welcome.${game}.title`]}</h3>
              <p>{en[`welcome.${game}.body`]}</p>
              <div className="welcome-example">
                <ol>
                  <li>{en[`welcome.${game}.example.1`]}</li>
                  <li>{en[`welcome.${game}.example.2`]}</li>
                  {game !== 'double-agent' && <li>{en[`welcome.${game}.example.3`]}</li>}
                </ol>
                <p>{en[`welcome.${game}.answer`]}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="welcome-section" aria-labelledby="welcome-scoring">
        <h2 id="welcome-scoring">{en['welcome.scoring']}</h2>
        <div className="welcome-scores">
          <div>
            <h3>{en['welcome.scoring.rounds']}</h3>
            <ol className="welcome-points">
              <li>{en['welcome.scoring.first']}</li>
              <li>{en['welcome.scoring.second']}</li>
              <li>{en['welcome.scoring.third']}</li>
            </ol>
            <p>{en['welcome.scoring.rounds.body']}</p>
          </div>
          <div><h3>{en['game.name.category-escape']}</h3><p>{en['welcome.scoring.escape.body']}</p></div>
        </div>
        <details className="welcome-detail"><summary>{en['welcome.overrule']}</summary><p>{en['welcome.overrule.body']}</p></details>
      </section>
      <section className="welcome-section" aria-labelledby="welcome-judges">
        <h2 id="welcome-judges">{en['welcome.judges']}</h2>
        <p>{en['welcome.judges.body']}</p>
        <div className="judge-setup"><CloudModelChoice /><DeviceJudgeCard /></div>
        <details className="welcome-detail"><summary>{en['welcome.privacy']}</summary><p>{en['welcome.privacy.body']} <Link to="/about#privacy">{en['nav.privacy']}</Link></p></details>
      </section>
      <section className="welcome-section welcome-finish">
        <div><h2>{en['welcome.ready']}</h2><p>{en['welcome.ready.body']}</p></div>
        <Link className="pill control-link" to="/play">{en['welcome.choose']}</Link>
      </section>
      <JudgesCompare collapsible />
    </main>
  )
}
