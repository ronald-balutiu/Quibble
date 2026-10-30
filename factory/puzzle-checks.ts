// The library guarantees (plan 3.9, step 4), as a pure function so tests can feed
// it small libraries. factory/check-puzzles.ts runs it on the real files.
import { gameConfigs, type GameId } from '@shared/games'
import { normalizeAnswer } from '@shared/normalize'
import { difficulties, type Puzzle, type PuzzleIndex } from '@shared/schemas/puzzle'
import type { Library } from '../worker/library'

const MIN_KNOWN = 4

export interface PuzzleSet { index: PuzzleIndex, files: Puzzle[], library: Library, blocklist: readonly string[] }

export function checkPuzzles({ index, files, library, blocklist }: PuzzleSet): string[] {
  const errors: string[] = []
  const aliases = new Map(Object.entries(library.aliases))
  const blocked = new Set(blocklist.map((term) => term.toLowerCase()))
  const isBlocked = (text: string) => text.toLowerCase().split(/[^\p{L}'-]+/u).some((word) => blocked.has(word)) || blocked.has(text.toLowerCase())
  const seenRounds = new Set<string>()
  const seenWords = new Set<string>()

  for (const [game, entries] of Object.entries(index) as [GameId, PuzzleIndex[GameId]][]) {
    const listed = entries ?? []
    const ofGame = files.filter((file) => file.game === game)
    if (ofGame.length !== listed.length) errors.push(`${game}: index lists ${String(listed.length)} puzzles, found ${String(ofGame.length)} files.`)
    if (Object.keys(library.puzzles[game] ?? {}).length !== listed.length) errors.push(`${game}: index and Worker library differ in size.`)
    listed.forEach(({ n, difficulty }, i) => {
      if (n !== i + 1) errors.push(`${game}: index entry ${String(i + 1)} is numbered ${String(n)}.`)
      const before = listed[i - 1]
      if (before && difficulties.indexOf(difficulty) < difficulties.indexOf(before.difficulty)) errors.push(`${game} ${String(n)}: harder puzzles come first.`)
    })

    let previous: string[] = []
    for (const file of [...ofGame].sort((a, b) => a.n - b.n)) {
      const at = `${game} ${String(file.n)}`
      const entry = listed.find(({ n }) => n === file.n)
      if (entry?.difficulty !== file.difficulty) errors.push(`${at}: difficulty differs from the index.`)
      const stored = library.puzzles[game]?.[String(file.n)]
      if (!stored) { errors.push(`${at}: missing from the Worker library.`); continue }

      const expected = game === 'category-escape' ? gameConfigs[game].levels : gameConfigs[game].rounds
      if (file.rounds.length !== expected) errors.push(`${at}: has ${String(file.rounds.length)} rounds, expected ${String(expected)}.`)
      if (Object.keys(stored.rounds).length !== file.rounds.length) errors.push(`${at}: Worker library has a different number of rounds.`)

      for (const [i, round] of file.rounds.entries()) {
        const where = `${at} ${round.id}`
        const lib = stored.rounds[round.id]
        if (!lib) { errors.push(`${where}: missing from the Worker library.`); continue }
        const ids = round.conditions.map(({ id }) => id)
        if (ids.join() !== lib.conditions.join()) errors.push(`${where}: conditions differ from the Worker library.`)
        for (const id of ids) if (!library.questions[id]) errors.push(`${where}: no model question for ${id}.`)
        if (new Set(ids).size !== ids.length) errors.push(`${where}: repeats a condition.`)
        if (!lib.known.includes(lib.example)) errors.push(`${where}: the example is not a known answer.`)
        for (const answer of lib.known) {
          if (normalizeAnswer(answer, game, aliases) !== answer) errors.push(`${where}: known answer "${answer}" changes under normalization.`)
          if (isBlocked(answer)) errors.push(`${where}: known answer "${answer}" is blocklisted.`)
        }
        for (const { label } of round.conditions) if (isBlocked(label)) errors.push(`${where}: label "${label}" is blocklisted.`)

        if (game === 'oddly-specific') {
          if (ids.length !== 3) errors.push(`${where}: needs 3 conditions.`)
          if (lib.known.length < MIN_KNOWN) errors.push(`${where}: only ${String(lib.known.length)} known answers.`)
          const key = [...ids].sort().join()
          if (seenRounds.has(key)) errors.push(`${where}: repeats an earlier round.`)
          seenRounds.add(key)
          for (const other of file.rounds.slice(0, i)) {
            if (other.conditions.filter(({ id }) => ids.includes(id)).length > 1) errors.push(`${where}: shares more than one condition with ${other.id}.`)
          }
          if (ids.some((id) => previous.includes(id))) errors.push(`${where}: shares a condition with the previous puzzle.`)
        }
        if (game === 'category-escape') {
          const before = file.rounds[i - 1]?.conditions.map(({ id }) => id) ?? []
          if (round.id !== `L${String(i + 1)}` || ids.length !== i + 1 || before.some((id, j) => ids[j] !== id)) {
            errors.push(`${where}: each level must keep the earlier conditions and add one.`)
          }
          const answer = stored.path?.[i]
          if (!answer || !lib.known.includes(answer)) errors.push(`${where}: the path answer is not a known answer.`)
        }
        if (game === 'double-agent') {
          if (ids.length !== 2) errors.push(`${where}: needs 2 clues.`)
          if (lib.known.length !== 1) errors.push(`${where}: needs exactly one hidden word.`)
          if (seenWords.has(lib.example)) errors.push(`${where}: reuses the word "${lib.example}".`)
          seenWords.add(lib.example)
          if (ids.some((id) => id.includes(lib.example))) errors.push(`${where}: a clue ID gives the word away.`)
        }
      }
      if (game === 'category-escape') {
        const path = stored.path ?? []
        if (path.length !== file.rounds.length || new Set(path).size !== path.length) errors.push(`${at}: needs a distinct path answer per level.`)
        if (path.some(isBlocked)) errors.push(`${at}: the path uses a blocklisted answer.`)
      } else if (stored.path) errors.push(`${at}: only Category Escape has a path.`)
      previous = file.rounds.flatMap((round) => round.conditions.map(({ id }) => id))
    }
  }
  for (const game of Object.keys(library.puzzles)) {
    if (!(game in index)) errors.push(`${game}: in the Worker library but not the index.`)
  }
  return errors
}
