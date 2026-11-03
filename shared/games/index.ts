import { categoryEscapeConfig } from './category-escape.ts'
import { doubleAgentConfig } from './double-agent.ts'
import { oddlySpecificConfig } from './oddly-specific.ts'

export const gameConfigs = {
  [oddlySpecificConfig.id]: oddlySpecificConfig,
  [categoryEscapeConfig.id]: categoryEscapeConfig,
  [doubleAgentConfig.id]: doubleAgentConfig,
} as const

export const gameIds = [oddlySpecificConfig.id, categoryEscapeConfig.id, doubleAgentConfig.id] as const
export type GameId = (typeof gameIds)[number]

// Narrows a route segment or stored value to a known game.
export function isGameId(value: unknown): value is GameId {
  return typeof value === 'string' && Object.hasOwn(gameConfigs, value)
}
