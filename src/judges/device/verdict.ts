import type { InferenceSession, Tensor } from 'onnxruntime-common'
import type { Tokenizer } from '@huggingface/tokenizers'

// On-device judge adapter (D-55), shared by the browser and Node eval scripts.
// eval/verdict/reference.py is the canonical Python copy; keep the two identical.

export const deviceModel = {
  repo: 'onnx-community/Qwen3.5-0.8B-Text-ONNX',
  revision: '25cdf33f386b487a25f3d743e86442517bdb77ff',
  file: 'onnx/model_q4.onnx',
} as const

// Everything the browser downloads, with sizes at the pinned revision. The sizes
// are exact, so each download fills one preallocated buffer (3.6).
export const deviceFiles = [
  { path: 'tokenizer_config.json', bytes: 10_027 },
  { path: 'tokenizer.json', bytes: 19_226_111 },
  { path: 'onnx/model_q4.onnx', bytes: 482_783 },
  { path: 'onnx/model_q4.onnx_data', bytes: 550_764_544 },
] as const
export type DeviceFile = (typeof deviceFiles)[number]

export const deviceFileUrl = (path: string) => `https://huggingface.co/${deviceModel.repo}/resolve/${deviceModel.revision}/${path}`

const MAX_TOKENS = 512
const YES_TOKENS = [9405, 9175] // "yes", "Yes"
const NO_TOKENS = [2083, 2665] // "no", "No"

// Builds tensors with the runtime's Tensor class: onnxruntime-web in the browser,
// onnxruntime-node in Node.
interface TensorData { int64: BigInt64Array, float16: Uint16Array, float32: Float32Array }
export type TensorFactory = <T extends keyof TensorData>(type: T, data: TensorData[T], dims: number[]) => Tensor

export function tensorFactory(TensorClass: typeof Tensor): TensorFactory {
  return (type, data, dims) => new TensorClass(type, data as never, dims)
}

// Qwen3.5 chat template for one user turn with thinking disabled. The answer is
// only ever data inside the statement.
export function buildPrompt(answer: string, claim: string): string {
  const statement = claim.replaceAll('{answer}', answer)
  const question = `Is this statement true? Answer with only yes or no.\n\nStatement: ${statement}`
  return `<|im_start|>user\n${question}<|im_end|>\n<|im_start|>assistant\n<think>\n\n</think>\n\n`
}

export function encodePrompt(tokenizer: Tokenizer, prompt: string): number[] {
  const { ids } = tokenizer.encode(prompt, { add_special_tokens: false })
  if (ids.length > MAX_TOKENS) {
    throw new RangeError(`Prompt has ${String(ids.length)} tokens; the limit is ${String(MAX_TOKENS)}.`)
  }
  return ids
}

// Zeroed recurrent states and an empty key/value cache for a fresh prompt.
function emptyState(session: InferenceSession, makeTensor: TensorFactory): Record<string, Tensor> {
  const state: Record<string, Tensor> = {}
  for (const input of session.inputMetadata) {
    if (!input.isTensor || !input.name.startsWith('past_')) continue
    if (input.type !== 'float16' && input.type !== 'float32') {
      throw new TypeError(`Unexpected ${input.type} state input ${input.name}.`)
    }
    const dims = input.shape.map((dim) => (dim === 'batch_size' ? 1 : typeof dim === 'string' ? 0 : dim))
    const size = dims.reduce((total, dim) => total * dim, 1)
    state[input.name] = input.type === 'float16'
      ? makeTensor('float16', new Uint16Array(size), dims)
      : makeTensor('float32', new Float32Array(size), dims)
  }
  return state
}

function float16ToNumber(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1
  const exponent = (bits >> 10) & 0x1f
  const fraction = bits & 0x3ff
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024)
  if (exponent === 0x1f) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024)
}

function logitAt(logits: Tensor, token: number): number {
  const { data } = logits
  if (logits.type === 'float16') {
    // onnxruntime returns a Float16Array where the platform has one, raw bits otherwise.
    if (data instanceof Uint16Array) return float16ToNumber(data[token] ?? 0)
    const value: unknown = (data as ArrayLike<unknown>)[token]
    if (typeof value === 'number') return value
  }
  if (logits.type === 'float32' && data instanceof Float32Array) return data[token] ?? 0
  throw new TypeError(`Unexpected ${logits.type} logits.`)
}

function logSumExp(values: number[]): number {
  const top = Math.max(...values)
  return top + Math.log(values.reduce((total, value) => total + Math.exp(value - top), 0))
}

// P("yes") among the yes and no tokens of the next-token distribution.
export function pTrueFromLogits(logits: Tensor): number {
  const yes = logSumExp(YES_TOKENS.map((token) => logitAt(logits, token)))
  const no = logSumExp(NO_TOKENS.map((token) => logitAt(logits, token)))
  return 1 / (1 + Math.exp(no - yes))
}

export async function scoreClaim(
  session: InferenceSession,
  makeTensor: TensorFactory,
  tokenizer: Tokenizer,
  answer: string,
  claim: string,
): Promise<number> {
  const ids = encodePrompt(tokenizer, buildPrompt(answer, claim))
  const feeds = {
    input_ids: makeTensor('int64', BigInt64Array.from(ids, BigInt), [1, ids.length]),
    attention_mask: makeTensor('int64', new BigInt64Array(ids.length).fill(1n), [1, ids.length]),
    num_logits_to_keep: makeTensor('int64', BigInt64Array.of(1n), []),
    ...emptyState(session, makeTensor),
  }
  const { logits } = await session.run(feeds, ['logits'])
  if (!logits) throw new Error('The model returned no logits.')
  return pTrueFromLogits(logits)
}
