import type { ExpenseItem } from '../types'

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
