import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

import { i18n, LANGUAGE_STORAGE_KEY } from '../i18n'

// waitFor / findBy* default to 1s, which heavy route renders (e.g. the onboarding redirect to
// Settings > Import) can exceed when the whole suite runs in parallel. They still resolve as soon
// as the assertion passes; this is only the upper bound.
configure({ asyncUtilTimeout: 3000 })

// Radix popovers measure themselves with ResizeObserver, which jsdom does not implement.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

// Same clock for every test, so results never depend on the day the suite runs. Only Date is
// faked: timers stay real for waitFor and findBy*. A test can move it with vi.setSystemTime.
const TEST_NOW = new Date('2026-06-15T12:00:00')

const freezeClock = () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TEST_NOW)
}

// Test files read the month at import time too, so the clock must be fixed before they load.
freezeClock()

beforeEach(() => {
  freezeClock()
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-BR')
  void i18n.changeLanguage('pt-BR')
})

// Automatically clean up rendered DOM and reset storage/language after each test
afterEach(() => {
  vi.useRealTimers()
  cleanup()
  localStorage.clear()
  if (typeof document !== 'undefined') {
    document.cookie = ''
  }
  void i18n.changeLanguage('pt-BR')
})

