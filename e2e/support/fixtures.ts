import { expect, test as base } from '@playwright/test'

import type { Page } from '@playwright/test'

export const TODAY = '2026-06-15T12:00:00'

interface AppFixtures {
  appGuards: void
}

/**
 * Every test runs at a fixed date, fails on an uncaught page error, and fails on any request
 * that leaves localhost: guest mode must stay offline, and Firebase stays out of these tests.
 */
export const test = base.extend<AppFixtures>({
  appGuards: [
    async ({ page, context }, use) => {
      const externalRequests: string[] = []
      const pageErrors: string[] = []

      await page.clock.setFixedTime(new Date(TODAY))
      await context.route(
        (url) => url.hostname !== 'localhost',
        async (route) => {
          externalRequests.push(route.request().url())
          await route.abort()
        },
      )
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await use()

      expect(pageErrors, 'uncaught page errors').toEqual([])
      expect(externalRequests, 'requests that left localhost').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export async function loginAsGuest(page: Page, name = 'E2E') {
  await page.goto('./')
  await page.getByTestId('enter-as-guest-btn').click()
  await page.getByTestId('guest-modal').locator('input').first().fill(name)
  await page.getByTestId('create-guest-submit-btn').click()
  await expect(page.getByTestId('login-page')).toBeHidden()
}

export function openRoute(page: Page, route: string) {
  return page.goto(`./#/${route}`)
}

export function dayCell(page: Page, date: string) {
  return page.getByTestId(`day-cell-${date}`)
}

export function monthCells(page: Page, month: string) {
  return page.locator(`[data-testid^="day-cell-${month}"]`)
}

export async function renamePerson(page: Page, from: string, to: string) {
  await openRoute(page, 'pessoas')
  await page
    .locator('[data-testid^="person-card-"]')
    .filter({ hasText: from })
    .getByRole('button', { name: 'Editar' })
    .click()
  await page.locator('#person-name-input').fill(to)
  await page.getByRole('button', { name: 'Salvar Alterações' }).click()
  await expect(
    page.locator('[data-testid^="person-card-"]').filter({ hasText: to }),
  ).toBeVisible()
}

export async function createPerson(page: Page, name: string) {
  await openRoute(page, 'pessoas')
  await page.getByRole('button', { name: 'Novo Funcionário' }).click()
  await page.locator('#person-name-input').fill(name)
  await page.getByRole('button', { name: 'Cadastrar Funcionário' }).click()
  await expect(
    page.locator('[data-testid^="person-card-"]').filter({ hasText: name }),
  ).toBeVisible()
}

export async function importMedicationVersions(page: Page) {
  await openRoute(page, 'configuracoes?tab=importar')
  await page
    .getByTestId('backup-file-input')
    .setInputFiles('e2e/fixtures/medications-backup.json')
  await page.getByTestId('merge-restore-button').click()
  await expect(page.getByTestId('merge-restore-button')).toBeHidden()
  await openRoute(page, 'medicamentos')
  await expect(page.getByTestId('medications-schedule-table')).toBeVisible()
}

export async function chooseOption(page: Page, selectTestId: string, value: string) {
  await page.getByTestId(`${selectTestId}-trigger`).click()
  await page.getByTestId(`${selectTestId}-option-${value}`).click()
}

export function backgroundOf(locator: ReturnType<Page['locator']>) {
  return locator.evaluate((element) => getComputedStyle(element).backgroundColor)
}
