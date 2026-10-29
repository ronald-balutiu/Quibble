import { beforeEach, describe, expect, test, vi } from 'vitest'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { runReducer, startRun } from '@/games/oddly-specific/reducer'
import { isStorageAvailable, loadProgress, resetPuzzle, saveRun } from '@/lib/storage/progress'

class MemoryStorage {
  data = new Map<string, string>()
  getItem(k: string) { return this.data.get(k) ?? null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

const reduce = runReducer(oddlySpecificConfig)
let store: MemoryStorage

beforeEach(() => {
  store = new MemoryStorage()
  vi.stubGlobal('localStorage', store)
})

describe('progress storage', () => {
  test('saves and restores an in-progress run', () => {
    const run = reduce(startRun(oddlySpecificConfig), { type: 'judged', guess: { answer: 'a', pass: true, failed: [], closeCall: false } })
    expect(saveRun('oddly-specific', 3, run, 3)).toBe(true)
    expect(loadProgress('oddly-specific', 3)).toEqual({ run })
  })

  test('on finishing, clears the run and keeps the best score', () => {
    const finished = { ...startRun(oddlySpecificConfig), finished: true }
    saveRun('oddly-specific', 3, finished, 9)
    saveRun('oddly-specific', 3, finished, 7)
    expect(loadProgress('oddly-specific', 3)).toEqual({ best: 9 })
    saveRun('oddly-specific', 3, startRun(oddlySpecificConfig), 0)
    expect(loadProgress('oddly-specific', 3).best).toBe(9)
  })

  test('discards saved data that no longer fits the shape', () => {
    store.setItem('quibble:progress:oddly-specific:3', JSON.stringify({ run: { version: 0 } }))
    expect(loadProgress('oddly-specific', 3)).toEqual({})
    store.setItem('quibble:progress:oddly-specific:3', '{not json')
    expect(loadProgress('oddly-specific', 3)).toEqual({})
  })

  test('reset removes the puzzle', () => {
    saveRun('oddly-specific', 3, { ...startRun(oddlySpecificConfig), finished: true }, 5)
    resetPuzzle('oddly-specific', 3)
    expect(loadProgress('oddly-specific', 3)).toEqual({})
  })

  test('keeps playing when storage throws', () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('full') }, removeItem: () => { throw new Error('blocked') } })
    expect(isStorageAvailable()).toBe(false)
    expect(loadProgress('oddly-specific', 3)).toEqual({})
    expect(saveRun('oddly-specific', 3, startRun(oddlySpecificConfig), 0)).toBe(false)
    expect(resetPuzzle('oddly-specific', 3)).toBe(false)
  })
})
