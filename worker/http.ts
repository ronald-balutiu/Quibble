import type { z } from '@shared/schemas/zod'

// JSON in and out of the API routes. Every response is uncached unless a route
// says otherwise.

export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  const merged = new Headers(headers)
  if (!merged.has('Cache-Control')) merged.set('Cache-Control', 'no-store')
  return Response.json(body, { status, headers: merged })
}

// A request body that is valid JSON and matches the schema, or undefined.
export function parseJson<T>(text: string, schema: z.ZodType<T>): T | undefined {
  try {
    const parsed = schema.safeParse(JSON.parse(text))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}
