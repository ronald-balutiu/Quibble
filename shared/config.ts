// Judge decision settings. Phase 1 tunes each judge's pass threshold on the
// answer-key development set: the judges' raw scores are not on the same scale,
// so the on-device judge gets its own (D-59).
export const judgeConfig = {
  cloud: { passThreshold: 0.5 },
  device: { passThreshold: 0.5 },
  closeCall: { min: 0.35, max: 0.65 },
} as const

export type JudgeKind = 'cloud' | 'device'

export function passes(p: number, threshold: number = judgeConfig.cloud.passThreshold): boolean {
  return p >= threshold
}

export function isCloseCall(p: number): boolean {
  return p >= judgeConfig.closeCall.min && p <= judgeConfig.closeCall.max
}
