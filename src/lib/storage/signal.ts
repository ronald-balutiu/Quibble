// useSyncExternalStore needs a stable snapshot, not newly parsed storage data.
// A revision changes after local writes and matching cross-tab storage events.
export function storageSignal(matches: (key: string) => boolean) {
  let revision = 0
  const listeners = new Set<() => void>()
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
    notify,
    subscribe: (listener: () => void) => {
      if (listeners.size === 0) globalThis.addEventListener?.('storage', onStorage)
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) globalThis.removeEventListener?.('storage', onStorage)
      }
    },
  }
}
