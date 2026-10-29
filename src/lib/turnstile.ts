import { startSession, type SessionResult } from './api'

// Invisible Turnstile (plan 3.4, 3.11): a token for action "session", exchanged
// for the session cookie. Renewal runs the widget again silently.

// Cloudflare's published test site key, which always passes, for local development.
const TEST_SITE_KEY = '1x00000000000000000000AA'
// The production widget's site key: public by design, set when the widget exists.
const PRODUCTION_SITE_KEY = ''
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render(container: HTMLElement, options: {
    sitekey: string
    action: string
    execution: 'execute'
    appearance: 'interaction-only'
    callback: (token: string) => void
    'error-callback': () => void
  }): string
  execute(widget: string): void
  reset(widget: string): void
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let script: Promise<TurnstileApi | undefined> | undefined

function loadScript(): Promise<TurnstileApi | undefined> {
  script ??= new Promise((resolve) => {
    if (window.turnstile) { resolve(window.turnstile); return }
    const element = document.createElement('script')
    element.src = SCRIPT
    element.async = true
    element.onload = () => { resolve(window.turnstile) }
    element.onerror = () => { script = undefined; resolve(undefined) }
    document.head.append(element)
  })
  return script
}

function token(container: HTMLElement): Promise<string | undefined> {
  const sitekey = import.meta.env.DEV ? TEST_SITE_KEY : PRODUCTION_SITE_KEY
  if (!sitekey) return Promise.resolve(undefined)
  return loadScript().then((turnstile) => new Promise((resolve) => {
    if (!turnstile) { resolve(undefined); return }
    container.replaceChildren()
    const widget = turnstile.render(container, {
      sitekey,
      action: 'session',
      execution: 'execute',
      appearance: 'interaction-only',
      callback: (value) => { resolve(value) },
      'error-callback': () => { resolve(undefined) },
    })
    turnstile.execute(widget)
  }))
}

// Gets a fresh token from the widget in the container and starts a session.
export async function renewSession(container: HTMLElement): Promise<SessionResult> {
  const value = await token(container)
  return value ? startSession(value) : 'botcheck'
}
