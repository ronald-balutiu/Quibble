import type { ReactNode } from 'react'
import { en } from '@/copy/en'
import './result-summary.css'

// The same score/action hierarchy for round-based games and Category Escape.
export function ResultSummary({
  score,
  best,
  end,
  tiles,
  grid,
  children,
}: {
  score: ReactNode
  best: string
  end?: string
  tiles: string
  grid: string
  children: ReactNode
}) {
  return (
    <header className="result-summary" aria-label={en['results.summary']}>
      <div className="result-summary__score">
        <p className="telemetry">{end ?? en['results.summary']}</p>
        <p className="results__score">{score}</p>
        <p className="telemetry">{best}</p>
      </div>
      <div className="result-summary__next">
        <p className="results__tiles" aria-label={grid}>
          {tiles}
        </p>
        {children}
      </div>
    </header>
  )
}
