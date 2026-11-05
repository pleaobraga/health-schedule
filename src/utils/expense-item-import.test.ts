import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'

import {
  EXPENSE_IMPORT_MAX_BYTES,
  mergeImportedLines,
  parseExpenseItemsFile,
} from './expense-item-import'

const workbookFile = (
  rows: unknown[][],
  bookType: 'xlsx' | 'xls' = 'xlsx',
) => {
  const book = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Lista')
  const data = XLSX.write(book, { type: 'array', bookType })
  return new File([data], `lista.${bookType}`)
}

describe('parseExpenseItemsFile', () => {
  it('parses an xlsx file with Nome and Valor headers using default quantity 1', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['Fralda', 30],
      ['Lenço', 12.5],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [
        { name: 'Fralda', quantity: 1, amount: 30 },
        { name: 'Lenço', quantity: 1, amount: 12.5 },
      ],
      warnings: [],
    })
  })

  it('parses the same spreadsheet in xls format', async () => {
    const file = workbookFile(
      [
        ['Nome', 'Valor'],
        ['Fralda', 30],
        ['Lenço', 12.5],
      ],
      'xls',
    )

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [
        { name: 'Fralda', quantity: 1, amount: 30 },
        { name: 'Lenço', quantity: 1, amount: 12.5 },
      ],
      warnings: [],
    })
  })

  it('uses column A as name and column B as amount when no header row is present', async () => {
    const file = workbookFile([
      ['Fralda', 30],
      ['Lenço', 12.5],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [
        { name: 'Fralda', quantity: 1, amount: 30 },
        { name: 'Lenço', quantity: 1, amount: 12.5 },
      ],
      warnings: [],
    })
  })

  it('detects Produto, Qtd, and Preço columns by header name', async () => {
    const file = workbookFile([
      ['Produto', 'Qtd', 'Preço'],
      ['Fralda', 2, 30],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 2, amount: 30 }],
      warnings: [],
    })
  })

  it('imports an item without amount when only the name column exists', async () => {
    const file = workbookFile([['Nome'], ['Fralda']])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 1 }],
      warnings: [],
    })
  })

  it('parses currency-formatted text amounts using parseNumericRate', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['Fralda', 'R$ 10,50'],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 1, amount: 10.5 }],
      warnings: [],
    })
  })

  it('imports an item without amount and records an INVALID_AMOUNT warning when amount is non-numeric text', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['Fralda', 'abc'],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 1 }],
      warnings: [{ row: 2, code: 'INVALID_AMOUNT' }],
    })
  })

  it('imports an item without amount and records an INVALID_AMOUNT warning when amount is negative', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['Fralda', -5],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 1 }],
      warnings: [{ row: 2, code: 'INVALID_AMOUNT' }],
    })
  })

  it('accepts zero amount without warning for freebies', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['Brinde', 0],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Brinde', quantity: 1, amount: 0 }],
      warnings: [],
    })
  })

  it('defaults quantity to 1 and records an INVALID_QUANTITY warning when quantity is 0 or invalid', async () => {
    const file = workbookFile([
      ['Nome', 'Qtd'],
      ['Fralda', 0],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 1 }],
      warnings: [{ row: 2, code: 'INVALID_QUANTITY' }],
    })
  })

  it('ignores blank rows and rows without a name while preserving row numbers', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['Fralda', 10],
      [null, 5],
      ['', 1],
      ['Lenço', 2],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [
        { name: 'Fralda', quantity: 1, amount: 10 },
        { name: 'Lenço', quantity: 1, amount: 2 },
      ],
      warnings: [],
    })
  })

  it('merges duplicate item names (by normalizeItemName) by summing quantities and amounts', async () => {
    const file = workbookFile([
      ['Nome', 'Qtd', 'Valor'],
      ['Fralda', 1, 10],
      [' fralda ', 2, 20],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 3, amount: 30 }],
      warnings: [],
    })
  })

  it('rounds summed amounts to cents (0.1 + 0.2 = 0.3)', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['Fralda', 0.1],
      ['fralda', 0.2],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: 'Fralda', quantity: 2, amount: 0.3 }],
      warnings: [],
    })
  })

  it('returns TOO_MANY_ITEMS when more than 200 distinct items remain after grouping', async () => {
    const rows: unknown[][] = [['Nome', 'Valor']]
    for (let i = 1; i <= 201; i++) {
      rows.push([`Item ${i}`, i])
    }

    const result = await parseExpenseItemsFile(workbookFile(rows))
    expect(result).toEqual({ ok: false, code: 'TOO_MANY_ITEMS' })
  })

  it('succeeds when 300 rows collapse into 2 distinct item names', async () => {
    const rows: unknown[][] = [['Nome', 'Valor']]
    for (let i = 0; i < 300; i++) {
      rows.push([i % 2 === 0 ? 'Fralda' : 'Lenço', 1])
    }

    const result = await parseExpenseItemsFile(workbookFile(rows))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.lines).toHaveLength(2)
      expect(result.lines[0]).toEqual({
        name: 'Fralda',
        quantity: 150,
        amount: 150,
      })
      expect(result.lines[1]).toEqual({
        name: 'Lenço',
        quantity: 150,
        amount: 150,
      })
    }
  })

  it('returns EMPTY_FILE when the spreadsheet only contains headers', async () => {
    const file = workbookFile([['Nome', 'Valor']])
    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({ ok: false, code: 'EMPTY_FILE' })
  })

  it('returns UNREADABLE_FILE or EMPTY_FILE for an invalid file', async () => {
    const file = new File(['abc'], 'lista.xlsx')
    const result = await parseExpenseItemsFile(file)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['UNREADABLE_FILE', 'EMPTY_FILE']).toContain(result.code)
    }
  })

  it('returns FILE_TOO_LARGE without reading content when file exceeds 5 MB', async () => {
    const bigBuffer = new Uint8Array(EXPENSE_IMPORT_MAX_BYTES + 1)
    const file = new File([bigBuffer], 'huge.xlsx')

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({ ok: false, code: 'FILE_TOO_LARGE' })
  })

  it('treats __proto__ as a normal item name without prototype pollution', async () => {
    const file = workbookFile([
      ['Nome', 'Valor'],
      ['__proto__', 15],
    ])

    const result = await parseExpenseItemsFile(file)
    expect(result).toEqual({
      ok: true,
      lines: [{ name: '__proto__', quantity: 1, amount: 15 }],
      warnings: [],
    })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('mergeImportedLines', () => {
  it('appends new items at the end while preserving the order of existing lines', () => {
    const current = [
      { name: 'Fralda', quantity: 1, amount: 30 },
      { name: 'Pomada', quantity: 2, amount: 20 },
    ]
    const imported = [{ name: 'Lenço', quantity: 1, amount: 12 }]

    expect(mergeImportedLines(current, imported)).toEqual([
      { name: 'Fralda', quantity: 1, amount: 30 },
      { name: 'Pomada', quantity: 2, amount: 20 },
      { name: 'Lenço', quantity: 1, amount: 12 },
    ])
  })

  it('sums quantity and amount when an imported item matches an existing line by normalized name, preserving itemId', () => {
    const current = [
      { itemId: 'item-1', name: 'Fralda G', quantity: 1, amount: 0.1 },
    ]
    const imported = [{ name: ' fralda   g ', quantity: 2, amount: 0.2 }]

    expect(mergeImportedLines(current, imported)).toEqual([
      { itemId: 'item-1', name: 'Fralda G', quantity: 3, amount: 0.3 },
    ])
  })

  it('keeps amount undefined when both existing and imported lines have no amount, and uses present amount when only one has it', () => {
    const current = [
      { name: 'Fralda', quantity: 1 },
      { name: 'Lenço', quantity: 1, amount: 10 },
    ]
    const imported = [
      { name: 'Fralda', quantity: 2 },
      { name: 'Lenço', quantity: 1 },
    ]

    expect(mergeImportedLines(current, imported)).toEqual([
      { name: 'Fralda', quantity: 3 },
      { name: 'Lenço', quantity: 2, amount: 10 },
    ])
  })
})

