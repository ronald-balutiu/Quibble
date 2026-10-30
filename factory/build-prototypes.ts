// Phase 2 prototypes for Category Escape and Double Agent, to exercise those
// generators (plan 4.1). Writes factory/reports/prototype-puzzles.json; nothing is
// shipped, since only Oddly Specific is playable in Phase 2. Gemma 4 confirms
// every answer as the second model (D-68), within --max-neurons.
// Usage: npm run ts -- factory/build-prototypes.ts [--max-neurons 600]
import { parseArgs } from 'node:util'
import { clueQuestion } from '@shared/clues'
import { judgeWithGemma } from '../worker/judge'
import { categoryEscapeRun, confirmed, seeded, unconfirmedCells, type Conditions } from './generators/rounds'
import { budgetedRunner, readJson, truth, writeJson, type Matrix } from './matrix'

const { values } = parseArgs({ options: { 'max-neurons': { type: 'string', default: '600' } } })
const budget = budgetedRunner(Number(values['max-neurons']))
const TARGET = 10
const CONFIRMED = 0.8
const MAX_KNOWN = 8

const things = readJson<string[]>('factory/things.json', [])
const conditions = readJson<Conditions & Record<string, { question: string }>>('factory/conditions.json', {})
const matrix = readJson<Matrix>('factory/matrix.json', {})

async function confirmCells(thing: string, ids: readonly string[]) {
  const missing = unconfirmedCells(matrix, thing, ids)
  if (missing.length === 0 || budget.exhausted) return
  const verdict = await judgeWithGemma(budget.ai, thing, missing.map((id) => ({ id, question: conditions[id]?.question ?? '' })))
  if (!verdict.ok) return
  for (const [id, p] of Object.entries(verdict.scores)) {
    const cell = matrix[thing]?.[id]
    if (cell) cell.gemma = p
  }
}

const fits = (thing: string, ids: readonly string[]) => ids.every((id) => truth(matrix[thing]?.[id]) === 'yes')

// Category Escape: a run is kept when every level has a distinct answer both models confirm.
const categories = Object.keys(conditions).filter((id) => conditions[id]?.category)
const minCategory = Math.ceil(things.length * 0.1)
const next = seeded(20261030)
const seen = new Set<string>()
const escape: { levels: string[][], path: string[], known: string[][] }[] = []
for (let attempt = 0; attempt < 400 && escape.length < TARGET && !budget.exhausted; attempt++) {
  const category = categories[attempt % categories.length] ?? ''
  const run = categoryEscapeRun(matrix, things, conditions, category, next, { minCategory, minFinal: 3 })
  const key = run?.levels.at(-1)?.join(' ')
  if (!run || !key || seen.has(key)) continue
  seen.add(key)
  const path: string[] = []
  const known: string[][] = []
  for (const ids of run.levels) {
    const candidates = things.filter((thing) => fits(thing, ids)).slice(0, 10)
    for (const thing of candidates) await confirmCells(thing, ids)
    const confirmedHere = candidates.filter((thing) => confirmed(matrix, thing, ids))
    const pick = confirmedHere.find((thing) => !path.includes(thing))
    if (!pick) break
    path.push(pick)
    known.push(confirmedHere.slice(0, MAX_KNOWN))
  }
  if (path.length === run.levels.length) escape.push({ levels: run.levels, path, known })
}

// Double Agent: valid words whose two clues Gemma 4 also confirms, three per puzzle.
const report = readJson<{ results: { word: string, ok: boolean, clues: { clue: string }[] }[] }>('factory/reports/prototype-double-agent-rewritten.json', { results: [] })
const agentWords: { word: string, clues: string[] }[] = []
for (const result of report.results.filter((r) => r.ok)) {
  if (budget.exhausted) break
  const verdict = await judgeWithGemma(budget.ai, result.word, result.clues.map((clue, i) => ({ id: `c${String(i)}`, question: clueQuestion(clue.clue) })))
  if (verdict.ok && Object.values(verdict.scores).every((p) => p >= CONFIRMED)) agentWords.push({ word: result.word, clues: result.clues.map((clue) => clue.clue) })
}
const agent = Array.from({ length: Math.min(TARGET, Math.floor(agentWords.length / 3)) }, (_, i) => agentWords.slice(i * 3, i * 3 + 3))

writeJson('factory/matrix.json', matrix)
budget.record('prototype-puzzles', 'gemma-4')
writeJson('factory/reports/prototype-puzzles.json', {
  categoryEscape: { minCategory, puzzles: escape },
  doubleAgent: { confirmedWords: agentWords.length, of: report.results.filter((r) => r.ok).length, puzzles: agent },
})
console.log(`Category Escape: ${String(escape.length)} prototype runs. Double Agent: ${String(agentWords.length)} words confirmed by both models, ${String(agent.length)} puzzles.`)
