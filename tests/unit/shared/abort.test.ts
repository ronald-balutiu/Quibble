import { expect, test, vi } from 'vitest'
import { abortable } from '../../../shared/abort.ts'
import { deferred } from '../../support/deferred'

test.each(['resolve', 'reject'] as const)(
  'releases its abort listener when work completes with %s',
  async (outcome) => {
    const controller = new AbortController()
    const remove = vi.spyOn(controller.signal, 'removeEventListener')
    const work = deferred<string>()
    const waiting = abortable(work.promise, controller.signal)
    if (outcome === 'resolve') {
      work.resolve('verdict')
      await expect(waiting).resolves.toBe('verdict')
    } else {
      work.reject(new Error('offline'))
      await expect(waiting).rejects.toThrow('offline')
    }
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function))
  },
)

test('aborts a pending wait and owns a late rejection', async () => {
  const controller = new AbortController()
  const work = deferred<string>()
  const waiting = abortable(work.promise, controller.signal)
  const reason = new Error('left the page')
  controller.abort(reason)
  await expect(waiting).rejects.toBe(reason)
  work.reject(new Error('late failure'))
  await work.promise.catch(() => undefined)
})

test.each(['resolve', 'reject'] as const)('an already aborted wait ignores work that will %s', async (outcome) => {
  const controller = new AbortController()
  controller.abort(new Error('cancelled'))
  const work = deferred<string>()
  await expect(abortable(work.promise, controller.signal)).rejects.toThrow('cancelled')
  if (outcome === 'resolve') work.resolve('late')
  else work.reject(new Error('late'))
  await work.promise.catch(() => undefined)
})

test('a non-Error cancellation reason still rejects with a usable abort error', async () => {
  const controller = new AbortController()
  controller.abort('left the page')
  await expect(abortable(Promise.resolve('late'), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
})
