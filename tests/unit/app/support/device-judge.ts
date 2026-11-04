import { vi } from 'vitest'
import type { DeviceJudge, DeviceStatus } from '@/judges/device/client'

// Keep the full client contract checked. Tests supply the operations they use;
// an unexpected load or score must fail rather than silently return undefined.
export function deviceJudgeDouble(
  status: DeviceStatus = 'off',
  overrides: Partial<Omit<DeviceJudge, 'ready' | 'status'>> = {},
): DeviceJudge {
  return {
    ready: status === 'ready',
    status,
    subscribe: vi.fn(() => () => undefined),
    load: vi.fn(() => {
      throw new Error('Unexpected device load')
    }),
    score: vi.fn(() => {
      throw new Error('Unexpected device score')
    }),
    cancel: vi.fn(),
    remove: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}
