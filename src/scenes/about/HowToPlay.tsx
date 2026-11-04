import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { en, format, type CopyKey } from '@/copy/en'
import { AboutSection } from './AboutSection'

// 02: an Oddly Specific round as four cards. The tries and points come from the
// game's config, so the copy follows any change to scoring.

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

// The answer field as it looks in a game, filled in.
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

const rules = ['about.play.rule.a', 'about.play.rule.b', 'about.play.rule.c'] as const

export function HowToPlay({ n }: { n: number }) {
  const { pointsByGuess } = oddlySpecificConfig
  const [first, second, third] = pointsByGuess
  return (
    <AboutSection n={n} labelKey="about.play" headingKey="about.play.title">
      <ol className="about-play">
        <li className="about-card">
          <h3>{en['about.play.read']}</h3>
          <ol className="about-rules">
            {rules.map((rule) => (
              <li key={rule}>{en[rule]}</li>
            ))}
          </ol>
        </li>
        <li className="about-card">
          <h3>{en['about.play.guess']}</h3>
          <Guess answer="about.play.guess.answer" />
          <Verdict passes={[true, true, false]} />
          <p>{format('about.play.guess.note', { tries: pointsByGuess.length })}</p>
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
    </AboutSection>
  )
}
