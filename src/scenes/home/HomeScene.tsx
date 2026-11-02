import { Link } from 'react-router'
import { gameIds } from '@shared/games'
import { usePageMeta } from '@/app/use-page-meta'
import { GameExample } from '@/components/GameExample/GameExample'
import { JudgesCompare } from '@/components/JudgesCompare/JudgesCompare'
import { RingMark } from '@/components/RingMark/RingMark'
import { en } from '@/copy/en'
import '../scenes.css'
import './home.css'

export function HomeScene() {
  usePageMeta(en['meta.title.home'])

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
              <GameExample game={game} />
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
      <JudgesCompare collapsible />
    </main>
  )
}
