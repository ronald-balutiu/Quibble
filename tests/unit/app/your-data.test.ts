import { beforeEach, describe, expect, test, vi } from 'vitest'
import { clearComparisons } from '@/lib/storage/comparisons'
import { deleteEverything } from '@/lib/storage/everything'
import { clearGameData, progressSummary } from '@/lib/storage/progress'

// A Storage with key() and length, which the clears walk.
function memoryStorage(entries: Record<string, string>) {
  const data = new Map(Object.entries(entries))
  vi.stubGlobal('localStorage', {
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  })
  return data
}

const run = JSON.stringify({ run: { current: 0, rounds: [], finished: false } })
const best = JSON.stringify({ best: 9 })

describe('L3 "Your data" (1.8)', () => {
  let data: Map<string, string>
  beforeEach(() => {
    data = memoryStorage({
      'quibble:progress:oddly-specific:1': best,
      'quibble:progress:double-agent:2': run,
      'quibble:comparisons': '[]',
      'quibble:settings:referee': 'device',
      'other-site': 'kept',
    })
  })

  test('counts saved puzzles and open runs', () => {
    expect(progressSummary()).toEqual({ puzzles: 2, open: 1 })
  })

  test('"Clear game data" removes only progress', () => {
    clearGameData()
    expect([...data.keys()]).toEqual(['quibble:comparisons', 'quibble:settings:referee', 'other-site'])
  })

  test('"Clear history" removes only the judge comparisons', () => {
    clearComparisons()
    expect(data.has('quibble:comparisons')).toBe(false)
    expect(data.size).toBe(4)
  })

  test('"Delete everything" removes every key this app wrote, and nothing else', () => {
    deleteEverything()
    expect([...data.keys()]).toEqual(['other-site'])
  })

  test('blocked storage never throws', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(() => { clearGameData(); clearComparisons(); deleteEverything() }).not.toThrow()
    expect(progressSummary()).toEqual({ puzzles: 0, open: 0 })
  })
})

test('one corrupt progress record does not hide valid progress in the summary', () => {
  memoryStorage({
    'quibble:progress:oddly-specific:1': '{broken',
    'quibble:progress:oddly-specific:2': '{"best":-1}',
    'quibble:progress:oddly-specific:3': best,
    'quibble:progress:double-agent:1': run,
  })
  expect(progressSummary()).toEqual({ puzzles: 2, open: 1 })
})
