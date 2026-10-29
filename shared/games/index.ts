import { categoryEscapeConfig } from './category-escape'
import { doubleAgentConfig } from './double-agent'
import { oddlySpecificConfig } from './oddly-specific'

export const gameConfigs = {
  [oddlySpecificConfig.id]: oddlySpecificConfig,
  [categoryEscapeConfig.id]: categoryEscapeConfig,
  [doubleAgentConfig.id]: doubleAgentConfig,
} as const

export type GameId = keyof typeof gameConfigs
export const gameIds = Object.keys(gameConfigs) as GameId[]
