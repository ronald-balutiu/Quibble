import { describe, expect, test, vi } from 'vitest'
import { createDeviceJudge } from '@/judges/device/client'
import { DownloadError, loadFile, readInto } from '@/judges/device/download'
import { deviceSupported } from '@/judges/device/gate'
import type { FromWorker, ToWorker } from '@/judges/device/protocol'
import { deviceFileUrl } from '@/judges/device/verdict'

const file = { path: 'tokenizer_config.json', bytes: 6 } as never
const body = (...chunks: number[][]) => new Response(new ReadableStream({
  start(controller) {
    for (const chunk of chunks) controller.enqueue(new Uint8Array(chunk))
    controller.close()
  },
}))

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

  test('fetches with no-store, so the browser keeps no copy', async () => {
    const fetch = vi.fn(() => Promise.resolve(body([1, 2, 3, 4, 5, 6])))
    const bytes = await loadFile(file, { signal: new AbortController().signal, onBytes: () => undefined, fetch })
    expect([...bytes]).toEqual([1, 2, 3, 4, 5, 6])
    expect(fetch).toHaveBeenCalledWith(deviceFileUrl('tokenizer_config.json'), expect.objectContaining({ cache: 'no-store' }))
  })

  test('a failed request is a network error', async () => {
    const fetch = () => Promise.resolve(new Response('nope', { status: 503 }))
    await expect(loadFile(file, { signal: new AbortController().signal, onBytes: () => undefined, fetch })).rejects.toEqual(new DownloadError('network'))
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
    const loading = judge.load((p) => progress.push(p))
    worker.reply({ type: 'progress', received: 10, total: 100 })
    worker.reply({ type: 'warming' })
    worker.reply({ type: 'ready' })
    expect(await loading).toEqual({ kind: 'ready' })
    expect(progress).toEqual([{ kind: 'download', received: 10, total: 100 }, { kind: 'warming' }])
    return { worker, judge }
  }

  test('loads with progress, then scores a guess; only the first guess is a cold run', async () => {
    const { worker, judge } = await readyJudge()
    expect(worker.sent[0]).toEqual({ type: 'load' })
    const scoring = judge.score('pocket knife', [{ id: 'pocket', claim: '{answer} fits in a pocket' }])
    worker.reply({ type: 'scored', id: 1, scores: { pocket: 0.9 } })
    expect(await scoring).toMatchObject({ kind: 'scored', scores: { pocket: 0.9 }, warm: false })
    const again = judge.score('pocket knife', [])
    worker.reply({ type: 'scored', id: 2, scores: {} })
    expect(await again).toMatchObject({ warm: true })
  })

  test('reports off, loading and ready to subscribers', async () => {
    const worker = new FakeWorker()
    const judge = createDeviceJudge(() => worker)
    const seen: string[] = []
    judge.subscribe(() => seen.push(judge.status))
    expect(judge.status).toBe('off')
    const loading = judge.load(() => undefined)
    worker.reply({ type: 'ready' })
    await loading
    const removing = judge.remove()
    worker.reply({ type: 'deleted' })
    await removing
    expect(seen).toEqual(['loading', 'ready', 'off'])
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
    const loading = judge.load(() => undefined)
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
