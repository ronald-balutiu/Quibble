import { deviceFileUrl, type DeviceFile } from './verdict'

// Model downloads for the on-device judge (3.6). The model is kept in memory for
// this visit only (D-82): files are fetched with no-store and nothing is written
// to the Cache API or the browser's HTTP cache, so closing the tab removes it.

export class DownloadError extends Error {
  constructor(readonly reason: 'network' | 'storage') {
    super(`Model download failed: ${reason}.`)
  }
}

const aborted = (signal: AbortSignal) => signal.reason instanceof Error ? signal.reason : new DOMException('Cancelled', 'AbortError')

function allocate(size: number): Uint8Array<ArrayBuffer> {
  try {
    return new Uint8Array(size)
  } catch {
    throw new DownloadError('storage')
  }
}

// Reads a body into one preallocated buffer of the file's exact size, reporting
// each chunk as it lands so the progress view follows the real bytes (5.3).
export async function readInto(response: Response, size: number, onBytes: (bytes: number) => void, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = allocate(size)
  const reader = response.body?.getReader()
  if (!reader) throw new DownloadError('network')
  const stop = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', stop, { once: true })
  let offset = 0
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await reader.read()
      } catch {
        if (signal.aborted) throw aborted(signal)
        throw new DownloadError('network')
      }
      if (signal.aborted) throw aborted(signal)
      if (chunk.done) break
      if (offset + chunk.value.length > size) throw new DownloadError('network')
      buffer.set(chunk.value, offset)
      offset += chunk.value.length
      onBytes(chunk.value.length)
    }
  } finally {
    signal.removeEventListener('abort', stop)
  }
  if (offset !== size) throw new DownloadError('network')
  return buffer
}

interface LoadOptions {
  signal: AbortSignal
  onBytes: (bytes: number) => void
  fetch?: typeof fetch
}

export async function loadFile(file: DeviceFile, options: LoadOptions): Promise<Uint8Array<ArrayBuffer>> {
  const { signal, onBytes, fetch: fetchImpl = fetch } = options
  let response: Response
  try {
    response = await fetchImpl(deviceFileUrl(file.path), { cache: 'no-store', signal })
  } catch {
    if (signal.aborted) throw aborted(signal)
    throw new DownloadError('network')
  }
  if (!response.ok) throw new DownloadError('network')
  return readInto(response, file.bytes, onBytes, signal)
}
