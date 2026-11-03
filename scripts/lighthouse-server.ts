// The server Lighthouse audits (lighthouserc.cjs): the production preview, as
// Cloudflare runs it (routes, _headers, the Worker), behind a proxy that
// Brotli-compresses responses as Cloudflare's edge does. Without it, Lighthouse
// simulates slow 4G on uncompressed files, about four times their real size.
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { brotliCompressSync } from 'node:zlib'

const PREVIEW = 'http://127.0.0.1:4173'
const PORT = 4174
const COMPRESSIBLE = /^(?:text\/|application\/(?:javascript|json|xml|wasm)|image\/svg)/u

const preview = spawn('npm', ['run', 'preview'], {
  stdio: 'inherit',
  env: { ...process.env, QUIBBLE_REMOTE_BINDINGS: 'false' },
})
process.on('exit', () => preview.kill())
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => process.exit(0))

async function waitForPreview(): Promise<void> {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if ((await fetch(`${PREVIEW}/api/health`)).ok) return
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('The preview server did not start.')
}

await waitForPreview()
createServer((request, response) => {
  void (async () => {
    const upstream = await fetch(`${PREVIEW}${request.url ?? '/'}`, {
      method: request.method ?? 'GET',
      redirect: 'manual',
    })
    const headers = Object.fromEntries(
      [...upstream.headers].filter(
        ([name]) => !['content-length', 'content-encoding', 'transfer-encoding'].includes(name),
      ),
    )
    let body: Buffer = Buffer.from(await upstream.arrayBuffer())
    if (
      COMPRESSIBLE.test(upstream.headers.get('content-type') ?? '') &&
      /\bbr\b/u.test(String(request.headers['accept-encoding']))
    ) {
      body = brotliCompressSync(body)
      headers['content-encoding'] = 'br'
    }
    response.writeHead(upstream.status, headers).end(body)
  })().catch(() => {
    response.writeHead(502).end()
  })
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Lighthouse server ready at http://127.0.0.1:${String(PORT)}`)
})
