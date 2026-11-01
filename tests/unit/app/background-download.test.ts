import { describe, expect, test, vi } from 'vitest'
import { createBackgroundDownload } from '@/judges/device/background-download'
import type { DeviceJudge, LoadProgress, LoadResult } from '@/judges/device/client'

function setup() {
  let report: (value: LoadProgress) => void = () => {}
  let finish: (value: LoadResult) => void = () => {}
  const judge: DeviceJudge = {
    ready: false, status: 'off',
    subscribe: () => () => {},
    load: vi.fn((onProgress: (value: LoadProgress) => void) => {
      report = onProgress
      return new Promise<LoadResult>((resolve) => { finish = resolve })
    }),
    cancel: vi.fn(),
    score: vi.fn(),
    remove: vi.fn(() => Promise.resolve()),
  }
  return { judge, download: createBackgroundDownload(judge), report: (value: LoadProgress) => { report(value) }, finish: (value: LoadResult) => { finish(value) } }
}

describe('visit-scoped download', () => {
  test('keeps loading without a mounted view and never starts a second load', async () => {
    const { judge, download, report, finish } = setup()
    const unsubscribe = download.subscribe(vi.fn())
    const pending = download.start()
    unsubscribe()
    await download.start()
    expect(judge.load).toHaveBeenCalledTimes(1)
    report({ kind: 'download', received: 40, total: 100 })
    expect(download.getSnapshot()).toEqual({ kind: 'download', received: 40, total: 100 })
    report({ kind: 'warming' })
    expect(download.getSnapshot()).toEqual({ kind: 'warming' })
    finish({ kind: 'ready' })
    await pending
    expect(download.getSnapshot()).toEqual({ kind: 'idle' })
  })

  test('Cancel frees a model that finishes warming after cancellation', async () => {
    const { judge, download, report, finish } = setup()
    const pending = download.start()
    report({ kind: 'warming' })
    download.cancel()
    report({ kind: 'download', received: 90, total: 100 })
    expect(download.getSnapshot()).toEqual({ kind: 'cancelling' })
    expect(judge.cancel).toHaveBeenCalledOnce()
    finish({ kind: 'ready' })
    await pending
    expect(judge.remove).toHaveBeenCalledOnce()
    expect(download.getSnapshot()).toEqual({ kind: 'idle' })
  })

  test('a failed download can be retried', async () => {
    const { judge, download, finish } = setup()
    const first = download.start()
    finish({ kind: 'failed', reason: 'network' })
    await first
    expect(download.getSnapshot()).toEqual({ kind: 'failed', reason: 'network' })
    const retry = download.start()
    expect(judge.load).toHaveBeenCalledTimes(2)
    finish({ kind: 'cancelled' })
    await retry
    expect(download.getSnapshot()).toEqual({ kind: 'idle' })
  })

  test('does not interrupt a load started by the existing game sheet', async () => {
    const { judge, download } = setup()
    Object.defineProperty(judge, 'status', { value: 'loading' })
    await download.start()
    expect(judge.load).not.toHaveBeenCalled()
  })
})
