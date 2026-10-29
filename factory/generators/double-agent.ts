// Double Agent candidates from Open English WordNet (plan 3.9): words of 3–10
// letters with two senses in different WordNet domains, plus decoys for each clue
// drawn from the sister terms of the other sense.
import { readdirSync, readFileSync } from 'node:fs'

interface Synset { definition: string[], hypernym?: string[], members: string[], partOfSpeech: string }
interface Sense { id: string, synset: string }
type Entries = Record<string, Record<string, { sense?: Sense[] }>>

export interface WordNet { synsets: Map<string, Synset & { domain: string }>, senses: Map<string, string[]>, hyponyms: Map<string, string[]> }

export function loadWordNet(dir: string): WordNet {
  const synsets = new Map<string, Synset & { domain: string }>()
  const senses = new Map<string, string[]>()
  const hyponyms = new Map<string, string[]>()
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const data = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as Record<string, unknown>
    if (file.startsWith('entries-')) {
      for (const [word, byPos] of Object.entries(data as Entries)) {
        // Keep WordNet's sense order, which roughly follows frequency.
        const list = Object.values(byPos).flatMap((entry) => (entry.sense ?? []).map((sense) => sense.synset))
        senses.set(word, [...(senses.get(word) ?? []), ...list])
      }
    } else {
      const domain = file.replace(/\.json$/u, '')
      for (const [id, synset] of Object.entries(data as Record<string, Synset>)) synsets.set(id, { ...synset, domain })
    }
  }
  for (const [id, synset] of synsets) {
    for (const parent of synset.hypernym ?? []) hyponyms.set(parent, [...(hyponyms.get(parent) ?? []), id])
  }
  return { synsets, senses, hyponyms }
}

export interface Candidate { word: string, clues: { synset: string, domain: string, clue: string, decoys: string[] }[] }

const isWord = (word: string) => /^[a-z]{3,10}$/u.test(word)

// Sister terms: other single-word members of the sense's hypernym's hyponyms.
function sisters(wordnet: WordNet, synset: string, exclude: string): string[] {
  const words = new Set<string>()
  for (const parent of wordnet.synsets.get(synset)?.hypernym ?? []) {
    for (const sibling of wordnet.hyponyms.get(parent) ?? []) {
      for (const member of wordnet.synsets.get(sibling)?.members ?? []) {
        if (isWord(member) && member !== exclude) words.add(member)
      }
    }
  }
  return [...words]
}

// The first two senses, among the word's first four, that sit in different
// noun or verb domains and whose definitions don't contain the word.
export function candidate(wordnet: WordNet, word: string, decoyCount = 20): Candidate | undefined {
  if (!isWord(word)) return undefined
  const usable = (wordnet.senses.get(word) ?? []).slice(0, 4).filter((id) => {
    const synset = wordnet.synsets.get(id)
    return synset && /^(noun|verb)\./u.test(synset.domain) && synset.domain !== 'noun.Tops'
      && !new RegExp(`\\b${word}`, 'iu').test(synset.definition[0] ?? '')
  })
  const first = usable[0]
  const second = usable.find((id) => wordnet.synsets.get(id)?.domain !== wordnet.synsets.get(first ?? '')?.domain)
  if (!first || !second) return undefined
  const pair = [first, second]
  const clues = pair.map((id, i) => {
    const synset = wordnet.synsets.get(id)
    // Decoys for this clue are words that fit the *other* sense instead.
    const decoys = sisters(wordnet, pair[1 - i] ?? '', word).slice(0, decoyCount)
    return { synset: id, domain: synset?.domain ?? '', clue: synset?.definition[0] ?? '', decoys }
  })
  return clues.every((clue) => clue.decoys.length >= 5) ? { word, clues } : undefined
}
