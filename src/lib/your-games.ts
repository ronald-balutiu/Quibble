import type { Comparison } from '@/lib/storage/comparisons'

// "Your games" (1.7, 5.5 H3): agreement between the two judges on this player's own
// guesses. Agreement isn't correctness: only the answer key says who's right.

export interface YourGames {
  guesses: number
  agreedGuesses: number
  conditions: number
  agreedConditions: number
  // Conditions where only one judge said no.
  splits: number
  cloudStricter: number
  deviceStricter: number
  overruled: { cloud: number, device: number }
  // Warm runs only, so model start-up doesn't count (3.8).
  cloudMedianMs: number | undefined
  deviceMedianMs: number | undefined
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

export function yourGames(records: readonly Comparison[]): YourGames {
  const verdicts = records.map((record) => Object.values(record.conditions))
  const all = verdicts.flat()
  const warm = records.filter((record) => record.warm)
  return {
    guesses: records.length,
    agreedGuesses: verdicts.filter((conditions) => conditions.every(({ cloudPass, devicePass }) => cloudPass === devicePass)).length,
    conditions: all.length,
    agreedConditions: all.filter(({ cloudPass, devicePass }) => cloudPass === devicePass).length,
    splits: all.filter(({ cloudPass, devicePass }) => cloudPass !== devicePass).length,
    cloudStricter: all.filter(({ cloudPass, devicePass }) => !cloudPass && devicePass).length,
    deviceStricter: all.filter(({ cloudPass, devicePass }) => cloudPass && !devicePass).length,
    overruled: {
      cloud: records.filter((record) => record.overruled && record.referee === 'cloud').length,
      device: records.filter((record) => record.overruled && record.referee === 'device').length,
    },
    cloudMedianMs: median(warm.map((record) => record.cloudModelMs)),
    deviceMedianMs: median(warm.map((record) => record.deviceMs)),
  }
}

// One puzzle's comparisons on its results screen (5.5 G6): the guesses of this run
// that both judges answered, and the conditions where they split.
export function puzzleComparisons(records: readonly Comparison[], game: Comparison['game'], n: number, answers: ReadonlySet<string>) {
  const mine = records.filter((record) => record.game === game && record.n === n && answers.has(`${record.round}:${record.answer}`))
  // A guess judged twice (a Retry) counts once: its latest record.
  const latest = [...new Map(mine.map((record) => [`${record.round}:${record.answer}`, record])).values()]
  return {
    compared: latest.length,
    agreed: latest.filter((record) => Object.values(record.conditions).every(({ cloudPass, devicePass }) => cloudPass === devicePass)).length,
    splits: latest.flatMap((record) => Object.entries(record.conditions)
      .filter(([, { cloudPass, devicePass }]) => cloudPass !== devicePass)
      .map(([condition, { cloud, device }]) => ({ record, condition, cloud, device }))),
  }
}
