// Executed by the project's tsx command to guard alias resolution in Node tools.
import { oddlySpecificConfig } from '@shared/games/oddly-specific'
import { categoryEscapeConfig } from '@shared/games/category-escape'
import { doubleAgentConfig } from '@shared/games/double-agent'

console.log(JSON.stringify([
  oddlySpecificConfig.id,
  categoryEscapeConfig.id,
  doubleAgentConfig.id,
]))
