// Truth matrix (plan 3.9, step 1; D-68): Clef-flash answers every condition for
// every thing, then Gemma 4 re-checks the uncertain cells. Resumable; every request's
// Neurons go to factory/ledger.json, and a run stops at --max-neurons.
// Usage: npm run ts -- factory/matrix.ts [--max-neurons 1500]
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { judgeWithClef, judgeWithGemma } from '../worker/judge'
import { AllowanceExhausted, restRunner } from './workers-ai'

// clef holds re-checks made before D-68; gemma holds re-checks and confirmations since.
export interface Cell { flash: number, clef?: number, gemma?: number }
export type Matrix = Record<string, Record<string, Cell>>
export type Truth = 'yes' | 'no' | 'unknown'

// Clef-flash scores clear yes cases at 0.6–0.8, so 0.6 is its yes bar (D-68).
const UNCERTAIN = { low: 0.2, high: 0.6 }

// A cell is yes or no when Clef-flash is confident, or when a second model settles it.
export function truth(cell: Cell | undefined): Truth {
  if (!cell) return 'unknown'
  const p = cell.gemma ?? cell.clef ?? cell.flash
  if (p >= UNCERTAIN.high) return 'yes'
  if (p <= UNCERTAIN.low) return 'no'
  return 'unknown'
}

export const isUncertain = (cell: Cell) => cell.flash > UNCERTAIN.low && cell.flash < UNCERTAIN.high
  && cell.clef === undefined && cell.gemma === undefined

export const readJson = <T>(path: string, fallback: T): T => (existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as T : fallback)
export const writeJson = (path: string, value: unknown) => { writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`) }

export interface LedgerEntry { date: string, step: string, model: string, requests: number, neurons: number }

// Spends Neurons through one REST runner and records the total in the ledger.
export function budgetedRunner(maxNeurons: number) {
  let spent = 0 // since the last ledger entry
  let total = 0 // this run, for the cap
  let requests = 0
  const ai = restRunner((neurons) => { spent += neurons; total += neurons; requests += 1 })
  return {
    ai,
    get spent() { return spent },
    get exhausted() { return total >= maxNeurons },
    record(step: string, model: string) {
      if (requests === 0) return
      const ledger = readJson<LedgerEntry[]>('factory/ledger.json', [])
      ledger.push({ date: new Date().toISOString(), step, model, requests, neurons: Number(spent.toFixed(2)) })
      writeJson('factory/ledger.json', ledger)
      spent = 0
      requests = 0
    },
  }
}

if (import.meta.url === `file://${process.argv[1] ?? ''}`) {
  const { values } = parseArgs({ options: { 'max-neurons': { type: 'string', default: '1500' } } })
  const budget = budgetedRunner(Number(values['max-neurons']))
  const things = readJson<string[]>('factory/things.json', [])
  const conditions = readJson<Record<string, { question: string }>>('factory/conditions.json', {})
  const matrix = readJson<Matrix>('factory/matrix.json', {})
  const ids = Object.keys(conditions)

  const steps = [
    {
      step: 'matrix', model: 'clef-flash',
      judge: (thing: string, questions: { id: string, question: string }[]) => judgeWithClef(budget.ai, thing, questions, { model: 'clef-flash' }),
      questionsFor: (thing: string) => ids.filter((id) => matrix[thing]?.[id] === undefined),
      apply: (thing: string, scores: Record<string, number>) => {
        const row = matrix[thing] ??= {}
        for (const [id, p] of Object.entries(scores)) row[id] = { flash: p }
      },
    },
    {
      step: 'recheck', model: 'gemma-4',
      judge: (thing: string, questions: { id: string, question: string }[]) => judgeWithGemma(budget.ai, thing, questions),
      questionsFor: (thing: string) => ids.filter((id) => {
        const cell = matrix[thing]?.[id]
        return cell !== undefined && isUncertain(cell)
      }),
      apply: (thing: string, scores: Record<string, number>) => {
        for (const [id, p] of Object.entries(scores)) {
          const cell = matrix[thing]?.[id]
          if (cell) cell.gemma = p
        }
      },
    },
  ]

  try {
    for (const { step, model, judge, questionsFor, apply } of steps) {
      for (const thing of things) {
        if (budget.exhausted) break
        const pending = questionsFor(thing)
        if (pending.length === 0) continue
        const verdict = await judge(thing, pending.map((id) => ({ id, question: conditions[id]?.question ?? '' })))
        if (!verdict.ok) {
          if (verdict.error === 'resting') throw new AllowanceExhausted('The daily Workers AI allowance is used up.')
          console.error(`${model} could not judge "${thing}"; it will be retried on the next run.`)
          continue
        }
        apply(thing, verdict.scores)
        writeJson('factory/matrix.json', matrix)
      }
      console.log(`${step}: ${budget.spent.toFixed(1)} Neurons`)
      budget.record(step, model)
    }
  } catch (error) {
    budget.record('interrupted', 'mixed')
    throw error
  }

  const cells = Object.values(matrix).flatMap((row) => Object.values(row))
  const counts = { yes: 0, no: 0, unknown: 0 }
  for (const cell of cells) counts[truth(cell)] += 1
  console.log(`${String(cells.length)} cells: ${String(counts.yes)} yes, ${String(counts.no)} no, ${String(counts.unknown)} unknown${budget.exhausted ? ' (stopped at the Neuron cap; rerun to continue)' : ''}`)
}
