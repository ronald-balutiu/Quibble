import { abortable } from '@shared/abort'
import { startSession, type SessionResult } from './api'

// Invisible Turnstile: one widget per renewal, owned by the complete guess's deadline.
const TEST_SITE_KEY = '1x00000000000000000000AA'
const PRODUCTION_SITE_KEY = '0x4AAAAAAFrzEYhfs8G-zzWN'
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      action: string
      execution: 'execute'
      appearance: 'interaction-only'
      callback: (token: string) => void
      'error-callback': () => void
    },
  ) => string
  execute: (widget: string) => void
  remove: (widget: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let script: Promise<TurnstileApi | undefined> | undefined

function loadScript(signal: AbortSignal): Promise<TurnstileApi | undefined> {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  script ??= new Promise((resolve) => {
    const element = document.createElement('script')
    const finish = () => {
      signal.removeEventListener('abort', failed)
      element.onload = null
      element.onerror = null
      if (!window.turnstile) {
        element.remove()
        script = undefined
      }
      resolve(window.turnstile)
    }
    const failed = () => {
      element.remove()
      script = undefined
      finish()
    }
    element.src = SCRIPT
    element.async = true
    element.onload = finish
    element.onerror = failed
    signal.addEventListener('abort', failed, { once: true })
    document.head.append(element)
  })
  return abortable(script, signal)
}

async function token(container: HTMLElement, signal: AbortSignal): Promise<string | undefined> {
  signal.throwIfAborted()
  const turnstile = await loadScript(signal)
  signal.throwIfAborted()
  if (!turnstile) return undefined
  let widget: string | undefined
  try {
    return await abortable(
      new Promise<string | undefined>((resolve) => {
        widget = turnstile.render(container, {
          sitekey: import.meta.env.DEV ? TEST_SITE_KEY : PRODUCTION_SITE_KEY,
          action: 'session',
          execution: 'execute',
          appearance: 'interaction-only',
          callback: resolve,
          'error-callback': () => {
            resolve(undefined)
          },
        })
        turnstile.execute(widget)
      }),
      signal,
    )
  } finally {
    if (widget !== undefined) turnstile.remove(widget)
  }
}

export async function renewSession(
  container: HTMLElement,
  signal: AbortSignal = AbortSignal.timeout(10_000),
): Promise<SessionResult> {
  const value = await token(container, signal)
  signal.throwIfAborted()
  return value ? startSession(value, fetch, signal) : 'botcheck'
}
