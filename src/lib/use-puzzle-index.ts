import { useEffect, useState } from 'react'
import type { PuzzleIndex } from '@shared/schemas/puzzle'
import { loadPuzzleIndex } from './puzzles'

// Undefined while loading, null if the index can't be read. Each mounted consumer
// ignores late replies after navigation; the loader owns response validation.
export function usePuzzleIndex(): PuzzleIndex | null | undefined {
  const [index, setIndex] = useState<PuzzleIndex | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    void loadPuzzleIndex().then((value) => { if (live) setIndex(value ?? null) })
    return () => { live = false }
  }, [])
  return index
}
