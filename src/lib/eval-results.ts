import { evalResultsSchema } from '@shared/schemas/eval-results'
import { cachedLoader } from './cached-loader'
import { useResource } from './use-resource'

export const loadEvalResults = cachedLoader(async () => {
  const response = await fetch('/eval/results.json')
  return response.ok ? evalResultsSchema.safeParse(await response.json()).data : undefined
})

export function useEvalResults() {
  return useResource(loadEvalResults)
}
