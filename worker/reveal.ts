import { gameIds, type GameId } from '@shared/games'
import type { Reveal } from '@shared/schemas/judge'
import { json } from './env'
import { findPath, findRound, type Library } from './library'

// GET /api/reveal/:game/:n/:roundId (plan 3.4): the example plus up to two more
// known answers, and for Category Escape the confirmed path. It can't verify that
// the round ended, which is acceptable for a casual game.

const route = /^\/api\/reveal\/([a-z-]+)\/(\d+)\/([A-Za-z]\d+)$/u

export function handleReveal(pathname: string, library: Library): Response {
  const [, game, n, roundId] = route.exec(pathname) ?? []
  if (!game || !n || !roundId || !gameIds.includes(game as GameId)) return json({ error: 'unknown' }, 404)
  const round = findRound(library, game as GameId, Number(n), roundId)
  if (!round) return json({ error: 'unknown' }, 404)

  const reveal: Reveal = { example: round.example, also: round.known.filter((answer) => answer !== round.example).slice(0, 2) }
  const path = game === 'category-escape' ? findPath(library, game, Number(n)) : undefined
  return json(path ? { ...reveal, path } : reveal, 200, { 'Cache-Control': 'public, max-age=3600' })
}
