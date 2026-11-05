import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'

import type { DailyExpense, ExpenseItem } from '../types'

export const ITEM_SEARCH_MIN_LENGTH = 3
export const ITEM_SEARCH_MAX_RESULTS = 4

export interface ItemLastPurchase {
  lastPurchaseDate: string | null
  daysSinceLastPurchase: number | null
}

export interface ExpenseItemSuggestion extends ItemLastPurchase {
  item: ExpenseItem
}

export interface ItemLastPurchaseOptions {
  referenceDate: string // 'YYYY-MM-DD'
  excludeExpenseId?: string
}

export type ItemHistoryMode = 'LAST' | 'FULL'

export interface ItemHistoryEntry {
  date: string
  daysSincePrevious: number | null
}

export interface ItemHistory extends ItemLastPurchase {
  itemId: string
  entries: ItemHistoryEntry[]
  averageIntervalDays: number | null
}

export function isValidIsoDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const parsed = parseISO(dateStr)
  return isValid(parsed)
}

export function normalizeItemName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export function findExpenseItemByName(
  name: string,
  items: ExpenseItem[],
): ExpenseItem | undefined {
  const normalized = normalizeItemName(name)
  if (!normalized) return undefined

  const activeMatch = items.find(
    (item) =>
      !item.mergedIntoId &&
      (item.normalizedName || normalizeItemName(item.name)) === normalized,
  )
  if (activeMatch) return activeMatch

  return items.find(
    (item) => (item.normalizedName || normalizeItemName(item.name)) === normalized,
  )
}

export function resolveExpenseItemId(itemId: string, items: ExpenseItem[]): string {
  const byId = new Map(items.map((item) => [item.id, item]))
  const visited = new Set<string>()
  let current = itemId

  while (!visited.has(current)) {
    visited.add(current)
    const found = byId.get(current)
    if (!found || !found.mergedIntoId) {
      return current
    }
    current = found.mergedIntoId
  }

  return current
}

export function getMergedItemIds(itemId: string, items: ExpenseItem[]): string[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  const result = new Set<string>([itemId])

  for (const item of items) {
    const visited = new Set<string>()
    let current: string | undefined = item.id
    while (current && !visited.has(current)) {
      if (current === itemId) {
        result.add(item.id)
        break
      }
      visited.add(current)
      current = byId.get(current)?.mergedIntoId
    }
  }

  return Array.from(result)
}

export function getItemLastPurchase(
  itemId: string,
  items: ExpenseItem[],
  expenses: DailyExpense[],
  options: ItemLastPurchaseOptions,
): ItemLastPurchase {
  if (!isValidIsoDateString(options.referenceDate)) {
    return { lastPurchaseDate: null, daysSinceLastPurchase: null }
  }

  const canonicalId = resolveExpenseItemId(itemId, items)
  const targetIds = new Set(getMergedItemIds(canonicalId, items))

  let lastPurchaseDate: string | null = null

  for (const exp of expenses) {
    if (options.excludeExpenseId && exp.id === options.excludeExpenseId) continue
    if (!isValidIsoDateString(exp.date)) continue
    if (exp.date >= options.referenceDate) continue
    if (!exp.items.some((line) => targetIds.has(line.itemId))) continue

    if (!lastPurchaseDate || exp.date > lastPurchaseDate) {
      lastPurchaseDate = exp.date
    }
  }

  if (!lastPurchaseDate) {
    return { lastPurchaseDate: null, daysSinceLastPurchase: null }
  }

  const daysSinceLastPurchase = differenceInCalendarDays(
    parseISO(options.referenceDate),
    parseISO(lastPurchaseDate),
  )

  return { lastPurchaseDate, daysSinceLastPurchase }
}

export function searchExpenseItems(
  query: string,
  items: ExpenseItem[],
  expenses: DailyExpense[],
  options: ItemLastPurchaseOptions,
): ExpenseItemSuggestion[] {
  const normalizedQuery = normalizeItemName(query)
  if (normalizedQuery.length < ITEM_SEARCH_MIN_LENGTH) {
    return []
  }

  const matching = items.filter(
    (item) =>
      !item.mergedIntoId &&
      (item.normalizedName || normalizeItemName(item.name)).includes(normalizedQuery),
  )

  const suggestions: ExpenseItemSuggestion[] = matching.map((item) => {
    const last = getItemLastPurchase(item.id, items, expenses, options)
    return {
      item,
      ...last,
    }
  })

  suggestions.sort((a, b) => {
    if (a.lastPurchaseDate && b.lastPurchaseDate) {
      const dateCmp = b.lastPurchaseDate.localeCompare(a.lastPurchaseDate)
      if (dateCmp !== 0) return dateCmp
      return a.item.name.localeCompare(b.item.name, 'pt-BR')
    }
    if (a.lastPurchaseDate) return -1
    if (b.lastPurchaseDate) return 1
    return a.item.name.localeCompare(b.item.name, 'pt-BR')
  })

  return suggestions.slice(0, ITEM_SEARCH_MAX_RESULTS)
}

export function getItemHistory(
  itemId: string,
  items: ExpenseItem[],
  expenses: DailyExpense[],
  options: { mode: ItemHistoryMode; today: string },
): ItemHistory {
  const canonicalId = resolveExpenseItemId(itemId, items)
  const targetIds = new Set(getMergedItemIds(canonicalId, items))

  const dateSet = new Set<string>()
  for (const exp of expenses) {
    if (!isValidIsoDateString(exp.date)) continue
    if (exp.items.some((line) => targetIds.has(line.itemId))) {
      dateSet.add(exp.date)
    }
  }

  const dates = Array.from(dateSet).sort((a, b) => a.localeCompare(b))
  if (dates.length === 0) {
    return {
      itemId: canonicalId,
      lastPurchaseDate: null,
      daysSinceLastPurchase: null,
      averageIntervalDays: null,
      entries: [],
    }
  }

  const allEntries: ItemHistoryEntry[] = dates.map((date, idx) => {
    if (idx === 0) {
      return { date, daysSincePrevious: null }
    }
    const prevDate = dates[idx - 1]
    return {
      date,
      daysSincePrevious: differenceInCalendarDays(parseISO(date), parseISO(prevDate)),
    }
  })

  const lastPurchaseDate = dates[dates.length - 1]
  const daysSinceLastPurchase = isValidIsoDateString(options.today)
    ? Math.max(
        0,
        differenceInCalendarDays(parseISO(options.today), parseISO(lastPurchaseDate)),
      )
    : null

  let averageIntervalDays: number | null = null
  if (allEntries.length >= 2) {
    const intervals = allEntries
      .slice(1)
      .map((entry) => entry.daysSincePrevious ?? 0)
    const sum = intervals.reduce((acc, val) => acc + val, 0)
    averageIntervalDays = Math.round((sum / intervals.length) * 10) / 10
  }

  return {
    itemId: canonicalId,
    lastPurchaseDate,
    daysSinceLastPurchase,
    averageIntervalDays,
    entries:
      options.mode === 'LAST'
        ? [allEntries[allEntries.length - 1]]
        : allEntries,
  }
}
