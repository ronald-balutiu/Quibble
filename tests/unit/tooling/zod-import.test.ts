import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'

// Zod is configured once, in shared/schemas/zod.ts (jitless, so it never probes for
// eval under the content security policy). Everything else imports it from there.
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sources(path)
    return /\.tsx?$/u.test(entry.name) ? [path] : []
  })
}

describe('Zod is imported through shared/schemas/zod.ts', () => {
  test('no app, Worker or shared file imports zod directly', () => {
    const direct = ['src', 'shared', 'worker']
      .flatMap(sources)
      .filter((path) => path !== join('shared', 'schemas', 'zod.ts'))
      .filter((path) => /from ['"]zod(?:\/[\w-]+)?['"]/u.test(readFileSync(path, 'utf8')))
    expect(direct).toEqual([])
  })
})
