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
      <p>{en[puzzle.game === 'category-escape' ? 'review.hint.levels' : 'review.hint.rounds']}</p>
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
    <details className="run-review__round" onToggle={(event) => { if (event.currentTarget.open) setOpened(true) }}>
      <summary>
        <span className="run-review__label">{format(puzzle.game === 'category-escape' ? 'review.level' : 'review.round', { n: index + 1 })}</span>
        <span className={solved ? 'run-review__status run-review__status--solved' : 'run-review__status'}>{en[`review.status.${status}`]}</span>
        <span className="run-review__answer">{solved ? round.guesses.at(-1)?.answer : ''}</span>
        <span className="run-review__points">{format('review.points', { points: round.points })}</span>
      </summary>
      {opened && <ReviewBody puzzle={puzzle} round={round} index={index} />}
    </details>
  )
}

function ReviewBody({ puzzle, round, index }: { puzzle: Puzzle, round: RoundState, index: number }) {
  const conditions = puzzle.rounds[index]?.conditions ?? []
  const { reveal, reload } = useReveal(puzzle, puzzle.rounds[index]?.id ?? '')
  const examples = reveal ? [...new Set([reveal.example, ...reveal.also])] : []
  return (
    <div className="run-review__body">
      <h3>{en['review.rules']}</h3>
      <ol className="run-review__rules">{conditions.map(({ id, label }) => <li key={id}>{label}</li>)}</ol>
      <h3>{en['game.yourGuesses']}</h3>
      {round.guesses.length === 0
        ? <p>{en[round.status === 'playing' ? 'review.unreached' : 'review.noGuesses']}</p>
        : <ol className="run-review__guesses">{round.guesses.map((guess, i) => {
            const overruled = round.overruled && i === round.guesses.length - 1
            const failed = conditions.filter(({ id }) => guess.failed.includes(id)).map(({ label }) => label).join(' · ')
            return (
              <li key={guess.answer}>
                <strong>{guess.answer}</strong>
                <span>{en[overruled ? 'review.guess.overruled' : guess.pass ? 'review.guess.accepted' : 'review.guess.rejected']}</span>
                {!guess.pass && failed && <p>{format('review.failed', { rules: failed })}</p>}
              </li>
            )
          })}</ol>}
      <h3>{en['review.examples']}</h3>
      {reveal === undefined
        ? <p role="status">{en['review.loading']}</p>
        : reveal === null
          ? <p role="status">{en['reveal.failed']} <button type="button" className="link-button" onClick={reload}>{en['action.retry']}</button></p>
          : <ul className="also">{examples.map((word) => <li key={word}>{word}</li>)}</ul>}
    </div>
  )
}
