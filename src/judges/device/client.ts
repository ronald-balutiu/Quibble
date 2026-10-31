import { MODEL_CACHE } from './download'
import type { DeviceClaim, DeviceFailure, FromWorker, ToWorker } from './protocol'

// The game's handle on the on-device judge (3.6, 3.7). The model lives in one Web
// Worker per tab; this side starts it lazily, follows a load, and gives each guess
// its 10-second limit. A result that arrives after its limit is ignored.

export const DEVICE_TIMEOUT_MS = 10_000

export type LoadProgress = { kind: 'download', received: number, total: number } | { kind: 'warming' }
export type LoadResult = { kind: 'ready', cached: boolean } | { kind: 'failed', reason: DeviceFailure } | { kind: 'cancelled' }
export type ScoreResult = { kind: 'scored', scores: Record<string, number>, ms: number } | { kind: 'timeout' } | { kind: 'error' }

interface WorkerLike {
  postMessage: (message: ToWorker) => void
  terminate: () => void
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null
  onerror: ((event: Event) => void) | null
}

export interface DeviceJudge {
  readonly ready: boolean
  load: (keep: boolean, onProgress: (progress: LoadProgress) => void) => Promise<LoadResult>
  cancel: () => void
  score: (answer: string, claims: DeviceClaim[], timeoutMs?: number) => Promise<ScoreResult>
  remove: () => Promise<void>
}

export function createDeviceJudge(spawn: () => WorkerLike, now = () => performance.now()): DeviceJudge {
  let worker: WorkerLike | undefined
  let ready = false
  let loading: { resolve: (result: LoadResult) => void, onProgress: (progress: LoadProgress) => void } | undefined
  let removing: (() => void) | undefined
  const scoring = new Map<number, (result: ScoreResult) => void>()
  let nextId = 0

  function settleLoad(result: LoadResult) {
    ready = result.kind === 'ready'
    loading?.resolve(result)
    loading = undefined
  }

  // A crashed worker (out of memory, GPU loss) ends every pending call with a clear result.
  function crash() {
    worker?.terminate()
    worker = undefined
    ready = false
    settleLoad({ kind: 'failed', reason: 'start' })
    for (const resolve of scoring.values()) resolve({ kind: 'error' })
    scoring.clear()
    removing?.()
  }

  function receive({ data: message }: MessageEvent<FromWorker>) {
    switch (message.type) {
      case 'progress': loading?.onProgress({ kind: 'download', received: message.received, total: message.total }); return
      case 'warming': loading?.onProgress({ kind: 'warming' }); return
      case 'ready': settleLoad({ kind: 'ready', cached: message.cached }); return
      case 'failed': settleLoad({ kind: 'failed', reason: message.reason }); return
      case 'cancelled': settleLoad({ kind: 'cancelled' }); return
      case 'scored': case 'scoreFailed': {
        const resolve = scoring.get(message.id)
        scoring.delete(message.id)
        resolve?.(message.type === 'scored' ? { kind: 'scored', scores: message.scores, ms: 0 } : { kind: 'error' })
        return
      }
      case 'deleted': removing?.(); return
    }
  }

  function connect(): WorkerLike {
    if (worker) return worker
    worker = spawn()
    worker.onmessage = receive
    worker.onerror = crash
    return worker
  }

  return {
    get ready() { return ready },

    load(keep, onProgress) {
      if (ready) return Promise.resolve({ kind: 'ready', cached: false })
      loading?.resolve({ kind: 'cancelled' })
      return new Promise((resolve) => {
        loading = { resolve, onProgress }
        connect().postMessage({ type: 'load', keep })
      })
    },

    cancel() {
      worker?.postMessage({ type: 'cancel' })
    },

    score(answer, claims, timeoutMs = DEVICE_TIMEOUT_MS) {
      if (!ready || !worker) return Promise.resolve({ kind: 'error' })
      const id = ++nextId
      const started = now()
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          scoring.delete(id)
          resolve({ kind: 'timeout' })
        }, timeoutMs)
        scoring.set(id, (result) => {
          clearTimeout(timer)
          resolve(result.kind === 'scored' ? { ...result, ms: Math.round(now() - started) } : result)
        })
        worker?.postMessage({ type: 'score', id, answer, claims })
      })
    },

    // Turning the judge off or "Delete model": also clears a model kept on an earlier visit.
    remove() {
      ready = false
      if (!worker) return globalThis.caches?.delete(MODEL_CACHE).then(() => undefined, () => undefined) ?? Promise.resolve()
      return new Promise((resolve) => {
        removing = () => { removing = undefined; resolve() }
        worker?.postMessage({ type: 'delete' })
      })
    },
  }
}

// The tab's one on-device judge.
export const deviceJudge = createDeviceJudge(() => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as WorkerLike)
