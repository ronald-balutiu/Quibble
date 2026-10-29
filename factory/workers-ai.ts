// Workers AI over REST for the factory and eval scripts, with the credentials
// from .env. Only free-plan models are allowed (plan 2.5).
import { loadEnvFile } from 'node:process'
import type { AiRunner } from '../worker/judge'

export const freeModels = {
  'clef-flash': '@cf/cloudflare/clef-flash',
  clef: '@cf/cloudflare/clef',
  'gemma-4': '@cf/google/gemma-4-26b-a4b-it',
} as const

export class AllowanceExhausted extends Error {}

function credentials() {
  loadEnvFile('.env')
  const accountId = process.env.WORKERS_AI_ACCOUNT_ID
  const token = process.env.WORKERS_AI_API_TOKEN
  if (!accountId || !token) throw new Error('Set WORKERS_AI_ACCOUNT_ID and WORKERS_AI_API_TOKEN in .env.')
  return { accountId, token }
}

// Workers AI over REST. Errors are rethrown as "<code>: <message>", the shape the
// binding uses, so worker/judge.ts classifies them the same way.
export function restRunner(onNeurons: (neurons: number) => void): AiRunner {
  const { accountId, token } = credentials()
  return {
    async run(model, inputs, options) {
      const init: RequestInit = {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(inputs),
      }
      if (options?.signal) init.signal = options.signal
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, init)
      onNeurons(Number(response.headers.get('cf-ai-neurons') ?? 0))
      const body = await response.json() as { result?: unknown, errors?: { code?: number, message?: string }[] }
      const error = body.errors?.[0]
      if (!response.ok || error) {
        throw new Error(error?.code ? `${String(error.code)}: ${error.message ?? ''}` : `HTTP ${String(response.status)}`)
      }
      return body.result
    },
  }
}
