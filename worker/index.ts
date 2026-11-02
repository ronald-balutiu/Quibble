import type { Env } from './env'
import { json } from './env'
import { handleJudge } from './judge-route'
import type { Library } from './library'
import { handleReveal } from './reveal'
import { handleSession } from './session'
import bundledLibrary from './library/library.json'

// The bundled library is checked before it ships, not on each cold start: its shape
// by the compiler here, and every rule in librarySchema by npm run check-puzzles,
// which CI runs on every pull request. That saves several milliseconds of the
// free plan's 10 ms CPU budget on an isolate's first request.
const library: Library = bundledLibrary
const getLibrary = () => library

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
