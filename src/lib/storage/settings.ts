import { cloudModels, defaultCloudModel, type CloudModel } from '@shared/schemas/judge'

// Small player settings (plan 3.8). Wrapped like all storage: defaults apply when
// storage is blocked.

const CLOUD_MODEL = 'quibble:settings:cloudModel'
const TIPS = 'quibble:settings:tipsSeen'
const REFEREE = 'quibble:settings:referee'

export function loadCloudModel(): CloudModel {
  try {
    const value = globalThis.localStorage.getItem(CLOUD_MODEL)
    return cloudModels.find((model) => model === value) ?? defaultCloudModel
  } catch {
    return defaultCloudModel
  }
}

export function saveCloudModel(model: CloudModel): void {
  try {
    globalThis.localStorage.setItem(CLOUD_MODEL, model)
  } catch {
    // Storage is off; the choice lasts for this page only.
  }
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
export function loadReferee(): 'cloud' | 'device' {
  try {
    return globalThis.localStorage.getItem(REFEREE) === 'device' ? 'device' : 'cloud'
  } catch {
    return 'cloud'
  }
}

export function saveReferee(referee: 'cloud' | 'device'): void {
  try {
    globalThis.localStorage.setItem(REFEREE, referee)
  } catch {
    // Storage is off; the choice lasts for this page only.
  }
}
