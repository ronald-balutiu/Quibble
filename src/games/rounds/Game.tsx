import { useReducer } from 'react'
import { judgeConfig } from '@shared/config'
import { doubleAgentConfig } from '@shared/games/double-agent'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import type { Puzzle } from '@shared/schemas/puzzle'
import { DeviceSetup } from '@/components/DeviceSetup/DeviceSetup'
import { en, format, type CopyKey } from '@/copy/en'
import { Clues, GuessMap } from '@/games/double-agent/Screen'
import { agentSentence } from '@/games/double-agent/verdict'
import { loadProgress } from '@/lib/storage/progress'
import { GameTip } from '@/scenes/game/GameTip'
import { AnswerForm, CloudStrip, GameHeader, NotJudgedPanel, RejectedPanel, ScoreAxes, StrikeDots } from '@/scenes/game/parts'
import { useGameSession } from '@/scenes/game/use-game-session'
import { letterFor, rejectedSentence, verdictNote } from '@/scenes/game/verdict'
import { runReducer, startRun, totalScore } from './reducer'
import { RoundEnd } from './RoundEnd'
import { Results } from './Results'

// What differs between the two round-based games: Oddly Specific (G1–G6) and
// Double Agent (D1, D2). Double Agent's clues, guess map and word list are drawn below.
interface RoundVariant {
  config: typeof oddlySpecificConfig | typeof doubleAgentConfig
  reduce: ReturnType<typeof runReducer>
  tip: CopyKey
  label: CopyKey
  tooLong: CopyKey
  alsoFits: CopyKey
}
const roundGames: Record<'oddly-specific' | 'double-agent', RoundVariant> = {
  'oddly-specific': {
    config: oddlySpecificConfig, reduce: runReducer(oddlySpecificConfig),
    tip: 'tip.oddly', label: 'game.answer', tooLong: 'input.tooLong', alsoFits: 'game.alsoFits',
  },
  'double-agent': {
    config: doubleAgentConfig, reduce: runReducer(doubleAgentConfig),
    tip: 'tip.agent', label: 'game.word', tooLong: 'input.tooLong.double-agent', alsoFits: 'game.alsoFits.double-agent',
  },
}
export function RoundGame({ puzzle }: { puzzle: Puzzle }) {
  const variant = roundGames[puzzle.game === 'double-agent' ? 'double-agent' : 'oddly-specific']
  const { game, n } = puzzle
  const config = variant.config
  const agent = game === 'double-agent'
  const [run, dispatch] = useReducer(variant.reduce, undefined, () => loadProgress(game, n).run ?? startRun(variant.config))
  const { ui, answer, scores, model, storageOn, best, turnstile, input, column, busy, judge, type, edit, tryAgain, countAnyway, reset } = useGameSession(puzzle, run, dispatch)
  const round = run.rounds[run.current]
  const conditions = puzzle.rounds[run.current]?.conditions ?? []
  const roundOver = round !== undefined && round.status !== 'playing'
  const score = totalScore(run)

  function nextRound() {
    reset()
    dispatch({ type: 'nextRound' })
  }

  if (!round) return null
  const header = (
    <GameHeader game={game} n={n} status={run.finished ? format('game.points', { points: score }) : format('game.round', { n: run.current + 1, total: run.rounds.length })}>
      <StrikeDots used={round.strikes} max={variant.config.maxWrongGuessesPerRound} />
    </GameHeader>
  )

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
                  {run.current === 0 && <GameTip game={game} copy={variant.tip} />}
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
                    judging={busy} input={input} onType={type} onSubmit={() => { void judge() }}
                  />
                  <p id="answer-note" className="telemetry">
                    {ui.kind === 'input' && ui.notice ? en[ui.notice === 'input.tooLong' ? variant.tooLong : ui.notice] : format('game.counter', { count: [...answer].length, max: 'maxLetters' in config.input ? config.input.maxLetters : config.input.maxCharacters })}
                  </p>
                  <div aria-live="polite">
                    {ui.kind === 'rejected' && (
                      <RejectedPanel
                        sentence={(agent ? agentSentence(ui.guess, conditions) : rejectedSentence(ui.guess, conditions)) + verdictNote(column)}
                        disabled={busy}
                        onTryAgain={tryAgain}
                        onCountAnyway={countAnyway}
                      />
                    )}
                    <NotJudgedPanel ui={ui} onRetry={() => { void judge() }} onEdit={edit} onAddDevice={column.canAdd ? column.openSetup : undefined} />
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
