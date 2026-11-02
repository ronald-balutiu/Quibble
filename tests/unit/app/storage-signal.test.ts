import { expect, test, vi } from 'vitest'
import { storageSignal } from '@/lib/storage/signal'
import { progressChanges, resetPuzzle, saveRun } from '@/lib/storage/progress'
import { comparisonChanges } from '@/lib/storage/comparisons'
import { clearGameData } from '@/lib/storage/progress'
import { deleteEverything } from '@/lib/storage/everything'
import { startRun } from '@/games/rounds/reducer'
import { oddlySpecificConfig } from '@shared/games/oddly-specific'

test('uses one cross-tab listener while subscribed, filters storage areas and keys, then cleans up', () => {
  let dispatch!: (event: Partial<StorageEvent>) => void
  const add = vi.fn((_type: string, listener: typeof dispatch) => { dispatch = listener })
  const remove = vi.fn()
  vi.stubGlobal('addEventListener', add)
  vi.stubGlobal('removeEventListener', remove)
  const store = {} as Storage
  vi.stubGlobal('localStorage', store)
  const signal = storageSignal((key) => key.startsWith('progress:'))
  const one = vi.fn()
  const two = vi.fn()
  const offOne = signal.subscribe(one)
  const offTwo = signal.subscribe(two)
  expect(add).toHaveBeenCalledTimes(1)
  dispatch({ key: 'progress:1', storageArea: {} as Storage })
  dispatch({ key: 'other', storageArea: store })
  expect(signal.snapshot()).toBe(0)
  dispatch({ key: 'progress:1', storageArea: store })
  dispatch({ key: null, storageArea: store })
  expect(signal.snapshot()).toBe(2)
  expect(one).toHaveBeenCalledTimes(2)
  expect(two).toHaveBeenCalledTimes(2)
  offOne()
  expect(remove).not.toHaveBeenCalled()
  offTwo()
  expect(remove).toHaveBeenCalledWith('storage', dispatch)
})

test('successful local progress writes, resets, clears and delete-all invalidate subscribers', () => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    get length() { return data.size },
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    removeItem: (key: string) => data.delete(key),
  })
  const progress = vi.fn()
  const history = vi.fn()
  const off = progressChanges.subscribe(progress)
  const offHistory = comparisonChanges.subscribe(history)
  try {
    expect(saveRun('oddly-specific', 1, startRun(oddlySpecificConfig), 0)).toBe(true)
    expect(resetPuzzle('oddly-specific', 1)).toBe(true)
    clearGameData()
    deleteEverything()
    expect(progress).toHaveBeenCalledTimes(4)
    expect(history).toHaveBeenCalledTimes(1)
    vi.stubGlobal('localStorage', undefined)
    expect(resetPuzzle('oddly-specific', 1)).toBe(false)
    expect(saveRun('oddly-specific', 1, startRun(oddlySpecificConfig), 0)).toBe(false)
    expect(progress).toHaveBeenCalledTimes(4)
  } finally {
    off()
    offHistory()
  }
})
