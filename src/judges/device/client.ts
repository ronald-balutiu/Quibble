import type { DeviceClaim, DeviceFailure, FromWorker, ToWorker } from './protocol'

// The game's handle on the on-device judge (3.6, 3.7). The model lives in one Web
// Worker per tab; this side starts it lazily, follows a load, and gives each guess
// its 10-second limit. A result that arrives after its limit is ignored.

const DEVICE_TIMEOUT_MS = 10_000

export type LoadProgress = { kind: 'download'; received: number; total: number } | { kind: 'warming' }
export type LoadResult = { kind: 'ready' } | { kind: 'failed'; reason: DeviceFailure } | { kind: 'cancelled' }
// `warm` is false for the first guess after a load, which includes WebGPU's start-up work.
export type ScoreResult =
  | { kind: 'scored'; scores: Record<string, number>; ms: number; warm: boolean }
  | { kind: 'timeout' }
  | { kind: 'error' }
export type DeviceStatus = 'off' | 'loading' | 'ready'

interface WorkerLike {
  postMessage: (message: ToWorker) => void
  terminate: () => void
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null
  onerror: ((event: Event) => void) | null
}

export interface DeviceJudge {
  readonly ready: boolean
  readonly status: DeviceStatus
  // Called whenever the status changes, for React's useSyncExternalStore.
  subscribe: (listener: () => void) => () => void
  load: (onProgress: (progress: LoadProgress) => void) => Promise<LoadResult>
  cancel: () => void
  score: (answer: string, claims: DeviceClaim[], timeoutMs?: number) => Promise<ScoreResult>
  remove: () => Promise<void>
}

export function createDeviceJudge(spawn: () => WorkerLike, now = () => performance.now()): DeviceJudge {
  let worker: WorkerLike | undefined
  let ready = false
  let loading:
    | {
        promise: Promise<LoadResult>
        resolve: (result: LoadResult) => void
        listeners: Set<(progress: LoadProgress) => void>
      }
    | undefined
  let removing: { promise: Promise<void>; finish: () => void } | undefined
  const scoring = new Map<number, (result: ScoreResult) => void>()
  let nextId = 0
  let warm = false
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }

  function settleLoad(result: LoadResult) {
    ready = result.kind === 'ready'
    warm = false
    loading?.resolve(result)
    loading = undefined
    notify()
  }

  // A crashed worker (out of memory, GPU loss) ends every pending call with a clear result.
  function crash() {
    worker?.terminate()
    worker = undefined
    settleLoad({ kind: 'failed', reason: 'start' })
    for (const resolve of scoring.values()) resolve({ kind: 'error' })
    scoring.clear()
    removing?.finish()
  }

  function receive({ data: message }: MessageEvent<FromWorker>) {
    if (message.type === 'deleted') {
      removing?.finish()
      return
    }
    if (removing) return
    switch (message.type) {
      case 'progress':
        loading?.listeners.forEach((follow) => {
          follow({ kind: 'download', received: message.received, total: message.total })
        })
        return
      case 'warming':
        loading?.listeners.forEach((follow) => {
          follow({ kind: 'warming' })
        })
        return
      case 'ready':
        settleLoad({ kind: 'ready' })
        return
      case 'failed':
        settleLoad({ kind: 'failed', reason: message.reason })
        return
      case 'cancelled':
        settleLoad({ kind: 'cancelled' })
        return
      case 'scored':
      case 'scoreFailed': {
        const resolve = scoring.get(message.id)
        scoring.delete(message.id)
        resolve?.(
          message.type === 'scored' ? { kind: 'scored', scores: message.scores, ms: 0, warm } : { kind: 'error' },
        )
        if (resolve && message.type === 'scored') warm = true
        return
      }
    }
  }

  function connect(): WorkerLike {
    if (worker) return worker
    const connected = spawn()
    worker = connected
    connected.onmessage = (event) => {
      if (worker === connected) receive(event)
    }
    connected.onerror = () => {
      if (worker === connected) crash()
    }
    return connected
  }

  const judge: DeviceJudge = {
    get ready() {
      return ready
    },
    get status() {
      return ready ? 'ready' : loading ? 'loading' : 'off'
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    load(onProgress) {
      if (removing) return removing.promise.then(() => judge.load(onProgress))
      if (ready) return Promise.resolve({ kind: 'ready' })
      if (loading) {
        loading.listeners.add(onProgress)
        return loading.promise
      }
      let resolve!: (result: LoadResult) => void
      const promise = new Promise<LoadResult>((done) => {
        resolve = done
      })
      loading = { promise, resolve, listeners: new Set([onProgress]) }
      try {
        connect().postMessage({ type: 'load' })
      } catch {
        crash()
      }
      notify()
      return promise
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
        try {
          worker?.postMessage({ type: 'score', id, answer, claims })
        } catch {
          crash()
        }
      })
    },

    // Turning the judge off: stops any download and frees the model's memory.
    remove() {
      if (removing) return removing.promise
      if (!worker) return Promise.resolve()
      let resolve!: () => void
      const promise = new Promise<void>((done) => {
        resolve = done
      })
      const finish = () => {
        clearTimeout(timer)
        worker?.terminate()
        worker = undefined
        removing = undefined
        resolve()
      }
      const timer = setTimeout(finish, DEVICE_TIMEOUT_MS)
      removing = { promise, finish }
      settleLoad({ kind: 'cancelled' })
      for (const resolve of scoring.values()) resolve({ kind: 'error' })
      scoring.clear()
      try {
        worker.postMessage({ type: 'delete' })
      } catch {
        finish()
      }
      return promise
    },
  }
  return judge
}

// The tab's one on-device judge.
export const deviceJudge = createDeviceJudge(
  () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }) as WorkerLike,
)
