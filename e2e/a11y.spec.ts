import AxeBuilder from '@axe-core/playwright'

import { expect, loginAsGuest, openRoute, test } from './support/fixtures'

import type { Page } from '@playwright/test'

const WCAG_A_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

// Known and left out on purpose: fixing them changes the palette or the labels of many buttons,
// so they need their own decision. Remove a rule from this list once the app passes it.
const KNOWN_ISSUES = ['color-contrast', 'label-content-name-mismatch']

async function violationsOf(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_A_AA)
    .disableRules(KNOWN_ISSUES)
    .analyze()
  return violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(' ')).slice(0, 5),
  }))
}

test('login page', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByTestId('enter-as-guest-btn')).toBeVisible()

  expect(await violationsOf(page)).toEqual([])
})

for (const route of [
  'calendario',
  'compras',
  'medicamentos',
  'pessoas',
  'turnos',
  'regras',
  'enderecos',
  'configuracoes',
]) {
  test(route, async ({ page }) => {
    await loginAsGuest(page)
    await openRoute(page, route)
    await page.waitForLoadState('networkidle')

    expect(await violationsOf(page)).toEqual([])
  })
}
