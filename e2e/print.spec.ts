import {
  chooseOption,
  expect,
  importMedicationVersions,
  loginAsGuest,
  test,
} from './support/fixtures'

import type { Page } from '@playwright/test'

const PRINTED_TITLES = '__printedTitles'

function countPdfPages(pdf: Buffer) {
  return pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0
}

function printedTitles(page: Page) {
  return page.evaluate(
    (key) => (window as unknown as Record<string, string[]>)[key] ?? [],
    PRINTED_TITLES,
  )
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((key) => {
    const titles: string[] = []
    Object.assign(window, { [key]: titles })
    window.print = () => {
      titles.push(document.title)
    }
  }, PRINTED_TITLES)
  await loginAsGuest(page)
})

test.describe('medication schedule', () => {
  const sheet = '#medication-print-sheet'

  test.beforeEach(async ({ page }) => {
    await importMedicationVersions(page)
  })

  test('names the file after the version and restores the page title', async ({ page }) => {
    const titleBefore = await page.title()

    await page.getByTestId('medications-print-button').click()

    expect(await printedTitles(page)).toEqual(['medicamentos-10-05-2026'])
    expect(await page.title()).toBe(titleBefore)
  })

  test('prints an older version with its own date and no later changes', async ({ page }) => {
    await chooseOption(page, 'medications-version-select', 'medver_e2e_1')
    await page.emulateMedia({ media: 'print' })

    await expect(page.locator(sheet)).toContainText('01/03/2026')
    await expect(page.locator(sheet)).not.toContainText('Dutam')
    await expect(page.locator(sheet)).not.toContainText('Inclusão de novos medicamentos')
  })

  test('shows only the sheet, with every column inside the page', async ({ page }) => {
    await page.emulateMedia({ media: 'print' })

    await expect(page.locator(sheet)).toBeVisible()
    await expect(page.getByTestId('medications-view')).toBeHidden()

    const table = page.getByTestId('medication-print-table')
    const overflow = await table.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await expect(table.getByText('Losartana')).toBeVisible()
  })

  test('stays on a light theme when the app is dark', async ({ page }) => {
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.emulateMedia({ media: 'print' })

    const colors = await page.locator(sheet).evaluate((element) => {
      const style = getComputedStyle(element)
      return { background: style.backgroundColor, text: style.color }
    })

    expect(colors.background).toBe('rgb(255, 255, 255)')
    expect(colors.text).not.toBe('rgb(255, 255, 255)')
  })

  test('produces a PDF with the schedule, then the sources and changes', async ({ page }) => {
    const pdf = await page.pdf({ format: 'A4', printBackground: true })

    expect(countPdfPages(pdf)).toBe(2)
  })
})

test.describe('calendar', () => {
  async function printCalendar(page: Page) {
    await page.getByTestId('calendar-actions-dropdown-trigger').click()
    await page.getByRole('menuitem', { name: 'Imprimir / PDF' }).click()
  }

  test('prints the month from the full screen view with a dated file name', async ({ page }) => {
    await printCalendar(page)

    await expect.poll(() => printedTitles(page)).toEqual(['escala-6-2026'])
  })

  test('produces a short PDF with the whole month and no app navigation', async ({ page }) => {
    await printCalendar(page)
    await expect.poll(() => printedTitles(page)).toHaveLength(1)
    await page.emulateMedia({ media: 'print' })

    await expect(page.getByTestId('hover-sidebar')).toBeHidden()
    await expect(page.getByTestId('fullscreen-day-number-2026-06-01')).toBeVisible()
    await expect(page.getByTestId('fullscreen-day-number-2026-06-30')).toBeVisible()

    const pdf = await page.pdf({ format: 'A4', landscape: true, printBackground: true })

    expect(countPdfPages(pdf)).toBeGreaterThan(0)
    expect(countPdfPages(pdf)).toBeLessThanOrEqual(2)
  })
})
