import { backgroundOf, expect, loginAsGuest, openRoute, test } from './support/fixtures'

import type { Page } from '@playwright/test'

async function switchToEnglish(page: Page) {
  await openRoute(page, 'configuracoes')
  await page
    .getByTestId('language-settings-card')
    .getByRole('button', { name: /^Idioma atual/ })
    .click()
  await page.getByRole('option', { name: /English/ }).click()
}

test.beforeEach(async ({ page }) => {
  await loginAsGuest(page)
})

test('switching to English translates every screen and survives a reload', async ({ page }) => {
  await switchToEnglish(page)

  await openRoute(page, 'compras')
  await expect(page.getByTestId('purchases-new-button')).toHaveText('New Purchase')

  await page.reload()

  await expect(page.getByTestId('purchases-new-button')).toHaveText('New Purchase')
  await expect(page.locator('body')).not.toContainText('Nova Compra')
})

test('switching language changes dates and months too', async ({ page }) => {
  await openRoute(page, 'compras')
  await expect(page.getByTestId('purchases-current-month-label')).toContainText(/jun/i)

  await switchToEnglish(page)
  await openRoute(page, 'calendario')

  await expect(page.getByTestId('calendar-view')).toContainText('June')
})

test('the theme switch works both ways and survives a reload', async ({ page }) => {
  await openRoute(page, 'configuracoes')
  const toggle = page.getByRole('button', { name: /^Alternar para Modo/ })
  const isDark = () => page.locator('html').evaluate((html) => html.classList.contains('dark'))
  const background = async () => {
    await page.mouse.move(0, 0)
    return backgroundOf(toggle)
  }
  const startedDark = await isDark()
  const firstBackground = await background()

  await toggle.click()
  await expect.poll(isDark).toBe(!startedDark)
  await expect.poll(background).not.toBe(firstBackground)

  await page.reload()
  await expect.poll(isDark).toBe(!startedDark)

  await toggle.click()
  await expect.poll(isDark).toBe(startedDark)
  await expect.poll(background).toBe(firstBackground)
})

test('the theme follows the system on the first visit', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.evaluate(() => localStorage.removeItem('theme'))

  await page.reload()

  await expect(page.locator('html')).toHaveClass(/dark/)
})
