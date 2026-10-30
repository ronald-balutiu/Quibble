import { describe, expect, test, vi } from 'vitest'
import { judgeWithClef, type AiRunner } from '../../../worker/judge'
import fixture from '../../fixtures/clef/clef-flash-success.json'

const questions = Object.entries(fixture.request.questions).map(([id, { instructions }]) => ({ id, question: instructions }))
const recorded = fixture.response.body.result
const noSleep = () => Promise.resolve()

function aiError(message: string, name = 'AiError'): Error {
  return Object.assign(new Error(message), { name })
}

// Each outcome resolves the call, or rejects it when it is an Error.
function runner(...outcomes: unknown[]) {
  const run = vi.fn<AiRunner['run']>()
  for (const outcome of outcomes) {
    run.mockImplementationOnce(() => (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)))
  }
  return { run }
}

describe('judgeWithClef', () => {
  test('sends the answer only as state data and reads the scores', async () => {
    const ai = runner(recorded)
    const verdict = await judgeWithClef(ai, 'pocket knife', questions, { sleep: noSleep })

    expect(verdict).toMatchObject({ ok: true, scores: { pocket: 0.8376, secure: 0.0676, nonelec: 0.9738 } })
    const [model, inputs] = ai.run.mock.calls[0] ?? []
    expect(model).toBe('@cf/cloudflare/clef-flash')
    expect(inputs).toEqual(fixture.request)
  })

  test.each([
    '3036: You have used up your daily free allocation of 10,000 neurons.',
    '4006: AiError: AiError: you have used up your daily free allocation of 10,000 neurons, please upgrade.',
    'AiError: you have used up your daily free allocation of 10,000 neurons.',
  ])('maps the daily-allowance error to resting without retrying: %s', async (message) => {
    const ai = runner(aiError(message))
    expect(await judgeWithClef(ai, 'x', questions, { sleep: noSleep })).toEqual({ ok: false, error: 'resting' })
    expect(ai.run).toHaveBeenCalledTimes(1)
  })

  test('does not retry coded errors such as validation or capacity', async () => {
    const ai = runner(aiError("5006: Error: required properties at '/' are 'model,state,questions'"))
    expect(await judgeWithClef(ai, 'x', questions, { sleep: noSleep })).toEqual({ ok: false, error: 'unavailable' })
    expect(ai.run).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['a timeout', aiError('The operation timed out.', 'TimeoutError')],
    ['a Workers AI timeout code', aiError('3007: Request timeout')],
    ['an uncoded upstream failure', new Error('Network connection lost.')],
  ])('retries once after %s', async (_name, error) => {
    const sleep = vi.fn(noSleep)
    const ai = runner(error, recorded)
    expect(await judgeWithClef(ai, 'x', questions, { sleep, retryDelayMs: 300 })).toMatchObject({ ok: true })
    expect(ai.run).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(300)
  })

  test('gives up after the retry', async () => {
    const ai = runner(aiError('', 'TimeoutError'), aiError('', 'TimeoutError'))
    expect(await judgeWithClef(ai, 'x', questions, { sleep: noSleep })).toEqual({ ok: false, error: 'unavailable' })
    expect(ai.run).toHaveBeenCalledTimes(2)
  })

  test('treats an unreadable response as unavailable without retrying', async () => {
    const ai = runner({ ...recorded, answers: {} })
    expect(await judgeWithClef(ai, 'x', questions, { sleep: noSleep })).toEqual({ ok: false, error: 'unavailable' })
    expect(ai.run).toHaveBeenCalledTimes(1)
  })
})
