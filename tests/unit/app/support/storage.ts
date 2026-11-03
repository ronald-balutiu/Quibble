import { vi } from 'vitest'

// localStorage for unit tests, which run in Node. installStorage puts a fresh one
// in place and returns its backing map; installBlockedStorage stands in for a
// browser where storage is off, so every call throws.

export class MemoryStorage implements Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem' | 'removeItem' | 'clear'> {
  readonly data: Map<string, string>
  constructor(entries: Record<string, string> = {}) {
    this.data = new Map(Object.entries(entries))
  }
  get length() {
    return this.data.size
  }
  key(index: number) {
    return [...this.data.keys()][index] ?? null
  }
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
  removeItem(key: string) {
    this.data.delete(key)
  }
  clear() {
    this.data.clear()
  }
}

export function installStorage(entries: Record<string, string> = {}): Map<string, string> {
  const storage = new MemoryStorage(entries)
  vi.stubGlobal('localStorage', storage)
  return storage.data
}

export function installBlockedStorage(): void {
  const blocked = () => {
    throw new Error('Storage is off.')
  }
  vi.stubGlobal('localStorage', {
    get length(): number {
      return blocked()
    },
    key: blocked,
    getItem: blocked,
    setItem: blocked,
    removeItem: blocked,
    clear: blocked,
  })
}
