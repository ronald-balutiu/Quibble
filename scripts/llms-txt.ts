import { gameIds, type GameId } from '../shared/games/index.ts'
import type { EvalResults } from '../shared/schemas/eval-results.ts'
import { SITE_ORIGIN } from '../shared/site.ts'
import { libraryPath } from '../src/lib/paths.ts'
import { en } from '../src/copy/en.ts'

// /llms.txt (llmstxt.org): a short Markdown guide to the site for AI tools, built
// from the app's copy, the puzzle index and the published answer-key results, so its
// facts match the pages.

const percent = (value: number | undefined) => `${((value ?? 0) * 100).toFixed(1)}%`

export function llmsTxt(counts: Record<GameId, number>, results: EvalResults): string {
  const { judges, cases } = results.test
  const games = gameIds
    .map(
      (game) =>
        `- [${en[`game.name.${game}`]}](${SITE_ORIGIN}${libraryPath(game)}): ${en[`game.tagline.${game}`]} ${String(counts[game])} puzzles.`,
    )
    .join('\n')
  return `# ${en['app.name']}

> ${en['about.lede']} Any answer that fits the rules counts: AI judges decide each guess, and players can overrule them.

${en['app.name']} is three free web games by Ronald Balutiu: no accounts, no ads, nothing to install. Progress stays in the player's browser.

## Games

${games}

## How judging works

- Each guess is checked rule by rule. The cloud judge is Clef-flash by default, or Gemma 4, both on Cloudflare Workers AI.
- An optional local judge, Qwen3.5-0.8B, runs in the player's browser on WebGPU and checks the same guess.
- A player who thinks a judge got it wrong can choose "Count it anyway" and keep the try. With both judges on, the site keeps a private tally of where they split and which one the player overrules.

## How the judges were tested

- Before launch, every judge ruled on the same sealed test of ${String(cases)} guesses from all three games, each with a known right answer. It ran once, on the final setup, after tuning on a separate practice set.
- Right calls on whole guesses: Gemma 4 ${percent(judges['gemma-4']?.wholeGuess.value)}, Clef-flash ${percent(judges['clef-flash']?.wholeGuess.value)}, Qwen3.5-0.8B ${percent(judges.device?.wholeGuess.value)}, against a target of ${percent(results.target.wholeGuess)}.
- Every judge leans strict: each turned down good answers more often than it let wrong ones through.

## Pages

- [Home](${SITE_ORIGIN}/): the three games, how scoring works, and how the judges compare.
- [Library](${SITE_ORIGIN}${libraryPath()}): every puzzle, easy to hard.
- [About](${SITE_ORIGIN}/about): how to play, how the judges were tested, how the puzzles were made, and privacy.
- [Source code](https://github.com/ronald-balutiu/Quibble)
`
}
