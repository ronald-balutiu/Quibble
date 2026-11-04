// @vitest-environment happy-dom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { renderToString, renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, test, vi } from 'vitest'
import { lazyNamed } from '@/lib/lazy-named'
import { progressChanges } from '@/lib/storage/progress'
import { comparisonChanges } from '@/lib/storage/comparisons'
import { storageSignal } from '@/lib/storage/signal'
import { useCloudModel } from '@/lib/use-cloud-model'
import { useClientValue } from '@/lib/use-hydrated'
import { useModalDialog } from '@/lib/use-modal-dialog'
import { useStorageRevision } from '@/lib/use-storage-revision'

afterEach(() => {
  cleanup()
})

test('lazyNamed renders a module’s named export with its props', async () => {
  const module = { Greeting: ({ name }: { name: string }) => <p>{name}</p> }
  const Greeting = lazyNamed(() => Promise.resolve(module), 'Greeting')
  render(
    <Suspense>
      <Greeting name="Quibble" />
    </Suspense>,
  )

  expect(await screen.findByText('Quibble')).toBeTruthy()
})

test('useModalDialog opens its dialog as a modal once, on mount', () => {
  const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(() => undefined)
  function Sheet() {
    return <dialog ref={useModalDialog()} />
  }
  const { rerender } = render(<Sheet />)
  rerender(<Sheet />)

  expect(showModal).toHaveBeenCalledTimes(1)
})

test('useStorageRevision follows its signal', () => {
  const signal = storageSignal(() => true)
  const { result } = renderHook(() => useStorageRevision(signal))
  const before = result.current
  act(() => {
    signal.notify()
  })

  expect(result.current).toBe(before + 1)
})

test('useClientValue shows the server value in prerendered HTML and the client value once live', () => {
  const client = () => 'client'
  const server = () => 'server'
  function Probe() {
    return <>{useClientValue(client, server)}</>
  }

  expect(renderToString(<Probe />)).toBe('server')
  expect(render(<Probe />).container.textContent).toBe('client')
})

test('prerendered snapshots do not read browser settings or storage revisions', () => {
  function Probe() {
    return (
      <>
        {useCloudModel()}:{useStorageRevision(storageSignal(() => true))}
      </>
    )
  }
  expect(renderToStaticMarkup(<Probe />)).toBe('clef-flash:0')
})

test('other-tab progress and comparison writes invalidate only their own mounted views', () => {
  const { result } = renderHook(() => ({
    progress: useStorageRevision(progressChanges),
    comparisons: useStorageRevision(comparisonChanges),
  }))
  const before = result.current
  const changed = (key: string) => {
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }))
    })
  }
  changed('unrelated')
  expect(result.current).toEqual(before)
  changed('quibble:progress:oddly-specific:1')
  expect(result.current).toEqual({ progress: before.progress + 1, comparisons: before.comparisons })
  changed('quibble:comparisons')
  expect(result.current).toEqual({ progress: before.progress + 1, comparisons: before.comparisons + 1 })
})
