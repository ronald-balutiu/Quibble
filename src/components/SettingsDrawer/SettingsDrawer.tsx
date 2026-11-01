import { useEffect, useRef, useState } from 'react'
import { en, format } from '@/copy/en'
import { deviceJudge } from '@/judges/device/client'
import { useDeviceStatus, useDeviceSupported } from '@/judges/device/use-device'
import { loadReferee, saveReferee } from '@/lib/storage/settings'
import { DeviceSetup } from '../DeviceSetup/DeviceSetup'
import { DEVICE_TOTAL_BYTES, megabytes } from '../DeviceSetup/progress'
import './SettingsDrawer.css'

// L3, opened from the site header on Home and Library (5.5): the referee and the
// on-device judge. The "Your data" group comes with Phase 6.

export function SettingsButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="settings-open telemetry" onClick={() => { setOpen(true) }}>{en['settings.open']}</button>
      {open && <SettingsDrawer onClose={() => { setOpen(false) }} />}
    </>
  )
}

function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const status = useDeviceStatus()
  const supported = useDeviceSupported()
  const [referee, setReferee] = useState(loadReferee)
  const [setup, setSetup] = useState(false)
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
      </div>
      <footer className="drawer__footer telemetry">{en['settings.footer']}</footer>
      {setup && <DeviceSetup onClose={() => { setSetup(false) }} />}
    </dialog>
  )
}
