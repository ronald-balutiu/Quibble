// @vitest-environment happy-dom
import type { renewSession } from '@/lib/turnstile'
import { beforeEach, expect, test, vi } from 'vitest'

type Api = NonNullable<Window['turnstile']>
type Options = Parameters<Api['render']>[1]
let renew: typeof renewSession
let controller: AbortController
let options: Options | undefined
let api: Api

beforeEach(async () => {
  vi.resetModules()
  delete window.turnstile
  document.head.querySelectorAll('script').forEach((element) => {
    element.remove()
  })
  // Keep script elements inert; tests deliver load/error events without network I/O.
  const append = document.head.append.bind(document.head)
  vi.spyOn(document.head, 'append').mockImplementation((...nodes) => {
    for (const node of nodes) if (node instanceof HTMLScriptElement) node.type = 'application/quibble-test'
    append(...nodes)
  })
  controller = new AbortController()
  options = undefined
  api = {
    render: vi.fn<Api['render']>((_container, next) => {
      options = next
      return 'widget-1'
    }),
    execute: vi.fn(),
    remove: vi.fn(),
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({}))),
  )
  renew = (await import('@/lib/turnstile')).renewSession
})

const container = () => document.createElement('div')
const script = () => {
  const element = document.head.querySelector('script')
  if (!element) throw new Error('Turnstile script was not requested')
  return element
}
const installed = () => {
  window.turnstile = api
}

async function renderWidget() {
  installed()
  const pending = renew(container(), controller.signal)
  await vi.waitFor(() => {
    expect(api.execute).toHaveBeenCalledWith('widget-1')
  })
  if (!options) throw new Error('Widget options were not supplied')
  return { pending, callbacks: options }
}

test('loads the API and exchanges the token using the complete attempt signal', async () => {
  const target = container()
  const pending = renew(target, controller.signal)
  expect(script().src).toBe('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit')
  installed()
  script().dispatchEvent(new Event('load'))
  await vi.waitFor(() => {
    expect(api.execute).toHaveBeenCalled()
  })
  options?.callback('token')
  await expect(pending).resolves.toBe('ok')
  expect(api.render).toHaveBeenCalledWith(target, expect.objectContaining({ action: 'session', execution: 'execute' }))
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    '/api/session',
    expect.objectContaining({ signal: controller.signal, body: JSON.stringify({ turnstileToken: 'token' }) }),
  )
  expect(api.remove).toHaveBeenCalledExactlyOnceWith('widget-1')
})

test('a failed script can be retried', async () => {
  const first = renew(container(), controller.signal)
  script().dispatchEvent(new Event('error'))
  await expect(first).resolves.toBe('botcheck')
  const retry = renew(container(), controller.signal)
  installed()
  script().dispatchEvent(new Event('load'))
  await vi.waitFor(() => {
    expect(api.execute).toHaveBeenCalled()
  })
  options?.callback('retry-token')
  await expect(retry).resolves.toBe('ok')
})

test('aborting a stalled script removes it and allows another attempt', async () => {
  const first = renew(container(), controller.signal)
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  expect(document.head.querySelector('script')).toBeNull()
  const retry = renew(container(), new AbortController().signal)
  installed()
  script().dispatchEvent(new Event('load'))
  await vi.waitFor(() => {
    expect(api.execute).toHaveBeenCalled()
  })
  options?.callback('retry')
  await expect(retry).resolves.toBe('ok')
})

test('widget errors clean up without starting a session', async () => {
  const { pending, callbacks } = await renderWidget()
  callbacks['error-callback']()
  await expect(pending).resolves.toBe('botcheck')
  expect(api.remove).toHaveBeenCalledWith('widget-1')
  expect(fetch).not.toHaveBeenCalled()
})

test('aborting a widget removes it, and its late token cannot create a session', async () => {
  const { pending, callbacks } = await renderWidget()
  const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  controller.abort()
  await rejected
  callbacks.callback('late-token')
  expect(api.remove).toHaveBeenCalledExactlyOnceWith('widget-1')
  expect(fetch).not.toHaveBeenCalled()
})

test('an already cancelled renewal never creates a widget', async () => {
  controller.abort()
  await expect(renew(container(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(api.render).not.toHaveBeenCalled()
  expect(document.head.querySelector('script')).toBeNull()
})

test('a script that loads without an API reports botcheck', async () => {
  const pending = renew(container(), controller.signal)
  script().dispatchEvent(new Event('load'))
  await expect(pending).resolves.toBe('botcheck')
})
