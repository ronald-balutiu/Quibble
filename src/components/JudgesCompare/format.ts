import { format } from '@/copy/en'

export const percent = (value: number) => format('compare.percent', { p: (value * 100).toFixed(1) })
export const milliseconds = (value: number | undefined) => value === undefined ? '–' : format('compare.ms', { ms: Math.round(value).toLocaleString() })
export const dateLabel = (value: string) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
