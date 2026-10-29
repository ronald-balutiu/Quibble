import { describe, expect, test } from 'vitest'
import { readAnswers, type ClefModel } from '../../../worker/read-answers'
import clefFlash from '../../fixtures/clef/clef-flash-success.json'
import clef from '../../fixtures/clef/clef-success.json'
import malformed from '../../fixtures/clef/malformed.json'

describe('readAnswers', () => {
  test.each([
    ['clef-flash', clefFlash],
    ['clef', clef],
  ] as const)('reads every score from the recorded %s response', (model, fixture) => {
    const questionIds = Object.keys(fixture.request.questions)
    const result = readAnswers(fixture.response.body.result, model, questionIds)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(Object.keys(result.scores)).toEqual(questionIds)
    for (const id of questionIds) {
      expect(result.scores[id]).toBe(fixture.response.body.result.answers[id as keyof typeof fixture.response.body.result.answers].noul)
    }
    expect(result.inputTokens).toBe(fixture.response.body.result.usage.input_tokens)
  })

  test.each(malformed.cases.map((c) => [c.name, c] as const))('rejects a malformed response: %s', (_name, c) => {
    expect(readAnswers(c.response, c.model as ClefModel, c.questionIds)).toEqual({ ok: false })
  })
})
