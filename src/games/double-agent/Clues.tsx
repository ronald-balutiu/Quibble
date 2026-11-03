import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import { letterFor } from '@/games/shared/verdict'
import './agent.css'

// Double Agent's own parts of the round screen (5.5 D1, D2) are these clues and
// GuessMap. The rest is Oddly Specific's round, round end and results (G1–G6),
// shared in games/rounds/.

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
