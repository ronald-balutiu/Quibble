import { expect, test } from '@playwright/test'

// P1: the case study, with the published answer-key results and the privacy note.
test('the about page tells the story with the real results, and Privacy links reach it', async ({ page }) => {
  await page.goto('/about')
  await expect(page).toHaveTitle('About · Quibble')
  await expect(page.getByRole('heading', { level: 1, name: 'Two judges, one question: does it fit?' })).toBeVisible()
  for (const name of ['What this is', 'How judging works', 'Privacy', 'Credits']) await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
  await expect(page.getByText(/^On a held-out answer-key test of 146 hand-checked guesses/u)).toBeVisible()
  await expect(page.getByText(/^Library v1 • 256 puzzles • answer-key build \d+$/u)).toBeVisible()
  await expect(page.getByRole('link', { name: 'Play →' })).toHaveAttribute('href', '/play')

  // The settings drawer's footer links to the privacy section.
  await page.goto('/play')
  await page.getByRole('button', { name: 'Your data' }).click()
  await page.getByRole('link', { name: 'Privacy →' }).click()
  await expect(page).toHaveURL(/\/about#privacy$/u)
  await expect(page.getByRole('heading', { level: 2, name: 'Privacy' })).toBeVisible()
})
