import { describe, expect, it } from 'vitest'

type LocaleTree = { [key: string]: string | LocaleTree }

const LANGUAGES = ['pt-BR', 'en-US']
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/

const localeFiles = import.meta.glob<LocaleTree>('./*/*.json', {
  eager: true,
  import: 'default',
})

const sourceFiles = import.meta.glob<string>(
  ['../**/*.{ts,tsx}', '!../**/*.{test,spec,stories}.{ts,tsx}'],
  { eager: true, query: '?raw', import: 'default' },
)

function flatten(tree: LocaleTree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((flat, [key, value]) => {
    const path = `${prefix}${key}`
    return typeof value === 'string'
      ? { ...flat, [path]: value }
      : { ...flat, ...flatten(value, `${path}.`) }
  }, {})
}

function readLocale(language: string) {
  const namespaces: Record<string, Record<string, string>> = {}
  for (const [path, tree] of Object.entries(localeFiles)) {
    const [, fileLanguage, namespace] = path.match(/^\.\/(.+)\/(.+)\.json$/) ?? []
    if (fileLanguage === language && namespace) {
      namespaces[namespace] = flatten(tree)
    }
  }
  return namespaces
}

function placeholdersOf(text: string) {
  return (text.match(/{{\s*[\w.]+/g) ?? []).map((match) => match.replace(/[{\s]/g, '')).sort()
}

function findKeysUsedInSource() {
  const keys = new Set<string>()
  for (const source of Object.values(sourceFiles)) {
    for (const [, key] of source.matchAll(/['"`]([a-zA-Z]+:[a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)['"`]/g)) {
      if (key) keys.add(key)
    }
  }
  return [...keys]
}

const [portuguese = {}, english = {}] = LANGUAGES.map(readLocale)

describe('locales', () => {
  it('has the same namespaces in every language', () => {
    expect(Object.keys(english).sort()).toEqual(Object.keys(portuguese).sort())
    expect(Object.keys(portuguese).length).toBeGreaterThan(0)
  })

  it.each(Object.keys(portuguese))('has the same keys in both languages: %s', (namespace) => {
    expect(Object.keys(english[namespace] ?? {}).sort()).toEqual(
      Object.keys(portuguese[namespace] ?? {}).sort(),
    )
  })

  it.each(Object.keys(portuguese))('has no empty text: %s', (namespace) => {
    for (const language of [portuguese, english]) {
      const empty = Object.entries(language[namespace] ?? {}).filter(
        ([, text]) => text.trim() === '',
      )
      expect(empty).toEqual([])
    }
  })

  it.each(Object.keys(portuguese))('has the same placeholders in both languages: %s', (namespace) => {
    const mismatches = Object.entries(portuguese[namespace] ?? {}).filter(
      ([key, text]) =>
        placeholdersOf(text).join() !== placeholdersOf(english[namespace]?.[key] ?? '').join(),
    )

    expect(mismatches.map(([key]) => key)).toEqual([])
  })

  it('defines every namespaced key used in the source', () => {
    const missing = findKeysUsedInSource().filter((fullKey) => {
      const [namespace = '', key = ''] = fullKey.split(':')
      const keys = portuguese[namespace]
      if (!keys) return false
      return !Object.keys(keys).some(
        (defined) =>
          defined === key ||
          defined.replace(PLURAL_SUFFIX, '') === key ||
          defined.startsWith(`${key}.`),
      )
    })

    expect(missing).toEqual([])
  })

  it('finds the keys used in the source', () => {
    expect(findKeysUsedInSource().length).toBeGreaterThan(500)
  })
})
