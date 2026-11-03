import { cloudModels, defaultCloudModel, type CloudModel } from '@shared/schemas/judge'

// Small player settings (plan 3.8). Wrapped like all storage: defaults apply when
// storage is blocked.

// Which judge decides a guess (L3).
export const referees = ['cloud', 'device'] as const
export type Referee = (typeof referees)[number]

const CLOUD_MODEL = 'quibble:settings:cloudModel'
const TIPS = 'quibble:settings:tipsSeen'
const REFEREE = 'quibble:settings:referee'
const cloudListeners = new Set<() => void>()
let memoryCloudModel: CloudModel | undefined

export function refreshCloudModel(): void {
  memoryCloudModel = undefined
  for (const listener of cloudListeners) listener()
}

export function subscribeCloudModel(listener: () => void): () => void {
  cloudListeners.add(listener)
  const changed = (event: StorageEvent) => {
    if (event.key === CLOUD_MODEL || event.key === null) { memoryCloudModel = undefined; listener() }
  }
  // Optional, as in signal.ts: there's no window outside a browser.
  globalThis.addEventListener?.('storage', changed)
  return () => {
    cloudListeners.delete(listener)
    globalThis.removeEventListener?.('storage', changed)
  }
}

export function loadCloudModel(): CloudModel {
  if (memoryCloudModel) return memoryCloudModel
  try {
    const value = globalThis.localStorage.getItem(CLOUD_MODEL)
    return cloudModels.find((model) => model === value) ?? defaultCloudModel
  } catch {
    return memoryCloudModel ?? defaultCloudModel
  }
}

export function saveCloudModel(model: CloudModel): void {
  try {
    globalThis.localStorage.setItem(CLOUD_MODEL, model)
    memoryCloudModel = undefined
  } catch {
    memoryCloudModel = model
    // Storage is off; the choice lasts for this page only.
  }
  for (const listener of cloudListeners) listener()
}

// The first-round tip shows once per game (D-30).
export function tipSeen(game: string): boolean {
  try {
    return (globalThis.localStorage.getItem(TIPS) ?? '').split(',').includes(game)
  } catch {
    return false
  }
}

export function markTipSeen(game: string): void {
  try {
    const seen = new Set((globalThis.localStorage.getItem(TIPS) ?? '').split(',').filter(Boolean))
    seen.add(game)
    globalThis.localStorage.setItem(TIPS, [...seen].join(','))
  } catch {
    // Storage is off; the tip may show again next visit.
  }
}

// Which judge decides (L3): the cloud unless the player picked the on-device judge.
// It only applies while that judge is on.
export function loadReferee(): Referee {
  try {
    return globalThis.localStorage.getItem(REFEREE) === 'device' ? 'device' : 'cloud'
  } catch {
    return 'cloud'
  }
}

export function saveReferee(referee: Referee): void {
  try {
    globalThis.localStorage.setItem(REFEREE, referee)
  } catch {
    // Storage is off; the choice lasts for this page only.
  }
}
