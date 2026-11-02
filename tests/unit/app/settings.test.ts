import { beforeEach, describe, expect, test, vi } from 'vitest'
import { loadCloudModel, loadReferee, markTipSeen, refreshCloudModel, saveCloudModel, saveReferee, subscribeCloudModel, tipSeen } from '@/lib/storage/settings'
import { installBlockedStorage, installStorage } from './support/storage'

describe('player settings (3.8)', () => {
  let data: Map<string, string>
  beforeEach(() => {
    data = installStorage()
    refreshCloudModel() // forget a choice held in memory by an earlier test
  })

  test('the cloud judge defaults to Clef-flash, ignores unknown values, and tells subscribers when it changes', () => {
    expect(loadCloudModel()).toBe('clef-flash')
    data.set('quibble:settings:cloudModel', 'not-a-model')
    expect(loadCloudModel()).toBe('clef-flash')
    const listener = vi.fn()
    const off = subscribeCloudModel(listener)
    saveCloudModel('gemma-4')
    expect(loadCloudModel()).toBe('gemma-4')
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    saveCloudModel('clef-flash')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  test('each game\'s first-round tip shows once', () => {
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
    expect(() => { saveCloudModel('gemma-4'); saveReferee('device'); markTipSeen('oddly-specific') }).not.toThrow()
    expect(loadCloudModel()).toBe('gemma-4')
  })
})
