import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { answerKeySchema, type AnswerKeyCase } from '@shared/schemas/answer-key'

const load = (path: string): AnswerKeyCase[] => answerKeySchema.parse(JSON.parse(readFileSync(path, 'utf8')))
const dev = load('eval/dev.json')
const test_ = load('eval/test.json')
const conditions = JSON.parse(readFileSync('factory/conditions.json', 'utf8')) as Record<string, unknown>

describe('answer-key cases', () => {
  test('every case id is unique across both splits', () => {
    const ids = [...dev, ...test_].map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('no round group appears in both splits', () => {
    const devGroups = new Set(dev.map((c) => c.group))
    expect(test_.filter((c) => devGroups.has(c.group))).toEqual([])
  })

  test('thing conditions exist in factory/conditions.json', () => {
    const missing = [...dev, ...test_].flatMap((c) => c.conditions)
      .filter(({ id }) => !id.startsWith('clue:') && !Object.hasOwn(conditions, id))
    expect(missing).toEqual([])
  })

  test('Category Escape cases list exactly the conditions in force at their level', () => {
    const wrong = [...dev, ...test_].filter((c) => c.game === 'category-escape' && c.conditions.length !== c.level)
    expect(wrong).toEqual([])
  })
})
