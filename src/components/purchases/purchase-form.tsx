import { format } from 'date-fns'
import {
  AlertCircle,
  AlertTriangle,
  Clock,
  DollarSign,
  FileSpreadsheet,
  Package,
  Plus,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import { formatDisplayDate } from '../../utils/date-utils'
import {
  mergeImportedLines,
  parseExpenseItemsFile,
} from '../../utils/expense-item-import'
import {
  findExpenseItemByName,
  getExpenseLinesSummary,
  getItemLastPurchase,
  ITEM_SEARCH_MIN_LENGTH,
  normalizeItemName,
  searchExpenseItems,
  validateExpenseInput,
} from '../../utils/expense-item-utils'
import { formatBRL, parseNumericRate } from '../../utils/shift-rate-utils'
import { DatePicker } from '../ui/date-picker'
import { Select } from '../ui/select'

import type {
  DailyExpense,
  DailyExpenseCategory,
  ExpenseInput,
  ExpenseLineInput,
  Person,
} from '../../types'
import type { ExpenseImportWarning } from '../../utils/expense-item-import'
import type {
  ExpenseValidationCode,
  ExpenseValidationError,
} from '../../utils/expense-item-utils'

export interface PurchaseFormProps {
  expense?: DailyExpense
  onClose: () => void
}

interface DraftLine {
  rowId: string
  lineId?: string
  itemId?: string
  name: string
  quantity: string
  amount: string
}

const CATEGORIES: DailyExpenseCategory[] = [
  'MEDICATION',
  'SUPPLIES',
  'TRANSPORT',
  'OTHER',
]

let nextDraftRowCounter = 1
function createRowId(): string {
  nextDraftRowCounter += 1
  return `draft-row-${Date.now()}-${nextDraftRowCounter}`
}

export function PurchaseForm({ expense, onClose }: PurchaseFormProps) {
  const { t, i18n } = useTranslation(['purchases', 'calendar', 'common'])
  const {
    expenses,
    expenseItems,
    persons,
    getRegistryForMonth,
    addExpense,
    updateExpense,
    deleteExpense,
  } = useScheduleStore()

  const [date, setDate] = useState<string>(
    () => expense?.date ?? format(new Date(), 'yyyy-MM-dd'),
  )
  const [description, setDescription] = useState<string>(
    () => expense?.description ?? '',
  )
  const [amount, setAmount] = useState<string>(() =>
    expense ? String(expense.amount) : '',
  )
  const [category, setCategory] = useState<DailyExpenseCategory | ''>(
    () => expense?.category ?? '',
  )
  const [personId, setPersonId] = useState<string>(
    () => expense?.personId ?? '',
  )
  const [lines, setLines] = useState<DraftLine[]>(() =>
    expense
      ? expense.items.map((line) => ({
          rowId: line.id,
          lineId: line.id,
          itemId: line.itemId,
          name: line.itemName,
          quantity: String(line.quantity ?? 1),
          amount: line.amount !== undefined ? String(line.amount) : '',
        }))
      : [],
  )
  const [openSuggestionRowId, setOpenSuggestionRowId] = useState<string | null>(
    null,
  )
  const [errors, setErrors] = useState<ExpenseValidationError[]>([])
  const hasFormError = (code: ExpenseValidationCode) =>
    errors.some((err) => err.code === code && err.lineIndex === undefined)
  const [importError, setImportError] = useState<
    'FILE_TOO_LARGE' | 'TOO_MANY_ITEMS' | 'UNREADABLE_FILE' | 'EMPTY_FILE' | null
  >(null)
  const [importWarnings, setImportWarnings] = useState<ExpenseImportWarning[]>(
    [],
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const dateMonth = useMemo(() => {
    if (/^\d{4}-\d{2}/.test(date)) {
      return date.slice(0, 7)
    }
    return format(new Date(), 'yyyy-MM')
  }, [date])

  const availablePeople = useMemo(() => {
    const registryPersons = getRegistryForMonth(dateMonth).persons
    const map = new Map<string, Person>()
    registryPersons.forEach((p) => map.set(p.id, p))
    persons.forEach((p) => {
      if (p.active !== false && !map.has(p.id)) {
        map.set(p.id, p)
      }
    })
    if (expense?.personId && !map.has(expense.personId)) {
      map.set(expense.personId, {
        id: expense.personId,
        name: expense.personName || t('calendar:removedProfessional'),
        color: '#64748b',
      })
    }
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
  }, [dateMonth, expense, getRegistryForMonth, persons, t])

  const liveSummary = useMemo(() => {
    const parsedTotal = amount.trim() === '' ? 0 : parseNumericRate(amount)
    const previewLines = lines.map((line) => {
      const rawAmount = line.amount.trim()
      const parsedLineAmount =
        rawAmount === '' ? undefined : parseNumericRate(rawAmount)
      return {
        id: line.rowId,
        itemId: line.itemId ?? '',
        itemName: line.name,
        quantity:
          line.quantity.trim() === '' ? 1 : parseNumericRate(line.quantity),
        amount:
          parsedLineAmount !== undefined && !Number.isNaN(parsedLineAmount)
            ? parsedLineAmount
            : undefined,
      }
    })
    return getExpenseLinesSummary({
      amount: Number.isNaN(parsedTotal) ? 0 : parsedTotal,
      items: previewLines,
    })
  }, [amount, lines])

  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        rowId: createRowId(),
        name: '',
        quantity: '1',
        amount: '',
      },
    ])
    setErrors([])
  }

  const handleImportSpreadsheet = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const result = await parseExpenseItemsFile(file)
    if (!result.ok) {
      setImportError(result.code)
      setImportWarnings([])
      return
    }

    setImportError(null)
    setImportWarnings(result.warnings)
    setErrors([])

    const currentInputs: ExpenseLineInput[] = lines.map((line) => {
      const qtyTrimmed = line.quantity.trim()
      const parsedQty =
        qtyTrimmed === '' ? 1 : parseNumericRate(qtyTrimmed)
      const amtTrimmed = line.amount.trim()
      const parsedAmt =
        amtTrimmed === '' ? undefined : parseNumericRate(amtTrimmed)
      return {
        id: line.lineId,
        itemId: line.itemId,
        name: line.name,
        quantity: Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : 1,
        amount:
          parsedAmt !== undefined && Number.isFinite(parsedAmt) && parsedAmt >= 0
            ? parsedAmt
            : undefined,
      }
    })

    const existingRowByNorm = new Map<string, DraftLine>()
    lines.forEach((line) => {
      const norm = normalizeItemName(line.name)
      if (norm && !existingRowByNorm.has(norm)) {
        existingRowByNorm.set(norm, line)
      }
    })

    const mergedInputs = mergeImportedLines(currentInputs, result.lines)
    const nextDraftLines: DraftLine[] = mergedInputs.map((mergedLine) => {
      const cleanName = mergedLine.name ?? ''
      const norm = normalizeItemName(cleanName)
      const existingDraft = existingRowByNorm.get(norm)
      const matchedCatalogItem = findExpenseItemByName(cleanName, expenseItems)

      return {
        rowId: existingDraft?.rowId ?? createRowId(),
        lineId: mergedLine.id ?? existingDraft?.lineId,
        itemId:
          mergedLine.itemId ??
          existingDraft?.itemId ??
          matchedCatalogItem?.id,
        name: cleanName,
        quantity: String(mergedLine.quantity ?? 1),
        amount:
          mergedLine.amount !== undefined ? String(mergedLine.amount) : '',
      }
    })

    setLines(nextDraftLines)

    if (amount.trim() === '') {
      const linesWithAmount = mergedInputs.filter(
        (l): l is ExpenseLineInput & { amount: number } =>
          typeof l.amount === 'number' && Number.isFinite(l.amount),
      )
      if (linesWithAmount.length > 0) {
        const sum =
          Math.round(
            linesWithAmount.reduce((acc, curr) => acc + curr.amount, 0) * 100,
          ) / 100
        setAmount(String(sum))
      }
    }
  }

  const handleRemoveLine = (index: number) => {
    setLines((prev) => prev.filter((_, idx) => idx !== index))
    setErrors([])
  }

  const handleLineNameChange = (index: number, value: string) => {
    const matched = findExpenseItemByName(value, expenseItems)
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === index
          ? {
              ...line,
              name: value,
              itemId: matched?.id,
            }
          : line,
      ),
    )
    setOpenSuggestionRowId(lines[index]?.rowId ?? null)
    setErrors([])
  }

  const handleSelectSuggestion = (
    index: number,
    selectedItemId: string,
    selectedItemName: string,
  ) => {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === index
          ? {
              ...line,
              itemId: selectedItemId,
              name: selectedItemName,
            }
          : line,
      ),
    )
    setOpenSuggestionRowId(null)
    setErrors([])
  }

  const buildExpenseInput = (): ExpenseInput => {
    const parsedAmount = amount.trim() === '' ? NaN : parseNumericRate(amount)
    const lineInputs: ExpenseLineInput[] = lines.map((line) => {
      const qtyTrimmed = line.quantity.trim()
      const parsedQty =
        qtyTrimmed === '' ? undefined : parseNumericRate(qtyTrimmed)
      const amtTrimmed = line.amount.trim()
      const parsedLineAmt =
        amtTrimmed === '' ? undefined : parseNumericRate(amtTrimmed)

      return {
        id: line.lineId,
        itemId: line.itemId,
        name: line.name,
        quantity: parsedQty,
        amount: parsedLineAmt,
      }
    })

    return {
      date: date.trim(),
      description: description.trim(),
      amount: parsedAmount,
      category: category || undefined,
      personId: personId || undefined,
      items: lineInputs,
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    const input = buildExpenseInput()
    const validationErrors = validateExpenseInput(input, expenseItems)
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    try {
      const result = expense
        ? await updateExpense(expense.id, input)
        : await addExpense(input)

      if (!result.ok) {
        setErrors(result.errors)
        return
      }

      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!expense || isSubmitting) return
    setIsSubmitting(true)
    try {
      await deleteExpense(expense.id)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="purchase-form-title"
      data-testid="purchase-form-modal"
      className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3
                id="purchase-form-title"
                className="text-base font-bold text-slate-900 dark:text-white truncate"
              >
                {expense
                  ? t('purchases:form.editTitle')
                  : t('purchases:form.newTitle')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t('purchases:form.subtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={t('common:actions.close')}
            aria-label={t('common:actions.close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="modal-form flex flex-col flex-1 min-h-0"
        >
          <div className="modal-body p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
            {/* Validation Error Banner */}
            {errors.length > 0 && (
              <div
                data-testid="purchase-form-errors"
                className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 space-y-1.5"
              >
                {errors.map((err, idx) => (
                  <div
                    key={`${err.code}-${err.lineIndex ?? 'global'}-${idx}`}
                    data-testid={`purchase-error-${err.code}`}
                    className="flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>
                      {t(
                        `purchases:errors.${err.code}` as unknown as TemplateStringsArray,
                        {
                          line: (err.lineIndex ?? 0) + 1,
                        },
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Main Purchase Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label
                  htmlFor="purchase-date-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('purchases:form.date')}
                </label>
                <DatePicker
                  id="purchase-date-input"
                  data-testid="purchase-date-input"
                  value={date}
                  invalid={hasFormError('DATE_INVALID')}
                  onChange={(val) => {
                    setDate(val)
                    setErrors([])
                  }}
                />
              </div>

              {/* Total Amount */}
              <div>
                <label
                  htmlFor="purchase-amount-input"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('purchases:form.amount')}
                </label>
                <div className="relative">
                  <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="purchase-amount-input"
                    data-testid="purchase-amount-input"
                    type="text"
                    inputMode="decimal"
                    aria-invalid={hasFormError('AMOUNT_INVALID')}
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      setErrors([])
                    }}
                    placeholder={t('purchases:form.amountPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="purchase-description-input"
                className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
              >
                {t('purchases:form.description')}
              </label>
              <input
                id="purchase-description-input"
                data-testid="purchase-description-input"
                type="text"
                aria-invalid={hasFormError('DESCRIPTION_REQUIRED')}
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  setErrors([])
                }}
                placeholder={t('purchases:form.descriptionPlaceholder')}
                className="w-full px-3.5 py-2 text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
              />
            </div>

            {/* Category & Professional */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="purchase-category-select"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('purchases:form.category')}
                </label>
                <Select
                  id="purchase-category-select"
                  data-testid="purchase-category-select"
                  value={category}
                  onChange={(e) =>
                    setCategory(
                      (e.target.value || '') as DailyExpenseCategory | '',
                    )
                  }
                  className="w-full"
                >
                  <option value="">{t('purchases:form.selectCategory')}</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {t(
                        `purchases:categories.${cat}` as unknown as TemplateStringsArray,
                      )}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label
                  htmlFor="purchase-person-select"
                  className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1"
                >
                  {t('purchases:form.person')}
                </label>
                <Select
                  id="purchase-person-select"
                  data-testid="purchase-person-select"
                  value={personId}
                  onChange={(e) => setPersonId(e.target.value)}
                  className="w-full"
                >
                  <option value="">{t('purchases:form.noPersonOption')}</option>
                  {availablePeople.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Item Lines Section */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('purchases:form.itemsSectionTitle')}</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('purchases:form.itemsSectionSubtitle')}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xls,.xlsx"
                    data-testid="purchase-import-input"
                    onChange={handleImportSpreadsheet}
                    className="hidden"
                  />
                  <button
                    type="button"
                    data-testid="purchase-import-button"
                    onClick={() => fileInputRef.current?.click()}
                    title={t('purchases:import.buttonTooltip')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>{t('purchases:import.button')}</span>
                  </button>

                  <button
                    type="button"
                    data-testid="purchase-add-line"
                    onClick={handleAddLine}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('purchases:form.addItemLine')}</span>
                  </button>
                </div>
              </div>

              {importError && (
                <div
                  data-testid={`purchase-import-error-${importError}`}
                  className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {t(
                      `purchases:import.errors.${importError}` as unknown as TemplateStringsArray,
                    )}
                  </span>
                </div>
              )}

              {importWarnings.length > 0 && (
                <div
                  data-testid="purchase-import-warnings"
                  className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 space-y-1"
                >
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('purchases:import.warningsTitle')}</span>
                  </div>
                  <ul className="space-y-0.5 pl-5 list-disc text-[11px] font-medium text-amber-700 dark:text-amber-300/90">
                    {importWarnings.map((warn, idx) => (
                      <li key={`${warn.code}-${warn.row}-${idx}`}>
                        {t(
                          `purchases:import.warnings.${warn.code}` as unknown as TemplateStringsArray,
                          { row: warn.row },
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {lines.length > 0 && (
                <div className="space-y-3">
                  {lines.map((line, idx) => {
                    const effectiveItemId =
                      line.itemId ??
                      findExpenseItemByName(line.name, expenseItems)?.id
                    const suggestions =
                      openSuggestionRowId === line.rowId &&
                      line.name.trim().length >= ITEM_SEARCH_MIN_LENGTH
                        ? searchExpenseItems(
                            line.name,
                            expenseItems,
                            expenses,
                            {
                              referenceDate: date,
                              excludeExpenseId: expense?.id,
                            },
                          )
                        : []

                    const lastPurchase =
                      effectiveItemId && /^\d{4}-\d{2}-\d{2}$/.test(date)
                        ? getItemLastPurchase(
                            effectiveItemId,
                            expenseItems,
                            expenses,
                            {
                              referenceDate: date,
                              excludeExpenseId: expense?.id,
                            },
                          )
                        : null

                    const lineErrors = errors.filter(
                      (err) => err.lineIndex === idx,
                    )
                    const hasLineError = (...codes: ExpenseValidationCode[]) =>
                      lineErrors.some((err) => codes.includes(err.code))

                    return (
                      <div
                        key={line.rowId}
                        data-testid={`purchase-line-row-${idx}`}
                        className={`p-3.5 rounded-2xl border space-y-2.5 transition-colors ${
                          lineErrors.length > 0
                            ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
                            : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-700/80'
                        }`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                          {/* Item Name + Autocomplete */}
                          <div className="sm:col-span-6 relative">
                            <label
                              htmlFor={`purchase-line-name-${idx}`}
                              className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                            >
                              {t('purchases:form.itemNameLabel')} *
                            </label>
                            <input
                              id={`purchase-line-name-${idx}`}
                              data-testid={`purchase-line-name-${idx}`}
                              type="text"
                              aria-invalid={hasLineError(
                                'ITEM_REQUIRED',
                                'ITEM_NOT_FOUND',
                                'DUPLICATE_ITEM',
                              )}
                              value={line.name}
                              onChange={(e) =>
                                handleLineNameChange(idx, e.target.value)
                              }
                              onFocus={() => setOpenSuggestionRowId(line.rowId)}
                              placeholder={t(
                                'purchases:form.itemNamePlaceholder',
                              )}
                              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />

                            {/* Suggestions Dropdown */}
                            {suggestions.length > 0 && (
                              <div
                                data-testid={`purchase-line-suggestions-${idx}`}
                                aria-label={t('purchases:form.suggestionsLabel')}
                                className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 z-20"
                              >
                                {suggestions.map((sug) => (
                                  <button
                                    key={sug.item.id}
                                    type="button"
                                    data-testid={`purchase-suggestion-${idx}-${sug.item.id}`}
                                    onClick={() =>
                                      handleSelectSuggestion(
                                        idx,
                                        sug.item.id,
                                        sug.item.name,
                                      )
                                    }
                                    className="w-full px-3 py-2 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center justify-between gap-2 transition cursor-pointer"
                                  >
                                    <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                      {sug.item.name}
                                    </span>
                                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                                      {sug.lastPurchaseDate !== null &&
                                      sug.daysSinceLastPurchase !== null
                                        ? t(
                                            'purchases:form.suggestionLastPurchase',
                                            {
                                              date: formatDisplayDate(
                                                sug.lastPurchaseDate,
                                                i18n.language,
                                              ),
                                              days: sug.daysSinceLastPurchase,
                                            },
                                          )
                                        : t(
                                            'purchases:form.suggestionNeverPurchased',
                                          )}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quantity */}
                          <div className="sm:col-span-2">
                            <label
                              htmlFor={`purchase-line-qty-${idx}`}
                              className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                            >
                              {t('purchases:form.quantityLabel')}
                            </label>
                            <input
                              id={`purchase-line-qty-${idx}`}
                              data-testid={`purchase-line-qty-${idx}`}
                              type="text"
                              inputMode="decimal"
                              aria-invalid={hasLineError('QUANTITY_INVALID')}
                              value={line.quantity}
                              onChange={(e) => {
                                const val = e.target.value
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx ? { ...l, quantity: val } : l,
                                  ),
                                )
                                setErrors([])
                              }}
                              placeholder={t(
                                'purchases:form.quantityPlaceholder',
                              )}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                          </div>

                          {/* Line Amount */}
                          <div className="sm:col-span-3">
                            <label
                              htmlFor={`purchase-line-amount-${idx}`}
                              className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1"
                            >
                              {t('purchases:form.lineAmountLabel')}
                            </label>
                            <input
                              id={`purchase-line-amount-${idx}`}
                              data-testid={`purchase-line-amount-${idx}`}
                              type="text"
                              inputMode="decimal"
                              aria-invalid={hasLineError('LINE_AMOUNT_INVALID')}
                              value={line.amount}
                              onChange={(e) => {
                                const val = e.target.value
                                setLines((prev) =>
                                  prev.map((l, i) =>
                                    i === idx ? { ...l, amount: val } : l,
                                  ),
                                )
                                setErrors([])
                              }}
                              placeholder={t(
                                'purchases:form.lineAmountPlaceholder',
                              )}
                              className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                            />
                          </div>

                          {/* Remove Line Button */}
                          <div className="sm:col-span-1 flex sm:justify-end sm:pt-5">
                            <button
                              type="button"
                              data-testid={`purchase-remove-line-${idx}`}
                              onClick={() => handleRemoveLine(idx)}
                              title={t('purchases:form.removeLineAria', {
                                index: idx + 1,
                              })}
                              aria-label={t('purchases:form.removeLineAria', {
                                index: idx + 1,
                              })}
                              className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Last Purchase Feedback / New Item Badge */}
                        {effectiveItemId && lastPurchase ? (
                          lastPurchase.lastPurchaseDate !== null &&
                          lastPurchase.daysSinceLastPurchase !== null ? (
                            <div
                              data-testid={`line-last-purchase-${idx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/70 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300"
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {t('purchases:form.selectedItemLastPurchase', {
                                  date: formatDisplayDate(
                                    lastPurchase.lastPurchaseDate,
                                    i18n.language,
                                  ),
                                  days: lastPurchase.daysSinceLastPurchase,
                                })}
                              </span>
                            </div>
                          ) : (
                            <div
                              data-testid={`line-no-prior-${idx}`}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-600 dark:text-slate-400"
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {t('purchases:form.selectedItemNoPrior')}
                              </span>
                            </div>
                          )
                        ) : line.name.trim().length > 0 ? (
                          <div
                            data-testid={`line-new-item-${idx}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/70 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
                          >
                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                            <span>{t('purchases:form.newItemBadge')}</span>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}

                  {/* Live Subtotal & Difference Summary */}
                  {liveSummary.allLinesHaveAmount && (
                    <div
                      data-testid="purchase-form-summary"
                      className="p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {t('purchases:form.summarySubtotal', {
                          subtotal: formatBRL(liveSummary.subtotal),
                        })}
                      </span>
                      {liveSummary.difference !== null &&
                        liveSummary.difference !== 0 && (
                          <span
                            data-testid="purchase-form-summary-diff"
                            className="font-bold text-amber-700 dark:text-amber-300"
                          >
                            {liveSummary.difference > 0
                              ? t('purchases:form.summaryDifferencePositive', {
                                  diff: formatBRL(liveSummary.difference),
                                })
                              : t('purchases:form.summaryDifferenceNegative', {
                                  diff: formatBRL(
                                    Math.abs(liveSummary.difference),
                                  ),
                                })}
                          </span>
                        )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
            <div>
              {expense && (
                <button
                  type="button"
                  data-testid="purchase-form-delete"
                  onClick={handleDelete}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('purchases:form.deletePurchase')}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                {t('common:actions.cancel')}
              </button>
              <button
                type="submit"
                data-testid="purchase-submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 transition shadow-xs cursor-pointer disabled:opacity-50"
              >
                {expense
                  ? t('purchases:form.savePurchase')
                  : t('purchases:form.createPurchase')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
