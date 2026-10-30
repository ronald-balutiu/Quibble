import type { CSSProperties, ReactNode, RefObject } from 'react'
import { Link } from 'react-router'
import type { GameId } from '@shared/games'
import type { CloudModel } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import type { Ui } from './judge-guess'
import { letterFor } from './verdict'

// The components every game screen shares (5.5 G1–G7, 5.6): the header, strike
// dots, score axes, the answer field, and the rejected, not-judged and resting panels.

export function GameHeader({ game, n, status, children }: { game: GameId, n: number, status: string, children: ReactNode }) {
  return (
    <header className="game-header">
      <Link className="game-header__back" to="/play" aria-label={en['nav.backToLibrary']}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </Link>
      <span className="game-header__code">{format('game.header', { code: en[`game.code.${game}`], n: String(n).padStart(3, '0') })}</span>
      <span className="telemetry">{status}</span>
      {children}
    </header>
  )
}

export function StrikeDots({ used, max }: { used: number, max: number }) {
  return (
    <span className="strikes" role="img" aria-label={format('game.strikes', { used, max })}>
      {Array.from({ length: max }, (_, i) => <span key={i} className={i < used ? 'strikes__dot strikes__dot--used' : 'strikes__dot'} />)}
    </span>
  )
}

// One score axis per condition; `mark` names each one (a letter, or a level code).
export function ScoreAxes({ conditions, scores, threshold, model, mark = letterFor, title }: {
  conditions: readonly PuzzleCondition[], scores: Record<string, number | undefined>, threshold: number, model: CloudModel
  mark?: (index: number) => string, title?: string
}) {
  return (
    <section className="axes" aria-label={en['game.verdicts']}>
      <p className="telemetry axes__head">
        <span>{title ?? format('game.cloudStatus', { model: en[`judgeChoice.${model}`] })}</span>
        <span>{en['game.pYes']}</span>
      </p>
      {conditions.map((condition, i) => {
        const p = scores[condition.id]
        return (
          <div key={condition.id} className="axis">
            <span className="axis__letter">{mark(i)}</span>
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

// G3: the rejected verdict, with "Try again" and "Count it anyway".
export function RejectedPanel({ sentence, onTryAgain, onCountAnyway }: { sentence: string, onTryAgain: () => void, onCountAnyway: () => void }) {
  return (
    <div className="verdict verdict--rejected">
      <p className="telemetry verdict__label">{en['verdict.label.rejected']}</p>
      <p className="verdict__sentence">{sentence}</p>
      <div className="actions">
        <button type="button" className="pill" onClick={onTryAgain}>{en['game.tryAgain']}</button>
        <button type="button" className="pill pill--quiet" onClick={onCountAnyway}>{en['game.countAnyway']}</button>
      </div>
    </div>
  )
}

// G7 and S2: the guess wasn't judged, so it costs nothing.
export function NotJudgedPanel({ ui, onRetry, onEdit }: { ui: Ui, onRetry: () => void, onEdit: () => void }) {
  if (ui.kind === 'notJudged') {
    return (
      <div className="verdict">
        <p className="telemetry verdict__label">{en['notJudged.label']}</p>
        <p className="verdict__sentence">{ui.message === 'cloud.busy' ? format('cloud.busy', { s: ui.retryAfter ?? 60 }) : en[ui.message]}</p>
        <div className="actions">
          {ui.message === 'session.botcheck'
            ? <button type="button" className="pill" onClick={() => { window.location.reload() }}>{en['action.reload']}</button>
            : <button type="button" className="pill" onClick={onRetry}>{en['action.retry']}</button>}
          <button type="button" className="pill pill--quiet" onClick={onEdit}>{en['action.editAnswer']}</button>
        </div>
      </div>
    )
  }
  if (ui.kind === 'resting') {
    return (
      <div className="verdict">
        <p className="telemetry verdict__label">{en['notJudged.label']}</p>
        <p className="verdict__sentence">{format('cloud.resting.headline', { time: new Date(ui.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) })}</p>
        <p>{en['cloud.resting.body']}</p>
        <div className="actions"><Link className="pill control-link" to="/play">{en['nav.backToLibrary']}</Link></div>
      </div>
    )
  }
  return null
}

// The answer field and its Judge button (G1–G3).
export function AnswerForm({ label, placeholder, answer, maxLength, judging, input, onType, onSubmit, invalid }: {
  label: string, placeholder: string, answer: string, maxLength: number, judging: boolean, input: RefObject<HTMLInputElement | null>
  onType: (value: string) => void, onSubmit: () => void, invalid?: boolean
}) {
  return (
    <form className={invalid ? 'answer answer--invalid' : 'answer'} onSubmit={(event) => { event.preventDefault(); if (!judging) onSubmit() }}>
      <label htmlFor="answer" className="telemetry">{label}</label>
      <input
        ref={input} id="answer" value={answer} autoComplete="off"
        maxLength={maxLength} placeholder={placeholder}
        disabled={judging} aria-describedby="answer-note" aria-invalid={invalid}
        onChange={(event) => { onType(event.target.value) }}
      />
      <button type="submit" className="answer__judge" disabled={!answer.trim() || judging}>
        {judging ? en['game.judging'] : en['game.judge']}
      </button>
    </form>
  )
}
