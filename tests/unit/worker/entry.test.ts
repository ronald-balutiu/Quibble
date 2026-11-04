import { expect, test } from 'vitest'
import library from '../../../worker/library/library.json'
import worker from '../../../worker/index'
import type { Env } from '../../../worker/env'

// Also guards that Worker unit tests are checked with the Worker ambient types.
test('the Worker entry can be imported and executed from a unit test', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/health'), {} as Env)

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})

test('unknown paths and unsupported methods return JSON 404, never application HTML', async () => {
  for (const [path, method] of [
    ['/api/missing', 'GET'],
    ['/api/health', 'POST'],
  ] as const) {
    const response = await worker.fetch(new Request(`https://example.test${path}`, { method }), {} as Env)
    expect(response.status).toBe(404)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'not_found' })
  }
})

test('the default Worker serves the bundled reveal without an AI binding', async () => {
  const round = Object.entries(library.puzzles['oddly-specific']['1'].rounds)[0]
  if (!round) throw new Error('The bundled puzzle has no rounds')
  const [id, value] = round
  const response = await worker.fetch(new Request(`https://example.test/api/reveal/oddly-specific/1/${id}`), {} as Env)
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ example: value.example })
})
