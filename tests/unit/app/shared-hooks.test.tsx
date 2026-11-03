// @vitest-environment happy-dom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react'
import { Suspense } from 'react'
import { renderToString } from 'react-dom/server'
import { afterEach, expect, test, vi } from 'vitest'
import { lazyNamed } from '@/lib/lazy-named'
import { storageSignal } from '@/lib/storage/signal'
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
