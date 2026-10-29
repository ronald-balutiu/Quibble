// Builds tests/fixtures/verdict/parity.json: Node scores from the shared adapter,
// compared with the Python reference and any browser runs passed as arguments.
// Usage: npm run ts -- eval/verdict/parity.ts [browser-results.json ...]
import { readFileSync, writeFileSync } from 'node:fs'
import { Tokenizer } from '@huggingface/tokenizers'
import * as ort from 'onnxruntime-node'
import { deviceModel, scoreClaim, tensorFactory, type TensorFactory } from '@/judges/device/verdict'

interface ParityCase { id: string, answer: string, claim: string }
interface RuntimeResults { runtime: string, results: { id: string, p: number }[] }

// onnxruntime-node cannot read Node's native Float16Array, which onnxruntime-common
// substitutes for Uint16Array data. Hand it the raw bits, as Transformers.js does.
// Remove once onnxruntime-node accepts Float16Array input.
const ortTensor = tensorFactory(ort.Tensor)
const makeTensor: TensorFactory = (type, data, dims) => {
  const tensor = ortTensor(type, data, dims) as ort.Tensor & { cpuData?: unknown }
  if (type === 'float16') tensor.cpuData = data
  return tensor
}

const MAX_DELTA = 0.02
const THRESHOLD = 0.5
const modelDir = 'eval/verdict/model'
const fixtures = 'tests/fixtures/verdict'
const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8'))

const cases = readJson(`${fixtures}/cases.json`) as ParityCase[]
const reference = readJson(`${fixtures}/python-reference.json`) as RuntimeResults & { model: typeof deviceModel }
if (reference.model.revision !== deviceModel.revision || reference.model.file !== deviceModel.file) {
  throw new Error('python-reference.json was generated from a different model; rerun eval/verdict/reference.py.')
}

const tokenizer = new Tokenizer(readJson(`${modelDir}/tokenizer.json`) as object, readJson(`${modelDir}/tokenizer_config.json`) as object)
const session = await ort.InferenceSession.create(`${modelDir}/${deviceModel.file}`, { executionProviders: ['cpu'] })
const node: RuntimeResults = { runtime: `onnxruntime-node ${ort.env.versions.node ?? ''} (CPU)`, results: [] }
for (const { id, answer, claim } of cases) {
  node.results.push({ id, p: await scoreClaim(session, makeTensor, tokenizer, answer, claim) })
}

const runtimes = [node, ...process.argv.slice(2).map((path) => readJson(path) as RuntimeResults)]
const rows = cases.map(({ id }) => {
  const p = reference.results.find((result) => result.id === id)?.p
  if (p === undefined) throw new Error(`No Python reference score for ${id}.`)
  const deltas = Object.fromEntries(runtimes.map(({ runtime, results }) => {
    const other = results.find((result) => result.id === id)?.p
    if (other === undefined) throw new Error(`No ${runtime} score for ${id}.`)
    return [runtime, Number((other - p).toFixed(6))]
  }))
  return { id, python: p, deltas, nearThreshold: Math.abs(p - THRESHOLD) <= 2 * MAX_DELTA }
})
const maxDelta = Math.max(...rows.flatMap((row) => Object.values(row.deltas).map(Math.abs)))

const parity = {
  model: deviceModel,
  reference: reference.runtime,
  runtimes: runtimes.map(({ runtime }) => runtime),
  maxAllowedDelta: MAX_DELTA,
  maxDelta,
  pass: maxDelta <= MAX_DELTA,
  rows,
}
writeFileSync(`${fixtures}/parity.json`, `${JSON.stringify(parity, null, 2)}\n`)
console.log(`max |ΔP| ${maxDelta.toFixed(6)} across ${runtimes.map(({ runtime }) => runtime).join(', ')}: ${parity.pass ? 'pass' : 'FAIL'}`)
