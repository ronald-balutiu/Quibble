import { useSyncExternalStore } from 'react'
import type { storageSignal } from './storage/signal'

// The revision of a storage signal: memoize data derived from saved records on it,
// so it's read again only after a local or cross-tab change.
export function useStorageRevision(signal: ReturnType<typeof storageSignal>): number {
  return useSyncExternalStore(signal.subscribe, signal.snapshot, signal.serverSnapshot)
}
