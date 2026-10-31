import { deviceFileUrl, deviceModel, type DeviceFile } from './verdict'

// Model downloads for the on-device judge (3.6, D-15). "This visit only" fetches
// with no-store and keeps the bytes in memory; "Keep on this device" also writes
// them to the Cache API, where a later visit reads them back without the network.

export const MODEL_CACHE = `quibble-device-${deviceModel.revision.slice(0, 8)}`

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

// Copies a body into the buffer from `offset`, reporting each chunk as it lands so
// the progress view follows the real bytes (5.3). Returns the new offset.
async function copyInto(response: Response, buffer: Uint8Array, offset: number, onBytes: (bytes: number) => void, signal: AbortSignal): Promise<number> {
  const reader = response.body?.getReader()
  if (!reader) throw new DownloadError('network')
  const stop = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener('abort', stop, { once: true })
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
      if (chunk.done) return offset
      if (offset + chunk.value.length > buffer.length) throw new DownloadError('network')
      buffer.set(chunk.value, offset)
      offset += chunk.value.length
      onBytes(chunk.value.length)
    }
  } finally {
    signal.removeEventListener('abort', stop)
  }
}

// Reads a body into one preallocated buffer of the file's exact size.
export async function readInto(response: Response, size: number, onBytes: (bytes: number) => void, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer>> {
  const buffer = allocate(size)
  if (await copyInto(response, buffer, 0, onBytes, signal) !== size) throw new DownloadError('network')
  return buffer
}

// Chrome's Cache API rejects one 551 MB entry, so a kept file is stored in parts.
// The part count is written last: without it, a half-written file is a miss.
export const PART_BYTES = 64 * 1024 * 1024
const partKey = (url: string, part: number) => `${url}?part=${String(part)}`
const countKey = (url: string) => `${url}?parts`

async function readKept(cache: Cache, url: string, size: number, onBytes: (bytes: number) => void, signal: AbortSignal): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const count = Number(await (await cache.match(countKey(url)))?.text())
  if (!Number.isInteger(count) || count < 1) return undefined
  const buffer = allocate(size)
  let offset = 0
  for (let part = 0; part < count; part++) {
    const response = await cache.match(partKey(url, part))
    if (!response) return undefined
    offset = await copyInto(response, buffer, offset, onBytes, signal)
  }
  return offset === size ? buffer : undefined
}

async function keep(cache: Cache, url: string, bytes: Uint8Array, partBytes: number): Promise<void> {
  const count = Math.max(1, Math.ceil(bytes.length / partBytes))
  for (let part = 0; part < count; part++) await cache.put(partKey(url, part), new Response(bytes.slice(part * partBytes, (part + 1) * partBytes)))
  await cache.put(countKey(url), new Response(String(count)))
}

export interface LoadOptions {
  keep: boolean
  signal: AbortSignal
  onBytes: (bytes: number) => void
  // False once the model was deleted, so a late download never refills the cache.
  stillWanted: () => boolean
  fetch?: typeof fetch
  caches?: CacheStorage
  partBytes?: number
}

export async function loadFile(file: DeviceFile, options: LoadOptions): Promise<{ bytes: Uint8Array<ArrayBuffer>, cached: boolean }> {
  const { signal, onBytes, stillWanted, fetch: fetchImpl = fetch, caches: cacheStorage = globalThis.caches, partBytes = PART_BYTES } = options
  const url = deviceFileUrl(file.path)
  const cache = options.keep ? await cacheStorage.open(MODEL_CACHE).catch(() => undefined) : undefined
  // A damaged cached copy is only a miss: progress restarts and the network fills in.
  let received = 0
  const kept = cache && await readKept(cache, url, file.bytes, (count) => { received += count; onBytes(count) }, signal)
  if (kept) return { bytes: kept, cached: true }
  if (received > 0) onBytes(-received)

  let response: Response
  try {
    response = await fetchImpl(url, { cache: options.keep ? 'default' : 'no-store', signal })
  } catch {
    if (signal.aborted) throw aborted(signal)
    throw new DownloadError('network')
  }
  if (!response.ok) throw new DownloadError('network')
  const bytes = await readInto(response, file.bytes, onBytes, signal)
  if (cache && stillWanted()) {
    try {
      await keep(cache, url, bytes, partBytes)
    } catch {
      throw new DownloadError('storage')
    }
  }
  return { bytes, cached: false }
}
