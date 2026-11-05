import {
  CalendarDays,
  Check,
  Clock,
  Eraser,
  Plus,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { useScheduleStore } from '../../store/use-schedule-store'
import { formatMonthYear, getDaysCountInMonth } from '../../utils/date-utils'

import type { ShiftDefinition } from '../../types'

export interface MonthShiftConfigModalProps {
  isOpen: boolean
  onClose: () => void
  currentMonth: string // 'YYYY-MM'
}

export function MonthShiftConfigModal({
  isOpen,
  onClose,
  currentMonth,
}: MonthShiftConfigModalProps) {
  const { t, i18n } = useTranslation([
    'calendar',
    'settings',
    'people',
    'common',
  ])
  const {
    shiftDefinitions,
    getRegistryForMonth,
    monthDailyShifts,
    setMonthDailyShifts,
    addShiftDefinition,
  } = useScheduleStore()

  const totalDays = getDaysCountInMonth(currentMonth)
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1)

  // Local state for shift days: { [shiftId]: number[] }
  const [localShiftDays, setLocalShiftDays] = useState<
    Record<string, number[]>
  >({})
  const [selectedShiftId, setSelectedShiftId] = useState<string>('')
  const [isCreatingNewShift, setIsCreatingNewShift] = useState(false)

  // New/Edit Shift Form state
  const [newShiftName, setNewShiftName] = useState('')
  const [newShiftCode, setNewShiftCode] = useState('')
  const [newShiftStartTime, setNewShiftStartTime] = useState('07:00')
  const [newShiftDuration, setNewShiftDuration] = useState(12)
  const [newShiftColor, setNewShiftColor] = useState('#3B82F6')

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      const existingConfig = monthDailyShifts[currentMonth] || {}
      const safeConfig: Record<string, number[]> = {}

      // If existing config is empty, initialize default shifts for all days or keep empty
      if (Object.keys(existingConfig).length > 0) {
        Object.entries(existingConfig).forEach(([sId, days]) => {
          safeConfig[sId] = [...days]
        })
      } else {
        // Default: include shifts that are active by default with empty day selection
        shiftDefinitions.forEach((s) => {
          if (s.enabledByDefault) {
            safeConfig[s.id] = []
          }
        })
      }

      setLocalShiftDays(safeConfig)
      const firstAvailableShift =
        Object.keys(safeConfig)[0] || shiftDefinitions[0]?.id || ''
      setSelectedShiftId(firstAvailableShift)
      setIsCreatingNewShift(false)
    }
  }, [isOpen, currentMonth, monthDailyShifts, shiftDefinitions])

  // ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  // Shifts as this month recorded them, plus the current ones that can still be added to it
  const monthShifts = getRegistryForMonth(currentMonth).shiftDefinitions
  const knownShifts = [
    ...monthShifts,
    ...shiftDefinitions.filter((s) => !monthShifts.some((m) => m.id === s.id)),
  ]

  // All shifts currently available in this month's config
  const activeShiftIdsInModal = Object.keys(localShiftDays)
  const shiftsInModal: ShiftDefinition[] = activeShiftIdsInModal
    .map((sId) => knownShifts.find((s) => s.id === sId))
    .filter((s): s is ShiftDefinition => Boolean(s))

  const currentSelectedShift = knownShifts.find(
    (s) => s.id === selectedShiftId,
  )
  const currentSelectedDays = localShiftDays[selectedShiftId] || []

  // Day toggle handler
  const handleToggleDay = (day: number) => {
    if (!selectedShiftId) return
    const current = localShiftDays[selectedShiftId] || []
    const updated = current.includes(day)
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b)

    setLocalShiftDays((prev) => ({
      ...prev,
      [selectedShiftId]: updated,
    }))
  }

  // Quick selection helpers
  const handleSelectDays = (days: number[]) => {
    if (!selectedShiftId) return
    setLocalShiftDays((prev) => ({
      ...prev,
      [selectedShiftId]: days,
    }))
  }

  const selectWeekdays = () => {
    const weekdays = daysArray.filter((day) => {
      const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`
      const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay()
      return dayOfWeek >= 1 && dayOfWeek <= 5
    })
    handleSelectDays(weekdays)
  }

  const selectWeekends = () => {
    const weekends = daysArray.filter((day) => {
      const dateStr = `${currentMonth}-${day.toString().padStart(2, '0')}`
      const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay()
      return dayOfWeek === 0 || dayOfWeek === 6
    })
    handleSelectDays(weekends)
  }

  const selectEven = () => {
    handleSelectDays(daysArray.filter((d) => d % 2 === 0))
  }

  const selectOdd = () => {
    handleSelectDays(daysArray.filter((d) => d % 2 !== 0))
  }

  const selectAll = () => {
    handleSelectDays([...daysArray])
  }

  const clearAll = () => {
    handleSelectDays([])
  }

  // Add shift from existing global list or open new shift form
  const handleAddShiftToMonth = (shiftId: string) => {
    if (!localShiftDays[shiftId]) {
      setLocalShiftDays((prev) => ({
        ...prev,
        [shiftId]: [],
      }))
    }
    setSelectedShiftId(shiftId)
  }

  const handleRemoveShiftFromMonth = (shiftId: string) => {
    setLocalShiftDays((prev) => {
      const next = { ...prev }
      delete next[shiftId]
      return next
    })
    if (selectedShiftId === shiftId) {
      const remainingIds = Object.keys(localShiftDays).filter(
        (id) => id !== shiftId,
      )
      setSelectedShiftId(remainingIds[0] || '')
    }
  }

  const handleCreateNewShiftSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newShiftName.trim()) return

    const created = addShiftDefinition({
      name: newShiftName.trim(),
      code: (newShiftCode.trim() || newShiftName.slice(0, 3)).toUpperCase(),
      startTime: newShiftStartTime || '07:00',
      durationHours: Number(newShiftDuration) || 12,
      color: newShiftColor || '#3B82F6',
      enabledByDefault: true,
    })

    setLocalShiftDays((prev) => ({
      ...prev,
      [created.id]: [],
    }))
    setSelectedShiftId(created.id)
    setIsCreatingNewShift(false)
    setNewShiftName('')
    setNewShiftCode('')
    setNewShiftStartTime('07:00')
    setNewShiftDuration(12)
  }

  const handleSaveAll = () => {
    setMonthDailyShifts(currentMonth, localShiftDays)
    onClose()
  }

  // Shifts from global list not yet added to this month
  const availableGlobalShiftsToAdd = shiftDefinitions.filter(
    (s) => !localShiftDays[s.id],
  )

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="month-shift-config-title"
      className="modal-overlay fixed inset-0 z-120 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-fadeIn"
    >
      <div className="modal-panel bg-white dark:bg-slate-900 rounded-2xl md:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] transition-colors">
        {/* Modal Header */}
        <div className="modal-header flex items-center justify-between px-5 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-xs shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="month-shift-config-title"
                className="text-base font-extrabold text-slate-900 dark:text-white"
              >
                {t('calendar:dailyShiftsConfig.title')} (
                {formatMonthYear(currentMonth, i18n.language)})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('calendar:dailyShiftsConfig.subtitle')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            aria-label={t('common:actions.close', { defaultValue: 'Fechar' })}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Two Column Layout */}
        <div className="modal-body flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-slate-100 dark:divide-slate-800">
          {/* Left Column: Shifts List & Management */}
          <div className="w-full md:w-80 p-4 flex flex-col min-h-0 bg-slate-50/40 dark:bg-slate-900/40 overflow-y-auto custom-scrollbar shrink-0 gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {t('calendar:dailyShiftsConfig.shiftsInMonth', {
                  count: shiftsInModal.length,
                })}
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNewShift(!isCreatingNewShift)}
                className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('calendar:dailyShiftsConfig.newShift')}</span>
              </button>
            </div>

            {/* Inline Form to create new Shift */}
            {isCreatingNewShift && (
              <form
                onSubmit={handleCreateNewShiftSubmit}
                className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 shadow-xs space-y-2.5 animate-fadeIn"
              >
                <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {t('calendar:dailyShiftsConfig.registerNewShift')}
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewShift(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                    {t('calendar:dailyShiftsConfig.shiftName')}
                  </label>
                  <input
                    type="text"
                    required
                    value={newShiftName}
                    onChange={(e) => setNewShiftName(e.target.value)}
                    placeholder={t(
                      'calendar:dailyShiftsConfig.shiftNamePlaceholder',
                    )}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      {t('calendar:dailyShiftsConfig.startTime')}
                    </label>
                    <input
                      type="time"
                      required
                      value={newShiftStartTime}
                      onChange={(e) => setNewShiftStartTime(e.target.value)}
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      {t('calendar:dailyShiftsConfig.duration')}
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={72}
                      value={newShiftDuration}
                      onChange={(e) =>
                        setNewShiftDuration(Number(e.target.value))
                      }
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      {t('calendar:dailyShiftsConfig.code')}
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={newShiftCode}
                      onChange={(e) => setNewShiftCode(e.target.value)}
                      placeholder={t(
                        'calendar:dailyShiftsConfig.codePlaceholder',
                      )}
                      className="w-full px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white uppercase font-bold focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-0.5">
                      {t('calendar:dailyShiftsConfig.color')}
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={newShiftColor}
                        onChange={(e) => setNewShiftColor(e.target.value)}
                        className="w-7 h-7 rounded-sm border border-slate-300 dark:border-slate-600 cursor-pointer p-0"
                      />
                      <span className="text-[10px] text-slate-500 font-mono">
                        {newShiftColor}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('calendar:dailyShiftsConfig.saveShift')}</span>
                </button>
              </form>
            )}

            {/* List of current shifts in month */}
            <div className="space-y-2 flex-1 min-h-0">
              {shiftsInModal.length === 0 ? (
                <div className="text-center py-6 px-3 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                  <Clock className="w-6 h-6 mx-auto text-slate-400 mb-1.5" />
                  <p className="text-xs text-slate-500">
                    {t('calendar:dailyShiftsConfig.noShiftsConfigured')}
                  </p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1">
                    {t('calendar:dailyShiftsConfig.noShiftsConfiguredDesc')}
                  </p>
                </div>
              ) : (
                shiftsInModal.map((shift) => {
                  const isSelected = selectedShiftId === shift.id
                  const daysCount = (localShiftDays[shift.id] || []).length

                  return (
                    <div
                      key={shift.id}
                      onClick={() => setSelectedShiftId(shift.id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          style={{ backgroundColor: shift.color }}
                          className="px-1.5 py-0.5 rounded-sm text-[10px] font-black text-white shrink-0 shadow-2xs"
                        >
                          {shift.code}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                            {shift.name}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                            <span>
                              {t('people:sidebar.shiftSummary', {
                                startTime: shift.startTime,
                                hours: shift.durationHours,
                              })}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {daysCount}{' '}
                              {daysCount === 1
                                ? t('people:card.dayLabel')
                                : t('people:card.dayLabelPlural')}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveShiftFromMonth(shift.id)
                        }}
                        title={t(
                          'calendar:dailyShiftsConfig.removeShiftTooltip',
                        )}
                        aria-label={t(
                          'calendar:dailyShiftsConfig.removeShiftTooltip',
                        )}
                        className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition shrink-0 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Add from existing global shifts dropdown */}
            {availableGlobalShiftsToAdd.length > 0 && (
              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                  {t('people:sidebar.shiftsTitle')}:
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {availableGlobalShiftsToAdd.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handleAddShiftToMonth(s.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-indigo-600 transition cursor-pointer"
                    >
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span>
                        {s.name} ({s.durationHours}
                        {t('calendar:dailyShiftsConfig.hoursUnit')})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Days Selection Grid */}
          <div className="flex-1 p-4 md:p-6 flex flex-col min-h-0 bg-white dark:bg-slate-900 overflow-y-auto custom-scrollbar">
            {currentSelectedShift ? (
              <div className="space-y-4">
                {/* Header for selected shift */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span
                      style={{ backgroundColor: currentSelectedShift.color }}
                      className="px-2 py-1 rounded-md text-xs font-black text-white shadow-2xs"
                    >
                      {currentSelectedShift.code}
                    </span>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                        {currentSelectedShift.name}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>
                          {t('people:sidebar.shiftSummary', {
                            startTime: currentSelectedShift.startTime,
                            hours: currentSelectedShift.durationHours,
                          })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <span className="self-start sm:self-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {t('calendar:dailyShiftsConfig.markedDays', {
                      count: currentSelectedDays.length,
                    })}
                  </span>
                </div>

                {/* Quick selection buttons */}
                <div className="flex items-center flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={selectWeekdays}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <span>{t('calendar:dailyShiftsConfig.weekdays')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={selectWeekends}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <span>{t('calendar:dailyShiftsConfig.weekends')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={selectEven}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <span>{t('calendar:dailyShiftsConfig.evenDays')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={selectOdd}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <span>{t('calendar:dailyShiftsConfig.oddDays')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={selectAll}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                  >
                    <span>{t('calendar:dailyShiftsConfig.allDays')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 transition ml-auto cursor-pointer"
                  >
                    <Eraser className="w-3.5 h-3.5 text-rose-500" />
                    <span>{t('calendar:dailyShiftsConfig.clear')}</span>
                  </button>
                </div>

                {/* Days Grid */}
                <div className="space-y-1">
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-[11px] text-slate-400 dark:text-slate-500 pb-1">
                    <span>{t('calendar:weekdays.sun')}</span>
                    <span>{t('calendar:weekdays.mon')}</span>
                    <span>{t('calendar:weekdays.tue')}</span>
                    <span>{t('calendar:weekdays.wed')}</span>
                    <span>{t('calendar:weekdays.thu')}</span>
                    <span>{t('calendar:weekdays.fri')}</span>
                    <span>{t('calendar:weekdays.sat')}</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {/* Empty padding for the first day of month if needed */}
                    {Array.from({
                      length: new Date(`${currentMonth}-01T12:00:00`).getDay(),
                    }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="p-2"
                      />
                    ))}

                    {daysArray.map((day) => {
                      const isSelected = currentSelectedDays.includes(day)
                      // Check which other shifts are active on this day
                      const otherShiftsOnDay = shiftsInModal.filter(
                        (s) =>
                          s.id !== selectedShiftId &&
                          localShiftDays[s.id]?.includes(day),
                      )

                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => handleToggleDay(day)}
                          style={
                            isSelected
                              ? {
                                  backgroundColor: currentSelectedShift.color,
                                  borderColor: currentSelectedShift.color,
                                  color: '#FFFFFF',
                                }
                              : undefined
                          }
                          className={`min-h-[52px] p-1.5 rounded-xl border flex flex-col items-center justify-between transition-all cursor-pointer relative ${
                            isSelected
                              ? 'shadow-xs scale-[1.02]'
                              : 'bg-slate-50/70 dark:bg-slate-800/40 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          <span
                            className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}
                          >
                            {day}
                          </span>

                          {/* Dots / tags for shifts on this day */}
                          <div className="flex items-center gap-1 mt-1 flex-wrap justify-center">
                            {isSelected && (
                              <Check className="w-3 h-3 text-white stroke-3" />
                            )}
                            {otherShiftsOnDay.map((s) => (
                              <span
                                key={s.id}
                                title={`${s.name} (${s.durationHours}h)`}
                                style={{ backgroundColor: s.color }}
                                className="w-2 h-2 rounded-full shrink-0 border border-white dark:border-slate-900"
                              />
                            ))}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <Clock className="w-10 h-10 mb-2 opacity-40" />
                <p className="text-sm font-semibold">
                  {t('calendar:dailyShiftsConfig.selectShiftPrompt')}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {t('calendar:dailyShiftsConfig.selectShiftPromptDesc')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer px-6 py-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            {t('common:actions.cancel', { defaultValue: 'Cancelar' })}
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Check className="w-4 h-4" />
            <span>{t('calendar:dailyShiftsConfig.saveConfig')}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
