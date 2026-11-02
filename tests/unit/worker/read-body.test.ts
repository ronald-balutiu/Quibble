import { describe, expect, test, vi } from 'vitest'
import { readBody } from '../../../worker/read-body'

function streamed(chunks: Uint8Array[], headers?: HeadersInit, cancel = vi.fn()) {
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = chunks.shift()
      if (next) controller.enqueue(next)
      else controller.close()
    },
    cancel,
  }, { highWaterMark: 0 })
  const init = { method: 'POST', body: stream, duplex: 'half', ...(headers ? { headers } : {}) }
  return new Request('https://quibble.example/api/judge', init)
}

const bytes = (text: string) => new TextEncoder().encode(text)

describe('bounded body reader', () => {
  test('handles empty input and split UTF-8 at the exact byte limit', async () => {
    expect(await readBody(new Request('https://x'), 4)).toEqual({ ok: true, text: '' })
    const data = bytes('éé')
    expect(await readBody(streamed([data.slice(0, 1), data.slice(1)]), 4)).toEqual({ ok: true, text: 'éé' })
  })

  test('cancels an oversized chunked body before requesting the remaining chunks', async () => {
    const cancel = vi.fn()
    const chunks = [bytes('éé'), bytes('é'), bytes('must not be read')]
    expect(await readBody(streamed(chunks, undefined, cancel), 5)).toEqual({ ok: false, status: 413 })
    expect(chunks).toHaveLength(1)
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  test('rejects declared oversize without reading, and checks understated lengths too', async () => {
    const chunks = [bytes('abcdef')]
    const cancel = vi.fn()
    expect(await readBody(streamed(chunks, { 'Content-Length': '1000' }, cancel), 5)).toEqual({ ok: false, status: 413 })
    expect(chunks).toHaveLength(1)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(await readBody(streamed(chunks, { 'Content-Length': '1' }), 5)).toEqual({ ok: false, status: 413 })
  })

  test('turns stream errors into invalid requests and releases the reader', async () => {
    const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('aborted')) } })
    const init = { method: 'POST', body: stream, duplex: 'half' }
    const request = new Request('https://x', init)
    expect(await readBody(request, 5)).toEqual({ ok: false, status: 400 })
    expect(request.body?.locked).toBe(false)
  })
})
