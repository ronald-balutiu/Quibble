import { beforeEach, describe, expect, test, vi } from 'vitest'
import { createDeviceJudge } from '@/judges/device/client'
import { DownloadError, loadFile, MODEL_CACHE, readInto } from '@/judges/device/download'
import { deviceSupported } from '@/judges/device/gate'
import type { FromWorker, ToWorker } from '@/judges/device/protocol'
import { deviceFileUrl } from '@/judges/device/verdict'
import { cleanUpStaleModel, keptSince, markKeptModelUsed, STALE_AFTER_MS } from '@/lib/storage/device'

const file = { path: 'tokenizer_config.json', bytes: 6 } as never
const body = (...chunks: number[][]) => new Response(new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk))
    controller.close()
  },
}))

// A Cache API with one cache, enough for the model store.
class MemoryCaches {
  entries = new Map<string, Uint8Array>()
  deleted: string[] = []
  open() {
    return Promise.resolve({
      match: (url: string) => Promise.resolve(this.entries.has(url) ? new Response(this.entries.get(url) as BodyInit) : undefined),
      put: async (url: string, response: Response) => { this.entries.set(url, new Uint8Array(await response.arrayBuffer())) },
    })
  }
  delete(name: string) { this.deleted.push(name); return Promise.resolve(true) }
}

describe('model download', () => {
  test('fills one buffer and reports every chunk', async () => {
    const seen: number[] = []
    const bytes = await readInto(body([1, 2], [3, 4, 5], [6]), 6, (n) => seen.push(n), new AbortController().signal)
    expect([...bytes]).toEqual([1, 2, 3, 4, 5, 6])
    expect(seen).toEqual([2, 3, 1])
  })

  test('a short or oversized body is a network error', async () => {
    const signal = new AbortController().signal
    await expect(readInto(body([1, 2]), 6, () => undefined, signal)).rejects.toEqual(new DownloadError('network'))
    await expect(readInto(body([1, 2, 3, 4, 5, 6, 7]), 6, () => undefined, signal)).rejects.toEqual(new DownloadError('network'))
  })

  test('cancel stops the download without a network error', async () => {
    const controller = new AbortController()
    const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])) } }) // never closes
    const reading = readInto(new Response(stream), 6, () => { controller.abort() }, controller.signal)
    await expect(reading).rejects.toMatchObject({ name: 'AbortError' })
  })

  test('"This visit only" fetches with no-store and caches nothing', async () => {
    const caches = new MemoryCaches()
    const fetch = vi.fn(() => Promise.resolve(body([1, 2, 3, 4, 5, 6])))
    const result = await loadFile(file, { keep: false, signal: new AbortController().signal, onBytes: () => undefined, stillWanted: () => true, fetch, caches: caches as never })
    expect(result.cached).toBe(false)
    expect(fetch).toHaveBeenCalledWith(deviceFileUrl('tokenizer_config.json'), expect.objectContaining({ cache: 'no-store' }))
    expect(caches.entries.size).toBe(0)
  })

  test('"Keep on this device" stores the file, and the next load is a cache hit', async () => {
    const caches = new MemoryCaches()
    const options = { keep: true, signal: new AbortController().signal, onBytes: () => undefined, stillWanted: () => true, caches: caches as never }
    const fetch = vi.fn(() => Promise.resolve(body([1, 2, 3, 4, 5, 6])))
    expect((await loadFile(file, { ...options, fetch })).cached).toBe(false)
    const again = await loadFile(file, { ...options, fetch })
    expect(again.cached).toBe(true)
    expect([...again.bytes]).toEqual([1, 2, 3, 4, 5, 6])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  test('a kept file is stored in parts, with the part count written last', async () => {
    const caches = new MemoryCaches()
    const options = { keep: true, signal: new AbortController().signal, onBytes: () => undefined, stillWanted: () => true, caches: caches as never, partBytes: 4 }
    await loadFile(file, { ...options, fetch: () => Promise.resolve(body([1, 2, 3, 4, 5, 6])) })
    const url = deviceFileUrl('tokenizer_config.json')
    expect([...caches.entries.keys()]).toEqual([`${url}?part=0`, `${url}?part=1`, `${url}?parts`])
    const again = await loadFile(file, { ...options, fetch: () => Promise.reject(new Error('offline')) })
    expect([...again.bytes]).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('a half-written kept file is a miss, and its progress is taken back', async () => {
    const caches = new MemoryCaches()
    const url = deviceFileUrl('tokenizer_config.json')
    caches.entries.set(`${url}?part=0`, new Uint8Array([9, 9, 9, 9]))
    caches.entries.set(`${url}?parts`, new TextEncoder().encode('2'))
    let progress = 0
    const result = await loadFile(file, {
      keep: true, signal: new AbortController().signal, onBytes: (n) => { progress += n }, stillWanted: () => true,
      caches: caches as never, partBytes: 4, fetch: () => Promise.resolve(body([1, 2, 3, 4, 5, 6])),
    })
    expect(result).toMatchObject({ cached: false })
    expect([...result.bytes]).toEqual([1, 2, 3, 4, 5, 6])
    expect(progress).toBe(6)
  })

  test('a download that finishes after a delete does not refill the cache', async () => {
    const caches = new MemoryCaches()
    const fetch = () => Promise.resolve(body([1, 2, 3, 4, 5, 6]))
    await loadFile(file, { keep: true, signal: new AbortController().signal, onBytes: () => undefined, stillWanted: () => false, fetch, caches: caches as never })
    expect(caches.entries.size).toBe(0)
  })

  test('a failed request is a network error', async () => {
    const fetch = () => Promise.resolve(new Response('nope', { status: 503 }))
    await expect(loadFile(file, { keep: false, signal: new AbortController().signal, onBytes: () => undefined, stillWanted: () => true, fetch })).rejects.toEqual(new DownloadError('network'))
  })
})

describe('kept model cleanup (14 days)', () => {
  beforeEach(() => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v), removeItem: (k: string) => data.delete(k) })
  })

  test('keeps a model used within 14 days, and deletes an older or untracked one', async () => {
    const caches = new MemoryCaches()
    markKeptModelUsed(1_000)
    expect(await cleanUpStaleModel(1_000 + STALE_AFTER_MS - 1, caches as never)).toBe(false)
    expect(await cleanUpStaleModel(1_000 + STALE_AFTER_MS, caches as never)).toBe(true)
    expect(caches.deleted).toEqual([MODEL_CACHE])
    expect(keptSince()).toBeUndefined()
  })
})

describe('device gate', () => {
  const desktop = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
  test('offers the judge only to desktop browsers with a WebGPU adapter', async () => {
    expect(await deviceSupported({ userAgent: desktop, gpu: { requestAdapter: () => Promise.resolve({}) } })).toBe(true)
    expect(await deviceSupported({ userAgent: desktop, gpu: { requestAdapter: () => Promise.resolve(null) } })).toBe(false)
    expect(await deviceSupported({ userAgent: desktop })).toBe(false)
    expect(await deviceSupported({ userAgent: 'Mozilla/5.0 (iPhone)', gpu: { requestAdapter: () => Promise.resolve({}) } })).toBe(false)
  })
})

// A worker double that answers the way the real one does.
class FakeWorker {
  sent: ToWorker[] = []
  onmessage: ((event: MessageEvent<FromWorker>) => void) | null = null
  onerror: ((event: Event) => void) | null = null
  terminated = false
  postMessage(message: ToWorker) { this.sent.push(message) }
  terminate() { this.terminated = true }
  reply(message: FromWorker) { this.onmessage?.({ data: message } as MessageEvent<FromWorker>) }
}

describe('device judge client', () => {
  async function readyJudge() {
    const worker = new FakeWorker()
    const judge = createDeviceJudge(() => worker)
    const progress: unknown[] = []
    const loading = judge.load(true, (p) => progress.push(p))
    worker.reply({ type: 'progress', received: 10, total: 100 })
    worker.reply({ type: 'warming' })
    worker.reply({ type: 'ready', cached: true })
    expect(await loading).toEqual({ kind: 'ready', cached: true })
    expect(progress).toEqual([{ kind: 'download', received: 10, total: 100 }, { kind: 'warming' }])
    return { worker, judge }
  }

  test('loads with progress, then scores a guess', async () => {
    const { worker, judge } = await readyJudge()
    expect(worker.sent[0]).toEqual({ type: 'load', keep: true })
    const scoring = judge.score('pocket knife', [{ id: 'pocket', claim: '{answer} fits in a pocket' }])
    worker.reply({ type: 'scored', id: 1, scores: { pocket: 0.9 } })
    expect(await scoring).toMatchObject({ kind: 'scored', scores: { pocket: 0.9 } })
  })

  test('a guess over 10 seconds times out, and its late result is ignored', async () => {
    vi.useFakeTimers()
    const { worker, judge } = await readyJudge()
    const scoring = judge.score('pocket knife', [])
    vi.advanceTimersByTime(10_000)
    expect(await scoring).toEqual({ kind: 'timeout' })
    expect(() => { worker.reply({ type: 'scored', id: 1, scores: {} }) }).not.toThrow()
    vi.useRealTimers()
  })

  test('a crashed worker ends the load with model.start.failed', async () => {
    const worker = new FakeWorker()
    const judge = createDeviceJudge(() => worker)
    const loading = judge.load(false, () => undefined)
    worker.onerror?.(new Event('error'))
    expect(await loading).toEqual({ kind: 'failed', reason: 'start' })
    expect(worker.terminated).toBe(true)
    expect(judge.ready).toBe(false)
  })

  test('cancel and delete go to the worker', async () => {
    const { worker, judge } = await readyJudge()
    judge.cancel()
    const removing = judge.remove()
    worker.reply({ type: 'deleted' })
    await removing
    expect(worker.sent.slice(1)).toEqual([{ type: 'cancel' }, { type: 'delete' }])
    expect(judge.ready).toBe(false)
  })
})
