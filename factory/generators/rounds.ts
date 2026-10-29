// Oddly Specific and Category Escape generators (plan 3.9, step 2). Pure and
// deterministic: the same matrix and seed always produce the same rounds.
import { truth, type Matrix } from '../matrix'

export interface ConditionInfo { tag: string, category?: boolean }
export type Conditions = Record<string, ConditionInfo>

const MAX_KNOWN = 8
const CONFIRMED = 0.8

export function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

export function shuffled<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j] as T, copy[i] as T]
  }
  return copy
}

const fits = (matrix: Matrix, thing: string, ids: readonly string[]) => ids.every((id) => truth(matrix[thing]?.[id]) === 'yes')

// A known answer needs Clef to agree on every cell, so both models confirm it.
export const confirmed = (matrix: Matrix, thing: string, ids: readonly string[]) =>
  ids.every((id) => (matrix[thing]?.[id]?.clef ?? 0) >= CONFIRMED)

// Cells Clef still has to score before a candidate can become a known answer.
export function unconfirmedCells(matrix: Matrix, thing: string, ids: readonly string[]) {
  return ids.filter((id) => matrix[thing]?.[id]?.clef === undefined)
}

export interface OddlySpecificRound { conditions: string[], solutions: string[] }

// Three conditions with different tags, 4–40 solutions, and no redundant condition:
// each one must rule out something the other two allow.
export function oddlySpecificRounds(matrix: Matrix, things: readonly string[], conditions: Conditions): OddlySpecificRound[] {
  const ids = Object.keys(conditions).filter((id) => !conditions[id]?.category)
  const rounds: OddlySpecificRound[] = []
  for (let a = 0; a < ids.length; a++) {
    for (let b = a + 1; b < ids.length; b++) {
      for (let c = b + 1; c < ids.length; c++) {
        const round = [ids[a], ids[b], ids[c]] as string[]
        if (new Set(round.map((id) => conditions[id]?.tag)).size < 3) continue
        const solutions = things.filter((thing) => fits(matrix, thing, round))
        if (solutions.length < 4 || solutions.length > 40) continue
        const redundant = round.some((id) => {
          const others = round.filter((other) => other !== id)
          return !things.some((thing) => fits(matrix, thing, others) && truth(matrix[thing]?.[id]) === 'no')
        })
        if (!redundant) rounds.push({ conditions: round, solutions })
      }
    }
  }
  return rounds
}

export function knownAnswers(matrix: Matrix, solutions: readonly string[], ids: readonly string[]) {
  return solutions.filter((thing) => confirmed(matrix, thing, ids)).slice(0, MAX_KNOWN)
}

export interface CategoryEscapeRun { levels: string[][], path: string[], fieldSizes: number[] }

// A category, then five restrictions that each narrow the field and leave at least
// minFinal things at level 6, with a distinct confirmed-or-candidate path answer per level.
export function categoryEscapeRun(
  matrix: Matrix, things: readonly string[], conditions: Conditions, category: string,
  next: () => number, { minCategory, minFinal }: { minCategory: number, minFinal: number },
): CategoryEscapeRun | undefined {
  let field = things.filter((thing) => fits(matrix, thing, [category]))
  if (field.length < minCategory) return undefined
  const inForce = [category]
  const fieldSizes = [field.length]
  const restrictions = shuffled(Object.keys(conditions).filter((id) => !conditions[id]?.category), next)
  for (const id of restrictions) {
    if (inForce.length === 6) break
    const narrowed = field.filter((thing) => fits(matrix, thing, [...inForce, id]))
    if (narrowed.length < field.length && narrowed.length >= minFinal) {
      inForce.push(id)
      field = narrowed
      fieldSizes.push(field.length)
    }
  }
  if (inForce.length < 6) return undefined

  const levels = inForce.map((_, i) => inForce.slice(0, i + 1))
  const path: string[] = []
  for (let level = 5; level >= 0; level--) {
    const options = things.filter((thing) => !path.includes(thing) && fits(matrix, thing, levels[level] ?? []))
    const pick = shuffled(options, next)[0]
    if (pick === undefined) return undefined
    path.unshift(pick)
  }
  return { levels, path, fieldSizes }
}
