import { chooseOption, expect, loginAsGuest, openRoute, test } from './support/fixtures'

import type { Page } from '@playwright/test'

const purchaseCard = '[data-testid^="purchase-card-"]'

interface PurchaseInput {
  description: string
  amount: string
  itemName: string
  category?: string
}

async function registerPurchase(page: Page, purchase: PurchaseInput) {
  await page.getByTestId('purchases-new-button').click()
  const form = page.getByTestId('purchase-form-modal')
  await form.getByTestId('purchase-amount-input').fill(purchase.amount)
  await form.getByTestId('purchase-description-input').fill(purchase.description)
  if (purchase.category) {
    await chooseOption(page, 'purchase-category-select', purchase.category)
  }
  await form.getByTestId('purchase-add-line').click()
  await form.getByTestId('purchase-line-name-0').fill(purchase.itemName)
  await form.getByTestId('purchase-line-amount-0').fill(purchase.amount)
  await form.getByTestId('purchase-submit').click()
  await expect(form).toBeHidden()
}

const cardOf = (page: Page, description: string) =>
  page.locator(purchaseCard).filter({ hasText: description })

function toCents(text: string | null) {
  return Number((text ?? '').replace(/\D/g, ''))
}

/** The guest seed brings its own purchases, so totals are compared to a baseline. */
async function totalInCents(page: Page) {
  return toCents(await page.getByTestId('purchases-kpi-total').textContent())
}

async function listedAmountsInCents(page: Page) {
  const amounts = await page.locator('[data-testid^="purchase-amount-"]').allTextContents()
  return amounts.reduce((sum, amount) => sum + toCents(amount), 0)
}

const expectTotal = (page: Page, cents: number) =>
  expect.poll(() => totalInCents(page)).toBe(cents)

test.beforeEach(async ({ page }) => {
  await loginAsGuest(page)
  await openRoute(page, 'compras')
  await expect(page.getByTestId('purchases-view')).toBeVisible()
})

test('a new purchase shows up in the list and the totals, and survives a reload', async ({
  page,
}) => {
  const baseline = await totalInCents(page)

  await registerPurchase(page, {
    description: 'E2E Farmácia',
    amount: '12,50',
    itemName: 'E2E Dipirona',
  })

  await expect(cardOf(page, 'E2E Farmácia')).toContainText('E2E Dipirona')
  await expectTotal(page, baseline + 1250)

  await page.reload()

  await expect(cardOf(page, 'E2E Farmácia')).toBeVisible()
  await expectTotal(page, baseline + 1250)
})

test('asks for the required fields before saving', async ({ page }) => {
  const cardsBefore = await page.locator(purchaseCard).count()

  await page.getByTestId('purchases-new-button').click()
  const form = page.getByTestId('purchase-form-modal')
  await form.getByTestId('purchase-submit').click()

  await expect(form.getByTestId('purchase-form-errors')).toBeVisible()
  await form.getByRole('button', { name: 'Cancelar' }).click()
  await expect(form).toBeHidden()
  await expect(page.locator(purchaseCard)).toHaveCount(cardsBefore)
})

test('a purchase belongs to its month', async ({ page }) => {
  await registerPurchase(page, {
    description: 'E2E Junho',
    amount: '30,00',
    itemName: 'E2E Gaze',
  })

  await page.getByTestId('purchases-next-month').click()
  await expect(page.getByTestId('purchases-current-month-label')).not.toContainText('Jun')
  await expect(cardOf(page, 'E2E Junho')).toHaveCount(0)

  await page.getByTestId('purchases-prev-month').click()
  await expect(cardOf(page, 'E2E Junho')).toBeVisible()
})

test('filters by category, then clears the filter', async ({ page }) => {
  await registerPurchase(page, {
    description: 'E2E Remédios',
    amount: '20,00',
    itemName: 'E2E Dipirona',
    category: 'MEDICATION',
  })
  await registerPurchase(page, {
    description: 'E2E Corrida',
    amount: '15,00',
    itemName: 'E2E Uber',
    category: 'TRANSPORT',
  })
  const allCards = await page.locator(purchaseCard).count()
  const allTotal = await totalInCents(page)

  await chooseOption(page, 'purchases-filter-category', 'TRANSPORT')

  await expect(cardOf(page, 'E2E Corrida')).toBeVisible()
  await expect(cardOf(page, 'E2E Remédios')).toHaveCount(0)
  await expect.poll(() => totalInCents(page)).toBeLessThan(allTotal)
  expect(await totalInCents(page)).toBe(await listedAmountsInCents(page))

  await page.getByTestId('purchases-clear-filters').click()

  await expect(page.locator(purchaseCard)).toHaveCount(allCards)
  await expectTotal(page, allTotal)
})

test('edits a purchase and updates the totals', async ({ page }) => {
  await registerPurchase(page, {
    description: 'E2E Original',
    amount: '10,00',
    itemName: 'E2E Luvas',
  })
  const baseline = await totalInCents(page)

  await cardOf(page, 'E2E Original').getByRole('button', { name: /^Editar compra/ }).click()
  const form = page.getByTestId('purchase-form-modal')
  await form.getByTestId('purchase-description-input').fill('E2E Corrigida')
  await form.getByTestId('purchase-amount-input').fill('25,00')
  await form.getByTestId('purchase-line-amount-0').fill('25,00')
  await form.getByTestId('purchase-submit').click()
  await expect(form).toBeHidden()

  await expect(cardOf(page, 'E2E Corrigida')).toBeVisible()
  await expect(cardOf(page, 'E2E Original')).toHaveCount(0)
  await expectTotal(page, baseline + 1500)
})

test('deleting a purchase keeps its item in the catalog', async ({ page }) => {
  await registerPurchase(page, {
    description: 'E2E Descartável',
    amount: '8,00',
    itemName: 'E2E Álcool',
  })
  const baseline = await totalInCents(page)

  await cardOf(page, 'E2E Descartável').getByRole('button', { name: /^Excluir compra/ }).click()
  await page.getByRole('button', { name: 'Excluir Compra', exact: true }).click()

  await expect(cardOf(page, 'E2E Descartável')).toHaveCount(0)
  await expectTotal(page, baseline - 800)

  await page.getByTestId('purchases-open-catalog').click()
  await expect(page.getByTestId('purchases-item-catalog')).toContainText('E2E Álcool')
})

test('the same item bought twice has one catalog entry with its history', async ({ page }) => {
  await registerPurchase(page, {
    description: 'E2E Primeira',
    amount: '5,00',
    itemName: 'E2E Soro',
  })
  await registerPurchase(page, {
    description: 'E2E Segunda',
    amount: '6,00',
    itemName: 'E2E Soro',
  })

  await page.getByTestId('purchases-open-catalog').click()
  const entry = page.locator('[data-testid^="catalog-item-"]').filter({ hasText: 'E2E Soro' })
  await expect(entry).toHaveCount(1)

  await entry.locator('[data-testid^="catalog-history-"]').click()

  const history = page.getByTestId('item-history')
  await expect(history.getByTestId('item-history-last-date')).toBeVisible()
})
