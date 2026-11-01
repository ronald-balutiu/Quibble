import { refreshCloudModel } from './settings'

// "Delete everything" in L3 "Your data" (1.8): progress, judge history and settings,
// every key this app writes, which all start with "quibble:".
export function deleteEverything(): void {
  try {
    const store = globalThis.localStorage
    const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => k?.startsWith('quibble:') ?? false)
    for (const k of keys) store.removeItem(k)
  } catch {
    // Storage is off: there is nothing saved to delete.
  }
  refreshCloudModel()
}
