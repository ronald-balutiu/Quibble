// Judge decision settings. Phase 1 tunes these on the answer-key development set.
export const judgeConfig = {
  passThreshold: 0.5,
  closeCall: { min: 0.35, max: 0.65 },
} as const

export function passes(p: number): boolean {
  return p >= judgeConfig.passThreshold
}

export function isCloseCall(p: number): boolean {
  return p >= judgeConfig.closeCall.min && p <= judgeConfig.closeCall.max
}
