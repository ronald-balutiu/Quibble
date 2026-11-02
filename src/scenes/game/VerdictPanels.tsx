import { Link } from 'react-router'
import { en, format } from '@/copy/en'
import type { Ui } from './judge-guess'
import { restTime } from './verdict'

// The verdict panels under the answer field (5.5 G3, G7, S2).

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
