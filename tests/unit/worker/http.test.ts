import { describe, expect, test } from 'vitest'
import { json } from '../../../worker/http'

describe('json responses', () => {
  test('are uncached unless the route says otherwise, whatever form its headers take', () => {
    expect(json({ ok: true }).headers.get('Cache-Control')).toBe('no-store')
    const cached = json({}, 200, new Headers({ 'Cache-Control': 'public, max-age=60', 'X-Extra': '1' }))
    expect(cached.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(cached.headers.get('X-Extra')).toBe('1')
    expect(json({}, 429, [['Retry-After', '30']]).headers.get('Retry-After')).toBe('30')
  })
})
