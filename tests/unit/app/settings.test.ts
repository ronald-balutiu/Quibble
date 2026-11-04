import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  loadCloudModel,
  loadReferee,
  markTipSeen,
  refreshCloudModel,
  refreshReferee,
  saveCloudModel,
  saveReferee,
  subscribeCloudModel,
  tipSeen,
} from '@/lib/storage/settings'
import { deleteEverything } from '@/lib/storage/everything'
import { installBlockedStorage, installStorage, MemoryStorage } from './support/storage'

describe('player settings (3.8)', () => {
  let data: Map<string, string>
  beforeEach(() => {
    data = installStorage()
    refreshReferee()
    refreshCloudModel() // forget a choice held in memory by an earlier test
  })

  test('the cloud judge defaults to Clef-flash, ignores unknown values, and tells subscribers when it changes', () => {
    expect(loadCloudModel()).toBe('clef-flash')
    data.set('quibble:settings:cloudModel', 'not-a-model')
    expect(loadCloudModel()).toBe('clef-flash')
    const listener = vi.fn()
    const off = subscribeCloudModel(listener)
    try {
      saveCloudModel('gemma-4')
      expect(loadCloudModel()).toBe('gemma-4')
      expect(listener).toHaveBeenCalledTimes(1)
    } finally {
      off()
    }
    saveCloudModel('clef-flash')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test("each game's first-round tip shows once", () => {
    expect(tipSeen('oddly-specific')).toBe(false)
    markTipSeen('oddly-specific')
    markTipSeen('double-agent')
    markTipSeen('oddly-specific')
    expect(tipSeen('oddly-specific')).toBe(true)
    expect(tipSeen('category-escape')).toBe(false)
    expect(data.get('quibble:settings:tipsSeen')).toBe('oddly-specific,double-agent')
  })

  test('the referee is the cloud unless the player chose the device', () => {
    expect(loadReferee()).toBe('cloud')
    saveReferee('device')
    expect(loadReferee()).toBe('device')
    data.set('quibble:settings:referee', 'something-else')
    expect(loadReferee()).toBe('cloud')
  })

  test('with storage off, settings fall back to their defaults, and a cloud judge choice lasts for the page', () => {
    installBlockedStorage()
    expect(loadCloudModel()).toBe('clef-flash')
    expect(loadReferee()).toBe('cloud')
    expect(tipSeen('oddly-specific')).toBe(false)
    expect(() => {
      saveCloudModel('gemma-4')
      saveReferee('device')
      markTipSeen('oddly-specific')
    }).not.toThrow()
    expect(loadCloudModel()).toBe('gemma-4')
    expect(loadReferee()).toBe('device')
  })
})

test('a referee choice wins over stale storage when only writes fail, and Delete everything resets it', () => {
  refreshReferee()
  const storage = new MemoryStorage({ 'quibble:settings:referee': 'cloud' })
  vi.spyOn(storage, 'setItem').mockImplementation(() => {
    throw new Error('quota')
  })
  vi.stubGlobal('localStorage', storage)
  saveReferee('device')
  expect(loadReferee()).toBe('device')
  deleteEverything()
  expect(loadReferee()).toBe('cloud')
})

test('an inaccessible storage getter still keeps the referee choice for the visit', () => {
  refreshReferee()
  installStorage()
  vi.spyOn(globalThis, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('blocked')
  })
  saveReferee('device')
  expect(loadReferee()).toBe('device')
  deleteEverything()
  expect(loadReferee()).toBe('cloud')
})

test('matching cross-tab events invalidate fallback choices and notify subscribers', () => {
  installStorage()
  const listeners = new Set<(event: StorageEvent) => void>()
  vi.stubGlobal(
    'addEventListener',
    vi.fn((_name: string, callback: (event: StorageEvent) => void) => {
      listeners.add(callback)
    }),
  )
  vi.stubGlobal(
    'removeEventListener',
    vi.fn((_name: string, callback: (event: StorageEvent) => void) => {
      listeners.delete(callback)
    }),
  )
  const changed = vi.fn()
  const stop = subscribeCloudModel(changed)
  const emit = (key: string | null) => {
    for (const listener of listeners) listener({ key } as StorageEvent)
  }
  try {
    emit('unrelated')
    expect(changed).not.toHaveBeenCalled()
    emit('quibble:settings:cloudModel')
    emit(null)
    refreshCloudModel()
    expect(changed).toHaveBeenCalledTimes(3)
  } finally {
    stop()
  }
  expect(listeners.size).toBe(0)
})
