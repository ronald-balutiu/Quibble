// Checks the built library against its guarantees (plan 3.9, step 4); CI runs it.
// Usage: npm run check-puzzles
import { readdirSync, readFileSync } from 'node:fs'
import { puzzleIndexSchema, puzzleSchema } from '@shared/schemas/puzzle'
import { librarySchema } from '../worker/library'
import { readJson } from './matrix'
import { checkPuzzles } from './puzzle-checks'

const read = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))
const index = puzzleIndexSchema.parse(read('public/puzzles/index.json'))
const files = readdirSync('public/puzzles', { withFileTypes: true }).filter((entry) => entry.isDirectory()).flatMap((dir) =>
  readdirSync(`public/puzzles/${dir.name}`).filter((name) => name.endsWith('.json')).map((name) => {
    const file = puzzleSchema.parse(read(`public/puzzles/${dir.name}/${name}`))
    if (file.game !== dir.name || `${String(file.n)}.json` !== name) throw new Error(`public/puzzles/${dir.name}/${name} holds ${file.game} ${String(file.n)}.`)
    return file
  }))
const library = librarySchema.parse(read('worker/library/library.json'))

const errors = checkPuzzles({ index, files, library, blocklist: readJson<string[]>('factory/blocklist.json', []) })
for (const error of errors) console.error(error)
if (errors.length > 0) process.exit(1)
console.log(`Puzzles OK: ${Object.entries(index).map(([game, entries]) => `${game} ${String(entries.length)}`).join(', ')}.`)
