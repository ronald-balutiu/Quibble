import { useState } from 'react'
import type { Puzzle } from '@shared/schemas/puzzle'
import { categoryEscapeConfig as config } from '@shared/games/category-escape'
import { JudgesCompare } from '@/components/JudgesCompare/JudgesCompare'
import { en, format } from '@/copy/en'
import type { RunState } from '@/games/shared/run'
import { ResultSummary } from '@/games/shared/ResultSummary'
import { ResultActions } from '@/games/shared/ResultActions'
import { RunReview } from '@/games/shared/RunReview'
import { useReveal } from '@/games/shared/use-reveal'
import { levelCode, ruleText } from './labels'
import { escapeEnd, escapeShareGrid, levelsCleared } from './reducer'

export function RunOver({ run, puzzle, best, onRestart }: { run: RunState, puzzle: Puzzle, best: number | undefined, onRestart: () => void }) {
  const [pathOpened, setPathOpened] = useState(false)
  const end = escapeEnd(run)
  const score = levelsCleared(run)
  const grid = escapeShareGrid(run)

  const bestLabel = best === undefined ? en['results.firstPlay'] : score > best ? format('results.newBest', { n: best }) : format('results.best', { n: best })
  const share = `${format('results.share', { game: en[`game.name.${puzzle.game}`], n: puzzle.n, tiles: grid.tiles, score, max: config.levels })}\n${grid.text}`
  const wrong = run.rounds.flatMap((level, i) => level.guesses.filter((guess) => !guess.pass && !(level.overruled && guess === level.guesses.at(-1))).map((guess) => ({ guess, i })))

  return (
    <section className="results">
      <ResultSummary score={<>{score}<span className="escape-over__max">{format('escape.outOf', { max: config.levels })}</span></>} best={bestLabel} end={en[`escape.end.${end}`]} tiles={grid.tiles} grid={grid.text}>
        <ResultActions puzzle={puzzle} share={share} restart={{ label: en['escape.tryAgain'], onClick: onRestart }} focusPrimary />
      </ResultSummary>
      <RunReview puzzle={puzzle} run={run} />
      <details className="result-details" onToggle={(event) => { if (event.currentTarget.open) setPathOpened(true) }}>
        <summary>{en['results.path']}</summary>
        {pathOpened && <EscapePath puzzle={puzzle} run={run} />}
      </details>
      <details className="result-details">
        <summary>{en['results.details']}</summary>
        <p className="telemetry">{format('escape.wrongGuesses', { n: wrong.length })}</p>
        <ul className="used used--wrong">
          {wrong.map(({ guess, i }) => {
            const rules = (puzzle.rounds[i]?.conditions ?? []).filter(({ id }) => guess.failed.includes(id)).map(({ negation }) => negation).join(', ')
            return <li key={`${String(i)}-${guess.answer}`}><span className="used__answer">{guess.answer}</span><span className="telemetry">{format('escape.wrong', { level: levelCode(i), rule: rules })}</span></li>
          })}
        </ul>
      </details>
      <JudgesCompare collapsible compact />
    </section>
  )
}

function EscapePath({ puzzle, run }: { puzzle: Puzzle, run: RunState }) {
  const { reveal, reload: loadPath } = useReveal(puzzle, puzzle.rounds.at(-1)?.id ?? '')
  const path = reveal === undefined ? undefined : reveal?.path ?? null
  return (
    <div className="path-table">
      <table>
        <thead>
          <tr><th scope="col">{en['escape.table.level']}</th><th scope="col">{en['escape.table.adds']}</th><th scope="col">{en['escape.table.you']}</th><th scope="col">{en['escape.table.path']}</th></tr>
        </thead>
        <tbody>
          {puzzle.rounds.map((round, i) => {
            const level = run.rounds[i]
            const solved = level?.status === 'solved'
            return (
              <tr key={round.id} className={i === run.current && !solved ? 'path-table__end' : undefined}>
                <th scope="row">{levelCode(i)}</th>
                <td>{ruleText(puzzle, i)}</td>
                <td className={solved ? undefined : 'muted'}>{solved ? level.guesses.at(-1)?.answer : en['escape.none']}</td>
                <td>{path?.[i] ?? ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {path === null && <p>{en['reveal.failed']} <button type="button" className="link-button" onClick={loadPath}>{en['action.retry']}</button></p>}
    </div>
  )
}
