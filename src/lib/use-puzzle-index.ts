import { loadPuzzleIndex } from './puzzles'
import { useResource } from './use-resource'

export function usePuzzleIndex() {
  return useResource(loadPuzzleIndex)
}
