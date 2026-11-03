import { useSyncExternalStore } from 'react'

const neverChanges = () => () => undefined

// A value fixed for the page visit that the prerendered HTML can't know: `server`
// while React attaches to that HTML, then `client`. Both must return a stable value.
export function useClientValue<T>(client: () => T, server: () => T): T {
  return useSyncExternalStore(neverChanges, client, server)
}

const yes = () => true
const no = () => false

// False while React attaches to a prerendered page, true afterwards. Anything the
// prerendered HTML can't know (the URL's query, saved data) reads it only once this
// is true, so hydration matches the HTML and the real value follows straight after.
export function useHydrated(): boolean {
  return useClientValue(yes, no)
}
