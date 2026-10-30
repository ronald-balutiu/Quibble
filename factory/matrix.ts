// Truth matrix cells and the factory's shared helpers (plan 3.9, step 1; D-68).
// factory/run.ts fills the matrix.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { restRunner } from './workers-ai'

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
