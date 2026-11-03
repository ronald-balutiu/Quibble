import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { en, format } from '@/copy/en'
import type { Ui } from './judge-guess'
import { restTime } from './verdict'

// The verdict panels under the answer field (5.5 G3, G7, S2).

// G3: the rejected verdict, with "Try again" and "Count it anyway".
// On the last allowed miss, `endLabel` replaces "Try again": there is no try left,
// and that button, which takes focus, ends the round or run.
export function RejectedPanel({ sentence, disabled = false, endLabel, onTryAgain, onCountAnyway }: {
  sentence: string, disabled?: boolean, endLabel?: string | undefined, onTryAgain: () => void, onCountAnyway: () => void
}) {
  const primary = useRef<HTMLButtonElement>(null)
  const ending = endLabel !== undefined
  useEffect(() => { if (ending && !disabled) primary.current?.focus() }, [ending, disabled])
  return (
    <div className="verdict verdict--rejected">
      <p className="telemetry verdict__label">{en['verdict.label.rejected']}</p>
      <p className="verdict__sentence">{sentence}</p>
      <div className="actions">
        <button ref={primary} type="button" className="pill" onClick={onTryAgain} disabled={disabled}>{endLabel ?? en['game.tryAgain']}</button>
        <button type="button" className="pill pill--quiet" onClick={onCountAnyway} disabled={disabled}>{en['game.countAnyway']}</button>
      </div>
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
