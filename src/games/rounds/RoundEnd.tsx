import { useEffect, useRef } from 'react'
import type { Puzzle } from '@shared/schemas/puzzle'
import { en, format, type CopyKey } from '@/copy/en'
import { useReveal } from '@/scenes/game/use-reveal'
import type { DeviceColumn } from '@/scenes/game/use-device-column'
import { judgesSplit, letterFor } from '@/scenes/game/verdict'
import type { RunState } from './reducer'

export function RoundEnd({ run, puzzle, alsoFits, column, onNext }: { run: RunState, puzzle: Puzzle, alsoFits: CopyKey, column: DeviceColumn, onNext: () => void }) {
  const round = run.rounds[run.current]
  const conditions = puzzle.rounds[run.current]?.conditions ?? []
  const roundIndex = run.current
  const last = roundIndex === run.rounds.length - 1
  const next = useRef<HTMLButtonElement>(null)
  const roundId = puzzle.rounds[roundIndex]?.id ?? ''

  const { reveal, reload: loadReveal } = useReveal(puzzle, roundId)
  useEffect(() => { next.current?.focus() }, [roundId])

  if (!round) return null
  const solved = round.status === 'solved'
  const winning = round.guesses.at(-1)
  // The on-device run belongs to the last judged guess, so the sentence can say whether the judges agreed.
  const split = judgesSplit(column.run)

  return (
    <section className="round-end" aria-live="polite">
      {solved ? (
        <>
          <p className="telemetry round-end__label">{round.overruled ? en['verdict.overruled'] : format('verdict.label.accepted', { points: round.points })}</p>
          <h1 className="round-end__answer">{winning?.answer}</h1>
          <p>{format('verdict.accepted', { n: round.strikes + 1 }) + (split === undefined ? (column.decidedBy === 'device' ? en['verdict.notCompared'] : '') : en[split ? 'verdict.judgesDisagreed' : 'verdict.judgesAgreed'])}</p>
        </>
      ) : (
        <>
          <p className="telemetry round-end__label round-end__label--lost">{format('round.lost', { n: run.current + 1 })}</p>
          <p>{en['round.example']}</p>
          <h1 className="round-end__answer">{reveal?.example}</h1>
        </>
      )}
      <h2 className="telemetry">{en[alsoFits]}</h2>
      {reveal === null
        ? <p>{en['reveal.failed']} <button type="button" className="link-button" onClick={loadReveal}>{en['action.retry']}</button></p>
        : <ul className="also">{(reveal ? (solved ? [reveal.example, ...reveal.also] : reveal.also) : []).filter((w) => w !== winning?.answer).map((word) => <li key={word}>{word}</li>)}</ul>}
      {!solved && (
        <>
          <h2 className="telemetry">{en['game.yourGuesses']}</h2>
          {round.status === 'skipped'
            ? <p>{en['round.skipped']}</p>
            : <ul className="also">{round.guesses.map((guess) => (
                <li key={guess.answer}>{guess.answer} <span className="muted">{format('game.missed', { conditions: guess.failed.map((id) => letterFor(conditions.findIndex((c) => c.id === id))).join(', ') })}</span></li>
              ))}</ul>}
        </>
      )}
      <div className="actions">
        <button ref={next} type="button" className="pill" onClick={onNext}>
          {last ? en['game.seeResults'] : format('game.nextRound', { n: run.current + 2, total: run.rounds.length })}
        </button>
        <span className="telemetry">{en['game.continueHint']}</span>
      </div>
    </section>
  )
}
