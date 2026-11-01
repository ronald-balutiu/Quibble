import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { en, format } from '@/copy/en'
import { deviceJudge, type DeviceJudge, type LoadProgress } from '@/judges/device/client'
import type { DeviceFailure } from '@/judges/device/protocol'
import { RingMark } from '../RingMark/RingMark'
import {
  DEVICE_TOTAL_BYTES, fraction, megabytes, ringsDrawn, secondsLeft, tickState, TICKS, type ByteSample,
} from './progress'
import './DeviceSetup.css'

// S3 (add the on-device judge) and S4 (downloading) in one sheet (D-29): it covers
// the game until the judge is ready or the player stops, and nothing in the game
// is lost. `onClose(true)` means the judge is ready for the next guess.

type Step =
  | { kind: 'offer' }
  | { kind: 'download', received: number, total: number, left: number | undefined }
  | { kind: 'warming' }
  | { kind: 'failed', reason: DeviceFailure }

const failure: Record<DeviceFailure, string> = {
  network: format('model.download.failed', { reason: en['model.reason.network'] }),
  storage: format('model.download.failed', { reason: en['model.reason.storage'] }),
  start: en['model.start.failed'],
  unsupported: en['model.unsupported'],
}

function timeLeft(seconds: number | undefined): string {
  if (seconds === undefined) return en['device.install.estimating']
  const pad = (n: number) => String(n).padStart(2, '0')
  return format('device.install.clock', { m: pad(Math.floor(seconds / 60)), s: pad(seconds % 60) })
}

export function DeviceSetup({ onClose, judge = deviceJudge }: { onClose: (on: boolean) => void, judge?: DeviceJudge }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<Step>({ kind: 'offer' })
  const loading = useRef(false)
  const cancelled = useRef(false)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    dialog.current?.showModal()
    return () => {
      live.current = false
      // Leaving the page mid-download stops it.
      if (loading.current) judge.cancel()
    }
  }, [judge])

  async function download() {
    loading.current = true
    cancelled.current = false
    setStep({ kind: 'download', received: 0, total: DEVICE_TOTAL_BYTES, left: undefined })
    // The view catches up with the worker's reports once per frame.
    let first: ByteSample | undefined
    let latest: LoadProgress | undefined
    let frame = 0
    const show = () => {
      frame = 0
      if (!live.current || latest?.kind !== 'download') return
      const sample = { at: performance.now(), received: latest.received }
      first ??= sample
      setStep({ kind: 'download', received: latest.received, total: latest.total, left: secondsLeft(first, sample, latest.total) })
    }
    const result = await judge.load((progress) => {
      latest = progress
      if (progress.kind === 'warming') { cancelAnimationFrame(frame); setStep({ kind: 'warming' }); return }
      frame ||= requestAnimationFrame(show)
    })
    cancelAnimationFrame(frame)
    loading.current = false
    // Cancel while the session starts can't stop it, so a late "ready" is undone.
    const ready = result.kind === 'ready' && !cancelled.current
    if (result.kind === 'ready' && cancelled.current) void judge.remove()
    if (!live.current) return
    if (ready) onClose(true)
    else if (result.kind === 'failed') setStep({ kind: 'failed', reason: result.reason })
    else onClose(false)
  }

  function cancel() {
    if (!loading.current) { onClose(false); return }
    cancelled.current = true
    judge.cancel()
  }

  const installing = step.kind !== 'offer'
  return (
    <dialog
      ref={dialog} className={installing ? 'sheet device-sheet device-sheet--install' : 'sheet device-sheet'}
      aria-labelledby="device-sheet-title"
      // Escape is the same as Cancel or Not now; the sheet closes once the download has stopped.
      onCancel={(event) => { event.preventDefault(); cancel() }}
    >
      {step.kind === 'offer'
        ? <Offer onDownload={() => { void download() }} onClose={cancel} />
        : <Install step={step} onCancel={cancel} onRetry={() => { void download() }} onClose={() => { onClose(false) }} />}
    </dialog>
  )
}

function Offer({ onDownload, onClose }: { onDownload: () => void, onClose: () => void }) {
  const facts = [
    [en['device.fact.size'], format('device.megabytes', { mb: megabytes(DEVICE_TOTAL_BYTES) })],
    [en['device.fact.model'], en['device.model']],
    [en['device.fact.bestOn'], en['device.bestOn']],
  ] as const
  return (
    <>
      <header className="device-sheet__header telemetry">
        <span>{en['device.setup.eyebrow']}</span>
        <button type="button" className="device-sheet__close" aria-label={en['sheet.close']} onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeWidth="1.6" /></svg>
        </button>
      </header>
      <div className="device-sheet__intro">
        <h2 id="device-sheet-title" className="device-sheet__title">{en['device.setup.title']}</h2>
        <p>{en['device.setup.body']}</p>
      </div>
      <dl className="device-facts">
        {facts.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <p className="device-sheet__note">{en['device.visitOnly']}</p>
      <div className="device-sheet__actions">
        <button type="button" className="pill pill--wide" onClick={onDownload}>{en['device.download']}</button>
        <button type="button" className="pill pill--quiet" onClick={onClose}>{en['device.notNow']}</button>
      </div>
      <p className="device-sheet__source">{en['device.source']}</p>
    </>
  )
}

function Install({ step, onCancel, onRetry, onClose }: { step: Exclude<Step, { kind: 'offer' }>, onCancel: () => void, onRetry: () => void, onClose: () => void }) {
  const progress = step.kind === 'download' ? fraction(step.received, step.total) : step.kind === 'warming' ? 1 : 0
  const percent = Math.floor(progress * 100)
  const failed = step.kind === 'failed'
  const retry = failed && (step.reason === 'network' || step.reason === 'storage')
  const phase = failed ? en['device.install.stopped'] : step.kind === 'warming' ? en['device.install.starting'] : en['device.install.downloading']
  const status = failed ? failure[step.reason] : step.kind === 'warming' ? en['device.install.warming'] : en['device.install.receiving']
  const rows = [
    [en['device.install.model'], en['device.model']],
    [en['device.install.backend'], en['device.install.backendValue']],
    [en['device.install.received'], format('device.install.receivedValue', {
      received: megabytes(step.kind === 'download' ? step.received : progress * DEVICE_TOTAL_BYTES),
      total: megabytes(step.kind === 'download' ? step.total : DEVICE_TOTAL_BYTES),
    })],
    [en['device.install.timeLeft'], timeLeft(step.kind === 'download' ? step.left : step.kind === 'warming' ? 0 : undefined)],
  ] as const
  return (
    <>
      <header className="device-sheet__header device-sheet__header--install telemetry">
        <h2 id="device-sheet-title" className="device-sheet__name">{en['device.install.title']}</h2>
        <span>{phase}</span>
      </header>
      <div className="device-install">
        <RingMark progress={progress} label={en['device.install.mark']} />
        <p className="device-install__rings telemetry">{format('device.install.rings', { n: ringsDrawn(progress) })}</p>
        <p className="device-install__percent" aria-hidden="true">
          {String(percent).padStart(2, '0')}<span>{en['device.install.percent']}</span>
        </p>
      </div>
      <dl className="device-readout">
        {rows.map(([label, value]) => (
          <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
      <div className="device-ticks">
        <div
          className="device-ticks__bar" role="progressbar" aria-label={en['device.install.title']}
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          // eslint-disable-next-line react/forbid-dom-props -- the bar follows the real byte count (D-25, D-50).
          style={{ '--progress': progress } as CSSProperties}
        />
        <div className="device-ticks__labels" aria-hidden="true">
          {TICKS.map((tick) => <span key={tick} className={`device-ticks__tick device-ticks__tick--${tickState(tick, percent)}`}>{format('device.install.tick', { n: tick })}</span>)}
        </div>
      </div>
      <div className="device-sheet__footer">
        <span role="status" className={failed ? 'telemetry device-sheet__status--failed' : 'telemetry'}>{status}</span>
        <span className="device-sheet__controls">
          {retry && <button type="button" className="device-sheet__link" onClick={onRetry}>{en['action.retry']}</button>}
          {failed
            ? <button type="button" className="device-sheet__link" onClick={onClose}>{retry ? en['action.cancel'] : en['action.ok']}</button>
            : <button type="button" className="device-sheet__link" onClick={onCancel}>{en['action.cancel']}</button>}
        </span>
      </div>
    </>
  )
}
