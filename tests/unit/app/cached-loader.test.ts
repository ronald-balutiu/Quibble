import { describe, expect, test, vi } from 'vitest'
import { cachedLoader } from '@/lib/cached-loader'
import { loadPuzzle } from '@/lib/puzzles'

describe('static resources', () => {
  test('shares in-flight requests and retains successful data', async () => {
    let resolve!: (value: { n: number }) => void
    const load = vi.fn(() => new Promise<{ n: number }>((done) => { resolve = done }))
    const cached = cachedLoader(load)
    const first = cached()
    expect(cached()).toBe(first)
    await Promise.resolve()
    resolve({ n: 1 })
    expect(await first).toEqual({ n: 1 })
    expect(await cached()).toEqual({ n: 1 })
    expect(load).toHaveBeenCalledTimes(1)
  })

  test('evicts failed or missing data so a retry can recover', async () => {
    const load = vi.fn<() => Promise<string | undefined>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined)
      .mockResolvedValue('ready')
    const cached = cachedLoader(load)
    expect(await cached()).toBeUndefined()
    expect(await cached()).toBeUndefined()
    expect(await cached()).toBe('ready')
    expect(load).toHaveBeenCalledTimes(3)
  })

  test.each([new Response('', { status: 503 }), new Response('{broken'), Response.json({ game: 'wrong' })])('rejects unavailable or invalid puzzle data', async (response) => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response)))
    expect(await loadPuzzle('oddly-specific', 1)).toBeUndefined()
  })
})
