import { gameIds } from '@shared/games'
import { usePageMeta } from '@/app/use-page-meta'
import { en } from '@/copy/en'
import { useEvalResults } from '@/lib/eval-results'
import { AboutSection } from './AboutSection'
import { HowToPlay } from './HowToPlay'
import { JudgeTest } from './JudgeTest'
import { PuzzleMaking } from './PuzzleMaking'
import { YouVsJudges } from './YouVsJudges'
import { examples } from './about-facts'
import './about.css'

// P1: the case study (owner-approved 2026-11-03). Each section pairs a few sentences
// with something to look at: example answers, a round played step by step, an example
// tally, the answer-key results as bars, and a slice of the factory's truth table.
// Every visual repeats what its text or labels say, so it reads the same without it.

const sentOut = [
  'about.privacy.out.guesses',
  'about.privacy.out.turnstile',
  'about.privacy.out.analytics',
  'about.privacy.out.model',
] as const
const keptHere = ['about.privacy.kept.progress', 'about.privacy.kept.tally', 'about.privacy.kept.settings'] as const

export function AboutScene() {
  usePageMeta(en['meta.title.about'])
  const { data: results } = useEvalResults()

  return (
    <main className="app-frame scene about" data-scene="about">
      <header className="about__intro">
        <h1 className="about__title">{en['about.title']}</h1>
        <p className="about__lede">{en['about.lede']}</p>
      </header>

      <AboutSection n={1} labelKey="about.games" headingKey="about.games.title">
        <ul className="about-games">
          {gameIds.map((game) => (
            <li key={game} className="about-card about-games__game" data-game={game}>
              <h3>{en[`game.name.${game}`]}</h3>
              <p>{en[`about.games.${game}`]}</p>
              <dl className="about-games__example" aria-label={en['about.games.example']}>
                {examples[game].steps.map(({ rules, answer }) => (
                  <div key={rules}>
                    <dt>{en[rules]}</dt>
                    <dd>
                      <span aria-hidden="true">{en['about.arrow']}</span> {en[answer]}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </AboutSection>

      <HowToPlay n={2} />
      <YouVsJudges n={3} />
      <JudgeTest n={4} results={results} />
      <PuzzleMaking n={5} />

      <AboutSection n={6} id="privacy" labelKey="about.privacy" headingKey="about.privacy.title">
        <div className="about-privacy">
          <div className="about-card">
            <h3>{en['about.privacy.out']}</h3>
            <ul>
              {sentOut.map((item) => (
                <li key={item}>{en[item]}</li>
              ))}
            </ul>
          </div>
          <div className="about-card">
            <h3>{en['about.privacy.kept']}</h3>
            <ul>
              {keptHere.map((item) => (
                <li key={item}>{en[item]}</li>
              ))}
            </ul>
            <p className="about__note">{en['about.privacy.kept.note']}</p>
          </div>
        </div>
        <p className="about__note">{en['about.privacy.footer']}</p>
      </AboutSection>

      <AboutSection n={7} labelKey="about.credits">
        <p>
          {en['about.credits.body']} <a href="https://github.com/ronald-balutiu/Quibble">{en['about.source']}</a>
        </p>
      </AboutSection>
    </main>
  )
}
