import { useEffect, useReducer, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { judgeConfig } from '@shared/config'
import { gameConfigs, gameIds, type GameId } from '@shared/games'
import { doubleAgentConfig } from '@shared/games/double-agent'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { isValidAnswer, normalizeAnswer } from '@shared/normalize'
import type { CloudModel, Reveal } from '@shared/schemas/judge'
import type { Puzzle } from '@shared/schemas/puzzle'
import { DeviceSetup } from '@/components/DeviceSetup/DeviceSetup'
import { en, format, type CopyKey } from '@/copy/en'
import { EscapeGame } from '@/games/category-escape/Screen'
import { Clues, GuessMap, RoundWords } from '@/games/double-agent/Screen'
import { agentSentence } from '@/games/double-agent/verdict'
import {
  maxScore, previousGuess, runReducer, shareGrid, startRun, totalScore, type RoundsConfig, type RunState,
} from '@/games/oddly-specific/reducer'
import { fetchReveal } from '@/lib/api'
import { loadPuzzle, loadPuzzleIndex } from '@/lib/puzzles'
import { markOverruled } from '@/lib/storage/comparisons'
import { isStorageAvailable, loadProgress, saveRun } from '@/lib/storage/progress'
import { loadCloudModel, markTipSeen, tipSeen } from '@/lib/storage/settings'
import { judgeGuess, type Ui } from './judge-guess'
import { AnswerForm, CloudStrip, GameHeader, NotJudgedPanel, RejectedPanel, ScoreAxes, StrikeDots } from './parts'
import { useDeviceColumn, type DeviceColumn } from './use-device-column'
import { judgesSplit, letterFor, rejectedSentence, verdictNote } from './verdict'
import './game.css'

// What differs between the two round-based games: Oddly Specific (G1–G6) and
// Double Agent (D1, D2). Double Agent's clues, guess map and word list are drawn below.
interface RoundGame {
  config: RoundsConfig & { input: { maxCharacters: number } }
  reduce: ReturnType<typeof runReducer>
  tip: CopyKey
  label: CopyKey
  tooLong: CopyKey
  alsoFits: CopyKey
}
const roundGames: Record<'oddly-specific' | 'double-agent', RoundGame> = {
  'oddly-specific': {
    config: oddlySpecificConfig, reduce: runReducer(oddlySpecificConfig),
    tip: 'tip.oddly', label: 'game.answer', tooLong: 'input.tooLong', alsoFits: 'game.alsoFits',
  },
  'double-agent': {
    config: doubleAgentConfig, reduce: runReducer(doubleAgentConfig),
    tip: 'tip.agent', label: 'game.word', tooLong: 'input.tooLong.double-agent', alsoFits: 'game.alsoFits.double-agent',
  },
}
const PLAYABLE: readonly GameId[] = ['oddly-specific', 'category-escape', 'double-agent']

export function GameScene() {
  const params = useParams()
  const game = gameIds.find((id) => id === params.game)
  const n = Number(params.n)
  const playable = game !== undefined && PLAYABLE.includes(game) && Number.isInteger(n)
  const [puzzle, setPuzzle] = useState<Puzzle | null | undefined>(undefined)

  useEffect(() => {
    if (!playable) return
    let live = true
    void loadPuzzle(game, n).then((loaded) => { if (live) setPuzzle(loaded ?? null) })
    return () => { live = false }
  }, [playable, game, n])

  if (playable && puzzle === undefined) return <main data-scene="game" className="app-frame game-frame" aria-busy="true"><p>{en['game.loading']}</p></main>
  if (!playable || !puzzle) return <main data-scene="game" className="app-frame game-frame"><p>{en['game.notFound']}</p><Link className="control-link" to="/play">{en['nav.library']}</Link></main>
  if (puzzle.game === 'category-escape') return <EscapeGame key={`${game}-${String(n)}`} puzzle={puzzle} />
  return <Game key={`${game}-${String(n)}`} puzzle={puzzle} variant={roundGames[puzzle.game]} />
}

function Game({ puzzle, variant }: { puzzle: Puzzle, variant: RoundGame }) {
  const { game, n } = puzzle
  const config = gameConfigs[game]
  const agent = game === 'double-agent'
  const [run, dispatch] = useReducer(variant.reduce, undefined, () => loadProgress(game, n).run ?? startRun(variant.config))
  // A rejection still pending after a reload is shown again, so the player can move on or overrule.
  const [ui, setUi] = useState<Ui>(() => {
    const pending = run.rounds[run.current]
    const last = pending?.pending ? pending.guesses.at(-1) : undefined
    return last ? { kind: 'rejected', guess: last } : { kind: 'input' }
  })
  const [answer, setAnswer] = useState('')
  const [scores, setScores] = useState<Record<string, number | undefined>>({})
  const [model] = useState<CloudModel>(loadCloudModel)
  const [showTip, setShowTip] = useState(() => run.current === 0 && !tipSeen(game))
  const [storageOn] = useState(isStorageAvailable)
  const [best] = useState(() => loadProgress(game, n).best)
  const attempt = useRef(0)
  const turnstile = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const column = useDeviceColumn()

  const round = run.rounds[run.current]
  const conditions = puzzle.rounds[run.current]?.conditions ?? []
  const roundOver = round !== undefined && round.status !== 'playing'
  const score = totalScore(run)

  const roundIndex = run.current
  // Nothing moves on until both judges are back, including a device-only Retry (3.7).
  const busy = ui.kind === 'judging' || column.run?.kind === 'scanning'
  useEffect(() => { saveRun(game, n, run, score) }, [game, n, run, score])
  // The field is disabled while judging; give it focus back so the next guess can be typed (5.5 G3).
  // After a rejection the old answer is selected, so typing the next guess replaces it.
  useEffect(() => {
    if (busy) return
    input.current?.focus()
    if (ui.kind === 'rejected') input.current?.select()
  }, [roundIndex, ui.kind, busy])

  function nextRound() {
    column.clear()
    setScores({})
    setAnswer('')
    setUi({ kind: 'input' })
    dispatch({ type: 'nextRound' })
  }

  async function judge(text: string) {
    const normalized = normalizeAnswer(text, game)
    if (!normalized) { setUi({ kind: 'input', notice: 'input.empty' }); return }
    if (!isValidAnswer(normalized, game)) { setUi({ kind: 'input', notice: 'input.tooLong' }); return }
    const earlier = previousGuess(run, normalized)
    if (earlier) { column.clear(); setUi(earlier.pass ? { kind: 'input', notice: 'input.repeat' } : { kind: 'rejected', guess: earlier }); return }

    attempt.current += 1
    setUi({ kind: 'judging' })
    setScores({})
    const result = await judgeGuess({
      game, n, roundId: puzzle.rounds[run.current]?.id ?? '', text, normalized, attempt: attempt.current, model, conditions, turnstile: turnstile.current,
    }, { onDevice: column.follow(), onCloud: (cloud, ms) => { setScores(cloud); column.judged(ms) } })
    column.settled(result)
    if ('ui' in result) { setUi(result.ui); return }
    dispatch({ type: 'judged', guess: result.guess })
    setUi(result.guess.pass ? { kind: 'input' } : { kind: 'rejected', guess: result.guess })
  }

  function type(value: string) {
    // Typing the next guess is "moving on": only now does a rejection cost a strike.
    if (ui.kind === 'rejected') { dispatch({ type: 'moveOn' }); setUi({ kind: 'input' }) }
    else if (ui.kind === 'input' && ui.notice) setUi({ kind: 'input' })
    setAnswer(value)
  }

  if (!round) return null
  const header = (
    <GameHeader game={game} n={n} status={run.finished ? format('game.points', { points: score }) : format('game.round', { n: run.current + 1, total: run.rounds.length })}>
      <StrikeDots used={round.strikes} max={variant.config.maxWrongGuessesPerRound} />
    </GameHeader>
  )

  const split = ui.kind === 'rejected' ? judgesSplit(column.run, ui.guess.failed, conditions) : undefined
  // When the device decided (S1), its own threshold is the one on the axes.
  const threshold = column.decidedBy === 'device' ? judgeConfig.passThreshold.device : judgeConfig.passThreshold[model]
  return (
    <main data-scene="game" className="app-frame game-frame" data-game={game}>
      {header}
      {column.setupOpen && <DeviceSetup onClose={column.closeSetup} />}
      <CloudStrip column={column} />
      {!storageOn && <p className="strip" role="status">{en['storage.off']}</p>}
      <div ref={turnstile} className="turnstile" />
      {run.finished
        ? <Results run={run} puzzle={puzzle} best={best} config={variant.config} />
        : roundOver
          ? <RoundEnd run={run} puzzle={puzzle} alsoFits={variant.alsoFits} column={column} onNext={nextRound} />
          : (
              <div className="game-body">
                <section className="game-main" aria-label={en['game.conditions']}>
                  {showTip && run.current === 0 && (
                    <aside className="tip">
                      <span>{en[variant.tip]}</span>
                      <button type="button" className="pill pill--quiet" onClick={() => { markTipSeen(game); setShowTip(false) }}>{en['tip.dismiss']}</button>
                    </aside>
                  )}
                  {agent
                    ? (
                        <>
                          <Clues conditions={conditions} />
                          <GuessMap className="guess-map--main" guesses={round.guesses} conditions={conditions} />
                        </>
                      )
                    : (
                        <ol className="conditions">
                          {conditions.map((condition, i) => (
                            <li key={condition.id} className={ui.kind === 'rejected' && ui.guess.failed.includes(condition.id) ? 'conditions__item conditions__item--failed' : 'conditions__item'}>
                              <span className="conditions__letter">{letterFor(i)}</span>
                              <span className="conditions__label">{condition.label}</span>
                            </li>
                          ))}
                        </ol>
                      )}
                  <AnswerForm
                    label={en[variant.label]} placeholder={en[`game.placeholder.${game}`]} answer={answer} maxLength={config.input.maxCharacters}
                    judging={busy} input={input} onType={type} onSubmit={() => { void judge(answer) }}
                  />
                  <p id="answer-note" className="telemetry">
                    {ui.kind === 'input' && ui.notice ? en[ui.notice === 'input.tooLong' ? variant.tooLong : ui.notice] : format('game.counter', { count: [...answer].length, max: 'maxLetters' in config.input ? config.input.maxLetters : config.input.maxCharacters })}
                  </p>
                  <div aria-live="polite">
                    {ui.kind === 'rejected' && (
                      <RejectedPanel
                        sentence={(agent ? agentSentence(ui.guess, conditions) : rejectedSentence(ui.guess, conditions)) + verdictNote(column, split)}
                        disabled={busy}
                        onTryAgain={() => { dispatch({ type: 'moveOn' }); setUi({ kind: 'input' }); setAnswer(''); input.current?.focus() }}
                        onCountAnyway={() => {
                          markOverruled(game, n, puzzle.rounds[run.current]?.id ?? '', ui.guess.answer)
                          dispatch({ type: 'countAnyway' })
                        }}
                      />
                    )}
                    <NotJudgedPanel ui={ui} onRetry={() => { void judge(answer) }} onEdit={() => { setUi({ kind: 'input' }); input.current?.focus() }} onAddDevice={column.canAdd ? column.openSetup : undefined} />
                  </div>
                  <button type="button" className="pill pill--quiet game-skip" onClick={() => { dispatch({ type: 'skip' }) }} disabled={busy}>{en['game.skip']}</button>
                </section>
                {agent
                  ? (
                      <aside className="game-side">
                        <GuessMap className="guess-map--side" guesses={round.guesses} conditions={conditions} />
                        <ScoreAxes conditions={conditions} scores={scores} threshold={threshold} model={model} column={column} />
                      </aside>
                    )
                  : <ScoreAxes conditions={conditions} scores={scores} threshold={threshold} model={model} column={column} />}
              </div>
            )}
    </main>
  )
}

function RoundEnd({ run, puzzle, alsoFits, column, onNext }: { run: RunState, puzzle: Puzzle, alsoFits: CopyKey, column: DeviceColumn, onNext: () => void }) {
  const round = run.rounds[run.current]
  const conditions = puzzle.rounds[run.current]?.conditions ?? []
  const [reveal, setReveal] = useState<Reveal | null | undefined>(undefined)
  const roundIndex = run.current
  const last = roundIndex === run.rounds.length - 1
  const next = useRef<HTMLButtonElement>(null)
  const roundId = puzzle.rounds[roundIndex]?.id ?? ''

  useEffect(() => {
    let live = true
    void fetchReveal(puzzle.game, puzzle.n, roundId).then((value) => { if (live) setReveal(value ?? null) })
    next.current?.focus()
    return () => { live = false }
  }, [puzzle.game, puzzle.n, roundId])

  if (!round) return null
  const solved = round.status === 'solved'
  const winning = round.guesses.at(-1)
  // The on-device run belongs to the last judged guess, so the sentence can say whether the judges agreed.
  const split = winning ? judgesSplit(column.run, winning.failed, conditions) : undefined
  const loadReveal = () => { setReveal(undefined); void fetchReveal(puzzle.game, puzzle.n, puzzle.rounds[run.current]?.id ?? '').then((value) => { setReveal(value ?? null) }) }

  return (
    <section className="round-end" aria-live="polite">
      {solved ? (
        <>
          <p className="telemetry round-end__label">{round.overruled ? en['verdict.overruled'] : format('verdict.label.accepted', { points: round.points })}</p>
          <h1 className="round-end__answer">{winning?.answer}</h1>
          <p>{format('verdict.accepted', { n: round.strikes + 1 }) + (column.decidedBy === 'device' ? en['verdict.notCompared'] : split === undefined ? '' : en[split ? 'verdict.judgesDisagreed' : 'verdict.judgesAgreed'])}</p>
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

function Results({ run, puzzle, best, config }: { run: RunState, puzzle: Puzzle, best: number | undefined, config: RoundsConfig }) {
  const score = totalScore(run)
  const max = maxScore(config)
  const grid = shareGrid(run)
  const [copied, setCopied] = useState(false)
  const [nextPuzzle, setNextPuzzle] = useState<{ n: number, difficulty: string } | undefined>()

  useEffect(() => {
    void loadPuzzleIndex().then((index) => { setNextPuzzle(index?.[puzzle.game]?.find((entry) => entry.n > puzzle.n)) })
  }, [puzzle])

  const bestLabel = best === undefined ? en['results.firstPlay'] : score > best ? format('results.newBest', { n: best }) : format('results.best', { n: best })
  const share = `${format('results.share', { game: en[`game.name.${puzzle.game}`], n: puzzle.n, tiles: grid.tiles, score, max })}\n${grid.text}`
  const guesses = run.rounds.reduce((total, round) => total + round.guesses.length, 0)

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
      </dl>
      <div className="actions">
        {nextPuzzle && <Link className="pill control-link" to={`/play/${puzzle.game}/${String(nextPuzzle.n)}`}>{format('results.next', { n: String(nextPuzzle.n).padStart(3, '0'), difficulty: en[`difficulty.${nextPuzzle.difficulty as 'easy'}`] })}</Link>}
        <button type="button" className="pill pill--quiet" onClick={() => { void navigator.clipboard.writeText(share).then(() => { setCopied(true); setTimeout(() => { setCopied(false) }, 2000) }) }}>{en['results.copy']}</button>
        <Link className="pill pill--quiet control-link" to="/play">{en['nav.library']}</Link>
      </div>
      <p role="status" className="telemetry">{copied ? en['toast.copied'] : ''}</p>
    </section>
  )
}
