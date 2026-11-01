import { useEffect, useState } from 'react'
import type { Reveal } from '@shared/schemas/judge'
import type { Puzzle } from '@shared/schemas/puzzle'
import { fetchReveal } from '@/lib/api'

// Initial requests and retries share the same cleanup, so a reveal from a previous
// round or unmounted screen cannot replace the current one.
export function useReveal({ game, n }: Pick<Puzzle, 'game' | 'n'>, roundId: string) {
  const [result, setResult] = useState<{ key: string, value: Reveal | null } | undefined>(undefined)
  const [attempt, setAttempt] = useState(0)
  const key = `${game}:${String(n)}:${roundId}:${String(attempt)}`
  useEffect(() => {
    let live = true
    void fetchReveal(game, n, roundId).then((value) => { if (live) setResult({ key, value: value ?? null }) })
    return () => { live = false }
  }, [game, n, roundId, key])

  return { reveal: result?.key === key ? result.value : undefined, reload: () => { setAttempt((value) => value + 1) } }
}
