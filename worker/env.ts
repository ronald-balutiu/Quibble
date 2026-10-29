import type { AiRunner } from './judge'

export interface Env {
  AI: AiRunner
  JUDGE_LIMIT: RateLimit
  TURNSTILE_SECRET: string
  SESSION_KEY: string
  // The hostname Turnstile must report: the site's own, or the test keys' in development.
  SITE_HOSTNAME: string
}

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}
