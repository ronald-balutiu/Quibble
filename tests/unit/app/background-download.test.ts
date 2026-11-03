import { describe, expect, test, vi } from 'vitest'
import { createBackgroundDownload } from '@/judges/device/background-download'
import type { DeviceStatus, LoadProgress, LoadResult } from '@/judges/device/client'
import { deviceJudgeDouble } from './support/device-judge'
import { deferred } from '../../support/deferred'

function setup(status: DeviceStatus = 'off') {
  let report!: (value: LoadProgress) => void
  let loading!: ReturnType<typeof deferred<LoadResult>>
  const judge = deviceJudgeDouble(status, {
    load: vi.fn((onProgress: (value: LoadProgress) => void) => {
      report = onProgress
      loading = deferred<LoadResult>()
      return loading.promise
    }),
  })
  return { judge, download: createBackgroundDownload(judge), report: (value: LoadProgress) => { report(value) }, finish: (value: LoadResult) => { loading.resolve(value) } }
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
    const { judge, download } = setup('loading')
    await download.start()
    expect(judge.load).not.toHaveBeenCalled()
  })
})
