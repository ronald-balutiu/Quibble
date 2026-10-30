import { useEffect, useState } from 'react'
import type { Reveal } from '@shared/schemas/judge'
import type { Puzzle, PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import type { Guess, RunState } from '@/games/oddly-specific/reducer'
import { fetchReveal } from '@/lib/api'
import { letterFor } from '@/scenes/game/verdict'
import './agent.css'

// Double Agent's parts of the round screen (5.5 D1, D2). The rest is Oddly
// Specific's round, round end and results (G1–G6), shared in GameScene.

// Meanings A and B as headlines (D1).
export function Clues({ conditions }: { conditions: readonly PuzzleCondition[] }) {
  return (
    <div className="clues">
      <p className="telemetry clues__eyebrow">{en['agent.eyebrow']}</p>
      <div className="clues__pair">
        {conditions.map((condition, i) => (
          <div key={condition.id} className="clue">
            <p className="telemetry">{format('agent.meaning', { letter: letterFor(i) })}</p>
            <p className="clue__label">{condition.label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

type Region = 'a' | 'b' | 'none' | 'both'
const regionOf = (guess: Guess, conditions: readonly PuzzleCondition[]): Region => {
  const [a, b] = conditions.map(({ id }) => !guess.failed.includes(id))
  if (a && b) return 'both'
  if (a) return 'a'
  return b ? 'b' : 'none'
}
// Where each region's guesses sit in the diagram, one row per guess.
const SPOTS: Record<Region, { x: number, ys: number[] }> = {
  a: { x: -98, ys: [28, -30, 62] },
  b: { x: 98, ys: [28, -30, 62] },
  both: { x: 0, ys: [36, 56, 76] },
  none: { x: 0, ys: [118, 140, 162] },
}

// The two-circle diagram plotting this round's guesses, with the target in the overlap (D1).
export function GuessMap({ guesses, conditions, className }: { guesses: readonly Guess[], conditions: readonly PuzzleCondition[], className: string }) {
  const placed = guesses.map((guess, i) => {
    const region = regionOf(guess, conditions)
    const k = guesses.slice(0, i).filter((earlier) => regionOf(earlier, conditions) === region).length
    const spot = SPOTS[region]
    return { guess, region, x: spot.x, y: spot.ys[k % spot.ys.length] ?? 0 }
  })
  const label = en['agent.mapLabel'] + placed.map(({ guess, region }) => format('agent.sits', { word: guess.answer, where: en[`agent.where.${region}`] })).join('')
  return (
    <figure className={`guess-map ${className}`}>
      <figcaption className="telemetry">{en['agent.map']}</figcaption>
      {/* Guesses that fit neither meaning sit below the circles, which need the extra height. */}
      <svg viewBox={placed.some(({ region }) => region === 'none') ? '-190 -110 380 290' : '-190 -110 380 220'} role="img" aria-label={label}>
        <line className="guess-map__axis" x1="-190" y1="0" x2="190" y2="0" />
        <circle className="guess-map__ring" cx="-50" r="92" />
        <circle className="guess-map__ring" cx="50" r="92" />
        <text className="guess-map__letter" x="-128" y="-80">{letterFor(0)}</text>
        <text className="guess-map__letter" x="122" y="-80">{letterFor(1)}</text>
        <text className="guess-map__target" x="0" y="-6" textAnchor="middle">{en['agent.target']}</text>
        <text className="guess-map__target guess-map__target--mark" x="0" y="12" textAnchor="middle">{en['agent.targetMark']}</text>
        {placed.map(({ guess, region, x, y }) => (
          <g key={guess.answer} className={region === 'both' ? 'guess-map__guess guess-map__guess--pass' : 'guess-map__guess'}>
            <circle cx={x} cy={y} r="5" />
            <text x={x} y={y + 18} textAnchor="middle">{guess.answer.toUpperCase()}</text>
          </g>
        ))}
      </svg>
    </figure>
  )
}

// D2: each round's word (yours, or the intended one if lost), both clues and its points.
export function RoundWords({ run, puzzle }: { run: RunState, puzzle: Puzzle }) {
  const [reveals, setReveals] = useState<Record<string, Reveal | undefined>>({})
  useEffect(() => {
    let live = true
    for (const [i, round] of run.rounds.entries()) {
      const id = puzzle.rounds[i]?.id
      if (round.status === 'solved' || !id) continue
      void fetchReveal(puzzle.game, puzzle.n, id).then((value) => { if (live) setReveals((all) => ({ ...all, [id]: value })) })
    }
    return () => { live = false }
  }, [run, puzzle])

  return (
    <ul className="round-words">
      {run.rounds.map((round, i) => {
        const id = puzzle.rounds[i]?.id ?? ''
        const solved = round.status === 'solved'
        const word = solved ? round.guesses.at(-1)?.answer : reveals[id]?.example
        const lastGuess = round.guesses.at(-1)?.answer
        const clues = (puzzle.rounds[i]?.conditions ?? []).map(({ label }) => label).join(' · ')
        return (
          <li key={id} className="round-words__row">
            <span className="telemetry">{format('agent.round', { n: i + 1 })}</span>
            <span className="round-words__word">{word ?? en['escape.none']}</span>
            <span className={solved ? 'telemetry round-words__points' : 'telemetry round-words__points round-words__points--none'}>
              {round.points > 0 ? format('agent.points', { points: round.points }) : '0'}
            </span>
            <span className="round-words__clues">
              {clues}
              {!solved && lastGuess && format('agent.youGuessed', { word: lastGuess })}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
