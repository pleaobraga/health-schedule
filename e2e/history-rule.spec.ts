import {
  dayCell,
  expect,
  loginAsGuest,
  monthCells,
  openRoute,
  renamePerson,
  test,
} from './support/fixtures'

import type { Page } from '@playwright/test'

const OLD_NAME = 'Dr. Rafael Duarte'

async function showPreviousMonth(page: Page) {
  await page.getByTitle('Mês anterior').click()
}

function peopleIn(page: Page, month: string, name: string) {
  return monthCells(page, month).filter({ hasText: name })
}

test.beforeEach(async ({ page }) => {
  await loginAsGuest(page)
})

test('renaming a person changes the current month and leaves past months alone', async ({
  page,
}) => {
  await renamePerson(page, OLD_NAME, 'Dr. Rafael Renomeado')

  await openRoute(page, 'calendario')
  await expect(peopleIn(page, '2026-06', 'Dr. Rafael Renomeado').first()).toBeVisible()

  await showPreviousMonth(page)
  await expect(peopleIn(page, '2026-05', OLD_NAME).first()).toBeVisible()
  await expect(peopleIn(page, '2026-05', 'Dr. Rafael Renomeado')).toHaveCount(0)
})

test('changing a shift code leaves past months alone', async ({ page }) => {
  await openRoute(page, 'turnos')
  await page
    .getByTestId('shifts-management-view')
    .getByTitle('Editar')
    .first()
    .click()
  await page.getByTestId('shift-form').locator('input.uppercase').fill('X12')
  await page.getByTestId('shift-form-footer').getByRole('button', { name: 'Salvar' }).click()

  await openRoute(page, 'calendario')
  await expect(
    monthCells(page, '2026-06').locator('[data-testid*="-X12"]').first(),
  ).toBeVisible()

  await showPreviousMonth(page)
  await expect(
    monthCells(page, '2026-05').locator('[data-testid$="-D12"]').first(),
  ).toBeVisible()
  await expect(monthCells(page, '2026-05').locator('[data-testid$="-X12"]')).toHaveCount(0)
})

test('a month becomes history once it is over', async ({ page }) => {
  await renamePerson(page, OLD_NAME, 'Dr. Rafael de Junho')

  await page.clock.setFixedTime(new Date('2026-07-02T12:00:00'))
  await page.reload()
  await renamePerson(page, 'Dr. Rafael de Junho', 'Dr. Rafael de Julho')

  await openRoute(page, 'calendario')
  await expect(peopleIn(page, '2026-07', 'Dr. Rafael de Julho').first()).toBeVisible()

  await showPreviousMonth(page)
  await expect(peopleIn(page, '2026-06', 'Dr. Rafael de Junho').first()).toBeVisible()
  await expect(peopleIn(page, '2026-06', 'Dr. Rafael de Julho')).toHaveCount(0)
})

test('a direct edit to a past month is still allowed', async ({ page }) => {
  await showPreviousMonth(page)
  const day = monthCells(page, '2026-05').filter({ hasText: OLD_NAME }).first()
  const date = (await day.getAttribute('data-testid'))?.replace('day-cell-', '') ?? ''

  await page.getByRole('button', { name: 'Edição' }).click()
  await dayCell(page, date).getByRole('button', { name: /^Remover/ }).first().click()
  await page.getByTestId('edit-notice-save-button').click()
  await page.reload()

  await expect(page.getByTestId('calendar-grid')).toBeVisible()
  await showPreviousMonth(page)
  await expect(dayCell(page, date).getByText(OLD_NAME)).toHaveCount(0)
})
