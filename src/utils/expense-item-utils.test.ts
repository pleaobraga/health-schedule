import { describe, expect, it } from 'vitest'

import {
  findExpenseItemByName,
  getItemHistory,
  getItemLastPurchase,
  getMergedItemIds,
  normalizeItemName,
  resolveExpenseItemId,
  searchExpenseItems,
} from './expense-item-utils'

import type { DailyExpense, ExpenseItem } from '../types'

const item = (id: string, name: string, mergedIntoId?: string): ExpenseItem => ({
  id,
  name,
  normalizedName: normalizeItemName(name),
  mergedIntoId,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
})

const purchase = (id: string, date: string, itemIds: string[]): DailyExpense => ({
  id,
  date,
  description: `Compra ${id}`,
  amount: 100,
  items: itemIds.map((itemId, idx) => ({
    id: `line_${id}_${idx}`,
    itemId,
    itemName: `Item ${itemId}`,
    quantity: 1,
  })),
  createdAt: `${date}T10:00:00.000Z`,
  updatedAt: `${date}T10:00:00.000Z`,
})

describe('expense-item-utils - names and merge chains', () => {
  it.each([
    ['  Fralda   G ', 'fralda g'],
    ['LENÇO', 'lenco'],
    ['Água', 'agua'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeItemName(input)).toBe(expected)
  })

  it('finds an item ignoring case, accents and spaces', () => {
    expect(findExpenseItemByName(' lenco ', [item('a', 'Lenço')])?.id).toBe('a')
  })

  it('finds a merged item by its old name', () => {
    const items = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
    expect(findExpenseItemByName('fraldas', items)?.id).toBe('a')
  })

  it('follows a merge chain to the final item', () => {
    const items = [item('a', 'A', 'b'), item('b', 'B', 'c'), item('c', 'C')]
    expect(resolveExpenseItemId('a', items)).toBe('c')
  })

  it('returns the same id for an unknown item', () => {
    expect(resolveExpenseItemId('x', [])).toBe('x')
    expect(getMergedItemIds('x', [])).toEqual(['x'])
  })

  it('lists an item and every item that leads to it', () => {
    const items = [item('a', 'A', 'b'), item('b', 'B', 'c'), item('c', 'C'), item('d', 'D')]
    expect([...getMergedItemIds('c', items)].sort()).toEqual(['a', 'b', 'c'])
  })

  it('ends on a merge cycle', () => {
    const items = [item('a', 'A', 'b'), item('b', 'B', 'a')]
    expect(['a', 'b']).toContain(resolveExpenseItemId('a', items))
    expect([...getMergedItemIds('a', items)].sort()).toEqual(['a', 'b'])
  })
})

describe('getItemLastPurchase', () => {
  const expenses = [
    purchase('e1', '2026-10-20', ['a']),
    purchase('e2', '2026-11-01', ['a']),
    purchase('e3', '2026-11-20', ['a']),
  ]
  const items = [item('a', 'Fralda')]

  it('counts days to the most recent earlier purchase', () => {
    expect(
      getItemLastPurchase('a', items, expenses, {
        referenceDate: '2026-11-01',
        excludeExpenseId: 'e2',
      }),
    ).toEqual({ lastPurchaseDate: '2026-10-20', daysSinceLastPurchase: 12 })
  })

  it('ignores purchases on or after the reference date', () => {
    expect(
      getItemLastPurchase('a', items, expenses, { referenceDate: '2026-10-20' }),
    ).toEqual({ lastPurchaseDate: null, daysSinceLastPurchase: null })
  })

  it('counts purchases of merged items', () => {
    const merged = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
    expect(
      getItemLastPurchase('b', merged, expenses, { referenceDate: '2026-11-02' })
        .lastPurchaseDate,
    ).toBe('2026-11-01')
  })

  it.each(['', 'invalida'])('returns nulls for the reference date "%s"', (referenceDate) => {
    expect(getItemLastPurchase('a', items, expenses, { referenceDate })).toEqual({
      lastPurchaseDate: null,
      daysSinceLastPurchase: null,
    })
  })
})

describe('searchExpenseItems', () => {
  const options = { referenceDate: '2026-11-10' }

  it('returns nothing below 3 normalized characters', () => {
    expect(searchExpenseItems('  fr ', [item('a', 'Fralda')], [], options)).toEqual([])
  })

  it('matches anywhere in the name, ignoring accents', () => {
    const result = searchExpenseItems('lenc', [item('a', 'Pacote de Lenço')], [], options)
    expect(result.map((s) => s.item.id)).toEqual(['a'])
  })

  it('hides merged items', () => {
    const items = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
    expect(searchExpenseItems('fral', items, [], options).map((s) => s.item.id)).toEqual([
      'b',
    ])
  })

  it('orders by most recent purchase, limits to 4 and adds days', () => {
    const items = ['a', 'b', 'c', 'd', 'e'].map((id) => item(id, `Fralda ${id}`))
    const expenses = [
      purchase('e1', '2026-11-01', ['c']),
      purchase('e2', '2026-10-01', ['d']),
    ]

    const result = searchExpenseItems('fralda', items, expenses, options)

    expect(result.map((s) => s.item.id)).toEqual(['c', 'd', 'a', 'b'])
    expect(result[0].daysSinceLastPurchase).toBe(9)
    expect(result[2].lastPurchaseDate).toBeNull()
  })
})

describe('getItemHistory', () => {
  const items = [item('a', 'Fralda')]
  const expenses = [
    purchase('e1', '2026-10-03', ['a']),
    purchase('e2', '2026-10-21', ['a']),
    purchase('e3', '2026-10-21', ['a']),
    purchase('e4', '2026-11-05', ['a']),
  ]

  it('returns every date with gaps in FULL mode', () => {
    expect(
      getItemHistory('a', items, expenses, { mode: 'FULL', today: '2026-11-10' }),
    ).toEqual({
      itemId: 'a',
      lastPurchaseDate: '2026-11-05',
      daysSinceLastPurchase: 5,
      averageIntervalDays: 16.5,
      entries: [
        { date: '2026-10-03', daysSincePrevious: null },
        { date: '2026-10-21', daysSincePrevious: 18 },
        { date: '2026-11-05', daysSincePrevious: 15 },
      ],
    })
  })

  it('returns only the latest entry in LAST mode, keeping the average', () => {
    const history = getItemHistory('a', items, expenses, {
      mode: 'LAST',
      today: '2026-11-10',
    })
    expect(history.entries).toEqual([{ date: '2026-11-05', daysSincePrevious: 15 }])
    expect(history.averageIntervalDays).toBe(16.5)
  })

  it('keeps working when the item is missing from the registry', () => {
    expect(
      getItemHistory('a', [], expenses, { mode: 'LAST', today: '2026-11-10' })
        .lastPurchaseDate,
    ).toBe('2026-11-05')
  })

  it('crosses a year boundary', () => {
    const yearEnd = [
      purchase('e1', '2026-12-31', ['a']),
      purchase('e2', '2027-01-01', ['a']),
    ]
    expect(
      getItemHistory('a', items, yearEnd, { mode: 'FULL', today: '2027-01-02' }).entries[1]
        .daysSincePrevious,
    ).toBe(1)
  })

  it('never reports negative days for a future purchase', () => {
    const future = [purchase('e1', '2026-12-01', ['a'])]
    expect(
      getItemHistory('a', items, future, { mode: 'LAST', today: '2026-11-10' })
        .daysSinceLastPurchase,
    ).toBe(0)
  })

  it('returns nulls for an item with no purchases', () => {
    expect(getItemHistory('a', items, [], { mode: 'FULL', today: '2026-11-10' })).toEqual({
      itemId: 'a',
      lastPurchaseDate: null,
      daysSinceLastPurchase: null,
      averageIntervalDays: null,
      entries: [],
    })
  })
})
