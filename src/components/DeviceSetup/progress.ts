import { deviceFiles } from '@/judges/device/verdict'

// The S4 readout (5.3): every number comes from the byte count the worker
// reports, never a timer.

export const DEVICE_TOTAL_BYTES = deviceFiles.reduce((sum, file) => sum + file.bytes, 0)
export const megabytes = (bytes: number) => Math.round(bytes / 1_000_000)

export interface ByteSample { at: number, received: number }

export const fraction = (received: number, total: number) => total > 0 ? Math.min(1, Math.max(0, received / total)) : 0

// One ring per third of the download.
export const ringsDrawn = (progress: number) => Math.min(3, Math.floor(progress * 3))

// The 0% → 100% strip: ticks passed, the one being filled, and the rest.
export type TickState = 'done' | 'current' | 'todo'
export const TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const
export function tickState(tick: number, percent: number): TickState {
  if (percent >= tick && (percent < tick + 10 || tick === 100)) return 'current'
  return percent >= tick ? 'done' : 'todo'
}

// Seconds left at the rate measured since the first sample. Unknown until a
// second has passed with bytes arriving.
export function secondsLeft(first: ByteSample, latest: ByteSample, total: number): number | undefined {
  const elapsed = latest.at - first.at
  const bytes = latest.received - first.received
  if (elapsed < 1000 || bytes <= 0) return undefined
  return Math.max(0, Math.ceil((total - latest.received) / (bytes / elapsed) / 1000))
}
