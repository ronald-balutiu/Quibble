import { useSyncExternalStore } from 'react'

const neverChanges = () => () => undefined

// False while React attaches to a prerendered page, true afterwards. Anything the
// prerendered HTML can't know (the URL's query, saved data) reads it only once this
// is true, so hydration matches the HTML and the real value follows straight after.
export function useHydrated(): boolean {
  return useSyncExternalStore(neverChanges, () => true, () => false)
}
