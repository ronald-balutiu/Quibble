import { expect, test } from 'vitest'
import worker from '../../../worker/index'

// Also guards that Worker unit tests are checked with the Worker ambient types.
test('the Worker entry can be imported and executed from a unit test', async () => {
  const response = worker.fetch(new Request('https://example.test/api/health'))

  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok' })
})
