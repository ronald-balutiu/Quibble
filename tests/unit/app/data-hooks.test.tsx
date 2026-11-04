// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useReveal } from '@/games/shared/use-reveal'
import { useEvalResults } from '@/lib/eval-results'
import { usePuzzleIndex } from '@/lib/use-puzzle-index'
import { deferred } from '../../support/deferred'
import index from '../../../public/puzzles/index.json'
import results from '../../../public/eval/results.json'

afterEach(() => {
  cleanup()
})

for (const { name, hook, payload, url } of [
  { name: 'puzzle index', hook: usePuzzleIndex, payload: index, url: '/puzzles/index.json' },
  { name: 'published results', hook: useEvalResults, payload: results, url: '/eval/results.json' },
]) {
  test(`${name} retries failed and malformed downloads, then shares valid data across consumers`, async () => {
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json({ invalid: true }))
      .mockResolvedValueOnce(Response.json(payload))
    vi.stubGlobal('fetch', fetch)
    const { result, unmount } = renderHook(() => hook())
    await waitFor(() => {
      expect(result.current.data).toBeNull()
    })
    act(() => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(result.current.data).toBeNull()
    })
    act(() => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(result.current.data).toBeNull()
    })
    act(() => {
      result.current.retry()
    })
    await waitFor(() => {
      expect(result.current.data).toEqual(payload)
    })
    unmount()
    const second = renderHook(() => hook())
    await waitFor(() => {
      expect(second.result.current.data).toEqual(payload)
    })
    expect(fetch).toHaveBeenCalledTimes(4)
    expect(fetch).toHaveBeenCalledWith(url)
  })
}

test('reveal failures can be retried and a previous round reply cannot replace the current reveal', async () => {
  const old = deferred<Response>()
  const fetch = vi
    .fn()
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(Response.json({ example: 'fork', also: [] }))
  vi.stubGlobal('fetch', fetch)
  const puzzle = { game: 'oddly-specific' as const, n: 1 }
  const { result, rerender } = renderHook(({ round }) => useReveal(puzzle, round), { initialProps: { round: 'r1' } })
  expect(result.current.reveal).toBeUndefined()
  rerender({ round: 'r2' })
  await waitFor(() => {
    expect(result.current.reveal).toBeNull()
  })
  act(() => {
    result.current.reload()
  })
  await waitFor(() => {
    expect(result.current.reveal).toEqual({ example: 'fork', also: [] })
  })
  await act(async () => {
    old.resolve(Response.json({ example: 'spoon', also: [] }))
    await old.promise
  })
  expect(result.current.reveal).toEqual({ example: 'fork', also: [] })
  expect(fetch).toHaveBeenLastCalledWith('/api/reveal/oddly-specific/1/r2')
})

test('a reveal completing after unmount cannot update a subsequent consumer', async () => {
  const old = deferred<Response>()
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(Response.json({ example: 'fork', also: [] })),
  )
  const puzzle = { game: 'oddly-specific' as const, n: 1 }
  const first = renderHook(() => useReveal(puzzle, 'r1'))
  first.unmount()
  const second = renderHook(() => useReveal(puzzle, 'r2'))
  await waitFor(() => {
    expect(second.result.current.reveal?.example).toBe('fork')
  })
  await act(async () => {
    old.resolve(Response.json({ example: 'spoon', also: [] }))
    await old.promise
  })
  expect(second.result.current.reveal?.example).toBe('fork')
})
