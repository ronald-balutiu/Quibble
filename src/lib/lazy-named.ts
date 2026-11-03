import { lazy, type ComponentType } from 'react'

// React.lazy for a module's named export, so screens keep named exports and their
// own chunks: lazyNamed(() => import('./Screen'), 'Screen').
export function lazyNamed<K extends string, P extends object>(
  load: () => Promise<Record<K, ComponentType<P>>>,
  name: K,
) {
  return lazy(() => load().then((module) => ({ default: module[name] })))
}
