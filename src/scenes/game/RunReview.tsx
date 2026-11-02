import { useId, useState } from 'react'
import type { Puzzle } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import type { RoundState, RunState } from '@/games/rounds/reducer'
import { useReveal } from './use-reveal'
import './run-review.css'

export function RunReview({ puzzle, run }: { puzzle: Puzzle, run: RunState }) {
  const id = useId()
  return (
    <section className="run-review" aria-labelledby={id}>
      <h2 id={id}>{en['review.title']}</h2>
      <ol className="run-review__rounds">
        {puzzle.rounds.map((round, i) => {
          const played = run.rounds[i]
          return played && <li key={round.id}><ReviewRound puzzle={puzzle} round={played} index={i} /></li>
        })}
      </ol>
    </section>
  )
}

function ReviewRound({ puzzle, round, index }: { puzzle: Puzzle, round: RoundState, index: number }) {
  const [opened, setOpened] = useState(false)
  const solved = round.status === 'solved'
  const status = round.status === 'playing' ? 'unreached' : round.overruled ? 'overruled' : round.status
  return (
    <details className="run-review__round" data-status={status} onToggle={(event) => { if (event.currentTarget.open) setOpened(true) }}>
      <summary>
        <span className="run-review__mark" aria-hidden="true">{en[solved ? 'review.mark.solved' : 'review.mark.other']}</span>
        <span className="run-review__label">{format(puzzle.game === 'category-escape' ? 'review.level' : 'review.round', { n: index + 1 })}</span>
        <span className="run-review__status">{en[`review.status.${status}`]}</span>
        <span className="run-review__answer">{solved ? round.guesses.at(-1)?.answer : ''}</span>
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
  const examples = reveal ? [...new Set([reveal.example, ...reveal.also])] : []
  return (
    <div className="run-review__body">
      <section className="run-review__section" aria-labelledby={`${id}-rules`}>
        <h3 id={`${id}-rules`}>{en['review.rules']}</h3>
        <ol className="run-review__rules">{conditions.map(({ id, label }) => <li key={id}>{label}</li>)}</ol>
      </section>
      <section className="run-review__section" aria-labelledby={`${id}-guesses`}>
        <h3 id={`${id}-guesses`}>{en['game.yourGuesses']}</h3>
        {round.guesses.length === 0
          ? <p className="muted">{en[round.status === 'playing' ? 'review.unreached' : 'review.noGuesses']}</p>
          : <ol className="run-review__guesses">{round.guesses.map((guess, i) => {
              const status = round.overruled && i === round.guesses.length - 1 ? 'overruled' : guess.pass ? 'accepted' : 'rejected'
              const failed = conditions.filter(({ id }) => guess.failed.includes(id))
              return (
                <li key={guess.answer} className="run-review__guess" data-status={status}>
                  <div className="run-review__guess-head">
                    <strong>{guess.answer}</strong>
                    <span className="run-review__verdict">{en[`review.guess.${status}`]}</span>
                  </div>
                  {!guess.pass && failed.length > 0 && <div className="run-review__misses">
                    <p className="telemetry">{en['review.missedRules']}</p>
                    <ul>{failed.map(({ id, label }) => <li key={id}>{label}</li>)}</ul>
                  </div>}
                </li>
              )
            })}</ol>}
      </section>
      <section className="run-review__section run-review__section--examples" aria-labelledby={`${id}-examples`}>
        <h3 id={`${id}-examples`}>{en['review.examples']}</h3>
        {reveal === undefined
          ? <p role="status">{en['review.loading']}</p>
          : reveal === null
            ? <p role="status">{en['reveal.failed']} <button type="button" className="link-button" onClick={reload}>{en['action.retry']}</button></p>
            : <ul className="also">{examples.map((word) => <li key={word}>{word}</li>)}</ul>}
      </section>
    </div>
  )
}
