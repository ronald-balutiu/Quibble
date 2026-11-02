// Writes public/eval/results.json for the app (plan 3.10) from eval/history.json and
// eval/device-measurements.json. Calls no models. Usage: npm run eval:publish
import { readFileSync, writeFileSync } from 'node:fs'
import { evalHistorySchema } from '@shared/schemas/eval-history'
import { buildResults } from './results'

const history = evalHistorySchema.parse(JSON.parse(readFileSync('eval/history.json', 'utf8')))
const devices = JSON.parse(readFileSync('eval/device-measurements.json', 'utf8')) as unknown
const results = buildResults(history, devices)
writeFileSync('public/eval/results.json', `${JSON.stringify(results, null, 2)}\n`)
console.log(`public/eval/results.json: ${Object.keys(results.test.judges).join(', ')} on ${String(results.test.cases)} test cases; ${String(results.builds.length)} builds; ${String(results.devices.length)} device(s).`)
