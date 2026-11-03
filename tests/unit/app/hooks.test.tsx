// @vitest-environment happy-dom
import { act, cleanup, render, renderHook, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { usePageMeta } from '@/app/use-page-meta'
import { useHydrated } from '@/lib/use-hydrated'
import { useResource } from '@/lib/use-resource'
import type { DeviceRun } from '@/scenes/game/judge-guess'
import { useDeviceColumn } from '@/scenes/game/use-device-column'

afterEach(() => { cleanup() })

describe('useHydrated', () => {
  test('is false in prerendered HTML and true once React is live', () => {
    function Probe() { return <>{String(useHydrated())}</> }
    expect(renderToString(<Probe />)).toBe('false')
    expect(render(<Probe />).container.textContent).toBe('true')
  })
})

describe('useResource', () => {
  test('loads, and Retry tries again after a failure', async () => {
    const load = vi.fn<() => Promise<string | undefined>>().mockResolvedValueOnce(undefined).mockResolvedValueOnce('puzzles')
    const { result } = renderHook(() => useResource(load))
    expect(result.current.data).toBeUndefined()
    await waitFor(() => { expect(result.current.data).toBeNull() })
    act(() => { result.current.retry() })
    await waitFor(() => { expect(result.current.data).toBe('puzzles') })
  })

  test('a reply for an earlier loader never shows for the current one', async () => {
    let finishOld: (value: string) => void = () => undefined
    const old = () => new Promise<string>((resolve) => { finishOld = resolve })
    const current = () => Promise.resolve('current')
    const { result, rerender } = renderHook(({ load }) => useResource(load), { initialProps: { load: old } })
    rerender({ load: current })
    await waitFor(() => { expect(result.current.data).toBe('current') })
    await act(async () => { finishOld('old'); await Promise.resolve() })
    expect(result.current.data).toBe('current')
  })
})

describe('useDeviceColumn', () => {
  const scored = (agreed: number, compared: number): DeviceRun => ({ kind: 'scored', scores: {}, ms: 120, agreed, compared })

  test('draws only the latest guess\'s run, but every compared guess counts towards "agreed n / m"', () => {
    const { result } = renderHook(() => useDeviceColumn())
    let first: (run: DeviceRun) => void = () => undefined
    act(() => { first = result.current.follow() })
    let second: (run: DeviceRun) => void = () => undefined
    act(() => { second = result.current.follow() })
    act(() => { first(scored(1, 3)) })
    expect(result.current.run).toBeUndefined()
    act(() => { second(scored(3, 3)) })
    expect(result.current.run).toMatchObject({ kind: 'scored', agreed: 3 })
    expect(result.current.tally).toEqual({ agreed: 4, compared: 6 })
  })

  test('the resting strip stays until a guess gets the cloud\'s answer again', () => {
    const { result } = renderHook(() => useDeviceColumn())
    const guess = { answer: 'x', pass: true, failed: [], closeCall: false }
    act(() => { result.current.settled({ ui: { kind: 'resting', resetAt: '2099-01-01T00:00:00.000Z' }, restingUntil: '2099-01-01T00:00:00.000Z' }) })
    expect(result.current.restingUntil).toBe('2099-01-01T00:00:00.000Z')
    act(() => { result.current.settled({ guess, scores: {}, decidedBy: 'device' }) })
    expect(result.current.restingUntil).toBe('2099-01-01T00:00:00.000Z')
    act(() => { result.current.settled({ guess, scores: {}, decidedBy: 'cloud' }) })
    expect(result.current.restingUntil).toBeUndefined()
  })

  test('clear forgets the last guess, so its late run is not drawn', () => {
    const { result } = renderHook(() => useDeviceColumn())
    let follow: (run: DeviceRun) => void = () => undefined
    act(() => { follow = result.current.follow(); result.current.judged(41) })
    act(() => { result.current.clear() })
    act(() => { follow(scored(2, 2)) })
    expect(result.current.run).toBeUndefined()
    expect(result.current.modelMs).toBeUndefined()
  })
})

describe('usePageMeta', () => {
  const at = (path: string) => ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>

  test('sets the title and canonical URL, and noindex only for pages that don\'t exist', () => {
    const { rerender } = renderHook(({ indexable }) => { usePageMeta('Library · Quibble', { indexable }) }, { wrapper: at('/play'), initialProps: { indexable: true } })
    expect(document.title).toBe('Library · Quibble')
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://quibble.ronaldbalutiu.com/play')
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
    rerender({ indexable: false })
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    rerender({ indexable: true })
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })
})
