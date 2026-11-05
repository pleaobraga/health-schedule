import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'

import { getCurrentMonth } from './date-utils'

import type {
  DailyExpense,
  DailyExpenseCategory,
  ExpenseInput,
  ExpenseItem,
  ExpenseLine,
  ExpenseLineInput,
} from '../types'

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

export interface ExpenseFilters {
  month: string // 'YYYY-MM'
  category?: DailyExpenseCategory
  personId?: string
  itemId?: string
}

export interface ExpenseLinesSummary {
  subtotal: number
  allLinesHaveAmount: boolean
  difference: number | null
}

export type ExpenseValidationCode =
  | 'DATE_INVALID'
  | 'DESCRIPTION_REQUIRED'
  | 'AMOUNT_INVALID'
  | 'ITEM_REQUIRED'
  | 'ITEM_NOT_FOUND'
  | 'QUANTITY_INVALID'
  | 'LINE_AMOUNT_INVALID'
  | 'DUPLICATE_ITEM'
  | 'EXPENSE_NOT_FOUND'

export interface ExpenseValidationError {
  code: ExpenseValidationCode
  lineIndex?: number
}

export function isValidIsoDateString(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const parsed = parseISO(dateStr)
  return isValid(parsed) && format(parsed, 'yyyy-MM-dd') === dateStr
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

export function createDefaultExpenseFilters(now?: Date): ExpenseFilters {
  return {
    month: now ? format(now, 'yyyy-MM') : getCurrentMonth(),
  }
}

export function filterExpenses(
  expenses: DailyExpense[],
  items: ExpenseItem[],
  filters: ExpenseFilters,
): DailyExpense[] {
  const targetItemIds = filters.itemId
    ? new Set(getMergedItemIds(resolveExpenseItemId(filters.itemId, items), items))
    : null

  const filtered = expenses.filter((exp) => {
    if (!exp.date.startsWith(`${filters.month}-`)) return false
    if (filters.category && exp.category !== filters.category) return false
    if (filters.personId && exp.personId !== filters.personId) return false
    if (targetItemIds && !exp.items.some((line) => targetItemIds.has(line.itemId))) {
      return false
    }
    return true
  })

  return filtered.sort((a, b) => {
    const dateCmp = b.date.localeCompare(a.date)
    if (dateCmp !== 0) return dateCmp
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function roundCents(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return rounded === 0 ? 0 : rounded
}

export function getExpenseLinesSummary(
  expense: Pick<DailyExpense, 'amount' | 'items'>,
): ExpenseLinesSummary {
  const lines = expense.items
  const rawSubtotal = lines.reduce(
    (sum, line) =>
      typeof line.amount === 'number' && Number.isFinite(line.amount)
        ? sum + line.amount
        : sum,
    0,
  )
  const subtotal = roundCents(rawSubtotal)
  const allLinesHaveAmount =
    lines.length > 0 &&
    lines.every(
      (line) => typeof line.amount === 'number' && Number.isFinite(line.amount),
    )
  const difference = allLinesHaveAmount
    ? roundCents(expense.amount - subtotal)
    : null

  return {
    subtotal,
    allLinesHaveAmount,
    difference,
  }
}

export function validateExpenseInput(
  input: ExpenseInput,
  items: ExpenseItem[],
): ExpenseValidationError[] {
  const errors: ExpenseValidationError[] = []

  if (!isValidIsoDateString(input.date)) {
    errors.push({ code: 'DATE_INVALID' })
  }

  if (!input.description || input.description.trim().length === 0) {
    errors.push({ code: 'DESCRIPTION_REQUIRED' })
  }

  if (
    typeof input.amount !== 'number' ||
    !Number.isFinite(input.amount) ||
    input.amount <= 0
  ) {
    errors.push({ code: 'AMOUNT_INVALID' })
  }

  const lines = input.items ?? []
  const byId = new Set(items.map((item) => item.id))
  const seenKeys = new Set<string>()

  lines.forEach((line, lineIndex) => {
    const itemId = line.itemId?.trim() ?? ''
    const normalizedName = line.name ? normalizeItemName(line.name) : ''

    if (!itemId && !normalizedName) {
      errors.push({ code: 'ITEM_REQUIRED', lineIndex })
    } else if (itemId && !byId.has(itemId)) {
      errors.push({ code: 'ITEM_NOT_FOUND', lineIndex })
    } else {
      let dedupeKey: string
      if (itemId) {
        // Keep itemId literal so old purchases with lines that were later merged remain editable
        dedupeKey = `id:${itemId}`
      } else {
        const existing = findExpenseItemByName(line.name ?? '', items)
        dedupeKey = existing
          ? `id:${resolveExpenseItemId(existing.id, items)}`
          : `name:${normalizedName}`
      }

      if (seenKeys.has(dedupeKey)) {
        errors.push({ code: 'DUPLICATE_ITEM', lineIndex })
      } else {
        seenKeys.add(dedupeKey)
      }
    }

    if (
      line.quantity !== undefined &&
      (typeof line.quantity !== 'number' ||
        !Number.isFinite(line.quantity) ||
        line.quantity <= 0)
    ) {
      errors.push({ code: 'QUANTITY_INVALID', lineIndex })
    }

    if (
      line.amount !== undefined &&
      (typeof line.amount !== 'number' ||
        !Number.isFinite(line.amount) ||
        line.amount < 0)
    ) {
      errors.push({ code: 'LINE_AMOUNT_INVALID', lineIndex })
    }
  })

  return errors
}

export function resolveExpenseLines(input: {
  lines: ExpenseLineInput[]
  items: ExpenseItem[]
  savedLines?: ExpenseLine[]
  now: string
  createId: () => string
}): { lines: ExpenseLine[]; items: ExpenseItem[] } {
  const nextItems = [...input.items]
  const resolvedLines: ExpenseLine[] = []

  for (const lineInput of input.lines) {
    const explicitItemId = lineInput.itemId?.trim()
    let targetItemId: string
    let targetItemName: string
    let savedLine: ExpenseLine | undefined

    if (explicitItemId) {
      savedLine = input.savedLines?.find((sl) => sl.itemId === explicitItemId)
      const registryItem = nextItems.find((it) => it.id === explicitItemId)
      targetItemId = explicitItemId
      targetItemName = savedLine
        ? savedLine.itemName
        : (registryItem?.name ?? '')
    } else {
      const cleanName = (lineInput.name ?? '').trim().replace(/\s+/g, ' ')
      const existing = findExpenseItemByName(cleanName, nextItems)

      if (existing) {
        const resolvedId = resolveExpenseItemId(existing.id, nextItems)
        const targetItem =
          nextItems.find((it) => it.id === resolvedId) ?? existing
        targetItemId = targetItem.id
        savedLine = input.savedLines?.find((sl) => sl.itemId === targetItemId)
        targetItemName = savedLine ? savedLine.itemName : targetItem.name
      } else {
        const newItem: ExpenseItem = {
          id: input.createId(),
          name: cleanName,
          normalizedName: normalizeItemName(cleanName),
          createdAt: input.now,
          updatedAt: input.now,
        }
        nextItems.push(newItem)
        targetItemId = newItem.id
        targetItemName = newItem.name
      }
    }

    const line: ExpenseLine = {
      id: lineInput.id ?? savedLine?.id ?? input.createId(),
      itemId: targetItemId,
      itemName: targetItemName,
      quantity: lineInput.quantity ?? 1,
      ...(lineInput.amount !== undefined ? { amount: lineInput.amount } : {}),
    }

    resolvedLines.push(line)
  }

  return {
    lines: resolvedLines,
    items: nextItems,
  }
}
