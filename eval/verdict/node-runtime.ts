// Loads the on-device judge in Node with onnxruntime-node, for parity and eval runs.
import { readFileSync } from 'node:fs'
import { Tokenizer } from '@huggingface/tokenizers'
import * as ort from 'onnxruntime-node'
import { deviceModel, scoreClaim, tensorFactory, type TensorFactory } from '@/judges/device/verdict'

const modelDir = 'eval/verdict/model'
const readJson = (path: string): object => JSON.parse(readFileSync(path, 'utf8')) as object

// onnxruntime-node cannot read Node's native Float16Array, which onnxruntime-common
// substitutes for Uint16Array data. Hand it the raw bits, as Transformers.js does.
// Remove once onnxruntime-node accepts Float16Array input.
const ortTensor = tensorFactory(ort.Tensor)
const makeTensor: TensorFactory = (type, data, dims) => {
  const tensor = ortTensor(type, data, dims) as ort.Tensor & { cpuData?: unknown }
  if (type === 'float16') tensor.cpuData = data
  return tensor
}

export const nodeRuntime = `onnxruntime-node ${ort.env.versions.node ?? ''} (CPU)`

export async function loadDeviceJudge(): Promise<(answer: string, claim: string) => Promise<number>> {
  const tokenizer = new Tokenizer(readJson(`${modelDir}/tokenizer.json`), readJson(`${modelDir}/tokenizer_config.json`))
  const session = await ort.InferenceSession.create(`${modelDir}/${deviceModel.file}`, { executionProviders: ['cpu'] })
  return (answer, claim) => scoreClaim(session, makeTensor, tokenizer, answer, claim)
}
