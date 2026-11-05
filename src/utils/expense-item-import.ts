import { normalizeItemName } from './expense-item-utils'
import { parseNumericRate } from './shift-rate-utils'

import type { ExpenseLineInput } from '../types'

export const EXPENSE_IMPORT_MAX_BYTES = 5 * 1024 * 1024
export const EXPENSE_IMPORT_MAX_ITEMS = 200

export interface ImportedExpenseLine {
  name: string
  quantity: number
  amount?: number
}

export interface ExpenseImportWarning {
  row: number
  code: 'INVALID_AMOUNT' | 'INVALID_QUANTITY'
}

export type ExpenseImportResult =
  | { ok: true; lines: ImportedExpenseLine[]; warnings: ExpenseImportWarning[] }
  | {
      ok: false
      code: 'FILE_TOO_LARGE' | 'TOO_MANY_ITEMS' | 'UNREADABLE_FILE' | 'EMPTY_FILE'
    }

const NAME_HEADERS = new Set(['nome', 'item', 'produto', 'descricao'])
const AMOUNT_HEADERS = new Set(['valor', 'preco', 'total'])
const QUANTITY_HEADERS = new Set(['quantidade', 'qtd'])

function roundCents(value: number): number {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

function hasValidSpreadsheetSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 4) return false

  // ZIP container (.xlsx)
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
  // CFB / OLE2 container (.xls)
  const isCfb =
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  // Raw BIFF stream (.xls)
  const isBiff =
    bytes[0] === 0x09 &&
    (bytes[1] === 0x08 ||
      bytes[1] === 0x04 ||
      bytes[1] === 0x02 ||
      bytes[1] === 0x00)

  return isZip || isCfb || isBiff
}

export async function parseExpenseItemsFile(
  file: File,
): Promise<ExpenseImportResult> {
  if (file.size > EXPENSE_IMPORT_MAX_BYTES) {
    return { ok: false, code: 'FILE_TOO_LARGE' }
  }

  let data: ArrayBuffer
  try {
    data = await file.arrayBuffer()
  } catch {
    return { ok: false, code: 'UNREADABLE_FILE' }
  }

  const bytes = new Uint8Array(data)
  if (bytes.length === 0 || !hasValidSpreadsheetSignature(bytes)) {
    return { ok: false, code: 'UNREADABLE_FILE' }
  }

  let rows: unknown[][]
  try {
    const XLSX = await import('xlsx')
    const workbook = XLSX.read(data, {
      type: 'array',
      cellFormula: false,
      cellHTML: false,
    })
    const firstSheetName = workbook.SheetNames?.[0]
    if (!firstSheetName) {
      return { ok: false, code: 'EMPTY_FILE' }
    }
    const sheet = workbook.Sheets[firstSheetName]
    if (!sheet) {
      return { ok: false, code: 'EMPTY_FILE' }
    }
    rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      raw: true,
      blankrows: true,
    })
  } catch {
    return { ok: false, code: 'UNREADABLE_FILE' }
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, code: 'EMPTY_FILE' }
  }

  const firstRow = Array.isArray(rows[0]) ? rows[0] : []
  const normalizedFirstRow = firstRow.map((cell) =>
    cell === null || cell === undefined ? '' : normalizeItemName(String(cell)),
  )

  const isHeaderRow = normalizedFirstRow.some(
    (h) => NAME_HEADERS.has(h) || AMOUNT_HEADERS.has(h) || QUANTITY_HEADERS.has(h),
  )

  let nameCol = 0
  let amountCol = 1
  let quantityCol = -1
  let startRowIndex = 0

  if (isHeaderRow) {
    const detectedNameCol = normalizedFirstRow.findIndex((h) =>
      NAME_HEADERS.has(h),
    )
    nameCol = detectedNameCol >= 0 ? detectedNameCol : 0
    amountCol = normalizedFirstRow.findIndex((h) => AMOUNT_HEADERS.has(h))
    quantityCol = normalizedFirstRow.findIndex((h) => QUANTITY_HEADERS.has(h))
    startRowIndex = 1
  }

  const grouped = new Map<string, ImportedExpenseLine>()
  const warnings: ExpenseImportWarning[] = []

  for (let i = startRowIndex; i < rows.length; i++) {
    const row = Array.isArray(rows[i]) ? rows[i] : []
    const spreadsheetRow = i + 1

    const rawName = row[nameCol]
    if (rawName === null || rawName === undefined) {
      continue
    }
    const cleanName = String(rawName).trim().replace(/\s+/g, ' ')
    const normalizedName = normalizeItemName(cleanName)
    if (!normalizedName) {
      continue
    }

    let quantity = 1
    if (quantityCol >= 0) {
      const rawQty = row[quantityCol]
      const isQtyEmpty =
        rawQty === null ||
        rawQty === undefined ||
        (typeof rawQty === 'string' && rawQty.trim() === '')
      if (!isQtyEmpty) {
        const parsedQty =
          typeof rawQty === 'number' ? rawQty : parseNumericRate(String(rawQty))
        if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
          quantity = 1
          warnings.push({ row: spreadsheetRow, code: 'INVALID_QUANTITY' })
        } else {
          quantity = roundCents(parsedQty)
        }
      }
    }

    let amount: number | undefined
    if (amountCol >= 0) {
      const rawAmount = row[amountCol]
      const isAmountEmpty =
        rawAmount === null ||
        rawAmount === undefined ||
        (typeof rawAmount === 'string' && rawAmount.trim() === '')
      if (!isAmountEmpty) {
        const parsedAmount =
          typeof rawAmount === 'number'
            ? rawAmount
            : parseNumericRate(String(rawAmount))
        if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
          amount = undefined
          warnings.push({ row: spreadsheetRow, code: 'INVALID_AMOUNT' })
        } else {
          amount = roundCents(parsedAmount)
        }
      }
    }

    const existing = grouped.get(normalizedName)
    if (!existing) {
      grouped.set(normalizedName, {
        name: cleanName,
        quantity,
        ...(amount !== undefined ? { amount } : {}),
      })
    } else {
      existing.quantity = roundCents(existing.quantity + quantity)
      if (existing.amount !== undefined || amount !== undefined) {
        existing.amount = roundCents((existing.amount ?? 0) + (amount ?? 0))
      }
    }
  }

  if (grouped.size === 0) {
    return { ok: false, code: 'EMPTY_FILE' }
  }

  if (grouped.size > EXPENSE_IMPORT_MAX_ITEMS) {
    return { ok: false, code: 'TOO_MANY_ITEMS' }
  }

  return {
    ok: true,
    lines: Array.from(grouped.values()),
    warnings,
  }
}

export function mergeImportedLines(
  current: ExpenseLineInput[],
  imported: ImportedExpenseLine[],
): ExpenseLineInput[] {
  const result: ExpenseLineInput[] = current.map((line) => ({ ...line }))
  const indexByNormalizedName = new Map<string, number>()

  result.forEach((line, idx) => {
    const norm = normalizeItemName(line.name ?? '')
    if (norm && !indexByNormalizedName.has(norm)) {
      indexByNormalizedName.set(norm, idx)
    }
  })

  for (const imp of imported) {
    const norm = normalizeItemName(imp.name)
    if (!norm) continue

    const existingIdx = indexByNormalizedName.get(norm)
    if (existingIdx !== undefined) {
      const existing = result[existingIdx]
      const nextQuantity = roundCents((existing.quantity ?? 1) + imp.quantity)
      const hasAmount =
        existing.amount !== undefined || imp.amount !== undefined
      const nextAmount = hasAmount
        ? roundCents((existing.amount ?? 0) + (imp.amount ?? 0))
        : undefined

      result[existingIdx] = {
        ...existing,
        quantity: nextQuantity,
        ...(nextAmount !== undefined ? { amount: nextAmount } : {}),
      }
    } else {
      indexByNormalizedName.set(norm, result.length)
      result.push({
        name: imp.name,
        quantity: imp.quantity,
        ...(imp.amount !== undefined ? { amount: imp.amount } : {}),
      })
    }
  }

  return result
}

