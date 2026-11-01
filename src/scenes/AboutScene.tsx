import { Link } from 'react-router'
import { usePageMeta } from '@/app/use-page-meta'
import { SettingsButton } from '@/components/SettingsDrawer/SettingsDrawer'
import { en, format } from '@/copy/en'
import { useEvalResults } from '@/lib/eval-results'
import { usePuzzleIndex } from '@/lib/use-puzzle-index'
import './scenes.css'

const percent = (value: number | undefined) => format('compare.percent', { p: Math.round((value ?? 0) * 100) })

// P1: the case study in four sections (5.5): what this is, how judging works with
// the answer-key results and on-device speed, privacy (1.8) and credits.
export function AboutScene() {
  usePageMeta(en['meta.title.about'])
  const results = useEvalResults()
  const index = usePuzzleIndex()
  const judges = results?.test.judges
  const device = results?.devices[0]
  const puzzles = Object.values(index ?? {}).reduce((sum, list) => sum + list.length, 0)

  return (
    <main className="app-frame scene about" data-scene="about">
      <header className="scene-header scene-header--cells">
        <Link className="telemetry scene-header__name control-link" to="/?home=1">{en['app.name']}</Link>
        <span className="telemetry scene-header__end">{en['nav.about']}</span>
        <Link className="telemetry scene-header__link control-link" to="/play">{en['about.play']}</Link>
        <SettingsButton />
      </header>
      <h1 className="about__title">{en['about.title']}</h1>
      <section className="about__section" aria-labelledby="about-what">
        <h2 id="about-what" className="telemetry">{en['about.what']}</h2>
        <p>{en['about.what.body']}</p>
      </section>
      <section className="about__section" aria-labelledby="about-how">
        <h2 id="about-how" className="telemetry">{en['about.how']}</h2>
        <p>{en['about.how.body']}</p>
        {results && judges && (
          <p>
            {format('about.how.results', {
              cases: results.test.cases,
              gemma: percent(judges['gemma-4']?.wholeGuess.value), gemmaFa: percent(judges['gemma-4']?.falseAcceptRate.value),
              clef: percent(judges['clef-flash']?.wholeGuess.value), clefFa: percent(judges['clef-flash']?.falseAcceptRate.value),
              device: percent(judges.device?.wholeGuess.value),
            })}
          </p>
        )}
        {device && (
          <p>{format('about.how.device', { machine: device.machine.replace(/ \(darwin\)$/u, ''), browser: device.browser, load: device.coldLoadSeconds, warm: device.warmGuessMedianMs })}</p>
        )}
      </section>
      <section id="privacy" className="about__section" aria-labelledby="about-privacy">
        <h2 id="about-privacy" className="telemetry">{en['about.privacy']}</h2>
        <p>{en['about.privacy.body']}</p>
      </section>
      <section className="about__section" aria-labelledby="about-credits">
        <h2 id="about-credits" className="telemetry">{en['about.credits']}</h2>
        <p>{en['about.credits.body']} <a href="https://github.com/ronald-balutiu/Quibble">{en['about.source']}</a></p>
      </section>
      <footer className="scene-footer telemetry">
        <span>{format('about.footer', { puzzles, build: (results?.builds.length ?? 0) + 1 })}</span>
      </footer>
    </main>
  )
}
