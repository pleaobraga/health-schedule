import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'

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

beforeEach(() => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-BR')
  void i18n.changeLanguage('pt-BR')
})

// Automatically clean up rendered DOM and reset storage/language after each test
afterEach(() => {
  cleanup()
  localStorage.clear()
  if (typeof document !== 'undefined') {
    document.cookie = ''
  }
  void i18n.changeLanguage('pt-BR')
})

