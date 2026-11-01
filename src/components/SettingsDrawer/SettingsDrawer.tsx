import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { en, format } from '@/copy/en'
import { deviceJudge } from '@/judges/device/client'
import { useDeviceStatus, useDeviceSupported } from '@/judges/device/use-device'
import { clearComparisons, loadComparisons } from '@/lib/storage/comparisons'
import { deleteEverything } from '@/lib/storage/everything'
import { clearGameData, progressSummary } from '@/lib/storage/progress'
import { loadReferee, saveReferee } from '@/lib/storage/settings'
import { DeviceSetup } from '../DeviceSetup/DeviceSetup'
import { CloudModelChoice } from '../JudgeSetup/CloudModelChoice'
import { DEVICE_TOTAL_BYTES, megabytes } from '../DeviceSetup/progress'
import './SettingsDrawer.css'

// L3, opened from the shared site header: the referee, the
// on-device judge, and the player's data in this browser (1.8).

export function SettingsButton({ onProgressCleared }: { onProgressCleared: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="settings-open" aria-haspopup="dialog" onClick={() => { setOpen(true) }}>{en['settings.open']}</button>
      {open && <SettingsDrawer onClose={() => { setOpen(false) }} onProgressCleared={onProgressCleared} />}
    </>
  )
}

// Every clear and delete asks once more in place: "Press again to delete" for 5 s,
// then "Deleted" (5.7 confirm.again).
function ConfirmButton({ label, danger = false, onConfirm }: { label: string, danger?: boolean, onConfirm: () => void }) {
  const [state, setState] = useState<'idle' | 'confirming' | 'done'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => { clearTimeout(timer.current) }, [])
  function press() {
    if (state === 'idle') {
      setState('confirming')
      timer.current = setTimeout(() => { setState('idle') }, 5000)
      return
    }
    clearTimeout(timer.current)
    onConfirm()
    setState('done')
  }
  return (
    <button type="button" className={danger ? 'pill pill--quiet pill--danger' : 'pill pill--quiet'} disabled={state === 'done'} onClick={press}>
      {state === 'idle' ? label : en[state === 'confirming' ? 'confirm.again' : 'confirm.done']}
    </button>
  )
}

function SettingsDrawer({ onClose, onProgressCleared }: { onClose: () => void, onProgressCleared: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const status = useDeviceStatus()
  const supported = useDeviceSupported()
  const [referee, setReferee] = useState(loadReferee)
  const [setup, setSetup] = useState(false)
  const [progress, setProgress] = useState(progressSummary)
  const [history, setHistory] = useState(() => loadComparisons().length)
  useEffect(() => { dialog.current?.showModal() }, [])

  // The on-device option only applies while that judge is on (5.5 L3).
  const deviceOn = status === 'ready'
  const effective = deviceOn ? referee : 'cloud'
  const choose = (next: 'cloud' | 'device') => { saveReferee(next); setReferee(next) }
  const details = { model: en['device.model'], mb: megabytes(DEVICE_TOTAL_BYTES) }

  return (
    <dialog ref={dialog} className="drawer" aria-labelledby="drawer-title" onClose={onClose}>
      <header className="drawer__header telemetry">
        <h2 id="drawer-title" className="drawer__title">{en['settings.title']}</h2>
        <button type="button" className="drawer__close" aria-label={en['sheet.close']} onClick={() => { dialog.current?.close() }}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" strokeWidth="1.6" /></svg>
        </button>
      </header>
      <div className="drawer__body">
        <div className="drawer__group"><CloudModelChoice /></div>
        <fieldset className="drawer__group">
          <legend className="telemetry">{en['settings.referee']}</legend>
          <div className="drawer__choices">
            {(['cloud', 'device'] as const).map((option) => (
              <label key={option} className="drawer__choice">
                <input
                  type="radio" name="referee" value={option} checked={effective === option}
                  disabled={option === 'device' && !deviceOn} onChange={() => { choose(option) }}
                />
                <span>{en[`settings.referee.${option}`]}</span>
              </label>
            ))}
          </div>
          <p>{en['settings.referee.note']}</p>
        </fieldset>
        <section className="drawer__group" aria-labelledby="drawer-device">
          <h3 id="drawer-device" className="telemetry">{en['settings.device']}</h3>
          {supported
            ? (
                <div className="drawer__row">
                  <span>
                    <span className="drawer__name">{en[`settings.device.${status}`]}</span>
                    <span>{format(deviceOn ? 'settings.device.onDetails' : 'settings.device.offDetails', details)}</span>
                  </span>
                  {status === 'off' && <button type="button" className="pill pill--quiet" onClick={() => { setSetup(true) }}>{en['settings.device.turnOn']}</button>}
                  {deviceOn && <button type="button" className="pill pill--quiet" onClick={() => { void deviceJudge.remove() }}>{en['settings.device.turnOff']}</button>}
                </div>
              )
            : <p>{en['model.unsupported']}</p>}
        </section>
        <section className="drawer__group" aria-labelledby="drawer-data">
          <h3 id="drawer-data" className="telemetry">{en['settings.data']}</h3>
          <div className="drawer__row">
            <span>
              <span className="drawer__name">{en['settings.data.progress']}</span>
              <span>{format('settings.data.progressDetails', { ...progress, runs: en[progress.open === 1 ? 'settings.data.run' : 'settings.data.runs'] })}</span>
            </span>
            <ConfirmButton label={en['settings.data.clearProgress']} onConfirm={() => { clearGameData(); setProgress(progressSummary()); onProgressCleared() }} />
          </div>
          <div className="drawer__row">
            <span>
              <span className="drawer__name">{en['settings.data.history']}</span>
              <span>{format('settings.data.historyDetails', { n: history.toLocaleString() })}</span>
            </span>
            <ConfirmButton label={en['settings.data.clearHistory']} onConfirm={() => { clearComparisons(); setHistory(0) }} />
          </div>
          <div className="drawer__row drawer__row--danger">
            <span>
              <span className="drawer__name">{en['settings.data.everything']}</span>
              <span>{en['settings.data.everythingDetails']}</span>
            </span>
            <ConfirmButton
              label={en['settings.data.deleteEverything']} danger
              onConfirm={() => {
                deleteEverything()
                void deviceJudge.remove()
                setReferee('cloud')
                setProgress(progressSummary())
                setHistory(0)
                onProgressCleared()
              }}
            />
          </div>
          <p>{en['settings.data.note']}</p>
        </section>
      </div>
      <footer className="drawer__footer telemetry">
        <span>{en['settings.footer']}</span>
        <Link className="control-link" to="/about#privacy">{en['nav.privacy']}</Link>
      </footer>
      {setup && <DeviceSetup onClose={() => { setSetup(false) }} />}
    </dialog>
  )
}
