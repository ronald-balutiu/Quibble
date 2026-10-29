// Records live Workers AI responses for Clef-flash, Clef and Gemma 4 into
// tests/fixtures/clef/. Spends a small part of the daily Workers AI allowance.
// Usage: npm run ts -- eval/clef/record-fixtures.ts
import { loadEnvFile } from 'node:process'
import { writeFileSync } from 'node:fs'

loadEnvFile('.env')
const accountId = process.env.WORKERS_AI_ACCOUNT_ID
const token = process.env.WORKERS_AI_API_TOKEN
if (!accountId || !token) throw new Error('Set WORKERS_AI_ACCOUNT_ID and WORKERS_AI_API_TOKEN in .env.')

const fixtures = 'tests/fixtures/clef'
const playerAnswer = 'pocket knife'
// The example request from the plan's cloud judge section.
const questions = {
  pocket: 'Does the thing ordinarily fit inside a clothing pocket? Judge its everyday meaning; do not imagine unusual situations.',
  secure: "Does the thing's ordinary use include fastening or securing something?",
  nonelec: 'Is the thing free of electronic components?',
}

// Keep only headers that describe the response, never cookies or auth.
const keptHeaders = /^(content-type|cf-ai-|x-ai-|server-timing)/i

async function run(model: string, body: unknown) {
  const started = performance.now()
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return {
    status: response.status,
    latencyMs: Math.round(performance.now() - started),
    headers: Object.fromEntries([...response.headers].filter(([name]) => keptHeaders.test(name))),
    body: await response.json(),
  }
}

function save(name: string, fixture: object) {
  writeFileSync(`${fixtures}/${name}.json`, `${JSON.stringify({ recordedAt: new Date().toISOString(), ...fixture }, null, 2)}\n`)
  console.log(`wrote ${fixtures}/${name}.json`)
}

for (const [name, selector] of [['clef-flash', 'clef-flash'], ['clef', 'clef']] as const) {
  const model = `@cf/cloudflare/${name}`
  const request = {
    model: selector,
    state: { game: 'word game', playerAnswer },
    questions: Object.fromEntries(Object.entries(questions).map(([id, instructions]) => [id, { type: 'noul', instructions }])),
  }
  save(`${name}-success`, { model, request, response: await run(model, request) })
}

// Gemma 4 is a chat model: one request per question, reading YES/NO from logprobs.
const gemma = '@cf/google/gemma-4-26b-a4b-it'
const calls = []
for (const [id, instructions] of Object.entries(questions)) {
  const request = {
    messages: [{
      role: 'user',
      content: `The player answered: "${playerAnswer}".\n\n${instructions}\n\nAnswer with only YES or NO.`,
    }],
    chat_template_kwargs: { enable_thinking: false },
    temperature: 0,
    max_completion_tokens: 1,
    logprobs: true,
    top_logprobs: 5,
  }
  calls.push({ id, request, response: await run(gemma, request) })
}
save('gemma-4-success', { model: gemma, calls })
