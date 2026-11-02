// Bound raw bytes while reading, including chunked requests without a declared
// length. Keep no more than maxBytes in memory before decoding the JSON text.
export async function readBody(request: Request, maxBytes: number): Promise<{ ok: true, text: string } | { ok: false, status: 400 | 413 }> {
  const reader: ReadableStreamDefaultReader<Uint8Array> | undefined = request.body?.getReader()
  if (!reader) return { ok: true, text: '' }
  try {
    const declared = Number(request.headers.get('Content-Length'))
    if (Number.isFinite(declared) && declared > maxBytes) {
      await reader.cancel().catch(() => { /* The request may already be aborted. */ })
      return { ok: false, status: 413 }
    }
    const bytes = new Uint8Array(maxBytes)
    let size = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) return { ok: true, text: new TextDecoder().decode(bytes.subarray(0, size)) }
      if (size + value.byteLength > maxBytes) {
        await reader.cancel().catch(() => { /* The request may already be aborted. */ })
        return { ok: false, status: 413 }
      }
      bytes.set(value, size)
      size += value.byteLength
    }
  } catch {
    return { ok: false, status: 400 }
  } finally {
    reader.releaseLock()
  }
}
