import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import enAddresses from './locales/en-US/addresses.json'
import enAuth from './locales/en-US/auth.json'
import enCalendar from './locales/en-US/calendar.json'
import enCommon from './locales/en-US/common.json'
import enImport from './locales/en-US/import.json'
import enPeople from './locales/en-US/people.json'
import enPurchases from './locales/en-US/purchases.json'
import enSettings from './locales/en-US/settings.json'
import enUsers from './locales/en-US/users.json'
import ptAddresses from './locales/pt-BR/addresses.json'
import ptAuth from './locales/pt-BR/auth.json'
import ptCalendar from './locales/pt-BR/calendar.json'
import ptCommon from './locales/pt-BR/common.json'
import ptImport from './locales/pt-BR/import.json'
import ptPeople from './locales/pt-BR/people.json'
import ptPurchases from './locales/pt-BR/purchases.json'
import ptSettings from './locales/pt-BR/settings.json'
import ptUsers from './locales/pt-BR/users.json'

export const LANGUAGE_STORAGE_KEY = 'health-schedule:language'

export const defaultNS = 'common'

/**
 * Detects the preferred initial language based on:
 * 1. Previously saved user preference (localStorage or cookies)
 * 2. Navigator preferred language (starts with 'pt' -> 'pt-BR', otherwise -> 'en-US')
 * 3. Fallback to 'en-US'
 */
export function detectInitialLanguage(): 'pt-BR' | 'en-US' {
  // 1. Check for saved preference in localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
      if (saved) {
        return saved === 'en-US' || saved.toLowerCase().startsWith('en')
          ? 'en-US'
          : 'pt-BR'
      }
    } catch {
      // Ignore localStorage read errors
    }
  }

  // 1b. Check for saved preference in cookies (if present)
  if (typeof document !== 'undefined' && document.cookie) {
    try {
      const match = document.cookie.match(
        new RegExp(`(?:^|; )${LANGUAGE_STORAGE_KEY}=([^;]*)`),
      )
      if (match && match[1]) {
        const decoded = decodeURIComponent(match[1])
        if (decoded) {
          return decoded === 'en-US' || decoded.toLowerCase().startsWith('en')
            ? 'en-US'
            : 'pt-BR'
        }
      }
    } catch {
      // Ignore cookie parsing errors
    }
  }

  // 2. Check navigator.language
  if (typeof navigator !== 'undefined' && navigator.language) {
    if (navigator.language.toLowerCase().startsWith('pt')) {
      return 'pt-BR'
    }
    return 'en-US'
  }

  // 3. Fallback to English
  return 'en-US'
}

export const resources = {
  'pt-BR': {
    common: ptCommon,
    auth: ptAuth,
    calendar: ptCalendar,
    people: ptPeople,
    purchases: ptPurchases,
    settings: ptSettings,
    addresses: ptAddresses,
    users: ptUsers,
    import: ptImport,
  },
  'en-US': {
    common: enCommon,
    auth: enAuth,
    calendar: enCalendar,
    people: enPeople,
    purchases: enPurchases,
    settings: enSettings,
    addresses: enAddresses,
    users: enUsers,
    import: enImport,
  },
} as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS,
    fallbackLng: 'pt-BR',
    lng: typeof localStorage !== 'undefined'
      ? (localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'pt-BR')
      : 'pt-BR',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'cookie', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      lookupCookie: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  })

export { i18n }

