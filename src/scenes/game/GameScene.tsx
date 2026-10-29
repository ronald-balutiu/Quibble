import { useEffect, useReducer, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { judgeConfig } from '@shared/config'
import { gameConfigs, gameIds, type GameId } from '@shared/games'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { isValidAnswer, normalizeAnswer } from '@shared/normalize'
import type { CloudModel, Reveal } from '@shared/schemas/judge'
import type { Puzzle } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import {
  maxScore, previousGuess, runReducer, shareGrid, startRun, totalScore, type Guess, type RunState,
} from '@/games/oddly-specific/reducer'
import { judgeOnCloud, type CloudMessage } from '@/judges/attempt'
import { fetchReveal } from '@/lib/api'
import { loadPuzzle, loadPuzzleIndex } from '@/lib/puzzles'
import { isStorageAvailable, loadProgress, saveRun } from '@/lib/storage/progress'
import { loadCloudModel, markTipSeen, tipSeen } from '@/lib/storage/settings'
import { renewSession } from '@/lib/turnstile'
import { letterFor, rejectedSentence, toGuess } from './verdict'
import './game.css'

type Ui =
  | { kind: 'input', notice?: 'input.empty' | 'input.tooLong' | 'input.repeat' }
  | { kind: 'judging' }
  | { kind: 'rejected', guess: Guess }
  | { kind: 'notJudged', message: CloudMessage | 'cloud.busy', retryAfter?: number }
  | { kind: 'resting', resetAt: string }

const reduce = runReducer(oddlySpecificConfig)
const PLAYABLE: readonly GameId[] = ['oddly-specific']

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
  return <Game key={`${game}-${String(n)}`} puzzle={puzzle} />
}

function Game({ puzzle }: { puzzle: Puzzle }) {
  const { game, n } = puzzle
  const config = gameConfigs[game]
  const [run, dispatch] = useReducer(reduce, undefined, () => loadProgress(game, n).run ?? startRun(oddlySpecificConfig))
  const [ui, setUi] = useState<Ui>({ kind: 'input' })
  const [answer, setAnswer] = useState('')
  const [scores, setScores] = useState<Record<string, number | undefined>>({})
  const [model] = useState<CloudModel>(loadCloudModel)
  const [showTip, setShowTip] = useState(() => run.current === 0 && !tipSeen(game))
  const [storageOn] = useState(isStorageAvailable)
  const [best] = useState(() => loadProgress(game, n).best)
  const attempt = useRef(0)
  const turnstile = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  const round = run.rounds[run.current]
  const conditions = puzzle.rounds[run.current]?.conditions ?? []
  const roundOver = round !== undefined && round.status !== 'playing'
  const score = totalScore(run)

  const roundIndex = run.current
  useEffect(() => { saveRun(game, n, run, score) }, [game, n, run, score])
  useEffect(() => { input.current?.focus() }, [roundIndex])

  function nextRound() {
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
    if (earlier) { setUi(earlier.pass ? { kind: 'input', notice: 'input.repeat' } : { kind: 'rejected', guess: earlier }); return }

    attempt.current += 1
    setUi({ kind: 'judging' })
    const container = turnstile.current
    const outcome = await judgeOnCloud(
      { game, n, roundId: puzzle.rounds[run.current]?.id ?? '', answer: text, attempt: attempt.current, model },
      () => (container ? renewSession(container) : Promise.resolve('error')),
    )
    switch (outcome.kind) {
      case 'judged': {
        const guess = toGuess(normalized, outcome.result, conditions, model)
        setScores(Object.fromEntries(Object.entries(outcome.result.conditions).map(([id, { p }]) => [id, p])))
        dispatch({ type: 'judged', guess })
        setUi(guess.pass ? { kind: 'input' } : { kind: 'rejected', guess })
        return
      }
      case 'busy': setUi({ kind: 'notJudged', message: 'cloud.busy', retryAfter: outcome.retryAfter }); return
      case 'resting': setUi({ kind: 'resting', resetAt: outcome.resetAt }); return
      case 'invalid': setUi({ kind: 'input', notice: 'input.tooLong' }); return
      case 'error': setUi({ kind: 'notJudged', message: outcome.message }); return
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (ui.kind === 'judging') return
    void judge(answer)
  }

  function type(value: string) {
    // Typing the next guess is "moving on": only now does a rejection cost a strike.
    if (ui.kind === 'rejected') { dispatch({ type: 'moveOn' }); setUi({ kind: 'input' }) }
    else if (ui.kind === 'input' && ui.notice) setUi({ kind: 'input' })
    setAnswer(value)
  }

  if (!round) return null
  const header = (
    <header className="game-header">
      <Link className="game-header__back" to="/play" aria-label={en['nav.backToLibrary']}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </Link>
      <span className="game-header__code">{format('game.header', { code: en[`game.code.${game}`], n: String(n).padStart(3, '0') })}</span>
      <span className="telemetry">{run.finished ? format('game.points', { points: score }) : format('game.round', { n: run.current + 1, total: run.rounds.length })}</span>
      <StrikeDots used={round.strikes} max={oddlySpecificConfig.maxWrongGuessesPerRound} />
    </header>
  )

  return (
    <main data-scene="game" className="app-frame game-frame" data-game={game}>
      {header}
      {!storageOn && <p className="strip" role="status">{en['storage.off']}</p>}
      <div ref={turnstile} className="turnstile" />
      {run.finished
        ? <Results run={run} puzzle={puzzle} best={best} />
        : roundOver
          ? <RoundEnd run={run} puzzle={puzzle} onNext={nextRound} />
          : (
              <div className="game-body">
                <section className="game-main" aria-label={en['game.conditions']}>
                  {showTip && run.current === 0 && (
                    <aside className="tip">
                      <span>{en['tip.oddly']}</span>
                      <button type="button" className="pill pill--quiet" onClick={() => { markTipSeen(game); setShowTip(false) }}>{en['tip.dismiss']}</button>
                    </aside>
                  )}
                  <ol className="conditions">
                    {conditions.map((condition, i) => (
                      <li key={condition.id} className={ui.kind === 'rejected' && ui.guess.failed.includes(condition.id) ? 'conditions__item conditions__item--failed' : 'conditions__item'}>
                        <span className="conditions__letter">{letterFor(i)}</span>
                        <span className="conditions__label">{condition.label}</span>
                      </li>
                    ))}
                  </ol>
                  <form className="answer" onSubmit={submit}>
                    <label htmlFor="answer" className="telemetry">{en['game.answer']}</label>
                    <input
                      ref={input} id="answer" value={answer} autoComplete="off"
                      maxLength={config.input.maxCharacters} placeholder={en['game.placeholder.oddly-specific']}
                      disabled={ui.kind === 'judging'} aria-describedby="answer-note"
                      onChange={(event) => { type(event.target.value) }}
                    />
                    <button type="submit" className="answer__judge" disabled={!answer.trim() || ui.kind === 'judging'}>
                      {ui.kind === 'judging' ? en['game.judging'] : en['game.judge']}
                    </button>
                  </form>
                  <p id="answer-note" className="telemetry">
                    {ui.kind === 'input' && ui.notice ? en[ui.notice] : format('game.counter', { count: [...answer].length, max: config.input.maxCharacters })}
                  </p>
                  <div aria-live="polite">
                    {ui.kind === 'rejected' && (
                      <div className="verdict verdict--rejected">
                        <p className="telemetry verdict__label">{en['verdict.label.rejected']}</p>
                        <p className="verdict__sentence">{rejectedSentence(ui.guess, conditions)}</p>
                        <div className="actions">
                          <button type="button" className="pill" onClick={() => { dispatch({ type: 'moveOn' }); setUi({ kind: 'input' }); setAnswer(''); input.current?.focus() }}>{en['game.tryAgain']}</button>
                          <button type="button" className="pill pill--quiet" onClick={() => { dispatch({ type: 'countAnyway' }) }}>{en['game.countAnyway']}</button>
                        </div>
                      </div>
                    )}
                    {ui.kind === 'notJudged' && (
                      <div className="verdict">
                        <p className="telemetry verdict__label">{en['notJudged.label']}</p>
                        <p className="verdict__sentence">{ui.message === 'cloud.busy' ? format('cloud.busy', { s: ui.retryAfter ?? 60 }) : en[ui.message]}</p>
                        <div className="actions">
                          {ui.message === 'session.botcheck'
                            ? <button type="button" className="pill" onClick={() => { window.location.reload() }}>{en['action.reload']}</button>
                            : <button type="button" className="pill" onClick={() => { void judge(answer) }}>{en['action.retry']}</button>}
                          <button type="button" className="pill pill--quiet" onClick={() => { setUi({ kind: 'input' }); input.current?.focus() }}>{en['action.editAnswer']}</button>
                        </div>
                      </div>
                    )}
                    {ui.kind === 'resting' && (
                      <div className="verdict">
                        <p className="telemetry verdict__label">{en['notJudged.label']}</p>
                        <p className="verdict__sentence">{format('cloud.resting.headline', { time: new Date(ui.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p>
                        <p>{en['cloud.resting.body']}</p>
                        <div className="actions"><Link className="pill control-link" to="/play">{en['nav.backToLibrary']}</Link></div>
                      </div>
                    )}
                  </div>
                  <button type="button" className="pill pill--quiet game-skip" onClick={() => { dispatch({ type: 'skip' }) }} disabled={ui.kind === 'judging'}>{en['game.skip']}</button>
                </section>
                <ScoreAxes conditions={conditions} scores={scores} threshold={judgeConfig.passThreshold[model]} model={model} />
              </div>
            )}
    </main>
  )
}

function StrikeDots({ used, max }: { used: number, max: number }) {
  return (
    <span className="strikes" role="img" aria-label={format('game.strikes', { used, max })}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < used ? 'strikes__dot strikes__dot--used' : 'strikes__dot'} />)}
    </span>
  )
}

function ScoreAxes({ conditions, scores, threshold, model }: { conditions: Puzzle['rounds'][number]['conditions'], scores: Record<string, number | undefined>, threshold: number, model: CloudModel }) {
  return (
    <section className="axes" aria-label={en['game.verdicts']}>
      <p className="telemetry axes__head">
        <span>{format('game.cloudStatus', { model: en[`judgeChoice.${model}`] })}</span>
        <span>{en['game.pYes']}</span>
      </p>
      {conditions.map((condition, i) => {
        const p = scores[condition.id]
        return (
          <div key={condition.id} className="axis">
            <span className="axis__letter">{letterFor(i)}</span>
            {/* eslint-disable-next-line react/forbid-dom-props -- the threshold and score positions are runtime values; CSS owns the styling. */}
            <span className="axis__track" style={{ '--threshold': threshold, '--p': p ?? 0 } as CSSProperties}>
              <span className="axis__tick" />
              {p !== undefined && <span className={p >= threshold ? 'axis__dot' : 'axis__dot axis__dot--fail'} />}
            </span>
            <span className="axis__value">{p === undefined ? '' : p.toFixed(2)}</span>
          </div>
        )
      })}
    </section>
  )
}

function RoundEnd({ run, puzzle, onNext }: { run: RunState, puzzle: Puzzle, onNext: () => void }) {
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
  const loadReveal = () => { setReveal(undefined); void fetchReveal(puzzle.game, puzzle.n, puzzle.rounds[run.current]?.id ?? '').then((value) => { setReveal(value ?? null) }) }

  return (
    <section className="round-end" aria-live="polite">
      {solved ? (
        <>
          <p className="telemetry round-end__label">{round.overruled ? en['verdict.overruled'] : format('verdict.label.accepted', { points: round.points })}</p>
          <h1 className="round-end__answer">{winning?.answer}</h1>
          <p>{format('verdict.accepted', { n: round.strikes + 1 })}</p>
        </>
      ) : (
        <>
          <p className="telemetry round-end__label round-end__label--lost">{format('round.lost', { n: run.current + 1 })}</p>
          <p>{en['round.example']}</p>
          <h1 className="round-end__answer">{reveal?.example}</h1>
        </>
      )}
      <h2 className="telemetry">{en['game.alsoFits']}</h2>
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

function Results({ run, puzzle, best }: { run: RunState, puzzle: Puzzle, best: number | undefined }) {
  const score = totalScore(run)
  const max = maxScore(oddlySpecificConfig)
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
