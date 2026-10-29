export type DoubleAgentRounds = 3 | 5

export const doubleAgentConfig = {
  id: 'double-agent',
  // Set from the Phase 1 yield report (D-64); consumers must still handle either count.
  rounds: 3 as DoubleAgentRounds,
  conditionsPerRound: 2,
  maxWrongGuessesPerRound: 3,
  pointsByGuess: [3, 2, 1],
  input: {
    kind: 'single-word',
    maxCharacters: 40, // API envelope cap; the stricter letter limit also applies.
    maxLetters: 20,
    allowHyphens: true,
    allowApostrophes: true,
  },
} as const
