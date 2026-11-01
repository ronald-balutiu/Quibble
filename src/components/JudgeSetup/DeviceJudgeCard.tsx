import { useSyncExternalStore } from 'react'
import { en, format } from '@/copy/en'
import { backgroundDownload } from '@/judges/device/background-download'
import { deviceJudge } from '@/judges/device/client'
import { useDeviceStatus, useDeviceSupported } from '@/judges/device/use-device'
import { DEVICE_TOTAL_BYTES, fraction, megabytes } from '../DeviceSetup/progress'
import './JudgeSetup.css'

export function DeviceJudgeCard() {
  const supported = useDeviceSupported()
  const status = useDeviceStatus()
  const download = useSyncExternalStore(backgroundDownload.subscribe, backgroundDownload.getSnapshot)
  const loading = status === 'loading' || download.kind === 'download' || download.kind === 'warming' || download.kind === 'cancelling'
  const progress = download.kind === 'download' ? fraction(download.received, download.total || DEVICE_TOTAL_BYTES) : download.kind === 'warming' ? 1 : 0
  const percent = Math.floor(progress * 100)

  return (
    <section className="local-model" aria-labelledby="local-model-title">
      <h3 id="local-model-title">{en['welcome.device.title']}</h3>
      {!supported
        ? <p>{en['model.unsupported']}</p>
        : status === 'ready'
          ? <>
              <p role="status">{en['welcome.device.ready']}</p>
              <p>{en['welcome.device.referee']}</p>
              <button type="button" className="setup-link" onClick={() => { void deviceJudge.remove() }}>{en['settings.device.turnOff']}</button>
            </>
          : loading
            ? <>
                <p role="status">{en[download.kind === 'warming' ? 'device.install.warming' : download.kind === 'cancelling' ? 'welcome.device.cancelling' : 'device.install.downloading']}</p>
                <progress className="local-model__progress" value={progress} max={1} aria-label={en['device.install.title']} />
                <p className="telemetry">{format('welcome.device.progress', { percent })}</p>
                <button type="button" className="pill pill--quiet" disabled={download.kind === 'cancelling'} onClick={() => { backgroundDownload.cancel() }}>{en['welcome.device.cancel']}</button>
                <p className="judge-setup__note">{en['welcome.device.background']}</p>
              </>
            : <>
                <p role={download.kind === 'failed' ? 'alert' : undefined}>{en[download.kind === 'failed' ? 'welcome.device.failed' : 'welcome.device.body']}</p>
                <button type="button" className="pill pill--quiet" onClick={() => { void backgroundDownload.start() }}>
                  {download.kind === 'failed' ? en['action.retry'] : format('welcome.device.download', { mb: megabytes(DEVICE_TOTAL_BYTES) })}
                </button>
                <p className="judge-setup__note">{en['welcome.device.visit']}</p>
              </>}
    </section>
  )
}
