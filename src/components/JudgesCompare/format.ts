import { format } from '@/copy/en'

// The comparison's two halves, in tab order: the answer-key test and the player's own games.
export const compareSources = ['test', 'games'] as const

export const percent = (value: number) => format('compare.percent', { p: (value * 100).toFixed(1) })
export const milliseconds = (value: number | undefined) => value === undefined ? '–' : format('compare.ms', { ms: Math.round(value).toLocaleString() })
export const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
