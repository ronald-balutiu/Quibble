import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

// The definition of done uses the same severity policy on every screen. Keep
// screen names and affected selectors in the failure, including expanded states.
export async function expectAccessible(page: Page, screen = page.url()) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  const serious = violations.filter(({ impact }) => impact === 'serious' || impact === 'critical')
  expect(serious.map(({ id, nodes }) => `${screen}: ${id} (${nodes.map(({ target }) => target.join(' ')).join(', ')})`)).toEqual([])
}
