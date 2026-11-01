/// <reference lib="webworker" />
import { Tokenizer } from '@huggingface/tokenizers'
import * as ort from 'onnxruntime-web/webgpu'
import { deviceSupported } from './gate'
import { DownloadError, loadFile, MODEL_CACHE } from './download'
import type { DeviceClaim, FromWorker, ToWorker } from './protocol'
import { deviceFiles, scoreClaim, tensorFactory } from './verdict'

// The on-device judge's Web Worker (3.6): downloads the model, starts a WebGPU
// session and scores one guess at a time, off the main thread.

// The WebGPU runtime is too big for a static asset (25 MiB), so the build ships it
// gzipped (vite.config.ts) and it is unpacked here.
const RUNTIME_PATH = '/ort/runtime.wasm.gz' // emitted by ortRuntime() in vite.config.ts
const PROGRESS_MS = 50

declare const self: DedicatedWorkerGlobalScope
const post = (message: FromWorker) => { self.postMessage(message) }

let session: ort.InferenceSession | undefined
let tokenizer: Tokenizer | undefined
let controller: AbortController | undefined
// Bumped on delete, so a download still in flight never writes the cache again.
let generation = 0
const makeTensor = tensorFactory(ort.Tensor)

async function loadRuntime(signal: AbortSignal): Promise<void> {
  if (ort.env.wasm.wasmBinary) return
  const response = await fetch(RUNTIME_PATH, { signal })
  if (!response.ok || !response.body) throw new DownloadError('network')
  const unpacked = response.body.pipeThrough(new DecompressionStream('gzip'))
  ort.env.wasm.wasmBinary = new Uint8Array(await new Response(unpacked).arrayBuffer())
  ort.env.wasm.numThreads = 1 // no cross-origin isolation, so no threads
}

async function load(keep: boolean): Promise<void> {
  if (session) { post({ type: 'ready', cached: false }); return }
  if (!(await deviceSupported(self.navigator))) { post({ type: 'failed', reason: 'unsupported' }); return }
  controller = new AbortController()
  const { signal } = controller
  const mine = generation
  const total = deviceFiles.reduce((sum, file) => sum + file.bytes, 0)
  let received = 0
  // Network chunks arrive far faster than the page draws them, so progress goes out
  // every 50 ms and once per file.
  let reported = 0
  const report = (force: boolean) => {
    const now = performance.now()
    if (!force && now - reported < PROGRESS_MS) return
    reported = now
    post({ type: 'progress', received, total })
  }
  report(true)
  try {
    await loadRuntime(signal)
    const bytes: Uint8Array[] = []
    let cached = true
    for (const file of deviceFiles) {
      const result = await loadFile(file, {
        keep, signal, stillWanted: () => generation === mine,
        onBytes: (count) => { received += count; report(false) },
      })
      report(true)
      bytes.push(result.bytes)
      cached &&= result.cached
    }
    post({ type: 'warming' })
    const [config, vocabulary, graph, weights] = bytes
    const text = new TextDecoder()
    tokenizer = new Tokenizer(JSON.parse(text.decode(vocabulary)) as object, JSON.parse(text.decode(config)) as object)
    try {
      session = await ort.InferenceSession.create(graph ?? new Uint8Array(), {
        executionProviders: ['webgpu'],
        externalData: [{ path: 'model_q4.onnx_data', data: weights ?? new Uint8Array() }],
      })
    } catch {
      tokenizer = undefined
      post({ type: 'failed', reason: 'start' })
      return
    }
    post({ type: 'ready', cached })
  } catch (error) {
    if (signal.aborted) post({ type: 'cancelled' })
    else post({ type: 'failed', reason: error instanceof DownloadError ? error.reason : 'start' })
  } finally {
    controller = undefined
  }
}

// One guess at a time: each claim is one forward pass.
let queue = Promise.resolve()
function score(id: number, answer: string, claims: DeviceClaim[]): void {
  queue = queue.then(async () => {
    if (!session || !tokenizer) { post({ type: 'scoreFailed', id }); return }
    try {
      const scores: Record<string, number> = {}
      for (const { id: claimId, claim } of claims) scores[claimId] = await scoreClaim(session, makeTensor, tokenizer, answer, claim)
      post({ type: 'scored', id, scores })
    } catch {
      post({ type: 'scoreFailed', id })
    }
  })
}

async function remove(): Promise<void> {
  generation += 1
  controller?.abort()
  await session?.release().catch(() => undefined)
  session = undefined
  tokenizer = undefined
  await caches.delete(MODEL_CACHE).catch(() => false)
  post({ type: 'deleted' })
}

self.onmessage = (event: MessageEvent<ToWorker>) => {
  const message = event.data
  switch (message.type) {
    case 'load': void load(message.keep); return
    case 'cancel': controller?.abort(); return
    case 'score': score(message.id, message.answer, message.claims); return
    case 'delete': void remove(); return
  }
}
