import { describe, expect, test } from 'vitest'
import { Tensor } from 'onnxruntime-common'
import type { Tokenizer } from '@huggingface/tokenizers'
import { buildPrompt, encodePrompt, pTrueFromLogits } from '@/judges/device/verdict'

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

describe('device judge adapter', () => {
  test('builds the Qwen chat prompt with the answer only inside the statement', () => {
    expect(buildPrompt('pocket knife', '"{answer}" ordinarily fits inside a clothing pocket.')).toBe(
      '<|im_start|>user\nIs this statement true? Answer with only yes or no.\n\n'
      + 'Statement: "pocket knife" ordinarily fits inside a clothing pocket.<|im_end|>\n'
      + '<|im_start|>assistant\n<think>\n\n</think>\n\n',
    )
  })

  test.each(['float32', 'float16'] as const)('reads P(true) from %s yes and no logits', (type) => {
    // yes/Yes logits are 2 and 0; no/No are both 0.
    const expected = (Math.exp(2) + 1) / (Math.exp(2) + 3)
    expect(pTrueFromLogits(logits(type, { [YES]: 2, [NO]: 0 }))).toBeCloseTo(expected, 6)
  })

  test('rejects prompts over the token limit', () => {
    const tokenizer = { encode: () => ({ ids: new Array<number>(513).fill(1) }) } as unknown as Tokenizer
    expect(() => encodePrompt(tokenizer, 'long')).toThrow(RangeError)
  })
})
