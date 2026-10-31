// Messages between the game and the on-device judge's Web Worker (3.6).

export interface DeviceClaim { id: string, claim: string }

// Why the judge couldn't start: shown as model.unsupported, model.download.failed
// ("network error" / "not enough storage") or model.start.failed (5.7).
export type DeviceFailure = 'unsupported' | 'network' | 'storage' | 'start'

export type ToWorker =
  | { type: 'load', keep: boolean }
  | { type: 'cancel' }
  | { type: 'score', id: number, answer: string, claims: DeviceClaim[] }
  | { type: 'delete' }

export type FromWorker =
  | { type: 'progress', received: number, total: number }
  | { type: 'warming' }
  | { type: 'ready', cached: boolean }
  | { type: 'failed', reason: DeviceFailure }
  | { type: 'cancelled' }
  | { type: 'scored', id: number, scores: Record<string, number> }
  | { type: 'scoreFailed', id: number }
  | { type: 'deleted' }
