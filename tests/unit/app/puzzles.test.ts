import { describe, expect, test, vi } from 'vitest'
import { loadPuzzle } from '@/lib/puzzles'
import shipped from '../../../public/puzzles/oddly-specific/1.json'

// The static puzzle files: a puzzle loads only when it's valid and is the one asked for.

const serve = (response: () => Promise<Response>) => {
  vi.stubGlobal('fetch', vi.fn(response))
}

describe('puzzle files', () => {
  test('loads a valid puzzle from its own path', async () => {
    serve(() => Promise.resolve(Response.json(shipped)))
    await expect(loadPuzzle('oddly-specific', 1)).resolves.toMatchObject({ game: 'oddly-specific', n: 1 })
    expect(fetch).toHaveBeenCalledWith('/puzzles/oddly-specific/1.json')
  })

  test('a missing, unreadable, invalid or mismatched file is no puzzle', async () => {
    serve(() => Promise.resolve(new Response('missing', { status: 404 })))
    await expect(loadPuzzle('oddly-specific', 1)).resolves.toBeUndefined()
    serve(() => Promise.reject(new TypeError('Failed to fetch')))
    await expect(loadPuzzle('oddly-specific', 1)).resolves.toBeUndefined()
    serve(() => Promise.resolve(Response.json({ game: 'oddly-specific', n: 1 })))
    await expect(loadPuzzle('oddly-specific', 1)).resolves.toBeUndefined()
    serve(() => Promise.resolve(Response.json(shipped)))
    await expect(loadPuzzle('oddly-specific', 2)).resolves.toBeUndefined()
    await expect(loadPuzzle('double-agent', 1)).resolves.toBeUndefined()
  })
})
