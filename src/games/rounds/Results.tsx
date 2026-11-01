import { useState } from 'react'
import type { Puzzle } from '@shared/schemas/puzzle'
import { JudgesCompare } from '@/components/JudgesCompare/JudgesCompare'
import { en, format } from '@/copy/en'
import { RoundWords } from '@/games/double-agent/Screen'
import { loadComparisons } from '@/lib/storage/comparisons'
import { puzzleComparisons } from '@/lib/your-games'
import { ResultActions } from '@/scenes/game/ResultActions'
import { maxScore, shareGrid, totalScore, type RoundsConfig, type RunState } from './reducer'

export function Results({ run, puzzle, best, config }: { run: RunState, puzzle: Puzzle, best: number | undefined, config: RoundsConfig }) {
  const score = totalScore(run)
  const max = maxScore(config)
  const grid = shareGrid(run)
  const bestLabel = best === undefined ? en['results.firstPlay'] : score > best ? format('results.newBest', { n: best }) : format('results.best', { n: best })
  const share = `${format('results.share', { game: en[`game.name.${puzzle.game}`], n: puzzle.n, tiles: grid.tiles, score, max })}\n${grid.text}`
  const guesses = run.rounds.reduce((total, round) => total + round.guesses.length, 0)
  // This run's guesses that both judges answered (3.8 comparison records).
  const [judges] = useState(() => puzzleComparisons(loadComparisons(), puzzle.game, puzzle.n, new Set(
    run.rounds.flatMap((round, i) => round.guesses.map((guess) => `${puzzle.rounds[i]?.id ?? ''}:${guess.answer}`)),
  )))
  const labelOf = (roundId: string, id: string) => {
    const label = puzzle.rounds.find((round) => round.id === roundId)?.conditions.find((c) => c.id === id)?.label ?? id
    return label.charAt(0).toLowerCase() + label.slice(1)
  }

  return (
    <section className="results">
      <p className="telemetry">{bestLabel}</p>
      <p className="results__score">{format('results.score', { score, max })}</p>
      <p className="results__tiles" aria-label={grid.text}>{grid.tiles}</p>
      {puzzle.game === 'double-agent' && <RoundWords run={run} puzzle={puzzle} />}
      <dl className="facts">
        <dt>{en['results.guesses']}</dt><dd>{guesses}</dd>
        <dt>{en['results.overruled']}</dt><dd>{run.rounds.filter((round) => round.overruled).length}</dd>
        <dt>{en['results.closeCalls']}</dt><dd>{run.rounds.flatMap((round) => round.guesses).filter((guess) => guess.closeCall).length}</dd>
        {judges.compared > 0 && <><dt>{en['results.judgesAgreed']}</dt><dd>{format('results.agreedValue', { agreed: judges.agreed, compared: judges.compared })}</dd></>}
      </dl>
      {judges.splits.length > 0 && (
        <section className="splits" aria-labelledby="splits-title">
          <h2 id="splits-title" className="telemetry">{en['results.splitTitle']}</h2>
          {judges.splits.map(({ record, condition, cloud, device }) => (
            <p key={`${record.round}:${record.answer}:${condition}`}>
              {format('results.splitLine', { answer: record.answer, condition: labelOf(record.round, condition), cloud: cloud.toFixed(2), device: device.toFixed(2) })}
              {record.overruled ? en[`results.splitOverruled.${record.referee}`] : Object.values(record.conditions).every((c) => (record.referee === 'cloud' ? c.cloudPass : c.devicePass)) ? '' : en['results.splitMovedOn']}
            </p>
          ))}
        </section>
      )}
      <ResultActions puzzle={puzzle} share={share} />
      <JudgesCompare />
    </section>
  )
}
