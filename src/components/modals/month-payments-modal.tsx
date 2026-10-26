import {
  AlertCircle,
  ChevronDown,
  DollarSign,
  Receipt,
  Search,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import {
  formatDisplayDate,
  formatMonthYear,
  getDaysCountInMonth,
} from '../../utils/date-utils'
import {
  calculateMonthExpensesSummary,
  getPersonShiftRate,
} from '../../utils/shift-rate-utils'

import type { DailyExpense, Person, ShiftDefinition } from '../../types'

export interface MonthPaymentsModalProps {
  isOpen: boolean
  onClose: () => void
  currentMonth: string
}

export interface PersonShiftWorkItem {
  dateStr: string
  day: number
  weekday: string
  shiftId: string
  shiftName: string
  shiftCode: string
  shiftColor: string
  rate: number
  hasRateConfigured: boolean
}

export interface PersonPaymentSummary {
  person: Person
  shiftsCount: number
  shiftsAmount: number
  reimbursementsAmount: number
  totalAmount: number
  items: PersonShiftWorkItem[]
  expenses: DailyExpense[]
}

const getWeekdayLabel = (
  yearMonth: string,
  day: number,
  lang: string,
): string => {
  const [y, m] = yearMonth.split('-').map(Number)
  const date = new Date(y, m - 1, day)
  return date.toLocaleDateString(lang.startsWith('en') ? 'en-US' : 'pt-BR', {
    weekday: 'short',
  })
}

export function MonthPaymentsModal({
  isOpen,
  onClose,
  currentMonth,
}: MonthPaymentsModalProps) {
  const { t, i18n } = useTranslation(['calendar', 'common'])
  const {
    persons,
    availabilities,
    dayShiftAssignments,
    assignments,
    shiftDefinitions,
    expenses,
  } = useScheduleStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedPersonIds, setExpandedPersonIds] = useState<string[]>([])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const shiftDefMap = useMemo(() => {
    const map = new Map<string, ShiftDefinition>()
    shiftDefinitions.forEach((s) => map.set(s.id, s))
    return map
  }, [shiftDefinitions])

  const personMap = useMemo(() => {
    const map = new Map<string, Person>()
    persons.forEach((p) => map.set(p.id, p))
    return map
  }, [persons])

  const monthExpensesSummary = useMemo(
    () => calculateMonthExpensesSummary(expenses, currentMonth),
    [expenses, currentMonth],
  )

  // Calculate payments per person for currentMonth
  const summaries: PersonPaymentSummary[] = useMemo(() => {
    const personItemsMap = new Map<string, PersonShiftWorkItem[]>()

    const totalDays = getDaysCountInMonth(currentMonth)

    for (let day = 1; day <= totalDays; day++) {
      const dayPad = String(day).padStart(2, '0')
      const dateStr = `${currentMonth}-${dayPad}`
      const weekday = getWeekdayLabel(currentMonth, day, i18n.language)

      const dayShifts = dayShiftAssignments[dateStr]
      const handledPersonsOnDay = new Set<string>()

      if (dayShifts && Object.keys(dayShifts).length > 0) {
        for (const [shiftId, personId] of Object.entries(dayShifts)) {
          if (!personId) continue
          handledPersonsOnDay.add(personId)

          const shiftDef = shiftDefMap.get(shiftId)
          const rate = getPersonShiftRate(availabilities, personId, currentMonth, shiftId, day)
          const hasRateConfigured = rate > 0

          const item: PersonShiftWorkItem = {
            dateStr,
            day,
            weekday,
            shiftId,
            shiftName:
              shiftDef?.name || t('calendar:paymentsModal.defaultShiftName'),
            shiftCode: shiftDef?.code || 'PL',
            shiftColor: shiftDef?.color || '#3B82F6',
            rate,
            hasRateConfigured,
          }

          const existingItems = personItemsMap.get(personId) || []
          existingItems.push(item)
          personItemsMap.set(personId, existingItems)
        }
      }

      // Check legacy assignments
      const legacyPersonIds = assignments[dateStr]
      if (legacyPersonIds && Array.isArray(legacyPersonIds)) {
        for (const personId of legacyPersonIds) {
          if (handledPersonsOnDay.has(personId)) continue // Already recorded for this day
          const rate = getPersonShiftRate(availabilities, personId, currentMonth, undefined, day)

          const item: PersonShiftWorkItem = {
            dateStr,
            day,
            weekday,
            shiftId: 'default',
            shiftName: t('calendar:paymentsModal.defaultShiftName'),
            shiftCode: 'PL',
            shiftColor: '#6366F1',
            rate,
            hasRateConfigured: rate > 0,
          }

          const existingItems = personItemsMap.get(personId) || []
          existingItems.push(item)
          personItemsMap.set(personId, existingItems)
        }
      }
    }

    const result: PersonPaymentSummary[] = []

    personItemsMap.forEach((items, personId) => {
      const person = personMap.get(personId) || {
        id: personId,
        name: 'Profissional',
        color: '#64748b',
      }

      const shiftsAmount = items.reduce((acc, curr) => acc + curr.rate, 0)
      const reimbursementsAmount =
        monthExpensesSummary.personReimbursements[personId] || 0
      const personExpenses =
        monthExpensesSummary.personExpenses[personId] || []
      const totalAmount = shiftsAmount + reimbursementsAmount

      result.push({
        person,
        shiftsCount: items.length,
        shiftsAmount,
        reimbursementsAmount,
        totalAmount,
        items: items.sort((a, b) => a.day - b.day),
        expenses: personExpenses,
      })
    })

    // Add any professional who has reimbursements but no scheduled shifts in currentMonth
    Object.keys(monthExpensesSummary.personReimbursements).forEach(
      (personId) => {
        if (personItemsMap.has(personId)) return
        const person = personMap.get(personId) || {
          id: personId,
          name: 'Profissional',
          color: '#64748b',
        }
        const reimbursementsAmount =
          monthExpensesSummary.personReimbursements[personId] || 0
        const personExpenses =
          monthExpensesSummary.personExpenses[personId] || []

        result.push({
          person,
          shiftsCount: 0,
          shiftsAmount: 0,
          reimbursementsAmount,
          totalAmount: reimbursementsAmount,
          items: [],
          expenses: personExpenses,
        })
      },
    )

    // Sort by total amount desc, then name asc
    return result.sort(
      (a, b) =>
        b.totalAmount - a.totalAmount ||
        a.person.name.localeCompare(b.person.name),
    )
  }, [
    currentMonth,
    dayShiftAssignments,
    assignments,
    availabilities,
    shiftDefMap,
    personMap,
    monthExpensesSummary,
    i18n.language,
    t,
  ])

  // Filtered list
  const filteredSummaries = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return summaries
    return summaries.filter((s) => s.person.name.toLowerCase().includes(q))
  }, [summaries, searchQuery])

  // Totals
  const totalPersonnelAmount = useMemo(
    () => summaries.reduce((acc, curr) => acc + curr.totalAmount, 0),
    [summaries],
  )
  const totalShiftsScheduled = useMemo(
    () => summaries.reduce((acc, curr) => acc + curr.shiftsCount, 0),
    [summaries],
  )
  const totalShiftsAmount = useMemo(
    () => summaries.reduce((acc, curr) => acc + curr.shiftsAmount, 0),
    [summaries],
  )
  const totalReimbursementsAmount = useMemo(
    () => summaries.reduce((acc, curr) => acc + curr.reimbursementsAmount, 0),
    [summaries],
  )
  const generalExpensesTotal = monthExpensesSummary.generalExpensesTotal
  const grandTotal = totalPersonnelAmount + generalExpensesTotal

  if (!isOpen || typeof document === 'undefined') return null

  const toggleExpandPerson = (personId: string) => {
    if (expandedPersonIds.includes(personId)) {
      setExpandedPersonIds(expandedPersonIds.filter((id) => id !== personId))
    } else {
      setExpandedPersonIds([...expandedPersonIds, personId])
    }
  }

  const formatBRL = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-payments-modal-title"
      className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-[900px] overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="month-payments-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white"
              >
                {t('calendar:paymentsModal.title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {t('calendar:paymentsModal.subtitle', {
                  month: formatMonthYear(currentMonth, i18n.language),
                })}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title={t('common:close')}
            aria-label={t('common:close')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body p-6 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Grand Total */}
            <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex flex-col justify-between">
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">
                {t('calendar:paymentsModal.totalToPay')}
              </span>
              <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                {formatBRL(grandTotal)}
              </span>
              {(totalReimbursementsAmount > 0 || generalExpensesTotal > 0) && (
                <span className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80 mt-1 font-medium truncate">
                  {t('calendar:paymentsModal.shiftsSubtotal', {
                    amount: formatBRL(totalShiftsAmount),
                  })}
                </span>
              )}
            </div>

            {/* Total Shifts */}
            <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/50 flex flex-col justify-between">
              <span className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                {t('calendar:paymentsModal.totalShifts')}
              </span>
              <span className="text-xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                {totalShiftsScheduled === 1
                  ? t('calendar:paymentsModal.shiftsCount', {
                      count: totalShiftsScheduled,
                    })
                  : t('calendar:paymentsModal.shiftsCountPlural', {
                      count: totalShiftsScheduled,
                    })}
              </span>
              {totalReimbursementsAmount > 0 && (
                <span className="text-[10px] text-indigo-800/80 dark:text-indigo-300/80 mt-1 font-medium truncate">
                  {t('calendar:paymentsModal.reimbursementsSubtotal', {
                    amount: formatBRL(totalReimbursementsAmount),
                  })}
                </span>
              )}
            </div>

            {/* Active People */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                {t('calendar:paymentsModal.totalActivePeople')}
              </span>
              <span className="text-xl font-black text-slate-800 dark:text-slate-200 mt-1">
                {summaries.length === 1
                  ? t('calendar:paymentsModal.peopleCount', {
                      count: summaries.length,
                    })
                  : t('calendar:paymentsModal.peopleCountPlural', {
                      count: summaries.length,
                    })}
              </span>
            </div>

            {/* General Operational Expenses */}
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex flex-col justify-between">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <span>{t('calendar:paymentsModal.totalGeneralExpenses')}</span>
              </span>
              <span className="text-xl font-black text-amber-700 dark:text-amber-400 mt-1">
                {formatBRL(generalExpensesTotal)}
              </span>
              <span className="text-[10px] text-amber-800/80 dark:text-amber-300/80 mt-1 font-medium truncate">
                {monthExpensesSummary.generalExpenses.length === 1
                  ? t('calendar:paymentsModal.generalExpensesCount', {
                      count: monthExpensesSummary.generalExpenses.length,
                    })
                  : t('calendar:paymentsModal.generalExpensesCountPlural', {
                      count: monthExpensesSummary.generalExpenses.length,
                    })}
              </span>
            </div>
          </div>

          {/* Search Input */}
          {summaries.length > 0 && (
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('calendar:paymentsModal.searchPlaceholder')}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          )}

          {/* List of Summaries */}
          {summaries.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {t('calendar:paymentsModal.emptyMonth')}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {t('calendar:paymentsModal.emptyMonthDesc')}
              </p>
            </div>
          ) : filteredSummaries.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('calendar:paymentsModal.emptySearch')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredSummaries.map((summary) => {
                const isExpanded = expandedPersonIds.includes(summary.person.id)
                const unconfiguredCount = summary.items.filter(
                  (it) => !it.hasRateConfigured,
                ).length

                return (
                  <div
                    key={summary.person.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xs transition-all"
                  >
                    {/* Person Summary Bar */}
                    <div
                      onClick={() => toggleExpandPerson(summary.person.id)}
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs"
                          style={{ backgroundColor: summary.person.color }}
                        >
                          {summary.person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {summary.person.name}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                            <span>
                              {summary.shiftsCount === 1
                                ? t('calendar:paymentsModal.shiftsCompleted', {
                                    count: summary.shiftsCount,
                                  })
                                : t(
                                    'calendar:paymentsModal.shiftsCompletedPlural',
                                    {
                                      count: summary.shiftsCount,
                                    },
                                  )}
                            </span>
                            {summary.reimbursementsAmount > 0 && (
                              <span
                                data-testid={`person-reimbursement-badge-${summary.person.id}`}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded-md border border-emerald-200 dark:border-emerald-800"
                              >
                                {t('calendar:paymentsModal.reimbursementsSubtotal', {
                                  amount: formatBRL(summary.reimbursementsAmount),
                                })}
                              </span>
                            )}
                            {unconfiguredCount > 0 && (
                              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-semibold">
                                <AlertCircle className="w-3 h-3" />
                                {t('calendar:paymentsModal.unconfiguredCount', {
                                  count: unconfiguredCount,
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <div className="text-right">
                          <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 block">
                            {formatBRL(summary.totalAmount)}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {isExpanded
                              ? t('calendar:paymentsModal.hideDetails')
                              : t('calendar:paymentsModal.viewDetails')}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Detailed Shift Items & Reimbursements (Collapsible) */}
                    {isExpanded && (
                      <div className="p-4 pt-1 border-t border-slate-100 dark:border-slate-800/70 bg-slate-50/50 dark:bg-slate-800/30 space-y-3 animate-fadeIn">
                        {summary.items.length > 0 && (
                          <div className="space-y-1.5">
                            {summary.items.map((item, idx) => (
                              <div
                                key={`${item.dateStr}-${item.shiftId}-${idx}`}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span className="font-bold text-slate-700 dark:text-slate-300 min-w-[70px]">
                                    {t('calendar:paymentsModal.dayDetail', {
                                      day: item.day,
                                      weekday: item.weekday,
                                    })}
                                  </span>

                                  <span
                                    className="px-2 py-0.5 rounded-sm text-[10px] font-black text-white shrink-0"
                                    style={{ backgroundColor: item.shiftColor }}
                                  >
                                    {item.shiftCode}
                                  </span>

                                  <span className="text-slate-600 dark:text-slate-300 truncate">
                                    {item.shiftName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  {item.hasRateConfigured ? (
                                    <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                                      {formatBRL(item.rate)}
                                    </span>
                                  ) : (
                                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      {t(
                                        'calendar:paymentsModal.rateNotConfigured',
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {summary.expenses.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <h5 className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              {t('calendar:paymentsModal.reimbursementsTitle', {
                                count: summary.expenses.length,
                              })}
                            </h5>
                            {summary.expenses.map((exp) => (
                              <div
                                key={exp.id}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/50 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 shrink-0">
                                    {formatDisplayDate(exp.date, i18n.language)}
                                  </span>
                                  {exp.category && (
                                    <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 shrink-0">
                                      {t(
                                        `calendar:eventsModal.categories.${exp.category}` as unknown as TemplateStringsArray,
                                      )}
                                    </span>
                                  )}
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {exp.description}
                                  </span>
                                </div>
                                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                                  {formatBRL(exp.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {/* General Operational Expenses Section */}
              {monthExpensesSummary.generalExpenses.length > 0 && (
                <div
                  data-testid="general-expenses-section"
                  className="rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                        <Receipt className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                          {t('calendar:paymentsModal.generalExpensesTitle')}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {t('calendar:paymentsModal.generalExpensesSubtitle')}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-amber-700 dark:text-amber-400">
                      {formatBRL(monthExpensesSummary.generalExpensesTotal)}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {monthExpensesSummary.generalExpenses.map((exp) => (
                      <div
                        key={exp.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                            {formatDisplayDate(exp.date, i18n.language)}
                          </span>
                          {exp.category && (
                            <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 shrink-0">
                              {t(
                                `calendar:eventsModal.categories.${exp.category}` as unknown as TemplateStringsArray,
                              )}
                            </span>
                          )}
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {exp.description}
                          </span>
                        </div>
                        <span className="font-extrabold text-amber-700 dark:text-amber-400 shrink-0 ml-2">
                          {formatBRL(exp.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {t('calendar:paymentsModal.totalToPay')}:
            </span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              {formatBRL(grandTotal)}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 transition cursor-pointer"
          >
            {t('calendar:paymentsModal.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
