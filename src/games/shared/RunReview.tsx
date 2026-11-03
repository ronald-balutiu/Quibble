import { useId, useState } from 'react'
import type { Puzzle, PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import { RetryLink } from './GameFrame'
import type { RoundState, RunState } from './run'
import { useReveal } from './use-reveal'
import { letterFor } from './verdict'
import './run-review.css'

export function RunReview({ puzzle, run }: { puzzle: Puzzle, run: RunState }) {
  const id = useId()
  return (
    <section className="run-review" aria-labelledby={id}>
      <h2 id={id}>{en['review.title']}</h2>
      <ol className="run-review__rounds">
        {puzzle.rounds.map((round, i) => {
          const played = run.rounds[i]
          return played && <li key={round.id}><ReviewRound puzzle={puzzle} round={played} index={i} group={id} /></li>
        })}
      </ol>
    </section>
  )
}

function ReviewRound({ puzzle, round, index, group }: { puzzle: Puzzle, round: RoundState, index: number, group: string }) {
  const [opened, setOpened] = useState(false)
  const solved = round.status === 'solved'
  const status = round.status === 'playing' ? 'unreached' : round.overruled ? 'overruled' : round.status
  return (
    <details className="run-review__round" name={group} data-status={status} onToggle={(event) => { if (event.target === event.currentTarget && event.currentTarget.open) setOpened(true) }}>
      <summary>
        <span className="run-review__mark" aria-hidden="true">{en[solved ? 'review.mark.solved' : status === 'lost' ? 'review.mark.missed' : 'review.mark.other']}</span>
        <span className="run-review__label">{format(puzzle.game === 'category-escape' ? 'review.level' : 'review.round', { n: index + 1 })}</span>
        <span className="run-review__outcome">
          {solved && <span className="run-review__answer">{round.guesses.at(-1)?.answer}</span>}
          <span className="run-review__status">{en[`review.status.${status}`]}</span>
        </span>
        <span className="run-review__points">{round.status === 'playing' ? '' : format('review.points', { points: round.points })}</span>
      </summary>
      {opened && <ReviewBody puzzle={puzzle} round={round} index={index} />}
    </details>
  )
}

function ReviewBody({ puzzle, round, index }: { puzzle: Puzzle, round: RoundState, index: number }) {
  const id = useId()
  const conditions = puzzle.rounds[index]?.conditions ?? []
  const { reveal, reload } = useReveal(puzzle, puzzle.rounds[index]?.id ?? '')
  const accepted = round.status === 'solved' ? round.guesses.at(-1) : undefined
  const answer = accepted?.answer ?? reveal?.example
  const alternatives = reveal ? [...new Set([reveal.example, ...reveal.also])].filter((word) => word !== answer) : []
  const revealStatus = reveal === undefined
    ? <p role="status">{en['review.loading']}</p>
    : reveal === null
      ? <p role="status">{en['reveal.failed']} <RetryLink onClick={reload} /></p>
      : null
  const historyLabel = round.guesses.length === 0 ? en['game.yourGuesses'] : round.guesses.length === 1 ? en['review.history.one'] : format('review.history.many', { n: round.guesses.length })
  return (
    <div className="run-review__body">
      <section className="run-review__solution" aria-labelledby={id}>
        <h3 id={id} className="telemetry">{en[accepted ? 'review.yourAnswer' : 'review.oneAnswer']}</h3>
        {answer ? <p className="run-review__solution-word">{answer}</p> : revealStatus}
        <ol className="run-review__rules" aria-label={en['review.rules']}>
          {conditions.map(({ id, label }, i) => <li key={id}>
            <span className="run-review__rule-code">{letterFor(i)}</span>
            <span>{label}</span>
            {answer && <RuleMatch pass={!accepted?.failed.includes(id)} judged={accepted !== undefined} />}
          </li>)}
        </ol>
      </section>
      <details className="run-review__history">
        <summary>{historyLabel}</summary>
        <div className="run-review__history-body">
          {round.guesses.length === 0
            ? <p className="muted">{en[round.status === 'playing' ? 'review.unreached' : 'review.noGuesses']}</p>
            : <GuessHistory round={round} conditions={conditions} />}
          {accepted && revealStatus}
          {alternatives.length > 0 && <section className="run-review__alternatives" aria-labelledby={`${id}-alternatives`}>
            <h4 id={`${id}-alternatives`} className="telemetry">{en['review.otherAnswers']}</h4>
            <ul className="also">{alternatives.map((word) => <li key={word}>{word}</li>)}</ul>
          </section>}
        </div>
      </details>
    </div>
  )
}

function GuessHistory({ round, conditions }: { round: RoundState, conditions: PuzzleCondition[] }) {
  return (
    <>
      <table className="run-review__guesses">
        <caption className="visually-hidden">{en['review.history.caption']}</caption>
        <thead><tr>
          <th scope="col">{en['game.yourGuesses']}</th>
          {conditions.map(({ id, label }, i) => <th key={id} scope="col" aria-label={label}>{letterFor(i)}</th>)}
        </tr></thead>
        <tbody>{round.guesses.map((guess, i) => {
          const overruled = round.overruled && i === round.guesses.length - 1
          const verdict = en[overruled ? 'review.guess.overruled' : guess.pass ? 'review.guess.accepted' : 'review.guess.rejected']
          return (
            <tr key={guess.answer}>
              <th scope="row" aria-label={format('review.history.guess', { answer: guess.answer, verdict })}>
                <span>{guess.answer}</span>
                {overruled && <span className="run-review__override">{verdict}</span>}
              </th>
              {conditions.map(({ id }) => <td key={id}><RuleMatch pass={!guess.failed.includes(id)} /></td>)}
            </tr>
          )
        })}</tbody>
      </table>
      <p className="run-review__key"><span>{en['review.key.pass']}</span><span>{en['review.key.fail']}</span></p>
    </>
  )
}

function RuleMatch({ pass, judged = true }: { pass: boolean, judged?: boolean }) {
  const label = judged ? en[pass ? 'review.rule.accepted' : 'review.rule.rejected'] : en['review.rule.fits']
  return <span className={pass ? 'run-review__match run-review__match--pass' : 'run-review__match run-review__match--fail'} role="img" aria-label={label}>{en[pass ? 'review.mark.solved' : 'review.mark.missed']}</span>
}
