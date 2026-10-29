// Judges scored by the answer-key test. Every model call goes to the model
// directly; known answers are never consulted (plan 3.10).
import { readFileSync } from 'node:fs'
import { clueClaim, clueQuestion } from '@shared/clues'
import type { AnswerKeyCase } from '@shared/schemas/answer-key'
import { gemmaRequest, judgeWithClef } from '../worker/judge'
import { readGemma } from '../worker/read-answers'
import { AllowanceExhausted, freeModels, restRunner } from '../factory/workers-ai'
import { deviceModel } from '@/judges/device/verdict'
import { loadDeviceJudge, nodeRuntime } from './verdict/node-runtime'
import type { CaseResult } from './metrics'

export type JudgeName = 'clef-flash' | 'clef' | 'gemma-4' | 'device'

export interface Judge {
  name: JudgeName
  model: string
  precision: string
  backend: string
  score(c: AnswerKeyCase): Promise<CaseResult>
}

const models = freeModels

const conditions = JSON.parse(readFileSync('factory/conditions.json', 'utf8')) as Record<string, { question: string, claim: string }>

function wording(condition: AnswerKeyCase['conditions'][number]) {
  if (condition.clue !== undefined) return { question: clueQuestion(condition.clue), claim: clueClaim(condition.clue) }
  const entry = conditions[condition.id]
  if (!entry) throw new Error(`Unknown condition ${condition.id}.`)
  return entry
}

function clefJudge(name: 'clef-flash' | 'clef'): Judge {
  let neurons = 0
  const ai = restRunner((spent) => { neurons += spent })
  return {
    name, model: models[name], precision: 'hosted', backend: 'Workers AI REST',
    async score(c) {
      neurons = 0
      const questions = c.conditions.map((condition) => ({ id: condition.id, question: wording(condition).question }))
      const started = performance.now()
      const verdict = await judgeWithClef(ai, c.answer, questions, { model: name })
      if (!verdict.ok) {
        if (verdict.error === 'resting') throw new AllowanceExhausted('The daily Workers AI allowance is used up.')
        throw new Error(`${name} could not judge ${c.id}.`)
      }
      return { id: c.id, scores: verdict.scores, latencyMs: performance.now() - started, neurons }
    },
  }
}

function gemmaJudge(): Judge {
  let neurons = 0
  const ai = restRunner((spent) => { neurons += spent })
  return {
    name: 'gemma-4', model: models['gemma-4'], precision: 'hosted', backend: 'Workers AI REST',
    async score(c) {
      neurons = 0
      const started = performance.now()
      const scores: Record<string, number> = {}
      for (const condition of c.conditions) {
        try {
          const p = readGemma(await ai.run(models['gemma-4'], gemmaRequest(c.answer, wording(condition).question)))
          if (p === undefined) throw new Error(`Gemma gave no readable answer for ${c.id}.`)
          scores[condition.id] = p
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('3036:')) throw new AllowanceExhausted(error.message)
          throw error
        }
      }
      return { id: c.id, scores, latencyMs: performance.now() - started, neurons }
    },
  }
}

async function deviceJudge(): Promise<Judge> {
  const score = await loadDeviceJudge()
  return {
    name: 'device', model: `${deviceModel.repo}@${deviceModel.revision.slice(0, 8)}`,
    precision: deviceModel.file.replace(/^onnx\/model_|\.onnx$/gu, ''), backend: nodeRuntime,
    async score(c) {
      const started = performance.now()
      const scores: Record<string, number> = {}
      for (const condition of c.conditions) scores[condition.id] = await score(c.answer, wording(condition).claim)
      return { id: c.id, scores, latencyMs: performance.now() - started }
    },
  }
}

export { AllowanceExhausted }

export async function loadJudge(name: JudgeName): Promise<Judge> {
  if (name === 'device') return deviceJudge()
  if (name === 'gemma-4') return gemmaJudge()
  return clefJudge(name)
}
