import { dayCell, expect, loginAsGuest, test } from './support/fixtures'

import type { Page } from '@playwright/test'

const FILLED_DAY = '2026-06-01'
const FREE_DAY = '2026-06-22'

function shiftBadges(page: Page, date: string) {
  return dayCell(page, date).locator(`[data-testid^="shift-badge-${date}"]`)
}

async function removeFirstShift(page: Page, date: string) {
  await dayCell(page, date).getByRole('button', { name: /^Remover/ }).first().click()
  await expect(shiftBadges(page, date)).toHaveCount(0)
}

test.beforeEach(async ({ page }) => {
  await loginAsGuest(page)
  await expect(shiftBadges(page, FILLED_DAY)).toHaveCount(1)
  await page.getByRole('button', { name: 'Edição' }).click()
})

test('saves a removed shift, and it stays removed after a reload', async ({ page }) => {
  await removeFirstShift(page, FILLED_DAY)

  await page.getByTestId('edit-notice-save-button').click()
  await page.reload()

  await expect(page.getByTestId('calendar-grid')).toBeVisible()
  await expect(shiftBadges(page, FILLED_DAY)).toHaveCount(0)
})

test('discards a removed shift', async ({ page }) => {
  await removeFirstShift(page, FILLED_DAY)

  await page.getByRole('button', { name: 'Descartar' }).click()

  await expect(shiftBadges(page, FILLED_DAY)).toHaveCount(1)
})

test('adds a person to a free day through the candidate picker', async ({ page }) => {
  await expect(shiftBadges(page, FREE_DAY)).toHaveCount(0)

  await dayCell(page, FREE_DAY).getByRole('button', { name: 'Adicionar', exact: true }).click()
  await page.getByRole('button', { name: 'Dra. Camila Santos', exact: true }).click()

  await expect(dayCell(page, FREE_DAY)).toContainText('Dra. Camila Santos')

  await page.getByTestId('edit-notice-save-button').click()
  await page.reload()

  await expect(dayCell(page, FREE_DAY)).toContainText('Dra. Camila Santos')
})

test.describe('leaving edit mode with unsaved changes', () => {
  test.beforeEach(async ({ page }) => {
    await removeFirstShift(page, FILLED_DAY)
    await page.getByRole('button', { name: 'Visualização' }).click()
    await expect(page.getByTestId('unsaved-modal-body')).toBeVisible()
  })

  test('keeps editing', async ({ page }) => {
    await page.getByRole('button', { name: 'Continuar Editando' }).click()

    await expect(page.getByTestId('edit-notice')).toBeVisible()
    await expect(shiftBadges(page, FILLED_DAY)).toHaveCount(0)
  })

  test('discards the changes', async ({ page }) => {
    await page.getByRole('button', { name: 'Descartar Alterações' }).click()

    await expect(page.getByTestId('edit-notice')).toBeHidden()
    await expect(shiftBadges(page, FILLED_DAY)).toHaveCount(1)
  })

  test('saves the changes', async ({ page }) => {
    await page.getByRole('button', { name: 'Salvar e Sair' }).click()
    await expect(page.getByTestId('edit-notice')).toBeHidden()

    await page.reload()

    await expect(page.getByTestId('calendar-grid')).toBeVisible()
    await expect(shiftBadges(page, FILLED_DAY)).toHaveCount(0)
  })
})
