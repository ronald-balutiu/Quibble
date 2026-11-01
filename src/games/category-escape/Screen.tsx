import { useEffect, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router'
import { judgeConfig } from '@shared/config'
import { categoryEscapeConfig } from '@shared/games/category-escape'
import { isValidAnswer, normalizeAnswer } from '@shared/normalize'
import type { CloudModel, Reveal } from '@shared/schemas/judge'
import type { Puzzle, PuzzleCondition } from '@shared/schemas/puzzle'
import { DeviceSetup } from '@/components/DeviceSetup/DeviceSetup'
import { en, format } from '@/copy/en'
import type { RunState } from '@/games/oddly-specific/reducer'
import { fetchReveal } from '@/lib/api'
import { loadPuzzleIndex } from '@/lib/puzzles'
import { markOverruled } from '@/lib/storage/comparisons'
import { isStorageAvailable, loadProgress, saveRun } from '@/lib/storage/progress'
import { loadCloudModel, markTipSeen, tipSeen } from '@/lib/storage/settings'
import { judgeGuess, type Ui } from '@/scenes/game/judge-guess'
import { AnswerForm, GameHeader, JudgesStatus, NotJudgedPanel, RejectedPanel, ScoreAxes, StrikeDots } from '@/scenes/game/parts'
import { useDeviceColumn } from '@/scenes/game/use-device-column'
import { judgesSplit, rejectedSentence } from '@/scenes/game/verdict'
import {
  escapeEnd, escapeReducer, escapeShareGrid, levelsCleared, previousGuess, startEscape, strikesUsed, usedOn,
} from './reducer'
import './escape.css'

// Category Escape (5.5 E1, E2): one run of 6 levels, each adding a rule.

const config = categoryEscapeConfig
const reduce = escapeReducer(config)
const levelCode = (index: number) => format('escape.level', { n: String(index + 1).padStart(2, '0') })
// The rule a level adds: its last condition (level 1's is the category).
const ruleOf = (puzzle: Puzzle, index: number): PuzzleCondition | undefined => puzzle.rounds[index]?.conditions.at(-1)
const ruleText = (puzzle: Puzzle, index: number) => {
  const label = ruleOf(puzzle, index)?.label ?? ''
  return index === 0 ? label : format('escape.adds', { rule: label })
}

type EscapeUi = Ui | { kind: 'reused', level: number }

export function EscapeGame({ puzzle }: { puzzle: Puzzle }) {
  const { game, n } = puzzle
  const [run, dispatch] = useReducer(reduce, undefined, () => loadProgress(game, n).run ?? startEscape(config))
  const [ui, setUi] = useState<EscapeUi>(() => {
    const level = run.rounds[run.current]
    const last = level?.pending ? level.guesses.at(-1) : undefined
    return last ? { kind: 'rejected', guess: last } : { kind: 'input' }
  })
  const [answer, setAnswer] = useState('')
  const [scores, setScores] = useState<Record<string, number | undefined>>({})
  // The last judged guess, for the side panel and the note under the field.
  const [last, setLast] = useState<{ answer: string, level: number, pass: boolean, overruled?: boolean } | undefined>()
  const [model] = useState<CloudModel>(loadCloudModel)
  const [showTip, setShowTip] = useState(() => run.current === 0 && !tipSeen(game))
  const [storageOn] = useState(isStorageAvailable)
  const [best, setBest] = useState(() => loadProgress(game, n).best)
  const attempt = useRef(0)
  const turnstile = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const column = useDeviceColumn()

  const cleared = levelsCleared(run)
  const conditions = puzzle.rounds[run.current]?.conditions ?? []
  const level = run.current
  const over = run.finished
  useEffect(() => { saveRun(game, n, run, cleared) }, [game, n, run, cleared])
  useEffect(() => {
    if (ui.kind === 'judging' || over) return
    input.current?.focus()
    if (ui.kind === 'rejected') input.current?.select()
  }, [level, over, ui.kind])

  async function judge(text: string) {
    const normalized = normalizeAnswer(text, game)
    if (!normalized) { setUi({ kind: 'input', notice: 'input.empty' }); return }
    if (!isValidAnswer(normalized, game)) { setUi({ kind: 'input', notice: 'input.tooLong' }); return }
    const used = usedOn(run, normalized)
    if (used !== undefined) { setUi({ kind: 'reused', level: used }); return }
    const earlier = previousGuess(run, normalized)
    if (earlier) { column.clear(); setUi({ kind: 'rejected', guess: earlier }); return }

    attempt.current += 1
    setUi({ kind: 'judging' })
    const roundId = puzzle.rounds[run.current]?.id ?? ''
    const result = await judgeGuess({ game, n, roundId, text, normalized, attempt: attempt.current, model, conditions, turnstile: turnstile.current }, column.follow())
    if ('ui' in result) { setUi(result.ui); return }
    column.judged(result.modelMs)
    setScores(result.scores)
    setLast({ answer: normalized, level: run.current, pass: result.guess.pass })
    dispatch({ type: 'judged', guess: result.guess })
    if (result.guess.pass) {
      setAnswer('')
      setUi({ kind: 'input' })
    } else {
      setUi({ kind: 'rejected', guess: result.guess })
    }
  }

  function type(value: string) {
    // Typing the next guess is "moving on": only now does a rejection cost a strike.
    if (ui.kind === 'rejected') { dispatch({ type: 'moveOn' }); setUi({ kind: 'input' }) }
    else if ((ui.kind === 'input' && ui.notice) || ui.kind === 'reused') setUi({ kind: 'input' })
    setAnswer(value)
  }

  function countAnyway() {
    if (ui.kind === 'rejected') {
      markOverruled(game, n, puzzle.rounds[run.current]?.id ?? '', ui.guess.answer)
      setLast({ answer: ui.guess.answer, level: run.current, pass: true, overruled: true })
    }
    dispatch({ type: 'countAnyway' })
    setAnswer('')
    setUi({ kind: 'input' })
  }

  function restart() {
    column.clear()
    setBest(loadProgress(game, n).best)
    setScores({})
    setLast(undefined)
    setAnswer('')
    setUi({ kind: 'input' })
    dispatch({ type: 'restart' })
  }

  const note = ui.kind === 'reused'
    ? format('escape.reusedUnder', { level: levelCode(ui.level) })
    : ui.kind === 'input' && ui.notice
      ? en[ui.notice]
      : last?.pass && ui.kind === 'input' && !answer
        ? last.overruled ? en['verdict.overruled'] : format('escape.accepted', { level: levelCode(last.level) })
        : format('game.counter', { count: [...answer].length, max: config.input.maxCharacters })

  return (
    <main data-scene="game" className="app-frame game-frame" data-game={game}>
      <GameHeader game={game} n={n} status={run.finished ? en['escape.runOver'] : format('escape.cleared', { n: cleared })} statusClass={run.finished ? undefined : 'game-header__status--wide'}>
        <StrikeDots used={strikesUsed(run)} max={config.maxWrongGuessesPerRun} />
      </GameHeader>
      {column.setupOpen && <DeviceSetup onClose={column.closeSetup} />}
      {!storageOn && <p className="strip" role="status">{en['storage.off']}</p>}
      <div ref={turnstile} className="turnstile" />
      {run.finished
        ? <RunOver run={run} puzzle={puzzle} best={best} onRestart={restart} />
        : (
            <div className="game-body">
              <section className="game-main escape-main" aria-label={en['escape.levels']}>
                {showTip && run.current === 0 && (
                  <aside className="tip">
                    <span>{en['tip.escape']}</span>
                    <button type="button" className="pill pill--quiet" onClick={() => { markTipSeen(game); setShowTip(false) }}>{en['tip.dismiss']}</button>
                  </aside>
                )}
                <div>
                  <p className="telemetry escape-category">{en['escape.category']}</p>
                  <h1 className="escape-title">{ruleOf(puzzle, 0)?.label}</h1>
                </div>
                <ol className="levels" aria-label={en['escape.levels']}>
                  {puzzle.rounds.map((round, i) => ({ round, i })).reverse().map(({ round, i }) => {
                    const state = i < run.current ? 'done' : i === run.current ? 'now' : 'locked'
                    const failed = state === 'now' && ui.kind === 'rejected' && ui.guess.failed.includes(ruleOf(puzzle, i)?.id ?? '')
                    return (
                      <li key={round.id} className={`level level--${state}${failed ? ' level--failed' : ''}`} aria-current={state === 'now' ? 'step' : undefined}>
                        <span className="level__code">{levelCode(i)}</span>
                        <span className="level__rule">{state === 'locked' ? en['escape.hidden'] : ruleText(puzzle, i)}</span>
                        <span className="level__note">{state === 'done' ? run.rounds[i]?.guesses.at(-1)?.answer : state === 'now' ? en['escape.now'] : ''}</span>
                      </li>
                    )
                  })}
                </ol>
                <AnswerForm
                  label={levelCode(run.current)} placeholder={en['game.placeholder.category-escape']} answer={answer} maxLength={config.input.maxCharacters}
                  judging={ui.kind === 'judging'} waiting={column.run?.kind === 'scanning'} input={input} onType={type} onSubmit={() => { void judge(answer) }} invalid={ui.kind === 'reused'}
                />
                <p id="answer-note" className={ui.kind === 'reused' ? 'telemetry answer-note--fail' : 'telemetry'} aria-live="polite">{note}</p>
                <div aria-live="polite">
                  {ui.kind === 'rejected' && (
                    <RejectedPanel
                      sentence={rejectedSentence(ui.guess, conditions, levelCode) + (judgesSplit(column.run, ui.guess.failed, conditions) ? en['verdict.judgesDisagree'] : '')}
                      onTryAgain={() => { dispatch({ type: 'moveOn' }); setUi({ kind: 'input' }); setAnswer(''); input.current?.focus() }}
                      onCountAnyway={countAnyway}
                    />
                  )}
                  <NotJudgedPanel ui={ui.kind === 'reused' ? { kind: 'input' } : ui} onRetry={() => { void judge(answer) }} onEdit={() => { setUi({ kind: 'input' }); input.current?.focus() }} />
                </div>
                <div className="escape-footer">
                  <button type="button" className="pill pill--quiet" onClick={() => { dispatch({ type: 'giveUp' }) }} disabled={ui.kind === 'judging'}>{en['escape.giveUp']}</button>
                  <span className="escape-footer__hint">{en['escape.hint']}</span>
                </div>
              </section>
              <aside className="escape-side escape-side--play">
                <div>
                  <p className="telemetry">{en['escape.used']}</p>
                  <ul className="used">
                    {run.rounds.map((level, i) => (level.status === 'solved'
                      ? <li key={i}><span className="used__answer">{level.guesses.at(-1)?.answer}</span><span className="telemetry">{levelCode(i)}</span></li>
                      : null))}
                  </ul>
                </div>
                {last
                  ? (
                      <ScoreAxes
                        conditions={puzzle.rounds[last.level]?.conditions ?? []} scores={scores} threshold={judgeConfig.passThreshold[model]} model={model}
                        column={column} mark={levelCode} title={format('escape.lastVerdict', { answer: last.answer, level: levelCode(last.level) })}
                      />
                    )
                  : <p className="telemetry"><JudgesStatus model={model} column={column} /></p>}
              </aside>
            </div>
          )}
    </main>
  )
}

function RunOver({ run, puzzle, best, onRestart }: { run: RunState, puzzle: Puzzle, best: number | undefined, onRestart: () => void }) {
  const end = escapeEnd(run)
  const score = levelsCleared(run)
  const grid = escapeShareGrid(run)
  const [path, setPath] = useState<Reveal['path'] | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)
  const [nextPuzzle, setNextPuzzle] = useState<{ n: number, difficulty: string } | undefined>()
  const actions = useRef<HTMLDivElement>(null)
  const lastId = puzzle.rounds.at(-1)?.id ?? ''
  const code = String(puzzle.n).padStart(3, '0')

  const loadPath = () => {
    setPath(undefined)
    void fetchReveal(puzzle.game, puzzle.n, lastId).then((value) => { setPath(value?.path ?? null) })
  }
  useEffect(() => {
    let live = true
    void fetchReveal(puzzle.game, puzzle.n, lastId).then((value) => { if (live) setPath(value?.path ?? null) })
    void loadPuzzleIndex().then((index) => { if (live) setNextPuzzle(index?.[puzzle.game]?.find((entry) => entry.n > puzzle.n)) })
    return () => { live = false }
  }, [puzzle.game, puzzle.n, lastId])
  // The primary action takes focus, so Enter goes straight on (G6).
  useEffect(() => { actions.current?.querySelector<HTMLElement>('a, button')?.focus() }, [nextPuzzle])

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
        <div ref={actions} className="actions">
          {nextPuzzle && <Link className="pill control-link" to={`/play/${puzzle.game}/${String(nextPuzzle.n)}`}>{format('results.next', { n: String(nextPuzzle.n).padStart(3, '0'), difficulty: en[`difficulty.${nextPuzzle.difficulty as 'easy'}`] })}</Link>}
          <button type="button" className={nextPuzzle ? 'pill pill--quiet' : 'pill'} onClick={onRestart}>{format('escape.tryAgain', { n: code })}</button>
          <button type="button" className="pill pill--quiet" onClick={() => { void navigator.clipboard.writeText(share).then(() => { setCopied(true); setTimeout(() => { setCopied(false) }, 2000) }) }}>{en['results.copy']}</button>
        </div>
        <p role="status" className="telemetry">{copied ? en['toast.copied'] : ''}</p>
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
