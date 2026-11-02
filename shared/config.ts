// Judge decision settings, tuned on the answer-key development set (D-63).
// Each model's raw scores sit on its own scale, so each has its own pass
// threshold (D-59, D-62). Clef is the factory's re-check model, not a player choice.
export const judgeConfig = {
  passThreshold: {
    'clef-flash': 0.4,
    'gemma-4': 0.5,
    clef: 0.5,
    device: 0.7,
  },
  // A score this close to its judge's threshold is labelled "Close call".
  closeCallMargin: 0.15,
} as const

export function passes(p: number, threshold: number): boolean {
  return p >= threshold
}

export function isCloseCall(p: number, threshold: number): boolean {
  // The epsilon keeps a score exactly on the edge (e.g. 0.25 for 0.4) inside the band.
  return Math.abs(p - threshold) <= judgeConfig.closeCallMargin + 1e-9
}
