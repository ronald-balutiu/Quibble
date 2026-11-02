import { useEffect, useState } from 'react'

// Callers supply a stable loader. Late replies from an earlier attempt or an
// unmounted consumer cannot overwrite the current result.
export function useResource<T>(load: () => Promise<T | undefined>) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ load: typeof load, attempt: number, data: T | null }>()
  useEffect(() => {
    let live = true
    void load().then(
      (data) => { if (live) setResult({ load, attempt, data: data ?? null }) },
      () => { if (live) setResult({ load, attempt, data: null }) },
    )
    return () => { live = false }
  }, [load, attempt])
  return {
    data: result?.load === load && result.attempt === attempt ? result.data : undefined,
    retry: () => { setAttempt((value) => value + 1) },
  }
}
