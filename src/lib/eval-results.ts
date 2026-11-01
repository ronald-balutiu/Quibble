import { useEffect, useState } from 'react'
import { evalResultsSchema, type EvalResults } from '@shared/schemas/eval-results'

// The answer-key results shipped with the app (public/eval/results.json), fetched
// once per tab and validated. Undefined while loading, null if they can't be read.
let request: Promise<EvalResults | null> | undefined

export function loadEvalResults(): Promise<EvalResults | null> {
  request ??= fetch('/eval/results.json')
    .then(async (response) => (response.ok ? evalResultsSchema.safeParse(await response.json()) : undefined))
    .then((parsed) => (parsed?.success ? parsed.data : null), () => null)
  return request
}

export function useEvalResults(): EvalResults | null | undefined {
  const [results, setResults] = useState<EvalResults | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void loadEvalResults().then((value) => { if (live) setResults(value) })
    return () => { live = false }
  }, [])
  return results
}
