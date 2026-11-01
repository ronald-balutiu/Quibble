import { useRef, useState } from 'react'
import { useDeviceStatus, useDeviceSupported } from '@/judges/device/use-device'
import type { DeviceRun, GuessOutcome } from './judge-guess'

// The judges panel's on-device column for a game screen (5.5 G1–G3, S1, S2): the
// judge's status, the latest guess's run and which judge decided it, whether the
// cloud is resting, this puzzle's "agreed n / m", and the setup sheet that
// "Device • off" opens.
export function useDeviceColumn() {
  const status = useDeviceStatus()
  const supported = useDeviceSupported()
  const [run, setRun] = useState<DeviceRun | undefined>()
  const [modelMs, setModelMs] = useState<number | undefined>()
  const [tally, setTally] = useState({ agreed: 0, compared: 0 })
  const [setupOpen, setSetupOpen] = useState(false)
  const [decidedBy, setDecidedBy] = useState<'cloud' | 'device' | undefined>()
  // The S1 / S2 strip stays until a guess gets the cloud's answer again.
  const [restingUntil, setRestingUntil] = useState<string | undefined>()
  const latest = useRef(0)

  return {
    status, supported, run, modelMs, tally, setupOpen, decidedBy, restingUntil,
    // The capable device's way in when the judge is off: S3.
    canAdd: supported && status === 'off',
    // Starts a guess; the returned callback follows its on-device run. A late result
    // from an earlier guess still counts towards the tally but isn't drawn.
    follow: () => {
      const mine = ++latest.current
      setRun(undefined)
      setModelMs(undefined)
      setDecidedBy(undefined)
      return (next: DeviceRun) => {
        const { agreed, compared } = next.kind === 'scored' ? next : { agreed: undefined, compared: undefined }
        if (agreed !== undefined && compared !== undefined) setTally((t) => ({ agreed: t.agreed + agreed, compared: t.compared + compared }))
        if (latest.current === mine) setRun(next)
      }
    },
    judged: (ms: number) => { setModelMs(ms) },
    settled: (outcome: GuessOutcome) => {
      if ('decidedBy' in outcome) setDecidedBy(outcome.decidedBy)
      if (outcome.restingUntil !== undefined) setRestingUntil(outcome.restingUntil)
      else if ('decidedBy' in outcome && outcome.decidedBy === 'cloud') setRestingUntil(undefined)
    },
    clear: () => {
      latest.current += 1
      setRun(undefined)
      setModelMs(undefined)
      setDecidedBy(undefined)
    },
    openSetup: () => { setSetupOpen(true) },
    closeSetup: () => { setSetupOpen(false) },
  }
}
export type DeviceColumn = ReturnType<typeof useDeviceColumn>
