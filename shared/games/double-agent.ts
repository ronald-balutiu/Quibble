export type DoubleAgentRounds = 3 | 5

export const doubleAgentConfig = {
  id: 'double-agent',
  // The yield report may change the default; consumers must handle either count.
  rounds: 5 as DoubleAgentRounds,
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
