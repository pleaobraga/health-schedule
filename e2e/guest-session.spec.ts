import { createPerson, expect, loginAsGuest, openRoute, test } from './support/fixtures'

const personCard = '[data-testid^="person-card-"]'

test('runs without Firebase: guest entry only, and the session survives a reload', async ({
  page,
}) => {
  await page.goto('./')

  await expect(page.getByTestId('enter-as-guest-btn')).toBeVisible()
  await expect(page.getByTestId('login-page').locator('form')).toHaveCount(0)

  await loginAsGuest(page)
  await expect(page.getByTestId('calendar-view')).toBeVisible()

  await page.reload()

  await expect(page.getByTestId('calendar-view')).toBeVisible()
  await expect(page.getByTestId('login-page')).toBeHidden()
})

test.describe('with two guest profiles', () => {
  test.skip(({ isMobile }) => isMobile, 'logout lives in the desktop rail')

  const logout = (page: Parameters<typeof loginAsGuest>[0]) =>
    page.getByRole('button', { name: 'Sair da Conta' }).click()

  test('keeps each profile with its own data', async ({ page }) => {
    await loginAsGuest(page, 'Ana')
    await createPerson(page, 'Pessoa da Ana')
    await logout(page)

    await loginAsGuest(page, 'Bia')
    await openRoute(page, 'pessoas')
    await expect(page.locator(personCard).first()).toBeVisible()
    await expect(
      page.locator(personCard).filter({ hasText: 'Pessoa da Ana' }),
    ).toHaveCount(0)
    await logout(page)

    await page.getByTestId('enter-as-guest-btn').click()
    await page
      .locator('[data-testid^="guest-profile-"]')
      .filter({ hasText: 'Ana' })
      .locator('[data-testid^="select-guest-"]')
      .click()
    await expect(page.getByTestId('login-page')).toBeHidden()
    await openRoute(page, 'pessoas')

    await expect(
      page.locator(personCard).filter({ hasText: 'Pessoa da Ana' }),
    ).toBeVisible()
  })
})
