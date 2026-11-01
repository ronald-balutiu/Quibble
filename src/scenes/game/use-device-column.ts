import { useRef, useState } from 'react'
import { useDeviceStatus, useDeviceSupported } from '@/judges/device/use-device'
import type { DeviceRun } from './judge-guess'

// The judges panel's on-device column for a game screen (5.5 G1–G3): the judge's
// status, the latest guess's run, this puzzle's "agreed n / m", and the setup sheet
// that "Device • off" opens.
export function useDeviceColumn() {
  const status = useDeviceStatus()
  const supported = useDeviceSupported()
  const [run, setRun] = useState<DeviceRun | undefined>()
  const [modelMs, setModelMs] = useState<number | undefined>()
  const [tally, setTally] = useState({ agreed: 0, compared: 0 })
  const [setupOpen, setSetupOpen] = useState(false)
  const latest = useRef(0)

  return {
    status, supported, run, modelMs, tally, setupOpen,
    // Starts a guess; the returned callback follows its on-device run. A late result
    // from an earlier guess still counts towards the tally but isn't drawn.
    follow: () => {
      const mine = ++latest.current
      setRun(undefined)
      setModelMs(undefined)
      return (next: DeviceRun) => {
        const { agreed, compared } = next.kind === 'scored' ? next : { agreed: undefined, compared: undefined }
        if (agreed !== undefined && compared !== undefined) setTally((t) => ({ agreed: t.agreed + agreed, compared: t.compared + compared }))
        if (latest.current === mine) setRun(next)
      }
    },
    judged: (ms: number) => { setModelMs(ms) },
    clear: () => {
      latest.current += 1
      setRun(undefined)
      setModelMs(undefined)
    },
    openSetup: () => { setSetupOpen(true) },
    closeSetup: () => { setSetupOpen(false) },
  }
}
export type DeviceColumn = ReturnType<typeof useDeviceColumn>
