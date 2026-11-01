import { useEffect, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router'
import type { GameId } from '@shared/games'
import type { CloudModel } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import type { Ui } from './judge-guess'
import type { DeviceColumn } from './use-device-column'
import { devicePasses, letterFor } from './verdict'

// The components every game screen shares (5.5 G1–G7, 5.6): the header, strike
// dots, score axes, the answer field, and the rejected, not-judged and resting panels.

// `statusClass` lets a screen hide its status on phone, where its mock has none.
export function GameHeader({ game, n, status, statusClass, children }: { game: GameId, n: number, status: string, statusClass?: string | undefined, children: ReactNode }) {
  return (
    <header className="game-header">
      <span className="game-header__code">{format('game.header', { code: en[`game.code.${game}`], n: String(n).padStart(3, '0') })}</span>
      <span className={statusClass ? `telemetry ${statusClass}` : 'telemetry'}>{status}</span>
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

// Seconds since the on-device run started, while its column scans (5.5 G2).
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    const timer = setInterval(() => { setNow(performance.now()) }, 100)
    return () => { clearInterval(timer) }
  }, [])
  return <>{format('judges.device.thinking', { s: (Math.max(0, now - since) / 1000).toFixed(1) })}</>
}

// The judge status line (5.5 G1–G3): "● Cloud … ○ Device …". On a capable device,
// "Device • off" opens the setup sheet (S3).
// While the cloud is out and the device decides, only the device is listed (S1).
export function JudgesStatus({ model, column }: { model: CloudModel, column: DeviceColumn }) {
  const { status, supported, run, modelMs } = column
  const scanning = run?.kind === 'scanning'
  const cloudOut = column.decidedBy === 'device' || (column.restingUntil !== undefined && modelMs === undefined)
  const cloud = cloudOut && column.cloudMessage === undefined
    ? null
    : column.cloudMessage !== undefined
      ? en['judges.cloud.noAnswer']
      : modelMs === undefined
      ? format('game.cloudStatus', { model: en[`judgeChoice.${model}`] })
      : format(scanning ? 'judges.cloud.decided' : 'judges.cloud', { ms: modelMs })
  let device: ReactNode = null
  if (run?.kind === 'scanning') device = <Elapsed since={run.started} />
  else if (run?.kind === 'scored') device = format('judges.device.ms', { ms: run.ms })
  else if (run) device = en['judges.device.noAnswer']
  else if (status !== 'off') device = en[`judges.device.${status}`]
  else if (supported) device = <button type="button" className="judges__turn-on" onClick={column.openSetup}>{en['judges.device.off']}</button>
  return (
    <span className="judges">
      {cloud !== null && <span>{cloud}</span>}
      {device !== null && <span>{device}</span>}
    </span>
  )
}

// One score axis per condition; `mark` names each one (a letter, or a level code).
// The cloud judge (referee) is a dot; the on-device judge is a ring, with a scanning
// line until it answers. Its verdict is shown, never scored (3.7).
export function ScoreAxes({ conditions, scores, threshold, model, column, mark = letterFor, title }: {
  conditions: readonly PuzzleCondition[], scores: Record<string, number | undefined>, threshold: number, model: CloudModel
  column?: DeviceColumn | undefined, mark?: (index: number) => string, title?: string
}) {
  const run = column?.run
  const device = run?.kind === 'scored' ? run.scores : {}
  const tally = column?.tally
  return (
    <section className="axes" aria-label={en['game.verdicts']}>
      {title !== undefined && <p className="telemetry">{title}</p>}
      <p className="telemetry axes__head">
        {column ? <JudgesStatus model={model} column={column} /> : <span>{format('game.cloudStatus', { model: en[`judgeChoice.${model}`] })}</span>}
        <span>{en['game.pYes']}</span>
      </p>
      {conditions.map((condition, i) => {
        const p = scores[condition.id]
        const d = device[condition.id]
        return (
          <div key={condition.id} className="axis">
            <span className="axis__letter">{mark(i)}</span>
            <span
              className={run?.kind === 'scanning' ? 'axis__track axis__track--scanning' : 'axis__track'}
              // eslint-disable-next-line react/forbid-dom-props -- the threshold and score positions are runtime values; CSS owns the styling.
              style={{ '--threshold': threshold, '--p': p ?? 0, '--d': d ?? 0 } as CSSProperties}
            >
              <span className="axis__tick" />
              {d !== undefined && <span className={devicePasses(d) ? 'axis__ring' : 'axis__ring axis__ring--fail'} />}
              {p !== undefined && <span className={p >= threshold ? 'axis__dot' : 'axis__dot axis__dot--fail'} />}
            </span>
            <span className="axis__value">
              {p === undefined ? '' : p.toFixed(2)}
              {d !== undefined && <span className="axis__device">{format('judges.deviceScore', { p: d.toFixed(2) })}</span>}
            </span>
          </div>
        )
      })}
      {(run?.kind === 'timeout' || run?.kind === 'error') && run.retry
        ? <p className="telemetry axes__note">{en['judge.device.timeout']} <button type="button" className="link-button" onClick={run.retry}>{en['action.retry']}</button></p>
        : null}
      {column?.cloudMessage !== undefined && <p className="telemetry axes__note">{en[column.cloudMessage]}</p>}
      {column?.notScored !== undefined && <p className="telemetry axes__note">{en[`judges.notScored.${column.notScored}`]}</p>}
      {tally && (
        <p className="telemetry axes__foot">
          <span>{tally.compared > 0 ? format('judges.agreed', tally) : ''}</span>
          <span>{format('judges.threshold', { threshold: threshold.toFixed(2) })}</span>
        </p>
      )}
    </section>
  )
}

// G3: the rejected verdict, with "Try again" and "Count it anyway".
export function RejectedPanel({ sentence, disabled = false, onTryAgain, onCountAnyway }: { sentence: string, disabled?: boolean, onTryAgain: () => void, onCountAnyway: () => void }) {
  return (
    <div className="verdict verdict--rejected">
      <p className="telemetry verdict__label">{en['verdict.label.rejected']}</p>
      <p className="verdict__sentence">{sentence}</p>
      <div className="actions">
        <button type="button" className="pill" onClick={onTryAgain} disabled={disabled}>{en['game.tryAgain']}</button>
        <button type="button" className="pill pill--quiet" onClick={onCountAnyway} disabled={disabled}>{en['game.countAnyway']}</button>
      </div>
    </div>
  )
}

const restTime = (resetAt: string) => new Date(resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

// S1 and S2: while the cloud is resting, a two-cell strip under the header says
// so, and whether the on-device judge is deciding instead.
export function CloudStrip({ column }: { column: DeviceColumn }) {
  if (column.restingUntil === undefined) return null
  const deciding = column.status === 'ready'
  return (
    <div className="cloud-strip telemetry" role="status" aria-label={en['cloud.resting.strip']}>
      <p>{en['cloud.resting.cloud']}<span>{format('cloud.resting.back', { time: restTime(column.restingUntil) })}</span></p>
      <p>
        {en[deciding ? 'cloud.resting.deviceOn' : 'cloud.resting.deviceOff']}
        <span>{en[deciding ? 'cloud.resting.deciding' : 'cloud.resting.notSetUp']}</span>
      </p>
    </div>
  )
}

// G7 and S2: the guess wasn't judged, so it costs nothing. `onAddDevice` offers
// the on-device judge (S3) on a capable device while the cloud rests.
export function NotJudgedPanel({ ui, onRetry, onEdit, onAddDevice }: { ui: Ui, onRetry: () => void, onEdit: () => void, onAddDevice?: (() => void) | undefined }) {
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
        <p className="verdict__sentence">{format('cloud.resting.headline', { time: restTime(ui.resetAt) })}</p>
        <p>{onAddDevice ? `${en['cloud.resting.body']} ${en['cloud.resting.deviceOffer']}` : en['cloud.resting.body']}</p>
        <div className="actions">
          {onAddDevice && <button type="button" className="pill" onClick={onAddDevice}>{en['device.add']}</button>}
          <Link className={onAddDevice ? 'pill pill--quiet control-link' : 'pill control-link'} to="/play">{en['nav.backToLibrary']}</Link>
        </div>
      </div>
    )
  }
  return null
}

// The answer field and its Judge button (G1–G3).
// `judging` locks and greys the field until both judges are back (3.7).
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
