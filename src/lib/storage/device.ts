import { MODEL_CACHE } from '@/judges/device/download'

// "Keep on this device" bookkeeping (3.8, D-15): when the model was last used, so
// a kept model unused for 14 days is deleted on the next visit. The model itself
// lives in the Cache API; "this visit only" leaves nothing here.

const KEPT = 'quibble:device:lastUsed'
export const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000

export function keptSince(): number | undefined {
  try {
    const value = Number(globalThis.localStorage.getItem(KEPT))
    return Number.isFinite(value) && value > 0 ? value : undefined
  } catch {
    return undefined
  }
}

export function markKeptModelUsed(now = Date.now()): void {
  try {
    globalThis.localStorage.setItem(KEPT, String(now))
  } catch {
    // Storage is off: the kept model is never marked, so the next visit cleans it up.
  }
}

export function forgetKeptModel(): void {
  try {
    globalThis.localStorage.removeItem(KEPT)
  } catch {
    // Nothing to forget.
  }
}

// Deletes a kept model unused for 14 days, or one whose bookkeeping is gone.
// Runs on each visit, since a site can only clear its storage while it's open.
export async function cleanUpStaleModel(now = Date.now(), cacheStorage: CacheStorage | undefined = globalThis.caches): Promise<boolean> {
  const since = keptSince()
  if (since !== undefined && now - since < STALE_AFTER_MS) return false
  forgetKeptModel()
  try {
    return (await cacheStorage?.delete(MODEL_CACHE)) ?? false
  } catch {
    return false
  }
}
