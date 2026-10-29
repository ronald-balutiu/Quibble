// Phase 1 generator prototype for Oddly Specific and Category Escape on the
// ingredient sample. With --confirm, Gemma 4 scores the cells that sampled known
// answers depend on (capped by --max-neurons), so both models confirm them.
// Usage: npm run ts -- factory/prototype.ts [--sample 20] [--confirm --max-neurons 900]
import { parseArgs } from 'node:util'
import { judgeWithGemma } from '../worker/judge'
import { budgetedRunner, readJson, writeJson, type Matrix } from './matrix'
import {
  categoryEscapeRun, knownAnswers, oddlySpecificRounds, seeded, shuffled, unconfirmedCells,
  type CategoryEscapeRun, type Conditions,
} from './generators/rounds'

const { values } = parseArgs({ options: { confirm: { type: 'boolean', default: false }, sample: { type: 'string', default: '20' }, 'max-neurons': { type: 'string', default: '900' } } })

const things = readJson<string[]>('factory/things.json', [])
const conditions = readJson<Conditions & Record<string, { question: string }>>('factory/conditions.json', {})
const matrix = readJson<Matrix>('factory/matrix.json', {})
const SAMPLE_ROUNDS = Number(values.sample)
const next = seeded(20261029)

// The plan's thresholds assume ~400 things; scale the category size to the sample.
const minCategory = Math.ceil(things.length * (60 / 400))
const minFinal = 3

const osRounds = oddlySpecificRounds(matrix, things, conditions)
const osSample = shuffled(osRounds, next).slice(0, SAMPLE_ROUNDS)

const ceRuns: (CategoryEscapeRun & { category: string })[] = []
const categories = Object.keys(conditions).filter((id) => conditions[id]?.category)
for (const category of categories) {
  const seen = new Set<string>()
  for (let attempt = 0; attempt < 40; attempt++) {
    const run = categoryEscapeRun(matrix, things, conditions, category, next, { minCategory, minFinal })
    const key = run?.levels.at(-1)?.join(' ')
    if (run && key && !seen.has(key)) { seen.add(key); ceRuns.push({ category, ...run }) }
  }
}

// Every known-answer candidate's cells, for the Clef confirmation step.
const needs = new Map<string, Set<string>>()
const want = (thing: string, ids: readonly string[]) => {
  for (const id of unconfirmedCells(matrix, thing, ids)) (needs.get(thing) ?? needs.set(thing, new Set()).get(thing))?.add(id)
}
for (const round of osSample) for (const thing of round.solutions.slice(0, 12)) want(thing, round.conditions)
const ceSample = ceRuns.slice(0, 10)
for (const run of ceSample) run.levels.forEach((ids, level) => { want(run.path[level] ?? '', ids) })

if (values.confirm) {
  const budget = budgetedRunner(Number(values['max-neurons']))
  for (const [thing, ids] of needs) {
    if (budget.exhausted) break
    const verdict = await judgeWithGemma(budget.ai, thing, [...ids].map((id) => ({ id, question: conditions[id]?.question ?? '' })))
    if (!verdict.ok) { console.error(`gemma-4 could not confirm "${thing}".`); continue }
    for (const [id, p] of Object.entries(verdict.scores)) {
      const cell = matrix[thing]?.[id]
      if (cell) cell.gemma = p
    }
    needs.delete(thing)
    writeJson('factory/matrix.json', matrix)
  }
  console.log(`confirm: ${budget.spent.toFixed(1)} Neurons; ${String(needs.size)} things still unconfirmed`)
  budget.record('confirm', 'gemma-4')
}

const osResults = osSample.map((round) => ({ ...round, known: knownAnswers(matrix, round.solutions, round.conditions) }))
const ceResults = ceSample.map((run) => ({
  ...run,
  pathConfirmed: run.path.every((thing, level) => knownAnswers(matrix, [thing], run.levels[level] ?? []).length === 1),
  knownPerLevel: run.levels.map((ids) => knownAnswers(matrix, things.filter((thing) => ids.every((id) => matrix[thing]?.[id])), ids).length),
}))

const summary = {
  sample: { things: things.length, conditions: Object.keys(conditions).length, cells: Object.values(matrix).reduce((n, row) => n + Object.keys(row).length, 0) },
  oddlySpecific: {
    candidateRounds: osRounds.length,
    sampled: osResults.length,
    withFourKnown: osResults.filter((round) => round.known.length >= 4).length,
    solutions: osRounds.map((round) => round.solutions.length).sort((a, b) => a - b),
    examples: osResults.slice(0, 5),
  },
  categoryEscape: {
    minCategory, categories: categories.map((id) => ({ id, size: things.filter((thing) => matrix[thing]?.[id] && (matrix[thing][id].clef ?? matrix[thing][id].flash) >= 0.8).length })),
    distinctRuns: ceRuns.length,
    sampled: ceResults.length,
    pathConfirmed: ceResults.filter((run) => run.pathConfirmed).length,
    examples: ceResults.slice(0, 3),
  },
  unconfirmedThings: needs.size,
}
writeJson('factory/reports/prototype-rounds.json', summary)
console.log(JSON.stringify({ ...summary, oddlySpecific: { ...summary.oddlySpecific, solutions: undefined, examples: undefined }, categoryEscape: { ...summary.categoryEscape, examples: undefined } }, null, 1))
