// Writes factory/preview.html, the spot-check page (plan 3.9, step 3): 10 random
// puzzles per game with their conditions, known answers and path, to read before
// logging problems in factory/reports/spot-check.md.
// Usage: npm run ts -- factory/preview.ts [--per-game 10] [--seed 1]
import { readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { puzzleIndexSchema, puzzleSchema } from '@shared/schemas/puzzle'
import { librarySchema } from '../worker/library'
import { seeded, shuffled } from './generators/rounds'

const { values } = parseArgs({ options: { 'per-game': { type: 'string', default: '10' }, seed: { type: 'string', default: String(Date.now()) } } })
const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
const index = puzzleIndexSchema.parse(read('public/puzzles/index.json'))
const library = librarySchema.parse(read('worker/library/library.json'))
const next = seeded(Number(values.seed))
const escape = (text: string) => text.replace(/[&<>"]/gu, (c) => `&#${String(c.charCodeAt(0))};`)

const sections = Object.entries(index).map(([game, entries]) => {
  const sample = shuffled(entries, next).slice(0, Number(values['per-game'])).sort((a, b) => a.n - b.n)
  const puzzles = sample.map(({ n, difficulty }) => {
    const file = puzzleSchema.parse(read(`public/puzzles/${game}/${String(n)}.json`))
    const stored = library.puzzles[file.game]?.[String(n)]
    const rounds = file.rounds.map((round, i) => {
      const lib = stored?.rounds[round.id]
      const path = stored?.path?.[i]
      return `<tr><th>${round.id}</th><td>${round.conditions.map(({ label }) => escape(label)).join('<br>')}</td>`
        + `<td>${(lib?.known ?? []).map((answer) => (answer === lib?.example ? `<b>${escape(answer)}</b>` : escape(answer))).join(', ')}</td>`
        + `<td>${path ? escape(path) : ''}</td></tr>`
    }).join('')
    return `<article><h3>${escape(game)} ${String(n)} <small>${difficulty}</small></h3>`
      + `<table><thead><tr><th></th><th>Conditions</th><th>Known (example in bold)</th><th>Path</th></tr></thead><tbody>${rounds}</tbody></table></article>`
  }).join('')
  return `<section><h2>${escape(game)} (${String(sample.length)} of ${String(entries.length)})</h2>${puzzles}</section>`
}).join('')

writeFileSync('factory/preview.html', `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Puzzle spot-check</title>
<style>
body { font: 15px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 960px; padding: 16px; color: #1a1a1a; background: #fafafa; }
@media (prefers-color-scheme: dark) { body { color: #eee; background: #141414; } th, td { border-color: #333 !important; } }
article { margin: 0 0 24px; } table { border-collapse: collapse; width: 100%; } th, td { border-bottom: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
small { font-weight: normal; opacity: 0.6; }
</style></head><body>
<h1>Puzzle spot-check</h1>
<p>Seed ${escape(values.seed)}. Log any problem in factory/reports/spot-check.md. More than 1 in 10 per game means fixing the cause and drawing a new sample (plan 3.9).</p>
${sections}
</body></html>
`)
console.log(`Wrote factory/preview.html (seed ${values.seed}).`)
