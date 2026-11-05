import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Filter,
  Package,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  ShoppingBag,
  Trash2,
  User as UserIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '../components/common/confirm-dialog'
import { PurchaseForm } from '../components/purchases/purchase-form'
import { useScheduleStore } from '../store/use-schedule-store'
import {
  formatDisplayDate,
  formatMonthYear,
  getNextMonth,
  getPreviousMonth,
} from '../utils/date-utils'
import {
  createDefaultExpenseFilters,
  filterExpenses,
  getExpenseLinesSummary,
} from '../utils/expense-item-utils'

import type { DailyExpense, DailyExpenseCategory, Person } from '../types'
import type { ExpenseFilters } from '../utils/expense-item-utils'

const CATEGORIES: DailyExpenseCategory[] = [
  'MEDICATION',
  'SUPPLIES',
  'TRANSPORT',
  'OTHER',
]

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function PurchasesView() {
  const { t, i18n } = useTranslation(['purchases', 'calendar', 'common'])
  const {
    expenses,
    expenseItems,
    persons,
    getRegistryForMonth,
    deleteExpense,
  } = useScheduleStore()

  const [filters, setFilters] = useState<ExpenseFilters>(() =>
    createDefaultExpenseFilters(),
  )
  const [isPurchaseFormOpen, setIsPurchaseFormOpen] = useState(false)
  const [expenseToEdit, setExpenseToEdit] = useState<DailyExpense | undefined>(
    undefined,
  )
  const [expenseToDelete, setExpenseToDelete] = useState<DailyExpense | null>(
    null,
  )

  const activeItems = useMemo(
    () =>
      expenseItems
        .filter((item) => !item.mergedIntoId)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [expenseItems],
  )

  const monthPeople = useMemo(() => {
    const registryPersons = getRegistryForMonth(filters.month).persons
    const map = new Map<string, Person>()
    registryPersons.forEach((p) => map.set(p.id, p))
    persons.forEach((p) => {
      if (p.active !== false && !map.has(p.id)) {
        map.set(p.id, p)
      }
    })
    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
  }, [filters.month, getRegistryForMonth, persons])

  const filteredExpenses = useMemo(
    () => filterExpenses(expenses, expenseItems, filters),
    [expenses, expenseItems, filters],
  )

  const kpis = useMemo(() => {
    let monthTotal = 0
    let reimbursementsTotal = 0
    let generalTotal = 0

    for (const exp of filteredExpenses) {
      monthTotal += exp.amount
      if (exp.personId) {
        reimbursementsTotal += exp.amount
      } else {
        generalTotal += exp.amount
      }
    }

    return {
      monthTotal,
      reimbursementsTotal,
      generalTotal,
    }
  }, [filteredExpenses])

  const hasActiveSubFilters = Boolean(
    filters.category || filters.personId || filters.itemId,
  )

  const resolvePersonName = (exp: DailyExpense): string | null => {
    if (!exp.personId) return null
    const monthReg = getRegistryForMonth(exp.date.slice(0, 7))
    const found =
      monthReg.persons.find((p) => p.id === exp.personId) ??
      persons.find((p) => p.id === exp.personId)
    return found?.name || exp.personName || t('calendar:removedProfessional')
  }

  return (
    <div
      data-testid="purchases-view"
      className="flex-1 h-full overflow-y-auto p-4 sm:p-6 md:p-8 flex flex-col gap-5 max-w-[1500px] w-full mx-auto custom-scrollbar"
    >
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-2xl md:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-xs">
            <ShoppingBag className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight truncate">
              {t('purchases:title')}
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {t('purchases:subtitle')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Month Navigator */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <button
              type="button"
              data-testid="purchases-prev-month"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  month: getPreviousMonth(prev.month),
                }))
              }
              title={t('purchases:prevMonth')}
              aria-label={t('purchases:prevMonth')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span
              data-testid="purchases-current-month-label"
              className="px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 min-w-[130px] text-center capitalize"
            >
              {formatMonthYear(filters.month, i18n.language, { compact: true })}
            </span>
            <button
              type="button"
              data-testid="purchases-next-month"
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  month: getNextMonth(prev.month),
                }))
              }
              title={t('purchases:nextMonth')}
              aria-label={t('purchases:nextMonth')}
              className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            data-testid="purchases-new-button"
            onClick={() => {
              setExpenseToEdit(undefined)
              setIsPurchaseFormOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 shadow-xs transition cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{t('purchases:newPurchase')}</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {t('purchases:kpi.monthTotal')}
            </span>
            <span
              data-testid="purchases-kpi-total"
              className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block"
            >
              {formatBRL(kpis.monthTotal)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 block">
              {filteredExpenses.length === 1
                ? t('purchases:kpi.purchasesCount', {
                    count: filteredExpenses.length,
                  })
                : t('purchases:kpi.purchasesCountPlural', {
                    count: filteredExpenses.length,
                  })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-800/70 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {t('purchases:kpi.reimbursementsTotal')}
            </span>
            <span
              data-testid="purchases-kpi-reimbursements"
              className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1 block"
            >
              {formatBRL(kpis.reimbursementsTotal)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 block">
              {t('purchases:kpi.generalTotal')}: {formatBRL(kpis.generalTotal)}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/70 dark:border-indigo-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
              {t('purchases:kpi.activeItemsCount')}
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-1 block">
              {activeItems.length === 1
                ? t('purchases:kpi.itemsRegistered', {
                    count: activeItems.length,
                  })
                : t('purchases:kpi.itemsRegisteredPlural', {
                    count: activeItems.length,
                  })}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200/70 dark:border-amber-800/70 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {/* Category Filter */}
          <div>
            <label
              htmlFor="purchases-filter-category"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              {t('purchases:filters.category')}
            </label>
            <select
              id="purchases-filter-category"
              data-testid="purchases-filter-category"
              value={filters.category ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  category: (e.target.value || undefined) as
                    | DailyExpenseCategory
                    | undefined,
                }))
              }
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">{t('purchases:filters.allCategories')}</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {t(
                    `purchases:categories.${cat}` as unknown as TemplateStringsArray,
                  )}
                </option>
              ))}
            </select>
          </div>

          {/* Professional Filter */}
          <div>
            <label
              htmlFor="purchases-filter-person"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              {t('purchases:filters.person')}
            </label>
            <select
              id="purchases-filter-person"
              data-testid="purchases-filter-person"
              value={filters.personId ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  personId: e.target.value || undefined,
                }))
              }
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">{t('purchases:filters.allPersons')}</option>
              {monthPeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </div>

          {/* Item Filter */}
          <div>
            <label
              htmlFor="purchases-filter-item"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              {t('purchases:filters.item')}
            </label>
            <select
              id="purchases-filter-item"
              data-testid="purchases-filter-item"
              value={filters.itemId ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  itemId: e.target.value || undefined,
                }))
              }
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
            >
              <option value="">{t('purchases:filters.allItems')}</option>
              {activeItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {hasActiveSubFilters && (
          <button
            type="button"
            data-testid="purchases-clear-filters"
            onClick={() =>
              setFilters((prev) => ({
                month: prev.month,
              }))
            }
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('purchases:filters.clearFilters')}</span>
          </button>
        )}
      </div>

      {/* Purchases List */}
      {filteredExpenses.length === 0 ? (
        <div
          data-testid="purchases-empty-state"
          className="p-10 sm:p-14 text-center bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mx-auto">
            {hasActiveSubFilters ? (
              <Filter className="w-6 h-6" />
            ) : (
              <Receipt className="w-6 h-6" />
            )}
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200">
              {hasActiveSubFilters
                ? t('purchases:list.emptyFilteredTitle')
                : t('purchases:list.emptyTitle')}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hasActiveSubFilters
                ? t('purchases:list.emptyFilteredSubtitle')
                : t('purchases:list.emptySubtitle')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredExpenses.map((exp) => {
            const summary = getExpenseLinesSummary(exp)
            const personLabel = resolvePersonName(exp)

            return (
              <article
                key={exp.id}
                data-testid={`purchase-card-${exp.id}`}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5 shadow-2xs space-y-3.5 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
              >
                {/* Purchase Top Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {formatDisplayDate(exp.date, i18n.language)}
                      </span>

                      {exp.category && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/70">
                          {t(
                            `purchases:categories.${exp.category}` as unknown as TemplateStringsArray,
                          )}
                        </span>
                      )}

                      {personLabel ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/70">
                          <UserIcon className="w-3 h-3" />
                          {t('purchases:list.reimbursementFor', {
                            name: personLabel,
                          })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400">
                          {t('purchases:list.generalExpense')}
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug break-words">
                      {exp.description}
                    </h3>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 shrink-0">
                    <span
                      data-testid={`purchase-amount-${exp.id}`}
                      className="text-lg font-black text-emerald-600 dark:text-emerald-400"
                    >
                      {formatBRL(exp.amount)}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        data-testid={`edit-purchase-${exp.id}`}
                        onClick={() => {
                          setExpenseToEdit(exp)
                          setIsPurchaseFormOpen(true)
                        }}
                        title={t('purchases:list.editPurchaseAria', {
                          description: exp.description,
                        })}
                        aria-label={t('purchases:list.editPurchaseAria', {
                          description: exp.description,
                        })}
                        className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        data-testid={`delete-purchase-${exp.id}`}
                        onClick={() => setExpenseToDelete(exp)}
                        title={t('purchases:list.deletePurchaseAria', {
                          description: exp.description,
                        })}
                        aria-label={t('purchases:list.deletePurchaseAria', {
                          description: exp.description,
                        })}
                        className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Purchase Item Lines */}
                {exp.items.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {exp.items.map((line) => {
                        const qty = line.quantity ?? 1
                        return (
                          <div
                            key={line.id}
                            data-testid={`expense-line-${line.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/70 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                                {line.itemName}
                              </span>
                              <span
                                data-testid={`expense-line-qty-${line.id}`}
                                className="px-1.5 py-0.5 rounded-md bg-slate-200/80 dark:bg-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200 shrink-0"
                              >
                                {t('purchases:list.quantityBadge', {
                                  quantity: qty,
                                })}
                              </span>
                            </div>

                            {line.amount !== undefined && (
                              <span
                                data-testid={`expense-line-amount-${line.id}`}
                                className="font-bold text-slate-700 dark:text-slate-300 shrink-0"
                              >
                                {formatBRL(line.amount)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Subtotal and Difference when all lines have amounts */}
                    {summary.allLinesHaveAmount &&
                      summary.difference !== null &&
                      summary.difference !== 0 && (
                        <div
                          data-testid={`expense-summary-diff-${exp.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-800/60 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
                        >
                          <span>
                            {t('purchases:list.subtotalLabel', {
                              subtotal: formatBRL(summary.subtotal),
                            })}
                          </span>
                          <span>
                            {summary.difference > 0
                              ? t('purchases:list.differencePositive', {
                                  diff: formatBRL(summary.difference),
                                })
                              : t('purchases:list.differenceNegative', {
                                  diff: formatBRL(Math.abs(summary.difference)),
                                })}
                          </span>
                        </div>
                      )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {/* Purchase Create / Edit Modal */}
      {isPurchaseFormOpen && (
        <PurchaseForm
          expense={expenseToEdit}
          onClose={() => {
            setIsPurchaseFormOpen(false)
            setExpenseToEdit(undefined)
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(expenseToDelete)}
        title={t('purchases:confirmDelete.title')}
        description={t('purchases:confirmDelete.description', {
          description: expenseToDelete?.description ?? '',
        })}
        confirmLabel={t('purchases:confirmDelete.confirm')}
        variant="danger"
        onCancel={() => setExpenseToDelete(null)}
        onConfirm={() => {
          if (expenseToDelete) {
            void deleteExpense(expenseToDelete.id)
            setExpenseToDelete(null)
          }
        }}
      />
    </div>
  )
}
