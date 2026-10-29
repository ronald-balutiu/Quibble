// Double Agent clue wording, shared by the factory, the Worker and the eval.

export function clueQuestion(clue: string): string {
  return `Can the word ordinarily mean: ${clue}? Judge the word's everyday meanings.`
}

export function clueClaim(clue: string): string {
  return `The word "{answer}" can ordinarily mean: ${clue}.`
}
