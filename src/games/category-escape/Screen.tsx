import { useReducer } from 'react'
import { judgeConfig } from '@shared/config'
import { categoryEscapeConfig } from '@shared/games/category-escape'
import type { Puzzle } from '@shared/schemas/puzzle'
import { DeviceSetup } from '@/components/DeviceSetup/DeviceSetup'
import { en, format } from '@/copy/en'
import { loadProgress } from '@/lib/storage/progress'
import { GameTip } from '@/scenes/game/GameTip'
import { AnswerForm, CloudStrip, GameHeader, JudgesStatus, NotJudgedPanel, RejectedPanel, ScoreAxes, StrikeDots } from '@/scenes/game/parts'
import { useGameSession } from '@/scenes/game/use-game-session'
import { rejectedSentence, verdictNote } from '@/scenes/game/verdict'
import { levelCode, ruleOf, ruleText } from './labels'
import { escapeReducer, levelsCleared, startEscape, strikesUsed } from './reducer'
import { RunOver } from './RunOver'
import './escape.css'

const config = categoryEscapeConfig
const reduce = escapeReducer(config)

export function EscapeGame({ puzzle }: { puzzle: Puzzle }) {
  const { game, n } = puzzle
  const [run, dispatch] = useReducer(reduce, undefined, () => loadProgress(game, n).run ?? startEscape(config))
  const { ui, answer, scores, last, model, storageOn, best, turnstile, input, column, busy, judge, type, edit, tryAgain, countAnyway, reset } = useGameSession(puzzle, run, dispatch)
  const cleared = levelsCleared(run)
  const conditions = puzzle.rounds[run.current]?.conditions ?? []

  function restart() {
    reset()
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
      <CloudStrip column={column} />
      {!storageOn && <p className="strip" role="status">{en['storage.off']}</p>}
      <div ref={turnstile} className="turnstile" />
      {run.finished
        ? <RunOver run={run} puzzle={puzzle} best={best} onRestart={restart} />
        : (
            <div className="game-body">
              <section className="game-main escape-main" aria-label={en['escape.levels']}>
                {run.current === 0 && <GameTip game={game} copy="tip.escape" />}
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
                  judging={busy} input={input} onType={type} onSubmit={() => { void judge() }} invalid={ui.kind === 'reused'}
                />
                <p id="answer-note" className={ui.kind === 'reused' ? 'telemetry answer-note--fail' : 'telemetry'} aria-live="polite">{note}</p>
                <div aria-live="polite">
                  {ui.kind === 'rejected' && (
                    <RejectedPanel
                      sentence={rejectedSentence(ui.guess, conditions, levelCode) + verdictNote(column)}
                      disabled={busy}
                      onTryAgain={tryAgain}
                      onCountAnyway={countAnyway}
                    />
                  )}
                  <NotJudgedPanel ui={ui} onRetry={() => { void judge() }} onEdit={edit} onAddDevice={column.canAdd ? column.openSetup : undefined} />
                </div>
                <div className="escape-footer">
                  <button type="button" className="pill pill--quiet" onClick={() => { dispatch({ type: 'giveUp' }) }} disabled={busy}>{en['escape.giveUp']}</button>
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
                        conditions={puzzle.rounds[last.level]?.conditions ?? []} scores={scores} model={model}
                        threshold={column.decidedBy === 'device' ? judgeConfig.passThreshold.device : judgeConfig.passThreshold[model]}
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
