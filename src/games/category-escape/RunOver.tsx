import type { Puzzle } from '@shared/schemas/puzzle'
import { categoryEscapeConfig as config } from '@shared/games/category-escape'
import { JudgesCompare } from '@/components/JudgesCompare/JudgesCompare'
import { en, format } from '@/copy/en'
import type { RunState } from '@/games/rounds/reducer'
import { ResultActions } from '@/scenes/game/ResultActions'
import { useReveal } from '@/scenes/game/use-reveal'
import { levelCode, ruleText } from './labels'
import { escapeEnd, escapeShareGrid, levelsCleared } from './reducer'

export function RunOver({ run, puzzle, best, onRestart }: { run: RunState, puzzle: Puzzle, best: number | undefined, onRestart: () => void }) {
  const end = escapeEnd(run)
  const score = levelsCleared(run)
  const grid = escapeShareGrid(run)
  const lastId = puzzle.rounds.at(-1)?.id ?? ''
  const { reveal, reload: loadPath } = useReveal(puzzle, lastId)
  const path = reveal === undefined ? undefined : reveal?.path ?? null
  const code = String(puzzle.n).padStart(3, '0')

  const bestLabel = best === undefined ? en['results.firstPlay'] : score > best ? format('results.newBest', { n: best }) : format('results.best', { n: best })
  const share = `${format('results.share', { game: en[`game.name.${puzzle.game}`], n: puzzle.n, tiles: grid.tiles, score, max: config.levels })}\n${grid.text}`
  const wrong = run.rounds.flatMap((level, i) => level.guesses.filter((guess) => !guess.pass && !(level.overruled && guess === level.guesses.at(-1))).map((guess) => ({ guess, i })))

  return (
    <div className="game-body">
      <section className="results escape-over">
        <p className="telemetry escape-over__end">{en[`escape.end.${end}`]}</p>
        <p className="results__score">{score}<span className="escape-over__max">{format('escape.outOf', { max: config.levels })}</span></p>
        <p className="telemetry">{bestLabel}</p>
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
        <ResultActions puzzle={puzzle} share={share} restart={{ label: format('escape.tryAgain', { n: code }), onClick: onRestart }} focusPrimary />
        <JudgesCompare />
      </section>
      {wrong.length > 0 && (
        <aside className="escape-side">
          <h2 className="telemetry">{format('escape.wrongGuesses', { n: wrong.length })}</h2>
          <ul className="used used--wrong">
            {wrong.map(({ guess, i }) => {
              const rules = (puzzle.rounds[i]?.conditions ?? []).filter(({ id }) => guess.failed.includes(id)).map(({ negation }) => negation).join(', ')
              return <li key={`${String(i)}-${guess.answer}`}><span className="used__answer">{guess.answer}</span><span className="telemetry">{format('escape.wrong', { level: levelCode(i), rule: rules })}</span></li>
            })}
          </ul>
        </aside>
      )}
    </div>
  )
}
