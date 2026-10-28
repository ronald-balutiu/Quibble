// Shared by UI, Worker validation, and build-time tools. No platform APIs here.
export const oddlySpecificConfig = {
  id: 'oddly-specific',
  rounds: 5,
  conditionsPerRound: 3,
  maxWrongGuessesPerRound: 3,
  pointsByGuess: [3, 2, 1],
  input: {
    kind: 'noun-phrase',
    maxCharacters: 40,
  },
} as const
