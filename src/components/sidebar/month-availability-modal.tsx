import {
  Calendar,
  X,
  Clock,
  Layers,
  Coins,
  Trash2,
  AlertCircle,
  Plus,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { AvailabilityMiniCalendar } from './availability-mini-calendar'
import { formatMonthYear, getMonthDaysArray } from '../../utils/date-utils'
import { parseNumericRate } from '../../utils/shift-rate-utils'
import { Select } from '../ui/select'

import type { Person, ShiftDefinition } from '../../types'

export interface MonthAvailabilityModalProps {
  isOpen: boolean
  onClose: () => void
  person: Person | null
  currentMonth: string
  initialAvailableDays: number[]
  initialShiftAvailability?: Record<string, number[]>
  initialShiftRates?: Record<string, Record<number, number>>
  activeShifts?: ShiftDefinition[]
  onSave: (
    personId: string,
    availableDays: number[],
    shiftAvailability?: Record<string, number[]>,
    shiftRates?: Record<string, Record<number, number>>
  ) => void
}

const getDayOfWeek = (yearMonth: string, day: number) => {
  const [year, month] = yearMonth.split('-').map(Number)
  return new Date(year, month - 1, day).getDay()
}

const formatBRL = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function MonthAvailabilityModal({
  isOpen,
  onClose,
  person,
  currentMonth,
  initialAvailableDays,
  initialShiftAvailability = {},
  initialShiftRates = {},
  activeShifts = [],
  onSave,
}: MonthAvailabilityModalProps) {
  const { t, i18n } = useTranslation(['people', 'common'])
  const [availableDays, setAvailableDays] = useState<number[]>([])
  const [shiftAvailability, setShiftAvailability] =
    useState<Record<string, number[]>>(initialShiftAvailability)
  const [shiftRates, setShiftRates] =
    useState<Record<string, Record<number, number>>>(initialShiftRates)
  const [selectedShiftId, setSelectedShiftId] = useState<string>(activeShifts[0]?.id || '')

  // Rate form state
  const [rateInput, setRateInput] = useState('')
  const [rateApplyScope, setRateApplyScope] = useState<'all' | 'weekdays' | 'weekends' | 'custom'>('all')
  const [customRateDays, setCustomRateDays] = useState<number[]>([])

  const hasMultipleShifts = activeShifts.length > 0
  const effectiveShiftId = hasMultipleShifts ? selectedShiftId : 'default'

  useEffect(() => {
    if (person && isOpen) {
      setAvailableDays(initialAvailableDays || [])

      const safeShiftAvail: Record<string, number[]> = { ...(initialShiftAvailability || {}) }
      if (
        Object.keys(safeShiftAvail).length === 0 &&
        initialAvailableDays &&
        initialAvailableDays.length > 0 &&
        activeShifts.length > 0
      ) {
        activeShifts.forEach((s) => {
          safeShiftAvail[s.id] = [...initialAvailableDays]
        })
      }
      setShiftAvailability(safeShiftAvail)
      setShiftRates(initialShiftRates || {})
      setSelectedShiftId(activeShifts[0]?.id || '')
      setRateInput('')
      setRateApplyScope('all')
      setCustomRateDays([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, person?.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const currentSelectedShift = activeShifts.find((s) => s.id === selectedShiftId)

  const currentShiftDays = useMemo(() => {
    return hasMultipleShifts
      ? shiftAvailability[selectedShiftId] || []
      : availableDays
  }, [hasMultipleShifts, shiftAvailability, selectedShiftId, availableDays])

  const currentRates = useMemo(() => {
    return shiftRates[effectiveShiftId] || {}
  }, [shiftRates, effectiveShiftId])

  // Group current shift rates by rate value
  const rateGroups = useMemo(() => {
    const groups: Record<number, number[]> = {}
    Object.entries(currentRates).forEach(([dStr, rate]) => {
      const d = Number(dStr)
      if (d > 0 && typeof rate === 'number' && rate > 0) {
        if (!groups[rate]) groups[rate] = []
        groups[rate].push(d)
      }
    })
    return Object.entries(groups).map(([rateStr, days]) => ({
      rate: Number(rateStr),
      days: days.sort((a, b) => a - b),
      total: Number(rateStr) * days.length,
    }))
  }, [currentRates])

  const daysWithoutRate = useMemo(() => {
    return currentShiftDays.filter((d) => currentRates[d] === undefined || currentRates[d] <= 0)
  }, [currentShiftDays, currentRates])

  const baselineShiftAvailability = useMemo(() => {
    const safeShiftAvail: Record<string, number[]> = { ...(initialShiftAvailability || {}) }
    if (
      Object.keys(safeShiftAvail).length === 0 &&
      initialAvailableDays &&
      initialAvailableDays.length > 0 &&
      activeShifts.length > 0
    ) {
      activeShifts.forEach((s) => {
        safeShiftAvail[s.id] = [...initialAvailableDays]
      })
    }
    return safeShiftAvail
  }, [initialShiftAvailability, initialAvailableDays, activeShifts])

  const hasAvailabilityChanged = useMemo(() => {
    if (hasMultipleShifts) {
      return Object.entries(baselineShiftAvailability).some(([sId, initialDays]) => {
        const currentDays = shiftAvailability[sId] || []
        return (initialDays || []).some((day) => !currentDays.includes(day))
      })
    }
    return (initialAvailableDays || []).some((day) => !availableDays.includes(day))
  }, [
    hasMultipleShifts,
    baselineShiftAvailability,
    shiftAvailability,
    initialAvailableDays,
    availableDays,
  ])

  if (!isOpen || !person || typeof document === 'undefined') return null

  // Union of all days across all shifts
  const uniqueDaysUnion = hasMultipleShifts
    ? Array.from(new Set(Object.values(shiftAvailability).flat())).sort((a, b) => a - b)
    : availableDays

  const handleShiftDaysChange = (newDays: number[]) => {
    if (!selectedShiftId) return
    const updated = {
      ...shiftAvailability,
      [selectedShiftId]: newDays,
    }
    setShiftAvailability(updated)
  }

  const computeRateApplication = (
    currentRateMap: Record<number, number>,
    numericRate: number,
    scope: 'all' | 'weekdays' | 'weekends' | 'custom',
    customDays: number[],
  ): Record<number, number> => {
    const updated = { ...currentRateMap }
    const allMonthDays = getMonthDaysArray(currentMonth)
    const baseDaysPool = currentShiftDays.length > 0 ? currentShiftDays : allMonthDays

    let targetDays: number[] = []
    if (scope === 'all') {
      targetDays = baseDaysPool
    } else if (scope === 'weekdays') {
      targetDays = baseDaysPool.filter((d) => {
        const dow = getDayOfWeek(currentMonth, d)
        return dow >= 1 && dow <= 5
      })
    } else if (scope === 'weekends') {
      targetDays = baseDaysPool.filter((d) => {
        const dow = getDayOfWeek(currentMonth, d)
        return dow === 0 || dow === 6
      })
    } else if (scope === 'custom') {
      targetDays = customDays.length > 0 ? customDays : baseDaysPool
    }

    targetDays.forEach((d) => {
      updated[d] = numericRate
    })
    // Store as default base rate for this shift
    updated[0] = numericRate

    return updated
  }

  const handleApplyRate = () => {
    const numericRate = parseNumericRate(rateInput)
    if (isNaN(numericRate) || numericRate <= 0) return

    const updatedShiftRates = { ...shiftRates }
    const currentEffective = { ...(updatedShiftRates[effectiveShiftId] || {}) }
    const newEffective = computeRateApplication(
      currentEffective,
      numericRate,
      rateApplyScope,
      customRateDays,
    )

    updatedShiftRates[effectiveShiftId] = newEffective
    setShiftRates(updatedShiftRates)
    setRateInput('')
    setCustomRateDays([])
  }

  const handleRemoveRateGroup = (rate: number) => {
    const updatedShiftRates = { ...shiftRates }
    const currentEffective = { ...(updatedShiftRates[effectiveShiftId] || {}) }
    Object.keys(currentEffective).forEach((dStr) => {
      const d = Number(dStr)
      if (currentEffective[d] === rate) {
        delete currentEffective[d]
      }
    })
    updatedShiftRates[effectiveShiftId] = currentEffective
    setShiftRates(updatedShiftRates)
  }

  const handleToggleCustomDay = (day: number) => {
    if (customRateDays.includes(day)) {
      setCustomRateDays(customRateDays.filter((d) => d !== day))
    } else {
      setCustomRateDays([...customRateDays, day].sort((a, b) => a - b))
    }
  }

  const handleSave = () => {
    const finalShiftRates = { ...shiftRates }
    const pendingRate = parseNumericRate(rateInput)

    // Auto-apply if user typed a rate and clicked Save directly
    if (!isNaN(pendingRate) && pendingRate > 0) {
      const currentEffective = { ...(finalShiftRates[effectiveShiftId] || {}) }
      finalShiftRates[effectiveShiftId] = computeRateApplication(
        currentEffective,
        pendingRate,
        rateApplyScope,
        customRateDays,
      )
    }

    if (hasMultipleShifts) {
      onSave(person.id, uniqueDaysUnion, shiftAvailability, finalShiftRates)
    } else {
      onSave(person.id, availableDays, undefined, finalShiftRates)
    }
    onClose()
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-avail-modal-title"
      className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Header */}
        <div className="modal-header flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-xs shrink-0"
              style={{ backgroundColor: person.color }}
            >
              {person.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3
                id="month-avail-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white truncate max-w-[280px]"
              >
                {t('people:monthAvailability.title')}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {person.name} • {formatMonthYear(currentMonth, i18n.language)}
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

        {/* Fixed Warning when availability is modified */}
        {hasAvailabilityChanged && (
          <div
            role="alert"
            data-testid="availability-calendar-removal-warning"
            className="flex items-center gap-2.5 px-6 py-3 bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200/80 dark:border-amber-900/60 text-xs font-medium text-amber-900 dark:text-amber-200 shrink-0 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{t('people:monthAvailability.calendarRemovalWarning')}</span>
          </div>
        )}

        {/* Body */}
        <div className="modal-body p-6 overflow-y-auto space-y-5 custom-scrollbar">
          <div className="flex items-center gap-2 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-900 dark:text-indigo-200">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span
              dangerouslySetInnerHTML={{
                __html: t('people:monthAvailability.instruction', { name: person.name }),
              }}
            />
          </div>

          {/* Shift Selection Tabs for multi-shift months */}
          {hasMultipleShifts && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {t('people:monthAvailability.shiftsLabel')}
              </label>

              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto">
                {activeShifts.map((shift) => {
                  const count = (shiftAvailability[shift.id] || []).length
                  const isSelected = selectedShiftId === shift.id

                  return (
                    <button
                      key={shift.id}
                      type="button"
                      onClick={() => setSelectedShiftId(shift.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                        isSelected
                          ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: shift.color || '#6366F1' }}
                      />
                      <span>
                        {shift.name} ({shift.code})
                      </span>
                      {count > 0 && (
                        <span
                          className="text-[10px] px-1.5 py-0.2 rounded-full font-extrabold text-white"
                          style={{ backgroundColor: shift.color || '#6366F1' }}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {currentSelectedShift && (
                <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="px-1.5 py-0.2 rounded-sm text-[10px] font-black text-white uppercase"
                      style={{ backgroundColor: currentSelectedShift.color || '#3B82F6' }}
                    >
                      {currentSelectedShift.code}
                    </span>
                    <span>{currentSelectedShift.name}</span>
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      {t('people:monthAvailability.shiftDuration', {
                        time: currentSelectedShift.startTime,
                        hours: currentSelectedShift.durationHours,
                      })}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Mini Calendar */}
          <AvailabilityMiniCalendar
            month={currentMonth}
            selectedDays={currentShiftDays}
            onChange={hasMultipleShifts ? handleShiftDaysChange : setAvailableDays}
            accentColor={currentSelectedShift?.color || person.color}
            dayRates={currentRates}
          />

          {/* Section: Rates Configuration per shift / days */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {t('people:monthAvailability.ratesTitle')}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('people:monthAvailability.ratesSubtitle')}
                  </p>
                </div>
              </div>
            </div>

            {/* Rate Input & Scope Controls */}
            <div className="space-y-2.5 pt-1 border-t border-slate-200/70 dark:border-slate-700/70">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    {t('people:monthAvailability.currencySymbol')}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    placeholder={t('people:monthAvailability.ratePlaceholder')}
                    aria-label={t('people:monthAvailability.rateValueLabel')}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>

                <Select
                  value={rateApplyScope}
                  onChange={(e) =>
                    setRateApplyScope(e.target.value as 'all' | 'weekdays' | 'weekends' | 'custom')
                  }
                  aria-label={t('people:monthAvailability.applyTo')}
                  className="py-1.5"
                >
                  <option value="all">{t('people:monthAvailability.applyAllShiftDays')}</option>
                  <option value="weekdays">{t('people:monthAvailability.applyWeekdays')}</option>
                  <option value="weekends">{t('people:monthAvailability.applyWeekends')}</option>
                  <option value="custom">{t('people:monthAvailability.applySelectedDays')}</option>
                </Select>

                <button
                  type="button"
                  onClick={handleApplyRate}
                  disabled={!rateInput.trim()}
                  className="flex items-center justify-center gap-1 px-3.5 py-1.5 text-xs font-bold rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t('people:monthAvailability.applyRateBtn')}</span>
                </button>
              </div>

              {/* Custom Day Chips when 'custom' scope is chosen */}
              {rateApplyScope === 'custom' && (
                <div className="p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {t('people:monthAvailability.selectShiftDays')}
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {(currentShiftDays.length > 0
                      ? currentShiftDays
                      : getMonthDaysArray(currentMonth)
                    ).map((d) => {
                      const isChecked = customRateDays.includes(d)
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleToggleCustomDay(d)}
                          className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                            isChecked
                              ? 'bg-emerald-600 text-white shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {t('people:monthAvailability.dayItem', { day: d })}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* List of defined rate groups for this shift */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('people:monthAvailability.ratesSummary')}
              </span>

              {rateGroups.length === 0 ? (
                <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                  {t('people:monthAvailability.noRatesDefined')}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {rateGroups.map((group) => (
                    <div
                      key={group.rate}
                      className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs shadow-2xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">
                          {formatBRL(group.rate)}
                        </span>
                        <span className="text-slate-400 dark:text-slate-600">•</span>
                        <span className="text-slate-600 dark:text-slate-300 truncate text-[11px]">
                          {t('people:monthAvailability.rateGroupDays', {
                            count: group.days.length,
                            days: group.days.join(', '),
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {formatBRL(group.total)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveRateGroup(group.rate)}
                          title={t('people:monthAvailability.removeRateTooltip')}
                          aria-label={t('people:monthAvailability.removeRateTooltip')}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Warning for days with no rate assigned */}
              {currentShiftDays.length > 0 && daysWithoutRate.length > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50/80 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>
                    {t('people:monthAvailability.unassignedRatesWarning', {
                      count: daysWithoutRate.length,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex flex-col text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>
              {hasMultipleShifts
                ? t('people:monthAvailability.totalAvailableDays', {
                    count: uniqueDaysUnion.length,
                  })
                : availableDays.length === 1
                ? t('people:monthAvailability.markedDays', { count: availableDays.length })
                : t('people:monthAvailability.markedDaysPlural', { count: availableDays.length })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              {t('people:monthAvailability.cancel')}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition cursor-pointer"
            >
              {t('people:monthAvailability.save')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
