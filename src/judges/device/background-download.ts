import { deviceJudge, type DeviceJudge, type LoadProgress } from './client'
import type { DeviceFailure } from './protocol'

type DownloadState =
  | { kind: 'idle' }
  | LoadProgress
  | { kind: 'cancelling' }
  | { kind: 'failed', reason: DeviceFailure }

// A Library download belongs to the visit, so route changes do not cancel it.
// The existing in-game setup sheet still owns and cancels its own load.
export function createBackgroundDownload(judge: DeviceJudge) {
  let state: DownloadState = { kind: 'idle' }
  let active = false
  let cancelled = false
  const listeners = new Set<() => void>()
  const set = (next: DownloadState) => {
    state = next
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async start() {
      if (active || judge.status !== 'off') return
      active = true
      cancelled = false
      set({ kind: 'download', received: 0, total: 0 })
      try {
        const result = await judge.load((progress) => { if (!cancelled) set(progress) })
        // GPU session startup can finish after Cancel. Free that late model too.
        if (cancelled && result.kind === 'ready') await judge.remove()
        set(result.kind === 'failed' && !cancelled ? { kind: 'failed', reason: result.reason } : { kind: 'idle' })
      } catch {
        set(cancelled ? { kind: 'idle' } : { kind: 'failed', reason: 'start' })
      } finally {
        active = false
      }
    },
    cancel() {
      if (!active) return
      cancelled = true
      set({ kind: 'cancelling' })
      judge.cancel()
    },
  }
}

export const backgroundDownload = createBackgroundDownload(deviceJudge)
