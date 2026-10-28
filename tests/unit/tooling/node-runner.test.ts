import { execFileSync } from 'node:child_process'
import { expect, test } from 'vitest'

test('the Node script runner resolves @shared imports at runtime', () => {
  const output = execFileSync('npm', ['run', '--silent', 'ts', '--', 'tests/fixtures/node/imports.ts'], {
    cwd: new URL('../../../', import.meta.url),
    encoding: 'utf8',
    timeout: 10_000,
  })

  expect(JSON.parse(output)).toEqual(['oddly-specific', 'category-escape', 'double-agent'])
})
