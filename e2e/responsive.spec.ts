import { dayCell, expect, loginAsGuest, openRoute, test } from './support/fixtures'

import type { Page } from '@playwright/test'

const ROUTES = [
  'calendario',
  'compras',
  'medicamentos',
  'pessoas',
  'turnos',
  'regras',
  'enderecos',
  'configuracoes',
]

/**
 * The layout root hides sideways overflow, so too-wide content gets cut off instead of making the
 * page scroll, and the main scroller would slide the whole screen. This finds what passes the
 * right edge with no smaller scroller, like a wide table's, that is meant to reach it.
 */
const unreachableElements = (page: Page) =>
  page.evaluate((screenWidth) => {
    const canScrollSideways = (element: Element) => {
      const { overflowX } = getComputedStyle(element)
      const isPageSized = element.clientHeight > window.innerHeight * 0.6
      return (overflowX === 'auto' || overflowX === 'scroll') && !isPageSized
    }
    const isInsideScroller = (element: Element) => {
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (canScrollSideways(parent)) return true
      }
      return false
    }

    return [...document.querySelectorAll('body *')]
      .filter((element) => {
        const { right, width, height } = element.getBoundingClientRect()
        const isVisible = width > 0 && height > 0 && getComputedStyle(element).position !== 'fixed'
        return isVisible && right > screenWidth + 1 && !isInsideScroller(element)
      })
      .map((element) => `${element.tagName} ${element.getAttribute('data-testid') ?? element.className}`)
      .slice(0, 5)
  }, page.viewportSize()?.width ?? 0)

test.beforeEach(async ({ page }) => {
  await loginAsGuest(page)
})

test('no screen cuts content off at the right edge', async ({ page }) => {
  for (const route of ROUTES) {
    await openRoute(page, route)
    await page.waitForLoadState('networkidle')

    expect(await unreachableElements(page), `cut off on ${route}`).toEqual([])
  }
})

test('the calendar fits the screen', async ({ page }) => {
  await openRoute(page, 'calendario')
  const viewport = page.viewportSize()
  const box = await dayCell(page, '2026-06-15').boundingBox()

  expect(box).not.toBeNull()
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(viewport?.width ?? 0)
})

test.describe('navigation', () => {
  test('phones get the bottom bar and it leads to purchases', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the bottom bar only exists on small screens')
    await openRoute(page, 'calendario')
    const nav = page.getByTestId('mobile-bottom-nav')

    await expect(nav).toBeVisible()
    await nav.getByRole('link', { name: 'Compras' }).click()

    await expect(page.getByTestId('purchases-view')).toBeVisible()
  })

  test('the bottom bar menu opens and closes', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the bottom bar only exists on small screens')
    await openRoute(page, 'calendario')

    await page.getByTestId('mobile-bottom-nav-more').click()
    await expect(page.getByTestId('mobile-fullscreen-menu')).toBeVisible()

    await page.getByTestId('mobile-menu-close').click()
    await expect(page.getByTestId('mobile-fullscreen-menu')).toBeHidden()
  })

  test('nothing is hidden behind the bottom bar', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the bottom bar only exists on small screens')
    await openRoute(page, 'pessoas')
    const lastCard = page.locator('[data-testid^="person-card-"]').last()

    await lastCard.scrollIntoViewIfNeeded()
    await page.evaluate(() => {
      const scrollers = [document.scrollingElement, ...document.querySelectorAll('main, main *')]
      for (const scroller of scrollers) scroller?.scrollTo?.({ top: scroller.scrollHeight })
    })

    const card = await lastCard.boundingBox()
    const bar = await page.getByTestId('mobile-bottom-nav').boundingBox()
    expect((card?.y ?? 0) + (card?.height ?? 0)).toBeLessThanOrEqual(bar?.y ?? 0)
  })

  test('desktops hide the bottom bar', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop layout')
    await openRoute(page, 'calendario')

    await expect(page.getByTestId('mobile-bottom-nav')).toBeHidden()
  })
})
