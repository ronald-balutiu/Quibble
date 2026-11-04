import { describe, expect, test, vi } from 'vitest'
import { Tensor, type InferenceSession } from 'onnxruntime-common'
import { Tokenizer } from '@huggingface/tokenizers'
import {
  buildPrompt,
  DEVICE_TOTAL_BYTES,
  deviceFiles,
  deviceFileUrl,
  deviceModel,
  encodePrompt,
  pTrueFromLogits,
  scoreClaim,
  tensorFactory,
} from '@/judges/device/verdict'

const YES = 9405
const NO = 2083

function logits(type: 'float32' | 'float16', values: Record<number, number>): Tensor {
  const size = 10_000
  if (type === 'float32') {
    const data = new Float32Array(size)
    for (const [token, value] of Object.entries(values)) data[Number(token)] = value
    return new Tensor('float32', data, [1, 1, size])
  }
  // 0x4000 is 2.0 and 0 is 0.0 in IEEE half precision.
  const data = new Uint16Array(size)
  for (const [token, value] of Object.entries(values)) data[Number(token)] = value === 2 ? 0x4000 : 0
  return new Tensor('float16', data, [1, 1, size])
}

// A tiny real tokenizer keeps the contract checked without model downloads.
const tokenizer = new Tokenizer(
  {
    model: { type: 'WordLevel', vocab: { '[UNK]': 0, word: 1 }, unk_token: '[UNK]' },
    pre_tokenizer: { type: 'WhitespaceSplit' },
    decoder: null,
    post_processor: null,
    normalizer: null,
    added_tokens: [],
  },
  {},
)

// scoreClaim's own steps, apart from tokenizing: the stub returns fixed prompt ids.
const ids = [5, 6, 7]
const stubTokenizer = { encode: () => ({ ids }) } as unknown as Tokenizer

// A session with the inputs the real model declares: two recurrent states, one of
// each precision, plus ordinary inputs the adapter feeds itself.
type Run = (feeds: Record<string, Tensor>) => Promise<Record<string, Tensor>>
function session(run: Run, stateType: 'float16' | 'float32' | 'int64' = 'float16') {
  return {
    inputMetadata: [
      { name: 'input_ids', isTensor: true, type: 'int64', shape: ['batch_size', 'sequence_length'] },
      { name: 'past_conv.0', isTensor: true, type: stateType, shape: ['batch_size', 2, 'past_sequence_length', 4] },
      { name: 'past_key.0', isTensor: true, type: 'float32', shape: [1, 3] },
      { name: 'past_ignored', isTensor: false },
    ],
    run,
  } as unknown as InferenceSession
}

describe('device judge adapter', () => {
  test('builds the Qwen chat prompt with the answer only inside the statement', () => {
    expect(buildPrompt('pocket knife', '"{answer}" ordinarily fits inside a clothing pocket.')).toBe(
      '<|im_start|>user\nIs this statement true? Answer with only yes or no.\n\n' +
        'Statement: "pocket knife" ordinarily fits inside a clothing pocket.<|im_end|>\n' +
        '<|im_start|>assistant\n<think>\n\n</think>\n\n',
    )
  })

  test.each(['float32', 'float16'] as const)('reads P(true) from %s yes and no logits', (type) => {
    // yes/Yes logits are 2 and 0; no/No are both 0.
    const expected = (Math.exp(2) + 1) / (Math.exp(2) + 3)
    expect(pTrueFromLogits(logits(type, { [YES]: 2, [NO]: 0 }))).toBeCloseTo(expected, 6)
  })

  test('accepts the token limit and rejects prompts over it', () => {
    const atLimit = new Array<string>(512).fill('word').join(' ')
    expect(encodePrompt(tokenizer, atLimit)).toEqual(new Array<number>(512).fill(1))
    expect(() => encodePrompt(tokenizer, `${atLimit} word`)).toThrow(RangeError)
  })

  test('reads signed and subnormal half-precision logits, and float16 data that is not raw bits', () => {
    // 0xC000 is -2.0; 0x0001 is the smallest subnormal, all but zero.
    const half = (yes: number, no: number) => {
      const data = new Uint16Array(10_000)
      data[YES] = yes
      data[NO] = no
      return new Tensor('float16', data, [1, 1, 10_000])
    }
    expect(pTrueFromLogits(half(0xc000, 0))).toBeCloseTo((Math.exp(-2) + 1) / (Math.exp(-2) + 3), 6)
    expect(pTrueFromLogits(half(0x0001, 0x0001))).toBeCloseTo(0.5, 6)
    // A platform Float16Array arrives as plain numbers.
    const values = Array.from({ length: 10_000 }, (_, i) => (i === YES ? 2 : 0))
    const native = { type: 'float16', data: values } as unknown as Tensor
    expect(pTrueFromLogits(native)).toBeCloseTo((Math.exp(2) + 1) / (Math.exp(2) + 3), 6)
    expect(() => pTrueFromLogits({ type: 'int32', data: new Int32Array(1) } as unknown as Tensor)).toThrow(TypeError)
  })

  test('scores a claim from a fresh state: the prompt ids, a full mask, one logit and zeroed states', async () => {
    const data = new Float32Array(10_000)
    data[YES] = 2
    const run = vi.fn<Run>(() => Promise.resolve({ logits: new Tensor('float32', data, [1, 1, 10_000]) }))
    const p = await scoreClaim(session(run), tensorFactory(Tensor), stubTokenizer, 'word', 'word {answer}')
    expect(p).toBeCloseTo((Math.exp(2) + 1) / (Math.exp(2) + 3), 6)
    const feeds = run.mock.calls[0]?.[0] ?? {}
    expect(Array.from(feeds.input_ids?.data as BigInt64Array, Number)).toEqual(ids)
    expect(Array.from(feeds.attention_mask?.data as BigInt64Array, Number)).toEqual(ids.map(() => 1))
    expect(feeds.num_logits_to_keep?.dims).toEqual([])
    expect(feeds['past_conv.0']).toMatchObject({ type: 'float16', dims: [1, 2, 0, 4] })
    expect(feeds['past_key.0']).toMatchObject({ type: 'float32', dims: [1, 3] })
    expect(Object.keys(feeds)).not.toContain('past_ignored')
  })

  test('refuses an unexpected state type, and a run without logits', async () => {
    const empty = vi.fn<Run>(() => Promise.resolve({}))
    await expect(
      scoreClaim(session(empty, 'int64'), tensorFactory(Tensor), stubTokenizer, 'word', '{answer}'),
    ).rejects.toThrow(TypeError)
    await expect(scoreClaim(session(empty), tensorFactory(Tensor), stubTokenizer, 'word', '{answer}')).rejects.toThrow(
      'The model returned no logits.',
    )
  })

  test('downloads every file from the pinned revision, and knows the total size', () => {
    expect(deviceFileUrl('tokenizer.json')).toBe(
      `https://huggingface.co/${deviceModel.repo}/resolve/${deviceModel.revision}/tokenizer.json`,
    )
    expect(DEVICE_TOTAL_BYTES).toBe(deviceFiles.reduce((sum, { bytes }) => sum + bytes, 0))
    expect(deviceFiles.map(({ path }) => path)).toContain(deviceModel.file)
  })
})
