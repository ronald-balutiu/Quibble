import { useSyncExternalStore } from 'react'
import { defaultCloudModel, type CloudModel } from '@shared/schemas/judge'
import { loadCloudModel, subscribeCloudModel } from '@/lib/storage/settings'

// The player's cloud judge, kept current across tabs. Prerendered pages and the
// first hydrating render use the default, since the server has no storage.
export function useCloudModel(): CloudModel {
  return useSyncExternalStore(subscribeCloudModel, loadCloudModel, () => defaultCloudModel)
}
