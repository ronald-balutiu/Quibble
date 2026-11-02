import { gameConfigs, type GameId } from './games'

// Conservative on purpose: it never changes what an answer means. No stemming or
// singularization ("glasses" stays different from "glass").

type AliasMap = ReadonlyMap<string, string>

const surroundingPunctuation = /^[\p{P}\s]+|[\p{P}\s]+$/gu
const leadingArticle = /^(?:a|an|the)\s+(?=\S)/u

export function normalizeAnswer(answer: string, game: GameId, aliases: AliasMap = new Map()): string {
  let text = answer.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').replace(surroundingPunctuation, '')
  if (gameConfigs[game].input.kind === 'noun-phrase') text = text.replace(leadingArticle, '')
  return aliases.get(text) ?? text
}

// Local rules on a normalized answer. Breaking them never costs a strike.
export function isValidAnswer(normalized: string, game: GameId): boolean {
  const { input } = gameConfigs[game]
  const length = [...normalized].length
  if (length < 1 || length > input.maxCharacters) return false
  if (input.kind === 'noun-phrase') return true
  // A single word: letters, with hyphens or apostrophes only between letters.
  if (!/^\p{L}+(?:[-'’]\p{L}+)*$/u.test(normalized)) return false
  return normalized.replace(/[-'’]/gu, '').length <= input.maxLetters
}
