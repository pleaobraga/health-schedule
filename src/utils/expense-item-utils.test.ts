import { describe, expect, it } from 'vitest'

import {
  createDefaultExpenseFilters,
  filterExpenses,
  findExpenseItemByName,
  getExpenseLinesSummary,
  getItemHistory,
  getItemLastPurchase,
  getMergedItemIds,
  normalizeItemName,
  resolveExpenseItemId,
  resolveExpenseLines,
  searchExpenseItems,
  validateExpenseInput,
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

describe('createDefaultExpenseFilters and filterExpenses', () => {
  const items = [
    item('a', 'Fraldas', 'b'),
    item('b', 'Fralda'),
    item('c', 'Luva'),
  ]

  const expenses: DailyExpense[] = [
    {
      ...purchase('sep', '2026-09-10', ['b']),
      category: 'SUPPLIES',
      personId: 'p1',
    },
    {
      ...purchase('oct1', '2026-10-05', ['a']),
      category: 'SUPPLIES',
      personId: 'p1',
      createdAt: '2026-10-05T08:00:00.000Z',
    },
    {
      ...purchase('oct2', '2026-10-05', ['c']),
      category: 'MEDICATION',
      personId: 'p2',
      createdAt: '2026-10-05T12:00:00.000Z',
    },
    {
      ...purchase('oct3', '2026-10-12', []),
      category: 'SUPPLIES',
      personId: 'p1',
      createdAt: '2026-10-12T09:00:00.000Z',
    },
    {
      ...purchase('nov', '2026-11-01', ['b']),
      category: 'SUPPLIES',
      personId: 'p1',
    },
  ]

  it('creates default filters for the given date month', () => {
    expect(createDefaultExpenseFilters(new Date(2026, 10, 5))).toEqual({
      month: '2026-11',
    })
  })

  it('filters by month and includes expenses without items, ordered by date desc then createdAt desc', () => {
    const result = filterExpenses(expenses, items, { month: '2026-10' })
    expect(result.map((e) => e.id)).toEqual(['oct3', 'oct2', 'oct1'])
  })

  it('filters by category, personId and itemId alone and combined, including merged items', () => {
    expect(
      filterExpenses(expenses, items, {
        month: '2026-10',
        category: 'MEDICATION',
      }).map((e) => e.id),
    ).toEqual(['oct2'])

    expect(
      filterExpenses(expenses, items, {
        month: '2026-10',
        personId: 'p1',
      }).map((e) => e.id),
    ).toEqual(['oct3', 'oct1'])

    expect(
      filterExpenses(expenses, items, {
        month: '2026-10',
        itemId: 'b',
      }).map((e) => e.id),
    ).toEqual(['oct1'])

    expect(
      filterExpenses(expenses, items, {
        month: '2026-10',
        category: 'SUPPLIES',
        personId: 'p1',
        itemId: 'b',
      }).map((e) => e.id),
    ).toEqual(['oct1'])
  })
})

describe('getExpenseLinesSummary', () => {
  it('calculates subtotal and difference when all lines have amounts', () => {
    expect(
      getExpenseLinesSummary({
        amount: 45,
        items: [
          { id: '1', itemId: 'a', itemName: 'A', amount: 30 },
          { id: '2', itemId: 'b', itemName: 'B', amount: 20 },
        ],
      }),
    ).toEqual({
      subtotal: 50,
      allLinesHaveAmount: true,
      difference: -5,
    })
  })

  it('returns null difference when a line has no amount', () => {
    expect(
      getExpenseLinesSummary({
        amount: 45,
        items: [
          { id: '1', itemId: 'a', itemName: 'A', amount: 30 },
          { id: '2', itemId: 'b', itemName: 'B' },
        ],
      }),
    ).toEqual({
      subtotal: 30,
      allLinesHaveAmount: false,
      difference: null,
    })
  })

  it('returns zero subtotal and null difference when there are no lines', () => {
    expect(
      getExpenseLinesSummary({
        amount: 45,
        items: [],
      }),
    ).toEqual({
      subtotal: 0,
      allLinesHaveAmount: false,
      difference: null,
    })
  })

  it('rounds floating point cents and normalizes -0 to 0', () => {
    const summary = getExpenseLinesSummary({
      amount: 0.3,
      items: [
        { id: '1', itemId: 'a', itemName: 'A', amount: 0.1 },
        { id: '2', itemId: 'b', itemName: 'B', amount: 0.2 },
      ],
    })
    expect(summary).toEqual({
      subtotal: 0.3,
      allLinesHaveAmount: true,
      difference: 0,
    })
    expect(Object.is(summary.difference, -0)).toBe(false)
  })
})

describe('validateExpenseInput', () => {
  const items = [item('a', 'Fralda'), item('b', 'Luva')]

  it('validates date, description, amount and line fields', () => {
    expect(
      validateExpenseInput(
        {
          date: '2026-02-30',
          description: '   ',
          amount: 0,
          items: [
            {},
            { itemId: 'unknown' },
            { itemId: 'a', quantity: 0 },
            { itemId: 'b', amount: -1 },
          ],
        },
        items,
      ),
    ).toEqual([
      { code: 'DATE_INVALID' },
      { code: 'DESCRIPTION_REQUIRED' },
      { code: 'AMOUNT_INVALID' },
      { code: 'ITEM_REQUIRED', lineIndex: 0 },
      { code: 'ITEM_NOT_FOUND', lineIndex: 1 },
      { code: 'QUANTITY_INVALID', lineIndex: 2 },
      { code: 'LINE_AMOUNT_INVALID', lineIndex: 3 },
    ])
  })

  it('detects duplicate items when matching an existing item by name and itemId', () => {
    expect(
      validateExpenseInput(
        {
          date: '2026-10-15',
          description: 'Farmácia',
          amount: 50,
          items: [{ itemId: 'a' }, { name: 'Fralda' }],
        },
        items,
      ),
    ).toEqual([{ code: 'DUPLICATE_ITEM', lineIndex: 1 }])
  })

  it('detects duplicate items by normalized name', () => {
    expect(
      validateExpenseInput(
        {
          date: '2026-10-15',
          description: 'Farmácia',
          amount: 50,
          items: [{ name: 'Fralda' }, { name: ' fralda ' }],
        },
        [],
      ),
    ).toEqual([{ code: 'DUPLICATE_ITEM', lineIndex: 1 }])
  })

  it('accepts a line with amount: 0', () => {
    expect(
      validateExpenseInput(
        {
          date: '2026-10-15',
          description: 'Farmácia',
          amount: 50,
          items: [{ itemId: 'a', amount: 0 }],
        },
        items,
      ),
    ).toEqual([])
  })
})

describe('resolveExpenseLines', () => {
  const createCounterId = () => {
    let count = 0
    return () => `gen_${++count}`
  }

  it('creates a new item once with normalized spaces and defaults quantity to 1', () => {
    const result = resolveExpenseLines({
      lines: [{ name: ' Fralda   G ' }],
      items: [],
      now: '2026-11-05T10:00:00.000Z',
      createId: createCounterId(),
    })

    expect(result.items).toEqual([
      {
        id: 'gen_1',
        name: 'Fralda G',
        normalizedName: 'fralda g',
        createdAt: '2026-11-05T10:00:00.000Z',
        updatedAt: '2026-11-05T10:00:00.000Z',
      },
    ])
    expect(result.lines).toEqual([
      {
        id: 'gen_2',
        itemId: 'gen_1',
        itemName: 'Fralda G',
        quantity: 1,
      },
    ])
  })

  it('reuses an existing item when matched by name', () => {
    const existing = [item('a', 'Fralda G')]
    const result = resolveExpenseLines({
      lines: [{ name: 'fralda g', quantity: 2, amount: 40 }],
      items: existing,
      now: '2026-11-05T10:00:00.000Z',
      createId: createCounterId(),
    })

    expect(result.items).toHaveLength(1)
    expect(result.lines).toEqual([
      {
        id: 'gen_1',
        itemId: 'a',
        itemName: 'Fralda G',
        quantity: 2,
        amount: 40,
      },
    ])
  })

  it('resolves a merged item name to the target item and its name', () => {
    const existing = [item('a', 'Fraldas', 'b'), item('b', 'Fralda')]
    const result = resolveExpenseLines({
      lines: [{ name: 'Fraldas', quantity: 1 }],
      items: existing,
      now: '2026-11-05T10:00:00.000Z',
      createId: createCounterId(),
    })

    expect(result.items).toHaveLength(2)
    expect(result.lines[0].itemId).toBe('b')
    expect(result.lines[0].itemName).toBe('Fralda')
  })

  it('preserves saved itemName for existing lines and uses current registry name for new lines when editing', () => {
    const existing = [item('a', 'Fralda Renomeada'), item('b', 'Luva Atual')]
    const result = resolveExpenseLines({
      lines: [
        { id: 'line_saved', itemId: 'a', quantity: 3 },
        { itemId: 'b', quantity: 1 },
      ],
      items: existing,
      savedLines: [
        { id: 'line_saved', itemId: 'a', itemName: 'Fralda Antiga', quantity: 2 },
      ],
      now: '2026-11-05T10:00:00.000Z',
      createId: createCounterId(),
    })

    expect(result.lines).toEqual([
      {
        id: 'line_saved',
        itemId: 'a',
        itemName: 'Fralda Antiga',
        quantity: 3,
      },
      {
        id: 'gen_1',
        itemId: 'b',
        itemName: 'Luva Atual',
        quantity: 1,
      },
    ])
  })
})
