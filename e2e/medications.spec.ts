import {
  backgroundOf,
  chooseOption,
  expect,
  importMedicationVersions,
  loginAsGuest,
  openRoute,
  test,
} from './support/fixtures'

import type { Locator, Page } from '@playwright/test'

const FIRST_VERSION = 'medver_e2e_1'
const VERSION_SELECT = 'medications-version-select'
const SPECIALTY_FILTER = 'medications-specialty-filter'

const header = (page: Page, id: string) => page.getByTestId(`medication-col-header-${id}`)
const doseCell = (page: Page, id: string, time: string) =>
  page.getByTestId(`medication-dose-cell-${id}-${time}`)
const timeButton = (page: Page, time: string) =>
  page
    .getByTestId('medications-schedule-table')
    .getByRole('button', { name: time, exact: true })

async function leftOf(locator: Locator) {
  const box = await locator.boundingBox()
  return box?.x ?? Number.NaN
}

test.beforeEach(async ({ page }) => {
  await loginAsGuest(page)
})

test('creates the first version with a real date picker and keeps it after a reload', async ({
  page,
}) => {
  await openRoute(page, 'medicamentos')
  await page.getByTestId('medications-create-first-button').click()

  const form = page.getByTestId('medication-version-form-modal')
  await page.getByTestId('medication-form-submit-button').click()
  await expect(page.getByTestId('medication-form-errors')).toBeVisible()

  await form.getByRole('button', { name: 'Selecione a data' }).click()
  await page.locator('button[data-day="2026-06-10"]').click()
  await page.getByTestId('medication-form-explanation-input').fill('Início do tratamento')
  await page.getByTestId('medication-add-column-button').click()
  await page.getByTestId('medication-name-input-0').fill('Quetiapina')
  await page.getByTestId('medication-add-time-button').click()
  await page.getByTestId('medication-time-input-0').fill('21:00')
  await page.getByTestId('medication-time-input-0').blur()
  await form.locator('[data-testid^="medication-dose-input-"]').fill('1.5 comprimidos')
  await page.getByTestId('medication-form-submit-button').click()

  const table = page.getByTestId('medications-schedule-table')
  await expect(table).toContainText('Quetiapina')
  await expect(table).toContainText('1.5 comprimidos')

  await page.reload()

  await expect(page.getByTestId('medications-schedule-table')).toContainText(
    '1.5 comprimidos',
  )
})

test.describe('with saved versions', () => {
  test.beforeEach(async ({ page }) => {
    await importMedicationVersions(page)
  })

  test('switches versions through the select menu and returns to the current one', async ({
    page,
  }) => {
    const table = page.getByTestId('medications-schedule-table')
    await expect(table).toContainText('Dutam')

    await chooseOption(page, VERSION_SELECT, FIRST_VERSION)

    await expect(table).not.toContainText('Dutam')
    await expect(page.getByTestId('medications-viewing-historical-badge')).toBeVisible()

    await page.getByTestId('medications-back-to-current').click()

    await expect(table).toContainText('Dutam')
    await expect(page.getByTestId('medications-current-badge')).toBeVisible()
  })

  test('paints the columns of the chosen specialty', async ({ page }) => {
    const plainBackground = await backgroundOf(header(page, 'med_quet'))

    await chooseOption(page, SPECIALTY_FILTER, 'psiquiatra')

    await expect(header(page, 'med_quet')).toHaveAttribute('data-highlighted', 'specialty')
    await expect(header(page, 'med_mela')).toHaveAttribute('data-highlighted', 'specialty')
    expect(await backgroundOf(header(page, 'med_quet'))).not.toBe(plainBackground)
    expect(await backgroundOf(header(page, 'med_dut'))).toBe(plainBackground)
  })

  test('paints the doses of the clicked time, in its own color', async ({ page }) => {
    const plainColor = await backgroundOf(doseCell(page, 'med_vitd', '08:00'))
    await chooseOption(page, SPECIALTY_FILTER, 'neurologista')
    const specialtyColor = await backgroundOf(doseCell(page, 'med_lamo', '08:00'))

    await timeButton(page, '08:00').click()

    const timeColor = await backgroundOf(doseCell(page, 'med_lamo', '08:00'))
    expect(timeColor).not.toBe(specialtyColor)
    expect(timeColor).not.toBe(plainColor)
    expect(await backgroundOf(doseCell(page, 'med_vitd', '08:00'))).toBe(timeColor)
    await expect(header(page, 'med_dut')).not.toHaveAttribute('data-highlighted', 'time')

    await timeButton(page, '08:00').click()

    expect(await backgroundOf(doseCell(page, 'med_lamo', '08:00'))).toBe(specialtyColor)
  })

  test('gives each specialty its own tag color', async ({ page }) => {
    const tag = (id: string) => page.getByTestId(`medication-col-specialty-${id}`)

    const psychiatry = await backgroundOf(tag('med_quet'))

    expect(await backgroundOf(tag('med_dut'))).not.toBe(psychiatry)
    expect(await backgroundOf(tag('med_mela'))).toBe(psychiatry)
  })

  test('centers the doses and keeps the time column pinned while scrolling', async ({
    page,
  }) => {
    const firstTime = timeButton(page, '08:00')
    const scroller = page.getByTestId('medications-table-scroll-container')
    const timeLeft = await leftOf(firstTime)
    const columnLeft = await leftOf(header(page, 'med_prol'))

    await expect(doseCell(page, 'med_lamo', '08:00')).toHaveCSS('text-align', 'center')

    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })

    await expect.poll(() => leftOf(header(page, 'med_prol'))).toBeLessThan(columnLeft)
    expect(await leftOf(firstTime)).toBe(timeLeft)
  })

  test('opens the table in full screen and leaves with Escape', async ({ page }) => {
    const card = page.getByTestId('medications-schedule-card')
    const viewport = page.viewportSize()

    await page.getByTestId('medications-fullscreen-toggle').click()

    await expect(card).toHaveCSS('position', 'fixed')
    expect((await card.boundingBox())?.width).toBe(viewport?.width)
    await expect(page.getByTestId('medications-schedule-table')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(card).not.toHaveCSS('position', 'fixed')
  })

  test('corrects a version without creating another one', async ({ page }) => {
    await page.getByTestId('medications-edit-version-button').click()
    await page.getByTestId('medication-form-explanation-input').fill('Texto corrigido')
    await page.getByTestId('medication-form-submit-button').click()

    await expect(page.getByTestId('medication-version-form-modal')).toBeHidden()
    await expect(page.getByText('Texto corrigido').first()).toBeVisible()
    await expect(page.getByTestId(VERSION_SELECT).locator('option')).toHaveCount(2)
  })

  test('pins the time column of the doses table in the version form', async ({ page }) => {
    await page.getByTestId('medications-edit-version-button').click()
    const firstDose = page.getByTestId('medication-dose-input-med_lamo-08:00')
    await firstDose.scrollIntoViewIfNeeded()
    const row = firstDose.locator('xpath=ancestor::tr')
    const timeCell = row.locator('td').first()
    const scroller = firstDose.locator('xpath=ancestor::div[contains(@class, "overflow-x-auto")]')
    const timeLeft = await leftOf(timeCell)
    const doseLeft = await leftOf(firstDose)

    await scroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })

    await expect.poll(() => leftOf(firstDose)).toBeLessThan(doseLeft)
    expect(await leftOf(timeCell)).toBe(timeLeft)
    await expect(firstDose).not.toHaveAttribute('placeholder')
  })

  test('deletes the latest version and falls back to the previous one', async ({ page }) => {
    await page.getByTestId('medications-delete-version-button').click()
    await page.getByRole('button', { name: 'Sim, excluir versão' }).click()

    await expect(page.getByTestId('medications-schedule-table')).not.toContainText('Dutam')
    await expect(page.getByTestId(VERSION_SELECT).locator('option')).toHaveCount(1)
  })
})
