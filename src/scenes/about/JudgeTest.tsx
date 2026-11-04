import type { EvalResults, ResultsJudge } from '@shared/schemas/eval-results'
import { JudgeBar } from '@/components/JudgeBar/JudgeBar'
import { en, format } from '@/copy/en'
import { AboutSection } from './AboutSection'
import { practiceGuesses, testKinds } from './about-facts'

// 04: the answer-key test. The mix of guesses and the practice set come from
// about-facts.ts; every result comes from public/eval/results.json, so the section
// shows only the parts that don't need it until it loads.

const percent = (value: number | undefined) => format('compare.percent', { p: Math.round((value ?? 0) * 100) })
const percentTenths = (value: number | undefined) =>
  format('compare.percent', { p: (Math.round((value ?? 0) * 1000) / 10).toFixed(1) })

const barJudges: { id: ResultsJudge; marker: 'cloud' | 'device' }[] = [
  { id: 'gemma-4', marker: 'cloud' },
  { id: 'clef-flash', marker: 'cloud' },
  { id: 'device', marker: 'device' },
]

export function JudgeTest({ n, results }: { n: number; results: EvalResults | null | undefined }) {
  const judges = results?.test.judges
  const device = results?.devices[0]
  return (
    <AboutSection n={n} labelKey="about.test" headingKey="about.test.title">
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
    </AboutSection>
  )
}
