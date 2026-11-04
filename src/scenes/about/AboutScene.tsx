import type { ReactNode } from 'react'
import { gameIds } from '@shared/games'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import type { ResultsJudge } from '@shared/schemas/eval-results'
import { usePageMeta } from '@/app/use-page-meta'
import { JudgeBar } from '@/components/JudgeBar/JudgeBar'
import { en, format, type CopyKey } from '@/copy/en'
import { useEvalResults } from '@/lib/eval-results'
import { examples, factory, practiceGuesses, tableRows, tableRules, testKinds } from './about-facts'
import './about.css'

// P1: the case study (owner-approved 2026-11-03). Each section pairs a few sentences
// with something to look at: example answers, a round played step by step, an example
// tally, the answer-key results as bars, and a slice of the factory's truth table.
// Every visual repeats what its text or labels say, so it reads the same without it.

const percent = (value: number | undefined) => format('compare.percent', { p: Math.round((value ?? 0) * 100) })
const percentTenths = (value: number | undefined) =>
  format('compare.percent', { p: (Math.round((value ?? 0) * 1000) / 10).toFixed(1) })

// A numbered label above each section's heading; without a heading, the label is one.
function Section({
  n,
  labelKey,
  headingKey,
  id,
  children,
}: {
  n: number
  labelKey: CopyKey
  headingKey?: CopyKey
  id?: string
  children: ReactNode
}) {
  const heading = `about-${String(n)}`
  const eyebrow = format('about.section', { n: String(n).padStart(2, '0'), label: en[labelKey] })
  return (
    <section id={id} className="about__section" aria-labelledby={heading}>
      {headingKey ? (
        <>
          <p className="telemetry">{eyebrow}</p>
          <h2 id={heading}>{en[headingKey]}</h2>
        </>
      ) : (
        <h2 id={heading} className="telemetry">
          {eyebrow}
        </h2>
      )}
      {children}
    </section>
  )
}

// A guess's verdict on rules A–C: marks for the eye, words for screen readers.
function Verdict({ passes }: { passes: readonly boolean[] }) {
  return (
    <ul className="about-verdict">
      {passes.map((pass, i) => {
        const rule = String.fromCharCode(65 + i)
        return (
          <li key={rule} className={pass ? 'about-verdict--pass' : 'about-verdict--fail'}>
            <span aria-hidden="true">{en[pass ? 'about.play.mark.pass' : 'about.play.mark.fail']}</span>
            <span aria-hidden="true">{rule}</span>
            <span className="visually-hidden">{format(pass ? 'about.play.pass' : 'about.play.fail', { rule })}</span>
          </li>
        )
      })}
    </ul>
  )
}

function Guess({ answer }: { answer: CopyKey }) {
  return (
    <p className="about-guess">
      <span>{en[answer]}</span>
      <span className="telemetry" aria-hidden="true">
        {en['game.judge']}
      </span>
    </p>
  )
}

const tally = [
  { guess: 'about.you.row.teaspoon', cloud: true, local: true, you: 'about.you.row.teaspoon.you' },
  { guess: 'about.you.row.duck', cloud: false, local: true, you: 'about.you.row.duck.you' },
  { guess: 'about.you.row.glowstick', cloud: true, local: false, you: 'about.you.row.glowstick.you' },
] as const

const yesNo = (yes: boolean) => (
  <td className={yes ? 'about-yes' : 'about-no'}>{en[yes ? 'about.you.yes' : 'about.you.no']}</td>
)

const barJudges: { id: ResultsJudge; marker: 'cloud' | 'device' }[] = [
  { id: 'gemma-4', marker: 'cloud' },
  { id: 'clef-flash', marker: 'cloud' },
  { id: 'device', marker: 'device' },
]

export function AboutScene() {
  usePageMeta(en['meta.title.about'])
  const { data: results } = useEvalResults()
  const judges = results?.test.judges
  const device = results?.devices[0]
  const [first, second, third] = oddlySpecificConfig.pointsByGuess

  return (
    <main className="app-frame scene about" data-scene="about">
      <header className="about__intro">
        <h1 className="about__title">{en['about.title']}</h1>
        <p className="about__lede">{en['about.lede']}</p>
      </header>

      <Section n={1} labelKey="about.games" headingKey="about.games.title">
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
      </Section>

      <Section n={2} labelKey="about.play" headingKey="about.play.title">
        <ol className="about-play">
          <li className="about-card">
            <h3>{en['about.play.read']}</h3>
            <ol className="about-rules">
              {(['about.play.rule.a', 'about.play.rule.b', 'about.play.rule.c'] as const).map((rule) => (
                <li key={rule}>{en[rule]}</li>
              ))}
            </ol>
          </li>
          <li className="about-card">
            <h3>{en['about.play.guess']}</h3>
            <Guess answer="about.play.guess.answer" />
            <Verdict passes={[true, true, false]} />
            <p>{format('about.play.guess.note', { tries: oddlySpecificConfig.pointsByGuess.length })}</p>
          </li>
          <li className="about-card">
            <h3>{en['about.play.again']}</h3>
            <Guess answer="about.play.again.answer" />
            <Verdict passes={[true, true, true]} />
            <p>{format('about.play.again.note', { points: second, first, second, third })}</p>
          </li>
          <li className="about-card">
            <h3>{en['about.play.overrule']}</h3>
            <p>{en['about.play.overrule.note']}</p>
            <span className="pill pill--quiet about-play__pill" aria-hidden="true">
              {en['game.countAnyway']}
            </span>
          </li>
        </ol>
        <p className="about__note">{en['about.play.others']}</p>
      </Section>

      <Section n={3} labelKey="about.you" headingKey="about.you.title">
        <p>{en['about.you.body']}</p>
        <div className="about-card about-table">
          <table>
            <caption className="telemetry">{en['about.you.example']}</caption>
            <thead>
              <tr>
                <th scope="col">{en['about.you.guess']}</th>
                <th scope="col">{en['about.you.cloud']}</th>
                <th scope="col">{en['about.you.local']}</th>
                <th scope="col">{en['about.you.you']}</th>
              </tr>
            </thead>
            <tbody>
              {tally.map((row) => (
                <tr key={row.guess}>
                  <th scope="row">{en[row.guess]}</th>
                  {yesNo(row.cloud)}
                  {yesNo(row.local)}
                  <td>{en[row.you]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="about__note">
          {en['about.you.start']} <strong>{en['about.you.where']}</strong> {en['about.you.home']}
        </p>
      </Section>

      <Section n={4} labelKey="about.test" headingKey="about.test.title">
        {results && <p>{format('about.test.body', { cases: results.test.cases })}</p>}
        <ul className="about-kinds" aria-label={en['about.test.kinds']}>
          {testKinds.map(([kind, count]) => (
            <li key={kind}>
              {en[`about.test.kind.${kind}`]} <span className="about-kinds__count">{count}</span>
            </li>
          ))}
        </ul>
        <ol className="about-steps">
          <li>
            <span className="telemetry">{format('about.test.guesses', { n: practiceGuesses })}</span>
            <strong>{en['about.test.practice']}</strong>
            <span>{en['about.test.practice.body']}</span>
          </li>
          {results && (
            <li>
              <span className="telemetry">{format('about.test.guesses', { n: results.test.cases })}</span>
              <strong>{en['about.test.sealed']}</strong>
              <span>{en['about.test.sealed.body']}</span>
            </li>
          )}
        </ol>
        {results && judges && (
          <>
            <p className="telemetry about-bars__caption">
              {format('about.test.bars', { target: percent(results.target.wholeGuess) })}
            </p>
            <dl className="about-bars">
              {barJudges.map(({ id, marker }) => (
                <div key={id}>
                  <dt>{en[`about.test.judge.${id}`]}</dt>
                  <dd>
                    <JudgeBar
                      judge={marker}
                      value={judges[id]?.wholeGuess.value ?? 0}
                      target={results.target.wholeGuess}
                    />
                    <span>{percentTenths(judges[id]?.wholeGuess.value)}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="about-callout">
              <strong>{en['about.test.strict']}</strong>{' '}
              {format('about.test.strict.body', {
                strict: percent(judges['clef-flash']?.falseRejectRate.value),
                lenient: percentTenths(judges['clef-flash']?.falseAcceptRate.value),
              })}
            </p>
            <div className="about-stats">
              <p className="about-card">
                <strong>{percentTenths(judges['gemma-4']?.falseAcceptRate.value)}</strong>
                {en['about.test.lenient']}
              </p>
              {device && (
                <p className="about-card">
                  <strong>{format('compare.ms', { ms: device.warmGuessMedianMs })}</strong>
                  {format('about.test.device', {
                    load: device.coldLoadSeconds,
                    browser: device.browser.split(' ')[0] ?? device.browser,
                    machine: device.machine.replace(/ \(darwin\)$/u, ''),
                  })}
                </p>
              )}
            </div>
          </>
        )}
      </Section>

      <Section n={5} labelKey="about.puzzles" headingKey="about.puzzles.title">
        <p>{format('about.puzzles.table', { things: factory.things, rules: factory.rules })}</p>
        <div className="about-card about-table">
          <table>
            <caption className="telemetry">{en['about.puzzles.slice']}</caption>
            <thead>
              <tr>
                <th scope="col">{en['about.puzzles.thing']}</th>
                {tableRules.map((rule) => (
                  <th key={rule} scope="col">
                    {en[`about.puzzles.rule.${rule}`]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows.map(({ thing, fits }) => (
                <tr key={thing} className={fits.every(Boolean) ? 'about-table__fits' : undefined}>
                  <th scope="row">{en[`about.puzzles.thing.${thing}`]}</th>
                  {fits.map((yes, i) => (
                    <td key={tableRules[i]} className={yes ? 'about-yes' : 'about-no'}>
                      {en[yes ? 'about.you.yes' : 'about.you.no']}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>{format('about.puzzles.answers', { read: factory.spotChecked })}</p>
        <p className="about__note">{en['about.puzzles.wordnet']}</p>
      </Section>

      <Section n={6} id="privacy" labelKey="about.privacy" headingKey="about.privacy.title">
        <div className="about-privacy">
          <div className="about-card">
            <h3>{en['about.privacy.out']}</h3>
            <ul>
              <li>{en['about.privacy.out.guesses']}</li>
              <li>{en['about.privacy.out.turnstile']}</li>
              <li>{en['about.privacy.out.analytics']}</li>
              <li>{en['about.privacy.out.model']}</li>
            </ul>
          </div>
          <div className="about-card">
            <h3>{en['about.privacy.kept']}</h3>
            <ul>
              <li>{en['about.privacy.kept.progress']}</li>
              <li>{en['about.privacy.kept.tally']}</li>
              <li>{en['about.privacy.kept.settings']}</li>
            </ul>
            <p className="about__note">{en['about.privacy.kept.note']}</p>
          </div>
        </div>
        <p className="about__note">{en['about.privacy.footer']}</p>
      </Section>

      <Section n={7} labelKey="about.credits">
        <p>
          {en['about.credits.body']} <a href="https://github.com/ronald-balutiu/Quibble">{en['about.source']}</a>
        </p>
      </Section>
    </main>
  )
}
