import type { Env } from './env'
import { json } from './env'
import { handleJudge } from './judge-route'
import { librarySchema, type Library } from './library'
import { handleReveal } from './reveal'
import { handleSession } from './session'
import bundledLibrary from './library/library.json'

// The bundled library is validated once per isolate, on first use.
let library: Library | undefined
const getLibrary = () => (library ??= librarySchema.parse(bundledLibrary))

export function route(request: Request, env: Env, lib: () => Library = getLibrary): Response | Promise<Response> {
  const { pathname } = new URL(request.url)
  const { method } = request

  if (pathname === '/api/health' && method === 'GET') return json({ status: 'ok' })
  if (pathname === '/api/session' && method === 'POST') return handleSession(request, env)
  if (pathname === '/api/judge' && method === 'POST') return handleJudge(request, env, lib())
  if (pathname.startsWith('/api/reveal/') && method === 'GET') return handleReveal(pathname, lib())
  return json({ error: 'not_found' }, 404)
}

export default {
  fetch: (request, env) => route(request, env),
} satisfies ExportedHandler<Env>
