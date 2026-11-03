import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import type { Guess } from '@/games/shared/run'
import { letterFor } from '@/games/shared/verdict'
import './agent.css'

type Region = 'a' | 'b' | 'none' | 'both'
const regionOf = (guess: Guess, conditions: readonly PuzzleCondition[]): Region => {
  const [a, b] = conditions.map(({ id }) => !guess.failed.includes(id))
  if (a && b) return 'both'
  if (a) return 'a'
  return b ? 'b' : 'none'
}
// Where each region's guesses sit in the diagram, one row per guess.
const SPOTS: Record<Region, { x: number; ys: number[] }> = {
  a: { x: -98, ys: [28, -30, 62] },
  b: { x: 98, ys: [28, -30, 62] },
  both: { x: 0, ys: [36, 56, 76] },
  none: { x: 0, ys: [118, 140, 162] },
}

// The two-circle diagram plotting this round's guesses, with the target in the overlap (D1).
export function GuessMap({
  guesses,
  conditions,
  className,
}: {
  guesses: readonly Guess[]
  conditions: readonly PuzzleCondition[]
  className: string
}) {
  const placed = guesses.map((guess, i) => {
    const region = regionOf(guess, conditions)
    const k = guesses.slice(0, i).filter((earlier) => regionOf(earlier, conditions) === region).length
    const spot = SPOTS[region]
    return { guess, region, x: spot.x, y: spot.ys[k % spot.ys.length] ?? 0 }
  })
  const label =
    en['agent.mapLabel'] +
    placed
      .map(({ guess, region }) => format('agent.sits', { word: guess.answer, where: en[`agent.where.${region}`] }))
      .join('')
  return (
    <figure className={`guess-map ${className}`}>
      <figcaption className="telemetry">{en['agent.map']}</figcaption>
      {/* Guesses that fit neither meaning sit below the circles, which need the extra height. */}
      <svg
        viewBox={placed.some(({ region }) => region === 'none') ? '-190 -110 380 290' : '-190 -110 380 220'}
        role="img"
        aria-label={label}
      >
        <line className="guess-map__axis" x1="-190" y1="0" x2="190" y2="0" />
        <circle className="guess-map__ring" cx="-50" r="92" />
        <circle className="guess-map__ring" cx="50" r="92" />
        <text className="guess-map__letter" x="-128" y="-80">
          {letterFor(0)}
        </text>
        <text className="guess-map__letter" x="122" y="-80">
          {letterFor(1)}
        </text>
        <text className="guess-map__target" x="0" y="-6" textAnchor="middle">
          {en['agent.target']}
        </text>
        <text className="guess-map__target guess-map__target--mark" x="0" y="12" textAnchor="middle">
          {en['agent.targetMark']}
        </text>
        {placed.map(({ guess, region, x, y }) => (
          <g
            key={guess.answer}
            className={region === 'both' ? 'guess-map__guess guess-map__guess--pass' : 'guess-map__guess'}
          >
            <circle cx={x} cy={y} r="5" />
            <text x={x} y={y + 18} textAnchor="middle">
              {guess.answer.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}
