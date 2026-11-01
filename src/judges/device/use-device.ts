import { useEffect, useState, useSyncExternalStore } from 'react'
import { deviceJudge, type DeviceJudge, type DeviceStatus } from './client'
import { deviceSupported } from './gate'

// React's view of the tab's on-device judge: off, loading or ready.
export function useDeviceStatus(judge: DeviceJudge = deviceJudge): DeviceStatus {
  return useSyncExternalStore(judge.subscribe, () => judge.status)
}

// Whether this device is offered the judge at all (D-07, D-56). Checked once per tab.
let support: Promise<boolean> | undefined
export function useDeviceSupported(): boolean {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    let live = true
    void (support ??= deviceSupported()).then((value) => { if (live) setSupported(value) })
    return () => { live = false }
  }, [])
  return supported
}
