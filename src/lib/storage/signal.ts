// Listens for other tabs' storage changes. Outside a browser (prerendering) there's
// nothing to listen to, so it does nothing.
export function onStorageEvent(listener: (event: StorageEvent) => void): () => void {
  if (typeof globalThis.addEventListener !== 'function') return () => undefined
  globalThis.addEventListener('storage', listener)
  return () => {
    globalThis.removeEventListener('storage', listener)
  }
}

// useSyncExternalStore needs a stable snapshot, not newly parsed storage data.
// A revision changes after local writes and matching cross-tab storage events.
export function storageSignal(matches: (key: string) => boolean) {
  let revision = 0
  const listeners = new Set<() => void>()
  let stopListening: (() => void) | undefined
  function notify() {
    revision += 1
    for (const listener of listeners) listener()
  }
  function onStorage(event: StorageEvent) {
    if (event.storageArea !== globalThis.localStorage) return
    if (event.key === null || matches(event.key)) notify()
  }
  return {
    snapshot: () => revision,
    // Prerendered pages and hydration start from no local changes.
    serverSnapshot: () => 0,
    notify,
    subscribe: (listener: () => void) => {
      if (listeners.size === 0) stopListening = onStorageEvent(onStorage)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) stopListening?.()
      }
    },
  }
}
