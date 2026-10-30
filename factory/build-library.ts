// Builds the puzzle library (plan 3.9, step 3) for all three games: the
// player-facing files in public/puzzles/ and the Worker library in
// worker/library/library.json. No model calls; known answers are things both
// models already confirmed (D-68), and Double Agent words come from
// factory/double-agent.json.
// Usage: npm run ts -- factory/build-library.ts [--max-puzzles 100] [--games oddly-specific,double-agent]
import { mkdirSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { clueClaim, clueQuestion } from '@shared/clues'
import { gameConfigs, gameIds, type GameId } from '@shared/games'
import { normalizeAnswer } from '@shared/normalize'
import { puzzleIndexSchema, puzzleSchema, type Puzzle, type PuzzleCondition } from '@shared/schemas/puzzle'
import { librarySchema, type Library, type LibraryRound } from '../worker/library'
import { categoryEscapeRun, confirmed, knownAnswers, oddlySpecificRounds, seeded, type Conditions } from './generators/rounds'
import { readJson, truth, writeJson, type Matrix } from './matrix'

interface ConditionEntry { label: string, negation: string, tag: string, question: string, claim: string, category?: boolean }
export interface AgentWord { word: string, clues: [string, string] }

const { values } = parseArgs({ options: { 'max-puzzles': { type: 'string', default: '100' }, games: { type: 'string', default: gameIds.join() } } })
const MAX_PUZZLES = Number(values['max-puzzles'])
const games = new Set(values.games.split(','))
const MIN_KNOWN = 4 // plan 1.3: every Oddly Specific round has at least 4 known answers
const MAX_KNOWN = 8

const things = readJson<string[]>('factory/things.json', [])
const conditions = readJson<Record<string, ConditionEntry>>('factory/conditions.json', {})
const matrix = readJson<Matrix>('factory/matrix.json', {})
const agentWords = readJson<AgentWord[]>('factory/double-agent.json', [])
const blocklist = new Set(readJson<string[]>('factory/blocklist.json', []).map((word) => word.toLowerCase()))
const allowed = (answer: string) => !blocklist.has(answer.toLowerCase())

interface BuiltRound { id: string, conditions: PuzzleCondition[], library: LibraryRound }
const library: Library = { puzzles: {}, questions: {}, aliases: {} }
const built: Partial<Record<GameId, { rounds: BuiltRound[], path?: string[] }[]>> = {}
const count = (game: GameId) => built[game]?.length ?? 0
const add = (game: GameId, rounds: BuiltRound[], path?: string[]) => { (built[game] ??= []).push({ rounds, ...(path ? { path } : {}) }) }

function condition(id: string): PuzzleCondition {
  const entry = conditions[id]
  if (!entry) throw new Error(`Unknown condition ${id}.`)
  library.questions[id] = entry.question
  return { id, label: entry.label, negation: entry.negation, claim: entry.claim }
}

// A condition true of most things barely narrows a round.
const yesShare = (id: string) => things.filter((thing) => truth(matrix[thing]?.[id]) === 'yes').length / things.length
const broad = new Set(Object.keys(conditions).filter((id) => yesShare(id) > 0.5))
const broadCount = (ids: readonly string[]) => ids.filter((id) => broad.has(id)).length
const overlap = (a: readonly string[], b: readonly string[]) => a.filter((id) => b.includes(id)).length

// Oddly Specific: rounds with enough confirmed known answers, those with fewer
// broad conditions first, then the easiest (most solutions). Rounds in a puzzle
// share at most one condition, and neighbouring puzzles share none.
if (games.has('oddly-specific')) {
  const unused = oddlySpecificRounds(matrix, things, conditions as Conditions)
    .map((round) => ({ ...round, known: knownAnswers(matrix, round.solutions.filter(allowed), round.conditions) }))
    .filter((round) => round.known.length >= MIN_KNOWN && broadCount(round.conditions) <= 2)
    .sort((a, b) => broadCount(a.conditions) - broadCount(b.conditions) || b.solutions.length - a.solutions.length
      || a.conditions.join().localeCompare(b.conditions.join()))
  const perPuzzle = gameConfigs['oddly-specific'].rounds
  let previous: string[] = []
  while (count('oddly-specific') < MAX_PUZZLES) {
    const chosen: typeof unused = []
    for (const round of unused) {
      if (chosen.length === perPuzzle) break
      if (overlap(previous, round.conditions) > 0) continue
      if (chosen.every((other) => overlap(other.conditions, round.conditions) <= 1)) chosen.push(round)
    }
    if (chosen.length < perPuzzle) break
    for (const round of chosen) unused.splice(unused.indexOf(round), 1)
    previous = chosen.flatMap((round) => round.conditions)
    add('oddly-specific', chosen.map((round, i) => ({
      id: `r${String(i + 1)}`,
      conditions: round.conditions.map(condition),
      library: { conditions: round.conditions, known: round.known, example: round.known[0] ?? '' },
    })))
  }
}

// Category Escape: runs whose every level has a distinct path answer both models
// confirm. A bigger final field is easier, so those come first.
if (games.has('category-escape')) {
  const categories = Object.keys(conditions).filter((id) => conditions[id]?.category)
  const minCategory = Math.ceil(things.length * 0.15) // plan 3.9: 60 of ~400 things
  const next = seeded(20261030)
  const seen = new Set<string>()
  const runs: { levels: string[][], path: string[], known: string[][], field: number }[] = []
  for (let attempt = 0; attempt < 50 * MAX_PUZZLES && categories.length > 0 && runs.length < MAX_PUZZLES; attempt++) {
    const category = categories[attempt % categories.length] ?? ''
    const run = categoryEscapeRun(matrix, things, conditions, category, next, { minCategory, minFinal: 3 })
    const key = run?.levels.at(-1)?.join()
    if (!run || !key || seen.has(key)) continue
    seen.add(key)
    const path: string[] = []
    const known: string[][] = []
    for (const ids of run.levels) {
      const fitting = things.filter((thing) => allowed(thing) && confirmed(matrix, thing, ids))
      const pick = fitting.find((thing) => !path.includes(thing))
      if (!pick) break
      path.push(pick)
      known.push([pick, ...fitting.filter((thing) => thing !== pick)].slice(0, MAX_KNOWN))
    }
    if (path.length === run.levels.length) runs.push({ levels: run.levels, path, known, field: run.fieldSizes.at(-1) ?? 0 })
  }
  runs.sort((a, b) => b.field - a.field)
  for (const run of runs) {
    add('category-escape', run.levels.map((ids, level) => ({
      id: `L${String(level + 1)}`,
      conditions: ids.map(condition),
      library: { conditions: ids, known: run.known[level] ?? [], example: run.path[level] ?? '' },
    })), run.path)
  }
}

// Double Agent: one word per round, never reused, in list order (easiest first).
// Clue IDs are opaque so the public files don't give the word away.
if (games.has('double-agent')) {
  const perPuzzle = gameConfigs['double-agent'].rounds
  const words = agentWords.filter(({ word }) => allowed(word))
  for (let start = 0; start + perPuzzle <= words.length && count('double-agent') < MAX_PUZZLES; start += perPuzzle) {
    const n = count('double-agent') + 1
    add('double-agent', words.slice(start, start + perPuzzle).map(({ word, clues }, i) => {
      const id = `r${String(i + 1)}`
      const ids = clues.map((clue, side) => {
        const clueId = `clue:${String(n)}-${id}-${side === 0 ? 'a' : 'b'}`
        library.questions[clueId] = clueQuestion(clue)
        return clueId
      })
      return {
        id,
        conditions: clues.map((clue, side) => ({ id: ids[side] ?? '', label: clue, negation: "doesn't mean that", claim: clueClaim(clue) })),
        library: { conditions: ids, known: [word], example: word },
      }
    }))
  }
}

// Number each game's puzzles easy to hard in build order, then write everything.
const difficultyOf = (index: number, total: number) => (index < total / 3 ? 'easy' : index < (2 * total) / 3 ? 'medium' : 'hard')
const files: Puzzle[] = []
for (const [game, puzzles] of Object.entries(built) as [GameId, NonNullable<(typeof built)[GameId]>][]) {
  const lib = (library.puzzles[game] ??= {})
  puzzles.forEach(({ rounds, path }, i) => {
    for (const { library: round } of rounds) {
      for (const answer of round.known) {
        if (normalizeAnswer(answer, game) !== answer) throw new Error(`Known answer "${answer}" changes under normalization.`)
      }
    }
    lib[String(i + 1)] = { rounds: Object.fromEntries(rounds.map((round) => [round.id, round.library])), ...(path ? { path } : {}) }
    files.push(puzzleSchema.parse({
      game, n: i + 1, difficulty: difficultyOf(i, puzzles.length),
      rounds: rounds.map(({ id, conditions: c }) => ({ id, conditions: c })),
    }))
  })
  mkdirSync(`public/puzzles/${game}`, { recursive: true })
}

for (const file of files) writeJson(`public/puzzles/${file.game}/${String(file.n)}.json`, file)
writeJson('public/puzzles/index.json', puzzleIndexSchema.parse(Object.fromEntries(Object.keys(built).map((game) => [
  game, files.filter((file) => file.game === game).map(({ n, difficulty }) => ({ n, difficulty })),
]))))
writeJson('worker/library/library.json', librarySchema.parse(library))
console.log(Object.keys(built).map((game) => `${game}: ${String(count(game as GameId))}`).join(', '))
