import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { CloudModel } from '@shared/schemas/judge'
import type { PuzzleCondition } from '@shared/schemas/puzzle'
import { en, format } from '@/copy/en'
import type { DeviceColumn } from './use-device-column'
import { devicePasses, letterFor, restTime } from './verdict'

// The judges panel (5.5 G1–G3, S1): each judge's status, one score axis per
// condition, and the strip shown while the cloud rests.

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
